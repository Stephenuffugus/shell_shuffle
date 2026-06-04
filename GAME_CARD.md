# GAME_CARD — Shell Shuffle

## At a glance
- **One-line hook:** Watch the cups, find the ball, build a daily streak.
- **Genre / vibe:** Cozy arcade timing / memory guessing game
- **Core loop:** The ball is shown under one cup, the cups shuffle, and the player taps the cup they think hides it.
- **Status:** working
- **Live URL:** none yet — deploy-ready web build in `web/` (target: GitHub Pages `/web`, Netlify Drop, or Vercel; see `web/README.md`)
- **Repo:** Stephenuffugus/shell_shuffle

## What works / what's missing
- **Works:**
  - Full shell-game loop: watch → shuffle (animated CSS transforms) → guess, with difficulty scaling (more cups + faster shuffle per level, capped at 6 cups).
  - Cosmetic shop: 70 cups + 21 balls / 20 eggs / 5 figures, bought with coins.
  - Daily/weekly streak retention system: daily claim with escalating 7-day coin cycle, 1-day grace, weekly goal, and 6 streak-only exclusive unlocks.
  - Real persistence via `localStorage`, installable PWA (manifest + service worker, offline shell cache), and a Web Notifications streak-reminder flow.
- **Missing / known issues:**
  - True background "your streak is at risk" reminders need native local notifications (Capacitor, phase 2) — web reminders only fire while the page/SW is alive.
  - Single 600 KB+ HTML file with base64 art inline (no build step, no asset pipeline, no module split) — known tech debt, intentionally deferred.
  - Not yet deployed to a public URL.

## Tech
- **Stack:** Vanilla HTML/CSS/JS, single self-contained file (no framework)
- **Build step:** none
- **Entry point:** `web/index.html`
- **Controls:** Mouse / touch (tap a cup; tap buttons for shop, daily, pause)

## Existing economy
- **In-game score / currency:** Coins (earned on correct guesses + daily/weekly streak rewards), spent on cosmetic cups and hidden objects. Streak-only exclusives (figures + Champion Cup) cannot be bought — only unlocked by streak milestones.
- **What sunbeams were mapped onto:** Each correct guess (round complete / level up) and each daily streak claim. These sit alongside coins — coins, unlocks, and save data are unchanged.

## Persistence today
- **Storage:** `localStorage` (async `Store` layer, shaped to drop onto `@capacitor/preferences` later). Service worker caches the app shell for offline.
- **Auth:** none
- **Single-domain check:** would this game work served at `lucidwinds.com/shell-shuffle/`? **Yes.** All paths are relative — `index.html` has no root-relative (`/…`) references, the manifest uses `start_url: "./"` / `scope: "./"` with relative icon paths, the service worker is registered as `sw.js` and caches `['./','index.html','manifest.webmanifest','icons/…']`, and the Sunbeam SDK loads from an absolute `https://` URL. No leading-slash paths to break under a subpath deploy.

## Art / media for the studio portal
- **Storefront image:** none
- **Screenshot:** none
- **GIF / video:** none

  (Game art is inline base64 cup/ball/figure sprites; there is no standalone 1:1 portal tile. The studio can commission a 512×512 PNG.)

## Sunbeam wiring (the exact wiring you shipped)
- **gameId:** `shell-shuffle`
- **Earn events:**
  | Trigger (in code) | amount | source label |
  |---|---|---|
  | Correct guess in `round()` — round complete / level up (`web/index.html`, after the win `save()`) | 3 | `shell-shuffle:level_complete` |
  | Daily streak claim in `claimDaily()` (`web/index.html`, after `state.coins+=coins`) | 5 | `shell-shuffle:daily` |

  Calibration: a casual session (one daily claim + ~6–12 correct rounds) yields roughly 23–41 sunbeams, inside the 20–60 studio target. Each call is wrapped `if(window.Sunbeam) … .catch(function(){})` so a blocked SDK never throws. No loops, intervals, or per-frame earns.
