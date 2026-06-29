// factory-core: genre templates that compose c3-builder calls into a whole game.
// This is the "factory" layer — pick a template + params, get a complete project.

import { Game } from "@construct-factory/c3-builder";
import { blank } from "./templates/blank.js";
import { helloText } from "./templates/hello-text.js";

export const TEMPLATES = { blank, "hello-text": helloText };

/**
 * Generate a complete game project (in memory). Caller saves it.
 * @param {object} opts
 * @param {string} opts.rootDir   where the game folder is created
 * @param {string} opts.name      game name
 * @param {string} opts.template  one of TEMPLATES
 * @param {object} [opts.params]  template-specific params
 * @returns {Game}
 */
export function generateGame({ rootDir, name, template, params = {} }) {
  const fn = TEMPLATES[template];
  if (!fn) throw new Error(`unknown template "${template}". Have: ${Object.keys(TEMPLATES).join(", ")}`);
  const game = Game.create({ rootDir, name });
  fn(game, params);
  return game;
}

export { Game };
