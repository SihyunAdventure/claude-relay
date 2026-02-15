"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionList() {
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [workingDir, setWorkingDir] = useState("");
  const [title, setTitle] = useState("");

  const handleCreate = async () => {
    if (!workingDir.trim()) return;
    setCreating(true);
    try {
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
            <input
              type="text"
              placeholder="/Users/sihyunkim/Documents/Activate/Side/bookbookbook"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
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
            <button
              key={session._id}
              onClick={() => router.push(`/session/${session._id}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
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
          ))}
        </div>
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
