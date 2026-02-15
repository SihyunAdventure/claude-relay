"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PATHS_KEY = "claude-relay-recent-paths";

function getRecentPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PATHS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentPath(path: string) {
  const paths = getRecentPaths().filter((p) => p !== path);
  paths.unshift(path);
  localStorage.setItem(PATHS_KEY, JSON.stringify(paths.slice(0, 10)));
}

export function SessionList() {
  const sessions = useQuery(api.sessions.list);
  const archivedSessions = useQuery(api.sessions.listArchived);
  const createSession = useMutation(api.sessions.create);
  const archiveSession = useMutation(api.sessions.archive);
  const unarchiveSession = useMutation(api.sessions.unarchive);
  const removeSession = useMutation(api.sessions.remove);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [workingDir, setWorkingDir] = useState("");
  const [title, setTitle] = useState("");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  useEffect(() => {
    setRecentPaths(getRecentPaths());
  }, []);

  const handleCreate = async () => {
    if (!workingDir.trim()) return;
    setCreating(true);
    try {
      saveRecentPath(workingDir.trim());
      const id = await createSession({
        workingDir: workingDir.trim(),
        title: title.trim() || workingDir.trim().split("/").pop() || "세션",
      });
      setShowForm(false);
      setWorkingDir("");
      setTitle("");
      router.push(`/session/${id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Claude Relay</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          + 새 세션
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              프로젝트 경로 (절대 경로)
            </label>
            {recentPaths.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {recentPaths.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setWorkingDir(p);
                      setTitle(p.split("/").pop() || "");
                    }}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      workingDir === p
                        ? "border-blue-500 bg-blue-600/20 text-blue-400"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {p.split("/").pop()}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="/Users/sihyunkim/Documents/Activate/Side/bookbookbook"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
            {workingDir && recentPaths.includes(workingDir) && (
              <p className="mt-1 text-[10px] text-zinc-600 truncate">{workingDir}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              세션 이름 (선택)
            </label>
            <input
              type="text"
              placeholder="프로젝트 폴더명이 기본값"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!workingDir.trim() || creating}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? "생성 중..." : "세션 생성"}
          </button>
        </div>
      )}

      {!sessions ? (
        <div className="py-12 text-center text-zinc-500">로딩 중...</div>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center text-zinc-500">
          <p className="text-lg">세션이 없습니다</p>
          <p className="mt-1 text-sm">새 세션을 만들어 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session._id} className="group flex items-center gap-1">
              <button
                onClick={() => router.push(`/session/${session._id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
              >
                <StatusDot status={session.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {session.title || `세션`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(session.lastActiveAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <span className="text-xs text-zinc-600">{session.workingDir}</span>
              </button>
              <button
                onClick={() => archiveSession({ sessionId: session._id })}
                title="아카이브"
                className="shrink-0 rounded-lg p-2 text-zinc-600 opacity-0 transition-all hover:bg-zinc-800 hover:text-zinc-400 group-hover:opacity-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="5" rx="1" />
                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                  <path d="M10 12h4" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 아카이브 */}
      {archivedSessions && archivedSessions.length > 0 && (
        <details
          open={showArchive}
          onToggle={(e) => setShowArchive((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-zinc-800"
        >
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-400">
            아카이브 ({archivedSessions.length})
          </summary>
          <div className="space-y-1.5 px-2 pb-2">
            {archivedSessions.map((session) => (
              <div key={session._id} className="flex items-center gap-1">
                <button
                  onClick={() => router.push(`/session/${session._id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/50 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-400">
                      {session.title || "세션"}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {new Date(session.lastActiveAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => unarchiveSession({ sessionId: session._id })}
                  title="복원"
                  className="shrink-0 rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (confirm("정말 삭제하시겠습니까? 모든 메시지가 함께 삭제됩니다.")) {
                      removeSession({ sessionId: session._id });
                    }
                  }}
                  title="영구 삭제"
                  className="shrink-0 rounded-lg p-2 text-zinc-600 transition-colors hover:bg-red-900/30 hover:text-red-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <ResetButton />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-green-500"
      : status === "idle"
        ? "bg-yellow-500"
        : "bg-zinc-600";

  return (
    <span className="relative flex h-3 w-3">
      {status === "active" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${color}`} />
    </span>
  );
}

function ResetButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem("claude-relay-convex-url");
        window.location.reload();
      }}
      className="w-full pt-4 text-center text-xs text-zinc-600 hover:text-zinc-400"
    >
      Convex 연결 초기화
    </button>
  );
}
