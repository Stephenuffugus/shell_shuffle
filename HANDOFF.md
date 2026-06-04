# Shell Shuffle — Claude Code Handoff

A working, content-complete prototype of a cup-and-ball ("shell game") guessing game with a cosmetic shop and a daily/weekly **streak retention system**. This document is the kickoff brief for taking it from a single-file HTML prototype to a real, installable app with notifications.

---

## 1. Current status

- **Fully playable** prototype, single self-contained file: `prototype/shell-shuffle.html` (build 20, ~588 KB).
- **Content-complete catalog:** 70 cups, 21 balls, 20 eggs, 5 exclusive figures, 1 exclusive cup. See `assets/manifest.json`.
- **Retention system is built and verified:** daily streak, 1-day grace, weekly goal, escalating rewards, and 6 streak-only unlocks all work (simulated across day sequences).
- **The one missing piece is the whole reason to go native:** notifications. A static HTML file can't remind a player their streak is at risk. That is the highest-value next step.

To run the prototype today: open `prototype/shell-shuffle.html` in any modern browser. (Note: it persists state through a host-provided `window.storage` object that only exists in the original artifact host — see §4. In a plain browser it runs but won't save between sessions until storage is swapped out, which is task 1 below.)

---

## 2. Repository contents

```
shell-shuffle-handoff/
├─ HANDOFF.md                ← this file
├─ prototype/
│  └─ shell-shuffle.html     ← the working game (single file, build 20)
└─ assets/
   ├─ manifest.json          ← full catalog: every item, price, file, unlock rule
   ├─ cups/      (70 images — webp/svg)
   ├─ balls/     (image + svg balls; gradient balls are CSS, see manifest)
   ├─ eggs/      (20 images)
   └─ figures/   (5 exclusive figures + champion cup)
```

`manifest.json` is the source of truth for the catalog. Gradient balls (classic, ocean, emerald, etc.) have no image file — they're CSS gradients and the `css` string is in the manifest.

---

## 3. The game, briefly

Classic shell game. Cups lift to reveal which one hides the object, drop, shuffle (cups swap positions with animated CSS transforms), then the player taps the cup they think hides the object.

- Correct → coins + level up (each level adds a cup, capped at 6) and the shuffle speeds up.
- Wrong → drop back one level (not a full reset — softer failure).
- Coins buy cosmetic **cups** (the shells) and **hidden objects** (balls / eggs / figures).

---

## 4. Prototype architecture (what to refactor)

It's intentionally one file for portability. Key pieces, all inside one `<script>`:

- **Catalog:** `const CUPS = [...]`, `const BALLS = [...]` — currently base64 data-URIs inline. **These should become references to the `assets/` files** during the refactor.
- **Rendering:** `decorateBall(el, id)` (handles spheres vs. `egg:true` non-circular shapes via `background: contain`), `ballBg(id)` (CSS gradients), cup `<img>` rendering.
- **Game loop:** `round()` async loop, `layout()`/`applySizes()`/`applyTransforms()` for positioning, `swapDur()` (shuffle speed by level).
- **Shop:** `renderShop()`, `renderCups()` — already handle `locked:true` items (show "🔒 <req>" instead of a buy button).
- **State + persistence:** a single `state` object saved/loaded via `save()`/`load()`. **Persistence currently calls `window.storage` (a host API). This will not exist in a packaged app — swap it for `localStorage` (web) or `@capacitor/preferences` (native). This is task 1.**

### Known tech debt
- Single file → should be split into modules (catalog/data, render, game loop, shop, retention, storage).
- Base64 art inline → move to `assets/` and load by path (smaller bundle, cacheable).
- `window.storage` → real storage layer (see above).
- No build tooling, no tests, no asset pipeline.
- Repeated image re-compression has softened some art; re-export from originals if higher fidelity is wanted (originals are AI-generated sheets, not included here).

---

## 5. Retention system (the centerpiece — preserve this logic)

Constants and rules live near the top of the script and are mirrored in `manifest.json → retention`.

- **Daily streak:** claim once per calendar day. Coins cycle over 7 days: `[15, 20, 25, 30, 40, 50, 80]`, then repeats.
- **1-day grace:** missing a single day does NOT reset the streak (gap ≤ 2 days continues; ≥ 3 resets to 1). This is deliberate anti-churn — a single slip shouldn't punish a committed player.
- **Weekly goal:** play 5 days in a calendar week to bank the weekly reward and advance a week-over-week streak.
- **Streak-only unlocks (cannot be bought with coins):**
  | Item | Type | Unlock |
  |---|---|---|
  | Toy Car | figure | 3-day streak |
  | Rubber Duck | figure | 5 play-days in a week |
  | Toy Dino | figure | 7-day streak |
  | Toy Alien | figure | 14-day streak |
  | Robot | figure | 30-day streak |
  | Champion Cup | cup | hit weekly goal 2 weeks running |
- **Surfacing (also important):** a daily panel auto-opens once on a new day, a HUD badge shows when a reward is claimable, the live 🔥 streak count is shown, and locked exclusives are teased in the shop with their requirement.

Why this shape: escalating rewards create loss aversion (each extra day is worth more), exclusivity gives a reason to return daily even when rich in coins, and tiered milestones always give both a near-term and a long-term goal.

---

## 6. Recommended path to a real app + notifications

**Goal:** keep the existing web codebase, ship to iOS/Android, and add streak reminders.

### Key insight: streak reminders are LOCAL notifications, not server push
A "your streak is at risk — play today!" reminder is scheduled on-device for a set time. It needs **no backend**. Use **local notifications**. Reserve server push (FCM/APNs) for later, optional things like live-event announcements.

### Recommended stack: Capacitor (reuses this web code)
1. Wrap the web app with **[Capacitor](https://capacitorjs.com/)** — it runs the existing HTML/JS/CSS inside a native shell for iOS and Android. Least rework, fastest path.
2. Add **[`@capacitor/local-notifications`](https://capacitorjs.com/docs/apis/local-notifications)** for streak reminders.
3. Add **[`@capacitor/preferences`](https://capacitorjs.com/docs/apis/preferences)** to replace `window.storage`.
4. (Optional, later) **[`@capacitor/push-notifications`](https://capacitorjs.com/docs/apis/push-notifications)** + FCM for server-driven events.

### Notification logic to implement
- On app open and after each daily claim, (re)schedule a local notification for the next day (e.g., 7 pm local).
- Wording tied to state: if a streak is active, lead with what's at stake ("Keep your 12-day streak alive 🔥"). If they're 1 day from an unlock, say so ("1 more day for the Toy Dino!").
- Respect the 1-day grace: a reminder on the grace day is especially valuable.
- Ask for notification permission at a smart moment (after the first claim, not on cold launch).

### Alternative: PWA
If you'd rather stay web-only, ship as an installable PWA. Web Push works on Android/desktop and on iOS 16.4+ **only for installed PWAs**, and is less reliable than native local notifications for daily reminders. Capacitor is the stronger choice for a retention-driven game.

---

## 7. Suggested first milestone for Claude Code

1. **Storage layer**: replace `window.storage` calls with an abstraction backed by `localStorage` (web) / `@capacitor/preferences` (native). Verify save/load round-trips.
2. **Project scaffolding**: split the single file into modules; wire a minimal bundler (Vite is fine); move art to `assets/` and load by path.
3. **Capacitor init**: add iOS + Android platforms, app icon/splash, bundle id.
4. **Local notifications**: permission flow + the scheduling logic in §6. This is the retention payoff — do it early.
5. **QA the streak math on-device** across real date changes and timezone edges (the prototype uses local calendar dates).

## 8. Design backlog (optional enhancements)
- **Streak insurance**: spend coins to protect the streak through one extra missed day.
- **Variable/surprise bonus**: occasional larger daily reward to add a dopamine spike.
- **Seasonal/event unlocks**: time-limited exclusives (great fit for the egg/figure system already in place).
- **Leaderboard / best-streak sharing**: social proof and competition.

---

*Prototype build 20. Catalog and retention logic verified. The single highest-leverage next step is local notifications for streak reminders — everything else is scaffolding around that.*
