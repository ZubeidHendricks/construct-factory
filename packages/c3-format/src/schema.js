// Construct 3 project-folder schema, reverse-engineered from real reference
// projects (reference/kiwi, plus the Kenney Pixel Platformer and Cave Bridge
// projects), savedWithRelease 48703, projectFormatVersion 1.
//
// Field shapes here match real Construct output. Sprite frames + animations and
// their imageSpriteId<->image-file linking are now verified against the Kenney
// and Cave Bridge sprites: addSprite() (c3-builder) emits real PNGs per frame
// via solidPng()/file copy and links them through frame().imageSpriteId.

// ---------------------------------------------------------------------------
// IDs. Construct uses large unique numeric `sid`s everywhere and incrementing
// `uid`s for layout instances (project property uidAllocationMode: "increment").
// We only need uniqueness within a project, so a seeded counter suffices and
// keeps builds deterministic (no Date.now/Math.random).
// ---------------------------------------------------------------------------
export class Ids {
  constructor(seed = 1) {
    this._sid = 100000000000000 + seed; // 15-digit, Construct-like, unique
    this._uid = 0;
  }
  sid() {
    this._sid += 1337;
    return this._sid;
  }
  uid() {
    return this._uid++;
  }
}

export const emptyFolder = () => ({ items: [], subfolders: [] });

// Catalog of first-party addons, keyed by the plugin/behavior id we reference.
// Used to populate manifest.usedAddons as objects/behaviors are added.
// Descriptors verified verbatim against real project manifests (KiwiStory,
// Kenney Pixel Platformer, Cave Bridge, and a commercial RTS source).
export const ADDONS = {
  // plugins
  AJAX: { type: "plugin", id: "AJAX", name: "AJAX", author: "Scirra" },
  Arr: { type: "plugin", id: "Arr", name: "Array", author: "Scirra" },
  Audio: { type: "plugin", id: "Audio", name: "Audio", author: "Scirra" },
  BinaryData: { type: "plugin", id: "BinaryData", name: "Binary Data", author: "Scirra" },
  Browser: { type: "plugin", id: "Browser", name: "Browser", author: "Scirra" },
  Button: { type: "plugin", id: "Button", name: "Button", author: "Scirra" },
  Clipboard: { type: "plugin", id: "Clipboard", name: "Clipboard", author: "Scirra" },
  Date: { type: "plugin", id: "Date", name: "Date", author: "Scirra" },
  Dictionary: { type: "plugin", id: "Dictionary", name: "Dictionary", author: "Scirra" },
  DrawingCanvas: { type: "plugin", id: "DrawingCanvas", name: "Drawing canvas", author: "Scirra" },
  Keyboard: { type: "plugin", id: "Keyboard", name: "Keyboard", author: "Scirra" },
  List: { type: "plugin", id: "List", name: "List", author: "Scirra" },
  LocalStorage: { type: "plugin", id: "LocalStorage", name: "Local storage", author: "Scirra" },
  Mouse: { type: "plugin", id: "Mouse", name: "Mouse", author: "Scirra" },
  NinePatch: { type: "plugin", id: "NinePatch", name: "9-patch", author: "Scirra" },
  Particles: { type: "plugin", id: "Particles", name: "Particles", author: "Scirra" },
  PlatformInfo: { type: "plugin", id: "PlatformInfo", name: "Platform info", author: "Scirra" },
  Sprite: { type: "plugin", id: "Sprite", name: "Sprite", author: "Scirra" },
  Spritefont2: { type: "plugin", id: "Spritefont2", name: "Sprite font", author: "Scirra" },
  Text: { type: "plugin", id: "Text", name: "Text", author: "Scirra" },
  TextBox: { type: "plugin", id: "TextBox", name: "Text input", author: "Scirra" },
  TiledBg: { type: "plugin", id: "TiledBg", name: "Tiled Background", author: "Scirra" },
  Tilemap: { type: "plugin", id: "Tilemap", name: "Tilemap", author: "Scirra" },
  Touch: { type: "plugin", id: "Touch", name: "Touch", author: "Scirra" },
  filechooser: { type: "plugin", id: "filechooser", name: "File chooser", author: "Scirra" },
  gamepad: { type: "plugin", id: "gamepad", name: "Gamepad", author: "Scirra" },
  video: { type: "plugin", id: "video", name: "Video", author: "Scirra" },
  // behaviors
  Anchor: { type: "behavior", id: "Anchor", name: "Anchor", author: "Scirra" },
  Bullet: { type: "behavior", id: "Bullet", name: "Bullet", author: "Scirra" },
  DragnDrop: { type: "behavior", id: "DragnDrop", name: "Drag & Drop", author: "Scirra" },
  EightDir: { type: "behavior", id: "EightDir", name: "8 Direction", author: "Scirra" },
  Fade: { type: "behavior", id: "Fade", name: "Fade", author: "Scirra" },
  Flash: { type: "behavior", id: "Flash", name: "Flash", author: "Scirra" },
  LOS: { type: "behavior", id: "LOS", name: "Line of sight", author: "Scirra" },
  MoveTo: { type: "behavior", id: "MoveTo", name: "Move To", author: "Scirra" },
  Pathfinding: { type: "behavior", id: "Pathfinding", name: "Pathfinding", author: "Scirra" },
  Physics: { type: "behavior", id: "Physics", name: "Physics", author: "Scirra" },
  Pin: { type: "behavior", id: "Pin", name: "Pin", author: "Scirra" },
  Platform: { type: "behavior", id: "Platform", name: "Platform", author: "Scirra" },
  Rotate: { type: "behavior", id: "Rotate", name: "Rotate", author: "Scirra" },
  Sin: { type: "behavior", id: "Sin", name: "Sine", author: "Scirra" },
  Timer: { type: "behavior", id: "Timer", name: "Timer", author: "Scirra" },
  Turret: { type: "behavior", id: "Turret", name: "Turret", author: "Scirra" },
  Tween: { type: "behavior", id: "Tween", name: "Tween", author: "Scirra" },
  bound: { type: "behavior", id: "bound", name: "Bound to layout", author: "Scirra" },
  custom: { type: "behavior", id: "custom", name: "Custom", author: "Scirra" },
  destroy: { type: "behavior", id: "destroy", name: "Destroy outside layout", author: "Scirra" },
  jumpthru: { type: "behavior", id: "jumpthru", name: "Jump-thru", author: "Scirra" },
  scrollto: { type: "behavior", id: "scrollto", name: "Scroll To", author: "Scirra" },
  solid: { type: "behavior", id: "solid", name: "Solid", author: "Scirra" },
};

export const addonDescriptor = (key) => {
  const a = ADDONS[key];
  if (!a) throw new Error(`unknown addon "${key}" — add it to ADDONS in schema.js`);
  return { ...a, bundled: false };
};

// ---------------------------------------------------------------------------
// Project manifest (project.c3proj)
// ---------------------------------------------------------------------------
export function projectManifest({ name, uid, viewportWidth = 1280, viewportHeight = 720, firstLayout }) {
  return {
    projectFormatVersion: 1,
    savedWithRelease: 48703, // editor release the format was verified against
    name,
    runtime: "c3",
    useWorker: "auto",
    bundleAddons: false,
    usedAddons: [],
    uniqueId: uid,
    objectTypes: emptyFolder(),
    functionsName: "Functions",
    autosaveData: null,
    containers: [],
    families: emptyFolder(),
    layouts: emptyFolder(),
    eventSheets: emptyFolder(),
    rootFileFolders: {
      script: emptyFolder(),
      sound: emptyFolder(),
      music: emptyFolder(),
      video: emptyFolder(),
      font: emptyFolder(),
      icon: emptyFolder(),
      general: emptyFolder(),
    },
    timelines: emptyFolder(),
    flowcharts: emptyFolder(),
    models3d: emptyFolder(),
    properties: defaultProperties(),
    viewportWidth,
    viewportHeight,
    firstLayout: firstLayout ?? null,
  };
}

export function defaultProperties(overrides = {}) {
  return {
    description: "",
    version: "1.0.0.0",
    autoIncrementVersion: false,
    author: "",
    authorEmail: "",
    authorWebsite: "",
    appId: "",
    pixelRounding: false,
    zAxisScale: "regular",
    fov: 0.7853981633974483,
    useLoaderLayout: false,
    fullscreenMode: "letterbox-integer-scale",
    fullscreenQuality: "low",
    viewportFit: "auto",
    backgroundColor: [0, 0, 0, 0],
    splashColor: [1, 1, 1, 0],
    useThemeColor: false,
    themeColor: [1, 1, 1, 0],
    orientations: "any",
    webgpu: "auto",
    multitexturing: "auto",
    gpuPreference: "high-performance",
    framerateMode: "vsync",
    fixedFramerate: 30,
    sampling: "nearest",
    downscaling: "medium",
    renderingMode: "auto",
    anisotropicFiltering: "auto",
    zNear: 1,
    zFar: 10000,
    maxSpriteSheetSize: 2048,
    loaderStyle: "splash",
    preloadSounds: true,
    uidAllocationMode: "increment",
    cordovaiOSScheme: "app",
    cordovaAndroidScheme: "https",
    exportFileStructure: "folders",
    scriptsType: "module",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
export function layoutFile({ name, ids, width = 1280, height = 720, eventSheet = null }) {
  return {
    name,
    layers: [layer({ name: "Layer 0", ids })],
    sid: ids.sid(),
    "nonworld-instances": [],
    effectTypes: [],
    width,
    height,
    unboundedScrolling: false,
    sampling: "auto",
    vpX: 0.5,
    vpY: 0.5,
    projection: "perspective",
    eventSheet,
  };
}

export function layer({ name, ids }) {
  return {
    name,
    overriden: 0,
    subLayers: [],
    instances: [],
    sid: ids.sid(),
    effectTypes: [],
    isInitiallyVisible: true,
    isInitiallyInteractive: true,
    isHTMLElementsLayer: false,
    color: [1, 1, 1, 1],
    backgroundColor: [0, 0, 0, 1],
    isTransparent: true,
    sampling: "auto",
    parallaxX: 1,
    parallaxY: 1,
    scaleRate: 1,
    forceOwnTexture: false,
    renderingMode: "3d",
    drawOrder: "z-order",
    useRenderCells: false,
    blendMode: "normal",
    zElevation: 0,
    global: false,
  };
}

// A placed instance on a layer. `properties` are plugin-specific; caller passes
// the right set (e.g. Sprite vs Text).
export function instance({ type, ids, x = 0, y = 0, width = 32, height = 32, originX = 0.5, originY = 0.5, properties = {}, instanceVariables = {}, behaviors = {} }) {
  return {
    type,
    properties,
    uid: ids.uid(),
    sid: ids.sid(),
    tags: "",
    instanceVariables,
    behaviors,
    showing: true,
    locked: false,
    world: {
      x,
      y,
      width,
      height,
      originX,
      originY,
      color: [1, 1, 1, 1],
      z: 0,
      angle: 0,
    },
  };
}

// Default per-instance properties for a placed Sprite (verified against the
// Kenney reference instances).
export function spriteInstanceProperties({ animation = "Default" } = {}) {
  return {
    "initially-visible": true,
    "initial-animation": animation,
    "initial-frame": 0,
    "enable-collisions": true,
    "live-preview": false,
  };
}

// Default per-instance properties for a placed Text (verified against a real
// project's Text instances).
export function textInstanceProperties({ text = "", size = 16, color = [0, 0, 0, 1] } = {}) {
  return {
    text,
    "enable-bbcode": true,
    font: "Arial",
    size,
    "line-height": 0,
    bold: false,
    italic: false,
    color,
    "horizontal-alignment": "left",
    "vertical-alignment": "top",
    wrapping: "word",
    "text-direction": "ltr",
    "icon-set": -1,
    "initially-visible": true,
    origin: "top-left",
    "read-aloud": false,
  };
}

// A single-global plugin object (Keyboard, Mouse, Touch, gamepad, Audio, ...).
// These have no world instances; one hidden global instance instead.
export function objectTypeSingleGlobal({ name, pluginId, ids }) {
  return {
    name,
    "plugin-id": pluginId,
    sid: ids.sid(),
    "singleglobal-inst": {
      type: name,
      properties: {},
      uid: ids.uid(),
    },
  };
}

// ---------------------------------------------------------------------------
// Event sheets
// ---------------------------------------------------------------------------
export function eventSheetFile({ name, ids }) {
  return { name, events: [], sid: ids.sid() };
}

export const includeEvent = (sheet) => ({ eventType: "include", includeSheet: sheet });

// An event group: titled, collapsible container of child events. Shape verified
// against a commercial RTS sheet (285 real groups).
export function eventGroup({ title, ids, description = "", isActiveOnStart = true }) {
  return {
    eventType: "group",
    disabled: false,
    title,
    description,
    isActiveOnStart,
    sid: ids.sid(),
    children: [],
  };
}

// An event-sheet variable (global to the sheet). initialValue is stored as a string.
export function eventVariable({ name, ids, type = "number", initialValue = "0", comment = "", isStatic = false, isConstant = false }) {
  return {
    eventType: "variable",
    name,
    type,
    initialValue: String(initialValue),
    comment,
    isStatic,
    isConstant,
    sid: ids.sid(),
  };
}

// A Construct function definition. Callers invoke it via the System "call-function"
// style ACEs; conditions stay empty, logic goes in actions/children.
export function functionBlock({ name, ids, returnType = "none", parameters = [], isAsync = false }) {
  return {
    functionName: name,
    functionDescription: "",
    functionCategory: "",
    functionReturnType: returnType,
    functionCopyPicked: false,
    functionIsAsync: isAsync,
    functionParameters: parameters,
    eventType: "function-block",
    conditions: [],
    actions: [],
    sid: ids.sid(),
  };
}

// An instance variable on an object type (referenced from events via
// compare-instance-variable / set-instvar-value / ...).
export function instanceVariable({ name, ids, type = "number", desc = "" }) {
  return { name, type, desc, show: true, sid: ids.sid() };
}

export function block({ ids, conditions = [], actions = [] }) {
  return { eventType: "block", conditions, actions, sid: ids.sid() };
}

export function condition({ id, objectClass = "System", ids, parameters, behaviorType, isInverted }) {
  const c = { id, objectClass, sid: ids.sid() };
  if (behaviorType) c.behaviorType = behaviorType; // e.g. "Platform" for is-on-floor
  if (isInverted) c.isInverted = true;
  if (parameters) c.parameters = parameters;
  return c;
}

export function action({ id, objectClass = "System", ids, parameters, behaviorType }) {
  const a = { id, objectClass, sid: ids.sid() };
  if (behaviorType) a.behaviorType = behaviorType; // e.g. "Platform" for set-vector-y
  if (parameters) a.parameters = parameters;
  return a;
}

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------
export function objectTypeText({ name, ids }) {
  return {
    name,
    "plugin-id": "Text",
    sid: ids.sid(),
    isGlobal: false,
    instanceVariables: [],
    behaviorTypes: [],
    effectTypes: [],
  };
}

// Sprite object type. `frames` is an array of frame() objects (each already
// linked to an emitted image via imageSpriteId). Shape verified against the
// Kenney Pixel Platformer and Cave Bridge reference projects.
export function objectTypeSprite({ name, ids, frames, animName = "Default", speed = 8, isLooping = false }) {
  return {
    name,
    "plugin-id": "Sprite",
    sid: ids.sid(),
    isGlobal: false,
    editorNewInstanceIsReplica: true,
    instanceVariables: [],
    behaviorTypes: [],
    effectTypes: [],
    animations: {
      items: [
        {
          frames,
          sid: ids.sid(),
          name: animName,
          isLooping,
          isPingPong: false,
          repeatCount: 1,
          repeatTo: 0,
          speed,
        },
      ],
      subfolders: [],
    },
  };
}

// A single animation frame. Defaults to a full-quad collision polygon (safe for
// rectangular sprites). originY defaults to centre; platformer feet use 1.
export function frame({ width, height, imageSpriteId, originX = 0.5, originY = 0.5 }) {
  return {
    width,
    height,
    originX,
    originY,
    originalSource: "",
    exportFormat: "lossless",
    exportQuality: 0.8,
    imageSpriteId,
    collisionPoly: { points: [0, 0, 1, 0, 1, 1, 0, 1] },
    useCollisionPoly: true,
    duration: 1,
  };
}

export function behaviorType({ behaviorId, name, ids }) {
  return { behaviorId, name, sid: ids.sid() };
}

// ---------------------------------------------------------------------------
// Tilemaps. Shapes verified against the Kenney Pixel Platformer and Cave
// Bridge reference projects.
// ---------------------------------------------------------------------------

// Tilemap object type: references one tileset image (a grid of tiles).
export function objectTypeTilemap({ name, ids, imageWidth, imageHeight, imageSpriteId }) {
  return {
    name,
    "plugin-id": "Tilemap",
    sid: ids.sid(),
    isGlobal: false,
    instanceVariables: [],
    behaviorTypes: [],
    effectTypes: [],
    image: {
      width: imageWidth,
      height: imageHeight,
      originX: 0.5,
      originY: 0.5,
      originalSource: "",
      exportFormat: "lossless",
      exportQuality: 0.8,
      imageSpriteId,
      useCollisionPoly: true,
    },
    "tile-collision-polys": {},
  };
}

// RLE-encode a row-major 2D grid of tile values into Construct's
// "5x123,143,4x0,..." format. Values are 1-BASED: 0 = empty cell, N draws
// tileset tile N-1 (verified against a live preview render; token cell count
// equals max-width*max-height in both reference projects).
export function encodeTilemapData(grid) {
  const flat = grid.flat();
  const parts = [];
  let i = 0;
  while (i < flat.length) {
    let run = 1;
    while (i + run < flat.length && flat[i + run] === flat[i]) run++;
    parts.push(run > 1 ? `${run}x${flat[i]}` : `${flat[i]}`);
    i += run;
  }
  return parts.join(",");
}

// A placed tilemap instance. `grid` is a row-major 2D array of tile indices.
export function tilemapInstance({ type, ids, grid, tileWidth, tileHeight, x = 0, y = 0, behaviors = {} }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) throw new Error("tilemap grid must be a non-empty 2D array");
  if (grid.some((r) => r.length !== cols)) throw new Error("tilemap grid rows must all be the same length");
  const tileProps = {
    "tile-width": tileWidth,
    "tile-height": tileHeight,
    "tile-x-offset": 0,
    "tile-y-offset": 0,
    "tile-x-spacing": 0,
    "tile-y-spacing": 0,
  };
  return {
    type,
    properties: {
      "initially-visible": true,
      ...tileProps,
      "tile-x-drawing-offset": 0,
      "tile-y-drawing-offset": 0,
      "drawing-mode": "top-to-right",
    },
    uid: ids.uid(),
    sid: ids.sid(),
    tags: "",
    instanceVariables: {},
    behaviors,
    ownData: {
      tilemapData: {
        width: cols,
        height: rows,
        "max-width": cols,
        "max-height": rows,
        data: encodeTilemapData(grid),
      },
      ...tileProps,
    },
    showing: true,
    locked: false,
    world: {
      x,
      y,
      width: cols * tileWidth,
      height: rows * tileHeight,
      originX: 0,
      originY: 0,
      color: [1, 1, 1, 1],
      z: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------
export function familyFile({ name, ids, pluginId = "Sprite", members = [], behaviorTypes = [] }) {
  return {
    name,
    "plugin-id": pluginId,
    sid: ids.sid(),
    instanceVariables: [],
    behaviorTypes,
    effectTypes: [],
    members,
  };
}
