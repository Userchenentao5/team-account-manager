import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STATUS_THRESHOLDS,
  getStatusThresholds,
  setStatusThresholds,
} from "@/db/settings";
import { createTestDb } from "@/test/db-harness";

describe("status threshold settings", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("returns defaults when settings are not saved", () => {
    expect(getStatusThresholds(ctx.db)).toEqual(DEFAULT_STATUS_THRESHOLDS);
  });

  it("stores space and child-account thresholds independently", () => {
    setStatusThresholds(ctx.db, {
      spaceSoonDays: 14,
      childAccountSoonDays: 3,
    });

    expect(getStatusThresholds(ctx.db)).toEqual({
      spaceSoonDays: 14,
      childAccountSoonDays: 3,
    });
  });
});
