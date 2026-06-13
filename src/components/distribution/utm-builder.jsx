"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UtmBuilder({ productUrl, platforms }) {
  const [selectedPlatform, setSelectedPlatform] = useState(
    platforms[0]?.id || "producthunt",
  );
  const [campaign, setCampaign] = useState("think_velocity_launch");
  const [copied, setCopied] = useState(false);

  const selectedUtm = useMemo(() => {
    const url = new URL(productUrl || "https://thinkvelocity.in");
    url.searchParams.set("utm_source", selectedPlatform.replace(/-/g, "_"));
    url.searchParams.set("utm_medium", "launch");
    url.searchParams.set("utm_campaign", campaign || "think_velocity_launch");
    return url.toString();
  }, [campaign, productUrl, selectedPlatform]);

  const selectedPlatformMeta = platforms.find(
    (platform) => platform.id === selectedPlatform,
  );

  const copyUtm = async () => {
    await navigator.clipboard.writeText(selectedUtm);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Platform
        </label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPlatform}
          onChange={(event) => setSelectedPlatform(event.target.value)}
        >
          {platforms.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Campaign
        </label>
        <Input
          value={campaign}
          onChange={(event) => setCampaign(event.target.value)}
        />
      </div>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          {selectedPlatformMeta?.trackingMethod}
        </p>
        <p className="break-all font-mono text-xs leading-5">{selectedUtm}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={copyUtm} className="flex-1">
          {copied ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Clipboard className="size-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={selectedUtm} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}
