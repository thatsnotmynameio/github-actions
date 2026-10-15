// The type check's configuration, for typescript.yml: each tsconfig.json git
// tracks, and each configuration one of them reaches through references
// (as a solution-style tsconfig.json does), moves to <name>.pull-request.json
// next to it, and a generated file at its path extends it and turns the
// strictness on, so the pull request keeps its paths, module resolution and
// types but cannot turn a check off. At the root, the generated file also
// checks the base's files: its include is the union of the base's and the
// pull request's, and its exclude the base's.
//
//   node tsconfig.mjs <base tsconfig.json> <TypeScript version>
//
// The base's file is the root tsconfig.json of the base commit; a path that
// does not exist means the base has none. Prints each generated file.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { parse, printParseErrorCode } from "jsonc-parser";

const [basePath, version] = process.argv.slice(2);
const [major, minor] = version.split(".").map(Number);
const atLeast = (m, n) => major > m || (major === m && minor >= n);

// TypeScript's default when a file has no exclude.
const DEFAULT_EXCLUDE = ["node_modules", "bower_components", "jspm_packages"];
// The strict family: strict: true sets them, but an explicit false in the
// pull request's file would win over it. Each with the version that added it.
const STRICT_FAMILY = [
  ["noImplicitAny", 0, 0],
  ["noImplicitThis", 0, 0],
  ["alwaysStrict", 0, 0],
  ["strictNullChecks", 0, 0],
  ["strictFunctionTypes", 0, 0],
  ["strictBindCallApply", 0, 0],
  ["strictPropertyInitialization", 0, 0],
  ["useUnknownInCatchVariables", 4, 4],
  ["strictBuiltinIteratorReturn", 5, 6],
];
// Stricter checks outside the family, imposed when the base's root
// tsconfig.json sets them to true.
const BASE_FLAGS = [
  ["noUncheckedIndexedAccess", 4, 1],
  ["exactOptionalPropertyTypes", 4, 4],
  ["noImplicitReturns", 0, 0],
  ["noFallthroughCasesInSwitch", 0, 0],
  ["noImplicitOverride", 4, 3],
  ["noPropertyAccessFromIndexSignature", 4, 2],
  ["noUnusedLocals", 0, 0],
  ["noUnusedParameters", 0, 0],
  ["noUncheckedSideEffectImports", 5, 6],
];

function read(path) {
  const errors = [];
  const value = parse(readFileSync(path, "utf8"), errors, { allowTrailingComma: true });
  if (errors.length > 0 || value === null || typeof value !== "object" || Array.isArray(value)) {
    const reason = errors.length > 0 ? printParseErrorCode(errors[0].error) : "not an object";
    throw new Error(`${path}: not a valid tsconfig.json (${reason})`);
  }
  return value;
}

// The files a configuration selects, as written in it, extends left aside:
// its include, none when it lists files only, every file when it has neither.
function selection(config) {
  if (Array.isArray(config.include)) return config.include;
  if (Array.isArray(config.files)) return [];
  return ["**/*"];
}

const base = existsSync(basePath) ? read(basePath) : null;
const compilerOptions = { strict: true, noEmit: true, emitDeclarationOnly: false };
if (atLeast(5, 5)) compilerOptions.noCheck = false;
for (const [name, m, n] of STRICT_FAMILY) {
  if (atLeast(m, n)) compilerOptions[name] = true;
}
for (const [name, m, n] of BASE_FLAGS) {
  if (atLeast(m, n) && base?.compilerOptions?.[name] === true) compilerOptions[name] = true;
}

const tracked = execFileSync("git", ["ls-files", "-z", "--", "tsconfig.json", "*/tsconfig.json"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

// A reference names a configuration file, or a directory with a
// tsconfig.json; one outside the repository is not the pull request's to
// check.
function referenced(path, config) {
  if (!Array.isArray(config.references)) return [];
  return config.references
    .map((reference) => (typeof reference?.path === "string" ? normalize(join(dirname(path), reference.path)) : null))
    .filter((target) => target !== null && !target.startsWith(".."))
    .map((target) => (target.endsWith(".json") ? target : join(target, "tsconfig.json")))
    .filter((target) => existsSync(target));
}

const queue = [...tracked];
const seen = new Set(queue);
while (queue.length > 0) {
  const path = queue.shift();
  const renamed = join(dirname(path), `${basename(path, ".json")}.pull-request.json`);
  if (existsSync(renamed)) throw new Error(`${renamed}: the name the check moves ${path} to is taken`);
  const own = read(path);
  for (const target of referenced(path, own)) {
    if (!seen.has(target)) {
      seen.add(target);
      queue.push(target);
    }
  }
  renameSync(path, renamed);
  const generated = { extends: `./${basename(renamed)}`, compilerOptions };
  // extends does not carry references, which a files: [] configuration
  // needs to be valid.
  if (Array.isArray(own.references)) generated.references = own.references;
  if (path === "tsconfig.json") {
    generated.include = [...new Set([...(base ? selection(base) : []), ...selection(own)])];
    generated.exclude = Array.isArray(base?.exclude) ? base.exclude : DEFAULT_EXCLUDE;
  }
  writeFileSync(path, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(path);
}
