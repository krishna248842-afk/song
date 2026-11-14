const GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal',
  'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative',
  'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk',
  'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'Alternative Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock',
  'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock',
  'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret',
  'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka',
  'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion',
  'Bebop', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock',
  'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson',
  'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam',
  'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock',
  'Drum Solo', 'A Cappella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass', 'Club-House', 'Hardcore', 'Terror',
  'Indie', 'BritPop', 'Afro-Punk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap', 'Heavy Metal', 'Black Metal',
  'Crossover', 'Contemporary Christian', 'Christian Rock', 'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop',
];

function decodeText(bytes, encoding = 0) {
  if (!bytes?.length) return '';
  let view = bytes;
  while (view.length && (view[view.length - 1] === 0 || view[view.length - 1] === 255)) view = view.subarray(0, view.length - 1);
  try {
    if (encoding === 0) return new TextDecoder('windows-1252').decode(view).replace(/\0/g, '').trim();
    if (encoding === 3) return new TextDecoder('utf-8').decode(view).replace(/\0/g, '').trim();
    if (encoding === 1) {
      if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) return new TextDecoder('utf-16be').decode(view).replace(/\0/g, '').trim();
      return new TextDecoder('utf-16le').decode(view).replace(/^\uFEFF/, '').replace(/\0/g, '').trim();
    }
    if (encoding === 2) {
      const swapped = new Uint8Array(view.length + (view.length % 2));
      for (let i = 0; i + 1 < view.length; i += 2) { swapped[i] = view[i + 1]; swapped[i + 1] = view[i]; }
      return new TextDecoder('utf-16le').decode(swapped).replace(/\0/g, '').trim();
    }
  } catch { /* fall through to a forgiving decoder */ }
  return new TextDecoder().decode(view).replace(/\0/g, '').trim();
}

function readSynchsafe(bytes, start) {
  return ((bytes[start] & 0x7f) << 21) | ((bytes[start + 1] & 0x7f) << 14) | ((bytes[start + 2] & 0x7f) << 7) | (bytes[start + 3] & 0x7f);
}

function readUint24(bytes, offset) {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readFrameText(frameBytes) {
  if (!frameBytes.length) return '';
  return decodeText(frameBytes.subarray(1), frameBytes[0]);
}

function extractApic(frameBytes) {
  if (frameBytes.length < 5) return null;
  const encoding = frameBytes[0];
  let mimeEnd = 1;
  while (mimeEnd < frameBytes.length && frameBytes[mimeEnd] !== 0) mimeEnd += 1;
  const mime = new TextDecoder('ascii').decode(frameBytes.subarray(1, mimeEnd)) || 'image/jpeg';
  let cursor = Math.min(mimeEnd + 1, frameBytes.length);
  cursor += 1; // APIC picture type
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < frameBytes.length && !(frameBytes[cursor] === 0 && frameBytes[cursor + 1] === 0)) cursor += 2;
    cursor = Math.min(cursor + 2, frameBytes.length);
  } else {
    while (cursor < frameBytes.length && frameBytes[cursor] !== 0) cursor += 1;
    cursor = Math.min(cursor + 1, frameBytes.length);
  }
  if (cursor >= frameBytes.length) return null;
  return new Blob([frameBytes.subarray(cursor)], { type: mime.split(';')[0] || 'image/jpeg' });
}

function parseId3Frames(bytes, version) {
  const tags = {};
  let cover = null;
  let cursor = 10;
  const end = Math.min(bytes.length, 10 + readSynchsafe(bytes, 6));
  const frameHeader = version === 2 ? 6 : 10;

  while (cursor + frameHeader <= end) {
    const idBytes = bytes.subarray(cursor, cursor + (version === 2 ? 3 : 4));
    if (idBytes.every((byte) => byte === 0)) break;
    const id = new TextDecoder('ascii').decode(idBytes);
    const size = version === 2
      ? readUint24(bytes, cursor + 3)
      : (version === 4 ? readSynchsafe(bytes, cursor + 4) : new DataView(bytes.buffer, bytes.byteOffset + cursor + 4, 4).getUint32(0));
    if (!Number.isFinite(size) || size <= 0 || cursor + frameHeader + size > end) break;
    const frameBytes = bytes.subarray(cursor + frameHeader, cursor + frameHeader + size);
    if (id[0] === 'T' && id !== 'TXXX' && id !== 'TXX') {
      const value = readFrameText(frameBytes);
      const names = {
        TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album',
        TCON: 'genre', TCO: 'genre', TDRC: 'year', TYER: 'year', TYE: 'year',
      };
      if (names[id] && value) tags[names[id]] = value;
    } else if (id === 'APIC') {
      cover = extractApic(frameBytes) || cover;
    } else if (id === 'PIC' && frameBytes.length > 5) {
      const format = new TextDecoder('ascii').decode(frameBytes.subarray(1, 4)).toLowerCase();
      const pic = new Blob([frameBytes.subarray(5)], { type: format === 'png' ? 'image/png' : 'image/jpeg' });
      cover = pic.size ? pic : cover;
    }
    cursor += frameHeader + size;
  }
  return { tags, cover };
}

function parseId3v1(bytes) {
  if (bytes.length < 128) return {};
  const tail = bytes.subarray(bytes.length - 128);
  if (new TextDecoder('ascii').decode(tail.subarray(0, 3)) !== 'TAG') return {};
  const read = (a, b) => new TextDecoder('windows-1252').decode(tail.subarray(a, b)).replace(/\0/g, '').trim();
  const tags = {};
  if (read(3, 33)) tags.title = read(3, 33);
  if (read(33, 63)) tags.artist = read(33, 63);
  if (read(63, 93)) tags.album = read(63, 93);
  if (read(93, 97)) tags.year = read(93, 97);
  if (tail[127] < GENRES.length && GENRES[tail[127]]) tags.genre = GENRES[tail[127]];
  return tags;
}

function normalizeGenre(value) {
  if (!value) return '';
  const numeric = value.match(/^\(?\s*(\d{1,3})\s*\)?$/);
  if (numeric && GENRES[Number(numeric[1])]) return GENRES[Number(numeric[1])];
  return value.replace(/^\((?:RX|CR)\)\s*/i, '').trim();
}

function filenameTitle(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled track';
}

export async function readAudioMetadata(file) {
  let tags = {};
  let cover = null;
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head.length >= 10 && String.fromCharCode(...head.subarray(0, 3)) === 'ID3') {
      const version = head[3] === 2 ? 2 : head[3] === 4 ? 4 : 3;
      const tagBytes = Math.min(file.size, 10 + readSynchsafe(head, 6));
      const tag = new Uint8Array(await file.slice(0, tagBytes).arrayBuffer());
      const parsed = parseId3Frames(tag, version);
      tags = parsed.tags;
      cover = parsed.cover;
    }
    if (!tags.title || !tags.artist || !tags.album || !tags.genre) {
      const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 128)).arrayBuffer());
      const fallback = parseId3v1(tail);
      tags = { ...fallback, ...tags };
    }
  } catch { /* Some unusual files still import using their filename and browser metadata. */ }

  return {
    title: tags.title || filenameTitle(file.name),
    artist: tags.artist || 'Unknown artist',
    album: tags.album || 'Local files',
    genre: normalizeGenre(tags.genre) || 'Unknown genre',
    year: tags.year || '',
    coverBlob: cover,
  };
}

export async function makeCoverThumbnail(blob, size = 420) {
  if (!blob) return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const side = Math.min(size, Math.max(bitmap.width, bitmap.height));
    const scale = size / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#18201a';
    context.fillRect(0, 0, size, size);
    const crop = Math.min(width, height);
    const sx = Math.max(0, Math.round((width - crop) / 2));
    const sy = Math.max(0, Math.round((height - crop) / 2));
    const dx = Math.max(0, Math.round((size - crop) / 2));
    const dy = Math.max(0, Math.round((size - crop) / 2));
    context.drawImage(bitmap, sx / scale, sy / scale, crop / scale, crop / scale, dx, dy, crop, crop);
    bitmap.close?.();
    if (canvas.convertToBlob) return await canvas.convertToBlob({ type: 'image/webp', quality: .82 });
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .82)) || blob;
  } catch {
    return blob;
  }
}

export function readDuration(file, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };
    const timer = setTimeout(() => finish(0), timeoutMs);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

export function normalizeStem(path) {
  return path.replace(/\\/g, '/').replace(/\.[^.]+$/, '').split('/').map((part) => part.trim().toLocaleLowerCase()).join('/');
}

export function parseLyrics(text) {
  const lines = [];
  const pattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*([^\r\n]*)/g;
  for (const match of text.matchAll(pattern)) {
    const fractional = match[3] ? Number(`0.${match[3]}`) : 0;
    const time = Number(match[1]) * 60 + Number(match[2]) + fractional;
    const lyric = match[4].trim();
    if (lyric) lines.push({ time, text: lyric });
  }
  return lines.sort((a, b) => a.time - b.time);
}
