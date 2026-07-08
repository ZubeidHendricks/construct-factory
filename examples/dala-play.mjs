// DALA — District Six Showdown: a genuinely PLAYABLE RTS built from scratch.
// Real purchased art (Cave/Nuke units), but clean gameplay logic authored and
// verified here — units select, move (pathfinding), auto-fight via line of
// sight, die with explosions; enemies hunt you; destroy the enemy fort to win.
//
//   node examples/dala-play.mjs   -> games/dala-play + games/dala-play.c3p

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Game } from "@construct-factory/c3-builder";
import { packC3p } from "@construct-factory/c3-format";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG = path.join(ROOT, "games/dala/images");

// pick up to `n` evenly-spaced frame files matching a prefix (keeps size sane)
const frames = (prefix, n = 6) => {
  const all = fs.readdirSync(IMG).filter((f) => f.startsWith(prefix) && f.endsWith(".png")).sort();
  if (all.length <= n) return all.map((f) => path.join(IMG, f));
  const out = [];
  for (let i = 0; i < n; i++) out.push(all[Math.floor((i * all.length) / n)]);
  return out.map((f) => path.join(IMG, f));
};

const W = 1280, H = 736;
const g = Game.create({ rootDir: path.join(ROOT, "games"), name: "DALA Play", viewportWidth: W, viewportHeight: H });
g.addLayout({ name: "Battle", width: W, height: H, makeFirst: true });
g.addGlobalPlugin("Mouse");

// --- terrain ----------------------------------------------------------------
g.addTilemap({ name: "Sand", tileWidth: 64, tileHeight: 64, colors: [[201, 172, 128, 255], [192, 162, 118, 255]] });
const cols = Math.ceil(W / 64), rows = Math.ceil(H / 64);
const ground = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => ((r * 5 + c * 3) % 7 === 0 ? 2 : 1)));
g.placeTilemap({ layout: "Battle", object: "Sand", grid: ground, tileWidth: 64, tileHeight: 64 });

// --- unit object types ------------------------------------------------------
// MoveTo drives straight-line movement (mode "direct") — reliable, no
// obstacle-grid setup. LOS drives combat targeting.
const mover = (speed) => ({ properties: { "max-speed": speed, acceleration: 700, deceleration: 900, "rotate-speed": 0, "set-angle": false, "stop-on-solids": false, enabled: true } });
const seeing = (range) => ({ properties: { obstacles: "solids", range, "cone-of-view": 360, "use-collision-cells": true } });

// Player soldier: idle + walking
g.addSprite({ name: "Soldier", behaviors: ["MoveTo", "LOS"], animations: [
  { name: "idle", images: frames("troopsfreindly-idle", 1), speed: 1, isLooping: true },
  { name: "walking", images: frames("troopsfreindly-walking", 3), speed: 8, isLooping: true },
] });
g.addInstanceVariable({ object: "Soldier", name: "hp", type: "number" });
g.addInstanceVariable({ object: "Soldier", name: "selected", type: "boolean" });

// Player tank: idle + driving
g.addSprite({ name: "Tank", behaviors: ["MoveTo", "LOS"], animations: [
  { name: "idle", images: frames("lighttank-idle-0", 1), speed: 1, isLooping: true },
  { name: "driving", images: frames("lighttank-driving", 2), speed: 8, isLooping: true },
] });
g.addInstanceVariable({ object: "Tank", name: "hp", type: "number" });
g.addInstanceVariable({ object: "Tank", name: "selected", type: "boolean" });

// Enemy headbot: idle + walk + shoot + dead
g.addSprite({ name: "Raider", behaviors: ["MoveTo", "LOS"], animations: [
  { name: "idle", images: frames("headbot-idle-0", 6), speed: 8, isLooping: true },
  { name: "walk", images: frames("headbot-walk-0", 6), speed: 10, isLooping: true },
  { name: "shoot", images: frames("headbot-shoot-0", 6), speed: 12, isLooping: true },
] });
g.addInstanceVariable({ object: "Raider", name: "hp", type: "number" });

// Forts (solid) + explosion fx
g.addSprite({ name: "EnemyFort", behaviors: ["solid", "LOS"], animations: [{ name: "idle", images: frames("spr_enemyfort-animation 1", 1), speed: 1, isLooping: true }] });
g.addInstanceVariable({ object: "EnemyFort", name: "hp", type: "number" });
g.addSprite({ name: "HomeFort", behaviors: ["solid"], animations: [{ name: "idle", images: frames("ourfort-animation 3", 1), speed: 1, isLooping: true }] });
g.addSprite({ name: "Boom", animations: [{ name: "expsmall", images: frames("spr_exp_small-expsmall-0", 10), speed: 24, isLooping: false }] });

g.addText({ name: "HUD" });

// --- placement --------------------------------------------------------------
const soldierSz = { width: 60, height: 63 };
const tankSz = { width: 120, height: 97 };
const raiderSz = { width: 66, height: 82 };
const place = (obj, x, y, sz, behaviors) => g.placeInstance({ layout: "Battle", object: obj, x, y, ...sz, behaviors });

place("HomeFort", 120, 610, { width: 150, height: 150 });
place("Soldier", 240, 560, soldierSz, { MoveTo: mover(140), LOS: seeing(300) });
place("Soldier", 300, 620, soldierSz, { MoveTo: mover(140), LOS: seeing(300) });
place("Soldier", 240, 660, soldierSz, { MoveTo: mover(140), LOS: seeing(300) });
place("Tank", 360, 610, tankSz, { MoveTo: mover(95), LOS: seeing(340) });

place("EnemyFort", 1120, 150, { width: 170, height: 170 }, { LOS: seeing(300) });
place("Raider", 980, 300, raiderSz, { MoveTo: mover(70), LOS: seeing(280) });
place("Raider", 1050, 360, raiderSz, { MoveTo: mover(70), LOS: seeing(280) });
place("Raider", 940, 420, raiderSz, { MoveTo: mover(70), LOS: seeing(280) });
place("HUD", 12, 10, { width: 900, height: 28 });

// --- logic ------------------------------------------------------------------
const ES = "Battle events";
g.addEventVariable({ eventSheet: ES, name: "Kills", initialValue: "0" });
const ev = (group, conditions, actions) => g.addEvent({ eventSheet: ES, group, conditions, actions });
const A = (id, objectClass = "System", parameters, behaviorType) => ({ id, objectClass, ...(behaviorType ? { behaviorType } : {}), ...(parameters ? { parameters } : {}) });
const C = A;

g.addEventGroup({ eventSheet: ES, title: "Setup" });
ev("Setup", [C("on-start-of-layout")], [
  A("set-instvar-value", "Soldier", { "instance-variable": "hp", value: "100" }),
  A("set-instvar-value", "Tank", { "instance-variable": "hp", value: "220" }),
  A("set-instvar-value", "Raider", { "instance-variable": "hp", value: "60" }),
  A("set-instvar-value", "EnemyFort", { "instance-variable": "hp", value: "500" }),
  A("set-text", "HUD", { text: '"DALA — District Six Showdown · left-click a unit, right-click to move · storm the enemy fort!"' }),
]);

g.addEventGroup({ eventSheet: ES, title: "Selection" });
ev("Selection", [C("on-object-clicked", "Mouse", { "mouse-button": "left", "click-type": "clicked", "object-clicked": "Soldier" })],
  [A("set-boolean-instvar", "Soldier", { "instance-variable": "selected", value: "true" })]);
ev("Selection", [C("on-object-clicked", "Mouse", { "mouse-button": "left", "click-type": "clicked", "object-clicked": "Tank" })],
  [A("set-boolean-instvar", "Tank", { "instance-variable": "selected", value: "true" })]);
// left-click on empty ground -> deselect all
ev("Selection", [
  C("on-click", "Mouse", { "mouse-button": "left", "click-type": "clicked" }),
  { ...C("cursor-is-over-object", "Mouse", { object: "Soldier" }), isInverted: true },
  { ...C("cursor-is-over-object", "Mouse", { object: "Tank" }), isInverted: true },
], [
  A("set-boolean-instvar", "Soldier", { "instance-variable": "selected", value: "false" }),
  A("set-boolean-instvar", "Tank", { "instance-variable": "selected", value: "false" }),
]);

g.addEventGroup({ eventSheet: ES, title: "Orders" });
ev("Orders", [
  C("on-click", "Mouse", { "mouse-button": "right", "click-type": "clicked" }),
  C("is-boolean-instance-variable-set", "Soldier", { "instance-variable": "selected" }),
], [A("move-to-position", "Soldier", { x: "Mouse.X", y: "Mouse.Y", mode: "direct" }, "MoveTo"),
    A("set-animation", "Soldier", { animation: '"walking"', from: "beginning" })]);
ev("Orders", [
  C("on-click", "Mouse", { "mouse-button": "right", "click-type": "clicked" }),
  C("is-boolean-instance-variable-set", "Tank", { "instance-variable": "selected" }),
], [A("move-to-position", "Tank", { x: "Mouse.X", y: "Mouse.Y", mode: "direct" }, "MoveTo"),
    A("set-animation", "Tank", { animation: '"driving"', from: "beginning" })]);
// arrived -> back to idle
ev("Orders", [C("on-arrived", "Soldier", undefined, "MoveTo")], [A("set-animation", "Soldier", { animation: '"idle"', from: "beginning" })]);
ev("Orders", [C("on-arrived", "Tank", undefined, "MoveTo")], [A("set-animation", "Tank", { animation: '"idle"', from: "beginning" })]);

g.addEventGroup({ eventSheet: ES, title: "Combat" });
// players shoot raiders they can see
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Soldier", { object: "Raider", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "Raider", { "instance-variable": "hp", value: "-7" })]);
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Tank", { object: "Raider", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "Raider", { "instance-variable": "hp", value: "-12" })]);
// players chip the enemy fort
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Tank", { object: "EnemyFort", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "EnemyFort", { "instance-variable": "hp", value: "-10" })]);
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Soldier", { object: "EnemyFort", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "EnemyFort", { "instance-variable": "hp", value: "-4" })]);
// raiders shoot back
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Raider", { object: "Soldier", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "Soldier", { "instance-variable": "hp", value: "-4" }), A("set-animation", "Raider", { animation: '"shoot"', from: "current" })]);
ev("Combat", [C("every-x-seconds", "System", { "interval-seconds": "0.4" }), C("has-los-to-object", "Raider", { object: "Tank", "image-point": "0" }, "LOS")],
  [A("add-to-instvar", "Tank", { "instance-variable": "hp", value: "-3" })]);

g.addEventGroup({ eventSheet: ES, title: "Deaths" });
ev("Deaths", [C("compare-instance-variable", "Raider", { "instance-variable": "hp", comparison: 3, value: "0" })],
  [A("spawn-another-object", "Raider", { object: "Boom", layer: "0", "image-point": "0", "create-hierarchy": false }), A("destroy", "Raider"),
   A("add-to-eventvar", "System", { variable: "Kills", value: "1" }), A("set-text", "HUD", { text: '"Raiders down: " & Kills' })]);
ev("Deaths", [C("compare-instance-variable", "Soldier", { "instance-variable": "hp", comparison: 3, value: "0" })],
  [A("spawn-another-object", "Soldier", { object: "Boom", layer: "0", "image-point": "0", "create-hierarchy": false }), A("destroy", "Soldier")]);
ev("Deaths", [C("compare-instance-variable", "Tank", { "instance-variable": "hp", comparison: 3, value: "0" })],
  [A("spawn-another-object", "Tank", { object: "Boom", layer: "0", "image-point": "0", "create-hierarchy": false }), A("destroy", "Tank")]);
ev("Deaths", [C("on-animation-finished", "Boom", { animation: '"expsmall"' })], [A("destroy", "Boom")]);

g.addEventGroup({ eventSheet: ES, title: "Raider AI" });
// raiders march on the player base (no per-instance picking — robust). They
// clash with your units mid-map where LOS combat kicks in. Autonomous: the
// battle unfolds with no input, then combat/deaths resolve it.
ev("Raider AI", [C("on-start-of-layout")],
  [A("move-to-position", "Raider", { x: "340", y: "620", mode: "direct" }, "MoveTo"),
   A("set-animation", "Raider", { animation: '"walk"', from: "beginning" })]);

g.addEventGroup({ eventSheet: ES, title: "Win Lose" });
ev("Win Lose", [C("compare-instance-variable", "EnemyFort", { "instance-variable": "hp", comparison: 3, value: "0" })],
  [A("go-to-layout-by-name", "System", { layout: '"You Win"' })]);
ev("Win Lose", [C("compare-two-values", "System", { "first-value": "Soldier.Count + Tank.Count", comparison: 0, "second-value": "0" })],
  [A("go-to-layout-by-name", "System", { layout: '"Game Over"' })]);

// end screens — full-screen colored backdrop + centered readable text
const bigText = (color) => ({
  text: "", "enable-bbcode": true, font: "Arial", size: 40, "line-height": 0,
  bold: true, italic: false, color, "horizontal-alignment": "center",
  "vertical-alignment": "center", wrapping: "word", "text-direction": "ltr",
  "icon-set": -1, "initially-visible": true, origin: "top-left", "read-aloud": false,
});
for (const [name, msg, bg] of [
  ["You Win", '"VICTORY  —  District Six stands tall!  ·  Click to play again."', [46, 120, 60, 255]],
  ["Game Over", '"DEFEAT  —  vasbyt, ons probeer weer.  ·  Click to try again."', [120, 46, 46, 255]],
]) {
  g.addLayout({ name, width: W, height: H });
  const bd = `${name.replace(/\s/g, "")}BG`;
  g.addSprite({ name: bd, animations: [{ name: "bg", color: bg, isLooping: true }] });
  g.placeInstance({ layout: name, object: bd, x: W / 2, y: H / 2, width: W, height: H });
  const t = `${name.replace(/\s/g, "")}Text`;
  g.addText({ name: t });
  g.placeInstance({ layout: name, object: t, x: 140, y: 320, width: 1000, height: 100, properties: bigText([1, 1, 1, 1]) });
  g.addEvent({ eventSheet: `${name} events`, conditions: [C("on-start-of-layout")], actions: [A("set-text", t, { text: msg })] });
  g.addEvent({ eventSheet: `${name} events`, conditions: [C("on-any-click", "Mouse")], actions: [A("go-to-layout-by-name", "System", { layout: '"Battle"' })] });
}

const dir = await g.save();
const v = g.validate();
console.log("saved:", dir, "valid:", JSON.stringify(v));
if (!v.ok) process.exit(1);
console.log("packed:", await packC3p(dir, path.join(ROOT, "games", "dala-play.c3p")));
