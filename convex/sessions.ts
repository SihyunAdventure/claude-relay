import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .order("desc")
      .take(20);
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sessions", {
      status: "idle",
      workingDir: args.workingDir,
      title: args.title,
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
