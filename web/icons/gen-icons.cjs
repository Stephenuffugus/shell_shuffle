// Generates Shell Shuffle PNG app icons with zero dependencies (Node built-in zlib only).
// Draws the brand mark: a gold shell-game cup with a red ball peeking out, on the game's
// purple gradient. Supersampled 2x then box-downscaled for clean edges.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---- tiny PNG encoder (RGBA, 8-bit) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const body = Buffer.concat([tb, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing ----
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

// Render at size N (no AA); caller supersamples. Returns [r,g,b,a] for normalized coords.
function shade(u, v, maskable) {
  // u,v in [0,1]. Background gradient (full bleed).
  const bg = mix([0x2a, 0x16, 0x40], [0x4a, 0x1e, 0x52], clamp01(v));
  // soft top-left highlight
  const hl = Math.max(0, 1 - Math.hypot(u - 0.32, v - 0.26) * 1.15);
  let col = mix(bg, [0x6a, 0x33, 0x78], hl * 0.45);
  let a = 1;

  // Content placed inside a safe zone so maskable crops don't clip it.
  const safe = maskable ? 0.62 : 0.78; // fraction of canvas the artwork spans
  const cx = 0.5, cyTop = 0.5 - safe * 0.40, cyBot = 0.5 + safe * 0.34;
  const topHalf = safe * 0.30, botHalf = safe * 0.205;

  // Red ball peeking bottom-left from under the cup rim.
  const bx = cx - safe * 0.20, by = cyBot - safe * 0.02, br = safe * 0.135;
  const dBall = Math.hypot((u - bx), (v - by)) / br;
  if (dBall <= 1.0) {
    const sh = clamp01(1 - Math.hypot((u - (bx - br * 0.32)), (v - (by - br * 0.34))) / (br * 1.4));
    col = mix([0xc4, 0x2f, 0x33], [0xff, 0x9a, 0x8a], sh);
    a = 1;
    return [...col, a];
  }

  // Cup body: trapezoid wider at top, between cyTop and cyBot.
  if (v >= cyTop && v <= cyBot) {
    const t = (v - cyTop) / (cyBot - cyTop);
    const half = lerp(topHalf, botHalf, t);
    const dx = Math.abs(u - cx);
    if (dx <= half) {
      // horizontal shading across the cup for roundness + a vertical shine stripe
      const round = 1 - Math.pow(dx / half, 2) * 0.55;
      let cup = mix([0xc9, 0x86, 0x14], [0xff, 0xe0, 0x8a], clamp01(round - t * 0.18));
      const shine = Math.max(0, 1 - Math.abs(u - (cx - half * 0.35)) / (half * 0.18));
      cup = mix(cup, [0xff, 0xf3, 0xc0], shine * 0.5 * (1 - t * 0.4));
      return [...cup, 1];
    }
  }
  // Elliptical rim ring at the top of the cup (darker gold accent).
  const ry = safe * 0.055;
  const rdx = (u - cx) / topHalf, rdy = (v - cyTop) / ry;
  const rim = Math.hypot(rdx, rdy);
  if (rim <= 1.18 && rim >= 0.74 && v <= cyTop + ry) {
    return [0xd6, 0x99, 0x1c, 1];
  }
  return [...col, a];
}

function render(N, maskable) {
  const SS = 2, M = N * SS;
  const big = Buffer.alloc(M * M * 4);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const [r, g, b, a] = shade((x + 0.5) / M, (y + 0.5) / M, maskable);
    const i = (y * M + x) * 4;
    big[i] = Math.round(r); big[i + 1] = Math.round(g); big[i + 2] = Math.round(b); big[i + 3] = Math.round(a * 255);
  }
  // box downsample SSxSS -> 1
  const out = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, bl = 0, al = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const i = ((y * SS + dy) * M + (x * SS + dx)) * 4;
      r += big[i]; g += big[i + 1]; bl += big[i + 2]; al += big[i + 3];
    }
    const n = SS * SS, j = (y * N + x) * 4;
    out[j] = Math.round(r / n); out[j + 1] = Math.round(g / n); out[j + 2] = Math.round(bl / n); out[j + 3] = Math.round(al / n);
  }
  return encodePNG(N, N, out);
}

const dir = __dirname;
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-180.png', 180, false],
  ['icon-maskable-512.png', 512, true],
];
for (const [name, size, maskable] of targets) {
  fs.writeFileSync(path.join(dir, name), render(size, maskable));
  console.log('wrote', name, size + 'x' + size);
}
