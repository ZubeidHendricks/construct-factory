// Convert between .c3p and project folder.
//   node verify/c3p.js pack   <folder> <out.c3p>
//   node verify/c3p.js unpack <in.c3p> <folder>
import { packC3p, unpackC3p } from "@construct-factory/c3-format";

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pack" && a && b) console.log("wrote", await packC3p(a, b));
else if (cmd === "unpack" && a && b) console.log("wrote", await unpackC3p(a, b));
else {
  console.error("usage:\n  node verify/c3p.js pack   <folder> <out.c3p>\n  node verify/c3p.js unpack <in.c3p> <folder>");
  process.exit(2);
}
