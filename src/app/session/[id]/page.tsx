"use client";

import { ChatView } from "@/components/ChatView";
import { Id } from "../../../../convex/_generated/dataModel";
import { use } from "react";

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ChatView sessionId={id as Id<"sessions">} />;
}
