"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, Sparkles, Wrench, AlertCircle } from "lucide-react";

const updates = [
  {
    date: "2026-05-22",
    type: "feature",
    title: "User Intelligence Page (/intelligence)",
    description:
      "New page showing three actionable user lists: health score distribution (Champion / Engaged / At Risk buckets based on a 0–100 score from prompts, active days, recency, and refine usage), a ranked Upgrade Candidates table of free users to personally reach out to this week, and a Churn Risk table of previously active users who have gone silent in the last 7–30 days. Backed by db-intelligence.js, /api/user-intelligence, and use-user-intelligence-data hook.",
  },
  {
    date: "2026-05-22",
    type: "feature",
    title: "Cohort Retention Page (/cohorts)",
    description:
      "New page showing a 16-week signup cohort retention grid. Each row is a week's new users; columns show W0/W1/W2/W4/W8 return rates with heat-colored cells (green ≥30%, yellow ≥15%, orange ≥5%, red <5%). Includes summary metric cards for avg W1 and W2 retention and a bar chart trending W1 retention across the last 10 cohorts. Backed by db-cohorts.js, /api/cohorts, and use-cohort-data hook.",
  },
  {
    date: "2026-05-22",
    type: "fix",
    title: "P0: Active Paid User Count Fixed (5.4x inflation removed)",
    description:
      "getTotalPaidUsersByDate queried userstatus WHERE status='pro' returning 27 users. Actual active subscribers (subscriptions WHERE status='active') is 5. New getActivePaidUsersCount() in db-p0-fixes.js uses the subscriptions table as source of truth. analytics API now returns activePaidUsers alongside existing metrics.",
  },
  {
    date: "2026-05-22",
    type: "feature",
    title: "Platform Failure Breakdown API (/api/platform-failures)",
    description:
      "New endpoint returning per-platform enhancement success rates (total prompts, enhanced count, failed count, success_rate %) with date range filtering. Exposes the previously invisible 18.7% failure rate broken down by chatgpt / claude / gemini / extension / grok etc. Backed by getEnhancementFailuresByPlatform() in db-p0-fixes.js.",
  },
  {
    date: "2026-05-22",
    type: "fix",
    title: "Refine JOIN Row Duplication Fixed (349 phantom rows eliminated)",
    description:
      "BASE_PROMPT_FROM_JOINS used a plain LEFT JOIN on refine_prompt which produced duplicate rows for the 149 prompts with multiple refinement rounds. Replaced with DISTINCT ON (enhanced_prompt_id) subquery to always return exactly one refine row per prompt (the latest), eliminating 349 phantom rows from all analytics queries.",
  },
  {
    date: "2026-05-22",
    type: "fix",
    title: "Platform & Mode Case Normalization (DB + code)",
    description:
      "8,309 user_prompts rows had platform='ChatGPT' (mixed case) causing a false split with 'chatgpt'. 3,975 save_enhance_prompt rows had mixed-case mode values (Quick/quick, Deep build/deep build, etc.). All normalized to lowercase in DB. Added CHECK CONSTRAINT on user_prompts.platform and BEFORE INSERT/UPDATE trigger on save_enhance_prompt.mode to enforce lowercase going forward. analytics-utils.js and usage.js updated to .toLowerCase().trim() mode values defensively.",
  },
  {
    date: "2026-05-22",
    type: "fix",
    title: "Webhook Events Bloat Removed (23 MB → 424 KB)",
    description:
      "27,155 of 27,390 rows in webhook_events were payment.downtime.resolved and payment.downtime.started events — Razorpay maintenance window pings with zero analytics value. Deleted all 27,155 rows and ran VACUUM FULL to reclaim disk space. Added a BEFORE INSERT trigger to silently discard future payment.downtime.* events at the DB level.",
  },
  {
    date: "2026-05-22",
    type: "fix",
    title: "VACUUM on All High Dead-Tuple Tables",
    description:
      "Ran VACUUM ANALYZE across usertable (14.6% dead), subscriptions (30.4% dead), payments (30.6% dead), reviews (22.3% dead), refresh_tokens (16.7% dead), processed_contexts (53.8% dead), referrals (100% dead), user_profiles (87.5% dead), token_transactions, token_ledger, and onboarding_data. All tables now at 0% dead tuples.",
  },
  {
    date: "2026-05-22",
    type: "note",
    title: "Activation Definition Locked In",
    description:
      "Activation is now formally defined as: active on 2+ separate calendar days AND 3+ total prompts. Added ACTIVATION_MIN_DAYS=2 and ACTIVATION_MIN_PROMPTS=3 to constants.js alongside the existing ACTIVATION_THRESHOLD=3. All cohort and intelligence features use this definition.",
  },
  {
    date: "2026-05-22",
    type: "note",
    title: "DB Audit — 3 Critical Issues Still Open",
    description:
      "Three issues remain unresolved and need app-side fixes: (1) Token debit tracking is completely broken — token_transactions has 4,855 credit records and zero debit records, making all cost/token-usage metrics fabricated. (2) Total token coverage is only 27% of enhancements — input_token is 0% populated. (3) Onboarding data stopped writing on April 24 2026 — all 1,433 signups since then have no onboarding record, causing 0% completion rate on Acquisition tab.",
  },
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
