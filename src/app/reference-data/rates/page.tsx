import { ensureFreshRates } from "@/lib/fx/frankfurter";
import { parseRateBase } from "@/lib/fx/base";
import { RateTable } from "@/components/fx/rate-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime (Pitfall 3).
export const dynamic = "force-dynamic";

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string }>;
}) {
  const { base: baseParam } = await searchParams;
  const base = parseRateBase(baseParam);
  // Lazy refresh on load (D-07/D-08): serve a fresh cache as-is, otherwise attempt
  // a live refresh which itself falls back to the last good cache on failure.
  const { rates, fetchedAt, stale } = await ensureFreshRates(base);

  return <RateTable rates={rates} fetchedAt={fetchedAt} stale={stale} base={base} />;
}
