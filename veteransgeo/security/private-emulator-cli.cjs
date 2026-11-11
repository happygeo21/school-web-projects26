// Windows cannot create /dev/null symlinks without extra privileges. Discard only raw log streams.
const fs = require("node:fs");
const path = require("node:path");
const { Writable } = require("node:stream");
const { createRequire } = require("node:module");
if (process.argv[2] !== "--package" || !process.argv[3]) throw Error("External private package required");
const root = path.resolve(process.argv[3]);
const fromPackage = createRequire(path.join(root, "package.json"));
const original = fs.createWriteStream;
fs.createWriteStream = function(file, ...args) {
  if (typeof file === "string" && /^(firebase-debug(?:\.\d+)?|database-debug)\.log$/.test(path.basename(file))) {
    const sink = new Writable({ write(chunk, encoding, done) { done(); } });
    process.nextTick(() => sink.emit("open", -1));
    return sink;
  }
  return original.call(this, file, ...args);
};
fromPackage("fs-extra").createWriteStream = fs.createWriteStream;
fromPackage("firebase-tools/lib/logger.js").useFileLogger = () => "discarded-in-memory";
const cli = fromPackage.resolve("firebase-tools/lib/bin/firebase.js");
process.argv = [process.execPath, cli, ...process.argv.slice(4)];
require(cli);
