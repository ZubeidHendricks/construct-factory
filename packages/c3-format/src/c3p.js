// .c3p <-> project-folder conversion.
// A .c3p file is just a ZIP archive of the project-folder contents. On macOS we
// shell out to the system `zip`/`unzip` (zero npm deps). Use these when it's
// easier to hand over a single .c3p than a folder.

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

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

/** Pack a project folder into a .c3p file. Returns the .c3p path. */
export async function packC3p(folderDir, c3pPath) {
  const abs = path.resolve(c3pPath);
  await fs.rm(abs, { force: true }); // zip appends otherwise
  // -r recurse, -q quiet, -X no extra attrs; zip from inside the folder so
  // project.c3proj sits at the archive root (what Construct expects).
  await run("zip", ["-r", "-q", "-X", abs, "."], { cwd: path.resolve(folderDir) });
  return abs;
}
