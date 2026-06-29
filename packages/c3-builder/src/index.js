// c3-builder: ergonomic authoring API over the c3-format model.
// A Game wraps an in-memory model and keeps the manifest's folder-tree
// name-lists, usedAddons, and sid/uid allocation in sync, so callers never
// hand-edit raw JSON.

import path from "node:path";
import * as c3 from "@construct-factory/c3-format";

const { schema } = c3;

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

  /** Add a Sprite object. NOTE: image linking is not yet verified (see schema). */
  addSprite({ name, width, height, behaviors = [] } = {}) {
    name = name ?? `Sprite${this.model.manifest.objectTypes.items.length + 1}`;
    this.useAddon("Sprite");
    const ot = schema.objectTypeSprite({ name, ids: this.ids, width, height });
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
