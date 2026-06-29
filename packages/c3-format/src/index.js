// c3-format: low-level read/write/validate of a Construct 3 project folder.
// Knows where files live on disk; defers field shapes to schema.js.

import { promises as fs } from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export { unpackC3p, packC3p } from "./c3p.js";

const SUBDIRS = ["layouts", "eventSheets", "objectTypes", "families", "images"];

const readJson = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const writeJson = async (p, obj) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, "\t") + "\n");
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

const isUiState = (f) => f.endsWith(".uistate.json");

// Recursively collect *.json item files under a dir, skipping .uistate.json.
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
    if (e.isDirectory()) Object.assign(out, await readItemDir(full));
    else if (e.name.endsWith(".json") && !isUiState(e.name))
      out[path.basename(e.name, ".json")] = await readJson(full);
  }
  return out;
}

/** Read an entire project folder into an in-memory model. */
export async function readProject(dir) {
  const manifest = await readJson(path.join(dir, "project.c3proj"));
  return {
    dir,
    manifest,
    layouts: await readItemDir(path.join(dir, "layouts")),
    eventSheets: await readItemDir(path.join(dir, "eventSheets")),
    objectTypes: await readItemDir(path.join(dir, "objectTypes")),
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
  return dir;
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
  };
}
