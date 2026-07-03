// Minimal PNG encoder — solid RGBA rectangles, zero npm deps (Node zlib only).
// Used so the factory can emit real image files for sprites built from scratch,
// instead of referencing image ids that point at nothing.

import zlib from "node:zlib";

// Standard CRC-32 (PNG polynomial), table built once.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Read width/height from a PNG buffer's IHDR (throws if not a PNG). */
export function pngSize(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) throw new Error("not a PNG file");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Encode a horizontal-strip tileset PNG: tile 0 is fully transparent (the
 * "empty" tile in tilemap data), followed by one solid-color tile per entry.
 * @param {number} tileW
 * @param {number} tileH
 * @param {Array<[number,number,number,number]>} colors  RGBA per tile (1..N)
 * @returns {Buffer}
 */
export function tilesetPng(tileW, tileH, colors) {
  const tiles = [[0, 0, 0, 0], ...colors];
  const width = tileW * tiles.length;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * tileH);
  for (let y = 0; y < tileH; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let t = 0; t < tiles.length; t++) {
      const [r, g, b, a] = tiles[t];
      for (let x = 0; x < tileW; x++) {
        const p = rowStart + 1 + (t * tileW + x) * 4;
        raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = a;
      }
    }
  }
  return encodePng(width, tileH, raw);
}

/**
 * Encode a solid-color RGBA PNG of the given size.
 * @param {number} width
 * @param {number} height
 * @param {[number,number,number,number]} rgba  0-255 each (default soft blue)
 * @returns {Buffer}
 */
export function solidPng(width, height, rgba = [120, 130, 200, 255]) {
  const [r, g, b, a] = rgba;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height); // +1 filter byte per row
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (none)
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 4;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }
  return encodePng(width, height, raw);
}

// Assemble a PNG from pre-filtered raw scanline data (RGBA, filter byte 0/row).
function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  // bytes 10-12 default 0 (deflate/adaptive/no-interlace)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
