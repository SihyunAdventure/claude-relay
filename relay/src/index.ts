import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { query } from "@anthropic-ai/claude-agent-sdk";

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
      let text = "";
      for (const question of q.questions) {
        text += `\n${question.question}\n`;
      }
      return text;
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

    const agentSessionId = sessionMap.get(pending.sessionId);
    const assistantMsgId = await convex.mutation(api.messages.addAssistant, {
      sessionId: pending.sessionId,
      content: "",
      status: "streaming",
    });

    try {
      let fullText = "";
      pendingQuestionData = null;

      const response = query({
        prompt: pending.content,
        options: {
          model: "claude-sonnet-4-5-20250929",
          ...(agentSessionId ? { resume: agentSessionId } : {}),
          systemPrompt: { type: "preset", preset: "claude_code" },
          permissionMode: "bypassPermissions",
          cwd,
          env: { ...process.env } as Record<string, string>,
          maxTurns: 10,
        },
      });

      for await (const message of response) {
        if (message.type === "system" && message.subtype === "init") {
          const newSessionId = message.session_id;
          sessionMap.set(pending.sessionId, newSessionId);
          await convex.mutation(api.sessions.setAgentSessionId, {
            sessionId: pending.sessionId,
            agentSessionId: newSessionId,
          });
        }

        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if ("text" in block && block.text) {
              fullText += block.text + "\n";
            }
            if ("name" in block && block.input) {
              fullText += formatToolUse(block.name, block.input);
            }
          }
          await convex.mutation(api.messages.updateContent, {
            messageId: assistantMsgId,
            content: fullText,
            status: "streaming",
          });
        }
      }

      await convex.mutation(api.messages.updateContent, {
        messageId: assistantMsgId,
        content: fullText || "(응답 없음)",
        status: "complete",
        ...(pendingQuestionData ? { questionData: pendingQuestionData } : {}),
      });
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

export function startRelay(convexUrl: string) {
  const convex = new ConvexHttpClient(convexUrl);

  console.log("[relay] Claude Code Relay 시작...");
  console.log(`[relay] Convex: ${convexUrl}`);
  console.log(`[relay] ${POLL_INTERVAL / 1000}초마다 새 메시지 확인\n`);

  const interval = setInterval(() => poll(convex), POLL_INTERVAL);
  poll(convex);

  return () => clearInterval(interval);
}

// 직접 실행 시
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl) {
  startRelay(convexUrl);
}
