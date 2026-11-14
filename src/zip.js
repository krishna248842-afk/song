const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function updateCrc(crc, bytes) {
  let value = crc;
  for (let i = 0; i < bytes.length; i += 1) value = CRC_TABLE[(value ^ bytes[i]) & 0xff] ^ (value >>> 8);
  return value >>> 0;
}

function textBytes(text) {
  return new TextEncoder().encode(text);
}

function leHeader(size, entries) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const [kind, value] of entries) {
    if (kind === 'u16') { view.setUint16(cursor, value, true); cursor += 2; }
    else { view.setUint32(cursor, value >>> 0, true); cursor += 4; }
  }
  return bytes;
}

function localHeader(nameLength, date, time) {
  return leHeader(30, [
    ['u32', 0x04034b50], ['u16', 20], ['u16', 0x0808], ['u16', 0],
    ['u16', time], ['u16', date], ['u32', 0], ['u32', 0], ['u32', 0],
    ['u16', nameLength], ['u16', 0],
  ]);
}

function centralHeader(nameLength, date, time, crc, size, offset) {
  return leHeader(46, [
    ['u32', 0x02014b50], ['u16', 20], ['u16', 20], ['u16', 0x0808], ['u16', 0],
    ['u16', time], ['u16', date], ['u32', crc], ['u32', size], ['u32', size],
    ['u16', nameLength], ['u16', 0], ['u16', 0], ['u16', 0], ['u16', 0], ['u32', 0], ['u32', offset],
  ]);
}

function dataDescriptor(crc, size) {
  return leHeader(16, [['u32', 0x08074b50], ['u32', crc], ['u32', size], ['u32', size]]);
}

function endRecord(count, centralSize, centralOffset) {
  return leHeader(22, [
    ['u32', 0x06054b50], ['u16', 0], ['u16', 0], ['u16', count], ['u16', count],
    ['u32', centralSize], ['u32', centralOffset], ['u16', 0],
  ]);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function slug(value) {
  return String(value || 'track').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 72) || 'track';
}

function extensionFor(song) {
  const fromName = song.fileName?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName;
  return 'audio';
}

function makeEntryName(song, index, type) {
  const prefix = `${String(index + 1).padStart(4, '0')}-${String(song.id).slice(0, 8)}`;
  if (type === 'audio') return `audio/${prefix}-${slug(song.title)}.${extensionFor(song)}`;
  if (type === 'cover') return `artwork/${prefix}.webp`;
  return `lyrics/${prefix}.lrc`;
}

async function* blobChunks(blob) {
  if (blob.stream) {
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.length) yield value;
      }
    } finally {
      reader.releaseLock?.();
    }
  } else {
    yield new Uint8Array(await blob.arrayBuffer());
  }
}

/** Stream a store-only ZIP. Chromium can write straight to disk; other browsers receive a download Blob. */
export async function exportLibraryBackup(songs, { getAudio, getCover, playlists = [], onProgress = () => {} } = {}) {
  let writable = null;
  if (typeof globalThis.showSaveFilePicker === 'function') {
    try {
      const handle = await globalThis.showSaveFilePicker({
        suggestedName: `listen-library-${new Date().toISOString().slice(0, 10)}.zip`,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      });
      writable = await handle.createWritable();
    } catch (error) {
      if (error?.name === 'AbortError') return { cancelled: true, exported: 0, missing: 0 };
      throw error;
    }
  }

  const fallbackChunks = [];
  let offset = 0;
  const directory = [];
  const write = async (chunk) => {
    if (writable) await writable.write(chunk);
    else fallbackChunks.push(chunk);
    offset += chunk.byteLength;
    if (offset > 0xffffffff) throw new Error('This ZIP format supports backups up to 4 GB. Export smaller batches from your library.');
  };
  const { time, date } = dosDateTime();
  let exported = 0;
  let missing = 0;
  const entries = [];

  for (let index = 0; index < songs.length; index += 1) {
    const song = songs[index];
    const audio = await getAudio(song);
    if (!audio) { missing += 1; continue; }
    const audioPath = makeEntryName(song, index, 'audio');
    entries.push({ path: audioPath, blob: audio });
    const cover = await getCover(song);
    if (cover) entries.push({ path: makeEntryName(song, index, 'cover'), blob: cover });
    if (song.lyrics) entries.push({ path: makeEntryName(song, index, 'lyrics'), blob: new Blob([song.lyrics], { type: 'text/plain;charset=utf-8' }) });
  }

  const manifest = {
    app: 'Listen',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    note: 'Original audio and artwork are included without recompression. Import this archive manually to restore files.',
    songs: songs.map((song, index) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      genre: song.genre,
      duration: song.duration,
      folder: song.folder,
      addedAt: song.addedAt,
      playCount: song.playCount || 0,
      liked: Boolean(song.liked),
      downloaded: Boolean(song.downloaded),
      audioPath: entries.some((entry) => entry.path === makeEntryName(song, index, 'audio')) ? makeEntryName(song, index, 'audio') : null,
      artworkPath: entries.some((entry) => entry.path === makeEntryName(song, index, 'cover')) ? makeEntryName(song, index, 'cover') : null,
      lyricsPath: song.lyrics ? makeEntryName(song, index, 'lyrics') : null,
    })),
    playlists: playlists.map((playlist) => ({ id: playlist.id, name: playlist.name, songIds: playlist.songIds || [], createdAt: playlist.createdAt, color: playlist.color })),
  };
  entries.unshift({ path: 'listen-library.json', blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }) });

  const centralOffset = () => offset;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.blob.size > 0xffffffff) throw new Error(`"${entry.path}" is larger than the ZIP format supports.`);
    const name = textBytes(entry.path);
    const localOffset = offset;
    await write(localHeader(name.length, date, time));
    await write(name);
    let crc = 0xffffffff;
    let size = 0;
    for await (const chunk of blobChunks(entry.blob)) {
      crc = updateCrc(crc, chunk);
      size += chunk.byteLength;
      if (size > 0xffffffff) throw new Error(`"${entry.path}" is larger than the ZIP format supports.`);
      await write(chunk);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    await write(dataDescriptor(crc, size));
    directory.push({ name, crc, size, offset: localOffset });
    if (entry.path.startsWith('audio/')) exported += 1;
    onProgress({ done: i + 1, total: entries.length, label: entry.path });
  }

  const centralStart = centralOffset();
  for (const entry of directory) {
    await write(centralHeader(entry.name.length, date, time, entry.crc, entry.size, entry.offset));
    await write(entry.name);
  }
  const centralSize = offset - centralStart;
  await write(endRecord(directory.length, centralSize, centralStart));

  if (writable) {
    await writable.close();
  } else {
    const blob = new Blob(fallbackChunks, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `listen-library-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return { cancelled: false, exported, missing, archiveEntries: directory.length };
}
