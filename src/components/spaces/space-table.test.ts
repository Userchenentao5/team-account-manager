import { describe, expect, it, vi } from "vitest";
import { matchesAccountEmail } from "./space-table";

vi.mock("@/actions/spaces", () => ({
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  updateSpace: vi.fn(),
}));

describe("space email search", () => {
  const row = {
    motherAccount: { email: "Owner@Example.com" },
    childEmails: ["member.one@example.com", "member.two@example.com"],
  };

  it("matches mother and child email fragments without case sensitivity", () => {
    expect(matchesAccountEmail(row, "OWNER@EXA")).toBe(true);
    expect(matchesAccountEmail(row, "ONE@EXAMPLE")).toBe(true);
    expect(matchesAccountEmail(row, "missing@example.com")).toBe(false);
  });
});
