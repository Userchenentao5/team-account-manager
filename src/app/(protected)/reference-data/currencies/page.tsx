import { db } from "@/db";
import { listCurrencies } from "@/db/currencies";
import { RATE_SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { CurrencyTable } from "@/components/currencies/currency-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  return (
    <CurrencyTable
      currencies={listCurrencies(db)}
      rateCurrencies={RATE_SUPPORTED_CURRENCIES}
    />
  );
}
