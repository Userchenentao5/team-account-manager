import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { listCurrencies } from "@/db/currencies";
import { getStatusThresholds } from "@/db/settings";
import { listSpaceOverview } from "@/db/space-overview";
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
  const allSpaces = listSpaceOverview(db);
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
  const cnyReferences = Object.fromEntries(
    spaces.map(({ space, cnyReference }) => [space.id, cnyReference]),
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
