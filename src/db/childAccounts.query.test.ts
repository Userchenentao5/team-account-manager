import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { insertChannel } from "@/db/channels";
import {
  deleteChildAccount,
  getChildAccount,
  insertChildAccount,
  listChildAccounts,
  updateChildAccount,
  updateMotherSeat,
} from "@/db/childAccounts";
import { seedCurrencies } from "@/db/seed";
import { childAccount, motherAccount, space } from "@/db/schema";
import { insertSpaceWithMother } from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("child account queries (ACCT-02 / ACCT-03 / SPACE-05)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeSpace(name: string) {
    const channelId = insertChannel(ctx.db, "Visa").id;

    return insertSpaceWithMother(
      ctx.db,
      {
        name,
        country: "US",
        paymentChannelId: channelId,
        currencyCode: "USD",
        amountMinor: 1000,
        periodUnit: "month",
        periodCount: 1,
        rateUsed: "1",
        rateAsOf: "2026-06-28T00:00:00.000Z",
        rateSource: "frankfurter",
        amountUsd: 1000,
        openingDate: "2026-01-01",
        expiryDate: "2026-02-01",
      },
      `${name}@example.com`,
    );
  }

  function makeChild(spaceId: number, email = "child@example.com") {
    return insertChildAccount(ctx.db, {
      spaceId,
      seatType: "codex",
      email,
      label: "Seat",
      joinedDate: "2026-01-15",
      monthlyAmountMinor: 2000,
      monthlyCurrencyCode: "USD",
      monthlyRateUsed: "1",
      monthlyRateAsOf: "2026-06-28T00:00:00.000Z",
      monthlyRateSource: "frankfurter",
      monthlyAmountUsd: 2000,
      monthlyPaymentDay: 15,
    });
  }

  it("inserts, lists, reads, updates, and deletes child accounts for one space", () => {
    const row = makeSpace("Team Pro");
    const child = makeChild(row.id);

    expect(listChildAccounts(ctx.db, row.id).map((item) => item.childAccount.id)).toEqual([
      child.id,
    ]);
    expect(getChildAccount(ctx.db, child.id)?.email).toBe("child@example.com");

    const updated = updateChildAccount(ctx.db, child.id, {
      seatType: "chatgpt",
      label: "Writer",
      monthlyPaymentDay: 20,
    });

    expect(updated.seatType).toBe("chatgpt");
    expect(updated.label).toBe("Writer");
    expect(updated.monthlyPaymentDay).toBe(20);

    deleteChildAccount(ctx.db, child.id);

    expect(getChildAccount(ctx.db, child.id)).toBeUndefined();
  });

  it("keeps child account listing scoped to the requested space", () => {
    const first = makeSpace("First Team");
    const second = makeSpace("Second Team");
    const firstChild = makeChild(first.id, "first@example.com");
    makeChild(second.id, "second@example.com");

    const rows = listChildAccounts(ctx.db, first.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.childAccount.id).toBe(firstChild.id);
    expect(rows[0]?.currency.code).toBe("USD");
  });

  it("updates only mother seat metadata and does not add child-level can_change_seat_type", () => {
    const row = makeSpace("Mother Seat");
    const child = makeChild(row.id);

    updateMotherSeat(ctx.db, row.id, {
      seatType: "chatgpt",
      canChangeSeatType: false,
    });

    const mother = ctx.db
      .select()
      .from(motherAccount)
      .where(eq(motherAccount.spaceId, row.id))
      .get();
    const childRow = getChildAccount(ctx.db, child.id);

    expect(mother?.seatType).toBe("chatgpt");
    expect(mother?.canChangeSeatType).toBe(false);
    expect(childRow).not.toHaveProperty("canChangeSeatType");
  });

  it("cascades child and mother rows when the parent space is deleted", () => {
    const row = makeSpace("Cascade All");
    makeChild(row.id, "first@example.com");
    makeChild(row.id, "second@example.com");

    ctx.db.delete(space).where(eq(space.id, row.id)).run();

    expect(
      ctx.db
        .select()
        .from(childAccount)
        .where(eq(childAccount.spaceId, row.id))
        .all(),
    ).toHaveLength(0);
    expect(
      ctx.db
        .select()
        .from(motherAccount)
        .where(eq(motherAccount.spaceId, row.id))
        .all(),
    ).toHaveLength(0);
  });
});
