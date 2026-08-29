// 生成扩展图标（16/48/128 + 商店用 512）：纯 Node 手写 PNG 编码，零依赖。
// 设计：纸底 + 墨色双框 + 旋转 -6° 的砖红"章"形（三行文字线），底部一条 mustard 压线。
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 色板（与系列一致） ----------
const PAPER = [242, 234, 217, 255];
const INK = [43, 43, 38, 255];
const BRICK = [181, 72, 42, 255];
const MUSTARD = [217, 164, 65, 255];

// 盖章中心旋转 -6°（屏幕坐标 y 向下），把点反旋转回章的局部坐标
const RAD = (6 * Math.PI) / 180;
const COS = Math.cos(RAD);
const SIN = Math.sin(RAD);
function stampLocal(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  return [dx * COS + dy * SIN, -dx * SIN + dy * COS];
}

// 三条"文字线"：[中心y, 半宽]
const BARS = [
  [-0.082, 0.2],
  [0, 0.155],
  [0.082, 0.11],
];

// 归一化坐标 [0,1] → 颜色
function colorAt(u, v, size) {
  const detail = size >= 32; // 小尺寸省略细节
  let col = PAPER;

  if (detail) {
    // mustard 压线
    if (v >= 0.815 && v <= 0.855 && u >= 0.14 && u <= 0.86) col = MUSTARD;
    // 内细框
    const inset = 0.095;
    const th = 0.016;
    const inOuterRing = u >= inset && u <= 1 - inset && v >= inset && v <= 1 - inset;
    const inInnerRect =
      u >= inset + th && u <= 1 - inset - th && v >= inset + th && v <= 1 - inset - th;
    if (inOuterRing && !inInnerRect) col = INK;
  }

  // 旋转的章：外环为砖红，内部画三条砖红"文字线"
  const [x, y] = stampLocal(u, v);
  const inStamp = Math.abs(x) <= 0.31 && Math.abs(y) <= 0.205;
  const inStampHole = Math.abs(x) < 0.275 && Math.abs(y) < 0.17;
  if (inStamp && !inStampHole) {
    col = BRICK;
  } else if (inStampHole) {
    for (const [dy, bx] of BARS) {
      if (Math.abs(x) <= bx && Math.abs(y - dy) <= 0.02) {
        col = BRICK;
        break;
      }
    }
  }

  // 外边框（墨色），最外层覆盖
  const t = size <= 20 ? 0.09 : 0.045;
  if (u <= t || u >= 1 - t || v <= t || v >= 1 - t) col = INK;
  return col;
}

function drawIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  const SS = 3; // 3x3 超采样抗锯齿
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const c = colorAt(u, v, size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      data[i] = Math.round(r / n);
      data[i + 1] = Math.round(g / n);
      data[i + 2] = Math.round(b / n);
      data[i + 3] = 255;
    }
  }
  return encodePng(size, size, data);
}

for (const size of [16, 48, 128, 512]) {
  const file = join(outDir, `icon${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`icon${size}.png  ✓`);
}
