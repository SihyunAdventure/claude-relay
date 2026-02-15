import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { query } from "@anthropic-ai/claude-agent-sdk";

const POLL_INTERVAL = 3000; // 3초마다 체크

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL 환경변수가 필요합니다.");
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

// 세션별 Agent SDK session ID 캐시
const sessionMap = new Map<string, string>();

let isProcessing = false;

async function poll() {
  if (isProcessing) return;

  try {
    const pending = await convex.query(api.messages.nextPending);
    if (!pending) return;

    isProcessing = true;
    console.log(`[relay] 메시지 수신: "${pending.content.slice(0, 50)}..."`);

    // 메시지 상태를 streaming으로 변경
    await convex.mutation(api.messages.updateStatus, {
      messageId: pending._id,
      status: "streaming",
    });

    // 세션 상태를 active로
    await convex.mutation(api.sessions.updateStatus, {
      sessionId: pending.sessionId,
      status: "active",
    });

    // 세션 정보에서 workingDir 가져오기
    const session = await convex.query(api.sessions.get, {
      sessionId: pending.sessionId,
    });
    const cwd = session?.workingDir || process.cwd();

    // Claude Agent SDK 호출
    const agentSessionId = sessionMap.get(pending.sessionId);
    const assistantMsgId = await convex.mutation(api.messages.addAssistant, {
      sessionId: pending.sessionId,
      content: "",
      status: "streaming",
    });

    try {
      let fullText = "";

      const response = query({
        prompt: pending.content,
        options: {
          model: "claude-sonnet-4-5-20250929",
          ...(agentSessionId ? { resume: agentSessionId } : {}),
          systemPrompt: { type: "preset", preset: "claude_code" },
          permissionMode: "bypassPermissions",
          cwd,
          maxTurns: 10,
        },
      });

      for await (const message of response) {
        if (message.type === "system" && message.subtype === "init") {
          // 새 세션 ID 저장
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
              fullText += `\n**[Tool: ${block.name}]**\n\`\`\`\n${JSON.stringify(block.input, null, 2).slice(0, 500)}\n\`\`\`\n`;
            }
          }
          // 스트리밍 업데이트
          await convex.mutation(api.messages.updateContent, {
            messageId: assistantMsgId,
            content: fullText,
            status: "streaming",
          });
        }

        // result 메시지는 완료 신호로만 사용 (텍스트는 assistant에서 이미 수집)
      }

      // 완료
      await convex.mutation(api.messages.updateContent, {
        messageId: assistantMsgId,
        content: fullText || "(응답 없음)",
        status: "complete",
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

    // 세션 상태를 idle로
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

// 시작
console.log("[relay] Claude Code Relay 시작...");
console.log(`[relay] Convex: ${convexUrl}`);
console.log(`[relay] ${POLL_INTERVAL / 1000}초마다 새 메시지 확인`);

setInterval(poll, POLL_INTERVAL);
poll(); // 즉시 첫 폴링
