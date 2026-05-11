"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Gauge,
  Heart,
  Target,
  UserMinus,
  UserPlus,
  Users,
  Zap,
  Database,
  CreditCard,
  AlertTriangle,
  MessageSquare,
  Eye,
  Star,
  Building2,
  BookOpen,
  Crown,
  Tv2,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

// Analytics items
const analyticsItems = [
  {
    title: "Overview",
    url: "/",
    icon: BarChart3,
  },
  {
    title: "Impression",
    url: "/reach",
    icon: Eye,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Zap,
  },
  {
    title: "Usage",
    url: "/usage",
    icon: Gauge,
  },
  {
    title: "Engagement",
    url: "/engagement",
    icon: Activity,
  },
  {
    title: "Retention",
    url: "/retention",
    icon: Users,
  },
  {
    title: "Funnel",
    url: "/conversion",
    icon: Target,
  },
  {
    title: "Acquisition",
    url: "/acquisition",
    icon: UserPlus,
    disabled: true,
  },
  {
    title: "Attrition / Churn",
    url: "/attrition",
    icon: UserMinus,
    disabled: true,
  },
];

const enterpriseItems = [
  {
    title: "Overview",
    url: "/enterprise",
    icon: Building2,
  },
  {
    title: "Analytics",
    url: "/enterprise/analytics",
    icon: BarChart3,
  },
];

// Developer items
const developerItems = [
  {
    title: "Diagnostics",
    url: "/diagnostics",
    icon: AlertTriangle,
  },
  {
    title: "Costs",
    url: "/costs",
    icon: CreditCard,
  },
  {
    title: "Prompts",
    url: "/prompts",
    icon: MessageSquare,
  },
];

// Data items
const dataItems = [
  {
    title: "Get Data",
    url: "/get-data",
    icon: Database,
  },
];

// Arjun items
const arjunItems = [
  {
    title: "Changes & Updates",
    url: "/arjun",
    icon: BookOpen,
  },
  {
    title: "Paid Users",
    url: "/arjun/paid-users",
    icon: Crown,
  },
  {
    title: "VYGR Media",
    url: "/arjun/vygr-media",
    icon: Tv2,
  },
];

export function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2 transition-all group-data-[collapsible=icon]:!p-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Star className="size-4" />
          </div>
          <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
            Velocity
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!item.disabled}
                    tooltip={item.title}
                    className={
                      item.disabled
                        ? "opacity-40 pointer-events-none grayscale-[0.5]"
                        : ""
                    }
                  >
                    {item.disabled ? (
                      <div className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </div>
                    ) : (
                      <a href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </a>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Enterprise</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {enterpriseItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Developer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {developerItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Arjun</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {arjunItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
          <ThemeToggle />
          <SidebarTrigger />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
