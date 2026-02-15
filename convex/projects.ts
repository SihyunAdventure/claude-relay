import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .order("desc")
      .collect();
  },
});

export const sync = mutation({
  args: {
    projects: v.array(
      v.object({
        path: v.string(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const project of args.projects) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_path", (q) => q.eq("path", project.path))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { lastSeen: now });
      } else {
        await ctx.db.insert("projects", {
          path: project.path,
          name: project.name,
          lastSeen: now,
        });
      }
    }
  },
});

export const add = mutation({
  args: {
    path: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("projects", {
      path: args.path,
      name: args.name,
      lastSeen: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.path !== undefined) patch.path = args.path;
    if (args.name !== undefined) patch.name = args.name;
    await ctx.db.patch(args.projectId, patch);
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.projectId);
  },
});
