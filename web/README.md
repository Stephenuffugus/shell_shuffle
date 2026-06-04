# Shell Shuffle — Web build (validation phase)

This folder is the **deployable web version** of Shell Shuffle. It's the same single-file
game Penny built, with three production changes layered on:

1. **Real persistence** — `window.storage` (a host-only API) swapped for a small async
   `Store` layer backed by `localStorage`. Shaped so it drops onto
   `@capacitor/preferences` unchanged when we go native.
2. **Installable PWA** — `manifest.webmanifest` + `sw.js` (service worker) + app icons.
   Players can "Add to Home Screen" and launch it like an app, online or offline.
3. **Streak reminders** — Web Notifications permission flow + state-driven reminder copy
   (leads with what's at stake: "1 more day for the Toy Dino!"). The on-device schedule
   lives in `state.daily.nextReminderAt`, the exact field Capacitor's local-notifications
   will read in phase 2.

## Files
```
web/
├─ index.html              ← the game (self-contained; base64 art still inline)
├─ manifest.webmanifest    ← PWA metadata
├─ sw.js                   ← service worker (network-first page, offline fallback, notif clicks)
├─ icons/                  ← generated PNG app icons (any + maskable)
│  └─ gen-icons.cjs        ← regenerates the icons (pure Node, no deps): `node gen-icons.cjs`
├─ smoke.mjs              ← Playwright browser smoke test (see below)
└─ README.md
```

## Run locally
```bash
cd web && python3 -m http.server 8099
# open http://localhost:8099
```
A service worker + notifications need a **secure context**: `localhost` counts, and any
HTTPS host counts. Plain `http://<ip>` will not register the SW.

## Deploy (pick one — all free)
- **Netlify Drop** — drag the `web/` folder onto https://app.netlify.com/drop. Instant HTTPS URL.
- **Vercel** — `npx vercel web --prod`.
- **GitHub Pages** — push and point Pages at `/web`.

That HTTPS URL is what we text to the first 10–20 testers.

## Test
```bash
cd web
npm i -D playwright && npx playwright install --with-deps chromium   # one-time
python3 -m http.server 8099 &                                        # serve
node smoke.mjs                                                        # assert save-on-reload etc.
```
Note: `chrome-headless-shell` reports `Notification.permission` as `denied` regardless of
grants, so the *display* of notifications can't be asserted headlessly — verify that path
on a real phone/desktop. The scheduling math, persistence, SW registration, and daily-claim
flow are all covered by the smoke test.

## Known web limitation (the reason native is phase 2)
Web notifications only fire while the page or its service worker is alive. True background
"your streak dies tonight" delivery when the app is fully closed requires **native local
notifications** (Capacitor). This build validates the *loop* — permission, wording, schedule,
retention pull — cheaply, before we spend on app-store accounts. Gate that spend on whether
D1 retention shows up here first.
