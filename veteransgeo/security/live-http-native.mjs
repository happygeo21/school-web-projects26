// Windows transport: secrets and binary request bodies remain in memory, never FIFO files or argv.
import https from "node:https";
import { readFile } from "node:fs/promises";
export function createNativeLiveHTTP({ caFile } = {}) {
  return {
    evidence: caFile ? "local-tls-http" : "real-service-http",
    async request(url, { method = "GET", headers = {}, json, bytes, maxSeconds = 30 } = {}) {
      const u = new URL(url), local = ["localhost", "127.0.0.1"].includes(u.hostname);
      if (u.protocol !== "https:" || u.username || u.password || (u.port && !local) || (caFile && !local))
        throw Error("검증된 HTTPS 테스트 요청만 허용합니다.");
      for (const [key, value] of Object.entries(headers))
        if (!/^[A-Za-z0-9-]+$/.test(key) || /[\r\n]/.test(String(value))) throw Error("잘못된 요청 헤더입니다.");
      const body = json !== undefined ? Buffer.from(JSON.stringify(json)) : bytes ? Buffer.from(bytes) : undefined;
      const started = performance.now();
      // An explicit CA is limited to localhost tests. Hosted requests use Node's normal trust store.
      const ca = caFile ? await readFile(caFile) : undefined;
      return new Promise((resolve, reject) => {
        const fail = () => reject(Error("테스트 HTTP 연결 실패: 주소·자격증명·응답 원문은 출력하지 않습니다."));
        const req = https.request(u, {
          method, headers: { ...headers, ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(body ? { "Content-Length": body.length } : {}) },
          ...(ca ? { ca } : {}),
          signal: AbortSignal.timeout(Math.min(Math.max(maxSeconds, 1), 120) * 1000),
        }, response => {
          const chunks = []; let size = 0;
          response.on("error", fail);
          response.on("data", chunk => {
            size += chunk.length;
            if (size > 21 * 1024 ** 2) { req.destroy(); fail(); } else chunks.push(chunk);
          });
          response.on("end", () => {
            const received = Buffer.concat(chunks);
            resolve({ status: response.statusCode, uploaded: body?.length || 0, downloaded: received.length,
              seconds: (performance.now() - started) / 1000, body: received,
              json() { try { return JSON.parse(received.toString("utf8")); } catch { throw Error("테스트 응답 JSON 형식이 아닙니다."); } },
            });
          });
        });
        // https.request does not follow redirects; credentials never move to another host.
        req.on("error", fail); req.end(body);
      });
    },
  };
}
