// Secrets travel through kernel pipes, never argv, regular files, repository or diagnostics.
import { spawn as nodeSpawn, execFile } from "node:child_process";
import { createWriteStream, constants } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { once } from "node:events";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { createNativeLiveHTTP } from "./live-http-native.mjs";
const exec = promisify(execFile);
export function createLiveHTTP({ spawn = nodeSpawn, caFile } = {}) {
  if (process.platform === "win32" && spawn === nodeSpawn) return createNativeLiveHTTP({ caFile });
  const evidence =
    spawn !== nodeSpawn
      ? "isolated-transport"
      : caFile
        ? "local-tls-http"
        : "real-service-http";
  async function request(
    url,
    { method = "GET", headers = {}, json, bytes, maxSeconds = 30 } = {},
  ) {
    const u = new URL(url),
      local = ["localhost", "127.0.0.1"].includes(u.hostname);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      (u.port && !local) ||
      (caFile && !local)
    )
      throw Error("검증된 HTTPS 테스트 요청만 허용합니다.");
    const payload =
      json !== undefined
        ? Buffer.from(JSON.stringify(json))
        : bytes
          ? Buffer.from(bytes)
          : null;
    const settings = [
      `url = ${JSON.stringify(u.href)}`,
      `request = ${JSON.stringify(method)}`,
      "silent",
      "show-error",
      'proto = "=https"',
      `max-time = ${Math.min(maxSeconds, 120)}`,
      "max-filesize = 20971520",
    ];
    for (const [k, v] of Object.entries(headers)) {
      if (!/^[A-Za-z0-9-]+$/.test(k) || /[\r\n]/.test(String(v)))
        throw Error("잘못된 요청 헤더입니다.");
      settings.push("header = " + JSON.stringify(k + ": " + v));
    }
    if (json !== undefined)
      settings.push('header = "Content-Type: application/json"');
    if (payload) settings.push('data-binary = "@-"');
    settings.push(
      'write-out = "\\nVETERANSGEO_STATUS:%{http_code}:%{size_upload}:%{size_download}:%{time_total}"',
    );
    // curl reopens a native FIFO; Node's child stdio "pipe" is a socket and cannot be reopened via /dev/fd/3.
    const dir = await mkdtemp(path.join(os.tmpdir(), "veterans-live-http-")),
      fifo = path.join(dir, "request.fifo");
    let writer;
    try {
      await exec("mkfifo", ["-m", "600", fifo]);
      return await new Promise((resolve, reject) => {
        const child = spawn(
          "curl",
          ["--config", fifo, ...(caFile ? ["--cacert", caFile] : [])],
          { stdio: ["pipe", "pipe", "pipe"] },
        );
        const chunks = [];
        let length = 0,
          finished = false;
        const fail = () => {
          if (finished) return;
          finished = true;
          child.kill();
          reject(
            Error(
              "테스트 HTTP 연결 실패: 주소·자격증명·응답 원문은 출력하지 않습니다.",
            ),
          );
        };
        child.on("error", fail);
        child.stderr.on("data", () => {});
        child.stdout.on("data", (b) => {
          length += b.length;
          if (length > 21 * 1024 ** 2) fail();
          else chunks.push(b);
        });
        child.stdin.on("error", () => {});
        child.on("close", (code) => {
          if (finished) return;
          if (code !== 0) {
            fail();
            return;
          }
          finished = true;
          const raw = Buffer.concat(chunks),
            index = raw.lastIndexOf("\nVETERANSGEO_STATUS:");
          if (index < 0) {
            reject(Error("테스트 HTTP 상태를 읽지 못했습니다."));
            return;
          }
          const [status, uploaded, downloaded, seconds] = raw
            .subarray(index + 20)
            .toString()
            .split(":");
          const body = raw.subarray(0, index);
          resolve({
            status: Number(status),
            uploaded: Number(uploaded),
            downloaded: Number(downloaded),
            seconds: Number(seconds),
            body,
            json() {
              try {
                return JSON.parse(body.toString());
              } catch {
                throw Error("테스트 응답 JSON 형식이 아닙니다.");
              }
            },
          });
        });
        writer = createWriteStream(fifo);
        writer.on("error", fail);
        writer.end(settings.join("\n") + "\n");
        child.stdin.end(payload || undefined);
      });
    } finally {
      // Also unblock a FIFO writer when curl is absent or exits before opening the pipe.
      if (writer && !writer.closed) {
        const keeper = await open(
          fifo,
          constants.O_RDWR | constants.O_NONBLOCK,
        ).catch(() => null);
        if (!writer.closed) {
          const closed = once(writer, "close").catch(() => {});
          writer.destroy();
          await closed;
        }
        await keeper?.close();
      }
      await rm(dir, { recursive: true, force: true });
    }
  }
  return { request, evidence };
}
