import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DistributionList } from "./distribution-list";

describe("DistributionList", () => {
  it("renders payment channels as horizontal percentage bars", () => {
    const html = renderToStaticMarkup(
      <DistributionList
        title="按支付渠道"
        description="空间付款归属到对应的支付渠道。"
        totalUsdMinor={8624}
        buckets={[
          { key: "bybit", label: "Bybit", usdMinor: 3665, percentage: 42.5 },
          { key: "roogoo", label: "Roogoo3509", usdMinor: 3484, percentage: 40.4 },
        ]}
      />,
    );

    expect(html).toContain("占总支出比例");
    expect(html).toContain("min-h-full");
    expect(html).toContain("justify-center");
    expect(html).toContain("h-20");
    expect(html).toContain("gap-7");
    expect(html).toContain("width:42.5%");
    expect(html).toContain("Bybit");
    expect(html).toContain("42.5%");
    expect(html).toContain("100%");
  });
});
