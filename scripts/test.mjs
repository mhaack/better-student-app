// Runs every scripts/test-*.mjs, so a new test file can't be forgotten in
// package.json. Each file is its own process (they set process.exitCode on
// failure); the run fails if any of them does.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dir = new URL(".", import.meta.url);
const files = readdirSync(dir).filter((f) => /^test-.+\.mjs$/.test(f)).sort();

const failed = [];
for (const file of files) {
  console.log(`\n# ${file}`);
  const { status } = spawnSync(process.execPath, [new URL(file, dir).pathname], { stdio: "inherit" });
  if (status !== 0) failed.push(file);
}

if (failed.length) {
  console.error(`\nFailed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${files.length} test files passed.`);
