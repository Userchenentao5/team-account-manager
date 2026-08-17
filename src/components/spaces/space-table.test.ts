import { describe, expect, it, vi } from "vitest";
import { seatUsageStatus } from "./seat-usage";
import { matchesAccountSearch } from "./space-table";

vi.mock("@/actions/spaces", () => ({
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  updateSpace: vi.fn(),
}));

describe("space account search", () => {
  const row = {
    motherAccount: { email: "Owner@Example.com" },
    childEmails: ["member.one@example.com", "member.two@example.com"],
    childContacts: ["WeChat-Alpha", "telegram_beta"],
  };

  it("matches mother email, child email, and child contact fragments", () => {
    expect(matchesAccountSearch(row, "OWNER@EXA")).toBe(true);
    expect(matchesAccountSearch(row, "ONE@EXAMPLE")).toBe(true);
    expect(matchesAccountSearch(row, "wechat-alpha")).toBe(true);
    expect(matchesAccountSearch(row, "  TELEGRAM_BETA  ")).toBe(true);
    expect(matchesAccountSearch(row, "missing@example.com")).toBe(false);
  });
});

describe("seat usage status", () => {
  it("ranks over-capacity above under-capacity and treats full capacity as normal", () => {
    expect(seatUsageStatus(3, 2)).toBe("over");
    expect(seatUsageStatus(0, 2)).toBe("under");
    expect(seatUsageStatus(2, 2)).toBe("full");
  });
});
