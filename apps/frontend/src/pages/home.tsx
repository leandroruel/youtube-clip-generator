import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, type Clip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/layout/user-nav";
import {
  Sparkles,
  ArrowRight,
  Crop,
  Plus,
  Clock,
  Play,
} from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const thumbGradients = [
  "from-violet-600 to-purple-800",
  "from-blue-600 to-cyan-700",
  "from-emerald-600 to-teal-800",
  "from-orange-600 to-red-700",
  "from-pink-600 to-rose-800",
  "from-indigo-600 to-blue-800",
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    processing: "bg-amber-500/10 text-amber-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", map[status] || "")}>
      {status}
    </span>
  );
}

const actionCards = [
  {
    title: "Automatic Clips",
    desc: "AI-powered clip generation from your videos",
    gradient: "from-accent-violet to-purple-600",
    icon: Sparkles,
  },
  {
    title: "Video Reframe",
    desc: "Smart reframe for any aspect ratio",
    gradient: "from-accent-cyan to-cyan-600",
    icon: Crop,
  },
  {
    title: "New Project",
    desc: "Create a new video project from scratch",
    gradient: "from-surface to-surface",
    icon: Plus,
    border: true,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const { data: allClips } = useQuery({
    queryKey: ["clips"],
    queryFn: () => api.clips.list(),
  });

  const recentClips = (allClips ?? [])
    .toSorted(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    navigate(`/create?url=${encodeURIComponent(youtubeUrl.trim())}`);
  };

  return (
    <div className="space-y-10 p-8 pb-24">
      {/* Header */}
      <div className="fade-in-up flex items-center justify-between" style={{ animationDelay: "0s" }}>
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Creator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ready to create something amazing today?
          </p>
        </div>
        <UserNav userName="Creator" />
      </div>

      {/* Hero Generator Card */}
      <div className="fade-in-up animated-border-card" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-xl bg-surface p-8">
          <div className="mx-auto mb-6 max-w-xl text-center">
            <h2 className="text-xl font-bold text-white">
              Generate Captioned Clips
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a YouTube URL and let AI create stunning captioned clips
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-3">
            <Input
              placeholder="https://youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="h-11 flex-1 border-border bg-bg-deep text-foreground placeholder:text-muted-foreground/50"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!youtubeUrl.trim()}
              className="h-11 gap-2 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
            >
              Generate Clips
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Action Cards */}
      <div className="fade-in-up grid gap-4 sm:grid-cols-3" style={{ animationDelay: "0.2s" }}>
        {actionCards.map((card) => (
          <div
            key={card.title}
            className={cn(
              "group cursor-pointer rounded-xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
              card.border
                ? "border-border bg-surface hover:border-accent-violet/30"
                : "border-transparent"
            )}
            style={
              !card.border
                ? { background: `linear-gradient(135deg, ${card.gradient.includes("accent-violet") ? "#8b5cf6" : "#22d3ee"}, ${card.gradient.includes("purple") ? "#7c3aed" : "#0891b2"})` }
                : undefined
            }
          >
            <div
              className={cn(
                "mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                card.border ? "bg-accent-violet/10" : "bg-white/20"
              )}
            >
              <card.icon className={cn("h-5 w-5", card.border ? "text-accent-violet" : "text-white")} />
            </div>
            <h3 className={cn("font-semibold", card.border ? "text-white" : "text-white")}>
              {card.title}
            </h3>
            <p className={cn("mt-1 text-sm", card.border ? "text-muted-foreground" : "text-white/80")}>
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      {recentClips.length > 0 && (
        <section className="fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Projects</h2>
              <p className="text-sm text-muted-foreground">
                Your latest generated clips
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {recentClips.map((clip: Clip, i: number) => (
              <div
                key={clip.id}
                className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-violet/30 hover:shadow-lg"
              >
                <div
                  className={cn(
                    "relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br shadow-lg",
                    thumbGradients[i % thumbGradients.length]
                  )}
                >
                  <div className="absolute inset-0 bg-black/20 transition-opacity group-hover:bg-black/10" />
                  <Play className="h-5 w-5 text-white opacity-60 transition-opacity group-hover:opacity-100" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                    {formatDuration(clip.endTime - clip.startTime)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {clip.text || "Untitled Clip"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <StatusBadge status={clip.status} />
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(clip.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
