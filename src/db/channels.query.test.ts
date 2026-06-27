import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "@/test/db-harness";
import {
  insertChannel,
  setChannelActive,
  renameChannelRow,
  listChannels,
} from "@/db/channels";
import { paymentChannel } from "@/db/schema";

describe("channel queries (REF-01 / D-05..D-08)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("insert creates an active row with a new surrogate id", () => {
    const row = insertChannel(ctx.db, "支付宝");
    expect(row.id).toBeGreaterThan(0);
    expect(row.isActive).toBe(true);
    expect(row.name).toBe("支付宝");
  });

  it("archive (soft-delete) preserves the row but excludes it from the active list (D-06)", () => {
    const row = insertChannel(ctx.db, "支付宝");
    setChannelActive(ctx.db, row.id, false);

    // The row STILL EXISTS — soft-delete never removes it (count unchanged).
    const all = ctx.db.select().from(paymentChannel).all();
    expect(all).toHaveLength(1);

    // ...but it drops out of the active-only picker query (D-07).
    const active = listChannels(ctx.db, false);
    expect(active.find((r) => r.id === row.id)).toBeUndefined();
  });

  it("reactivate restores the row to the active list (D-08)", () => {
    const row = insertChannel(ctx.db, "微信");
    setChannelActive(ctx.db, row.id, false);
    setChannelActive(ctx.db, row.id, true);

    const active = listChannels(ctx.db, false);
    expect(active.find((r) => r.id === row.id)).toBeDefined();
  });

  it("rename keeps the same surrogate id (D-05)", () => {
    const row = insertChannel(ctx.db, "支付宝");
    const renamed = renameChannelRow(ctx.db, row.id, "支付宝-个人");
    expect(renamed.id).toBe(row.id);
    expect(renamed.name).toBe("支付宝-个人");
  });

  it("show-archived list returns all rows; active list filters is_active=1", () => {
    const a = insertChannel(ctx.db, "支付宝");
    const b = insertChannel(ctx.db, "微信");
    setChannelActive(ctx.db, b.id, false);

    expect(listChannels(ctx.db, true)).toHaveLength(2);
    const active = listChannels(ctx.db, false);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(a.id);
  });
});
