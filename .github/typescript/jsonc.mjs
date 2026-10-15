// Prints a JSONC file (JSON with comments and trailing commas, as oxlint,
// oxfmt and knip read their configuration) as JSON, for jq.
//
//   node jsonc.mjs <file>
import { readFileSync } from "node:fs";
import { parse, printParseErrorCode } from "jsonc-parser";

const [path] = process.argv.slice(2);
const errors = [];
const value = parse(readFileSync(path, "utf8"), errors, { allowTrailingComma: true });
if (errors.length > 0) {
  console.error(`${path}: not valid JSON (${printParseErrorCode(errors[0].error)})`);
  process.exit(1);
}
console.log(JSON.stringify(value));
