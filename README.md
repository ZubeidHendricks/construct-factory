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

## ⚠️ Status: schema is PROVISIONAL

The exact `.c3proj` JSON schema is undocumented and version-specific. The field shapes in `packages/c3-format/src/schema.js` are a **best-effort starting point** and are almost certainly incomplete.

**Before relying on generated projects:** drop a real reference project into `reference/` (in Construct 3: *Menu → Project → Save as → save as a project folder*), then we correct `c3-format` against ground truth. Everything else is built so that fixing the schema is a one-file change.

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
