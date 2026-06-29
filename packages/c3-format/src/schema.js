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
export const ADDONS = {
  // plugins
  Sprite: { type: "plugin", id: "Sprite", name: "Sprite", author: "Scirra" },
  Text: { type: "plugin", id: "Text", name: "Text", author: "Scirra" },
  TiledBg: { type: "plugin", id: "TiledBg", name: "Tiled Background", author: "Scirra" },
  Spritefont2: { type: "plugin", id: "Spritefont2", name: "Sprite font", author: "Scirra" },
  NinePatch: { type: "plugin", id: "NinePatch", name: "9-patch", author: "Scirra" },
  Mouse: { type: "plugin", id: "Mouse", name: "Mouse", author: "Scirra" },
  Keyboard: { type: "plugin", id: "Keyboard", name: "Keyboard", author: "Scirra" },
  Touch: { type: "plugin", id: "Touch", name: "Touch", author: "Scirra" },
  Audio: { type: "plugin", id: "Audio", name: "Audio", author: "Scirra" },
  // behaviors
  Platform: { type: "behavior", id: "Platform", name: "Platform", author: "Scirra" },
  Bullet: { type: "behavior", id: "Bullet", name: "Bullet", author: "Scirra" },
  solid: { type: "behavior", id: "solid", name: "Solid", author: "Scirra" },
  jumpthru: { type: "behavior", id: "jumpthru", name: "Jump-thru", author: "Scirra" },
  Sin: { type: "behavior", id: "Sin", name: "Sine", author: "Scirra" },
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
export function instance({ type, ids, x = 0, y = 0, width = 32, height = 32, properties = {}, instanceVariables = {}, behaviors = {} }) {
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
      originX: 0.5,
      originY: 0.5,
      color: [1, 1, 1, 1],
      z: 0,
      angle: 0,
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

export function block({ ids, conditions = [], actions = [] }) {
  return { eventType: "block", conditions, actions, sid: ids.sid() };
}

export function condition({ id, objectClass = "System", ids, parameters }) {
  const c = { id, objectClass, sid: ids.sid() };
  if (parameters) c.parameters = parameters;
  return c;
}

export function action({ id, objectClass = "System", ids, parameters }) {
  const a = { id, objectClass, sid: ids.sid() };
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
