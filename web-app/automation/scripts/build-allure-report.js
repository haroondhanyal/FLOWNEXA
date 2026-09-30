const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const node = process.execPath;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

for (const script of ["prepare-allure-metadata.mjs", "setup-allure-categories.js"]) {
  const status = run(node, [path.join(root, "scripts", script)]);
  if (status !== 0) process.exit(status);
}

const env = { ...process.env };
delete env.JAVA_HOME;
const cli = path.join(root, "node_modules", "allure-commandline", "bin", "allure");
const generated = spawnSync(node, [cli, "generate", "allure-results", "--clean", "--output", "allure-report"], {
  cwd: root,
  stdio: "inherit",
  env,
});
if (generated.error) throw generated.error;
if ((generated.status ?? 1) !== 0) process.exit(generated.status ?? 1);

for (const script of ["ensure-allure-categories-in-report.js", "customize-allure-report.mjs", "generate-db-report.mjs", "assemble-report-site.mjs"]) {
  const status = run(node, [path.join(root, "scripts", script)]);
  if (status !== 0) process.exit(status);
}
