import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { differenceInCalendarDays } from "date-fns";
import { paymentChannel, space } from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

export type SpaceExpiryReminderRow = {
  id: number;
  name: string;
  paymentChannelName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  amountUsdMinor: number;
};

function localDateFromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function listSpaceExpiryReminderCandidates(
  db: Db,
  thresholdDays: number,
  today = new Date(),
): SpaceExpiryReminderRow[] {
  return db
    .select({
      id: space.id,
      name: space.name,
      paymentChannelName: paymentChannel.name,
      expiryDate: space.expiryDate,
      amountUsd: space.amountUsd,
    })
    .from(space)
    .innerJoin(paymentChannel, eq(paymentChannel.id, space.paymentChannelId))
    .orderBy(asc(space.expiryDate))
    .all()
    .flatMap((row) => {
      if (!row.expiryDate) return [];
      const daysUntilExpiry = differenceInCalendarDays(
        localDateFromIsoDate(row.expiryDate),
        today,
      );
      if (daysUntilExpiry < 0 || daysUntilExpiry > thresholdDays) return [];

      return [
        {
          id: row.id,
          name: row.name,
          paymentChannelName: row.paymentChannelName,
          expiryDate: row.expiryDate,
          daysUntilExpiry,
          amountUsdMinor: row.amountUsd ?? 0,
        },
      ];
    });
}
