This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Short.io (Reach page)

To show Short.io link metrics on the **Reach** page, add to your `.env`:

- `SHORT_IO_API_KEY` – your Short.io API key (Integrations & API → API)
- `SHORT_IO_DOMAIN_ID` – (optional) your Short.io domain ID. If omitted, the app will try to fetch links without it; if the API requires it, the Reach page will show instructions. To find it: go to [app.short.io/domains/list](https://app.short.io/domains/list) → open your domain → copy the number from the URL (e.g. `.../domains/12345` → `12345`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### SendFox (Actions page)

The **Actions** page builds outreach cohorts from the system database and can sync them to SendFox lists. Add these server-only env vars locally and in production:

```bash
SENDFOX_ACCESS_TOKEN=your_rotated_sendfox_pat
SENDFOX_LIST_MAX_USERS=your_list_id
SENDFOX_LIST_FREE_ACTIVE=your_list_id
SENDFOX_LIST_PRO_SUBSCRIBERS=your_list_id
SENDFOX_LIST_CHURNED_VOLUNTARY=your_list_id
SENDFOX_LIST_ENTERPRISE_PROSPECTS=your_enterprise_list_id
SENDFOX_LIST_CHURN_RISK=your_list_id
SENDFOX_LIST_ERROR_AFFECTED=your_list_id
SENDFOX_LIST_RATE_LIMITED=your_list_id
SENDFOX_LIST_UPGRADE_CANDIDATES=your_list_id
```

Never commit the SendFox token. If a token was pasted into chat or logs, rotate it in SendFox before using it in production.

### Supermemory (Actions page behavior memory)

The **Actions** page can sync selected user-behavior cohorts into Supermemory and query that cohort memory from the dashboard. Without an API key, the panel stays in demo mode and previews the exact records that would be sent.

```bash
SUPERMEMORY_API_KEY=your_supermemory_key
SUPERMEMORY_API_BASE_URL=https://api.supermemory.ai
SUPERMEMORY_NAMESPACE=thinkvelocity
SUPERMEMORY_INCLUDE_PII=false
SUPERMEMORY_DREAMING_MODE=dynamic
```

Keep `SUPERMEMORY_INCLUDE_PII=false` unless you explicitly want raw names/emails sent to Supermemory. The default sync redacts email addresses and sends behavior summaries, cohort labels, and non-sensitive metrics.
