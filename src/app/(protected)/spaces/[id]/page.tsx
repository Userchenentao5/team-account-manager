import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { listChildAccounts } from "@/db/childAccounts";
import { listChannels } from "@/db/channels";
import { listCurrencies } from "@/db/currencies";
import { getRate } from "@/db/fxRates";
import { getStatusThresholds } from "@/db/settings";
import { getSpaceDetail } from "@/db/spaces";
import { formatCountryLabel } from "@/lib/countries";
import { formatCurrencyMinor } from "@/lib/currencies";
import { convertUsdMinorToCurrencyMinor, formatMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChildAccountTable } from "@/components/spaces/child-account-table";
import { ExpiryBadge } from "@/components/spaces/expiry-badge";
import { FrozenAmountHelp } from "@/components/spaces/frozen-amount-help";
import { MotherSeatCard } from "@/components/spaces/mother-seat-card";
import { SpaceDetailActions } from "@/components/spaces/space-detail-actions";
import { SpaceInlineEditor } from "@/components/spaces/space-form";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

function formatAsOf(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function DetailItem({
  label,
  children,
  className,
  action,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={[
        "min-h-[92px] rounded-md border bg-muted/20 p-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {action}
      </div>
      <div className="mt-1 min-h-6 font-medium">{children}</div>
    </div>
  );
}

function formatPeriodLabel(unit: string | null, count: number | null): string {
  const label =
    unit === "year" ? "年" : unit === "quarter" ? "季度" : "月";
  return `${count ?? 1} ${label}`;
}

export default async function SpaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string; editMotherSeat?: string }>;
}) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ edit?: string; editMotherSeat?: string }>({}),
  ]);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  const isEditing = query.edit === "1";
  const isMotherSeatEditing = query.editMotherSeat === "1";

  const detail = getSpaceDetail(db, numericId);
  if (!detail) notFound();

  const channels = listChannels(db);
  const currencies = listCurrencies(db);
  const childAccounts = listChildAccounts(db, numericId);
  const thresholds = getStatusThresholds(db);
  const cnyCurrency = currencies.find((item) => item.code === "CNY");
  const cnyRate = getRate(db, "CNY");
  const { space, motherAccount, paymentChannel, currency } = detail;
  const cnyReference =
    space.amountUsd === null || !cnyCurrency || !cnyRate
      ? "暂无 CNY 参考"
      : formatCurrencyMinor(
          convertUsdMinorToCurrencyMinor(
            space.amountUsd,
            cnyCurrency.minorUnit,
            cnyRate.rateToUsd,
          ),
          cnyCurrency,
        );
  const formValue = {
    id: space.id,
    name: space.name,
    country: space.country,
    paymentChannelId: space.paymentChannelId,
    currencyCode: space.currencyCode,
    amountMinor: space.amountMinor,
    openingDate: space.openingDate ?? "",
    currentPeriodStartDate:
      space.currentPeriodStartDate ?? space.openingDate ?? "",
    periodUnit: (space.periodUnit ?? "month") as "month" | "quarter" | "year",
    periodCount: space.periodCount ?? 1,
    motherEmail: motherAccount.email,
  };
  const editFormId = `space-${space.id}-detail-edit-form`;
  const motherSeatFormId = `space-${space.id}-mother-seat-edit-form`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur sm:relative">
        <Button asChild variant="outline" className="h-10 gap-2 px-4">
          <Link href="/spaces">
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回列表
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-center text-2xl font-semibold leading-tight sm:absolute sm:left-1/2 sm:max-w-[52vw] sm:-translate-x-1/2">
          {space.name}
        </h1>
        <div className="flex items-center gap-2 justify-self-end">
          <SpaceDetailActions
            space={formValue}
            childCount={childAccounts.length}
            isEditing={isEditing}
            editFormId={editFormId}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{isEditing ? "编辑空间" : "空间详情"}</CardTitle>
          <CardDescription>
            {isEditing
              ? "修改空间资料后会重新计算到期日；金额或币种变化会重新冻结 USD 成本。"
              : "查看当前周期、到期状态和冻结成本。"}
          </CardDescription>
          <CardAction>
            <ExpiryBadge
              expiryDate={space.expiryDate}
              soonDays={thresholds.spaceSoonDays}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <SpaceInlineEditor
              space={formValue}
              channels={channels}
              currencies={currencies}
              cancelHref={`/spaces/${space.id}`}
              formId={editFormId}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="空间名称">
                <span>{space.name}</span>
              </DetailItem>
              <DetailItem label="母账号">
                <span>{motherAccount.email}</span>
              </DetailItem>
              <DetailItem label="国家/地区">
                <span>{formatCountryLabel(space.country)}</span>
              </DetailItem>
              <DetailItem label="支付渠道">
                <span>{paymentChannel.name}</span>
              </DetailItem>
              <DetailItem label="金额">
                <span className="font-mono">
                  {formatCurrencyMinor(space.amountMinor, currency)}
                </span>
              </DetailItem>
              <DetailItem label="币种">
                <span>
                  {currency.symbol} {currency.code}
                </span>
              </DetailItem>
              <DetailItem label="首次开通日">
                <span className="font-mono">{space.openingDate ?? "-"}</span>
              </DetailItem>
              <DetailItem label="当前周期开始日">
                <span className="font-mono">
                  {space.currentPeriodStartDate ?? space.openingDate ?? "-"}
                </span>
              </DetailItem>
              <DetailItem label="订阅周期">
                <span>{formatPeriodLabel(space.periodUnit, space.periodCount)}</span>
              </DetailItem>
            </div>
          )}

          <div className="border-t pt-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="到期日">
                <span className="font-mono">{space.expiryDate ?? "-"}</span>
              </DetailItem>
              <DetailItem
                label="冻结 USD 金额"
                action={<FrozenAmountHelp className="-my-1" />}
              >
                <span className="font-mono">
                  {space.amountUsd === null
                    ? "-"
                    : `$${formatMinor(space.amountUsd, 2)} USD`}
                </span>
              </DetailItem>
              <DetailItem label="当前 CNY 参考">
                <span className="font-mono">{cnyReference}</span>
              </DetailItem>
              <DetailItem
                label="汇率快照"
                className="md:col-span-2 xl:col-span-3"
              >
                <span className="text-sm text-muted-foreground">
                  {isEditing
                    ? "这些成本和到期信息会在保存后按当前表单重新计算。当前快照汇率截至 "
                    : "保存时按当时汇率折算并固定；后续汇率刷新不会改写这笔历史成本。汇率截至 "}
                  {formatAsOf(space.rateAsOf)}
                </span>
              </DetailItem>
            </div>
          </div>
        </CardContent>
      </Card>

      <MotherSeatCard
        motherAccount={motherAccount}
        isEditing={isMotherSeatEditing}
        formId={motherSeatFormId}
        editHref={`/spaces/${space.id}?editMotherSeat=1`}
        cancelHref={`/spaces/${space.id}`}
      />

      <Card>
        <CardContent className="p-6">
          <ChildAccountTable
            spaceId={space.id}
            accounts={childAccounts}
            currencies={currencies}
            childAccountSoonDays={thresholds.childAccountSoonDays}
          />
        </CardContent>
      </Card>
    </div>
  );
}
