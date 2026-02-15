"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ChatView({ sessionId }: { sessionId: Id<"sessions"> }) {
  const session = useQuery(api.sessions.get, { sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const [input, setInput] = useState("");
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
            placeholder={isStreaming ? "응답 대기 중..." : "메시지를 입력하세요"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || sending || isStreaming}
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
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content || (message.status === "streaming" ? "..." : "")}
        </p>

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
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { label: "실행 중", color: "bg-green-500/20 text-green-400" },
    idle: { label: "대기", color: "bg-yellow-500/20 text-yellow-400" },
    offline: { label: "오프라인", color: "bg-zinc-500/20 text-zinc-400" },
  }[status] ?? { label: status, color: "bg-zinc-500/20 text-zinc-400" };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
