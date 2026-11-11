import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { createNativeLiveHTTP } from "./live-http-native.mjs";
import { assertPrivateFile } from "./private-file-access.mjs";

test("native HTTPS preserves binary/JSON and credentials, rejects untrusted TLS, and never follows redirects", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "veterans-native-tls-"));
  let server;
  try {
    execFileSync(process.env.VETERANSGEO_POWERSHELL || "pwsh", ["-NoProfile", "-File", fileURLToPath(new URL("test-local-certificate.ps1", import.meta.url)), "-Directory", dir], { windowsHide: true, stdio: "pipe" });
    let hits = 0;
    server = https.createServer({ key: await readFile(path.join(dir, "key.pem")), cert: await readFile(path.join(dir, "cert.pem")) }, async (req, res) => {
      hits++;
      if (req.url === "/redirect") { res.writeHead(302, { Location: "/must-not-follow" }); res.end(); return; }
      assert.equal(req.headers.authorization, "Bearer SYNTHETIC_ONLY");
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      res.writeHead(200, { "Content-Type": "application/octet-stream" }); res.end(Buffer.concat(chunks));
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `https://127.0.0.1:${server.address().port}`;
    const client = createNativeLiveHTTP({ caFile: path.join(dir, "cert.pem") });
    const bytes = Buffer.from([0, 1, 255, 13, 10, 0, 42]);
    const r = await client.request(url, { method: "POST", headers: { Authorization: "Bearer SYNTHETIC_ONLY" }, bytes });
    assert.equal(client.evidence, "local-tls-http"); assert.equal(r.status, 200); assert.deepEqual(r.body, bytes); assert.equal(r.uploaded, bytes.length);
    const j = await client.request(url, { method: "POST", headers: { Authorization: "Bearer SYNTHETIC_ONLY" }, json: { korean: "가상 자료", count: 1 } });
    assert.deepEqual(j.json(), { korean: "가상 자료", count: 1 });
    await assert.rejects(createNativeLiveHTTP().request(url), /원문은 출력하지 않습니다/);
    const before = hits;
    assert.equal((await client.request(url + "/redirect")).status, 302);
    assert.equal(hits, before + 1);
    await assert.rejects(client.request("https://example.invalid"));
    await assert.rejects(client.request(url, { headers: { Authorization: "x\r\nInjected: y" } }));
    await assert.rejects(client.request("http://127.0.0.1"));
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});

test("Windows ACL requires restricted principals and rejects Everyone access", { skip: process.platform !== "win32" }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "veterans-private-acl-"));
  const file = path.join(dir, "synthetic.json");
  try {
    await writeFile(file, "{}");
    const shell = process.env.VETERANSGEO_POWERSHELL || "pwsh";
    const policy = "$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetAccessRuleProtection($true,$false);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow');$acl.AddAccessRule($rule);Set-Acl -LiteralPath $env:VETERANSGEO_SYNTHETIC_FILE -AclObject $acl;";
    execFileSync(shell, ["-NoProfile", "-Command", policy], { env: { ...process.env, VETERANSGEO_SYNTHETIC_FILE: file }, windowsHide: true, stdio: "pipe" });
    await assertPrivateFile(file);
    execFileSync("icacls", [file, "/grant", "*S-1-1-0:R"], { windowsHide: true, stdio: "pipe" });
    await assert.rejects(assertPrivateFile(file), /Windows ACL/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
