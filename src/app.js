import {
  deleteAudioBlob,
  deletePlaylist as removePlaylistFromDb,
  deleteSongAndMedia,
  getAllPlaylists,
  getAllSettings,
  getAllSongs,
  getAudioBlob,
  getCoverBlob,
  getStoredMediaUsage,
  openDatabase,
  putAudioBlob,
  putPlaylist,
  putSong,
  putSongWithMedia,
  setSetting,
} from './db.js';
import { makeCoverThumbnail, normalizeStem, parseLyrics, readAudioMetadata, readDuration } from './metadata.js';
import { exportLibraryBackup } from './zip.js';

const ICON_PATHS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  library: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 6h16M8 9h8M8 12h5"/>',
  download: '<path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v3h16v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 5v14l10-7z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
  previous: '<path d="M19 5v14L9 12z" fill="currentColor" stroke="none"/><path d="M5 5v14"/>',
  heart: '<path d="M20.8 8.8c0 4.3-8.8 10.1-8.8 10.1S3.2 13.1 3.2 8.8A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8.8 2.3Z"/>',
  heartFill: '<path d="M20.8 8.8c0 4.3-8.8 10.1-8.8 10.1S3.2 13.1 3.2 8.8A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8.8 2.3Z" fill="currentColor" stroke="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  shuffle: '<path d="m16 3 5 4-5 4M3 7h2.5c4.5 0 5.3 10 10 10H21"/><path d="m16 13 5 4-5 4M3 17h2.5c1.1 0 2-.6 2.7-1.5M13.5 8.5c.6-.9 1.4-1.5 2.5-1.5H21"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4"/><path d="M21 13v3a2 2 0 0 1-2 2H3"/>',
  repeatOne: '<path d="m17 2 4 4-4 4"/><path d="M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4"/><path d="M21 13v3a2 2 0 0 1-2 2H3M12 10v5m-1.5-3.5 1.5-1.5"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v4h16v-4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  install: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v8m0 0 3-3m-3 3-3-3M9 17h6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  queue: '<path d="M4 6h16M4 12h11M4 18h8"/><path d="M18 15v6m-3-3h6"/>',
  lyrics: '<path d="M4 5h16M4 9h12M4 13h14M4 17h9"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  headphones: '<path d="M3 13v-1a9 9 0 0 1 18 0v1"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  trash: '<path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
  edit: '<path d="m4 16.5-.8 4.3 4.3-.8L20 7.5 16.5 4z"/><path d="m14.5 6 3.5 3.5"/>',
  album: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  export: '<path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M5 13v6h14v-6"/>',
  remove: '<path d="M5 12h14"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  bars: '<path d="M4 19v-6m5 6V5m5 14v-9m5 9V8"/>',
};

const DEFAULT_PREFS = { autoDownload: false, offlineMode: false, volume: .78, speed: 1, equalizer: 'off' };
const COLOR_OPTIONS = ['#2e8751', '#27739b', '#8b5a9c', '#ad6b3d', '#9a4855', '#53663a'];
const ROW_HEIGHT_DESKTOP = 68;
const ROW_HEIGHT_MOBILE = 63;
const mainView = document.getElementById('main-view');
const playerBar = document.getElementById('player-bar');
const overlayRoot = document.getElementById('overlay-root');
const audio = document.getElementById('audio');
const toastRoot = document.getElementById('toast-root');
const searchInput = document.getElementById('global-search');
const state = {
  songs: [], playlists: [], prefs: { ...DEFAULT_PREFS }, recentHistory: [],
  view: 'home', searchQuery: '', genreFilter: 'all', folderFilter: 'all', sort: 'recent', libraryTab: 'songs',
  playlistId: null, albumArtist: '', albumName: '',
  currentId: null, queue: [], queueIndex: -1, playing: false, shuffle: false, repeat: 'off',
  playerOpen: false, playerPanel: null, modal: null, volume: DEFAULT_PREFS.volume, speed: 1, equalizer: 'off',
  sleepMinutes: 0, sleepTimer: null, pendingInstall: null, pendingRelinkId: null,
  downloadQueue: { items: [], index: 0, complete: 0, failed: 0, paused: false, cancelled: false, processing: false, activeId: null },
  importProgress: null, mediaUsage: { audioBytes: 0, coverBytes: 0 }, storageEstimate: null, persistentStorage: null,
  storageWarned: false, online: navigator.onLine !== false, dragDepth: 0,
};
const coverObjectUrls = new Map();
const coverRequests = new Map();
const virtualLists = new Map();
let virtualListSerial = 0;
let activeObjectUrl = null;
let lastRecordedId = null;
let audioContext = null;
let audioSourceNode = null;
let eqNodes = null;
let lastTimePaint = 0;
let queueWorkerStarted = false;
let volumePersistTimer = null;

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.music}</svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hashText(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function artIndexFor(song) {
  return Number.isInteger(song?.artIndex) ? song.artIndex % 8 : hashText(`${song?.album || ''}${song?.artist || ''}${song?.id || ''}`) % 8;
}

function coverMarkup(song, extraClass = '') {
  if (!song) return `<div class="cover cover-art-2 ${extraClass}" aria-hidden="true"><span class="cover-kicker">LISTEN</span><span class="cover-mark">♪</span></div>`;
  const title = escapeHtml(song.title || 'Untitled');
  const id = escapeHtml(song.id);
  const image = song.coverArt ? `<img class="cover-img" data-cover-id="${id}" alt="" loading="lazy" />` : '';
  return `<div class="cover cover-art-${artIndexFor(song)} ${extraClass}" aria-label="Artwork for ${title}"><span class="cover-kicker">LISTEN / ORIGINALS</span><span class="cover-mark">${title}</span>${image}</div>`;
}

function blankCover(color, title = '♪') {
  const safeColor = COLOR_OPTIONS.includes(color) ? color : COLOR_OPTIONS[0];
  return `<div class="cover cover-art-2 playlist-cover-empty" style="background:linear-gradient(145deg,${safeColor},#142018)" aria-hidden="true"><span>${escapeHtml(title.slice(0, 1).toUpperCase())}</span></div>`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '--:--';
  const total = Math.floor(Number(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatTime(seconds) {
  return formatDuration(seconds);
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function songById(id) { return state.songs.find((song) => song.id === id); }
function playlistById(id) { return state.playlists.find((playlist) => playlist.id === id); }

function sortedSongs(list = state.songs, sort = state.sort) {
  const result = [...list];
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  if (sort === 'name') result.sort((a, b) => collator.compare(a.title || '', b.title || ''));
  else if (sort === 'artist') result.sort((a, b) => collator.compare(a.artist || '', b.artist || '') || collator.compare(a.title || '', b.title || ''));
  else if (sort === 'played') result.sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || collator.compare(a.title || '', b.title || ''));
  else if (sort === 'recent') result.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  else if (sort === 'lastPlayed') result.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  return result;
}

function filteredSongs({ query = '', genre = 'all', folder = 'all', list = state.songs, sort = state.sort } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const result = list.filter((song) => {
    if (needle && !`${song.title} ${song.artist} ${song.album}`.toLocaleLowerCase().includes(needle)) return false;
    if (genre !== 'all' && song.genre !== genre) return false;
    if (folder !== 'all' && song.folder !== folder) return false;
    return true;
  });
  return sortedSongs(result, sort);
}

function albumGroups() {
  const map = new Map();
  for (const song of state.songs) {
    const artist = song.artist || 'Unknown artist';
    const album = song.album || 'Unknown album';
    const key = `${artist.toLocaleLowerCase()}\u241f${album.toLocaleLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, artist, album, songs: [] });
    map.get(key).songs.push(song);
  }
  return [...map.values()].sort((a, b) => b.songs.reduce((sum, song) => sum + (song.addedAt || 0), 0) - a.songs.reduce((sum, song) => sum + (song.addedAt || 0), 0));
}

function findAlbum(artist, album) {
  return albumGroups().find((group) => group.artist === artist && group.album === album);
}

function playlistSongs(playlist) {
  if (!playlist) return [];
  const byId = new Map(state.songs.map((song) => [song.id, song]));
  return (playlist.songIds || []).map((id) => byId.get(id)).filter(Boolean);
}

function likedSongs() {
  return sortedSongs(state.songs.filter((song) => song.liked), 'recent');
}

function durationTotal(songs) {
  return songs.reduce((total, song) => total + (Number(song.duration) || 0), 0);
}

function closeIconButton(action = 'close-modal', label = 'Close') {
  return `<button class="icon-button modal-close" type="button" data-action="${action}" aria-label="${label}" title="${label}">${icon('close')}</button>`;
}

function button(label, action, style = 'secondary', extra = '', iconName = '') {
  return `<button type="button" class="button button-${style} ${extra}" data-action="${action}">${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

function emptyState(title, copy, actionLabel = '', action = '', iconName = 'music') {
  const actionData = action === 'add-songs' && state.playlistId ? ` data-id="${escapeHtml(state.playlistId)}"` : '';
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${actionLabel ? `<button type="button" class="button button-primary" data-action="${escapeHtml(action)}"${actionData}>${icon(action === 'open-file-picker' ? 'upload' : 'plus')}<span>${escapeHtml(actionLabel)}</span></button>` : ''}</div>`;
}

function songSortLabel(value) {
  return ({ recent: 'Recently added', name: 'Name', artist: 'Artist', played: 'Most played', lastPlayed: 'Recently played' })[value] || 'Recently added';
}

function rowDownloadButton(song) {
  if (song.downloaded && song.hasFile) {
    return `<button type="button" class="icon-button download-ready" data-action="remove-download" data-id="${escapeHtml(song.id)}" aria-label="Remove ${escapeHtml(song.title)} from downloads" title="Downloaded — remove stored copy">${icon('check')}</button>`;
  }
  if (!song.hasFile) {
    return `<button type="button" class="icon-button" data-action="link-song" data-id="${escapeHtml(song.id)}" aria-label="Find file for ${escapeHtml(song.title)}" title="Original file is not stored — choose it again">${icon('upload')}</button>`;
  }
  return `<button type="button" class="icon-button" data-action="download-song" data-id="${escapeHtml(song.id)}" aria-label="Save ${escapeHtml(song.title)} for offline listening" title="Save for offline listening">${icon('download')}</button>`;
}

function songRow(song, options = {}) {
  const current = song.id === state.currentId;
  const isLiked = Boolean(song.liked);
  const playlistId = options.playlistId || '';
  const removeAction = options.removeFromPlaylist ? `<button type="button" class="icon-button" data-action="remove-from-playlist" data-id="${escapeHtml(song.id)}" data-playlist-id="${escapeHtml(playlistId)}" aria-label="Remove from playlist" title="Remove from playlist">${icon('remove')}</button>` : `<button type="button" class="icon-button" data-action="add-to-playlist" data-id="${escapeHtml(song.id)}" aria-label="Add ${escapeHtml(song.title)} to a playlist" title="Add to playlist">${icon('plus')}</button>`;
  return `<div class="song-row ${current ? 'is-current' : ''}" data-song-id="${escapeHtml(song.id)}">
    <div class="song-cell-title">
      <button class="row-cover-button" type="button" data-action="play-song" data-id="${escapeHtml(song.id)}" aria-label="Play ${escapeHtml(song.title)}">${coverMarkup(song)}<span class="row-play-overlay">${icon(current && state.playing ? 'pause' : 'play')}</span></button>
      <div class="song-title-copy"><div class="song-name">${escapeHtml(song.title)}</div><div class="song-artist">${escapeHtml(song.artist || 'Unknown artist')}${song.hasFile ? ` <span class="pill pill-green">${song.downloaded ? 'DOWNLOADED ✓' : 'ON DEVICE'}</span>` : ''}</div></div>
    </div>
    <div class="song-cell song-cell-artist">${escapeHtml(song.artist || 'Unknown artist')}</div>
    <div class="song-cell album-cell">${escapeHtml(song.album || 'Unknown album')}</div>
    <div class="song-duration">${formatDuration(song.duration)}</div>
    <div class="song-actions">
      <button type="button" class="icon-button ${isLiked ? 'is-liked' : ''}" data-action="like-song" data-id="${escapeHtml(song.id)}" aria-label="${isLiked ? 'Unlike' : 'Like'} ${escapeHtml(song.title)}" title="${isLiked ? 'Unlike' : 'Like'}">${icon(isLiked ? 'heartFill' : 'heart')}</button>
      ${rowDownloadButton(song)}${removeAction}
      <button type="button" class="icon-button more-action" data-action="song-menu" data-id="${escapeHtml(song.id)}" aria-label="More options for ${escapeHtml(song.title)}" title="More options">${icon('more')}</button>
    </div>
  </div>`;
}

function rowHeight() {
  return globalThis.matchMedia?.('(max-width: 680px)').matches ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
}

function makeSongList(list, options = {}) {
  const rows = options.sort === 'playlist' ? [...list] : sortedSongs(list, options.sort || 'recent');
  if (!rows.length) return `<div class="song-list-shell"><div class="song-list-empty"><div><strong>${escapeHtml(options.emptyTitle || 'No songs here yet')}</strong>${escapeHtml(options.emptyCopy || 'Add your music to get started.')}</div></div></div>`;
  const id = `virtual-${++virtualListSerial}`;
  virtualLists.set(id, { songs: rows, options, rowHeight: rowHeight() });
  return `<div class="song-list-shell" data-virtual-id="${id}">
    <div class="song-list-head"><div class="list-header-label">${icon('music')}<span>Title</span></div><div class="artist-head">Artist</div><div class="album-head">Album</div><div style="text-align:right">Time</div><div></div></div>
    <div class="song-list-scroll" data-scroll-list="${id}" tabindex="0" aria-label="Song list"><div class="virtual-content" data-virtual-content="${id}"></div></div>
  </div>`;
}

function paintVirtualList(element, scrollTop = element.scrollTop) {
  const id = element.dataset.scrollList;
  const entry = virtualLists.get(id);
  if (!entry) return;
  const height = element.clientHeight || Math.min(window.innerHeight * .54, 590);
  const row = entry.rowHeight = rowHeight();
  const overscan = 4;
  const start = Math.max(0, Math.floor(scrollTop / row) - overscan);
  const visible = Math.ceil(height / row) + overscan * 2;
  const end = Math.min(entry.songs.length, start + visible);
  const before = start * row;
  const after = Math.max(0, (entry.songs.length - end) * row);
  const content = element.querySelector(`[data-virtual-content="${id}"]`);
  if (!content) return;
  content.innerHTML = `${before ? `<div class="virtual-spacer" style="height:${before}px"></div>` : ''}${entry.songs.slice(start, end).map((song) => songRow(song, entry.options)).join('')}<div class="virtual-spacer" style="height:${after}px"></div>`;
  loadCoverImages(content);
}

function paintAllVirtualLists() {
  for (const list of mainView.querySelectorAll('[data-scroll-list]')) paintVirtualList(list);
}

function renderSongSection(title, songs, action = '') {
  return `<section class="section"><div class="section-heading"><div><h2>${escapeHtml(title)}</h2><p>${formatCount(songs.length, 'track')}</p></div>${action ? `<button class="text-link" data-action="${action}">See all ${icon('arrow')}</button>` : ''}</div>${makeSongList(songs.slice(0, 10), { sort: 'recent' })}</section>`;
}

function renderHome() {
  const recent = state.recentHistory.map(songById).filter(Boolean).slice(0, 8);
  const welcomeHour = new Date().getHours();
  const greeting = welcomeHour < 12 ? 'Good morning' : welcomeHour < 18 ? 'Good afternoon' : 'Good evening';
  const recentlyPlayed = recent.length ? recent : sortedSongs(state.songs, 'recent').slice(0, 4);
  const groups = albumGroups().slice(0, 5);
  const playlists = [...state.playlists].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const allSongs = sortedSongs(state.songs, 'recent');
  const mostPlayed = sortedSongs(state.songs, 'played').filter((song) => song.playCount > 0).slice(0, 5);
  const highestPlayCount = Math.max(1, ...mostPlayed.map((song) => song.playCount || 0));
  const mostPlayedHtml = mostPlayed.length ? `<section class="section"><div class="section-heading"><div><h2>Your most played</h2><p>Tracks you keep coming back to</p></div><button class="text-link" data-action="sort-most-played">Full chart ${icon('arrow')}</button></div><div class="most-played">${mostPlayed.map((song, index) => `<article class="played-card"><span class="played-rank">0${index + 1}</span><div class="played-info"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)} · ${formatCount(song.playCount || 0, 'play')}</span><div class="played-bar"><span style="width:${Math.max(8, ((song.playCount || 0) / highestPlayCount) * 100)}%"></span></div></div></article>`).join('')}</div></section>` : '';

  return `<div class="page-heading"><div><p class="eyebrow">YOUR PRIVATE MUSIC SPACE</p><h1>${greeting}.</h1><p class="subheading">Every track, playlist, and play count stays right here on your device.</p></div><span class="pill pill-green">${icon('sparkle')} PRIVATE BY DESIGN</span></div>
    <section class="home-hero"><div class="hero-copy"><p class="eyebrow">WELCOME TO LISTEN</p><h2 class="hero-title">Your music.<br />Your rules.</h2><p>Bring in the songs you love, make a mix, and keep listening even when the signal disappears.</p><div class="hero-actions">${button('Add your music', 'open-file-picker', 'primary', '', 'upload')}${state.songs.length ? button('Play something', 'play-all', 'secondary', '', 'play') : button('Import a folder', 'open-folder-picker', 'secondary', '', 'folder')}</div></div><div class="hero-side"><strong>${state.songs.length}</strong><span>tracks in your library</span></div></section>
    <section class="section"><div class="section-heading"><div><h2>${recent.length ? 'Recently played' : state.songs.length ? 'Recently added' : 'Your listening space'}</h2><p>${recent.length ? 'Pick up where you left off' : state.songs.length ? 'Your latest additions' : 'No samples or preloaded tracks — only the music you add.'}</p></div>${recent.length ? '<button class="text-link" data-action="open-history">History <span>↗</span></button>' : ''}</div>${recentlyPlayed.length ? `<div class="recent-grid">${recentlyPlayed.map((song) => `<article class="recent-card" data-action="play-song" data-id="${escapeHtml(song.id)}">${coverMarkup(song)}<div class="recent-copy"><p class="card-title">${escapeHtml(song.title)}</p><p class="card-subtitle">${escapeHtml(song.artist)}</p></div><button class="icon-button recent-download" type="button" data-action="${song.downloaded && song.hasFile ? 'remove-download' : 'download-song'}" data-id="${escapeHtml(song.id)}" aria-label="${song.downloaded && song.hasFile ? 'Remove offline copy of' : 'Save'} ${escapeHtml(song.title)}" title="${song.downloaded && song.hasFile ? 'Remove stored copy' : 'Save offline'}">${icon(song.downloaded && song.hasFile ? 'check' : 'download')}</button><button class="card-play" type="button" data-action="play-song" data-id="${escapeHtml(song.id)}" aria-label="Play ${escapeHtml(song.title)}">${icon('play')}</button></article>`).join('')}</div>` : emptyState('Your library is empty', 'Import your own MP3s or audio files to see your albums, playlists, and listening history here.', 'Add music', 'open-file-picker', 'upload')}</section>
    <section class="section"><div class="section-heading"><div><h2>Your playlists</h2><p>Made for the mood you're in</p></div><button class="text-link" data-action="create-playlist">Create playlist ${icon('plus')}</button></div>${playlists.length ? `<div class="playlist-grid">${playlists.map(renderPlaylistCard).join('')}</div>` : emptyState('Your first playlist is one click away', 'Collect the tracks you want to hear together. Your playlists are private and stored on this device.', 'Create playlist', 'create-playlist', 'queue')}</section>
    <section class="section"><div class="section-heading"><div><h2>Albums & collections</h2><p>Browse by album or artist</p></div><button class="text-link" data-action="open-library-albums">All albums ${icon('arrow')}</button></div>${groups.length ? `<div class="card-grid album-grid">${groups.map(renderAlbumCard).join('')}</div>` : '<div class="info-banner">Albums appear here as soon as you import music with album tags.</div>'}</section>
    ${mostPlayedHtml}
    <section class="section"><div class="section-heading"><div><h2>All songs</h2><p>${formatCount(allSongs.length, 'track')} · stored locally</p></div><button class="text-link" data-action="open-library">See your library ${icon('arrow')}</button></div>${makeSongList(allSongs.slice(0, 8), { sort: 'recent' })}</section>`;
}

function renderAlbumCard(group) {
  const first = group.songs[0];
  return `<article class="album-card" data-action="open-album" data-album="${escapeHtml(group.album)}" data-artist="${escapeHtml(group.artist)}"><div class="card-cover-wrap">${coverMarkup(first)}<button class="icon-button card-download" type="button" data-action="download-collection" data-kind="album" data-album="${escapeHtml(group.album)}" data-artist="${escapeHtml(group.artist)}" aria-label="Download all from ${escapeHtml(group.album)}" title="Download album">${icon('download')}</button><button class="card-play" type="button" data-action="play-collection" data-kind="album" data-album="${escapeHtml(group.album)}" data-artist="${escapeHtml(group.artist)}" aria-label="Play ${escapeHtml(group.album)}">${icon('play')}</button></div><p class="card-title">${escapeHtml(group.album)}</p><p class="card-subtitle">${escapeHtml(group.artist)}</p><div class="card-meta"><span>${formatCount(group.songs.length, 'track')}</span><span>${formatDuration(durationTotal(group.songs))}</span></div></article>`;
}

function renderPlaylistCard(playlist) {
  const songs = playlistSongs(playlist);
  const first = songs[0];
  const artwork = first?.coverArt ? coverMarkup(first) : blankCover(playlist.color, playlist.name);
  return `<article class="playlist-card" data-action="view-playlist" data-id="${escapeHtml(playlist.id)}"><div class="card-cover-wrap">${artwork}<button class="icon-button card-download" type="button" data-action="download-collection" data-kind="playlist" data-id="${escapeHtml(playlist.id)}" aria-label="Download ${escapeHtml(playlist.name)}" title="Download playlist">${icon('download')}</button><button class="card-play" type="button" data-action="play-collection" data-kind="playlist" data-id="${escapeHtml(playlist.id)}" aria-label="Play ${escapeHtml(playlist.name)}">${icon('play')}</button></div><p class="card-title">${escapeHtml(playlist.name)}</p><p class="card-subtitle">${formatCount(songs.length, 'track')} · ${formatDuration(durationTotal(songs))}</p></article>`;
}

function filterControls({ search = false } = {}) {
  const genres = [...new Set(state.songs.map((song) => song.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const folders = [...new Set(state.songs.map((song) => song.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<div class="filter-row"><select class="filter-select" data-filter="genre" aria-label="Filter by genre"><option value="all">All genres</option>${genres.map((genre) => `<option value="${escapeHtml(genre)}" ${state.genreFilter === genre ? 'selected' : ''}>${escapeHtml(genre)}</option>`).join('')}</select><select class="filter-select" data-filter="folder" aria-label="Filter by folder"><option value="all">All folders</option>${folders.map((folder) => `<option value="${escapeHtml(folder)}" ${state.folderFilter === folder ? 'selected' : ''}>${escapeHtml(folder)}</option>`).join('')}</select></div>`;
}

function renderLibrary() {
  const tabs = ['songs', 'albums', 'playlists'];
  let body = '';
  if (state.libraryTab === 'albums') {
    const groups = albumGroups();
    body = groups.length ? `<div class="card-grid album-grid">${groups.map(renderAlbumCard).join('')}</div>` : emptyState('No albums yet', 'Import tracks with album tags and they will be grouped here.', 'Add music', 'open-file-picker', 'album');
  } else if (state.libraryTab === 'playlists') {
    body = state.playlists.length ? `<div class="playlist-grid">${state.playlists.map(renderPlaylistCard).join('')}</div>` : emptyState('No playlists yet', 'Create a playlist and start collecting your favorite tracks.', 'Create playlist', 'create-playlist', 'queue');
  } else {
    const list = filteredSongs({ genre: state.genreFilter, folder: state.folderFilter });
    body = list.length ? makeSongList(list, { sort: state.sort }) : emptyState(state.songs.length ? 'No songs match those filters' : 'Your library is ready for music', state.songs.length ? 'Try a different genre or folder, or clear the filters.' : 'Add MP3s, choose a whole folder, or drop files anywhere in Listen.', state.songs.length ? 'Clear filters' : 'Add music', state.songs.length ? 'clear-filters' : 'open-file-picker', 'music');
  }
  return `<div class="page-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h1>Your library</h1><p class="subheading">${formatCount(state.songs.length, 'song')} · searchable, sorted, and kept on this device.</p></div><div class="library-toolbar-right">${button('Add files', 'open-file-picker', 'primary', 'button-sm', 'upload')}${button('Import folder', 'open-folder-picker', 'secondary', 'button-sm', 'folder')}</div></div>
    ${state.importProgress ? renderImportProgress() : ''}
    <div class="library-toolbar"><div class="library-toolbar-left"><div class="segmented" aria-label="Library type">${tabs.map((tab) => `<button type="button" class="${state.libraryTab === tab ? 'is-active' : ''}" data-action="library-tab" data-tab="${tab}">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}</div>${state.libraryTab === 'songs' ? filterControls() : ''}</div><div class="library-toolbar-right">${state.libraryTab === 'songs' ? `<span class="result-summary">${formatCount(filteredSongs({ genre: state.genreFilter, folder: state.folderFilter }).length, 'track')}</span><select class="filter-select sort-control" data-sort aria-label="Sort songs"><option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Name</option><option value="artist" ${state.sort === 'artist' ? 'selected' : ''}>Artist</option><option value="played" ${state.sort === 'played' ? 'selected' : ''}>Most played</option><option value="lastPlayed" ${state.sort === 'lastPlayed' ? 'selected' : ''}>Recently played</option></select>` : button('New playlist', 'create-playlist', 'secondary', 'button-sm', 'plus')}</div></div>
    ${body}
    <div class="section"><div class="info-banner">${icon('info')}<span>Listen stores audio and artwork in this browser's IndexedDB. Browser storage depends on your device; Listen requests persistent storage and warns when the origin quota reaches 95%.</span></div></div>`;
}

function renderImportProgress() {
  const progress = state.importProgress;
  if (!progress) return '';
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return `<div class="import-progress"><div class="import-progress-top"><strong>${progress.done >= progress.total ? 'Import complete' : `Importing ${escapeHtml(progress.active || 'your music')}`}</strong><span>${progress.done} / ${progress.total}${progress.errors ? ` · ${progress.errors} skipped` : ''}</span></div><div class="progress-track"><span style="width:${percent}%"></span></div></div>`;
}

function renderSearch() {
  const query = state.searchQuery.trim();
  const results = filteredSongs({ query, genre: state.genreFilter, folder: state.folderFilter });
  const hasQuery = Boolean(query || state.genreFilter !== 'all' || state.folderFilter !== 'all');
  return `<div class="page-heading"><div><p class="eyebrow">FIND A TRACK</p><h1>Search</h1><p class="subheading">Search titles, artists, and albums. Filter results by folder to find a specific import.</p></div></div>
    <div class="library-toolbar"><div class="library-toolbar-left">${filterControls({ search: true })}</div><span class="result-summary">${hasQuery ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : `${state.songs.length} songs in your library`}</span></div>
    ${hasQuery ? (results.length ? makeSongList(results, { sort: state.sort }) : emptyState('No results', `Nothing matched “${query || (state.genreFilter !== 'all' ? state.genreFilter : state.folderFilter)}”. Try another song, artist, album, genre, or folder.`, 'Clear search', 'clear-search', 'search')) : `<div class="info-banner">${icon('search')}<span>Type in the search bar above to search your full library instantly. Start with a title, artist, or album.</span></div><section class="section"><div class="section-heading"><div><h2>Recently added</h2><p>Jump back into a track</p></div><button class="text-link" data-action="open-library">Full library ${icon('arrow')}</button></div>${makeSongList(sortedSongs(state.songs, 'recent').slice(0, 8), { sort: 'recent' })}</section>`}`;
}

function renderAlbumDetail() {
  const group = findAlbum(state.albumArtist, state.albumName);
  if (!group) return `<div class="page-heading"><div><p class="eyebrow">ALBUM</p><h1>Album not found</h1></div><button class="button button-secondary" data-action="open-library-albums">Back to albums</button></div>`;
  const first = group.songs[0];
  return `<section class="album-detail-hero">${coverMarkup(first)}<div class="album-detail-copy"><p class="eyebrow">ALBUM</p><h1>${escapeHtml(group.album)}</h1><p>${escapeHtml(group.artist)} · ${formatCount(group.songs.length, 'song')} · ${formatDuration(durationTotal(group.songs))}</p><div class="hero-actions">${button('Play album', 'play-collection', 'primary', '', 'play').replace('data-action="play-collection"', `data-action="play-collection" data-kind="album" data-album="${escapeHtml(group.album)}" data-artist="${escapeHtml(group.artist)}"`)}${button('Download all', 'download-collection', 'secondary', '', 'download').replace('data-action="download-collection"', `data-action="download-collection" data-kind="album" data-album="${escapeHtml(group.album)}" data-artist="${escapeHtml(group.artist)}"`)}</div></div></section>
    <section class="section"><div class="section-heading"><div><h2>Tracks</h2><p>${formatCount(group.songs.length, 'track')}</p></div></div>${makeSongList(group.songs, { sort: 'recent' })}</section>`;
}

function renderPlaylistDetail() {
  const playlist = playlistById(state.playlistId);
  if (!playlist) return `<div class="page-heading"><div><p class="eyebrow">PLAYLIST</p><h1>Playlist not found</h1></div><button class="button button-secondary" data-action="open-library">Back to library</button></div>`;
  const songs = playlistSongs(playlist);
  const first = songs[0];
  const artwork = first?.coverArt ? coverMarkup(first) : blankCover(playlist.color, playlist.name);
  return `<section class="album-detail-hero">${artwork}<div class="album-detail-copy"><p class="eyebrow">PLAYLIST</p><h1>${escapeHtml(playlist.name)}</h1><p>Created ${new Date(playlist.createdAt || Date.now()).toLocaleDateString()} · ${formatCount(songs.length, 'song')} · ${formatDuration(durationTotal(songs))}</p><div class="hero-actions"><button class="button button-primary" data-action="play-collection" data-kind="playlist" data-id="${escapeHtml(playlist.id)}">${icon('play')}<span>Play playlist</span></button><button class="button button-secondary" data-action="download-collection" data-kind="playlist" data-id="${escapeHtml(playlist.id)}">${icon('download')}<span>Download all</span></button><button class="button button-secondary button-sm" data-action="add-songs" data-id="${escapeHtml(playlist.id)}">${icon('plus')}<span>Add songs</span></button><button class="icon-button" data-action="edit-playlist" data-id="${escapeHtml(playlist.id)}" aria-label="Rename playlist" title="Rename">${icon('edit')}</button><button class="icon-button" data-action="delete-playlist" data-id="${escapeHtml(playlist.id)}" aria-label="Delete playlist" title="Delete playlist">${icon('trash')}</button></div></div></section>
    <section class="section"><div class="section-heading"><div><h2>Playlist tracks</h2><p>${formatCount(songs.length, 'track')} · ${formatDuration(durationTotal(songs))}</p></div></div>${songs.length ? makeSongList(songs, { sort: 'playlist', playlistId: playlist.id, removeFromPlaylist: true }) : emptyState('This playlist is empty', 'Add songs from your library, or search for a track and use its plus button.', 'Add songs', 'add-songs', 'queue')}</section>`;
}

function renderQueueCard() {
  const q = state.downloadQueue;
  if (!q.items.length && !q.processing) return `<div class="download-queue-card"><h2>Download queue</h2><p>Download one song, a full playlist, or every track in your library. Bulk jobs run in the background while you browse.</p><div class="queue-status"><strong>Queue is clear</strong><div class="queue-actions">${state.songs.length ? button('Download all songs', 'download-all', 'secondary', 'button-sm', 'download') : button('Add music', 'open-file-picker', 'primary', 'button-sm', 'upload')}</div></div></div>`;
  const total = Math.max(q.items.length, 1);
  const done = Math.min(q.complete, total);
  const percent = Math.round((done / total) * 100);
  const active = songById(q.activeId);
  const label = q.cancelled ? 'Cancelled' : q.paused ? 'Paused' : q.processing ? `Saving ${active?.title || 'songs'}…` : q.failed ? 'Finished with a few files missing' : 'Downloads complete';
  return `<div class="download-queue-card"><div class="storage-top"><div><h2>Download queue</h2><p>${escapeHtml(label)} · ${done} of ${q.items.length || 0} tracks${q.failed ? ` · ${q.failed} unavailable` : ''}</p></div><span class="storage-stat">${percent}%</span></div><div class="progress-track"><span style="width:${percent}%"></span></div><div class="queue-status"><strong>${active ? escapeHtml(active.title) : q.processing ? 'Preparing…' : 'Queue finished'}</strong><div class="queue-actions">${q.processing ? (q.paused ? button('Resume', 'resume-downloads', 'secondary', 'button-sm', 'play') : button('Pause', 'pause-downloads', 'secondary', 'button-sm', 'pause')) : ''}${q.processing ? button('Cancel', 'cancel-downloads', 'danger', 'button-sm', 'close') : button('Download all', 'download-all', 'secondary', 'button-sm', 'download')}</div></div></div>`;
}

function renderDownloads() {
  const downloaded = sortedSongs(state.songs.filter((song) => song.downloaded && song.hasFile), 'recent');
  const usage = state.mediaUsage.audioBytes + state.mediaUsage.coverBytes;
  const estimate = state.storageEstimate;
  const quota = estimate?.quota || 0;
  const originUsed = estimate?.usage || usage;
  const percent = quota ? Math.min(100, (originUsed / quota) * 100) : 0;
  const warning = quota && originUsed / quota >= .95;
  const storageCopy = quota ? `${formatBytes(originUsed)} of ${formatBytes(quota)} origin storage used` : 'Browser quota estimate is not available in this browser';
  const persistence = state.persistentStorage === true ? 'Persistent storage granted' : state.persistentStorage === false ? 'Best-effort browser storage' : 'Checking storage protection…';
  return `<div class="page-heading"><div><p class="eyebrow">AVAILABLE WITHOUT WI-FI</p><h1>Downloads</h1><p class="subheading">Keep your listening queue ready for flights, commutes, and quiet-signal moments.</p></div><span class="pill pill-green">${icon('download')} ${downloaded.length} SAVED</span></div>
    ${warning ? `<div class="info-banner" style="border-color:rgba(255,105,105,.28);background:rgba(255,105,105,.08);color:#ffc5c5;margin-bottom:14px">${icon('info')}<span>Browser storage is at or above 95% of its estimated quota. Remove stored downloads or export a backup before adding more music.</span></div>` : ''}
    <div class="download-overview"><div class="storage-card"><div class="storage-top"><div><h2>Device storage</h2><p>${escapeHtml(storageCopy)} · ${escapeHtml(persistence)}</p></div><span class="storage-stat">${formatBytes(usage)}</span></div><div class="storage-track"><span style="width:${percent}%"></span></div><div class="storage-foot"><span>Listen audio + artwork: ${formatBytes(usage)}</span><span>${quota ? `${percent.toFixed(1)}% of origin quota` : 'Quota unavailable'}</span></div><div class="queue-status"><span class="result-summary">Uploads are immediately saved to this device for offline playback.</span>${button('Export library ZIP', 'export-backup', 'secondary', 'button-sm', 'export')}</div></div>${renderQueueCard()}</div>
    <div class="settings-grid"><div class="setting-card"><div class="setting-copy"><h2>Auto-download new imports</h2><p>Newly imported tracks are already stored locally. This also pins each new import in your Downloads collection.</p></div><button class="setting-switch setting-control" role="switch" aria-checked="${state.prefs.autoDownload}" data-action="toggle-auto-download" aria-label="Auto-download new imports"></button></div><div class="setting-card"><div class="setting-copy"><h2>Offline mode</h2><p>Listen uses only on-device music. The app shell and imported library are available without internet.</p></div><button class="setting-switch setting-control" role="switch" aria-checked="${state.prefs.offlineMode}" data-action="toggle-offline" aria-label="Toggle offline mode"></button></div></div>
    <section class="section"><div class="section-heading"><div><h2>Saved for offline</h2><p>${formatCount(downloaded.length, 'track')} pinned in your downloads</p></div><div class="filter-row">${state.songs.length ? button('Download all songs', 'download-all', 'secondary', 'button-sm', 'download') : button('Add music', 'open-file-picker', 'primary', 'button-sm', 'upload')}</div></div>${downloaded.length ? makeSongList(downloaded, { sort: 'recent' }) : state.songs.length ? emptyState('Nothing pinned yet', 'Tap the download icon on a song, playlist, or album. Imported music is already saved on this device.', 'Save all songs', 'download-all', 'download') : emptyState('No music to download yet', 'Add your own audio files. Listen does not include sample tracks.', 'Add music', 'open-file-picker', 'upload')}</section>
    <section class="section"><div class="info-banner">${icon('info')}<span>There is no universal “unlimited” browser quota: available space depends on the Android device and browser. Listen stores large files in IndexedDB, requests persistent storage, and only raises a quota warning at 95%.</span></div></section>`;
}

function renderMain({ preserveScroll = true } = {}) {
  const previousScroll = preserveScroll ? mainView.querySelector('.song-list-scroll')?.scrollTop || 0 : 0;
  virtualLists.clear();
  virtualListSerial = 0;
  if (searchInput.value !== state.searchQuery) searchInput.value = state.searchQuery;
  document.getElementById('clear-search').hidden = !state.searchQuery;
  const view = state.view === 'playlist' ? renderPlaylistDetail()
    : state.view === 'liked' ? renderLikedView()
      : state.view === 'album' ? renderAlbumDetail()
        : state.view === 'history' ? renderHistory()
          : state.view === 'search' ? renderSearch()
            : state.view === 'library' ? renderLibrary()
              : state.view === 'downloads' ? renderDownloads()
                : renderHome();
  mainView.innerHTML = view;
  paintNavigation();
  paintSidebarPlaylists();
  for (const list of mainView.querySelectorAll('[data-scroll-list]')) {
    paintVirtualList(list, 0);
    if (previousScroll) {
      const restored = Math.min(previousScroll, Math.max(0, list.scrollHeight - list.clientHeight));
      list.scrollTop = restored;
      paintVirtualList(list, restored);
    }
  }
  loadCoverImages(mainView);
  renderPlayerBar();
  renderOverlay();
}

function paintNavigation() {
  const active = ['playlist', 'album', 'liked', 'history'].includes(state.view) ? 'library' : state.view;
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('is-active', button.dataset.view === active);
  document.getElementById('download-count').textContent = String(state.songs.filter((song) => song.downloaded && song.hasFile).length);
  const offline = document.getElementById('offline-toggle');
  offline.setAttribute('aria-pressed', String(Boolean(state.prefs.offlineMode)));
  const connection = document.getElementById('connection-status');
  connection.classList.toggle('is-offline', !state.online);
  connection.querySelector('span:last-child').textContent = state.online ? (state.prefs.offlineMode ? 'Offline mode' : 'On this device') : 'No connection';
}

function paintSidebarPlaylists() {
  const root = document.getElementById('sidebar-playlists');
  const liked = `<button class="playlist-link ${state.view === 'liked' ? 'is-active' : ''}" data-action="open-liked"><span class="playlist-dot" style="--dot-color:#9c6a9f">${icon('heart')}</span><span class="playlist-text">Liked Songs</span></button>`;
  const playlists = state.playlists.map((playlist) => `<button class="playlist-link ${state.view === 'playlist' && state.playlistId === playlist.id ? 'is-active' : ''}" data-action="view-playlist" data-id="${escapeHtml(playlist.id)}"><span class="playlist-dot" style="--dot-color:${COLOR_OPTIONS.includes(playlist.color) ? playlist.color : COLOR_OPTIONS[0]}">${escapeHtml((playlist.name || 'P').slice(0, 1).toUpperCase())}</span><span class="playlist-text">${escapeHtml(playlist.name)}</span></button>`).join('');
  root.innerHTML = `${liked}${playlists}`;
}

function loadCoverImages(root) {
  if (!root) return;
  for (const img of root.querySelectorAll('img[data-cover-id]')) {
    const id = img.dataset.coverId;
    if (!id || img.dataset.loading === 'true' || img.dataset.loaded === 'true') continue;
    img.dataset.loading = 'true';
    getCoverUrl(id).then((url) => {
      img.dataset.loading = 'false';
      if (url && img.isConnected) {
        img.src = url;
        img.hidden = false;
        img.dataset.loaded = 'true';
      }
    }).catch(() => { img.dataset.loading = 'false'; });
  }
}

async function getCoverUrl(id) {
  if (coverObjectUrls.has(id)) {
    const value = coverObjectUrls.get(id);
    coverObjectUrls.delete(id);
    coverObjectUrls.set(id, value);
    return value;
  }
  if (coverRequests.has(id)) return coverRequests.get(id);
  const request = getCoverBlob(id).then((blob) => {
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    coverObjectUrls.set(id, url);
    while (coverObjectUrls.size > 120) {
      const [oldId, oldUrl] = coverObjectUrls.entries().next().value;
      URL.revokeObjectURL(oldUrl);
      coverObjectUrls.delete(oldId);
    }
    return url;
  }).finally(() => coverRequests.delete(id));
  coverRequests.set(id, request);
  return request;
}

function songForContext(id) {
  if (state.view === 'playlist') return playlistSongs(playlistById(state.playlistId));
  if (state.view === 'liked') return likedSongs();
  if (state.view === 'history') return state.recentHistory.map(songById).filter(Boolean);
  if (state.view === 'album') return findAlbum(state.albumArtist, state.albumName)?.songs || state.songs;
  if (state.view === 'search') return filteredSongs({ query: state.searchQuery, folder: state.folderFilter });
  if (state.view === 'library') return state.libraryTab === 'songs' ? filteredSongs({ genre: state.genreFilter, folder: state.folderFilter }) : sortedSongs(state.songs, 'recent');
  return sortedSongs(state.songs, 'recent');
}

function collectionFor(kind, el) {
  if (kind === 'playlist') return playlistSongs(playlistById(el.dataset.id));
  if (kind === 'album') return findAlbum(el.dataset.artist || '', el.dataset.album || '')?.songs || [];
  if (kind === 'liked') return likedSongs();
  return sortedSongs(state.songs, 'recent');
}

function paintQueueControls() {
  if (!state.playerOpen) return;
  renderOverlay();
}

function renderPlayerBar() {
  const song = songById(state.currentId);
  if (!song) {
    playerBar.innerHTML = `<div class="player-track"><button class="player-track-cover" type="button" data-action="player-open" aria-label="Open player">${coverMarkup(null)}</button><div class="player-track-copy"><strong>Listen is ready</strong><span>Choose a song to begin</span></div><div class="player-mini-actions"></div></div><div class="player-controls"><div class="player-buttons"><button class="icon-button desktop-control" disabled aria-label="Previous">${icon('previous')}</button><button class="icon-button play-button-main" data-action="open-file-picker" aria-label="Add music">${icon('upload')}</button><button class="icon-button desktop-control" disabled aria-label="Next">${icon('next')}</button></div><div class="progress-line"><span>0:00</span><input class="range-input" type="range" min="0" max="100" value="0" disabled aria-label="Track position" /><span>0:00</span></div></div><div class="player-extra"><span class="player-placeholder">Your library, all in one place</span></div>`;
    return;
  }
  const duration = audio.duration || song.duration || 0;
  const time = audio.currentTime || 0;
  const progress = duration ? (time / duration) * 100 : 0;
  playerBar.innerHTML = `<div class="player-track"><button class="player-track-cover" type="button" data-action="player-open" aria-label="Open full player">${coverMarkup(song)}</button><div class="player-track-copy"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist || 'Unknown artist')}</span></div><div class="player-mini-actions"><button class="icon-button ${song.liked ? 'is-liked' : ''}" data-action="like-song" data-id="${escapeHtml(song.id)}" aria-label="${song.liked ? 'Unlike' : 'Like'} song">${icon(song.liked ? 'heartFill' : 'heart')}</button></div></div>
    <div class="player-controls"><div class="player-buttons"><button class="icon-button desktop-control ${state.shuffle ? 'is-active' : ''}" data-action="toggle-shuffle" aria-label="Shuffle" title="Shuffle">${icon('shuffle')}</button><button class="icon-button desktop-control" data-action="previous" aria-label="Previous track">${icon('previous')}</button><button class="icon-button play-button-main" data-action="toggle-play" aria-label="${state.playing ? 'Pause' : 'Play'}">${icon(state.playing ? 'pause' : 'play')}</button><button class="icon-button" data-action="next" aria-label="Next track">${icon('next')}</button><button class="icon-button desktop-control ${state.repeat !== 'off' ? 'is-active' : ''}" data-action="toggle-repeat" aria-label="Repeat ${state.repeat}" title="Repeat: ${state.repeat}">${icon(state.repeat === 'one' ? 'repeatOne' : 'repeat')}</button></div><div class="progress-line"><span class="current-time">${formatTime(time)}</span><input class="range-input seek-range" type="range" min="0" max="1000" value="${Math.round(progress * 10)}" style="--range-progress:${progress}%" aria-label="Seek" data-range="seek" /><span class="total-time">${formatTime(duration)}</span></div></div>
    <div class="player-extra"><button class="icon-button" data-action="toggle-queue" aria-label="Play queue" title="Play queue">${icon('queue')}</button><label class="volume-control" aria-label="Volume">${icon(state.volume <= 0 ? 'mute' : 'volume')}<input class="range-input volume-range" type="range" min="0" max="1" step="0.01" value="${state.volume}" style="--range-progress:${state.volume * 100}%" data-range="volume" aria-label="Volume" /></label><button class="icon-button player-open-button" data-action="player-open" aria-label="Open full player">${icon('arrow')}</button></div>`;
  loadCoverImages(playerBar);
}

function getLyricsLines(song) {
  if (!song?.lyrics) return [];
  const timed = parseLyrics(song.lyrics);
  if (timed.length) return timed;
  return song.lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text) => ({ time: null, text }));
}

function lyricsPanel(song) {
  const lines = getLyricsLines(song);
  if (!lines.length) return `<div class="full-secondary-panel"><div class="queue-panel-heading">Lyrics</div><p class="lyrics-empty">No lyrics found. Add a matching .lrc file beside your song when importing it.</p></div>`;
  return `<div class="full-secondary-panel"><div class="queue-panel-heading">Lyrics <span class="pill">${lines.some((line) => line.time !== null) ? 'SYNCED' : 'TEXT'}</span></div><div class="lyrics-list">${lines.map((line, index) => `<p class="lyric-line" data-lyric-index="${index}" ${line.time !== null ? `data-lyric-time="${line.time}"` : ''}>${escapeHtml(line.text)}</p>`).join('')}</div></div>`;
}

function queuePanel() {
  const queue = state.queue;
  const current = state.queueIndex >= 0 ? state.queue[state.queueIndex] : null;
  const upcoming = queue.slice(Math.max(0, state.queueIndex + 1));
  const visible = upcoming.slice(0, 40);
  const rows = visible.map((id, index) => {
    const song = songById(id);
    if (!song) return '';
    const absoluteIndex = state.queue.indexOf(id);
    return `<div class="queue-row" draggable="true" data-queue-id="${escapeHtml(id)}" data-action="play-queued" data-id="${escapeHtml(id)}"><span class="queue-drag-handle" aria-hidden="true">⠿</span>${coverMarkup(song)}<div class="queue-row-copy"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><button class="icon-button" data-action="queue-up" data-id="${escapeHtml(id)}" aria-label="Move ${escapeHtml(song.title)} up" title="Move up" ${absoluteIndex <= state.queueIndex + 1 ? 'disabled' : ''}>${icon('up')}</button><button class="icon-button" data-action="queue-down" data-id="${escapeHtml(id)}" aria-label="Move ${escapeHtml(song.title)} down" title="Move down" ${index >= visible.length - 1 ? 'disabled' : ''}>${icon('down')}</button><button class="icon-button" data-action="queue-remove" data-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(song.title)} from queue" title="Remove from queue">${icon('close')}</button></div>`;
  }).join('');
  return `<div class="full-secondary-panel"><div class="queue-panel-heading"><span>Up next · ${upcoming.length} tracks</span><span class="pill">DRAG OR USE ARROWS</span></div>${current && songById(current) ? `<p class="lyrics-empty">Now playing: <strong>${escapeHtml(songById(current).title)}</strong></p>` : ''}<div class="queue-list">${rows || '<p class="lyrics-empty">Nothing queued after this track.</p>'}</div>${upcoming.length > 40 ? `<p class="lyrics-empty">Showing the next 40 of ${upcoming.length}. Use shuffle or search to manage a larger queue.</p>` : ''}</div>`;
}

function renderFullPlayer() {
  const song = songById(state.currentId);
  if (!song) return '';
  const duration = audio.duration || song.duration || 0;
  const current = audio.currentTime || 0;
  const percent = duration ? current / duration * 100 : 0;
  const eqOptions = [['off', 'Equalizer: Off'], ['bass', 'Bass Boost'], ['vocal', 'Vocal'], ['chill', 'Chill'], ['workout', 'Workout']];
  const speedOptions = [.5, .75, 1, 1.25, 1.5, 2];
  const sleepOptions = [0, 5, 10, 15, 30, 60];
  const panel = state.playerPanel === 'queue' ? queuePanel() : state.playerPanel === 'lyrics' ? lyricsPanel(song) : '';
  return `<div class="player-overlay" role="dialog" aria-modal="true" aria-label="Now playing"><div class="full-player ${state.playing ? 'playing' : ''}"><div class="full-player-top"><button class="icon-button" data-action="player-close" aria-label="Close full player">${icon('down')}</button><span>LISTENING ON THIS DEVICE</span><button class="icon-button" data-action="toggle-queue" aria-label="Show queue">${icon('queue')}</button></div><div class="full-player-main"><div class="full-art-column">${coverMarkup(song, 'full-cover')}<div class="full-meta"><div class="full-meta-copy"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><button class="icon-button ${song.liked ? 'is-liked' : ''}" data-action="like-song" data-id="${escapeHtml(song.id)}" aria-label="${song.liked ? 'Unlike' : 'Like'} song">${icon(song.liked ? 'heartFill' : 'heart')}</button></div><div class="full-visualizer" aria-hidden="true">${Array.from({ length: 21 }, (_, i) => `<i style="--bar-height:${6 + ((i * 7 + 9) % 17)}px"></i>`).join('')}</div></div><div class="full-controls"><div class="full-track-heading"><p class="eyebrow">NOW PLAYING</p><h1>${escapeHtml(song.title)}</h1><p>${escapeHtml(song.artist)}${song.album ? ` · ${escapeHtml(song.album)}` : ''}</p></div><div class="full-seek"><span class="current-time">${formatTime(current)}</span><input class="range-input seek-range" type="range" min="0" max="1000" value="${Math.round(percent * 10)}" style="--range-progress:${percent}%" data-range="seek" aria-label="Seek through song" /><span class="total-time">${formatTime(duration)}</span></div><div class="full-player-buttons"><button class="icon-button ${state.shuffle ? 'is-active' : ''}" data-action="toggle-shuffle" aria-label="Shuffle">${icon('shuffle')}</button><button class="icon-button" data-action="previous" aria-label="Previous track">${icon('previous')}</button><button class="icon-button play-button-main" data-action="toggle-play" aria-label="${state.playing ? 'Pause' : 'Play'}">${icon(state.playing ? 'pause' : 'play')}</button><button class="icon-button" data-action="next" aria-label="Next track">${icon('next')}</button><button class="icon-button ${state.repeat !== 'off' ? 'is-active' : ''}" data-action="toggle-repeat" aria-label="Repeat ${state.repeat}">${icon(state.repeat === 'one' ? 'repeatOne' : 'repeat')}</button></div><div class="full-options"><select class="player-select" data-player-setting="speed" aria-label="Playback speed">${speedOptions.map((speed) => `<option value="${speed}" ${state.speed === speed ? 'selected' : ''}>${speed}× speed</option>`).join('')}</select><select class="player-select" data-player-setting="equalizer" aria-label="Equalizer preset">${eqOptions.map(([value, label]) => `<option value="${value}" ${state.equalizer === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select class="player-select" data-player-setting="sleep" aria-label="Sleep timer">${sleepOptions.map((minutes) => `<option value="${minutes}" ${state.sleepMinutes === minutes ? 'selected' : ''}>${minutes ? `Sleep ${minutes} min` : 'Sleep timer off'}</option>`).join('')}</select></div></div></div>${panel}<div class="full-player-bottom"><button class="button button-secondary button-sm" data-action="toggle-lyrics">${icon('lyrics')}<span>${state.playerPanel === 'lyrics' ? 'Hide lyrics' : 'Lyrics'}</span></button><label class="volume-control">${icon(state.volume <= 0 ? 'mute' : 'volume')}<input class="range-input volume-range" type="range" min="0" max="1" step="0.01" value="${state.volume}" style="--range-progress:${state.volume * 100}%" data-range="volume" aria-label="Volume" /></label><span>${song.hasFile ? 'AVAILABLE OFFLINE' : 'FILE NOT ON DEVICE'}</span></div></div></div>`;
}

function renderModal() {
  const modal = state.modal;
  if (!modal) return '';
  if (modal.type === 'playlist-form') {
    const existing = modal.playlistId ? playlistById(modal.playlistId) : null;
    const color = modal.color || existing?.color || COLOR_OPTIONS[0];
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${existing ? 'Edit playlist' : 'Create playlist'}</h2><p>${existing ? 'Give your mix a new name or color.' : 'Start a collection for a sound, a moment, or a mood.'}</p></div>${closeIconButton()}</div><form data-form="playlist"><input type="hidden" name="id" value="${escapeHtml(existing?.id || '')}"/><label class="form-field"><span>Playlist name</span><input name="name" maxlength="60" required placeholder="e.g. Sunday morning" value="${escapeHtml(modal.name ?? existing?.name ?? '')}" autofocus /></label><div class="form-field"><span class="form-field-label">Cover color</span><div class="color-options">${COLOR_OPTIONS.map((option) => `<button type="button" class="color-choice ${option === color ? 'is-selected' : ''}" style="background:${option}" data-action="choose-color" data-color="${option}" aria-label="Choose color ${option}" aria-pressed="${option === color}"></button>`).join('')}</div></div><div class="modal-footer"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${existing ? 'Save changes' : 'Create playlist'}</button></div></form></section></div>`;
  }
  if (modal.type === 'assign-song') {
    const song = songById(modal.songId);
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">Add to playlist</h2><p>${escapeHtml(song?.title || 'This song')}</p></div>${closeIconButton()}</div>${state.playlists.length ? `<form data-form="assign-song"><input type="hidden" name="songId" value="${escapeHtml(modal.songId)}"/><label class="form-field"><span>Choose a playlist</span><select name="playlistId" required>${state.playlists.map((playlist) => `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)}</option>`).join('')}</select></label><div class="modal-footer"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add song</button></div></form>` : `<div class="empty-state"><h2>No playlists yet</h2><p>Create a playlist first, then add this song.</p><button class="button button-primary" data-action="create-playlist-from-song" data-id="${escapeHtml(modal.songId)}">Create playlist</button></div>`}</section></div>`;
  }
  if (modal.type === 'add-songs') {
    const playlist = playlistById(modal.playlistId);
    const already = new Set(playlist?.songIds || []);
    const query = (modal.query || '').trim().toLocaleLowerCase();
    const candidates = sortedSongs(state.songs.filter((song) => !already.has(song.id) && (!query || `${song.title} ${song.artist} ${song.album}`.toLocaleLowerCase().includes(query))), 'recent');
    const show = query ? candidates.slice(0, 80) : candidates.slice(0, 40);
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">Add songs to ${escapeHtml(playlist?.name || 'playlist')}</h2><p>${formatCount(candidates.length, 'available song')} · search to find any track.</p></div>${closeIconButton()}</div><form data-form="add-songs"><input type="hidden" name="playlistId" value="${escapeHtml(modal.playlistId)}"/><label class="form-field"><span>Find songs</span><input data-modal-song-search type="search" value="${escapeHtml(modal.query || '')}" placeholder="Search title, artist, album" autocomplete="off" /></label><div class="playlist-pick-list">${show.map((song) => `<label class="playlist-pick-option"><input type="checkbox" name="songIds" value="${escapeHtml(song.id)}" ${modal.selected?.includes(song.id) ? 'checked' : ''}/><span>${escapeHtml(song.title)} <span class="card-subtitle">· ${escapeHtml(song.artist)}</span></span></label>`).join('') || '<p class="lyrics-empty">No matching tracks to add.</p>'}</div>${candidates.length > show.length ? `<p class="lyrics-empty">Showing ${show.length} of ${candidates.length}. Search to narrow the list.</p>` : ''}<div class="modal-footer"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add selected songs</button></div></form></section></div>`;
  }
  if (modal.type === 'confirm') {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${escapeHtml(modal.title || 'Are you sure?')}</h2></div>${closeIconButton()}</div><p class="confirm-copy">${escapeHtml(modal.message || '')}</p><div class="modal-footer"><button class="button button-secondary" data-action="close-modal">Cancel</button><button class="button ${modal.danger ? 'button-danger' : 'button-primary'}" data-action="${escapeHtml(modal.confirmAction)}" data-id="${escapeHtml(modal.id || '')}">${escapeHtml(modal.confirmLabel || 'Confirm')}</button></div></section></div>`;
  }
  if (modal.type === 'song-menu') {
    const song = songById(modal.songId);
    if (!song) return '';
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${escapeHtml(song.title)}</h2><p>${escapeHtml(song.artist)}</p></div>${closeIconButton()}</div><div class="playlist-pick-list"><button class="playlist-pick-option" data-action="queue-next" data-id="${escapeHtml(song.id)}">${icon('queue')}<span>Play next</span></button><button class="playlist-pick-option" data-action="add-to-playlist" data-id="${escapeHtml(song.id)}">${icon('plus')}<span>Add to playlist</span></button>${song.hasFile ? `<button class="playlist-pick-option" data-action="remove-download" data-id="${escapeHtml(song.id)}">${icon('trash')}<span>Remove stored audio</span></button>` : ''}<button class="playlist-pick-option" data-action="delete-song" data-id="${escapeHtml(song.id)}">${icon('trash')}<span>Remove from library</span></button></div></section></div>`;
  }
  return '';
}

function renderOverlay() {
  if (state.playerOpen && state.currentId) {
    overlayRoot.innerHTML = renderFullPlayer();
    loadCoverImages(overlayRoot);
    updateLyricsHighlight();
  } else if (state.modal) {
    overlayRoot.innerHTML = renderModal();
    loadCoverImages(overlayRoot);
  } else {
    overlayRoot.innerHTML = '';
  }
}

function openModal(modal) {
  state.playerOpen = false;
  state.modal = modal;
  renderOverlay();
  const focus = overlayRoot.querySelector('input:not([type=hidden]),select,button');
  setTimeout(() => focus?.focus(), 0);
}

function closeModal() {
  state.modal = null;
  renderOverlay();
}

function notify(message, type = 'success', duration = 3300) {
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : ''}`;
  item.innerHTML = `${icon(type === 'error' ? 'info' : 'check')}<span>${escapeHtml(message)}</span>`;
  toastRoot.append(item);
  setTimeout(() => item.remove(), duration);
}

function setView(view) {
  state.view = view;
  if (view !== 'playlist') state.playlistId = null;
  if (view !== 'album') { state.albumArtist = ''; state.albumName = ''; }
  if (view !== 'library') state.libraryTab = 'songs';
  state.modal = null;
  renderMain({ preserveScroll: false });
  mainView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openLibraryTab(tab) {
  state.view = 'library';
  state.libraryTab = tab;
  state.playlistId = null;
  state.albumArtist = '';
  state.albumName = '';
  renderMain({ preserveScroll: false });
}

function openPlaylist(id) {
  state.view = 'playlist';
  state.playlistId = id;
  state.albumArtist = '';
  state.albumName = '';
  state.modal = null;
  renderMain({ preserveScroll: false });
}

function openLiked() {
  state.view = 'liked';
  state.playlistId = null;
  state.modal = null;
  renderMain({ preserveScroll: false });
}

function renderLikedView() {
  const songs = likedSongs();
  const artwork = songs[0] ? coverMarkup(songs[0]) : blankCover('#8b5a9c', '♡');
  return `<section class="album-detail-hero">${artwork}<div class="album-detail-copy"><p class="eyebrow">AUTO-PLAYLIST</p><h1>Liked Songs</h1><p>${formatCount(songs.length, 'song')} · ${formatDuration(durationTotal(songs))}</p><div class="hero-actions">${button('Play liked songs', 'play-liked', 'primary', '', 'play')}${button('Download all', 'download-liked', 'secondary', '', 'download')}</div></div></section><section class="section"><div class="section-heading"><div><h2>Your favorites</h2><p>Tap a heart anywhere to add or remove a song</p></div></div>${songs.length ? makeSongList(songs, { sort: 'recent' }) : emptyState('No liked songs yet', 'Use the heart button next to any song to save it here.', 'Browse your library', 'open-library', 'heart')}</section>`;
}

function renderHistory() {
  const songs = state.recentHistory.map(songById).filter(Boolean).slice(0, 20);
  return `<div class="page-heading"><div><p class="eyebrow">YOUR LISTENING</p><h1>Recently played</h1><p class="subheading">Your last 20 tracks, saved privately on this device.</p></div></div>${songs.length ? makeSongList(songs, { sort: 'playlist' }) : emptyState('Your history starts with a play', 'The last 20 songs you play will be collected here.', 'Browse library', 'open-library', 'clock')}`;
}

function openAlbum(artist, album) {
  state.view = 'album';
  state.albumArtist = artist;
  state.albumName = album;
  state.playlistId = null;
  renderMain({ preserveScroll: false });
}

function renderPlayerStatus() {
  renderPlayerBar();
  if (state.playerOpen) renderOverlay();
  updateCurrentRows();
}

function updateCurrentRows() {
  for (const row of mainView.querySelectorAll('.song-row')) {
    const active = row.dataset.songId === state.currentId;
    row.classList.toggle('is-current', active);
    const playOverlay = row.querySelector('.row-play-overlay');
    if (playOverlay) playOverlay.innerHTML = icon(active && state.playing ? 'pause' : 'play');
  }
}

function paintTime() {
  const duration = audio.duration || songById(state.currentId)?.duration || 0;
  const current = audio.currentTime || 0;
  const percent = duration ? Math.min(100, current / duration * 100) : 0;
  const stamp = `${Math.round(percent * 10)}`;
  for (const root of [playerBar, overlayRoot]) {
    for (const input of root.querySelectorAll('[data-range="seek"]')) {
      if (document.activeElement !== input) input.value = stamp;
      input.style.setProperty('--range-progress', `${percent}%`);
    }
    for (const node of root.querySelectorAll('.current-time')) node.textContent = formatTime(current);
    for (const node of root.querySelectorAll('.total-time')) node.textContent = formatTime(duration);
  }
  updateLyricsHighlight();
  if (navigator.mediaSession?.setPositionState && Number.isFinite(duration) && duration > 0) {
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: audio.playbackRate || 1, position: Math.min(current, duration) }); } catch { /* Browser may reject a transient position update. */ }
  }
}

function updateLyricsHighlight() {
  const nodes = [...overlayRoot.querySelectorAll('.lyric-line[data-lyric-time]')];
  if (!nodes.length) return;
  const time = audio.currentTime || 0;
  let current = -1;
  for (let i = 0; i < nodes.length; i += 1) {
    if (Number(nodes[i].dataset.lyricTime) <= time) current = i;
    nodes[i].classList.toggle('is-active', i === current);
  }
  if (current >= 0 && state.playerPanel === 'lyrics' && Date.now() - lastTimePaint > 1100) {
    lastTimePaint = Date.now();
    nodes[current].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function setVolume(value, persist = true) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  state.volume = normalized;
  audio.volume = normalized;
  state.prefs.volume = normalized;
  if (persist) {
    clearTimeout(volumePersistTimer);
    volumePersistTimer = setTimeout(() => setSetting('prefs', state.prefs).catch(() => {}), 220);
  }
  for (const input of document.querySelectorAll('[data-range="volume"]')) {
    if (document.activeElement !== input) input.value = String(normalized);
    input.style.setProperty('--range-progress', `${normalized * 100}%`);
    const svg = input.closest('.volume-control')?.querySelector('svg');
    if (svg) svg.outerHTML = icon(normalized <= 0 ? 'mute' : 'volume');
  }
}

async function initializeAudioGraph() {
  if (audioSourceNode) {
    try { await audioContext?.resume?.(); return true; } catch { return false; }
  }
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return false;
  try {
    audioContext = new Context();
    audioSourceNode = audioContext.createMediaElementSource(audio);
    const low = audioContext.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 160;
    const mid = audioContext.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1400;
    mid.Q.value = .8;
    const high = audioContext.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 6200;
    audioSourceNode.connect(low).connect(mid).connect(high).connect(audioContext.destination);
    eqNodes = { low, mid, high };
    setEqualizer(state.equalizer, false);
    await audioContext.resume();
    return true;
  } catch (error) {
    audioContext = null;
    audioSourceNode = null;
    eqNodes = null;
    console.warn('Listen equalizer unavailable:', error);
    return false;
  }
}

function setEqualizer(preset, announce = true) {
  const valid = ['off', 'bass', 'vocal', 'chill', 'workout'];
  state.equalizer = valid.includes(preset) ? preset : 'off';
  state.prefs.equalizer = state.equalizer;
  if (eqNodes) {
    const settings = {
      off: [0, 0, 0], bass: [6, 1, 2], vocal: [-3, 4, 1.5], chill: [1, -1.5, -2], workout: [4, 2, 4],
    }[state.equalizer];
    eqNodes.low.gain.value = settings[0];
    eqNodes.mid.gain.value = settings[1];
    eqNodes.high.gain.value = settings[2];
  }
  setSetting('prefs', state.prefs).catch(() => {});
  if (announce) notify(`Equalizer: ${state.equalizer === 'off' ? 'Off' : ({ bass: 'Bass Boost', vocal: 'Vocal', chill: 'Chill', workout: 'Workout' })[state.equalizer]}`);
}

function updateMediaMetadata(song) {
  if (!('mediaSession' in navigator)) return;
  const MediaMetadataClass = globalThis.MediaMetadata;
  if (!MediaMetadataClass) return;
  const apply = (artwork) => {
    if (state.currentId !== song.id) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadataClass({
        title: song.title,
        artist: song.artist || 'Unknown artist',
        album: song.album || 'Listen',
        artwork,
      });
    } catch { /* Media Session is optional on this browser. */ }
  };
  apply([{ src: new URL('./icons/icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }]);
  if (song.coverArt) getCoverUrl(song.id).then((url) => {
    if (url) apply([{ src: url, sizes: '420x420', type: 'image/webp' }]);
  }).catch(() => {});
}

async function recordPlay(song) {
  const now = Date.now();
  song.playCount = (song.playCount || 0) + 1;
  song.lastPlayedAt = now;
  lastRecordedId = song.id;
  state.recentHistory = [song.id, ...state.recentHistory.filter((id) => id !== song.id)].slice(0, 20);
  await Promise.all([putSong(song), setSetting('recentHistory', state.recentHistory)]);
}

async function playSong(id, context = null) {
  const song = songById(id);
  if (!song) return;
  if (state.currentId === id && audio.src) {
    if (state.playing) audio.pause();
    else await togglePlayback();
    return;
  }
  const items = (context || songForContext(id)).map((item) => typeof item === 'string' ? item : item.id).filter((item, index, all) => songById(item) && all.indexOf(item) === index);
  if (!items.includes(id)) items.unshift(id);
  state.queue = items;
  state.queueIndex = state.queue.indexOf(id);
  state.currentId = id;
  state.playerPanel = null;
  await loadCurrentSong(true);
}

async function loadCurrentSong(autoplay = true) {
  const requestedId = state.currentId;
  const song = songById(requestedId);
  if (!song) return;
  audio.pause();
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = null;
  let blob = null;
  try { blob = await getAudioBlob(song.id); } catch (error) { console.error(error); }
  if (state.currentId !== requestedId) return;
  if (state.currentId !== requestedId) return;
  if (!blob) {
    notify('This song’s stored audio was removed. Choose the original file to restore it.', 'error', 4800);
    renderPlayerStatus();
    return;
  }
  activeObjectUrl = URL.createObjectURL(blob);
  audio.src = activeObjectUrl;
  audio.playbackRate = state.speed;
  audio.volume = state.volume;
  audio.load();
  updateMediaMetadata(song);
  renderPlayerStatus();
  if (!autoplay) return;
  await initializeAudioGraph();
  try {
    await audio.play();
  } catch (error) {
    state.playing = false;
    renderPlayerStatus();
    notify('Tap play once more if your browser blocked the first playback.', 'error');
    console.warn('Listen audio playback was blocked:', error);
  }
}

async function togglePlayback() {
  if (!state.currentId) {
    const first = sortedSongs(state.songs, 'recent')[0];
    if (first) return playSong(first.id, sortedSongs(state.songs, 'recent'));
    notify('Add your own music to start listening.', 'error');
    return;
  }
  if (audio.src) {
    if (audio.paused) {
      await initializeAudioGraph();
      try { await audio.play(); } catch { notify('Tap play again to allow audio playback.', 'error'); }
    } else audio.pause();
  } else {
    await loadCurrentSong(true);
  }
}

function setQueueIndex(index) {
  if (index < 0 || index >= state.queue.length) return false;
  state.queueIndex = index;
  state.currentId = state.queue[index];
  state.playerPanel = state.playerOpen ? state.playerPanel : null;
  loadCurrentSong(true);
  return true;
}

function nextTrack() {
  if (!state.queue.length) return;
  let nextIndex = state.queueIndex + 1;
  if (nextIndex >= state.queue.length) {
    if (state.repeat === 'all') nextIndex = 0;
    else { audio.pause(); audio.currentTime = 0; state.playing = false; renderPlayerStatus(); return; }
  }
  setQueueIndex(nextIndex);
}

function previousTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; paintTime(); return; }
  if (!state.queue.length) return;
  let previous = state.queueIndex - 1;
  if (previous < 0) previous = state.repeat === 'all' ? state.queue.length - 1 : 0;
  setQueueIndex(previous);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.shuffle && state.queueIndex >= 0) {
    const current = state.queue[state.queueIndex];
    const upcoming = state.queue.slice(state.queueIndex + 1);
    for (let i = upcoming.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
    }
    state.queue = [...state.queue.slice(0, state.queueIndex), current, ...upcoming];
  }
  renderPlayerStatus();
  if (state.playerOpen && state.playerPanel === 'queue') renderOverlay();
}

function toggleRepeat() {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  renderPlayerStatus();
  notify(`Repeat ${state.repeat === 'off' ? 'off' : state.repeat === 'all' ? 'all tracks' : 'one track'}`);
}

function addQueueNext(id) {
  const song = songById(id);
  if (!song) return;
  if (!state.queue.length) {
    state.queue = [state.currentId, id].filter(Boolean);
    state.queueIndex = state.currentId ? 0 : -1;
  } else {
    state.queue.splice(Math.max(0, state.queueIndex + 1), 0, id);
  }
  state.modal = null;
  renderOverlay();
  notify(`${song.title} will play next.`);
  if (state.playerOpen && state.playerPanel === 'queue') renderOverlay();
}

function moveQueueItem(id, delta) {
  const from = state.queue.indexOf(id);
  if (from < 0 || from <= state.queueIndex) return;
  const to = Math.max(state.queueIndex + 1, Math.min(state.queue.length - 1, from + delta));
  if (from === to) return;
  const [item] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, item);
  if (from < state.queueIndex && to >= state.queueIndex) state.queueIndex -= 1;
  else if (from > state.queueIndex && to <= state.queueIndex) state.queueIndex += 1;
  if (state.playerOpen && state.playerPanel === 'queue') renderOverlay();
}

function removeQueueItem(id) {
  const index = state.queue.indexOf(id);
  if (index < 0 || index === state.queueIndex) return;
  state.queue.splice(index, 1);
  if (index < state.queueIndex) state.queueIndex -= 1;
  if (state.playerOpen && state.playerPanel === 'queue') renderOverlay();
}

function setSleepTimer(minutes) {
  clearTimeout(state.sleepTimer);
  state.sleepTimer = null;
  state.sleepMinutes = Number(minutes) || 0;
  if (state.sleepMinutes) {
    state.sleepTimer = setTimeout(() => {
      audio.pause();
      state.sleepMinutes = 0;
      state.sleepTimer = null;
      renderPlayerStatus();
      notify('Sleep timer finished — playback paused.');
    }, state.sleepMinutes * 60_000);
    notify(`Sleep timer set for ${state.sleepMinutes} minutes.`);
  } else notify('Sleep timer turned off.');
  if (state.playerOpen) renderOverlay();
}

function openFullPlayer() {
  if (!state.currentId) {
    const first = sortedSongs(state.songs, 'recent')[0];
    if (!first) { notify('Add a song first to open the player.', 'error'); return; }
    playSong(first.id, sortedSongs(state.songs, 'recent'));
  }
  state.playerOpen = true;
  state.playerPanel = null;
  renderOverlay();
}

function closeFullPlayer() {
  state.playerOpen = false;
  state.playerPanel = null;
  renderOverlay();
}

function openQueue() {
  if (!state.currentId) {
    notify('Start a song to see what is up next.', 'error');
    return;
  }
  state.playerOpen = true;
  state.playerPanel = state.playerPanel === 'queue' ? null : 'queue';
  renderOverlay();
}

function setMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => togglePlayback(), pause: () => audio.pause(), nexttrack: () => nextTrack(), previoustrack: () => previousTrack(),
    seekto: (event) => { if (Number.isFinite(event.seekTime)) { audio.currentTime = event.seekTime; paintTime(); } },
    seekbackward: (event) => { audio.currentTime = Math.max(0, audio.currentTime - (event.seekOffset || 10)); paintTime(); },
    seekforward: (event) => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (event.seekOffset || 10)); paintTime(); },
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Unsupported action on this platform. */ }
  }
}

function updateStorageWarning() {
  const quota = state.storageEstimate?.quota || 0;
  const used = state.storageEstimate?.usage || 0;
  if (quota && used / quota < .95) state.storageWarned = false;
  if (quota && used / quota >= .95 && !state.storageWarned) {
    state.storageWarned = true;
    notify('Listen is at least 95% of this browser origin’s estimated storage quota. Export a backup or remove some downloads.', 'error', 6000);
  }
}

async function refreshStorage() {
  try {
    const media = await getStoredMediaUsage();
    state.mediaUsage = media;
  } catch (error) { console.warn('Could not measure Listen storage:', error); }
  try { state.storageEstimate = await navigator.storage?.estimate?.() || null; } catch { state.storageEstimate = null; }
  try { state.persistentStorage = await navigator.storage?.persisted?.() ?? null; } catch { state.persistentStorage = null; }
  updateStorageWarning();
  if (state.view === 'downloads') renderMain();
}

function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  navigator.storage.persist().then((granted) => {
    state.persistentStorage = granted;
    if (state.view === 'downloads') renderMain();
  }).catch(() => {});
}

function pauseDownloadQueue() {
  state.downloadQueue.paused = true;
  if (state.view === 'downloads') renderMain();
}
function resumeDownloadQueue() {
  state.downloadQueue.paused = false;
  if (state.view === 'downloads') renderMain();
}
function cancelDownloadQueue() {
  state.downloadQueue.cancelled = true;
  state.downloadQueue.paused = false;
  if (state.view === 'downloads') renderMain();
}

async function enqueueDownloads(ids) {
  const validIds = [...new Set(ids)].filter((id) => songById(id));
  if (!validIds.length) { notify('There are no songs to download.', 'error'); return; }
  const queue = state.downloadQueue;
  if (queue.processing) {
    const pending = new Set(queue.items.slice(queue.index));
    queue.items.push(...validIds.filter((id) => !pending.has(id)));
  } else {
    state.downloadQueue = { items: validIds, index: 0, complete: 0, failed: 0, paused: false, cancelled: false, processing: true, activeId: null };
  }
  if (state.view === 'downloads') renderMain();
  updateQueueBadge();
  if (!queueWorkerStarted) runDownloadQueue();
}

function updateQueueBadge() {
  const q = state.downloadQueue;
  const count = q.processing ? Math.max(0, q.items.length - q.complete) : state.songs.filter((song) => song.downloaded && song.hasFile).length;
  const node = document.getElementById('download-count');
  if (node) node.textContent = String(count);
}

async function runDownloadQueue() {
  if (queueWorkerStarted) return;
  queueWorkerStarted = true;
  const q = state.downloadQueue;
  q.processing = true;
  try {
    while (q.index < q.items.length && !q.cancelled) {
      while (q.paused && !q.cancelled) await new Promise((resolve) => setTimeout(resolve, 180));
      if (q.cancelled) break;
      const id = q.items[q.index];
      const song = songById(id);
      q.activeId = id;
      try {
        if (song) {
          const blob = await getAudioBlob(id);
          if (!blob) throw new Error('Original file is missing. Relink it from your device first.');
          if (!song.downloaded || !song.hasFile) {
            if (!song.hasFile) await putAudioBlob(id, blob);
            song.downloaded = true;
            song.hasFile = true;
            song.bytes = blob.size;
            await putSong(song);
          }
        }
      } catch (error) {
        q.failed += 1;
        console.warn('Download item skipped:', error);
      }
      q.complete += 1;
      q.index += 1;
      q.activeId = null;
      updateQueueBadge();
      if (q.complete % 4 === 0 || q.index >= q.items.length || state.view === 'downloads') renderMain();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    q.processing = false;
    q.activeId = null;
    if (q.cancelled) notify(`Download queue cancelled after ${q.complete} songs.`);
    else if (q.failed) notify(`Downloads finished. ${q.failed} item${q.failed === 1 ? '' : 's'} need the original file.`, 'error', 5000);
    else notify(`Saved ${q.complete} ${q.complete === 1 ? 'song' : 'songs'} for offline listening.`);
    refreshStorage();
    renderMain();
  } catch (error) {
    q.processing = false;
    notify(error.message || 'Download queue stopped.', 'error');
  } finally {
    queueWorkerStarted = false;
    updateQueueBadge();
  }
}

function downloadCollectionFromElement(el) {
  const kind = el.dataset.kind;
  const songs = collectionFor(kind, el);
  enqueueDownloads(songs.map((song) => song.id));
}

function createPlaylistModal(songId = '') {
  openModal({ type: 'playlist-form', songId, color: COLOR_OPTIONS[0] });
}

function editPlaylistModal(id) {
  const playlist = playlistById(id);
  if (playlist) openModal({ type: 'playlist-form', playlistId: id, color: playlist.color });
}

async function savePlaylistForm(form) {
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (!name) { notify('Give your playlist a name.', 'error'); return; }
  const id = String(data.get('id') || '');
  let playlist;
  if (id) {
    playlist = playlistById(id);
    if (!playlist) return;
    playlist.name = name;
    playlist.color = COLOR_OPTIONS.includes(state.modal?.color) ? state.modal.color : playlist.color;
  } else {
    playlist = { id: makeId(), name, songIds: [], createdAt: Date.now(), color: COLOR_OPTIONS.includes(state.modal?.color) ? state.modal.color : COLOR_OPTIONS[0] };
    if (state.modal?.songId) playlist.songIds.push(state.modal.songId);
    state.playlists.unshift(playlist);
  }
  await putPlaylist(playlist);
  const fromSong = state.modal?.songId;
  state.modal = null;
  renderMain();
  notify(id ? 'Playlist updated.' : 'Playlist created.');
  if (fromSong && !id) openPlaylist(playlist.id);
}

function openConfirm(title, message, confirmAction, id, confirmLabel = 'Confirm', danger = false) {
  openModal({ type: 'confirm', title, message, confirmAction, id, confirmLabel, danger });
}

async function confirmDeletePlaylist(id) {
  const playlist = playlistById(id);
  if (!playlist) return;
  state.playlists = state.playlists.filter((item) => item.id !== id);
  await removePlaylistFromDb(id);
  state.modal = null;
  if (state.view === 'playlist' && state.playlistId === id) state.view = 'library';
  renderMain({ preserveScroll: false });
  notify(`Deleted “${playlist.name}”.`);
}

async function confirmRemoveDownload(id) {
  const song = songById(id);
  if (!song) return;
  try {
    await deleteAudioBlob(id);
    song.hasFile = false;
    song.downloaded = false;
    song.bytes = 0;
    await putSong(song);
    state.modal = null;
    if (state.currentId === id) {
      audio.pause();
      state.currentId = null;
      state.queue = [];
      state.queueIndex = -1;
      state.playing = false;
    }
    renderMain();
    refreshStorage();
    notify(`Removed the stored audio for “${song.title}”.`);
  } catch (error) { notify(error.message || 'Could not remove this download.', 'error'); }
}

async function confirmDeleteSong(id) {
  const song = songById(id);
  if (!song) return;
  await deleteSongAndMedia(id);
  state.songs = state.songs.filter((item) => item.id !== id);
  const queuedIndex = state.queue.indexOf(id);
  if (queuedIndex >= 0) {
    state.queue.splice(queuedIndex, 1);
    if (queuedIndex < state.queueIndex) state.queueIndex -= 1;
  }
  for (const playlist of state.playlists) {
    playlist.songIds = playlist.songIds.filter((songId) => songId !== id);
    await putPlaylist(playlist);
  }
  state.recentHistory = state.recentHistory.filter((songId) => songId !== id);
  await setSetting('recentHistory', state.recentHistory);
  if (state.currentId === id) {
    audio.pause();
    state.currentId = null;
    state.queue = [];
    state.queueIndex = -1;
    state.playing = false;
  }
  const cachedUrl = coverObjectUrls.get(id);
  if (cachedUrl) { URL.revokeObjectURL(cachedUrl); coverObjectUrls.delete(id); }
  state.modal = null;
  renderMain();
  refreshStorage();
  notify(`Removed “${song.title}” from your library.`);
}

async function toggleLiked(id) {
  const song = songById(id);
  if (!song) return;
  song.liked = !song.liked;
  await putSong(song);
  renderMain();
  notify(song.liked ? `Added “${song.title}” to Liked Songs.` : `Removed “${song.title}” from Liked Songs.`);
}

async function removeFromPlaylist(songId, playlistId) {
  const playlist = playlistById(playlistId);
  if (!playlist) return;
  playlist.songIds = playlist.songIds.filter((id) => id !== songId);
  await putPlaylist(playlist);
  renderMain();
  notify('Removed from playlist.');
}

function assignSongModal(songId) {
  openModal({ type: 'assign-song', songId });
}

async function saveSongAssignment(form) {
  const data = new FormData(form);
  const songId = String(data.get('songId') || '');
  const playlist = playlistById(String(data.get('playlistId') || ''));
  if (!playlist || !songById(songId)) return;
  if (!playlist.songIds.includes(songId)) playlist.songIds.push(songId);
  await putPlaylist(playlist);
  state.modal = null;
  renderMain();
  notify(`Added to “${playlist.name}”.`);
}

async function saveManySongs(form) {
  const data = new FormData(form);
  const playlist = playlistById(String(data.get('playlistId') || ''));
  if (!playlist) return;
  const ids = [...new Set([...(state.modal?.selected || []), ...data.getAll('songIds').map(String)])];
  const existing = new Set(playlist.songIds);
  playlist.songIds.push(...ids.filter((id) => !existing.has(id)));
  await putPlaylist(playlist);
  state.modal = null;
  renderMain();
  notify(`Added ${ids.length} ${ids.length === 1 ? 'song' : 'songs'} to “${playlist.name}”.`);
}

function fileExtension(file) {
  return file.name.split('.').pop()?.toLocaleLowerCase() || '';
}

function isAudioFile(file) {
  return file.type.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'opus'].includes(fileExtension(file));
}

function folderOf(file) {
  const path = file.webkitRelativePath || '';
  if (!path) return 'Uploads';
  const folder = path.split('/').slice(0, -1).filter(Boolean).slice(1).join(' / ');
  return folder || path.split('/')[0] || 'Uploads';
}

function sourceKeyFor(file) {
  return `${file.name.toLocaleLowerCase()}|${file.size}|${file.lastModified}`;
}

async function importFiles(fileList) {
  const files = [...fileList];
  const lyricsByStem = new Map();
  for (const file of files.filter((item) => fileExtension(item) === 'lrc')) {
    try { lyricsByStem.set(normalizeStem(file.webkitRelativePath || file.name), await file.text()); } catch { /* ignore unreadable lyrics */ }
  }
  const audioFiles = files.filter(isAudioFile);
  if (!audioFiles.length) { notify('No supported audio files found. Choose MP3, M4A, WAV, OGG, FLAC, AAC, or OPUS files.', 'error', 4800); return; }
  const existingKeys = new Set(state.songs.map((song) => song.sourceKey).filter(Boolean));
  const fresh = audioFiles.filter((file) => !existingKeys.has(sourceKeyFor(file)));
  if (!fresh.length) { notify('Those tracks are already in your library.'); return; }
  state.importProgress = { total: fresh.length, done: 0, errors: 0, active: 'your tracks' };
  renderMain();
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= fresh.length) return;
      const file = fresh[index];
      state.importProgress.active = file.name;
      try {
        const metadata = await readAudioMetadata(file);
        const coverBlob = await makeCoverThumbnail(metadata.coverBlob);
        const duration = await readDuration(file);
        const lyricKey = normalizeStem(file.webkitRelativePath || file.name);
        const lyrics = lyricsByStem.get(lyricKey) || '';
        const song = {
          id: makeId(), title: metadata.title, artist: metadata.artist, album: metadata.album,
          genre: metadata.genre, duration: duration || 0, folder: folderOf(file), fileName: file.name,
          fileType: file.type || `audio/${fileExtension(file)}`, bytes: file.size, coverBytes: coverBlob?.size || 0,
          coverArt: Boolean(coverBlob), downloaded: Boolean(state.prefs.autoDownload), hasFile: true,
          lyrics, playCount: 0, liked: false, addedAt: Date.now() + index, lastPlayedAt: 0,
          sourceKey: sourceKeyFor(file),
        };
        await putSongWithMedia(song, file, coverBlob);
        state.songs.push(song);
      } catch (error) {
        state.importProgress.errors += 1;
        console.error('Could not import', file.name, error);
      }
      state.importProgress.done += 1;
      if (state.importProgress.done % 3 === 0 || state.importProgress.done >= fresh.length) renderMain();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, fresh.length) }, worker));
  const result = state.importProgress;
  state.importProgress = null;
  state.songs.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  renderMain();
  refreshStorage();
  if (result.errors) notify(`Imported with ${result.errors} file${result.errors === 1 ? '' : 's'} skipped.`, 'error');
  else notify(`Added ${result.done} ${result.done === 1 ? 'song' : 'songs'} to your library.`);
}

async function relinkSong(id, file) {
  const song = songById(id);
  if (!song || !file) return;
  try {
    const metadata = await readAudioMetadata(file);
    const thumb = await makeCoverThumbnail(metadata.coverBlob);
    const duration = await readDuration(file);
    song.fileName = file.name;
    song.fileType = file.type || `audio/${fileExtension(file)}`;
    song.bytes = file.size;
    song.duration = duration || song.duration;
    song.hasFile = true;
    song.downloaded = true;
    song.sourceKey = sourceKeyFor(file);
    if (!song.coverArt && thumb) { song.coverArt = true; song.coverBytes = thumb.size; }
    await putSongWithMedia(song, file, song.coverArt ? (thumb || await getCoverBlob(id)) : null);
    state.pendingRelinkId = null;
    renderMain();
    refreshStorage();
    notify(`Restored “${song.title}” on this device.`);
  } catch (error) { notify(error.message || 'Could not restore that audio file.', 'error'); }
}

function toggleOfflineMode() {
  state.prefs.offlineMode = !state.prefs.offlineMode;
  setSetting('prefs', state.prefs).catch(() => {});
  paintNavigation();
  renderMain();
  notify(state.prefs.offlineMode ? 'Offline mode on — Listen will use only music saved on this device.' : 'Offline mode off. Your local library remains available.');
}

function toggleAutoDownload() {
  state.prefs.autoDownload = !state.prefs.autoDownload;
  setSetting('prefs', state.prefs).catch(() => {});
  renderMain();
  notify(state.prefs.autoDownload ? 'New imports will be pinned in Downloads.' : 'Auto-download for new imports is off. Imported files still stay on this device.');
}

async function exportBackup() {
  if (!state.songs.length) { notify('Your library is empty.', 'error'); return; }
  const progress = { done: 0, total: 1, label: 'Preparing archive' };
  state.modal = { type: 'confirm', title: 'Preparing your backup', message: 'The ZIP is being streamed track by track. Keep Listen open until the export completes.', confirmAction: 'close-modal', confirmLabel: 'Close', danger: false };
  // Use a non-blocking status toast rather than waiting for a modal confirmation.
  state.modal = null;
  renderOverlay();
  notify('Building ZIP backup… large libraries may take a little while.', 'success', 5000);
  try {
    const result = await exportLibraryBackup(state.songs, {
      playlists: state.playlists,
      getAudio: async (song) => getAudioBlob(song.id),
      getCover: async (song) => (song.coverArt ? await getCoverBlob(song.id) : null),
      onProgress: ({ done, total, label }) => {
        progress.done = done; progress.total = total; progress.label = label;
      },
    });
    if (result.cancelled) return;
    notify(`Backup complete: ${result.exported} tracks exported${result.missing ? ` · ${result.missing} missing audio` : ''}.`, result.missing ? 'error' : 'success', 6000);
  } catch (error) {
    console.error(error);
    notify(error.message || 'Could not export the library ZIP.', 'error', 6000);
  }
}

function openSearch() {
  state.view = 'search';
  state.playlistId = null;
  renderMain({ preserveScroll: false });
  searchInput.focus();
}

function handleAction(actionElement) {
  const { action, id } = actionElement.dataset;
  switch (action) {
    case 'open-file-picker': document.getElementById('file-picker').click(); break;
    case 'open-folder-picker': document.getElementById('folder-picker').click(); break;
    case 'open-library': state.view = 'library'; state.libraryTab = 'songs'; renderMain({ preserveScroll: false }); break;
    case 'open-library-albums': openLibraryTab('albums'); break;
    case 'open-history': state.view = 'history'; renderMain({ preserveScroll: false }); break;
    case 'sort-most-played': state.view = 'library'; state.sort = 'played'; renderMain({ preserveScroll: false }); break;
    case 'clear-filters': state.genreFilter = 'all'; state.folderFilter = 'all'; renderMain(); break;
    case 'clear-search': state.searchQuery = ''; searchInput.value = ''; state.genreFilter = 'all'; state.folderFilter = 'all'; renderMain(); break;
    case 'play-song': playSong(id); break;
    case 'play-all': { const songs = sortedSongs(state.songs, 'recent'); if (songs[0]) playSong(songs[0].id, songs); else notify('Import your own music to start listening.', 'error'); break; }
    case 'play-collection': {
      const items = collectionFor(actionElement.dataset.kind, actionElement);
      if (items[0]) playSong(items[0].id, items);
      else notify('This collection is empty.', 'error');
      break;
    }
    case 'play-liked': { const items = likedSongs(); if (items[0]) playSong(items[0].id, items); else notify('Like a song first to build this collection.', 'error'); break; }
    case 'download-liked': enqueueDownloads(likedSongs().map((song) => song.id)); break;
    case 'download-all': enqueueDownloads(sortedSongs(state.songs, 'recent').map((song) => song.id)); break;
    case 'download-song': enqueueDownloads([id]); break;
    case 'download-collection': downloadCollectionFromElement(actionElement); break;
    case 'remove-download': {
      const song = songById(id);
      openConfirm('Remove stored audio?', `This removes the local audio file for “${song?.title || 'this track'}” to free storage. The library entry stays, but you will need the original file to play it again.`, 'confirm-remove-download', id, 'Remove audio', true);
      break;
    }
    case 'link-song': state.pendingRelinkId = id; document.getElementById('relink-picker').click(); break;
    case 'like-song': toggleLiked(id); break;
    case 'add-to-playlist': assignSongModal(id); break;
    case 'remove-from-playlist': removeFromPlaylist(id, actionElement.dataset.playlistId); break;
    case 'create-playlist': createPlaylistModal(); break;
    case 'create-playlist-from-song': createPlaylistModal(id); break;
    case 'edit-playlist': editPlaylistModal(id); break;
    case 'delete-playlist': {
      const playlist = playlistById(id);
      openConfirm('Delete playlist?', `“${playlist?.name || 'This playlist'}” will be deleted. Its songs stay in your library.`, 'confirm-delete-playlist', id, 'Delete playlist', true);
      break;
    }
    case 'confirm-delete-playlist': confirmDeletePlaylist(id); break;
    case 'confirm-remove-download': confirmRemoveDownload(id); break;
    case 'confirm-delete-song': confirmDeleteSong(id); break;
    case 'delete-song': {
      const song = songById(id);
      state.modal = null;
      openConfirm('Remove from library?', `“${song?.title || 'This song'}” and its stored audio/artwork will be removed from this device and from playlists.`, 'confirm-delete-song', id, 'Remove song', true);
      break;
    }
    case 'view-playlist': openPlaylist(id); break;
    case 'open-liked': openLiked(); break;
    case 'open-album': openAlbum(actionElement.dataset.artist || '', actionElement.dataset.album || ''); break;
    case 'add-songs': openModal({ type: 'add-songs', playlistId: id, query: '' }); break;
    case 'library-tab': openLibraryTab(actionElement.dataset.tab); break;
    case 'toggle-play': togglePlayback(); break;
    case 'next': nextTrack(); break;
    case 'previous': previousTrack(); break;
    case 'toggle-shuffle': toggleShuffle(); break;
    case 'toggle-repeat': toggleRepeat(); break;
    case 'player-open': openFullPlayer(); break;
    case 'player-close': closeFullPlayer(); break;
    case 'toggle-queue': openQueue(); break;
    case 'toggle-lyrics':
      state.playerOpen = true;
      state.playerPanel = state.playerPanel === 'lyrics' ? null : 'lyrics';
      renderOverlay();
      break;
    case 'queue-next': addQueueNext(id); break;
    case 'play-queued': { const index = state.queue.indexOf(id); if (index >= 0) setQueueIndex(index); break; }
    case 'queue-up': moveQueueItem(id, -1); break;
    case 'queue-down': moveQueueItem(id, 1); break;
    case 'queue-remove': removeQueueItem(id); break;
    case 'song-menu': openModal({ type: 'song-menu', songId: id }); break;
    case 'pause-downloads': pauseDownloadQueue(); break;
    case 'resume-downloads': resumeDownloadQueue(); break;
    case 'cancel-downloads': cancelDownloadQueue(); break;
    case 'export-backup': exportBackup(); break;
    case 'toggle-auto-download': toggleAutoDownload(); break;
    case 'toggle-offline': toggleOfflineMode(); break;
    case 'reload-app': location.reload(); break;
    case 'close-modal': closeModal(); break;
    case 'choose-color':
      if (state.modal?.type === 'playlist-form' && COLOR_OPTIONS.includes(actionElement.dataset.color)) {
        state.modal.color = actionElement.dataset.color;
        renderOverlay();
      }
      break;
    case 'backdrop-close': closeModal(); break;
    default: break;
  }
}

function handleClick(event) {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    if (actionElement.dataset.action === 'backdrop-close' && event.target !== actionElement) return;
    event.preventDefault();
    handleAction(actionElement);
    return;
  }
  const viewElement = event.target.closest('[data-view]');
  if (viewElement) {
    event.preventDefault();
    const view = viewElement.dataset.view;
    if (view === 'search') openSearch(); else setView(view);
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.name === 'name' && state.modal?.type === 'playlist-form') state.modal.name = target.value;
  if (target.id === 'global-search') {
    state.searchQuery = target.value;
    document.getElementById('clear-search').hidden = !target.value;
    if (state.view !== 'search') state.view = 'search';
    renderMain();
    return;
  }
  if (target.dataset.range === 'seek') {
    const duration = audio.duration || songById(state.currentId)?.duration || 0;
    if (duration) audio.currentTime = (Number(target.value) / 1000) * duration;
    target.style.setProperty('--range-progress', `${Number(target.value) / 10}%`);
    paintTime();
    return;
  }
  if (target.dataset.range === 'volume') { setVolume(target.value, false); return; }
  if (target.dataset.modalSongSearch !== undefined) {
    const caret = target.selectionStart;
    state.modal.query = target.value;
    renderOverlay();
    const next = overlayRoot.querySelector('[data-modal-song-search]');
    next?.focus();
    next?.setSelectionRange(caret, caret);
    return;
  }
  if (target.dataset.modalQuery !== undefined) {
    state.modal.query = target.value;
    renderOverlay();
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.dataset.range === 'volume') { setVolume(target.value, true); return; }
  if (target.name === 'songIds' && state.modal?.type === 'add-songs') {
    const selected = new Set(state.modal.selected || []);
    if (target.checked) selected.add(target.value); else selected.delete(target.value);
    state.modal.selected = [...selected];
  }
  if (target.dataset.filter === 'genre') { state.genreFilter = target.value; renderMain(); }
  else if (target.dataset.filter === 'folder') { state.folderFilter = target.value; renderMain(); }
  else if (target.hasAttribute('data-sort')) { state.sort = target.value; renderMain(); }
  else if (target.dataset.playerSetting === 'speed') {
    state.speed = Number(target.value) || 1;
    audio.playbackRate = state.speed;
    state.prefs.speed = state.speed;
    setSetting('prefs', state.prefs).catch(() => {});
    notify(`Playback speed ${state.speed}×.`);
  } else if (target.dataset.playerSetting === 'equalizer') setEqualizer(target.value);
  else if (target.dataset.playerSetting === 'sleep') setSleepTimer(target.value);
}

function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'playlist') savePlaylistForm(form);
  else if (form.dataset.form === 'assign-song') saveSongAssignment(form);
  else if (form.dataset.form === 'add-songs') saveManySongs(form);
}

function updateOnlineStatus() {
  state.online = navigator.onLine !== false;
  paintNavigation();
  if (state.view === 'downloads') renderMain();
}

function setupDragDrop() {
  const dropOverlay = document.createElement('div');
  dropOverlay.className = 'drag-overlay';
  dropOverlay.id = 'drag-overlay';
  dropOverlay.textContent = 'Drop your songs here';
  document.body.append(dropOverlay);
  document.addEventListener('dragenter', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    state.dragDepth += 1;
    dropOverlay.classList.add('is-visible');
  });
  document.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
  });
  document.addEventListener('dragleave', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (!state.dragDepth) dropOverlay.classList.remove('is-visible');
  });
  document.addEventListener('drop', (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    state.dragDepth = 0;
    dropOverlay.classList.remove('is-visible');
    importFiles(event.dataTransfer.files);
  });
}

let draggedQueueId = null;
function setupQueueDrag() {
  document.addEventListener('dragstart', (event) => {
    const row = event.target.closest('[data-queue-id]');
    if (!row) return;
    draggedQueueId = row.dataset.queueId;
    row.classList.add('dragging');
    event.dataTransfer?.setData('text/plain', draggedQueueId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', (event) => event.target.closest('[data-queue-id]')?.classList.remove('dragging'));
  document.addEventListener('dragover', (event) => {
    if (event.target.closest('[data-queue-id]') && draggedQueueId) event.preventDefault();
  });
  document.addEventListener('drop', (event) => {
    const target = event.target.closest('[data-queue-id]');
    if (!target || !draggedQueueId) return;
    event.preventDefault();
    const from = state.queue.indexOf(draggedQueueId);
    const to = state.queue.indexOf(target.dataset.queueId);
    if (from >= 0 && to >= 0 && from > state.queueIndex && to > state.queueIndex) {
      const [item] = state.queue.splice(from, 1);
      state.queue.splice(to, 0, item);
      if (state.playerOpen && state.playerPanel === 'queue') renderOverlay();
    }
    draggedQueueId = null;
  });
}

function setupInstallPrompt() {
  const installButton = document.getElementById('install-button');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.pendingInstall = event;
    installButton.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    state.pendingInstall = null;
    installButton.hidden = true;
    notify('Listen is installed on your device.');
  });
  installButton.addEventListener('click', async () => {
    if (!state.pendingInstall) {
      notify('On Android, open your browser menu and choose “Install app” or “Add to Home screen”.');
      return;
    }
    state.pendingInstall.prompt();
    const result = await state.pendingInstall.userChoice;
    if (result?.outcome === 'accepted') notify('Installing Listen…');
    state.pendingInstall = null;
    installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const scriptUrl = new URL('./sw.js', document.baseURI);
  const scope = new URL('./', document.baseURI).pathname;
  navigator.serviceWorker.register(scriptUrl, { scope }).catch((error) => console.warn('Listen offline app shell could not register:', error));
}

function paintIcons() {
  for (const node of document.querySelectorAll('[data-icon]')) {
    const name = node.dataset.icon;
    if (ICON_PATHS[name]) node.innerHTML = icon(name);
  }
}

function setupEventListeners() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  mainView.addEventListener('scroll', (event) => {
    const list = event.target.closest('[data-scroll-list]');
    if (list) paintVirtualList(list);
  }, true);
  document.getElementById('file-picker').addEventListener('change', (event) => {
    importFiles(event.target.files).finally(() => { event.target.value = ''; });
  });
  document.getElementById('folder-picker').addEventListener('change', (event) => {
    importFiles(event.target.files).finally(() => { event.target.value = ''; });
  });
  document.getElementById('relink-picker').addEventListener('change', (event) => {
    if (event.target.files?.[0] && state.pendingRelinkId) relinkSong(state.pendingRelinkId, event.target.files[0]);
    event.target.value = '';
  });
  document.getElementById('offline-toggle').addEventListener('click', toggleOfflineMode);
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  window.addEventListener('resize', () => paintAllVirtualLists());
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (event.key === 'Escape') {
      if (state.modal) closeModal();
      else if (state.playerOpen) closeFullPlayer();
    } else if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      togglePlayback();
    }
  });
  audio.addEventListener('play', async () => {
    state.playing = true;
    if (navigator.mediaSession) { try { navigator.mediaSession.playbackState = 'playing'; } catch { /* optional API */ } }
    if (state.currentId && lastRecordedId !== state.currentId) {
      const song = songById(state.currentId);
      if (song) recordPlay(song).then(() => { if (state.view === 'home') renderMain(); }).catch(console.error);
    }
    renderPlayerStatus();
  });
  audio.addEventListener('pause', () => {
    state.playing = false;
    if (navigator.mediaSession) { try { navigator.mediaSession.playbackState = 'paused'; } catch { /* optional API */ } }
    renderPlayerStatus();
  });
  audio.addEventListener('loadedmetadata', () => { paintTime(); renderPlayerBar(); });
  audio.addEventListener('timeupdate', paintTime);
  audio.addEventListener('durationchange', paintTime);
  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); }
    else nextTrack();
  });
  audio.addEventListener('error', () => {
    if (state.currentId && audio.src) notify('This audio file could not be played in the browser.', 'error');
  });
  paintIcons();
  setupInstallPrompt();
  setupDragDrop();
  setupQueueDrag();
}

async function initialize() {
  setupEventListeners();
  registerServiceWorker();
  setMediaSessionHandlers();
  audio.volume = state.volume;
  try {
    await openDatabase();
    const [songs, playlists, settings] = await Promise.all([getAllSongs(), getAllPlaylists(), getAllSettings()]);
    // Remove demo records left by an earlier Listen build: this release ships no sample audio.
    const oldSampleIds = new Set(songs.filter((song) => song.isDemo || String(song.id).startsWith('demo-') || String(song.sourceKey || '').startsWith('listen-demo:')).map((song) => song.id));
    if (oldSampleIds.size) {
      await Promise.all([...oldSampleIds].map((id) => deleteSongAndMedia(id)));
      for (const playlist of playlists) {
        const originalIds = playlist.songIds || [];
        playlist.songIds = originalIds.filter((id) => !oldSampleIds.has(id));
        if (playlist.songIds.length !== originalIds.length) await putPlaylist(playlist);
      }
    }
    state.songs = songs.filter((song) => !oldSampleIds.has(song.id)).map((song) => ({
      ...song,
      genre: song.genre || 'Unknown genre', folder: song.folder || 'Uploads', bytes: song.bytes || 0,
      coverArt: Boolean(song.coverArt), downloaded: Boolean(song.downloaded), hasFile: Boolean(song.hasFile),
      liked: Boolean(song.liked), playCount: song.playCount || 0, lastPlayedAt: song.lastPlayedAt || 0,
    }));
    state.playlists = playlists.map((playlist) => ({ ...playlist, songIds: playlist.songIds || [], color: COLOR_OPTIONS.includes(playlist.color) ? playlist.color : COLOR_OPTIONS[0] }));
    state.prefs = { ...DEFAULT_PREFS, ...(settings.prefs || {}) };
    state.volume = Number.isFinite(state.prefs.volume) ? state.prefs.volume : DEFAULT_PREFS.volume;
    state.speed = Number.isFinite(state.prefs.speed) ? state.prefs.speed : 1;
    state.equalizer = state.prefs.equalizer || 'off';
    state.recentHistory = Array.isArray(settings.recentHistory) ? settings.recentHistory.filter((id) => state.songs.some((song) => song.id === id)).slice(0, 20) : [];
    audio.volume = state.volume;
    audio.playbackRate = state.speed;
    requestPersistentStorage();
    renderMain({ preserveScroll: false });
    refreshStorage();
    if (new URLSearchParams(location.search).get('view') === 'downloads') setView('downloads');
  } catch (error) {
    console.error(error);
    mainView.innerHTML = emptyState('Listen could not open local storage', 'This browser blocked IndexedDB. Try the latest Chrome or Firefox, and make sure this site is opened over HTTPS or localhost.', 'Reload Listen', 'reload-app', 'info');
    notify(error.message || 'Local storage is unavailable.', 'error', 6000);
  }
}

initialize();
