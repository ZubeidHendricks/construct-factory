// c3-builder: ergonomic authoring API over the c3-format model.
// A Game wraps an in-memory model and keeps the manifest's folder-tree
// name-lists, usedAddons, and sid/uid allocation in sync, so callers never
// hand-edit raw JSON.

import path from "node:path";
import { readFileSync } from "node:fs";
import * as c3 from "@construct-factory/c3-format";

const { schema } = c3;

const pad3 = (n) => String(n).padStart(3, "0");

// Deterministic short uniqueId (no Date.now/Math.random): base36 of a seed.
const projectUid = (seed) => (seed * 2654435761 % 1e13).toString(36);

export class Game {
  constructor(model) {
    this.model = model;
    this.ids = model.ids ?? new schema.Ids(1);
  }

  static create({ rootDir, name, viewportWidth, viewportHeight, seed = 1 }) {
    const dir = path.join(rootDir, slug(name));
    const model = c3.newProject({
      dir,
      name,
      uid: projectUid(seed),
      viewportWidth,
      viewportHeight,
      seed,
    });
    return new Game(model);
  }

  static async open(dir) {
    const model = await c3.readProject(dir);
    model.ids = model.ids ?? new schema.Ids(Math.floor(Date.now() % 1e6) + 1);
    return new Game(model);
  }

  /** Ensure an addon (plugin/behavior by key) is registered in usedAddons. */
  useAddon(key) {
    const d = schema.addonDescriptor(key);
    const have = this.model.manifest.usedAddons.some((a) => a.id === d.id && a.type === d.type);
    if (!have) this.model.manifest.usedAddons.push(d);
    return d;
  }

  addLayout({ name, width, height, withEventSheet = true, makeFirst = false } = {}) {
    name = name ?? `Layout ${this.model.manifest.layouts.items.length + 1}`;
    let eventSheetName = null;
    if (withEventSheet) eventSheetName = this.addEventSheet({ name: `${name} events` }).name;
    const layout = schema.layoutFile({ name, ids: this.ids, width, height, eventSheet: eventSheetName });
    this.model.layouts[name] = layout;
    pushItem(this.model.manifest.layouts, name);
    if (makeFirst || !this.model.manifest.firstLayout) this.model.manifest.firstLayout = name;
    return layout;
  }

  addEventSheet({ name } = {}) {
    name = name ?? `Event sheet ${this.model.manifest.eventSheets.items.length + 1}`;
    const es = schema.eventSheetFile({ name, ids: this.ids });
    this.model.eventSheets[name] = es;
    pushItem(this.model.manifest.eventSheets, name);
    return es;
  }

  /** Add a Text object (no image assets required). */
  addText({ name } = {}) {
    name = name ?? `Text${this.model.manifest.objectTypes.items.length + 1}`;
    this.useAddon("Text");
    const ot = schema.objectTypeText({ name, ids: this.ids });
    this.model.objectTypes[name] = ot;
    pushItem(this.model.manifest.objectTypes, name);
    return ot;
  }

  /**
   * Add a Sprite object with one animation. Real PNG image files are emitted
   * for every frame (provided via `images`, or generated solid-color
   * placeholders), so the sprite actually renders in Construct.
   * @param {object} o
   * @param {string} [o.name]
   * @param {number} [o.width=32]
   * @param {number} [o.height=32]
   * @param {string[]} [o.behaviors]   behavior keys, e.g. ["Platform","solid"]
   * @param {string[]} [o.images]      paths to PNG files, one per frame
   * @param {number[]} [o.color]       placeholder RGBA when no images given
   * @param {string} [o.animName="Default"]
   * @param {number} [o.speed=8]
   * @param {boolean} [o.isLooping]
   * @param {number} [o.originY=0.5]   1 = feet origin (platformers)
   */
  addSprite({ name, width = 32, height = 32, behaviors = [], images = [], color, animName = "Default", speed = 8, isLooping = false, originY = 0.5 } = {}) {
    name = name ?? `Sprite${this.model.manifest.objectTypes.items.length + 1}`;
    this.useAddon("Sprite");

    const sources = images.length ? images : [null]; // at least one frame
    const animSlug = slug(animName) || "default";
    const frames = sources.map((imgPath, i) => {
      const rel = `images/${slug(name)}-${animSlug}-${pad3(i)}.png`;
      const data = imgPath ? readFileSync(imgPath) : c3.solidPng(width, height, color);
      this.model.assets = this.model.assets ?? [];
      this.model.assets.push({ rel, data });
      return schema.frame({ width, height, imageSpriteId: this.ids.sid(), originY });
    });

    const ot = schema.objectTypeSprite({ name, ids: this.ids, frames, animName, speed, isLooping });
    for (const b of behaviors) {
      this.useAddon(b);
      ot.behaviorTypes.push(schema.behaviorType({ behaviorId: b, name: b, ids: this.ids }));
    }
    this.model.objectTypes[name] = ot;
    pushItem(this.model.manifest.objectTypes, name);
    return ot;
  }

  /** Append a conditions->actions block to an event sheet (by name). */
  addEvent({ eventSheet, conditions = [], actions = [] }) {
    const es = this.model.eventSheets[eventSheet];
    if (!es) throw new Error(`unknown event sheet: ${eventSheet}`);
    const blk = schema.block({
      ids: this.ids,
      conditions: conditions.map((c) => schema.condition({ ...c, ids: this.ids })),
      actions: actions.map((a) => schema.action({ ...a, ids: this.ids })),
    });
    es.events.push(blk);
    return blk;
  }

  /** Place an object instance onto a layout's first layer. */
  placeInstance({ layout, object, x, y, width, height, properties } = {}) {
    const l = this.model.layouts[layout];
    if (!l) throw new Error(`unknown layout: ${layout}`);
    if (!this.model.objectTypes[object]) throw new Error(`unknown object: ${object}`);
    const inst = schema.instance({ type: object, ids: this.ids, x, y, width, height, properties });
    l.layers[0].instances.push(inst);
    return inst;
  }

  // --- Level editing on an opened (cloned) project --------------------------
  // These operate on real instance JSON already in the model, so they work
  // reliably on cloned reference projects without relying on schema.js shapes.

  _layout(name) {
    const l = this.model.layouts[name];
    if (!l) throw new Error(`unknown layout: ${name}`);
    return l;
  }

  /** Names of the layouts in this project. */
  listLayouts() {
    return Object.keys(this.model.layouts);
  }

  /** Names of the object types in this project. */
  listObjectTypes() {
    return Object.keys(this.model.objectTypes);
  }

  /** Every placed instance across all layers of a layout. */
  listInstances(layout) {
    const out = [];
    for (const layer of this._layout(layout).layers ?? [])
      for (const inst of layer.instances ?? [])
        out.push({ uid: inst.uid, type: inst.type, layer: layer.name, x: inst.world?.x, y: inst.world?.y });
    return out;
  }

  _findInstance(layout, uid) {
    for (const layer of this._layout(layout).layers ?? []) {
      const inst = (layer.instances ?? []).find((i) => i.uid === uid);
      if (inst) return { layer, inst };
    }
    throw new Error(`no instance uid=${uid} on layout "${layout}"`);
  }

  _nextUid(layout) {
    let max = -1;
    for (const layer of this._layout(layout).layers ?? [])
      for (const i of layer.instances ?? []) if (typeof i.uid === "number") max = Math.max(max, i.uid);
    return max + 1;
  }

  /** Reposition an existing instance. */
  moveInstance({ layout, uid, x, y }) {
    const { inst } = this._findInstance(layout, uid);
    if (x != null) inst.world.x = x;
    if (y != null) inst.world.y = y;
    return inst;
  }

  /** Duplicate an existing instance (verified JSON) at a new position. */
  duplicateInstance({ layout, uid, x, y }) {
    const { layer, inst } = this._findInstance(layout, uid);
    const copy = JSON.parse(JSON.stringify(inst));
    copy.uid = this._nextUid(layout);
    if (copy.sid != null) copy.sid = this.ids.sid();
    if (x != null) copy.world.x = x;
    if (y != null) copy.world.y = y;
    layer.instances.push(copy);
    return copy;
  }

  /** Relative paths of asset files in the project (default: images/). */
  listAssets(prefix = "images/") {
    return (this.model.assets ?? []).map((a) => a.rel).filter((r) => r.startsWith(prefix));
  }

  /** Swap a project asset file (e.g. "images/player-walk-000.png") for an
   *  external file on disk; the new bytes are written on save(). */
  replaceAsset({ rel, file }) {
    if (!this.model.assets?.some((a) => a.rel === rel))
      throw new Error(`no asset "${rel}" in project (run listAssets)`);
    this.model.assets = this.model.assets.map((a) =>
      a.rel === rel ? { rel, src: path.resolve(file) } : a
    );
    return rel;
  }

  validate() {
    return c3.validateModel(this.model);
  }

  async save() {
    return c3.writeProject(this.model);
  }

  get dir() {
    return this.model.dir;
  }
}

const pushItem = (tree, name) => {
  if (!tree.items.includes(name)) tree.items.push(name);
};

export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
