import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: "user",
      content: args.content,
      status: "pending",
      timestamp: Date.now(),
    });
  },
});

export const nextPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_pending", (q) => q.eq("status", "pending"))
      .order("asc")
      .first();
  },
});

export const updateStatus = mutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: args.status });
  },
});

export const addAssistant = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    status: v.union(
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: args.content,
      status: args.status,
      timestamp: Date.now(),
    });
  },
});

export const updateContent = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal("streaming"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { content: args.content };
    if (args.status) patch.status = args.status;
    await ctx.db.patch(args.messageId, patch);
  },
});
