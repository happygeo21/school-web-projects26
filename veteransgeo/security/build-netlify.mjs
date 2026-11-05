// Build only veteransgeo's existing public allowlist; never serve security/ or node_modules/.
import { readFile, mkdir, copyFile, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import {previewConfig,configurePreview} from "./netlify-rehearsal.mjs";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  repo = path.dirname(root),
  out = path.join(root, "_public");
const preview=previewConfig(process.env);
const { files } = JSON.parse(
  await readFile(path.join(repo, "scripts/public-files.json"), "utf8"),
);
const selected = files
  .filter((f) => f.startsWith("veteransgeo/"))
  .map((f) => f.slice("veteransgeo/".length));
await mkdir(out, { recursive: true });
if ((await readdir(out)).length)
  throw Error("기존 _public 산출물을 보존한 뒤 새 빌드를 실행하세요.");
for (const file of selected) {
  if(preview && ["firebase-config.js","media-config.js"].includes(file))continue;
  if (file.startsWith("security/") || file.includes(".."))
    throw Error("Private build path");
  const src = path.join(root, file);
  let current = root;
  for (const part of file.split("/")) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink())
      throw Error("Symlink not allowed");
  }
  if (!(await lstat(src)).isFile()) throw Error("Not a file");
  await mkdir(path.dirname(path.join(out, file)), { recursive: true });
  await copyFile(src, path.join(out, file));
}
if(preview)await configurePreview(out,preview);
console.log(
  `Netlify veteransgeo public artifact: ${selected.length} allowlisted files; no security/ files.`,
);
