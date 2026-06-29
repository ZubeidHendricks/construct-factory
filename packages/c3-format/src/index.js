// c3-format: low-level read/write/validate of a Construct 3 project folder.
// Knows where files live on disk; defers field shapes to schema.js.

import { promises as fs } from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export { unpackC3p, packC3p } from "./c3p.js";

const SUBDIRS = ["layouts", "eventSheets", "objectTypes", "families", "images"];

// Item dirs whose *.json files we parse into the model. Everything else under
// the project folder (images, icons, *.uistate.json, timelines, flowcharts,
// tilemapBrushes, …) is carried verbatim as an opaque asset so that reading a
// real project and writing it back out elsewhere stays lossless.
const ITEM_DIRS = ["layouts", "eventSheets", "objectTypes", "families"];

const readJson = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const writeJson = async (p, obj) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, "\t") + "\n");
};

// Recursively list every file under `dir`, returned as paths relative to `dir`
// (POSIX separators). Returns [] if the dir does not exist.
async function walkFiles(dir, base = dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

// Is this relative path a modeled item file (parsed into a bag), as opposed to
// an opaque asset we pass through untouched?
const isModeledItem = (rel) => {
  const parts = rel.split("/");
  if (!ITEM_DIRS.includes(parts[0])) return false;
  if (parts.includes("uistate")) return false;
  const base = parts[parts.length - 1];
  return base.endsWith(".json") && !isEditorState(base);
};

// Flatten a Construct folder-tree ({items, subfolders:[{...,name}]}) to a flat
// list of item names. Items may be strings (object/layout names) or file
// descriptors ({name}); we only need names here.
export function flattenNames(tree) {
  if (!tree) return [];
  const out = [...(tree.items ?? []).map((i) => (typeof i === "string" ? i : i.name))];
  for (const sf of tree.subfolders ?? []) out.push(...flattenNames(sf));
  return out;
}

// Editor-state files live alongside items but are not items themselves
// (*.uistate.json, *.instancesBar.json, and anything under a uistate/ dir).
const isEditorState = (name) =>
  name.endsWith(".uistate.json") || name.endsWith(".instancesBar.json");

// Recursively collect *.json item files under a dir, skipping editor state.
async function readItemDir(dir) {
  const out = {};
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "uistate") continue; // pure editor state -> passthrough asset
      Object.assign(out, await readItemDir(full));
    } else if (e.name.endsWith(".json") && !isEditorState(e.name))
      out[path.basename(e.name, ".json")] = await readJson(full);
  }
  return out;
}

/** Read an entire project folder into an in-memory model. */
export async function readProject(dir) {
  const manifest = await readJson(path.join(dir, "project.c3proj"));
  // Every file that is neither the manifest nor a modeled item is preserved
  // verbatim (images, icons, uistate, timelines, brushes, …) as a source path.
  const assets = (await walkFiles(dir))
    .filter((rel) => rel !== "project.c3proj" && !isModeledItem(rel))
    .map((rel) => ({ rel, src: path.join(dir, ...rel.split("/")) }));
  return {
    dir,
    manifest,
    layouts: await readItemDir(path.join(dir, "layouts")),
    eventSheets: await readItemDir(path.join(dir, "eventSheets")),
    objectTypes: await readItemDir(path.join(dir, "objectTypes")),
    families: await readItemDir(path.join(dir, "families")),
    assets,
  };
}

/** Write an in-memory model back out to a project folder (flat item layout). */
export async function writeProject(model) {
  const { dir } = model;
  await fs.mkdir(dir, { recursive: true });
  for (const sub of SUBDIRS) await fs.mkdir(path.join(dir, sub), { recursive: true });
  await writeJson(path.join(dir, "project.c3proj"), model.manifest);
  for (const [name, body] of Object.entries(model.layouts))
    await writeJson(path.join(dir, "layouts", `${name}.json`), body);
  for (const [name, body] of Object.entries(model.eventSheets))
    await writeJson(path.join(dir, "eventSheets", `${name}.json`), body);
  for (const [name, body] of Object.entries(model.objectTypes))
    await writeJson(path.join(dir, "objectTypes", `${name}.json`), body);
  for (const [name, body] of Object.entries(model.families ?? {}))
    await writeJson(path.join(dir, "families", `${name}.json`), body);
  // Copy preserved assets verbatim. Skip when the source already lives at the
  // destination path (in-place save) to avoid copying a file onto itself.
  for (const { rel, src } of model.assets ?? []) {
    const dest = path.join(dir, ...rel.split("/"));
    if (path.resolve(src) === path.resolve(dest)) continue;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  return dir;
}

/**
 * Clone an existing project folder to a new location and (optionally) rename it.
 * Pure filesystem copy — preserves every byte of the source (images, effects,
 * timelines, …), then rewrites the manifest's name/uniqueId. This is how the
 * factory stamps out new games from a verified reference project.
 */
export async function cloneProject(srcDir, destDir, { name, uid } = {}) {
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.cp(srcDir, destDir, { recursive: true });
  const manifestPath = path.join(destDir, "project.c3proj");
  const manifest = await readJson(manifestPath);
  if (name) manifest.name = name;
  if (uid) manifest.uniqueId = uid;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
  return destDir;
}

/** Cheap structural validation. Returns { ok, errors[] }. Not a full schema check. */
export function validateModel(model) {
  const errors = [];
  const m = model.manifest ?? {};
  if (!m.name) errors.push("manifest.name missing");
  if (m.runtime !== "c3") errors.push(`runtime should be "c3"`);
  if (m.projectFormatVersion !== 1) errors.push("projectFormatVersion should be 1");
  const check = (treeKey, bag, label) => {
    for (const name of flattenNames(m[treeKey]))
      if (!bag[name]) errors.push(`${label} "${name}" listed in manifest but no file`);
  };
  check("layouts", model.layouts, "layout");
  check("eventSheets", model.eventSheets, "eventSheet");
  check("objectTypes", model.objectTypes, "objectType");
  if (m.firstLayout && !model.layouts[m.firstLayout])
    errors.push(`firstLayout "${m.firstLayout}" has no layout file`);
  return { ok: errors.length === 0, errors };
}

/** Build a fresh, empty in-memory model with an Ids allocator. */
export function newProject({ dir, name, uid, viewportWidth, viewportHeight, seed = 1 }) {
  return {
    dir,
    ids: new schema.Ids(seed),
    manifest: schema.projectManifest({ name, uid, viewportWidth, viewportHeight }),
    layouts: {},
    eventSheets: {},
    objectTypes: {},
    families: {},
    assets: [],
  };
}
