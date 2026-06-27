import { db } from "@/db";
import { listChannels } from "@/db/channels";
import { ChannelTable } from "@/components/channels/channel-table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  // Active-only by default (is_active = 1); include archived rows only when the
  // show-archived switch drives ?archived=1. Filtering lives in listChannels.
  const channels = listChannels(db, showArchived);

  return <ChannelTable channels={channels} showArchived={showArchived} />;
}
