"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";

const RETURN_LOCATION_KEY = "renewal-risk-return-location";
const RISK_SECTION_IDS = ["space-renewal-risk", "child-account-renewal-risk"] as const;
type RiskSectionId = (typeof RISK_SECTION_IDS)[number];

type RiskReturnLocation = {
  sourceHref: string;
  targetHref: string;
  scrollY: number;
  linkId?: string;
  sectionId?: RiskSectionId;
  tableScrollLeft?: Partial<Record<RiskSectionId, number>>;
  restore: boolean;
};

function riskSection(id: RiskSectionId) {
  return document.getElementById(id)?.closest("section");
}

function riskTableContainer(id: RiskSectionId) {
  return riskSection(id)?.querySelector<HTMLElement>('[data-slot="table-container"]');
}

function readReturnLocation(): RiskReturnLocation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(RETURN_LOCATION_KEY) ?? "null");
    if (
      !value ||
      typeof value.sourceHref !== "string" ||
      typeof value.targetHref !== "string" ||
      !Number.isFinite(value.scrollY) ||
      value.scrollY < 0 ||
      (value.linkId !== undefined && typeof value.linkId !== "string") ||
      typeof value.restore !== "boolean"
    ) {
      return null;
    }
    if (
      value.sectionId !== undefined &&
      !RISK_SECTION_IDS.includes(value.sectionId)
    ) {
      return null;
    }
    if (
      value.tableScrollLeft !== undefined &&
      (!value.tableScrollLeft ||
        typeof value.tableScrollLeft !== "object" ||
        Array.isArray(value.tableScrollLeft) ||
        Object.entries(value.tableScrollLeft).some(
          ([id, left]) =>
            !RISK_SECTION_IDS.some((sectionId) => sectionId === id) ||
            typeof left !== "number" || !Number.isFinite(left) || left < 0,
        )
      )
    ) {
      return null;
    }
    const source = new URL(value.sourceHref, window.location.origin);
    const target = new URL(value.targetHref, window.location.origin);
    if (
      source.origin !== window.location.origin ||
      source.pathname !== "/renewal-risks" ||
      target.origin !== window.location.origin ||
      !/^\/spaces\/\d+$/.test(target.pathname)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function RiskDetailLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "scroll"> & {
  href: string;
}) {
  return (
    <Link
      {...props}
      href={href}
      scroll={false}
      data-risk-detail-link=""
      onNavigate={() => {
        if (window.location.pathname !== "/renewal-risks") return;
        try {
          const sectionId = props.id
            ? document.getElementById(props.id)?.closest("section")?.getAttribute("aria-labelledby")
            : undefined;
          const location: RiskReturnLocation = {
            sourceHref:
              window.location.pathname + window.location.search + window.location.hash,
            targetHref: href,
            scrollY: window.scrollY,
            linkId: props.id,
            sectionId: RISK_SECTION_IDS.find((id) => id === sectionId),
            tableScrollLeft: Object.fromEntries(
              RISK_SECTION_IDS.map((id) => [id, riskTableContainer(id)?.scrollLeft ?? 0]),
            ),
            restore: false,
          };
          sessionStorage.setItem(RETURN_LOCATION_KEY, JSON.stringify(location));
        } catch {
          // Navigation still works when browser storage is unavailable.
        }
      }}
    />
  );
}

export function RiskReturnLink(
  props: Omit<ComponentProps<typeof Link>, "href" | "onNavigate">,
) {
  const router = useRouter();

  return (
    <Link
      {...props}
      href="/renewal-risks"
      onNavigate={(event) => {
        const saved = readReturnLocation();
        if (!saved) return;
        const target = new URL(saved.targetHref, window.location.origin);
        const current = new URL(window.location.href);
        if (
          target.pathname !== current.pathname ||
          ["highlightSpace", "highlightChild"].some(
            (key) => target.searchParams.get(key) !== current.searchParams.get(key),
          )
        ) {
          return;
        }
        try {
          sessionStorage.setItem(
            RETURN_LOCATION_KEY,
            JSON.stringify({ ...saved, restore: true }),
          );
        } catch {
          return;
        }
        event.preventDefault();
        router.push(saved.sourceHref, { scroll: false });
      }}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      返回风险页
    </Link>
  );
}

export function RiskListScrollRestoration() {
  useEffect(() => {
    const saved = readReturnLocation();
    const currentHref =
      window.location.pathname + window.location.search + window.location.hash;
    if (!saved?.restore || saved.sourceHref !== currentHref) return;

    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      RISK_SECTION_IDS.forEach((id) => {
        riskTableContainer(id)?.scrollTo({
          left: saved.tableScrollLeft?.[id] ?? 0,
          behavior: "instant",
        });
      });
      const originalLink = saved.linkId ? document.getElementById(saved.linkId) : null;
      const headerBottom = document.querySelector('[data-slot="page-header"]')
        ?.getBoundingClientRect().bottom ?? 0;
      if (originalLink) {
        originalLink.focus({ preventScroll: true });
        const rect = originalLink.getBoundingClientRect();
        if (rect.top < headerBottom + 8 || rect.bottom > window.innerHeight) {
          originalLink.scrollIntoView({ block: "center", behavior: "instant" });
        }
      } else {
        const section = saved.sectionId ? riskSection(saved.sectionId) : null;
        const links = Array.from(
          section?.querySelectorAll<HTMLElement>("a[data-risk-detail-link]") ?? [],
        );
        const visibleLink = links.find((link) => {
          const rect = link.getBoundingClientRect();
          return rect.top >= headerBottom + 8 && rect.bottom <= window.innerHeight;
        });
        const fallback = visibleLink ?? links[0]
          ?? section?.querySelector<HTMLElement>("h2")
          ?? document.querySelector<HTMLElement>("main h1");
        if (fallback) {
          if (!fallback.matches("a")) fallback.tabIndex = -1;
          fallback.focus({ preventScroll: true });
          fallback.scrollIntoView({ block: "center", behavior: "instant" });
        }
      }
      try {
        sessionStorage.removeItem(RETURN_LOCATION_KEY);
      } catch {
        // Restoring the page does not require persistent storage.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
