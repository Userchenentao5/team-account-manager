// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrencyRow } from "@/db/currencies";
import { SpaceInlineEditor, type SpaceFormValue } from "./space-form";

vi.mock("@/actions/spaces", () => ({
  createSpace: vi.fn(),
  updateSpace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

const currencies = [
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    countryCode: "US",
    countryName: "United States",
    minorUnit: 2,
    isActive: true,
  },
] satisfies CurrencyRow[];

const space: SpaceFormValue = {
  id: 1,
  name: "Team Space",
  country: "US",
  paymentChannelId: 1,
  currencyCode: "USD",
  amountMinor: 1000,
  seatCapacity: 5,
  openingDate: "2026-09-01T09:10:11",
  currentPeriodStartDate: "2026-09-07T08:09:10",
  periodUnit: "month",
  periodCount: 1,
  motherEmail: "owner@example.com",
};

describe("SpaceInlineEditor", () => {
  it("syncs the current cycle clock when the opening time changes", () => {
    render(
      <SpaceInlineEditor
        space={space}
        channels={[{ id: 1, name: "Bank", bankCardLast4: "" }]}
        currencies={currencies}
        cancelHref="/spaces/1"
      />,
    );

    const openingDate = screen.getByLabelText(
      "首次开通时间",
    ) as HTMLInputElement;
    const currentPeriodStartDate = screen.getByLabelText(
      "当前周期开始时间",
    ) as HTMLInputElement;

    fireEvent.change(openingDate, {
      target: { value: "2026-09-01T11:22:33" },
    });

    expect(openingDate.value).toBe("2026-09-01T11:22:33.000");
    expect(currentPeriodStartDate.value).toBe("2026-09-07T11:22:33.000");
  });
});
