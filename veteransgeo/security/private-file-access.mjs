import { lstat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const execute = promisify(execFile);
export async function assertPrivateFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error("비공개 일반 파일만 사용하세요.");
  if (process.platform !== "win32") {
    if (stat.mode & 0o077) throw Error("테스트 설정 파일 권한을 0600으로 제한하세요.");
    return;
  }
  try {
    const { stdout } = await execute(process.env.VETERANSGEO_POWERSHELL || "pwsh", [
      "-NoProfile", "-NonInteractive", "-File", fileURLToPath(new URL("private-file-access.ps1", import.meta.url)), "-LiteralPath", file,
    ], { windowsHide: true, timeout: 15000, maxBuffer: 4096 });
    if (stdout.trim() !== "private-windows-acl-verified") throw Error();
  } catch { throw Error("비공개 파일 Windows ACL 검사 실패: PowerShell 7과 파일 권한을 확인하세요."); }
}
