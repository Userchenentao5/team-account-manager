"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Database,
  CreditCard,
  Coins,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const topLevel = [
  { label: "仪表盘", href: "/", icon: LayoutDashboard },
  { label: "空间", href: "/spaces", icon: Boxes },
] as const;

const referenceChildren = [
  { label: "支付渠道", href: "/reference-data/channels", icon: CreditCard },
  { label: "币种", href: "/reference-data/currencies", icon: Coins },
] as const;

const activeClasses =
  "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3 text-base font-semibold">
        团队空间管理
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {topLevel.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={activeClasses}
                    >
                      <Link href={item.href} aria-label={item.label}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="参考数据"
                  className="font-semibold"
                >
                  <Database aria-hidden="true" />
                  <span>参考数据</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {referenceChildren.map((child) => {
                    const Icon = child.icon;
                    const isActive = pathname === child.href;
                    return (
                      <SidebarMenuSubItem key={child.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive}
                          className={activeClasses}
                        >
                          <Link href={child.href} aria-label={child.label}>
                            <Icon aria-hidden="true" />
                            <span>{child.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
