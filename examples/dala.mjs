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
const COLS = 40, ROWS = 23; // 1280 x 736

const g = Game.create({ rootDir: path.join(ROOT, "games"), name: "DALA", viewportWidth: 1280, viewportHeight: 736 });
g.addLayout({ name: "Battlefield", width: COLS * TILE, height: ROWS * TILE, makeFirst: true });
g.addGlobalPlugin("Mouse");

// --- terrain: sand ground (walkable) + rock obstacles (solid) ---------------
g.addTilemap({ name: "Ground", tileWidth: TILE, tileHeight: TILE,
  colors: [[203, 174, 128, 255], [190, 160, 114, 255]] }); // sand, darker sand
g.addTilemap({ name: "Rocks", tileWidth: TILE, tileHeight: TILE,
  colors: [[110, 104, 96, 255]], behaviors: ["solid"] });   // rock

// ground: sand with scattered darker patches (deterministic scatter)
const ground = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => ((r * 7 + c * 13) % 11 === 0 ? 2 : 1)));
g.placeTilemap({ layout: "Battlefield", object: "Ground", grid: ground, tileWidth: TILE, tileHeight: TILE });

// rocks: clusters that make pathfinding matter
const rocks = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const cluster = (r0, c0, cells) => { for (const [dr, dc] of cells) rocks[r0 + dr][c0 + dc] = 1; };
cluster(4, 12, [[0,0],[0,1],[1,0],[1,1],[2,1],[2,2]]);
cluster(10, 18, [[0,0],[0,1],[0,2],[1,1],[1,2],[2,2],[2,3]]);
cluster(16, 10, [[0,0],[1,0],[1,1],[2,0]]);
cluster(6, 27, [[0,0],[0,1],[1,0],[1,1],[2,0]]);
cluster(15, 30, [[0,0],[0,1],[1,1],[1,2],[2,2]]);
g.placeTilemap({ layout: "Battlefield", object: "Rocks", grid: rocks, tileWidth: TILE, tileHeight: TILE });

// --- forces ------------------------------------------------------------------
// Instance behavior property sets (shapes verified against a real RTS project)
const pathfinding = (maxSpeed) => ({ properties: {
  "cell-size": 30, "cell-border": -1, obstacles: "solids",
  "max-speed": maxSpeed, acceleration: 1000, deceleration: 2000,
  "rotate-speed": 15000, "rotate-object": false, diagonals: true,
  "direct-movement": "anywhere-along-path", enabled: true } });
const los = (range) => ({ properties: {
  obstacles: "solids", range, "cone-of-view": 360, "use-collision-cells": true } });

// DALA units (yours, gold) — Pathfinding + LOS, hp + selected state
g.addSprite({ name: "Ranger", width: 24, height: 24, color: [232, 178, 60, 255],
  behaviors: ["Pathfinding", "LOS"] });
g.addInstanceVariable({ object: "Ranger", name: "hp", type: "number" });
g.addInstanceVariable({ object: "Ranger", name: "selected", type: "boolean" });

// enemy raiders (crimson) and their fort
g.addSprite({ name: "Raider", width: 24, height: 24, color: [178, 58, 72, 255],
  behaviors: ["Pathfinding", "LOS"] });
g.addInstanceVariable({ object: "Raider", name: "hp", type: "number" });
g.addSprite({ name: "Fort", width: 64, height: 64, color: [120, 36, 48, 255], behaviors: ["LOS"] });
g.addInstanceVariable({ object: "Fort", name: "hp", type: "number" });

g.addText({ name: "HUD" });

// placement — rangers bottom-left, raiders guard the fort top-right
const rangerAt = (x, y) => g.placeInstance({ layout: "Battlefield", object: "Ranger", x, y,
  behaviors: { Pathfinding: pathfinding(140), LOS: los(280) } });
const raiderAt = (x, y) => g.placeInstance({ layout: "Battlefield", object: "Raider", x, y,
  behaviors: { Pathfinding: pathfinding(110), LOS: los(230) } });
rangerAt(140, 560); rangerAt(200, 600); rangerAt(140, 640);
raiderAt(980, 200); raiderAt(1060, 260); raiderAt(920, 280);
g.placeInstance({ layout: "Battlefield", object: "Fort", x: 1100, y: 140, behaviors: { LOS: los(260) } });
g.placeInstance({ layout: "Battlefield", object: "HUD", x: 10, y: 8, width: 620, height: 26 });

// --- logic ---------------------------------------------------------------------
const ES = "Battlefield events";
g.addEventVariable({ eventSheet: ES, name: "Kills", initialValue: "0" });

g.addEventGroup({ eventSheet: ES, title: "Setup" });
g.addEvent({ eventSheet: ES, group: "Setup",
  conditions: [{ id: "on-start-of-layout" }],
  actions: [
    { id: "set-instvar-value", objectClass: "Ranger", parameters: { "instance-variable": "hp", value: "100" } },
    { id: "set-instvar-value", objectClass: "Raider", parameters: { "instance-variable": "hp", value: "80" } },
    { id: "set-instvar-value", objectClass: "Fort", parameters: { "instance-variable": "hp", value: "400" } },
    { id: "set-text", objectClass: "HUD", parameters: { text: "\"DALA — left-click: select ranger · right-click: move · destroy the fort\"" } },
  ] });

g.addEventGroup({ eventSheet: ES, title: "Selection and Orders" });
g.addEvent({ eventSheet: ES, group: "Selection and Orders",
  conditions: [{ id: "on-object-clicked", objectClass: "Mouse", parameters: { "mouse-button": "left", "click-type": "clicked", "object-clicked": "Ranger" } }],
  actions: [{ id: "set-boolean-instvar", objectClass: "Ranger", parameters: { "instance-variable": "selected", value: "true" } }] });
g.addEvent({ eventSheet: ES, group: "Selection and Orders",
  conditions: [
    { id: "on-click", objectClass: "Mouse", parameters: { "mouse-button": "right", "click-type": "clicked" } },
    { id: "is-boolean-instance-variable-set", objectClass: "Ranger", parameters: { "instance-variable": "selected" } },
  ],
  actions: [{ id: "find-path", objectClass: "Ranger", behaviorType: "Pathfinding", parameters: { x: "Mouse.X", y: "Mouse.Y" } }] });
g.addEvent({ eventSheet: ES, group: "Selection and Orders",
  conditions: [{ id: "on-path-found", objectClass: "Ranger", behaviorType: "Pathfinding" }],
  actions: [{ id: "move-along-path", objectClass: "Ranger", behaviorType: "Pathfinding" }] });

g.addEventGroup({ eventSheet: ES, title: "Combat" });
// rangers hit what they can see
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [
    { id: "every-x-seconds", parameters: { "interval-seconds": "0.5" } },
    { id: "has-los-to-object", objectClass: "Ranger", behaviorType: "LOS", parameters: { object: "Raider", "image-point": "0" } },
  ],
  actions: [{ id: "add-to-instvar", objectClass: "Raider", parameters: { "instance-variable": "hp", value: "-6" } }] });
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [
    { id: "every-x-seconds", parameters: { "interval-seconds": "0.5" } },
    { id: "has-los-to-object", objectClass: "Ranger", behaviorType: "LOS", parameters: { object: "Fort", "image-point": "0" } },
  ],
  actions: [{ id: "add-to-instvar", objectClass: "Fort", parameters: { "instance-variable": "hp", value: "-6" } }] });
// raiders + fort hit back
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [
    { id: "every-x-seconds", parameters: { "interval-seconds": "0.6" } },
    { id: "has-los-to-object", objectClass: "Raider", behaviorType: "LOS", parameters: { object: "Ranger", "image-point": "0" } },
  ],
  actions: [{ id: "add-to-instvar", objectClass: "Ranger", parameters: { "instance-variable": "hp", value: "-5" } }] });
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [
    { id: "every-x-seconds", parameters: { "interval-seconds": "0.8" } },
    { id: "has-los-to-object", objectClass: "Fort", behaviorType: "LOS", parameters: { object: "Ranger", "image-point": "0" } },
  ],
  actions: [{ id: "add-to-instvar", objectClass: "Ranger", parameters: { "instance-variable": "hp", value: "-4" } }] });
// deaths
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [{ id: "compare-instance-variable", objectClass: "Raider", parameters: { "instance-variable": "hp", comparison: 3, value: "0" } }],
  actions: [
    { id: "destroy", objectClass: "Raider" },
    { id: "add-to-eventvar", objectClass: "System", parameters: { variable: "Kills", value: "1" } },
    { id: "set-text", objectClass: "HUD", parameters: { text: "\"Raiders down: \" & Kills" } },
  ] });
g.addEvent({ eventSheet: ES, group: "Combat",
  conditions: [{ id: "compare-instance-variable", objectClass: "Ranger", parameters: { "instance-variable": "hp", comparison: 3, value: "0" } }],
  actions: [{ id: "destroy", objectClass: "Ranger" }] });

g.addEventGroup({ eventSheet: ES, title: "Enemy AI" });
// raiders hunt the nearest ranger
g.addEvent({ eventSheet: ES, group: "Enemy AI",
  conditions: [
    { id: "every-x-seconds", parameters: { "interval-seconds": "3" } },
    { id: "pick-nearestfurthest", objectClass: "Ranger", parameters: { which: "nearest", x: "Raider.X", y: "Raider.Y" } },
  ],
  actions: [{ id: "find-path", objectClass: "Raider", behaviorType: "Pathfinding", parameters: { x: "Ranger.X", y: "Ranger.Y" } }] });
g.addEvent({ eventSheet: ES, group: "Enemy AI",
  conditions: [{ id: "on-path-found", objectClass: "Raider", behaviorType: "Pathfinding" }],
  actions: [{ id: "move-along-path", objectClass: "Raider", behaviorType: "Pathfinding" }] });

g.addEventGroup({ eventSheet: ES, title: "Win and Lose" });
g.addEvent({ eventSheet: ES, group: "Win and Lose",
  conditions: [{ id: "compare-instance-variable", objectClass: "Fort", parameters: { "instance-variable": "hp", comparison: 3, value: "0" } }],
  actions: [
    { id: "destroy", objectClass: "Fort" },
    { id: "set-text", objectClass: "HUD", parameters: { text: "\"VICTORY — DALA prevails. Raiders down: \" & Kills" } },
  ] });
g.addEvent({ eventSheet: ES, group: "Win and Lose",
  conditions: [{ id: "compare-two-values", parameters: { "first-value": "Ranger.Count", comparison: 0, "second-value": "0" } }],
  actions: [{ id: "set-text", objectClass: "HUD", parameters: { text: "\"DEFEAT — your rangers have fallen\"" } }] });

// --- save + pack -----------------------------------------------------------------
const dir = await g.save();
const validation = g.validate();
console.log("saved:", dir);
console.log("validate:", JSON.stringify(validation));
if (!validation.ok) process.exit(1);
const c3p = await packC3p(dir, path.join(ROOT, "games", "dala.c3p"));
console.log("packed:", c3p);
