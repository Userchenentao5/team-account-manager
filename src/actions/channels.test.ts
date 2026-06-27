import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TestDb } from "@/test/db-harness";

// The Server Actions import the production `db` singleton and `revalidatePath`.
// Point the singleton at a fresh in-memory test DB and no-op revalidation so the
// actions can be exercised end-to-end against the harness (D-06..D-08 behaviors).
const dbHolder = vi.hoisted(() => ({ current: null as unknown as TestDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { createTestDb } from "@/test/db-harness";
import {
  addChannel,
  renameChannel,
  archiveChannel,
  reactivateChannel,
} from "@/actions/channels";
import { listChannels } from "@/db/channels";
import { paymentChannel } from "@/db/schema";

describe("channel server actions (REF-01)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    dbHolder.current = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("addChannel inserts an active row with a surrogate id", async () => {
    const res = await addChannel("支付宝");
    expect(res.ok).toBe(true);
    const rows = ctx.db.select().from(paymentChannel).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].isActive).toBe(true);
    expect(rows[0].id).toBeGreaterThan(0);
  });

  it("rejects an empty name via server-side Zod re-validation (T-03-INPUT)", async () => {
    const res = await addChannel("   ");
    expect(res.ok).toBe(false);
    expect(ctx.db.select().from(paymentChannel).all()).toHaveLength(0);
  });

  it("rejects a duplicate active name", async () => {
    await addChannel("支付宝");
    const res = await addChannel("支付宝");
    expect(res.ok).toBe(false);
    expect(ctx.db.select().from(paymentChannel).all()).toHaveLength(1);
  });

  it("archiveChannel soft-deletes: row preserved, excluded from active query (D-06/D-07)", async () => {
    await addChannel("支付宝");
    const { id } = ctx.db.select().from(paymentChannel).get()!;
    const res = await archiveChannel(id);
    expect(res.ok).toBe(true);
    expect(ctx.db.select().from(paymentChannel).all()).toHaveLength(1);
    expect(listChannels(ctx.db, false)).toHaveLength(0);
  });

  it("reactivateChannel restores an archived row to the active list (D-08)", async () => {
    await addChannel("微信");
    const { id } = ctx.db.select().from(paymentChannel).get()!;
    await archiveChannel(id);
    await reactivateChannel(id);
    expect(listChannels(ctx.db, false)).toHaveLength(1);
  });

  it("renameChannel updates name but keeps the same id (D-05)", async () => {
    await addChannel("支付宝");
    const before = ctx.db.select().from(paymentChannel).get()!;
    const res = await renameChannel(before.id, "支付宝-个人");
    expect(res.ok).toBe(true);
    const after = ctx.db.select().from(paymentChannel).get()!;
    expect(after.id).toBe(before.id);
    expect(after.name).toBe("支付宝-个人");
  });
});
