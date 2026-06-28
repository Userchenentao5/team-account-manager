import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { RateTable } from "@/components/fx/rate-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime (Pitfall 3).
export const dynamic = "force-dynamic";

export default async function RatesPage() {
  // Lazy refresh on load (D-07/D-08): serve a fresh cache as-is, otherwise attempt
  // a live refresh which itself falls back to the last good cache on failure.
  const { rates, fetchedAt, stale } = await ensureFreshRates();

  return <RateTable rates={rates} fetchedAt={fetchedAt} stale={stale} />;
}
