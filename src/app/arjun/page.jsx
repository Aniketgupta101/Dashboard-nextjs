"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, Sparkles, Wrench, AlertCircle } from "lucide-react";

const updates = [
  {
    date: "2026-05-11",
    type: "feature",
    title: "VYGR Media Enterprise Page",
    description:
      "Dedicated enterprise analytics page for VYGR Media (enterprise ID 95, slug: vygr-media) under the Arjun tab. Scoped exclusively to that enterprise — shows daily prompt trend, top teams, intent mix, moderation actions, and guardrail queue status with a date filter.",
  },
  {
    date: "2026-05-11",
    type: "improvement",
    title: "P3-B: Source Badges on Charts",
    description:
      "ChartCard component now accepts a source prop ('posthog', 'db', 'shortio'). Applied to all charts on the Reach page (Short.io vs PostHog sections) and the Enterprise Analytics page (PostHog). Makes data lineage visible directly on each chart.",
  },
  {
    date: "2026-05-11",
    type: "improvement",
    title: "P3-A: Shared DB Query Helpers",
    description:
      "Extracted BASE_PROMPT_FROM_JOINS and addDateSourceFilters() into db.js. getAnalyticsData and getUsageBehaviorData now use these shared helpers, eliminating the repeated 5-table JOIN and source/date filter pattern that was duplicated across 6+ functions.",
  },
  {
    date: "2026-05-11",
    type: "improvement",
    title: "P2-C: Source Labels on All API Responses",
    description:
      "All API routes now return a _meta.source field in their JSON response (e.g. 'consume_db/user_prompts', 'posthog/enterprise_project', 'shortio/link_statistics'). Makes data origin traceable from the network tab or any consumer of the API.",
  },
  {
    date: "2026-05-11",
    type: "fix",
    title: "P1-C: Canonical Time-Saved Utility",
    description:
      "Extracted calcTimeSavedMinutes(userPrompt, enhancedPrompt) as a single exported function in analytics-utils.js. Replaced 3 inline copies in analytics-utils.js and 1 in usage.js. All routes now share identical logic: word delta → complexity multiplier (1.0/1.2/1.4) → 6-minute cap.",
  },
  {
    date: "2026-05-11",
    type: "feature",
    title: "P1-B: Paid Users Page",
    description:
      "New page at /arjun/paid-users listing all paid users (status matches pro/paid/premium via fuzzy filter). Shows name, email, status, join date, total prompts, and last active date. Supports search and column sorting. Backed by new /api/arjun/paid-users route and getAllPaidUsersDetail() DB function. Excludes test accounts.",
  },
  {
    date: "2026-05-11",
    type: "fix",
    title: "P1-A: Test User Exclusion in Daily-Habit Route",
    description:
      "daily-habit/route.js had TEST_USER_IDS = [] (empty), meaning user ID 329 and all stakeholder names were included in daily-habit and dormant-habit counts. Fixed by importing TEST_USER_IDS from constants.js.",
  },
  {
    date: "2026-05-11",
    type: "note",
    title: "Data Truth Audit — Sources & Duplications Identified",
    description:
      "Full audit completed. 4 active data sources confirmed (Consume PostgreSQL, Enterprise PostgreSQL, PostHog, Short.io + Groq for AI chat). 7 critical duplication/inconsistency issues found: time-saved logic duplicated in 4 places, paid-user filter uses 3 different match strategies, test-user exclusion missing in daily-habit route, power-user threshold differs between cumulative and daily definitions, refinement rate computed from both PostHog events and DB flags, active-users has 3 distinct definitions, and churn logic varies across 3 routes. Remediation plan defined — see conversation for full detail.",
  },
  {
    date: "2026-05-11",
    type: "feature",
    title: "Arjun Tab Added",
    description:
      "Added a dedicated Arjun section to the sidebar for tracking changes and updates to the dashboard.",
  },
];

const typeConfig = {
  feature: {
    label: "Feature",
    icon: Sparkles,
    className: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  fix: {
    label: "Fix",
    icon: Wrench,
    className: "bg-green-500/10 text-green-600 border-green-200",
  },
  improvement: {
    label: "Improvement",
    icon: GitBranch,
    className: "bg-purple-500/10 text-purple-600 border-purple-200",
  },
  note: {
    label: "Note",
    icon: AlertCircle,
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  },
};

export default function ArjunPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Arjun — Changes & Updates
        </h1>
        <p className="mt-2 text-muted-foreground text-sm md:text-base">
          A running log of dashboard changes, feature additions, and notes.
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="relative space-y-0 pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

          {updates.map((update, i) => {
            const config = typeConfig[update.type] || typeConfig.note;
            const Icon = config.icon;

            return (
              <div key={i} className="relative pb-8">
                <div className="absolute -left-[18px] flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm">
                  <Icon className="size-4 text-muted-foreground" />
                </div>

                <Card className="ml-4">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {update.date}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-2 py-0.5 ${config.className}`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-1">
                      {update.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <p className="text-sm text-muted-foreground">
                      {update.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
