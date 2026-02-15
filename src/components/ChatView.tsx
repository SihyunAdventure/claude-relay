"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";

const MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  MODELS.map((m) => [m.id, m.label])
);

export function ChatView({ sessionId }: { sessionId: Id<"sessions"> }) {
  const session = useQuery(api.sessions.get, { sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const cancelStreaming = useMutation(api.messages.cancelStreaming);
  const updateModel = useMutation(api.sessions.updateModel);
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const router = useRouter();

  // 새 메시지 올 때 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    try {
      await sendMessage({ sessionId, content: text });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const isStreaming = messages?.some((m) => m.status === "streaming");

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="text-zinc-400 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">
            {session?.title || "세션"}
          </p>
        </div>
        {/* 모델 선택 */}
        {session && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              {MODEL_LABELS[session.model || "claude-sonnet-4-5-20250929"] || "Sonnet 4.5"}
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      await updateModel({ sessionId, model: m.id });
                      setShowModelPicker(false);
                    }}
                    className={`flex w-full items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
                      (session.model || "claude-sonnet-4-5-20250929") === m.id
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {session && <StatusBadge status={session.status} />}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!messages ? (
          <div className="py-12 text-center text-zinc-500">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center text-zinc-600">
            <p className="text-4xl">💬</p>
            <p className="mt-3 text-sm">메시지를 보내서 시작하세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg._id}
                message={msg}
                onSelectOption={async (label) => {
                  await sendMessage({ sessionId, content: label });
                  inputRef.current?.focus();
                }}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          {isStreaming ? (
            <button
              onClick={() => cancelStreaming({ sessionId })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-3 text-sm text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              응답 중지 (Esc)
            </button>
          ) : (
            <>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onCompositionStart={() => { isComposing.current = true; }}
                onCompositionEnd={() => { isComposing.current = false; }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isComposing.current) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="메시지를 입력하세요"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || sending}
                className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSelectOption,
}: {
  message: {
    role: string;
    content: string;
    status: string;
    timestamp: number;
    questionData?: string;
  };
  onSelectOption?: (label: string) => void;
}) {
  const isUser = message.role === "user";

  // questionData 파싱
  const questions = message.questionData
    ? (() => {
        try {
          return JSON.parse(message.questionData) as Array<{
            question: string;
            options?: Array<{ label: string; description?: string }>;
          }>;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-100"
        }`}
      >
        <div className="prose prose-sm prose-invert max-w-none break-words text-sm leading-relaxed [&_table]:text-xs [&_pre]:bg-zinc-900 [&_pre]:p-2 [&_pre]:rounded [&_code]:text-blue-300 [&_a]:text-blue-400">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <>
              <Markdown>
                {(message.content || (message.status === "streaming" ? "..." : ""))
                  .replace(/<!--tool:.*?-->\n?/g, "")
                  .trim()}
              </Markdown>
              <ToolCalls content={message.content} />
            </>
          )}
        </div>

        {/* 선택 옵션 버튼 */}
        {questions && (
          <div className="mt-3 space-y-2">
            {questions.map((q) =>
              q.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onSelectOption?.(opt.label)}
                  className="flex w-full items-start gap-2 rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-left text-sm transition-colors hover:border-blue-500 hover:bg-zinc-700"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    {opt.description && (
                      <span className="ml-1 text-zinc-400">
                        — {opt.description}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] opacity-50">
            {new Date(message.timestamp).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.status === "streaming" && (
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-400" />
          )}
          {message.status === "error" && (
            <span className="text-[10px] text-red-400">오류</span>
          )}
          {!isUser && message.content === "(취소됨)" && (
            <span className="text-[10px] text-yellow-400">취소됨</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === "active" || status === "idle";
  const config = isOnline
    ? { label: "실행 중", color: "bg-green-500/20 text-green-400" }
    : { label: "오프라인", color: "bg-zinc-500/20 text-zinc-400" };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function ToolCalls({ content }: { content: string }) {
  const tools: Array<{ name: string; summary: string }> = [];
  const toolRegex = /<!--tool:(\w+):(.*?)-->/g;
  let m = toolRegex.exec(content);
  while (m !== null) {
    tools.push({ name: m[1], summary: m[2] });
    m = toolRegex.exec(content);
  }

  if (tools.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300 select-none">
        도구 호출 {tools.length}개
      </summary>
      <div className="mt-1.5 space-y-1">
        {tools.map((tool, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded bg-zinc-900/50 px-2 py-1 text-[11px] text-zinc-400"
          >
            <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
              {tool.name}
            </span>
            <span className="truncate">{tool.summary}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
