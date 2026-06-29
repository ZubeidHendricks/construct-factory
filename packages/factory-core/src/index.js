// factory-core: genre templates that compose a whole game.
// Two kinds of template:
//   • builder fn   — (game, params) => void, assembles a project via c3-builder
//   • clone spec   — { kind: "clone", from } clones a verified reference project
// Pick a template + params, get a complete project; the caller saves it.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Game, slug } from "@construct-factory/c3-builder";
import { cloneProject, readProject, validateModel } from "@construct-factory/c3-format";
import { blank } from "./templates/blank.js";
import { helloText } from "./templates/hello-text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repo root: packages/factory-core/src -> ../../..
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ref = (p) => path.join(REPO_ROOT, "reference", p);

export const TEMPLATES = {
  blank,
  "hello-text": helloText,
  // Verified real projects, stamped out by full-fidelity folder clone.
  "kenney-platformer": {
    kind: "clone",
    from: ref("kenney-pixel-platformer"),
    description: "Kenney CC0 tile platformer: Player (Platform), Tilemap, coins, enemies.",
  },
  "cave-boy": {
    kind: "clone",
    from: ref("cave-boy"),
    description: "Scirra 'Cave Bridge' template: animated player, particles, parallax, lighting.",
  },
};

// Deterministic, dependency-free uid so two games cloned from the same source
// don't collide on uniqueId (no Date.now/Math.random — keeps builds stable).
const uidFor = (name) => {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};

/**
 * Generate a complete game project (on disk for clones, in memory for builder
 * templates). Returns a handle exposing async save() -> dir and validate().
 */
export function generateGame({ rootDir, name, template, params = {} }) {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`unknown template "${template}". Have: ${Object.keys(TEMPLATES).join(", ")}`);

  if (typeof t === "function") {
    const game = Game.create({ rootDir, name });
    t(game, params);
    return game;
  }

  if (t.kind === "clone") {
    const dir = path.join(rootDir, slug(name));
    let validation = { ok: false, errors: ["not saved yet"] };
    return {
      dir,
      async save() {
        await cloneProject(t.from, dir, { name, uid: uidFor(name) });
        validation = validateModel(await readProject(dir));
        return dir;
      },
      validate: () => validation,
    };
  }

  throw new Error(`template "${template}" has unknown kind`);
}

export { Game };
