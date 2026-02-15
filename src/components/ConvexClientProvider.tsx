"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "claude-relay-convex-url";

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
      <div className="flex h-screen items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Claude Relay</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Convex URL을 입력해서 맥북에 연결하세요
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
            <input
              type="url"
              placeholder="https://your-project.convex.cloud"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-500"
            >
              연결
            </button>
          </form>
          <p className="text-center text-xs text-zinc-500">
            .env.local의 NEXT_PUBLIC_CONVEX_URL 값을 입력하세요
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
