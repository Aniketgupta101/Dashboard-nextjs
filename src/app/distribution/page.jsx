import {
  ArrowUpRight,
  Link2,
  RadioTower,
  Rocket,
  Search,
  Target,
} from "lucide-react";

import { PlatformConnectors } from "@/components/distribution/platform-connectors";
import { DistributionPriorityChart } from "@/components/distribution/priority-chart";
import { UtmBuilder } from "@/components/distribution/utm-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDistributionData } from "@/lib/distribution-data";

function statusVariant(status) {
  if (status === "configured") return "default";
  if (status === "needed") return "destructive";
  return "secondary";
}

function formatNumber(value) {
  if (value == null) return "-";
  return Number(value).toLocaleString();
}

function SummaryTile({ icon: Icon, label, value, tone }) {
  return (
    <Card className="rounded-lg border-border/70 bg-card/70 py-5">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div
          className="flex size-10 items-center justify-center rounded-md border"
          style={{ borderColor: tone, color: tone }}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DistributionPage() {
  const data = getDistributionData();

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md">
              Distribution
            </Badge>
            <Badge variant="outline" className="rounded-md">
              Think Velocity only
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Think Velocity Launch Command
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
            One product, one source map: platform priority, launch readiness,
            UTM links, and the stats table that will hold each launch outcome.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/api/distribution" target="_blank" rel="noreferrer">
            <Search className="size-4" />
            API
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={Target}
          label="Tracked Product"
          value={data.summary.productName}
          tone="#38bdf8"
        />
        <SummaryTile
          icon={Rocket}
          label="Launch Platforms"
          value={data.summary.platformCount}
          tone="#22c55e"
        />
        <SummaryTile
          icon={RadioTower}
          label="API-ready Sources"
          value={data.summary.apiReadyPlatforms}
          tone="#a78bfa"
        />
        <SummaryTile
          icon={Link2}
          label="Live Launch URLs"
          value={`${data.summary.trackedLaunches}/${data.summary.plannedLaunches}`}
          tone="#f59e0b"
        />
      </div>

      <PlatformConnectors platforms={data.platforms} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Distribution Priority</CardTitle>
            <CardDescription>
              Ranked by expected fit for Think Velocity distribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionPriorityChart platforms={data.platforms} />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>UTM Builder</CardTitle>
            <CardDescription>
              Use these links for every launch CTA and post link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UtmBuilder
              productUrl={data.product.primaryUrl}
              platforms={data.platforms}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Platform Reference</CardTitle>
          <CardDescription>
            Submission target, audience, tracking method, and setup state for
            every source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Submit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.platforms.map((platform) => (
                <TableRow key={platform.id}>
                  <TableCell className="font-medium">{platform.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md">
                      {platform.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal text-muted-foreground">
                    {platform.audience}
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal">
                    {platform.trackingMethod}
                  </TableCell>
                  <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                    {platform.readiness}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <a
                        href={platform.submissionUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ArrowUpRight className="size-4" />
                        Open
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Connected Stats Rollup</CardTitle>
            <CardDescription>
              These rows become the cross-platform stats rollup after each
              platform is connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Votes</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Signups</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.launches.map((launch) => (
                  <TableRow key={launch.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {launch.plannedOrder}
                    </TableCell>
                    <TableCell className="font-medium">{launch.platform}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-md">
                        {launch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNumber(launch.rank)}</TableCell>
                    <TableCell>{formatNumber(launch.upvotes)}</TableCell>
                    <TableCell>{formatNumber(launch.comments)}</TableCell>
                    <TableCell>{formatNumber(launch.visits)}</TableCell>
                    <TableCell>{formatNumber(launch.signups)}</TableCell>
                    <TableCell>{formatNumber(launch.conversions)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Setup Gaps</CardTitle>
            <CardDescription>
              The dashboard is ready; these items decide how much refresh is
              automatic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.setupChecklist.map((item) => (
              <div
                key={item.item}
                className="rounded-md border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.item}</p>
                  <Badge
                    variant={statusVariant(item.status)}
                    className="rounded-md"
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Source Contract
          </CardTitle>
          <CardDescription>
            This is the metric contract for Think Velocity launch attribution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Platform engagement</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upvotes, comments, rank, scores, and reviews from Product Hunt,
                Fazier, Uneed, Microlaunch, Peerlist, HN, and communities.
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Owned traffic</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                UTM source, campaign, landing visits, click quality, and source
                breakdown from Short.io, PostHog, or web analytics.
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold">Business outcome</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Signups, activations, paid conversions, revenue, and qualitative
                feedback tied back to each launch source.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
