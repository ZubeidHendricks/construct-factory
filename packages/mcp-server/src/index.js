#!/usr/bin/env node
// MCP server exposing the Construct game factory over stdio.
// Tools are thin wrappers around factory-core / c3-builder; all project state
// lives on disk as Construct project folders under a configurable games root.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "@construct-factory/c3-builder";
import { generateGame, TEMPLATES } from "@construct-factory/factory-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_ROOT =
  process.env.CONSTRUCT_FACTORY_GAMES_ROOT ||
  path.resolve(__dirname, "../../../games");

const TOOLS = [
  {
    name: "list_templates",
    description: "List available game templates in the factory.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_game",
    description:
      "Generate a complete Construct 3 game from a template and save it as a project folder under the games root.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Game name" },
        template: { type: "string", enum: Object.keys(TEMPLATES) },
        params: { type: "object", description: "Template-specific parameters" },
      },
      required: ["name", "template"],
    },
  },
  {
    name: "add_layout",
    description: "Add a layout (scene) to an existing game project folder.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Path to the game project folder" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["dir"],
    },
  },
  {
    name: "add_text",
    description: "Add a Text object type (no image assets needed) to an existing game project folder.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string" },
        name: { type: "string" },
      },
      required: ["dir"],
    },
  },
  {
    name: "add_sprite",
    description:
      "Add a Sprite object type to an existing game project folder, optionally with behaviors (e.g. Platform, Bullet, solid, Sin). NOTE: sprite IMAGE linking is not yet schema-verified; the object is created without image data.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Path to the game project folder" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        behaviors: {
          type: "array",
          items: { type: "string" },
          description: "Behavior keys to attach, e.g. [\"Platform\", \"solid\"]",
        },
      },
      required: ["dir"],
    },
  },
  {
    name: "add_event_sheet",
    description: "Add an empty event sheet (logic container) to an existing game project folder.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string" },
        name: { type: "string" },
      },
      required: ["dir"],
    },
  },
  {
    name: "add_event",
    description:
      "Append a conditions->actions block to an event sheet. Conditions/actions are arrays of { id, objectClass, parameters }, where objectClass defaults to \"System\". Example action: { id: \"set-text\", objectClass: \"Text\", parameters: { text: \"\\\"Hello\\\"\" } }.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string" },
        eventSheet: { type: "string", description: "Name of the target event sheet" },
        conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              objectClass: { type: "string" },
              parameters: { type: "object" },
            },
            required: ["id"],
          },
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              objectClass: { type: "string" },
              parameters: { type: "object" },
            },
            required: ["id"],
          },
        },
      },
      required: ["dir", "eventSheet"],
    },
  },
  {
    name: "place_instance",
    description: "Place an instance of an object type onto a layout's first layer at (x, y).",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string" },
        layout: { type: "string", description: "Name of the target layout" },
        object: { type: "string", description: "Name of the object type to instantiate" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        properties: { type: "object", description: "Optional instance properties" },
      },
      required: ["dir", "layout", "object"],
    },
  },
  {
    name: "validate_project",
    description: "Structurally validate a game project folder (manifest <-> files consistency).",
    inputSchema: {
      type: "object",
      properties: { dir: { type: "string" } },
      required: ["dir"],
    },
  },
];

const handlers = {
  async list_templates() {
    return { templates: Object.keys(TEMPLATES), gamesRoot: GAMES_ROOT };
  },
  async generate_game({ name, template, params }) {
    const game = generateGame({ rootDir: GAMES_ROOT, name, template, params });
    const dir = await game.save();
    return { dir, validation: game.validate() };
  },
  async add_layout({ dir, name, width, height }) {
    const game = await Game.open(dir);
    const layout = game.addLayout({ name, width, height });
    await game.save();
    return { added: layout.name, dir };
  },
  async add_text({ dir, name }) {
    const game = await Game.open(dir);
    const ot = game.addText({ name });
    await game.save();
    return { added: ot.name, plugin: ot["plugin-id"], dir };
  },
  async add_sprite({ dir, name, width, height, behaviors }) {
    const game = await Game.open(dir);
    const ot = game.addSprite({ name, width, height, behaviors });
    await game.save();
    return {
      added: ot.name,
      plugin: ot["plugin-id"],
      behaviors: (ot.behaviorTypes ?? []).map((b) => b["behavior-id"] ?? b.name),
      dir,
    };
  },
  async add_event_sheet({ dir, name }) {
    const game = await Game.open(dir);
    const es = game.addEventSheet({ name });
    await game.save();
    return { added: es.name, dir };
  },
  async add_event({ dir, eventSheet, conditions, actions }) {
    const game = await Game.open(dir);
    const blk = game.addEvent({ eventSheet, conditions, actions });
    await game.save();
    return {
      eventSheet,
      sid: blk.sid,
      conditions: blk.conditions.length,
      actions: blk.actions.length,
      dir,
    };
  },
  async place_instance({ dir, layout, object, x, y, width, height, properties }) {
    const game = await Game.open(dir);
    const inst = game.placeInstance({ layout, object, x, y, width, height, properties });
    await game.save();
    return { placed: object, layout, uid: inst.uid, dir };
  },
  async validate_project({ dir }) {
    const game = await Game.open(dir);
    return game.validate();
  },
};

const server = new Server(
  { name: "construct-factory", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const handler = handlers[req.params.name];
  if (!handler) throw new Error(`unknown tool: ${req.params.name}`);
  try {
    const result = await handler(req.params.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error in ${req.params.name}: ${err.message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`construct-factory MCP server running. games root: ${GAMES_ROOT}`);
