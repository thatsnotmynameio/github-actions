// The coverage floor, for typescript.yml: merges the coverage-final.json
// (Istanbul's json reporter) of every test job, and fails when the total of
// the lines they cover is below the floor, or when there is no data.
//
//   node coverage.mjs <floor> <coverage-final.json>...
import { readFileSync } from "node:fs";
import libCoverage from "istanbul-lib-coverage";

const [floor, ...files] = process.argv.slice(2);
const map = libCoverage.createCoverageMap({});
for (const file of files) map.merge(JSON.parse(readFileSync(file, "utf8")));
const lines = map.getCoverageSummary().lines;
if (lines.total === 0) {
  console.log("::error::No coverage data: the tests measured no line.");
  process.exit(1);
}
const total = lines.pct;
if (total >= Number(floor)) {
  console.log(`Total coverage: ${total}%, at or above the floor of ${floor}%.`);
} else {
  console.log(`::error::Total coverage ${total}% is below the floor of ${floor}%.`);
  process.exit(1);
}
