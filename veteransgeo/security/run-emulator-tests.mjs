// No shell assignments or platform-specific quoting inside npm scripts.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const child = fileURLToPath(new URL("run-rules-modes.cjs", import.meta.url));
const quote = value => process.platform === "win32" ? '"' + value.replace(/"/g, '""') + '"' : "'" + value.replace(/'/g, "'\\''") + "'";
const result = spawnSync(process.execPath, [require.resolve("firebase-tools/lib/bin/firebase.js"),
  "emulators:exec", "--project", "demo-veteransgeo", "--only", "database,storage", `${quote(process.execPath)} ${quote(child)}`,
], { stdio: "inherit", windowsHide: true });
process.exitCode = result.status ?? 2;
