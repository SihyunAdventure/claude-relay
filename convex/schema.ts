import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    status: v.union(
      v.literal("active"),
      v.literal("idle"),
      v.literal("offline")
    ),
    workingDir: v.string(),
    title: v.optional(v.string()),
    agentSessionId: v.optional(v.string()), // Claude Agent SDK session ID for resume
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  }).index("by_status", ["status"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    status: v.union(
      v.literal("pending"),   // user message waiting for relay
      v.literal("streaming"), // assistant is streaming
      v.literal("complete"),  // done
      v.literal("error")     // failed
    ),
    // AskUserQuestion 메타데이터 (JSON string)
    questionData: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_pending", ["status", "timestamp"]),
});
