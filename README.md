# construct-factory

A factory for generating [Construct 3](https://www.construct.net/) games programmatically, exposed to Claude (or any MCP client) as an MCP server.

Construct 3 has **no public remote-editor API**. The automation surface this project targets is the **project-folder save format**: a Construct 3 project saved as a folder of JSON files (`project.c3proj` + `layouts/`, `eventSheets/`, `objectTypes/`, …). We read/write those files directly — no browser required. The human only opens the folder in Construct 3 to preview/export/publish.

## Layout

```
packages/
  c3-format/     Read/write/validate the .c3proj project-folder format (the schema layer)
  c3-builder/    High-level authoring API: createGame, addLayout, addObject, addEvent, …
  mcp-server/    Thin MCP server exposing c3-builder operations as tools
  factory-core/  Shared genre templates + scaffolds (the "factory" layer)
games/           One folder per generated game
reference/       Real Construct 3 project folders used to reverse-engineer the schema
verify/          Validation harness (does the output parse / round-trip cleanly?)
```

## Templates

Two kinds:

- **Builder templates** (`blank`, `hello-text`) — assembled from scratch via `c3-builder` against the reverse-engineered `schema.js`.
- **Clone templates** — stamped out by a **full-fidelity folder clone** of a verified real project in `reference/`, so every byte (images, animations, particles, effects, timelines, event logic) is preserved and guaranteed to open in Construct:
  - `kenney-platformer` — Kenney's CC0 tile platformer (Player + Platform behavior, Tilemap, coins, enemies).
  - `cave-boy` — Scirra's *Cave Bridge* template (animated player, parallax vegetation, particles, area lighting, Tween/Timeline).

```js
generateGame({ rootDir: "games", name: "Cave Boy Adventure", template: "cave-boy" });
```

The format layer round-trips these real projects losslessly (read → write to a new folder is byte-identical, verified in `verify/`).

## ⚠️ Status: builder schema is still PROVISIONAL

The hand-written field shapes in `packages/c3-format/src/schema.js` (used by the *builder* templates) are reverse-engineered and incomplete. Clone templates don't depend on them — they copy ground-truth projects verbatim — so they're the reliable path today. Improving `schema.js` against the projects in `reference/` is how the builder path catches up.

## Quick start

```bash
npm install
npm run smoke      # generate a tiny game into games/ and round-trip it
npm run verify     # validate a project folder
npm run mcp        # start the MCP server on stdio
```

## Wiring into Claude Code

```bash
claude mcp add construct-factory -- node /Users/zubeidhendricks/construct-factory/packages/mcp-server/src/index.js
```
