// .c3p <-> project-folder conversion.
// A .c3p file is just a ZIP archive of the project-folder contents. On macOS we
// shell out to the system `zip`/`unzip` (zero npm deps). Use these when it's
// easier to hand over a single .c3p than a folder.

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

const run = promisify(execFile);

/** Unpack a .c3p into a project folder. Returns the output dir. */
export async function unpackC3p(c3pPath, outDir) {
  const abs = path.resolve(outDir);
  await fs.mkdir(abs, { recursive: true });
  // -o overwrite, -q quiet
  await run("unzip", ["-o", "-q", path.resolve(c3pPath), "-d", abs]);
  // Some .c3p archives store entries with Windows-style "\" separators, which
  // unzip turns into literal backslashes in filenames. Normalize to real dirs.
  await normalizeBackslashPaths(abs);
  return outDir;
}

async function normalizeBackslashPaths(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) await normalizeBackslashPaths(path.join(root, e.name));
    else if (e.name.includes("\\")) {
      const dest = path.join(root, ...e.name.split("\\"));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(path.join(root, e.name), dest);
    }
  }
}

/**
 * Pack a project folder into a .c3p file. Returns the .c3p path.
 *
 * Written as a minimal ZIP encoder (no shell zip): Construct's loader expects
 * project.c3proj as the FIRST archive entry and chokes on the directory
 * entries `zip -r` emits. Files are deflated, names use forward slashes, junk
 * files (.DS_Store, AppleDouble) are excluded.
 */
export async function packC3p(folderDir, c3pPath) {
  const abs = path.resolve(c3pPath);
  const root = path.resolve(folderDir);

  // collect files: project.c3proj first, then the rest sorted
  const files = [];
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name === ".DS_Store" || e.name.startsWith("._")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  await walk(root);
  files.sort((a, b) => (a === "project.c3proj" ? -1 : b === "project.c3proj" ? 1 : a < b ? -1 : 1));

  const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1; // fixed date: deterministic output
  const locals = [], centrals = [];
  let offset = 0;
  for (const name of files) {
    const data = await fs.readFile(path.join(root, ...name.split("/")));
    const deflated = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(DOS_DATE, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    locals.push(local, nameBuf, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // bytes 30-41: extra/comment/disk/attrs all zero
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + deflated.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16); // central directory start
  await fs.rm(abs, { force: true });
  await fs.writeFile(abs, Buffer.concat([...locals, centralBuf, eocd]));
  return abs;
}

// Standard CRC-32, table built once.
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
