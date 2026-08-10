import { describe, expect, it, vi } from "vitest";
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
