import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

const POLL_INTERVAL = 3000;

// 세션별 Agent SDK session ID 캐시
const sessionMap = new Map<string, string>();

let isProcessing = false;

// AskUserQuestion 데이터를 캡처
let pendingQuestionData: string | null = null;

function formatToolUse(name: string, input: unknown): string {
  if (name === "AskUserQuestion") {
    const q = input as {
      questions?: Array<{
        question: string;
        options?: Array<{ label: string; description?: string }>;
      }>;
    };
    if (q.questions) {
      pendingQuestionData = JSON.stringify(q.questions);
      return ""; // 질문은 위자드 UI로만 표시
    }
  }

  const summary = (() => {
    const inp = input as Record<string, unknown>;
    if (name === "Bash") return inp.command ? String(inp.command).slice(0, 80) : "";
    if (name === "Read") return inp.file_path ? String(inp.file_path) : "";
    if (name === "Edit") return inp.file_path ? String(inp.file_path) : "";
    if (name === "Write") return inp.file_path ? String(inp.file_path) : "";
    if (name === "Glob") return inp.pattern ? String(inp.pattern) : "";
    if (name === "Grep") return inp.pattern ? String(inp.pattern) : "";
    return "";
  })();
  return `\n<!--tool:${name}:${summary}-->\n`;
}

async function poll(convex: ConvexHttpClient) {
  if (isProcessing) return;

  try {
    const pending = await convex.query(api.messages.nextPending);
    if (!pending) return;

    isProcessing = true;
    console.log(`[relay] 메시지 수신: "${pending.content.slice(0, 50)}..."`);

    await convex.mutation(api.messages.updateStatus, {
      messageId: pending._id,
      status: "streaming",
    });

    await convex.mutation(api.sessions.updateStatus, {
      sessionId: pending.sessionId,
      status: "active",
    });

    const session = await convex.query(api.sessions.get, {
      sessionId: pending.sessionId,
    });
    const cwd = session?.workingDir || process.cwd();

    // 경로 유효성 검증
    if (!existsSync(cwd)) {
      console.error(`[relay] 경로가 존재하지 않음: ${cwd}`);
      const errorMsgId = await convex.mutation(api.messages.addAssistant, {
        sessionId: pending.sessionId,
        content: `경로를 찾을 수 없습니다: \`${cwd}\`\n\n올바른 절대 경로로 새 세션을 만들어주세요.`,
        status: "error",
      });
      await convex.mutation(api.messages.updateStatus, {
        messageId: pending._id,
        status: "error",
      });
      await convex.mutation(api.sessions.updateStatus, {
        sessionId: pending.sessionId,
        status: "idle",
      });
      isProcessing = false;
      return;
    }

    const agentSessionId = sessionMap.get(pending.sessionId);
    const assistantMsgId = await convex.mutation(api.messages.addAssistant, {
      sessionId: pending.sessionId,
      content: "",
      status: "streaming",
    });

    try {
      let fullText = "";
      pendingQuestionData = null;

      const model = session?.model || "claude-sonnet-4-5-20250929";
      const permissionMode = (session?.permissionMode || "bypassPermissions") as "bypassPermissions" | "default" | "plan";
      const response = query({
        prompt: pending.content,
        options: {
          model,
          ...(agentSessionId ? { resume: agentSessionId } : {}),
          systemPrompt: { type: "preset", preset: "claude_code" },
          permissionMode,
          cwd,
          env: { ...process.env } as Record<string, string>,
          maxTurns: 10,
        },
      });

      let cancelled = false;

      for await (const message of response) {
        // 취소 감지: DB에서 메시지 상태 확인
        const currentMsg = await convex.query(api.messages.getById, {
          messageId: assistantMsgId,
        });
        if (currentMsg && currentMsg.status !== "streaming") {
          console.log("[relay] 취소 감지됨, 중단합니다.");
          cancelled = true;
          break;
        }

        if (message.type === "system" && message.subtype === "init") {
          const newSessionId = message.session_id;
          sessionMap.set(pending.sessionId, newSessionId);
          await convex.mutation(api.sessions.setAgentSessionId, {
            sessionId: pending.sessionId,
            agentSessionId: newSessionId,
          });
        }

        if (message.type === "assistant" && message.message?.content) {
          const blocks = message.message.content;
          // AskUserQuestion이 포함되면 텍스트를 첫 문단만 유지 (질문은 위자드로)
          const hasAskQ = blocks.some(
            (b: Record<string, unknown>) => "name" in b && b.name === "AskUserQuestion"
          );

          for (const block of blocks) {
            if ("text" in block && block.text) {
              if (hasAskQ) {
                const firstPara = (block.text as string).split("\n\n")[0].trim();
                if (firstPara) fullText += firstPara + "\n";
              } else {
                fullText += (block.text as string) + "\n";
              }
            }
            if ("name" in block && block.input) {
              fullText += formatToolUse(block.name as string, block.input);
            }
          }
          await convex.mutation(api.messages.updateContent, {
            messageId: assistantMsgId,
            content: fullText,
            status: "streaming",
          });
        }
      }

      if (!cancelled) {
        await convex.mutation(api.messages.updateContent, {
          messageId: assistantMsgId,
          content: fullText || "(응답 없음)",
          status: "complete",
          ...(pendingQuestionData ? { questionData: pendingQuestionData } : {}),
        });
      }
      await convex.mutation(api.messages.updateStatus, {
        messageId: pending._id,
        status: "complete",
      });

      console.log(`[relay] 응답 완료 (${fullText.length}자)`);
    } catch (err) {
      console.error("[relay] Claude 호출 실패:", err);
      await convex.mutation(api.messages.updateContent, {
        messageId: assistantMsgId,
        content: `오류: ${err instanceof Error ? err.message : String(err)}`,
        status: "error",
      });
      await convex.mutation(api.messages.updateStatus, {
        messageId: pending._id,
        status: "error",
      });
    }

    await convex.mutation(api.sessions.updateStatus, {
      sessionId: pending.sessionId,
      status: "idle",
    });

    isProcessing = false;
  } catch (err) {
    console.error("[relay] 폴링 에러:", err);
    isProcessing = false;
  }
}

function scanGitProjects(): Array<{ path: string; name: string }> {
  const home = homedir();
  const scanDirs = [
    join(home, "Documents"),
    join(home, "Projects"),
    join(home, "Developer"),
    join(home, "Desktop"),
    join(home, "code"),
    join(home, "Code"),
    join(home, "dev"),
    join(home, "workspace"),
    join(home, "src"),
  ];

  const projects: Array<{ path: string; name: string }> = [];
  const maxDepth = 3;

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      if (existsSync(join(dir, ".git"))) {
        projects.push({ path: dir, name: basename(dir) });
        return; // git repo 내부는 탐색하지 않음
      }
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(".") || entry === "node_modules") continue;
        const full = join(dir, entry);
        try {
          if (statSync(full).isDirectory()) {
            walk(full, depth + 1);
          }
        } catch {
          // 권한 없는 디렉터리 무시
        }
      }
    } catch {
      // 접근 불가 디렉터리 무시
    }
  }

  for (const dir of scanDirs) {
    if (existsSync(dir)) {
      walk(dir, 0);
    }
  }

  return projects;
}

async function syncProjects(convex: ConvexHttpClient) {
  try {
    const projects = scanGitProjects();
    if (projects.length > 0) {
      await convex.mutation(api.projects.sync, { projects });
      console.log(`[relay] ${projects.length}개 프로젝트 동기화 완료`);
    }
  } catch (err) {
    console.error("[relay] 프로젝트 스캔 실패:", err);
  }
}

export function startRelay(convexUrl: string) {
  const convex = new ConvexHttpClient(convexUrl);

  console.log("[relay] Claude Code Relay 시작...");
  console.log(`[relay] Convex: ${convexUrl}`);
  console.log(`[relay] ${POLL_INTERVAL / 1000}초마다 새 메시지 확인\n`);

  // 시작 시 로컬 git 프로젝트 스캔 & 동기화
  syncProjects(convex);

  const interval = setInterval(() => poll(convex), POLL_INTERVAL);
  poll(convex);

  return () => clearInterval(interval);
}

// 직접 실행 시
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl) {
  startRelay(convexUrl);
}
