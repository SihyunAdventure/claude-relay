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

const PERM_MODES = [
  { id: "bypassPermissions", label: "자동 승인", desc: "모든 작업 자동 실행" },
  { id: "default", label: "승인 필요", desc: "파일 수정/실행 시 확인" },
  { id: "plan", label: "계획 모드", desc: "계획 수립 후 승인" },
];

const PERM_LABELS: Record<string, string> = Object.fromEntries(
  PERM_MODES.map((m) => [m.id, m.label])
);

export function ChatView({ sessionId }: { sessionId: Id<"sessions"> }) {
  const session = useQuery(api.sessions.get, { sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const cancelStreaming = useMutation(api.messages.cancelStreaming);
  const updateModel = useMutation(api.sessions.updateModel);
  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showPermPicker, setShowPermPicker] = useState(false);
  const updatePermissionMode = useMutation(api.sessions.updatePermissionMode);
  const [sending, setSending] = useState(false);
  const [wizardMsgId, setWizardMsgId] = useState<string | null>(null);
  const [answeredMsgIds, setAnsweredMsgIds] = useState<Set<string>>(new Set());
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

  // Relay 미연결 감지: pending 메시지가 10초 이상 대기 중이면 경고
  const [relayWarning, setRelayWarning] = useState(false);
  const pendingMessage = messages?.find((m) => m.role === "user" && m.status === "pending");
  useEffect(() => {
    if (!pendingMessage) {
      setRelayWarning(false);
      return;
    }
    const elapsed = Date.now() - pendingMessage.timestamp;
    if (elapsed > 10000) {
      setRelayWarning(true);
      return;
    }
    const timer = setTimeout(() => setRelayWarning(true), 10000 - elapsed);
    return () => clearTimeout(timer);
  }, [pendingMessage]);

  return (
    <div className="relative flex h-screen flex-col bg-zinc-950">
      {/* Question Wizard Overlay */}
      {wizardMsgId && (() => {
        const wizardMsg = messages?.find((m) => m._id === wizardMsgId);
        if (!wizardMsg?.questionData) return null;
        let parsedQuestions: Array<{ question: string; options?: Array<{ label: string; description?: string }> }>;
        try { parsedQuestions = JSON.parse(wizardMsg.questionData); } catch { return null; }
        return (
          <QuestionWizard
            questions={parsedQuestions}
            onSubmit={async (answers) => {
              setWizardMsgId(null);
              setAnsweredMsgIds((prev) => new Set(prev).add(wizardMsgId));
              await sendMessage({ sessionId, content: answers });
              inputRef.current?.focus();
            }}
            onClose={() => setWizardMsgId(null)}
          />
        );
      })()}
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
              onClick={() => { setShowModelPicker(!showModelPicker); setShowPermPicker(false); }}
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
        {/* 권한 모드 선택 */}
        {session && (
          <div className="relative">
            <button
              onClick={() => { setShowPermPicker(!showPermPicker); setShowModelPicker(false); }}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              {PERM_LABELS[session.permissionMode || "bypassPermissions"] || "자동 승인"}
            </button>
            {showPermPicker && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                {PERM_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      await updatePermissionMode({ sessionId, permissionMode: m.id });
                      setShowPermPicker(false);
                    }}
                    className={`flex w-full flex-col items-start rounded-md px-3 py-1.5 text-left transition-colors ${
                      (session.permissionMode || "bypassPermissions") === m.id
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-xs">{m.label}</span>
                    <span className="text-[10px] text-zinc-500">{m.desc}</span>
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
          <>
          {relayWarning && (
            <div className="mx-4 mt-2 rounded-lg border border-yellow-600/30 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-400">
              Relay가 응답하지 않습니다. 로컬에서 relay를 실행해주세요.
              <code className="ml-1 rounded bg-yellow-900/30 px-1.5 py-0.5 text-xs">npm run setup</code>
            </div>
          )}
          <div className="space-y-4">
            {messages.map((msg) => {
              const hasQ = !!msg.questionData && msg.role === "assistant";
              return (
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  hasQuestion={hasQ}
                  answered={answeredMsgIds.has(msg._id)}
                  onOpenWizard={() => setWizardMsgId(msg._id)}
                />
              );
            })}
          </div>
          </>
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
  hasQuestion,
  onOpenWizard,
  answered,
}: {
  message: {
    role: string;
    content: string;
    status: string;
    timestamp: number;
    questionData?: string;
  };
  hasQuestion?: boolean;
  onOpenWizard?: () => void;
  answered?: boolean;
}) {
  const isUser = message.role === "user";

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
            <ContentRenderer
              content={message.content}
              isStreaming={message.status === "streaming"}
            />
          )}
        </div>

        {/* 질문이 있으면 답변하기 버튼 */}
        {hasQuestion && !answered && (
          <div className="mt-3">
            <button
              onClick={onOpenWizard}
              className="w-full rounded-lg border border-blue-500/30 bg-blue-600/10 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-600/20"
            >
              답변하기
            </button>
          </div>
        )}
        {hasQuestion && answered && (
          <div className="mt-3 rounded-lg border border-green-500/20 bg-green-900/10 px-3 py-2 text-xs text-green-400">
            답변 완료
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

function QuestionWizard({
  questions,
  onSubmit,
  onClose,
}: {
  questions: Array<{
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }>;
  onSubmit: (answers: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [useCustom, setUseCustom] = useState<Record<number, boolean>>({});
  const totalSteps = questions.length;
  const isReview = step === totalSteps;

  const currentAnswer = useCustom[step] ? customInputs[step] : answers[step];
  const canNext = !!currentAnswer?.trim();

  const handleSelectOption = (label: string) => {
    setUseCustom((prev) => ({ ...prev, [step]: false }));
    setAnswers((prev) => ({ ...prev, [step]: label }));
  };

  const handleCustomToggle = () => {
    setUseCustom((prev) => ({ ...prev, [step]: true }));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[step];
      return next;
    });
  };

  const handleSubmit = () => {
    const finalAnswers = questions.map((_, i) =>
      useCustom[i] ? customInputs[i] : answers[i]
    );
    onSubmit(finalAnswers.join("\n"));
  };

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full rounded-t-2xl border-t border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <span className="text-sm font-medium text-zinc-300">
            {isReview ? "답변 확인" : `질문 ${step + 1} / ${totalSteps}`}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {!isReview ? (
            <>
              {/* 질문 텍스트 */}
              <p className="mb-4 text-sm font-medium text-white">
                {questions[step].question}
              </p>

              {/* 옵션 선택 */}
              <div className="space-y-2">
                {questions[step].options?.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => handleSelectOption(opt.label)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      !useCustom[step] && answers[step] === opt.label
                        ? "border-blue-500 bg-blue-600/15 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      !useCustom[step] && answers[step] === opt.label
                        ? "bg-blue-500 text-white"
                        : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {oi + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-zinc-100">
                        {opt.label}
                        {oi === 0 && !opt.label.includes("Recommended") && (
                          <span className="ml-1.5 rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                            추천
                          </span>
                        )}
                      </span>
                      {opt.description && (
                        <p className="mt-0.5 text-xs text-zinc-500">{opt.description}</p>
                      )}
                    </div>
                  </button>
                ))}

                {/* 직접 입력 */}
                <button
                  onClick={handleCustomToggle}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    useCustom[step]
                      ? "border-blue-500 bg-blue-600/15 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    useCustom[step] ? "bg-blue-500 text-white" : "bg-zinc-700 text-zinc-400"
                  }`}>
                    ✎
                  </span>
                  <span className="text-zinc-400">직접 입력</span>
                </button>
                {useCustom[step] && (
                  <textarea
                    autoFocus
                    value={customInputs[step] || ""}
                    onChange={(e) =>
                      setCustomInputs((prev) => ({ ...prev, [step]: e.target.value }))
                    }
                    placeholder="답변을 입력하세요..."
                    rows={2}
                    className="mt-1 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>
            </>
          ) : (
            /* 리뷰 스텝 */
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
                  <p className="mb-1 text-xs text-zinc-500">질문 {i + 1}</p>
                  <p className="mb-2 text-sm text-zinc-300">{q.question}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-blue-600/20 px-2 py-0.5 text-sm font-medium text-blue-400">
                      {useCustom[i] ? customInputs[i] : answers[i]}
                    </span>
                    <button
                      onClick={() => setStep(i)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      수정
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer 네비게이션 */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {step === 0 ? "취소" : "이전"}
          </button>

          {/* 스텝 인디케이터 */}
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === step
                    ? "bg-blue-500"
                    : i < step || (answers[i] || (useCustom[i] && customInputs[i]))
                      ? "bg-blue-500/40"
                      : "bg-zinc-700"
                }`}
              />
            ))}
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                isReview ? "bg-blue-500" : "bg-zinc-700"
              }`}
            />
          </div>

          {isReview ? (
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              제출
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            >
              다음
            </button>
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

const TOOL_LABELS: Record<string, string> = {
  Read: "Read",
  Edit: "Update",
  Write: "Write",
  Bash: "Run",
  Glob: "Search files",
  Grep: "Search",
  Task: "Task",
  WebFetch: "Fetch",
  WebSearch: "Web search",
  AskUserQuestion: "Question",
};

function ContentRenderer({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  type Segment =
    | { type: "text"; content: string }
    | { type: "tool"; name: string; summary: string };

  const segments: Segment[] = [];
  const regex = /<!--tool:(\w+):(.*?)-->\n?/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: "text", content: text });
    }
    segments.push({ type: "tool", name: match[1], summary: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: "text", content: text });
  }

  if (segments.length === 0) {
    return isStreaming ? <p className="text-zinc-500">...</p> : null;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <Markdown key={i}>{seg.content}</Markdown>;
        }
        return (
          <div
            key={i}
            className="my-1.5 flex items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-900/60 px-3 py-1.5 text-xs not-prose"
          >
            <span className="shrink-0 rounded bg-zinc-700/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-300">
              {TOOL_LABELS[seg.name] || seg.name}
            </span>
            {seg.summary && (
              <span className="truncate text-zinc-500">{seg.summary}</span>
            )}
          </div>
        );
      })}
    </>
  );
}
