// Generate genuine JPEG/WebM files from synthetic canvas frames. No camera, real faces or network.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
export async function syntheticMedia() {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.VETERANSGEO_BROWSER ||
      (existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
  });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (r) => r.abort());
    const data = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 240;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#225580";
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = "white";
      ctx.font = "20px sans-serif";
      ctx.fillText("SYNTHETIC TEST", 40, 120);
      const image = c.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (!MediaRecorder.isTypeSupported("video/webm"))
        throw Error("WebM unavailable");
      const stream = c.captureStream(8),
        recorder = new MediaRecorder(stream, { mimeType: "video/webm" }),
        chunks = [];
      const video = await new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onerror = () => reject(Error("Synthetic recorder failed"));
        let frame = 0;
        const timer = setInterval(() => {
          ctx.fillStyle = frame++ % 2 ? "#225580" : "#137965";
          ctx.fillRect(0, 150, 320, 90);
        }, 100);
        recorder.onstop = async () => {
          clearInterval(timer);
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "video/webm" }),
            url = URL.createObjectURL(blob),
            probe = document.createElement("video");
          try {
            await new Promise((yes, no) => {
              const timeout = setTimeout(
                () => no(Error("Synthetic WebM did not decode")),
                5000,
              );
              probe.onloadeddata = () => {
                clearTimeout(timeout);
                probe.videoWidth > 0
                  ? yes()
                  : no(Error("Synthetic WebM has no frame"));
              };
              probe.onerror = () => {
                clearTimeout(timeout);
                no(Error("Synthetic WebM decode failed"));
              };
              probe.preload = "auto";
              probe.src = url;
              probe.load();
            });
            resolve([...new Uint8Array(await blob.arrayBuffer())]);
          } catch (e) {
            reject(e);
          } finally {
            probe.removeAttribute("src");
            probe.load();
            URL.revokeObjectURL(url);
          }
        };
        recorder.start();
        setTimeout(() => recorder.stop(), 800);
      });
      return { image, video };
    });
    return [
      {
        name: "image",
        type: "image/jpeg",
        bytes: Buffer.from(data.image, "base64"),
      },
      { name: "video", type: "video/webm", bytes: Buffer.from(data.video) },
    ];
  } finally {
    await browser.close();
  }
}
