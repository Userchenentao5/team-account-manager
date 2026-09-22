import { describe, expect, it } from "vitest";
import {
  currentSpaceDateTimeInput,
  formatSpaceDateTime,
  isValidSpaceDateTime,
  toSpaceDateTimeInput,
  toSpaceDateTimeStorage,
} from "@/lib/space-date-time";

describe("space date-time helpers", () => {
  it("normalizes legacy dates to local midnight for the form and storage", () => {
    expect(toSpaceDateTimeInput("2026-07-14")).toBe("2026-07-14T00:00:00");
    expect(toSpaceDateTimeStorage("2026-07-14")).toBe(
      "2026-07-14T00:00:00",
    );
    expect(formatSpaceDateTime("2026-07-14")).toBe("2026-07-14 00:00:00");
  });

  it("formats canonical values for datetime-local and display", () => {
    const value = "2026-07-14T09:08:07";
    expect(toSpaceDateTimeInput(value)).toBe(value);
    expect(formatSpaceDateTime(value)).toBe("2026-07-14 09:08:07");
  });

  it("validates calendar dates and exact-to-second times", () => {
    expect(isValidSpaceDateTime("2026-02-28T23:59:59")).toBe(true);
    expect(isValidSpaceDateTime("2026-02-30T23:59:59")).toBe(false);
    expect(isValidSpaceDateTime("2026-07-14T09:08")).toBe(false);
    expect(isValidSpaceDateTime("2026-07-14T24:00:00")).toBe(false);
  });

  it("builds a local input value without converting the timezone", () => {
    expect(currentSpaceDateTimeInput(new Date(2026, 6, 14, 9, 8, 7))).toBe(
      "2026-07-14T09:08:07",
    );
  });
});
