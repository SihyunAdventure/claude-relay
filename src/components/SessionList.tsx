"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PATHS_KEY = "relaycode-recent-paths";

const MODEL_LABELS: Record<string, string> = {
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-5-20250929": "Sonnet 4.5",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(timestamp).toLocaleDateString("ko-KR");
}

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
  const projects = useQuery(api.projects.list);
  const createSession = useMutation(api.sessions.create);
  const archiveSession = useMutation(api.sessions.archive);
  const unarchiveSession = useMutation(api.sessions.unarchive);
  const removeSession = useMutation(api.sessions.remove);
  const addProject = useMutation(api.projects.add);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [workingDir, setWorkingDir] = useState("");
  const [title, setTitle] = useState("");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editPath, setEditPath] = useState("");
  const [editName, setEditName] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [permissionMode, setPermissionMode] = useState("bypassPermissions");

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
        model,
        permissionMode,
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
        <h1 className="text-xl font-bold text-white">RelayCode</h1>
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
              프로젝트 선택
            </label>
            {/* 프로젝트 목록 (Relay 스캔 + 수동 등록) */}
            {projects && projects.length > 0 ? (
              <div>
                <input
                  type="text"
                  placeholder="프로젝트 검색..."
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 p-1.5">
                  {projects
                    .filter((p) =>
                      !projectFilter ||
                      p.name.toLowerCase().includes(projectFilter.toLowerCase()) ||
                      p.path.toLowerCase().includes(projectFilter.toLowerCase())
                    )
                    .map((p) => (
                      <div key={p._id} className="group flex items-center gap-1">
                        {editingProject === p._id ? (
                          <div className="flex-1 space-y-1.5 rounded-md bg-zinc-700/50 p-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="이름"
                              className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={editPath}
                              onChange={(e) => setEditPath(e.target.value)}
                              placeholder="절대 경로"
                              className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  await updateProject({
                                    projectId: p._id,
                                    path: editPath.trim(),
                                    name: editName.trim(),
                                  });
                                  setEditingProject(null);
                                }}
                                className="rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white hover:bg-blue-500"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setEditingProject(null)}
                                className="rounded bg-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-500"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setWorkingDir(p.path);
                                setTitle(p.name);
                                setProjectFilter("");
                              }}
                              className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                                workingDir === p.path
                                  ? "bg-blue-600/20 text-blue-400"
                                  : "text-zinc-300 hover:bg-zinc-700"
                              }`}
                            >
                              <span className="shrink-0 text-zinc-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 3h7l2 2h9v16H3z" />
                                </svg>
                              </span>
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="ml-auto shrink-0 truncate text-[10px] text-zinc-600 max-w-[120px]">{p.path.replace(/^\/Users\/[^/]+/, "~")}</span>
                            </button>
                            {/* 수정/삭제 버튼 */}
                            <button
                              onClick={() => {
                                setEditingProject(p._id);
                                setEditPath(p.path);
                                setEditName(p.name);
                              }}
                              className="shrink-0 rounded p-1 text-zinc-600 opacity-0 transition-all hover:text-zinc-300 group-hover:opacity-100"
                              title="수정"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeProject({ projectId: p._id })}
                              className="shrink-0 rounded p-1 text-zinc-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                              title="삭제"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="mb-2 text-[11px] text-zinc-500">
                {projects === undefined ? "로딩 중..." : "Relay를 실행하면 로컬 프로젝트가 자동 등록됩니다"}
              </p>
            )}
            {/* 폴더 직접 추가 */}
            {showAddProject ? (
              <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-2.5">
                <input
                  type="text"
                  placeholder="절대 경로 (예: /Users/me/my-project)"
                  value={newProjectPath}
                  onChange={(e) => {
                    setNewProjectPath(e.target.value);
                    if (!newProjectName) {
                      setNewProjectName(e.target.value.split("/").pop() || "");
                    }
                  }}
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="이름 (자동 입력)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      if (!newProjectPath.trim()) return;
                      await addProject({
                        path: newProjectPath.trim(),
                        name: newProjectName.trim() || newProjectPath.trim().split("/").pop() || "프로젝트",
                      });
                      setWorkingDir(newProjectPath.trim());
                      setTitle(newProjectName.trim() || newProjectPath.trim().split("/").pop() || "");
                      setNewProjectPath("");
                      setNewProjectName("");
                      setShowAddProject(false);
                    }}
                    disabled={!newProjectPath.trim()}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => { setShowAddProject(false); setNewProjectPath(""); setNewProjectName(""); }}
                    className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddProject(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                폴더 직접 추가
              </button>
            )}
            {/* 선택된 경로 표시 */}
            {workingDir && (
              <p className="mt-2 text-[10px] text-zinc-500 truncate">선택: {workingDir}</p>
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
          <div>
            <label className="mb-1 block text-xs text-zinc-400">모델</label>
            <ModelSelector value={model} onChange={setModel} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">권한 모드</label>
            <PermissionModeSelector value={permissionMode} onChange={setPermissionMode} />
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
                className="flex min-w-0 flex-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
              >
                <div className="mt-1 shrink-0">
                  <StatusDot status={session.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-white">
                      {session.title || "세션"}
                    </p>
                    {session.model && (
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {MODEL_LABELS[session.model] || session.model}
                      </span>
                    )}
                  </div>
                  {session.lastMessagePreview && (
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {session.lastMessageRole === "user" ? "나: " : ""}
                      {session.lastMessagePreview}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>{formatRelativeTime(session.lastActiveAt)}</span>
                    {session.messageCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{session.messageCount}개 메시지</span>
                      </>
                    )}
                  </div>
                </div>
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
  const isOnline = status === "active" || status === "idle";

  return (
    <span className="relative flex h-3 w-3">
      {isOnline && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${isOnline ? "bg-green-500" : "bg-zinc-600"}`} />
    </span>
  );
}

const MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {MODELS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
            value === m.id
              ? "border-blue-500 bg-blue-600/20 text-blue-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const PERMISSION_MODES = [
  { id: "bypassPermissions", label: "자동 승인", desc: "모든 작업 자동 실행" },
  { id: "default", label: "승인 필요", desc: "파일 수정/실행 시 확인" },
  { id: "plan", label: "계획 모드", desc: "계획 수립 후 승인" },
];

function PermissionModeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {PERMISSION_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          title={m.desc}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
            value === m.id
              ? "border-blue-500 bg-blue-600/20 text-blue-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function ResetButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem("relaycode-convex-url");
        window.location.reload();
      }}
      className="w-full pt-4 text-center text-xs text-zinc-600 hover:text-zinc-400"
    >
      Convex 연결 초기화
    </button>
  );
}
