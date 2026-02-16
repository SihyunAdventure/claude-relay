import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { startRelay } from "./index.js";

const ROOT = resolve(import.meta.dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env.local");
const WEB_URL = "https://relaycode.vercel.app";

function log(msg: string) {
  console.log(`  ${msg}`);
}

function banner() {
  console.log("\n\x1b[1m🚀 RelayCode\x1b[0m");
  console.log("  모바일에서 맥북의 Claude Code를 사용하세요\n");
}

function getConvexUrl(): string | null {
  if (!existsSync(ENV_FILE)) return null;
  const content = readFileSync(ENV_FILE, "utf-8");
  const match = content.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
  return match ? match[1].trim() : null;
}

function setupConvex() {
  console.log("\x1b[33m[1/2] Convex 설정\x1b[0m\n");
  log("Convex 계정이 필요합니다.");
  log("계정이 없으면: \x1b[4mhttps://convex.dev\x1b[0m 에서 무료 가입\n");
  log("Convex 프로젝트를 생성합니다...\n");

  const result = spawnSync(
    "npx",
    ["convex", "dev", "--once", "--configure=new"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env },
    }
  );

  if (result.status !== 0) {
    console.error("\n\x1b[31m❌ Convex 설정 실패. 다시 시도해주세요.\x1b[0m");
    process.exit(1);
  }

  const url = getConvexUrl();
  if (!url) {
    console.error("\n\x1b[31m❌ .env.local에서 Convex URL을 찾을 수 없습니다.\x1b[0m");
    process.exit(1);
  }

  console.log(`\n  \x1b[32m✅ Convex 연결 완료\x1b[0m`);
  return url;
}

function printConnectionInfo(convexUrl: string) {
  console.log("\n\x1b[33m[2/2] 연결 정보\x1b[0m\n");
  console.log("  ┌───────────────────────────────────────────────┐");
  console.log(`  │  📱 웹:  \x1b[4m${WEB_URL}\x1b[0m`);
  console.log(`  │  🔑 URL: \x1b[36m${convexUrl}\x1b[0m`);
  console.log("  └───────────────────────────────────────────────┘");
  console.log("\n  웹에서 위 \x1b[36m연결 URL\x1b[0m을 입력하면 이 맥북에 연결됩니다.\n");
}

// --- main ---
banner();

let convexUrl = getConvexUrl();

if (!convexUrl) {
  convexUrl = setupConvex();
} else {
  console.log(`  \x1b[32m✅ Convex 설정 확인됨\x1b[0m\n`);
}

printConnectionInfo(convexUrl);
const stopRelay = startRelay(convexUrl);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n  [relay] 종료 중...");
  stopRelay();
  process.exit(0);
});
