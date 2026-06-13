const product = {
  name: "Think Velocity",
  slug: "think-velocity",
  primaryUrl: "https://thinkvelocity.in",
  positioning:
    "AI prompt enhancement and workflow intelligence for people who need better outputs from existing AI tools.",
};

const platformCatalog = [
  {
    id: "producthunt",
    name: "Product Hunt",
    audience: "Product makers, startup operators, investors",
    priority: "Core launch",
    launchWindow: "24 hours",
    submissionUrl: "https://www.producthunt.com/posts/new",
    trackingMethod: "Official API + UTM",
    automation: "api",
    metrics: ["rank", "upvotes", "comments", "reviews", "referral traffic"],
    connection: {
      mode: "api",
      requiredFields: ["launchUrl"],
      serverCredential: "PRODUCT_HUNT_TOKEN",
      serverConfigured: Boolean(process.env.PRODUCT_HUNT_TOKEN),
      helpText:
        "Connect the Product Hunt launch URL here. Add PRODUCT_HUNT_TOKEN on the server for automatic rank, vote, comment, and review refresh.",
    },
    readiness: "Needs Product Hunt token and launch URL",
    score: 95,
  },
  {
    id: "fazier",
    name: "Fazier",
    audience: "Indie SaaS and AI product builders",
    priority: "Core launch",
    launchWindow: "Daily and monthly leaderboards",
    submissionUrl: "https://fazier.com/submit",
    trackingMethod: "Public page + UTM",
    automation: "public_page",
    metrics: ["upvotes", "comments", "daily rank", "monthly rank", "referral traffic"],
    connection: {
      mode: "public_page",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Fazier listing URL. Public-page stats can be refreshed from the listing once the launch exists.",
    },
    readiness: "Needs Think Velocity launch URL after submission",
    score: 86,
  },
  {
    id: "uneed",
    name: "Uneed",
    audience: "AI, SaaS, maker, and directory search traffic",
    priority: "Core launch",
    launchWindow: "Daily homepage queue",
    submissionUrl: "https://www.uneed.best/submit",
    trackingMethod: "Public page + UTM",
    automation: "public_page",
    metrics: ["upvotes", "daily rank", "monthly rank", "referral traffic"],
    connection: {
      mode: "public_page",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Uneed product URL. Public listing stats and UTM attribution can be mapped to this source.",
    },
    readiness: "Needs Think Velocity launch URL after submission",
    score: 84,
  },
  {
    id: "microlaunch",
    name: "Microlaunch",
    audience: "Makers looking for feedback, roasts, and first customers",
    priority: "Core launch",
    launchWindow: "Monthly launch board",
    submissionUrl: "https://microlaunch.net/",
    trackingMethod: "Public page + creator analytics",
    automation: "hybrid",
    metrics: ["rank", "support", "roasts", "idea score", "product score", "traffic"],
    connection: {
      mode: "hybrid",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Microlaunch listing URL. Creator analytics can be entered manually until a supported export/API is available.",
    },
    readiness: "Needs account access or public launch URL",
    score: 80,
  },
  {
    id: "betalist",
    name: "BetaList",
    audience: "Early adopters and pre-launch startup subscribers",
    priority: "Pre-launch",
    launchWindow: "Editorial queue",
    submissionUrl: "https://betalist.com/submit",
    trackingMethod: "Public listing + UTM",
    automation: "public_page",
    metrics: ["feature date", "category", "referral traffic", "waitlist signups"],
    connection: {
      mode: "public_page",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the BetaList feature URL. Stats are mostly attribution-based unless BetaList exposes listing-level engagement.",
    },
    readiness: "Works best if Think Velocity is presented as recently launched or beta",
    score: 72,
  },
  {
    id: "peerlist",
    name: "Peerlist Launchpad",
    audience: "Developers, designers, and technical builders",
    priority: "Developer audience",
    launchWindow: "Weekly launchpad",
    submissionUrl: "https://peerlist.io/launchpad",
    trackingMethod: "Public page + UTM",
    automation: "public_page",
    metrics: ["rank", "upvotes", "feedback", "profile engagement", "traffic"],
    connection: {
      mode: "public_page",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Peerlist Launchpad URL. Public ranking and feedback stats can be mapped from the launch page.",
    },
    readiness: "Needs maker profile and launch URL",
    score: 74,
  },
  {
    id: "hackernews",
    name: "Hacker News - Show HN",
    audience: "Technical founders, engineers, and early adopters",
    priority: "Technical validation",
    launchWindow: "Immediate post lifespan",
    submissionUrl: "https://news.ycombinator.com/submit",
    trackingMethod: "HN API + Algolia + UTM",
    automation: "api",
    metrics: ["points", "comments", "front-page visibility", "sentiment", "traffic"],
    connection: {
      mode: "api",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Show HN item URL. HN points and comments can be fetched from public HN/Algolia APIs.",
    },
    readiness: "Needs submitted Show HN URL",
    score: 78,
  },
  {
    id: "reddit-saas",
    name: "Reddit - r/SaaS",
    audience: "SaaS builders and operators",
    priority: "Community feedback",
    launchWindow: "Thread lifecycle",
    submissionUrl: "https://www.reddit.com/r/SaaS/submit",
    trackingMethod: "Reddit API/manual + UTM",
    automation: "hybrid",
    metrics: ["upvotes", "comments", "sentiment", "traffic", "signups"],
    connection: {
      mode: "hybrid",
      requiredFields: ["launchUrl"],
      serverCredential: "REDDIT_CLIENT_ID",
      serverConfigured: Boolean(process.env.REDDIT_CLIENT_ID),
      helpText:
        "Connect the Reddit post URL. Public/manual stats work from the URL; Reddit API credentials can automate vote and comment refresh.",
    },
    readiness: "Needs post URL and subreddit-safe copy",
    score: 68,
  },
  {
    id: "indiehackers",
    name: "Indie Hackers",
    audience: "Bootstrapped founders and solopreneurs",
    priority: "Founder story",
    launchWindow: "Discussion post",
    submissionUrl: "https://www.indiehackers.com/",
    trackingMethod: "Manual/public page + UTM",
    automation: "manual",
    metrics: ["comments", "reactions", "traffic", "qualified signups"],
    connection: {
      mode: "manual",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the Indie Hackers post URL. Engagement can be entered manually and traffic comes from UTM analytics.",
    },
    readiness: "Needs founder-style launch post URL",
    score: 64,
  },
  {
    id: "devto",
    name: "DEV Community",
    audience: "Developers and technical content readers",
    priority: "Content-led launch",
    launchWindow: "Article lifecycle",
    submissionUrl: "https://dev.to/new",
    trackingMethod: "Public article stats + UTM",
    automation: "hybrid",
    metrics: ["reactions", "comments", "reads", "traffic", "developer signups"],
    connection: {
      mode: "hybrid",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the DEV article URL. Article engagement and UTM attribution can be tracked against this platform.",
    },
    readiness: "Needs technical article and URL",
    score: 60,
  },
  {
    id: "alternativeto",
    name: "AlternativeTo",
    audience: "People searching for alternatives to existing AI tools",
    priority: "Long-tail SEO",
    launchWindow: "Ongoing directory listing",
    submissionUrl: "https://alternativeto.net/software/new/",
    trackingMethod: "Directory listing + UTM",
    automation: "manual",
    metrics: ["likes", "alternatives", "category position", "SEO traffic"],
    connection: {
      mode: "manual",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the AlternativeTo listing URL. Directory position and traffic are tracked as a longer-running source.",
    },
    readiness: "Needs listing URL after approval",
    score: 58,
  },
  {
    id: "appsumo",
    name: "AppSumo",
    audience: "Deal buyers and SaaS early adopters",
    priority: "Revenue experiment",
    launchWindow: "Deal campaign",
    submissionUrl: "https://appsumo.com/sell/",
    trackingMethod: "Partner dashboard + UTM",
    automation: "manual",
    metrics: ["sales", "reviews", "refunds", "traffic", "activation"],
    connection: {
      mode: "manual",
      requiredFields: ["launchUrl"],
      serverCredential: null,
      serverConfigured: true,
      helpText:
        "Connect the AppSumo deal URL only if a lifetime-deal campaign is approved. Sales and refund stats usually come from the partner dashboard.",
    },
    readiness: "Only use if a lifetime-deal offer makes sense",
    score: 52,
  },
];

const launchRows = platformCatalog.map((platform, index) => ({
  id: `${product.slug}-${platform.id}`,
  productId: product.slug,
  platformId: platform.id,
  platform: platform.name,
  plannedOrder: index + 1,
  status:
    platform.id === "producthunt" || platform.id === "hackernews"
      ? "Ready after URL"
      : "Planned",
  launchUrl: "",
  launchDate: "",
  rank: null,
  upvotes: null,
  comments: null,
  visits: null,
  signups: null,
  conversions: null,
  revenue: null,
}));

function makeUtmUrl(platformId, campaign = "think_velocity_launch") {
  const source = platformId.replace(/-/g, "_");
  const url = new URL(product.primaryUrl);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "launch");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

function getSetupChecklist() {
  return [
    {
      item: "Think Velocity launch URLs",
      status: "needed",
      detail:
        "Add the final launch/post URL for each platform once submitted so stats can map to the right row.",
    },
    {
      item: "Product Hunt developer token",
      status: process.env.PRODUCT_HUNT_TOKEN ? "configured" : "optional",
      detail:
        "Required only for automated Product Hunt rank/upvote/comment refresh.",
    },
    {
      item: "Short.io API key and domain",
      status:
        process.env.SHORT_IO_API_KEY && process.env.SHORT_IO_DOMAIN_ID
          ? "configured"
          : "optional",
      detail:
        "Needed if launch links are shortened and tracked through Short.io.",
    },
    {
      item: "PostHog project credentials",
      status:
        (process.env.POSTHOG_API_KEY || process.env.ENTERPRISE_POSTHOG_PERSONAL_API_KEY) &&
        (process.env.POSTHOG_PROJECT_ID || process.env.ENTERPRISE_POSTHOG_PROJECT_ID)
          ? "configured"
          : "optional",
      detail:
        "Needed to pull real visits, signups, activations, and paid conversions by UTM source.",
    },
    {
      item: "Launch copy and screenshots",
      status: "needed",
      detail:
        "Needed outside the dashboard to submit Think Velocity consistently across each platform.",
    },
  ];
}

export function getDistributionData() {
  const utmLinks = platformCatalog.map((platform) => ({
    platformId: platform.id,
    platform: platform.name,
    url: makeUtmUrl(platform.id),
  }));

  const summary = {
    productName: product.name,
    platformCount: platformCatalog.length,
    corePlatforms: platformCatalog.filter((p) => p.priority === "Core launch").length,
    apiReadyPlatforms: platformCatalog.filter((p) => p.automation === "api").length,
    trackedLaunches: launchRows.filter((row) => row.launchUrl).length,
    plannedLaunches: launchRows.length,
  };

  return {
    product,
    summary,
    platforms: platformCatalog,
    launches: launchRows,
    utmLinks,
    setupChecklist: getSetupChecklist(),
    generatedAt: new Date().toISOString(),
  };
}

export { makeUtmUrl };
