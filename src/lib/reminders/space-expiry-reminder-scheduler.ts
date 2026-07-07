import { runSpaceExpiryReminderJob } from "@/lib/reminders/space-expiry-reminder-job";

const CHECK_INTERVAL_MS = 60_000;

const globalForReminderScheduler = globalThis as unknown as {
  spaceExpiryReminderScheduler?: NodeJS.Timeout;
};

function shouldStartScheduler() {
  return (
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.npm_lifecycle_event !== "build"
  );
}

export function startSpaceExpiryReminderScheduler(): void {
  if (!shouldStartScheduler()) return;
  if (globalForReminderScheduler.spaceExpiryReminderScheduler) return;

  const tick = () => {
    import("@/db")
      .then(({ db }) => runSpaceExpiryReminderJob(db))
      .catch((error) => {
        console.error("space expiry reminder job failed", error);
      });
  };

  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.();
  globalForReminderScheduler.spaceExpiryReminderScheduler = timer;
}
