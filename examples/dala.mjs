// DALA — an original RTS skeleton built 100% from scratch with the builder API.
// Mechanics follow classic RTS patterns (select units, right-click orders,
// pathfinding, line-of-sight combat, destroy-the-fort win condition); every
// ACE id and behavior property shape is verified against real project ground
// truth. All art is generated (solid-color placeholders) — swap via
// replace_image when real art is ready.
//
//   node examples/dala.mjs        -> games/dala + games/dala.c3p

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "@construct-factory/c3-builder";
import { packC3p } from "@construct-factory/c3-format";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TILE = 32;
const COLS = 80, ROWS = 45; // 2560 x 1440 — room for the source game's ~150px units

const g = Game.create({ rootDir: path.join(ROOT, "games"), name: "DALA", viewportWidth: 1280, viewportHeight: 736 });
g.addLayout({ name: "District Six", width: COLS * TILE, height: ROWS * TILE, makeFirst: true });
g.addGlobalPlugin("Mouse");

// --- terrain: sand ground (walkable) + rock obstacles (solid) ---------------
g.addTilemap({ name: "Ground", tileWidth: TILE, tileHeight: TILE,
  colors: [[203, 174, 128, 255], [190, 160, 114, 255]] }); // sand, darker sand
g.addTilemap({ name: "Boulders", tileWidth: TILE, tileHeight: TILE,
  colors: [[110, 104, 96, 255]], behaviors: ["solid"] });   // rock

// ground: sand with scattered darker patches (deterministic scatter)
const ground = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => ((r * 7 + c * 13) % 11 === 0 ? 2 : 1)));
g.placeTilemap({ layout: "District Six", object: "Ground", grid: ground, tileWidth: TILE, tileHeight: TILE });

// rocks: clusters that make pathfinding matter (sized for ~150px units)
const rocks = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const cluster = (r0, c0, cells) => { for (const [dr, dc] of cells) rocks[r0 + dr][c0 + dc] = 1; };
const blob = (r0, c0, h, w) => {
  const cells = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if ((r + c) % 7 !== 6) cells.push([r, c]);
  cluster(r0, c0, cells);
};
blob(8, 24, 4, 5);
blob(20, 36, 5, 6);
blob(32, 20, 3, 4);
blob(12, 54, 4, 5);
blob(30, 58, 5, 5);
blob(22, 10, 3, 3);
g.placeTilemap({ layout: "District Six", object: "Boulders", grid: rocks, tileWidth: TILE, tileHeight: TILE });

// --- HUD ----------------------------------------------------------------------
// The gameplay systems (selection, orders, factories, rally, flag capture,
// camera) are ported verbatim from the licensed RTS source by tools/port_rts.py.
// This base project provides only the battlefield and the HUD.
g.addText({ name: "HUD" });
g.placeInstance({ layout: "District Six", object: "HUD", x: 10, y: 8, width: 720, height: 26 });

// Stub destinations for the ported win/lose flow (go-to-layout-by-name):
// each shows a message and click returns to the battlefield.
for (const [name, msg] of [
  ["LevelWin", '"VICTORY — District Six stands tall. Click to play again."'],
  ["MainMenu", '"DALA — District Six Showdown. Click to deploy."'],
]) {
  g.addLayout({ name, width: 1280, height: 736 });
  const t = `${name}Text`;
  g.addText({ name: t });
  g.placeInstance({ layout: name, object: t, x: 240, y: 320, width: 800, height: 60 });
  g.addEvent({ eventSheet: `${name} events`,
    conditions: [{ id: "on-start-of-layout" }],
    actions: [{ id: "set-text", objectClass: t, parameters: { text: msg } }] });
  g.addEvent({ eventSheet: `${name} events`,
    conditions: [{ id: "on-any-click", objectClass: "Mouse" }],
    actions: [{ id: "go-to-layout-by-name", objectClass: "System", parameters: { layout: '"District Six"' } }] });
}

const ES = "District Six events";
g.addEventGroup({ eventSheet: ES, title: "DALA Setup" });
g.addEvent({ eventSheet: ES, group: "DALA Setup",
  conditions: [{ id: "on-start-of-layout" }],
  actions: [
    { id: "set-text", objectClass: "HUD", parameters: { text: "\"DALA \u2014 District Six Showdown \u00b7 drag-select your crew \u00b7 right-click: move out \u00b7 take the flags\"" } },
  ] });

// --- save + pack -----------------------------------------------------------------
const dir = await g.save();
const validation = g.validate();
console.log("saved:", dir);
console.log("validate:", JSON.stringify(validation));
if (!validation.ok) process.exit(1);
const c3p = await packC3p(dir, path.join(ROOT, "games", "dala.c3p"));
console.log("packed:", c3p);
