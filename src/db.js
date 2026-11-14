const DB_NAME = 'listen-library';
const DB_VERSION = 1;

let databasePromise;

export function openDatabase() {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('songs')) {
        const songs = db.createObjectStore('songs', { keyPath: 'id' });
        songs.createIndex('addedAt', 'addedAt');
        songs.createIndex('title', 'title');
        songs.createIndex('artist', 'artist');
        songs.createIndex('lastPlayedAt', 'lastPlayedAt');
      }
      if (!db.objectStoreNames.contains('playlists')) {
        const playlists = db.createObjectStore('playlists', { keyPath: 'id' });
        playlists.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Could not open the local music library.'));
    request.onblocked = () => reject(new Error('Close other Listen tabs to finish updating your library.'));
  });

  return databasePromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('The local database operation failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('The local database operation was cancelled.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The local database request failed.'));
  });
}

export async function getAllSongs() {
  const db = await openDatabase();
  const tx = db.transaction('songs', 'readonly');
  const result = await requestResult(tx.objectStore('songs').getAll());
  await transactionDone(tx);
  return result;
}

export async function getSong(id) {
  const db = await openDatabase();
  const tx = db.transaction('songs', 'readonly');
  const result = await requestResult(tx.objectStore('songs').get(id));
  await transactionDone(tx);
  return result;
}

export async function putSong(song) {
  const db = await openDatabase();
  const tx = db.transaction('songs', 'readwrite');
  tx.objectStore('songs').put(song);
  await transactionDone(tx);
  return song;
}

export async function putSongWithMedia(song, audioBlob, coverBlob = null) {
  const db = await openDatabase();
  const names = coverBlob ? ['songs', 'audio', 'covers'] : ['songs', 'audio'];
  const tx = db.transaction(names, 'readwrite');
  tx.objectStore('songs').put(song);
  tx.objectStore('audio').put({ id: song.id, blob: audioBlob });
  if (coverBlob) tx.objectStore('covers').put({ id: song.id, blob: coverBlob });
  await transactionDone(tx);
  return song;
}

export async function getAudioBlob(id) {
  const db = await openDatabase();
  const tx = db.transaction('audio', 'readonly');
  const record = await requestResult(tx.objectStore('audio').get(id));
  await transactionDone(tx);
  return record?.blob || null;
}

export async function putAudioBlob(id, blob) {
  const db = await openDatabase();
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').put({ id, blob });
  await transactionDone(tx);
}

export async function deleteAudioBlob(id) {
  const db = await openDatabase();
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').delete(id);
  await transactionDone(tx);
}

export async function getCoverBlob(id) {
  const db = await openDatabase();
  const tx = db.transaction('covers', 'readonly');
  const record = await requestResult(tx.objectStore('covers').get(id));
  await transactionDone(tx);
  return record?.blob || null;
}

export async function putCoverBlob(id, blob) {
  if (!blob) return;
  const db = await openDatabase();
  const tx = db.transaction('covers', 'readwrite');
  tx.objectStore('covers').put({ id, blob });
  await transactionDone(tx);
}

export async function deleteCoverBlob(id) {
  const db = await openDatabase();
  const tx = db.transaction('covers', 'readwrite');
  tx.objectStore('covers').delete(id);
  await transactionDone(tx);
}

export async function getAllPlaylists() {
  const db = await openDatabase();
  const tx = db.transaction('playlists', 'readonly');
  const result = await requestResult(tx.objectStore('playlists').getAll());
  await transactionDone(tx);
  return result;
}

export async function putPlaylist(playlist) {
  const db = await openDatabase();
  const tx = db.transaction('playlists', 'readwrite');
  tx.objectStore('playlists').put(playlist);
  await transactionDone(tx);
  return playlist;
}

export async function deletePlaylist(id) {
  const db = await openDatabase();
  const tx = db.transaction('playlists', 'readwrite');
  tx.objectStore('playlists').delete(id);
  await transactionDone(tx);
}

export async function getSetting(key) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readonly');
  const result = await requestResult(tx.objectStore('settings').get(key));
  await transactionDone(tx);
  return result?.value;
}

export async function setSetting(key, value) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value });
  await transactionDone(tx);
}

export async function getAllSettings() {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readonly');
  const result = await requestResult(tx.objectStore('settings').getAll());
  await transactionDone(tx);
  return Object.fromEntries(result.map(({ key, value }) => [key, value]));
}

export async function deleteSongAndMedia(id) {
  const db = await openDatabase();
  const tx = db.transaction(['songs', 'audio', 'covers'], 'readwrite');
  tx.objectStore('songs').delete(id);
  tx.objectStore('audio').delete(id);
  tx.objectStore('covers').delete(id);
  await transactionDone(tx);
}

export async function getStoredMediaUsage() {
  const db = await openDatabase();
  const tx = db.transaction(['audio', 'covers'], 'readonly');
  const totals = { audioBytes: 0, coverBytes: 0, audioCount: 0, coverCount: 0 };
  const audioDone = new Promise((resolve, reject) => {
    const request = tx.objectStore('audio').openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      totals.audioBytes += cursor.value?.blob?.size || 0;
      totals.audioCount += 1;
      cursor.continue();
    };
  });
  const coverDone = new Promise((resolve, reject) => {
    const request = tx.objectStore('covers').openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      totals.coverBytes += cursor.value?.blob?.size || 0;
      totals.coverCount += 1;
      cursor.continue();
    };
  });
  await Promise.all([audioDone, coverDone, transactionDone(tx)]);
  return totals;
}

export async function hasAudioBlob(id) {
  const db = await openDatabase();
  const tx = db.transaction('audio', 'readonly');
  const exists = await requestResult(tx.objectStore('audio').count(id));
  await transactionDone(tx);
  return exists > 0;
}
