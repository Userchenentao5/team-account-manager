import { and, asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { differenceInCalendarDays } from "date-fns";
import {
  childAccount,
  childAccountReminderLog,
  childAccountReminderSubscription,
  currency,
  space,
} from "./schema";

type Db = BetterSQLite3Database<Record<string, unknown>>;

export type ChildAccountReminderOption = {
  childAccountId: number;
  spaceName: string;
  childAccountEmail: string;
  childAccountContact: string;
  childAccountLabel: string;
};

export type ChildAccountReminderSubscription = ChildAccountReminderOption & {
  email: string;
};

export type ChildAccountPaymentReminderRow = ChildAccountReminderOption & {
  nextPaymentDate: string;
  daysUntilPayment: number;
  amountMinor: number;
  currencyCode: string;
  currencyMinorUnit: number;
};

function localDateFromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function listChildAccountReminderOptions(
  db: Db,
): ChildAccountReminderOption[] {
  return db
    .select({
      childAccountId: childAccount.id,
      spaceName: space.name,
      childAccountEmail: childAccount.email,
      childAccountContact: childAccount.contact,
      childAccountLabel: childAccount.label,
    })
    .from(childAccount)
    .innerJoin(space, eq(space.id, childAccount.spaceId))
    .orderBy(asc(space.name), asc(childAccount.email))
    .all();
}

export function listChildAccountReminderSubscriptions(
  db: Db,
): ChildAccountReminderSubscription[] {
  return db
    .select({
      childAccountId: childAccount.id,
      spaceName: space.name,
      childAccountEmail: childAccount.email,
      childAccountContact: childAccount.contact,
      childAccountLabel: childAccount.label,
      email: childAccountReminderSubscription.email,
    })
    .from(childAccountReminderSubscription)
    .innerJoin(
      childAccount,
      eq(childAccount.id, childAccountReminderSubscription.childAccountId),
    )
    .innerJoin(space, eq(space.id, childAccount.spaceId))
    .orderBy(asc(space.name), asc(childAccount.email))
    .all();
}

export function upsertChildAccountReminderSubscription(
  db: Db,
  input: { childAccountId: number; email: string },
): void {
  db.insert(childAccountReminderSubscription)
    .values({
      childAccountId: input.childAccountId,
      email: input.email.trim(),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: childAccountReminderSubscription.childAccountId,
      set: {
        email: input.email.trim(),
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
}

export function deleteChildAccountReminderSubscription(
  db: Db,
  childAccountId: number,
): void {
  db.delete(childAccountReminderSubscription)
    .where(eq(childAccountReminderSubscription.childAccountId, childAccountId))
    .run();
}

export function getChildAccountReminderSubscriptionEmail(
  db: Db,
  childAccountId: number,
): string | undefined {
  return db
    .select({ email: childAccountReminderSubscription.email })
    .from(childAccountReminderSubscription)
    .where(eq(childAccountReminderSubscription.childAccountId, childAccountId))
    .get()?.email;
}

export function listDueChildAccountPaymentReminders(
  db: Db,
  today = new Date(),
): ChildAccountPaymentReminderRow[] {
  return db
    .select({
      childAccountId: childAccount.id,
      spaceName: space.name,
      childAccountEmail: childAccount.email,
      childAccountContact: childAccount.contact,
      childAccountLabel: childAccount.label,
      nextPaymentDate: childAccount.nextPaymentDate,
      amountMinor: childAccount.monthlyAmountMinor,
      currencyCode: childAccount.monthlyCurrencyCode,
      currencyMinorUnit: currency.minorUnit,
    })
    .from(childAccount)
    .innerJoin(space, eq(space.id, childAccount.spaceId))
    .innerJoin(currency, eq(currency.code, childAccount.monthlyCurrencyCode))
    .orderBy(asc(childAccount.nextPaymentDate), asc(space.name))
    .all()
    .flatMap((row) => {
      if (!row.nextPaymentDate) return [];
      const daysUntilPayment = differenceInCalendarDays(
        localDateFromIsoDate(row.nextPaymentDate),
        today,
      );
      if (daysUntilPayment !== 0) return [];

      return [
        {
          ...row,
          nextPaymentDate: row.nextPaymentDate,
          daysUntilPayment,
        },
      ];
    });
}

export function wasChildAccountReminderSent(
  db: Db,
  childAccountId: number,
  nextPaymentDate: string,
  recipientEmail: string,
): boolean {
  const row = db
    .select({ id: childAccountReminderLog.id })
    .from(childAccountReminderLog)
    .where(
      and(
        eq(childAccountReminderLog.childAccountId, childAccountId),
        eq(childAccountReminderLog.nextPaymentDate, nextPaymentDate),
        eq(childAccountReminderLog.recipientEmail, recipientEmail),
      ),
    )
    .get();

  return row !== undefined;
}

export function recordChildAccountReminderSent(
  db: Db,
  input: {
    childAccountId: number;
    nextPaymentDate: string;
    recipientEmail: string;
    sentAt: Date;
  },
): void {
  db.insert(childAccountReminderLog)
    .values({
      childAccountId: input.childAccountId,
      nextPaymentDate: input.nextPaymentDate,
      recipientEmail: input.recipientEmail,
      sentAt: input.sentAt.toISOString(),
    })
    .onConflictDoNothing()
    .run();
}
