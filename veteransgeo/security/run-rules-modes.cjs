const { spawnSync } = require("node:child_process");
const path = require("node:path");
for (const mode of ["", "existing"]) {
  const result = spawnSync(process.execPath, ["--test", path.join(__dirname, "rules.test.cjs")], {
    stdio: "inherit", env: { ...process.env, VETERANSGEO_RULE_MODE: mode }, windowsHide: true,
  });
  if (result.status !== 0) { process.exitCode = result.status ?? 2; break; }
}
