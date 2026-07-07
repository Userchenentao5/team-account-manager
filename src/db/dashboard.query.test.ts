import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertChannel } from "@/db/channels";
import { insertChildAccount, updateMotherSeat } from "@/db/childAccounts";
import { getDashboardOverview } from "@/db/dashboard";
import { seedCurrencies } from "@/db/seed";
import { setStatusThresholds } from "@/db/settings";
import { space } from "@/db/schema";
import { insertSpaceWithMother } from "@/db/spaces";
import { createTestDb } from "@/test/db-harness";

describe("dashboard overview aggregates (DASH-01 / DASH-02 / DASH-03 / DASH-04)", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
    seedCurrencies(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function makeSpace(
    overrides: Partial<typeof space.$inferInsert> & { name: string },
    motherEmail = `${overrides.name}@example.com`,
    motherSeatType: "codex" | "chatgpt" = "codex",
  ) {
    const channelId =
      overrides.paymentChannelId ?? insertChannel(ctx.db, "Visa").id;

    const row = insertSpaceWithMother(
      ctx.db,
      {
        name: overrides.name,
        country: overrides.country ?? "US",
        paymentChannelId: channelId,
        currencyCode: overrides.currencyCode ?? "USD",
        amountMinor: overrides.amountMinor ?? 1000,
        periodUnit: overrides.periodUnit ?? "month",
        periodCount: overrides.periodCount ?? 1,
        rateUsed: overrides.rateUsed ?? "1",
        rateAsOf: overrides.rateAsOf ?? "2026-06-28T00:00:00.000Z",
        rateSource: overrides.rateSource ?? "frankfurter",
        amountUsd: overrides.amountUsd ?? 1000,
        openingDate: overrides.openingDate ?? "2026-01-01",
        expiryDate: overrides.expiryDate ?? "2026-02-01",
      },
      motherEmail,
    );
    if (motherSeatType !== "codex") {
      updateMotherSeat(ctx.db, row.id, {
        seatType: motherSeatType,
        canChangeSeatType: true,
      });
    }
    return row;
  }

  function makeChild(
    spaceId: number,
    overrides: Partial<Parameters<typeof insertChildAccount>[1]> = {},
  ) {
    return insertChildAccount(ctx.db, {
      spaceId,
      seatType: overrides.seatType ?? "codex",
      email: overrides.email ?? `child-${spaceId}@example.com`,
      contact: overrides.contact,
      label: overrides.label ?? "Seat",
      joinedDate: overrides.joinedDate ?? "2026-01-15",
      monthlyAmountMinor: overrides.monthlyAmountMinor ?? 2000,
      monthlyCurrencyCode: overrides.monthlyCurrencyCode ?? "USD",
      monthlyRateUsed: overrides.monthlyRateUsed ?? "1",
      monthlyRateAsOf:
        overrides.monthlyRateAsOf ?? "2026-06-28T00:00:00.000Z",
      monthlyRateSource: overrides.monthlyRateSource ?? "frankfurter",
      monthlyAmountUsd: overrides.monthlyAmountUsd ?? 2000,
      monthlyPaymentDay: overrides.monthlyPaymentDay ?? 15,
      billingPeriodUnit: overrides.billingPeriodUnit ?? "month",
      billingPeriodCount: overrides.billingPeriodCount ?? 1,
      nextPaymentDate: overrides.nextPaymentDate,
    });
  }

  function bucketTotal(rows: Array<{ usdMinor: number }>) {
    return rows.reduce((sum, row) => sum + row.usdMinor, 0);
  }

  it("DASH-01 returns expired and soon spaces first while excluding normal spaces", () => {
    const visa = insertChannel(ctx.db, "Visa");
    const alipay = insertChannel(ctx.db, "Alipay");
    const expired = makeSpace({
      name: "Expired US Visa",
      country: "US",
      paymentChannelId: visa.id,
      amountUsd: 10000,
      expiryDate: "2026-06-28",
    });
    const soon = makeSpace({
      name: "Soon CN Alipay",
      country: "CN",
      paymentChannelId: alipay.id,
      amountUsd: 5000,
      expiryDate: "2026-07-04",
    });
    makeSpace({
      name: "Normal JP Visa",
      country: "JP",
      paymentChannelId: visa.id,
      currencyCode: "JPY",
      amountUsd: 3000,
      expiryDate: "2026-08-01",
    });

    const overview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));

    expect(overview.totals.renewalRiskSpaces).toBe(2);
    expect(overview.expiringSpaces.map((item) => item.id)).toEqual([
      expired.id,
      soon.id,
    ]);
    expect(overview.expiringSpaces.map((item) => item.status)).toEqual([
      "expired",
      "soon",
    ]);
    expect(overview.expiringSpaces.map((item) => item.country)).toEqual([
      "美国",
      "中国",
    ]);
  });

  it("DASH-02 and DASH-03 split space spend from rented-account revenue", () => {
    const visa = insertChannel(ctx.db, "Visa");
    const alipay = insertChannel(ctx.db, "Alipay");
    const expired = makeSpace({
      name: "Expired US Visa",
      country: "US",
      paymentChannelId: visa.id,
      currencyCode: "USD",
      amountUsd: 10000,
      expiryDate: "2026-06-28",
    });
    const soon = makeSpace({
      name: "Soon CN Alipay",
      country: "CN",
      paymentChannelId: alipay.id,
      currencyCode: "CNY",
      amountUsd: 5000,
      expiryDate: "2026-07-04",
    });
    makeSpace({
      name: "Normal JP Visa",
      country: "JP",
      paymentChannelId: visa.id,
      currencyCode: "JPY",
      amountUsd: 3000,
      expiryDate: "2026-08-01",
    });
    makeChild(expired.id, {
      seatType: "codex",
      monthlyCurrencyCode: "USD",
      monthlyAmountUsd: 2000,
    });
    makeChild(expired.id, {
      seatType: "chatgpt",
      email: "second-child@example.com",
      monthlyCurrencyCode: "CNY",
      monthlyAmountUsd: 3000,
    });
    makeChild(soon.id, {
      seatType: "chatgpt",
      monthlyCurrencyCode: "CNY",
      monthlyAmountUsd: 7000,
    });

    const overview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));

    expect(overview.totals.spacePaymentUsdMinor).toBe(18000);
    expect(overview.totals.childMonthlyRevenueUsdMinor).toBe(12000);
    expect(overview.totals.grossCashflowUsdMinor).toBe(30000);
    expect(overview.totals.netMonthlyUsdMinor).toBe(-6000);
    expect(bucketTotal(overview.distributions.byCountry)).toBe(30000);
    expect(bucketTotal(overview.distributions.byCurrency)).toBe(30000);
    expect(bucketTotal(overview.distributions.byPaymentChannel)).toBe(30000);
    expect(bucketTotal(overview.distributions.spendingByPaymentChannel)).toBe(
      18000,
    );
    expect(bucketTotal(overview.distributions.spendingBySpace)).toBe(18000);
    expect(overview.distributions.byCountry).toEqual([
      { key: "US", label: "美国", usdMinor: 15000, percentage: 50 },
      { key: "CN", label: "中国", usdMinor: 12000, percentage: 40 },
      { key: "JP", label: "日本", usdMinor: 3000, percentage: 10 },
    ]);
    expect(overview.distributions.byCurrency).toEqual([
      { key: "CNY", label: "CNY", usdMinor: 15000, percentage: 50 },
      { key: "USD", label: "USD", usdMinor: 12000, percentage: 40 },
      { key: "JPY", label: "JPY", usdMinor: 3000, percentage: 10 },
    ]);
    expect(overview.distributions.byPaymentChannel).toEqual([
      { key: String(visa.id), label: "Visa", usdMinor: 18000, percentage: 60 },
      {
        key: String(alipay.id),
        label: "Alipay",
        usdMinor: 12000,
        percentage: 40,
      },
    ]);
    expect(overview.distributions.spendingByPaymentChannel).toEqual([
      {
        key: String(visa.id),
        label: "Visa",
        usdMinor: 13000,
        percentage: 72.2,
      },
      {
        key: String(alipay.id),
        label: "Alipay",
        usdMinor: 5000,
        percentage: 27.8,
      },
    ]);
    expect(overview.distributions.spendingBySpace).toEqual([
      {
        key: String(expired.id),
        label: "Expired US Visa",
        usdMinor: 10000,
        percentage: 55.6,
      },
      {
        key: String(soon.id),
        label: "Soon CN Alipay",
        usdMinor: 5000,
        percentage: 27.8,
      },
      {
        key: expect.any(String),
        label: "Normal JP Visa",
        usdMinor: 3000,
        percentage: 16.7,
      },
    ]);
  });

  it("DASH-04 returns space, child, expiry status, and seat type counts", () => {
    const visa = insertChannel(ctx.db, "Visa");
    const expired = makeSpace({
      name: "Expired",
      paymentChannelId: visa.id,
      expiryDate: "2026-06-28",
    });
    const soon = makeSpace({
      name: "Soon",
      paymentChannelId: visa.id,
      expiryDate: "2026-07-04",
    });
    makeSpace(
      {
        name: "Normal",
        paymentChannelId: visa.id,
        expiryDate: "2026-08-01",
      },
      "normal@example.com",
      "chatgpt",
    );
    makeChild(expired.id, { seatType: "codex" });
    makeChild(soon.id, { seatType: "chatgpt" });
    makeChild(soon.id, {
      seatType: "chatgpt",
      email: "second@example.com",
    });

    const overview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));

    expect(overview.totals.totalSpaces).toBe(3);
    expect(overview.totals.totalChildAccounts).toBe(3);
    expect(overview.counts.spacesByExpiryStatus).toEqual({
      expired: 1,
      soon: 1,
      normal: 1,
    });
    expect(overview.counts.childAccountsBySeatType).toEqual({
      codex: 1,
      chatgpt: 2,
    });
    expect(overview.counts.motherAccountsBySeatType).toEqual({
      codex: 2,
      chatgpt: 1,
    });
    expect(overview.counts.allAccountsBySeatType).toEqual({
      codex: 3,
      chatgpt: 3,
    });
    expect(overview.counts.childAccountsByUse).toEqual({
      rented: 3,
      selfUse: 0,
    });
  });

  it("tracks rented child-account expiry risk while excluding self-use accounts", () => {
    const visa = insertChannel(ctx.db, "Visa");
    const active = makeSpace({
      name: "Active",
      paymentChannelId: visa.id,
      expiryDate: "2026-08-01",
    });
    const overdue = makeChild(active.id, {
      email: "overdue@example.com",
      monthlyAmountUsd: 2500,
      nextPaymentDate: "2026-06-28",
    });
    const due = makeChild(active.id, {
      email: "due@example.com",
      monthlyAmountUsd: 1500,
      nextPaymentDate: "2026-07-01",
    });
    const soon = makeChild(active.id, {
      email: "soon@example.com",
      monthlyAmountUsd: 3000,
      nextPaymentDate: "2026-07-05",
    });
    makeChild(active.id, {
      email: "self@example.com",
      contact: "",
      monthlyAmountMinor: 0,
      monthlyAmountUsd: 0,
      monthlyRateSource: "self-use",
      nextPaymentDate: "2026-06-28",
    });

    const overview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));

    expect(overview.totals.renewalRiskChildAccounts).toBe(3);
    expect(overview.totals.childMonthlyRevenueUsdMinor).toBe(7000);
    expect(overview.totals.rentedChildAccounts).toBe(3);
    expect(overview.totals.selfUseChildAccounts).toBe(1);
    expect(overview.counts.childAccountsByExpiryStatus).toEqual({
      expired: 1,
      due: 1,
      soon: 1,
      normal: 0,
    });
    expect(overview.expiringChildAccounts.map((item) => item.id)).toEqual([
      overdue.id,
      due.id,
      soon.id,
    ]);
    expect(overview.expiringChildAccounts.map((item) => item.status)).toEqual([
      "expired",
      "due",
      "soon",
    ]);
  });

  it("uses the configured space expiry threshold", () => {
    makeSpace({
      name: "Threshold Space",
      expiryDate: "2026-07-10",
    });

    const defaultOverview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));
    expect(defaultOverview.totals.renewalRiskSpaces).toBe(0);

    setStatusThresholds(ctx.db, {
      spaceSoonDays: 9,
      childAccountSoonDays: 7,
    });
    const configuredOverview = getDashboardOverview(
      ctx.db,
      new Date(2026, 6, 1),
    );

    expect(configuredOverview.totals.renewalRiskSpaces).toBe(1);
    expect(configuredOverview.thresholds.spaceSoonDays).toBe(9);
  });

  it("returns stable zero totals and empty lists for an empty dashboard", () => {
    const overview = getDashboardOverview(ctx.db, new Date(2026, 6, 1));

    expect(overview.totals).toEqual({
      renewalRiskSpaces: 0,
      renewalRiskChildAccounts: 0,
      grossCashflowUsdMinor: 0,
      spacePaymentUsdMinor: 0,
      childMonthlyRevenueUsdMinor: 0,
      netMonthlyUsdMinor: 0,
      totalSpaces: 0,
      totalChildAccounts: 0,
      rentedChildAccounts: 0,
      selfUseChildAccounts: 0,
    });
    expect(overview.expiringSpaces).toEqual([]);
    expect(overview.expiringChildAccounts).toEqual([]);
    expect(overview.distributions.byCountry).toEqual([]);
    expect(overview.distributions.byCurrency).toEqual([]);
    expect(overview.distributions.byPaymentChannel).toEqual([]);
    expect(overview.distributions.spendingByPaymentChannel).toEqual([]);
    expect(overview.distributions.spendingBySpace).toEqual([]);
    expect(overview.counts.spacesByExpiryStatus).toEqual({
      expired: 0,
      soon: 0,
      normal: 0,
    });
    expect(overview.counts.childAccountsBySeatType).toEqual({
      codex: 0,
      chatgpt: 0,
    });
    expect(overview.counts.motherAccountsBySeatType).toEqual({
      codex: 0,
      chatgpt: 0,
    });
    expect(overview.counts.allAccountsBySeatType).toEqual({
      codex: 0,
      chatgpt: 0,
    });
    expect(overview.counts.childAccountsByUse).toEqual({
      rented: 0,
      selfUse: 0,
    });
    expect(overview.counts.childAccountsByExpiryStatus).toEqual({
      expired: 0,
      due: 0,
      soon: 0,
      normal: 0,
    });
  });
});
