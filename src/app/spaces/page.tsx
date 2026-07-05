import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { listCurrencies } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { getStatusThresholds } from "@/db/settings";
import { listSpaceDetails } from "@/db/spaces";
import { formatCurrencyMinor } from "@/lib/currencies";
import { convertUsdMinorToCurrencyMinor } from "@/lib/money";
import { SpaceTable } from "@/components/spaces/space-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default async function SpacesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; channel?: string }>;
}) {
  const { country, channel } = await searchParams;
  const channelId = channel ? Number(channel) : undefined;
  const allSpaces = listSpaceDetails(db);
  const spaces = allSpaces.filter(({ space }) => {
    if (country && space.country !== country) return false;
    if (
      Number.isFinite(channelId) &&
      space.paymentChannelId !== channelId
    ) {
      return false;
    }
    return true;
  });
  const channels = listChannels(db);
  const currencies = listCurrencies(db);
  const thresholds = getStatusThresholds(db);
  const cnyCurrency = currencies.find((item) => item.code === "CNY");
  const cnyRate = getRate(db, "CNY");
  const cnyReferences = Object.fromEntries(
    spaces.map(({ space }) => {
      if (space.amountUsd === null || !cnyCurrency || !cnyRate) {
        return [space.id, "暂无 CNY 参考"];
      }
      const cnyMinor = convertUsdMinorToCurrencyMinor(
        space.amountUsd,
        cnyCurrency.minorUnit,
        cnyRate.rateToUsd,
      );
      return [space.id, formatCurrencyMinor(cnyMinor, cnyCurrency)];
    }),
  );

  return (
    <SpaceTable
      spaces={spaces}
      filterSpaces={allSpaces}
      channels={channels}
      currencies={currencies}
      cnyReferences={cnyReferences}
      selectedCountry={country || undefined}
      selectedChannel={Number.isFinite(channelId) ? channelId : undefined}
      spaceSoonDays={thresholds.spaceSoonDays}
    />
  );
}
