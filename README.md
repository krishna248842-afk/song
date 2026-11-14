# Listen

**Listen** is a private, installable music player for Android and desktop. It keeps your library in the browser's IndexedDB, plays local audio with the HTML5 audio element, and does not use accounts, analytics, music APIs, or external audio services.

## Project structure

```text
listen/
├── index.html                    # Web app shell, navigation, audio element, and file pickers
├── styles.css                    # Responsive dark theme and player/library UI
├── package.json                  # Vite, Capacitor, and build scripts
├── package-lock.json             # Locked npm dependency versions
├── vite.config.js                # Relative asset paths for GitHub Pages
├── capacitor.config.json         # Native app ID, name, and web asset directory
├── android/                      # Capacitor Android Studio project and Gradle wrapper
├── public/
│   ├── manifest.webmanifest      # Installable PWA metadata
│   ├── sw.js                     # Offline app-shell cache
│   └── icons/                    # PWA icons
├── src/
│   ├── app.js                    # UI, imports, playback, playlists, queue, settings
│   ├── db.js                     # IndexedDB persistence
│   ├── metadata.js               # ID3 tags, cover thumbnails, duration, and LRC parsing
│   └── zip.js                    # ZIP library backup exporter
└── .github/workflows/
    ├── deploy.yml                # GitHub Pages deployment
    └── android-apk.yml           # Builds and uploads a sideloadable APK
```

## Run locally

Use Node.js 20 or newer. From this folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). For a production build:

```bash
npm run build
npm run preview
```

The built site is written to `dist/`. The app uses no runtime API keys or third-party JavaScript/CDN dependencies.

## Add and manage music

- Open **Your library → Add files** to select multiple MP3s (other common browser-supported audio formats are accepted too).
- Choose **Import folder** to select a whole folder on browsers that support folder picking, or drag and drop multiple audio files into Listen.
- Listen reads common ID3v1 and ID3v2 title, artist, album, genre, and embedded APIC cover tags. Cover art is resized to a 420px WebP thumbnail when the browser supports conversion. Duration comes from browser audio metadata.
- To attach synced lyrics, include a `.lrc` file with the same filename stem and folder as its song when importing. Untimed text lines are also displayed.
- Songs you import are written to IndexedDB immediately, so they remain playable offline after the tab is closed. The download action pins a song in the **Downloads** view; it does not create a wasteful second copy of an already-local upload. Removing a stored download frees the audio bytes; its library metadata stays until you delete the song or relink the original file.
- Make playlists from the sidebar **+** or the Library. Use the heart to add tracks to the automatic **Liked Songs** collection. Playlist cards offer play and download actions; playlist and album detail pages also include **Download all**.
- Listen ships with **no demo or sample tracks**. The library starts empty; add your own audio files to play music.

## Install on Android

1. Deploy Listen to an HTTPS address (or open it on your development machine via localhost).
2. Open the site in Chrome on Android and wait for the page to finish loading once so the app shell can be cached.
3. Tap **Install app** if it appears, or open Chrome's ⋮ menu and choose **Install app** / **Add to Home screen**.
4. Launch **Listen** from the new home-screen icon. Imported songs are available offline from that same browser profile and site origin.

The app requests persistent browser storage when supported. Android/browser storage is still finite and can be cleared by device settings; it is not a substitute for a separate backup. The storage view shows Listen's media size and the browser's estimated origin quota, and warns when the estimate reaches 95%.

## Native Android APK

Listen includes a Capacitor Android wrapper in `android/` (package ID `com.listen.personal`, app label **Listen**). To build locally you need Node.js 22, JDK 21, Android SDK Platform 36, and Build Tools 36.0.0:

```bash
npm ci
npm run android:apk
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. Install it with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, or copy the APK to your Android phone, allow installs from that file source, and tap it. Debug APKs are for direct sideloading/testing, not Google Play release signing.

The **Build Listen Android APK** GitHub Actions workflow also runs on pushes to `main` and `arena/*`; download the `Listen-Android-APK` artifact from that workflow run. It packages the web app into the APK, so the installed player does not need a hosted website.

## Backup

Open **Downloads → Export library ZIP**. The archive contains original audio, available artwork, lyrics, playlists, and a JSON metadata manifest. Chromium browsers with the File System Access API stream the ZIP directly to the chosen file, avoiding a second full-library copy in memory. Other browsers download a generated ZIP Blob; for very large libraries, use a browser/device with the file picker. The ZIP uses the standard non-compressed “store” method to preserve original audio and supports classic ZIP's 4 GB limit. The archive is an export; restoring it is currently done by extracting the audio and importing the files again.

## Deploy free

### GitHub Pages (included workflow)

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` (or run the **Deploy Listen to GitHub Pages** workflow from the Actions tab). The workflow installs dependencies, builds `dist/`, and publishes it to Pages.
4. Open the Pages URL on Android and install Listen as described above.

Vite is configured with relative asset URLs, so it works both at a root domain and a project URL such as `https://username.github.io/listen/`.

### Netlify

1. Run `npm run build` locally, or connect the GitHub repository in Netlify.
2. Set **Build command** to `npm run build` and **Publish directory** to `dist`.
3. Deploy, open the HTTPS URL, and install Listen on Android.

## Notes

- Every library, setting, and playlist is per browser profile and per deployed origin. There is no account or cloud sync.
- The browser owns the real storage quota. Listen uses IndexedDB, requests persistence, and avoids loading all audio or cover blobs into memory during normal browsing. The song list is windowed for large libraries.
- Supported audio codecs depend on the browser. MP3 is the safest choice across Android browsers.
- The service worker precaches the built app shell and its JS/CSS on install; later same-origin app files are cached as requested. Your uploaded songs live separately in IndexedDB.
