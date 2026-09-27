import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({
  space: vi.fn(),
  childAccount: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/reminders/space-expiry-reminder-job", () => ({
  runSpaceExpiryReminderJob: jobs.space,
}));
vi.mock("@/lib/reminders/child-account-payment-reminder-job", () => ({
  runChildAccountPaymentReminderJob: jobs.childAccount,
}));

import { startSpaceExpiryReminderScheduler } from "./space-expiry-reminder-scheduler";

describe("reminder scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("npm_lifecycle_event", "dev");
    vi.stubGlobal("spaceExpiryReminderScheduler", undefined);
    jobs.space.mockReset().mockResolvedValue({ checked: true, sent: 0 });
    jobs.childAccount.mockReset().mockResolvedValue({ checked: true, sent: 0 });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("checks on startup and once per minute with only one scheduler", async () => {
    startSpaceExpiryReminderScheduler();
    startSpaceExpiryReminderScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(jobs.space).toHaveBeenCalledTimes(1);
    expect(jobs.childAccount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(jobs.space).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(jobs.space).toHaveBeenCalledTimes(2);
    expect(jobs.childAccount).toHaveBeenCalledTimes(2);
  });

  it("waits for an in-flight send even if the other job fails, then resumes", async () => {
    const error = new Error("SMTP unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    jobs.space.mockRejectedValueOnce(error);
    let finishSend!: () => void;
    jobs.childAccount.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishSend = resolve;
    }));

    startSpaceExpiryReminderScheduler();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(jobs.space).toHaveBeenCalledTimes(1);
    expect(jobs.childAccount).toHaveBeenCalledTimes(1);

    finishSend();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(log).toHaveBeenCalledWith("reminder scheduler failed", error);
    expect(jobs.space).toHaveBeenCalledTimes(2);
    expect(jobs.childAccount).toHaveBeenCalledTimes(2);
  });
});
