// Smoke test: generate a game from each template, save it, re-open it, validate,
// and confirm a clean round-trip. Proves the format + builder + factory layers
// hang together end-to-end (independent of whether the PROVISIONAL schema matches C3).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGame, TEMPLATES } from "@construct-factory/factory-core";
import { Game } from "@construct-factory/c3-builder";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_ROOT = path.resolve(__dirname, "../games");

let failures = 0;
for (const template of Object.keys(TEMPLATES)) {
  const name = `Smoke ${template}`;
  const game = generateGame({ rootDir: GAMES_ROOT, name, template });
  const dir = await game.save();

  const reopened = await Game.open(dir);
  const v = reopened.validate();
  const status = v.ok ? "OK" : "FAIL";
  if (!v.ok) failures++;
  console.log(`[${status}] ${template} -> ${dir}`);
  if (!v.ok) console.log("   errors:", v.errors.join("; "));
}

console.log(failures ? `\n${failures} template(s) failed validation.` : "\nAll templates round-tripped cleanly.");
process.exit(failures ? 1 : 0);
