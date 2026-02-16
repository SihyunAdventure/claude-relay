import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("sessions")
      .order("desc")
      .take(50);
    const active = all.filter((s) => !s.archived);

    // 각 세션의 마지막 메시지와 메시지 수 가져오기
    return await Promise.all(
      active.map(async (session) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .order("desc")
          .take(1);
        const lastMessage = messages[0];
        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        return {
          ...session,
          lastMessagePreview: lastMessage
            ? lastMessage.content.replace(/<!--.*?-->/g, "").trim().slice(0, 80)
            : null,
          lastMessageRole: lastMessage?.role ?? null,
          messageCount: allMessages.length,
        };
      })
    );
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("sessions")
      .order("desc")
      .take(50);
    return all.filter((s) => s.archived);
  },
});

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const create = mutation({
  args: {
    workingDir: v.string(),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    permissionMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sessions", {
      status: "idle",
      workingDir: args.workingDir,
      title: args.title,
      model: args.model,
      permissionMode: args.permissionMode,
      createdAt: now,
      lastActiveAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("active"),
      v.literal("idle"),
      v.literal("offline")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: args.status,
      lastActiveAt: Date.now(),
    });
  },
});

export const setAgentSessionId = mutation({
  args: {
    sessionId: v.id("sessions"),
    agentSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      agentSessionId: args.agentSessionId,
    });
  },
});

export const updateModel = mutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { model: args.model });
  },
});

export const updatePermissionMode = mutation({
  args: {
    sessionId: v.id("sessions"),
    permissionMode: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { permissionMode: args.permissionMode });
  },
});

export const archive = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { archived: true });
  },
});

export const unarchive = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { archived: false });
  },
});

export const remove = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    // 메시지도 함께 삭제
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});
