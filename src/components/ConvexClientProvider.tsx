"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "relaycode-convex-url";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convexUrl, setConvexUrl] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 빌드 타임 환경변수 우선, 없으면 localStorage
    const envUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (envUrl) {
      setConvexUrl(envUrl);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConvexUrl(saved);
    }
  }, []);

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">RelayCode</h1>
            <p className="mt-2 text-sm text-zinc-400">
              맥북의 Claude Code를 모바일에서 사용하세요
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) {
                localStorage.setItem(STORAGE_KEY, input.trim());
                setConvexUrl(input.trim());
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                연결 URL
              </label>
              <input
                type="url"
                placeholder="https://your-project.convex.cloud"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              연결
            </button>
          </form>

          <details className="rounded-lg border border-zinc-800 bg-zinc-900/50">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-300">
              처음이신가요? 셋업 가이드
            </summary>
            <div className="space-y-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400">
              <div>
                <p className="font-medium text-zinc-300">1. Convex 가입</p>
                <p className="mt-0.5 text-xs">
                  <a href="https://convex.dev" target="_blank" rel="noopener" className="text-blue-400 underline">convex.dev</a>에서 무료 가입
                </p>
              </div>
              <div>
                <p className="font-medium text-zinc-300">2. 맥북에서 실행</p>
                <pre className="mt-1 overflow-x-auto rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
{`git clone https://github.com/SihyunAdventure/relaycode
cd relaycode
npm install
npm run setup`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-zinc-300">3. 연결</p>
                <p className="mt-0.5 text-xs">터미널에 표시된 URL을 위에 입력하세요</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
