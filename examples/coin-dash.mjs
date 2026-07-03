// Coin Dash — a complete platformer built 100% from scratch with the builder
// API (no clone template): tilemap terrain, animated player, coins, win flag,
// score HUD, and gameplay events. Art: Kenney Pixel Platformer (CC0).
//
//   node examples/coin-dash.mjs        -> games/coin-dash + games/coin-dash.c3p

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "@construct-factory/c3-builder";
import { packC3p } from "@construct-factory/c3-format";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART = path.join(ROOT, "reference/kenney-pixel-platformer/images");
const img = (f) => path.join(ART, f);

const TILE = 18; // Kenney tileset tile size
const COLS = 71; // 1278px wide layout
const ROWS = 20; // 360px tall
const SURFACE = 23, FILL = 123; // Kenney tileset: grass surface / dirt fill

// --- project ---------------------------------------------------------------
const g = Game.create({ rootDir: path.join(ROOT, "games"), name: "Coin Dash", viewportWidth: 640, viewportHeight: 360 });
g.addLayout({ name: "Level 1", width: COLS * TILE, height: ROWS * TILE, makeFirst: true });
g.addGlobalPlugin("Keyboard");

// --- terrain ----------------------------------------------------------------
// Ground with two gaps, plus floating platforms to hop between.
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const ground = (x0, x1) => {
  for (let x = x0; x <= x1; x++) {
    grid[17][x] = SURFACE;
    grid[18][x] = FILL;
    grid[19][x] = FILL;
  }
};
const platform = (x0, x1, row) => {
  for (let x = x0; x <= x1; x++) grid[row][x] = SURFACE;
};
ground(0, 24);            // start island
ground(29, 48);           // middle island (gap 25-28)
ground(53, 70);           // final island (gap 49-52)
platform(10, 13, 13);     // hops
platform(18, 21, 10);
platform(26, 28, 12);     // over the first gap
platform(34, 37, 13);
platform(41, 44, 10);
platform(50, 52, 12);     // over the second gap
platform(58, 61, 13);

g.addTilemap({ name: "Terrain", tileWidth: TILE, tileHeight: TILE, image: img("tilemap.png"), behaviors: ["solid"] });
g.placeTilemap({ layout: "Level 1", object: "Terrain", grid, tileWidth: TILE, tileHeight: TILE });

// --- objects ------------------------------------------------------------------
g.addSprite({ name: "Player", originY: 1, animName: "Walk", isLooping: true, speed: 10,
  behaviors: ["Platform", "scrollto"],
  images: [img("player-walk-000.png"), img("player-walk-001.png")] });
g.addSprite({ name: "Coin", animName: "Rotate", isLooping: true, speed: 5,
  images: [img("coin-rotate-000.png"), img("coin-rotate-001.png")] });
g.addSprite({ name: "Flag", originY: 1, animName: "Wave", isLooping: true, speed: 4,
  images: [img("flag-wave-000.png"), img("flag-wave-001.png")] });
g.addText({ name: "HUD" });

// --- placement ---------------------------------------------------------------
const Y = (row) => row * TILE; // px of a tile row's top
g.placeInstance({ layout: "Level 1", object: "Player", x: 3 * TILE, y: Y(17),
  behaviors: {
    Platform: { properties: {
      "max-speed": 150, acceleration: 750, deceleration: 720, "jump-strength": 220,
      gravity: 750, "max-fall-speed": 500, "double-jump": true, "jump-sustain": 0,
      "default-controls": true, enabled: true } },
    scrollto: { properties: { enabled: true } },
  } });

const coins = [
  [11.5, 12], [19.5, 9], [27, 11], [31, 16], [35.5, 12], [42.5, 9],
  [46, 16], [51, 11], [59.5, 12], [64, 16],
];
for (const [cx, cy] of coins)
  g.placeInstance({ layout: "Level 1", object: "Coin", x: cx * TILE, y: Y(cy) + TILE / 2 });

g.placeInstance({ layout: "Level 1", object: "Flag", x: 68 * TILE, y: Y(17) });
g.placeInstance({ layout: "Level 1", object: "HUD", x: 8, y: 8, width: 200, height: 24 });

// --- logic ---------------------------------------------------------------------
const ES = "Level 1 events";
g.addEventVariable({ eventSheet: ES, name: "Score", initialValue: "0" });

g.addEventGroup({ eventSheet: ES, title: "Player" });
g.addEvent({ eventSheet: ES, group: "Player",
  conditions: [{ id: "on-key-pressed", objectClass: "Keyboard", parameters: { key: 37 } }],
  actions: [{ id: "set-mirrored", objectClass: "Player", parameters: { state: "mirrored" } }] });
g.addEvent({ eventSheet: ES, group: "Player",
  conditions: [{ id: "on-key-pressed", objectClass: "Keyboard", parameters: { key: 39 } }],
  actions: [{ id: "set-mirrored", objectClass: "Player", parameters: { state: "not-mirrored" } }] });
// fell into a pit -> restart
g.addEvent({ eventSheet: ES, group: "Player",
  conditions: [{ id: "compare-y", objectClass: "Player", parameters: { comparison: 4, "y-co-ordinate": String(ROWS * TILE + 50) } }],
  actions: [{ id: "restart-layout", objectClass: "System" }] });

g.addEventGroup({ eventSheet: ES, title: "Coins" });
g.addEvent({ eventSheet: ES, group: "Coins",
  conditions: [{ id: "on-collision-with-another-object", objectClass: "Player", parameters: { object: "Coin" } }],
  actions: [
    { id: "destroy", objectClass: "Coin" },
    { id: "add-to-eventvar", objectClass: "System", parameters: { variable: "Score", value: "1" } },
    { id: "set-text", objectClass: "HUD", parameters: { text: "\"Coins: \" & Score" } },
  ] });

g.addEventGroup({ eventSheet: ES, title: "Win" });
g.addEvent({ eventSheet: ES, group: "Win",
  conditions: [{ id: "on-collision-with-another-object", objectClass: "Player", parameters: { object: "Flag" } }],
  actions: [{ id: "set-text", objectClass: "HUD", parameters: { text: "\"You win! Coins: \" & Score & \"/10\"" } }] });

// --- save + pack ------------------------------------------------------------------
const dir = await g.save();
const validation = g.validate();
console.log("saved:", dir);
console.log("validate:", JSON.stringify(validation));
if (!validation.ok) process.exit(1);
const c3p = await packC3p(dir, path.join(ROOT, "games", "coin-dash.c3p"));
console.log("packed:", c3p);
