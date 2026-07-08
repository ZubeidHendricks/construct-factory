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
  addSprite({ name, width = 32, height = 32, behaviors = [], images = [], color, animName = "Default", speed = 8, isLooping = false, originY = 0.5, animations } = {}) {
    name = name ?? `Sprite${this.model.manifest.objectTypes.items.length + 1}`;
    this.useAddon("Sprite");
    this.model.assets = this.model.assets ?? [];

    // Normalize to a list of animation specs. Single-anim callers pass
    // images/animName; multi-state callers pass `animations: [{name, images,
    // speed, isLooping}]`.
    const specs = animations ?? [{ name: animName, images, speed, isLooping }];
    const builtAnims = specs.map((a) => {
      const sources = (a.images && a.images.length) ? a.images : [null];
      const animSlug = slug(a.name) || "default";
      const frames = sources.map((imgPath, i) => {
        const rel = `images/${slug(name)}-${animSlug}-${pad3(i)}.png`;
        const data = imgPath ? readFileSync(imgPath) : c3.solidPng(width, height, color ?? a.color);
        const size = imgPath ? c3.pngSize(data) : { width, height };
        this.model.assets.push({ rel, data });
        return schema.frame({ width: size.width, height: size.height, imageSpriteId: this.ids.sid(), originY });
      });
      return { name: a.name, frames, speed: a.speed ?? 8, isLooping: a.isLooping ?? false };
    });

    const ot = schema.objectTypeSprite({ name, ids: this.ids, animations: builtAnims });
    for (const b of behaviors) {
      this.useAddon(b);
      ot.behaviorTypes.push(schema.behaviorType({ behaviorId: b, name: b, ids: this.ids }));
    }
    this.model.objectTypes[name] = ot;
    pushItem(this.model.manifest.objectTypes, name);
    return ot;
  }

  /**
   * Add a Tilemap object type. The tileset image comes from `image` (a PNG
   * whose dimensions are read from the file), or is generated as a strip of
   * solid-color tiles (tile 0 transparent = empty, then 1..N from `colors`).
   * @param {object} o
   * @param {string} [o.name]
   * @param {number} [o.tileWidth=16]
   * @param {number} [o.tileHeight=16]
   * @param {string} [o.image]        path to a tileset PNG
   * @param {Array}  [o.colors]       RGBA per generated tile when no image
   * @param {string[]} [o.behaviors]  e.g. ["solid"]
   */
  addTilemap({ name, tileWidth = 16, tileHeight = 16, image, colors = [[100, 180, 100, 255]], behaviors = [] } = {}) {
    name = name ?? `Tilemap${this.model.manifest.objectTypes.items.length + 1}`;
    this.useAddon("Tilemap");
    const data = image ? readFileSync(image) : c3.tilesetPng(tileWidth, tileHeight, colors);
    const { width, height } = c3.pngSize(data);
    const rel = `images/${slug(name)}.png`;
    this.model.assets = this.model.assets ?? [];
    this.model.assets.push({ rel, data });
    const ot = schema.objectTypeTilemap({ name, ids: this.ids, imageWidth: width, imageHeight: height, imageSpriteId: this.ids.sid() });
    for (const b of behaviors) {
      this.useAddon(b);
      ot.behaviorTypes.push(schema.behaviorType({ behaviorId: b, name: b, ids: this.ids }));
    }
    this.model.objectTypes[name] = ot;
    pushItem(this.model.manifest.objectTypes, name);
    return ot;
  }

  /**
   * Place a tilemap instance on a layout's first layer. `grid` is a row-major
   * 2D array of tile indices (0 = empty/transparent tile). If the tilemap
   * object type has the solid behavior, the instance enables it.
   */
  placeTilemap({ layout, object, grid, tileWidth = 16, tileHeight = 16, x = 0, y = 0 }) {
    const l = this.model.layouts[layout];
    if (!l) throw new Error(`unknown layout: ${layout}`);
    const ot = this.model.objectTypes[object];
    if (!ot) throw new Error(`unknown object: ${object}`);
    if (ot["plugin-id"] !== "Tilemap") throw new Error(`object "${object}" is not a Tilemap`);
    const behaviors = {};
    for (const b of ot.behaviorTypes ?? [])
      if (b.behaviorId === "solid") behaviors[b.name] = { properties: { enabled: true, tags: "" } };
    const inst = schema.tilemapInstance({ type: object, ids: this.ids, grid, tileWidth, tileHeight, x, y, behaviors });
    l.layers[0].instances.push(inst);
    return inst;
  }

  /**
   * Add a Family grouping existing object types (all must share pluginId).
   * Shape verified against a commercial RTS source (52 real family files).
   */
  addFamily({ name, members = [], pluginId = "Sprite", behaviors = [] } = {}) {
    name = name ?? `Family${(this.model.manifest.families.items ?? []).length + 1}`;
    for (const m of members)
      if (!this.model.objectTypes[m]) throw new Error(`family member "${m}" is not an object type`);
    const behaviorTypes = behaviors.map((b) => {
      this.useAddon(b);
      return schema.behaviorType({ behaviorId: b, name: b, ids: this.ids });
    });
    const fam = schema.familyFile({ name, ids: this.ids, pluginId, members, behaviorTypes });
    this.model.families = this.model.families ?? {};
    this.model.families[name] = fam;
    pushItem(this.model.manifest.families, name);
    return fam;
  }

  _sheet(name) {
    const es = this.model.eventSheets[name];
    if (!es) throw new Error(`unknown event sheet: ${name}`);
    return es;
  }

  /**
   * Append a conditions->actions block to an event sheet (by name).
   * Pass `group` (a group title) to append inside that group instead of at
   * sheet top level.
   */
  addEvent({ eventSheet, conditions = [], actions = [], group }) {
    const es = this._sheet(eventSheet);
    const blk = schema.block({
      ids: this.ids,
      conditions: conditions.map((c) => schema.condition({ ...c, ids: this.ids })),
      actions: actions.map((a) => schema.action({ ...a, ids: this.ids })),
    });
    let target = es.events;
    if (group) {
      const grp = es.events.find((e) => e.eventType === "group" && e.title === group);
      if (!grp) throw new Error(`no group "${group}" in sheet "${eventSheet}"`);
      target = grp.children;
    }
    target.push(blk);
    return blk;
  }

  /** Add a titled event group (organizes and can toggle a set of events). */
  addEventGroup({ eventSheet, title, isActiveOnStart = true }) {
    const es = this._sheet(eventSheet);
    const grp = schema.eventGroup({ title, ids: this.ids, isActiveOnStart });
    es.events.push(grp);
    return grp;
  }

  /** Add a sheet-level variable (number|string|boolean). */
  addEventVariable({ eventSheet, name, type = "number", initialValue = "0", isConstant = false, isStatic = false }) {
    const es = this._sheet(eventSheet);
    const v = schema.eventVariable({ name, ids: this.ids, type, initialValue, isConstant, isStatic });
    es.events.push(v);
    return v;
  }

  /** Add a Construct function definition to an event sheet. */
  addFunction({ eventSheet, name, returnType = "none", parameters = [], isAsync = false }) {
    const es = this._sheet(eventSheet);
    const fn = schema.functionBlock({ name, ids: this.ids, returnType, parameters, isAsync });
    es.events.push(fn);
    return fn;
  }

  /** Add an instance variable to an existing object type. */
  addInstanceVariable({ object, name, type = "number", desc = "" }) {
    const ot = this.model.objectTypes[object];
    if (!ot) throw new Error(`unknown object type: ${object}`);
    if (ot.instanceVariables.some((v) => v.name === name))
      throw new Error(`object "${object}" already has instance variable "${name}"`);
    const v = schema.instanceVariable({ name, ids: this.ids, type, desc });
    ot.instanceVariables.push(v);
    return v;
  }

  /** Place an object instance onto a layout's first layer. */
  placeInstance({ layout, object, x, y, width, height, properties, behaviors = {} } = {}) {
    const l = this.model.layouts[layout];
    if (!l) throw new Error(`unknown layout: ${layout}`);
    const ot = this.model.objectTypes[object];
    if (!ot) throw new Error(`unknown object: ${object}`);
    let originX = 0.5, originY = 0.5;
    if (ot["plugin-id"] === "Sprite") {
      const anim = ot.animations?.items?.[0];
      const f = anim?.frames?.[0];
      // default size and origin from the first frame so art isn't distorted
      width = width ?? f?.width;
      height = height ?? f?.height;
      originX = f?.originX ?? 0.5;
      originY = f?.originY ?? 0.5;
      properties = properties ?? schema.spriteInstanceProperties({ animation: anim?.name });
    } else if (ot["plugin-id"] === "Text") {
      properties = properties ?? schema.textInstanceProperties();
      originX = 0; originY = 0;
    }
    const inst = schema.instance({ type: object, ids: this.ids, x, y, width, height, originX, originY, properties, behaviors });
    l.layers[0].instances.push(inst);
    return inst;
  }

  /** Add a single-global input/system plugin object (Keyboard, Mouse, Touch, gamepad). */
  addGlobalPlugin(pluginKey, { name } = {}) {
    this.useAddon(pluginKey);
    name = name ?? pluginKey;
    if (this.model.objectTypes[name]) return this.model.objectTypes[name];
    const ot = schema.objectTypeSingleGlobal({ name, pluginId: pluginKey, ids: this.ids });
    this.model.objectTypes[name] = ot;
    pushItem(this.model.manifest.objectTypes, name);
    return ot;
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
