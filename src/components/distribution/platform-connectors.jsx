"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Link2,
  LockKeyhole,
  PlugZap,
  Save,
} from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "think_velocity_distribution_connections_v1";

const emptyMetricValue = "-";

function loadConnections() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveConnections(connections) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

function modeLabel(mode) {
  const map = {
    api: "API",
    public_page: "Public page",
    hybrid: "Hybrid",
    manual: "Manual",
  };
  return map[mode] || mode;
}

function connectionState(platform, connection) {
  const hasUrl = Boolean(connection?.launchUrl?.trim());
  const serverReady = platform.connection?.serverConfigured !== false;

  if (hasUrl && serverReady) {
    return {
      label: "Connected",
      variant: "default",
      detail: "Stats can be synced or entered for this source.",
    };
  }

  if (hasUrl && !serverReady) {
    return {
      label: "Needs secret",
      variant: "secondary",
      detail: `Add ${platform.connection.serverCredential} on the server for automated sync.`,
    };
  }

  return {
    label: "Not connected",
    variant: "outline",
    detail: "Connect the launch/listing URL to unlock stat tracking.",
  };
}

function PlatformStats({ platform, connected }) {
  const visibleMetrics = platform.metrics.slice(0, 5);

  if (!connected) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        Stats hidden until this platform is connected.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {visibleMetrics.map((metric) => (
        <div key={metric} className="rounded-md border bg-background/60 p-2">
          <p className="truncate text-[11px] capitalize text-muted-foreground">
            {metric}
          </p>
          <p className="mt-1 font-mono text-sm">{emptyMetricValue}</p>
        </div>
      ))}
    </div>
  );
}

export function PlatformConnectors({ platforms }) {
  const [connections, setConnections] = useState(() => loadConnections());
  const [activePlatformId, setActivePlatformId] = useState(null);
  const [form, setForm] = useState({ launchUrl: "", notes: "" });

  const activePlatform = platforms.find(
    (platform) => platform.id === activePlatformId,
  );

  const connectedCount = useMemo(
    () =>
      platforms.filter((platform) => {
        const state = connectionState(platform, connections[platform.id]);
        return state.label === "Connected";
      }).length,
    [connections, platforms],
  );

  function openConnector(platform) {
    const current = connections[platform.id] || {};
    setActivePlatformId(platform.id);
    setForm({
      launchUrl: current.launchUrl || "",
      notes: current.notes || "",
    });
  }

  function closeConnector() {
    setActivePlatformId(null);
    setForm({ launchUrl: "", notes: "" });
  }

  function handleSave() {
    if (!activePlatform) return;
    const next = {
      ...connections,
      [activePlatform.id]: {
        launchUrl: form.launchUrl.trim(),
        notes: form.notes.trim(),
        connectedAt: new Date().toISOString(),
      },
    };
    setConnections(next);
    saveConnections(next);
    closeConnector();
  }

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Connect Platforms</CardTitle>
              <CardDescription>
                Connect each Think Velocity launch source before showing live
                platform stats.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-md">
              {connectedCount}/{platforms.length} connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {platforms.map((platform) => {
              const savedConnection = connections[platform.id];
              const state = connectionState(platform, savedConnection);
              const connected = state.label === "Connected";
              const needsSecret = state.label === "Needs secret";

              return (
                <div
                  key={platform.id}
                  className="flex min-h-[300px] flex-col rounded-lg border bg-card/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {platform.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {platform.priority}
                      </p>
                    </div>
                    <Badge variant={state.variant} className="rounded-md">
                      {state.label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-md">
                      {modeLabel(platform.connection.mode)}
                    </Badge>
                    {platform.connection.serverCredential ? (
                      <Badge variant="outline" className="rounded-md">
                        <LockKeyhole className="size-3" />
                        server token
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">
                    {state.detail}
                  </p>

                  <div className="mt-3">
                    <PlatformStats platform={platform} connected={connected} />
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    {savedConnection?.launchUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={savedConnection.launchUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          Open source
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={connected || needsSecret ? "outline" : "default"}
                      onClick={() => openConnector(platform)}
                    >
                      {connected ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <PlugZap className="size-4" />
                      )}
                      {connected || needsSecret ? "Manage" : "Connect"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(activePlatform)} onOpenChange={closeConnector}>
        <DialogContent className="sm:max-w-xl">
          {activePlatform ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect {activePlatform.name}</DialogTitle>
                <DialogDescription>
                  {activePlatform.connection.helpText}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <BarChart3 className="size-4" />
                    Stats unlocked
                  </div>
                  <p className="mt-2">
                    {activePlatform.metrics.join(", ")}
                  </p>
                </div>

                {activePlatform.connection.serverCredential ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5">
                    <div className="flex items-center gap-2 font-medium">
                      <LockKeyhole className="size-4" />
                      Server credential
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {activePlatform.connection.serverConfigured
                        ? `${activePlatform.connection.serverCredential} is configured.`
                        : `Add ${activePlatform.connection.serverCredential} to .env.local for automated sync.`}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Link2 className="size-3.5" />
                    Launch or listing URL
                  </label>
                  <Input
                    value={form.launchUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        launchUrl: event.target.value,
                      }))
                    }
                    placeholder={activePlatform.submissionUrl}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Launch date, submission notes, manual dashboard access, or anything needed for this source."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeConnector}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="size-4" />
                  Save connection
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
