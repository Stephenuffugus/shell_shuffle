// Real-browser smoke test: boots the game, claims the daily, reloads, asserts state persisted.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8099/';
const errs = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ permissions: [] }); // don't auto-grant notifications
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

function assert(cond, msg) { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + msg); if (!cond) process.exitCode = 1; }

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800); // let init IIFE + daily auto-open run

// 1) Page booted, key HUD present
const hasCoins = await page.$('#coins');
assert(!!hasCoins, 'HUD rendered (#coins exists)');

// 2) Service worker registered
const swReg = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  const r = await navigator.serviceWorker.getRegistration();
  return !!r;
});
assert(swReg, 'service worker registered');

// 3) Daily panel auto-opened on first run, claim the reward
await page.waitForSelector('#daily.open', { timeout: 3000 }).catch(() => {});
const dailyOpen = await page.$('#daily.open');
assert(!!dailyOpen, 'daily panel auto-opened on first launch');
await page.click('#claimBtn');
await page.waitForTimeout(300);

// 4) Read in-memory + persisted state
const afterClaim = await page.evaluate(() => {
  const raw = localStorage.getItem('shellshuffle:v1');
  return { raw, parsed: raw ? JSON.parse(raw) : null };
});
assert(afterClaim.raw && afterClaim.parsed, 'state written to localStorage after claim');
assert(afterClaim.parsed.coins > 0, 'coins persisted after claim (got ' + (afterClaim.parsed && afterClaim.parsed.coins) + ')');
assert(afterClaim.parsed.daily.streak === 1, 'streak = 1 after first claim');
assert(typeof afterClaim.parsed.daily.nextReminderAt !== 'undefined', 'nextReminderAt field present in saved state');
const coins = afterClaim.parsed.coins;

// 5) THE CORE UNBLOCK: reload and confirm coins survive
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => {
  const raw = localStorage.getItem('shellshuffle:v1');
  const p = raw ? JSON.parse(raw) : null;
  return { coinsHud: document.getElementById('coins')?.textContent, persistedCoins: p?.coins, streak: p?.daily?.streak };
});
assert(String(afterReload.persistedCoins) === String(coins), 'coins survive reload (was ' + coins + ', now ' + afterReload.persistedCoins + ')');
assert(afterReload.streak === 1, 'streak survives reload');

// 6) Reminder wording engine produces state-driven copy (sanity on the function via evaluate)
//    (function is module-scoped; verify the schedule field instead, already checked.)

console.log('\nuncaught JS errors during run: ' + errs.length);
errs.forEach((e) => console.log('  ' + e));
if (errs.length) process.exitCode = 1;

await browser.close();
