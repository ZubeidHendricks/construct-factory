// Validate a project folder passed on the CLI: `npm run verify -- <dir>`
import { Game } from "@construct-factory/c3-builder";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node verify/validate.js <project-folder>");
  process.exit(2);
}

const game = await Game.open(dir);
const v = game.validate();
console.log(JSON.stringify(v, null, 2));
process.exit(v.ok ? 0 : 1);
