import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Smartphone,
  Monitor,
  Film,
  Link2,
  ChevronLeft,
} from "lucide-react";

const STEP_LABELS = ["Video", "Format", "Review"];

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0] || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function extractVideoTitle(url: string): string {
  const id = extractYoutubeId(url);
  return id ? `Video ${id.slice(0, 8)}` : "New Project";
}

function getThumbnailUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

const formats = [
  {
    id: "vertical",
    label: "Vertical",
    desc: "9:16 — Reels, TikTok, Shorts",
    icon: Smartphone,
  },
  {
    id: "horizontal",
    label: "Horizontal",
    desc: "16:9 — YouTube",
    icon: Monitor,
  },
] as const;

type FormatId = (typeof formats)[number]["id"];

const verticalLayouts = [
  { id: "auto", label: "Automático", desc: "IA detecta e enquadra automaticamente" },
  { id: "centered", label: "Centralizado", desc: "Enquadramento fixo central" },
  { id: "smart", label: "Inteligente", desc: "Rastreamento inteligente de rostos" },
];

const horizontalLayouts = [
  { id: "original", label: "Original", desc: "Vídeo completo com legendas" },
  { id: "lower-third", label: "Legendas", desc: "Legendas na parte inferior" },
  { id: "split", label: "Dividido", desc: "Tela dividida com transcrição" },
];

export function CreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initialUrl = searchParams.get("url") || "";

  const [step, setStep] = useState(1);
  const [url, setUrl] = useState(initialUrl);
  const [format, setFormat] = useState<FormatId | null>(null);
  const [layout, setLayout] = useState<string | null>(null);

  const urlError = url.trim() && !extractYoutubeId(url) ? "Invalid URL. Please enter a valid YouTube link." : null;
  const youtubeId = extractYoutubeId(url);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const project = await api.projects.create(extractVideoTitle(url));
      const result = await api.videos.submitYoutube(project.id, url);
      return { projectId: project.id, jobId: result.jobId };
    },
    onSuccess: (data) => {
      navigate(`/videos/processing/${data.jobId}`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  function canContinueStep1() {
    return url.trim() && !urlError;
  }

  function canContinueStep2() {
    return format !== null && layout !== null;
  }

  const layouts = format === "vertical" ? verticalLayouts : horizontalLayouts;

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="mx-auto max-w-xl space-y-5">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Paste the video link</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the YouTube URL you want to turn into clips
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">YouTube URL</label>
              <Input
                placeholder="https://youtube.com/watch?v=…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-11 border-border bg-bg-deep text-foreground placeholder:text-muted-foreground/50"
              />
              {urlError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                  {urlError}
                </p>
              )}
              {youtubeId && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check className="h-3 w-3" />
                  Video ID detected: {youtubeId}
                </p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="mx-auto max-w-xl space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Defina o formato do vídeo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha se o corte será vertical (Reels, TikTok, Shorts) ou horizontal (Youtube)
                e selecione o layout de enquadramento ideal para o seu conteúdo
              </p>
            </div>

            {youtubeId && (
              <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border">
                <img
                  src={getThumbnailUrl(url) ?? ""}
                  alt="Video thumbnail"
                  className="aspect-video w-full bg-bg-deep object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFormat(f.id);
                    setLayout(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-5 transition-all duration-200",
                    format === f.id
                      ? "border-accent-violet bg-accent-violet/10 ring-1 ring-accent-violet"
                      : "border-border bg-bg-deep hover:border-accent-violet/30"
                  )}
                >
                  <f.icon
                    className={cn(
                      "h-8 w-8",
                      format === f.id ? "text-accent-violet" : "text-muted-foreground"
                    )}
                  />
                  <div className="text-center">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        format === f.id ? "text-white" : "text-muted-foreground"
                      )}
                    >
                      {f.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {format && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  Layout de enquadramento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {layouts.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayout(l.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all duration-200",
                        layout === l.id
                          ? "border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan"
                          : "border-border bg-bg-deep hover:border-accent-cyan/30"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          layout === l.id ? "text-accent-cyan" : "text-white"
                        )}
                      >
                        {l.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{l.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="mx-auto max-w-xl space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Review</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the details before generating clips
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-bg-deep p-4">
              <div className="flex items-center gap-3">
                <Link2 className="h-4 w-4 text-accent-violet" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">YouTube URL</p>
                  <p className="truncate text-sm font-medium text-white">{url}</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-accent-cyan" />
                <div>
                  <p className="text-xs text-muted-foreground">Formato</p>
                  <p className="text-sm font-medium text-white">
                    {format === "vertical" ? "Vertical (9:16)" : "Horizontal (16:9)"}
                  </p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-3">
                <Film className="h-4 w-4 text-accent-violet" />
                <div>
                  <p className="text-xs text-muted-foreground">Layout</p>
                  <p className="text-sm font-medium text-white capitalize">
                    {layout}
                  </p>
                </div>
              </div>
            </div>

            {submitMutation.isError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                {submitMutation.error?.message || "Error submitting video"}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fade-in-up mx-auto max-w-3xl space-y-8 p-8 pb-24">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Step indicator */}
      {step < 3 && (
      <div className="flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  isActive && "bg-accent-violet text-white",
                  isDone && "bg-emerald-500/20 text-emerald-400",
                  !isActive && !isDone && "bg-secondary text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-white" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px w-12",
                    stepNum < step ? "bg-emerald-500/50" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-border bg-surface p-8">
        {stepContent()}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            if (step > 1) setStep(step - 1);
            else navigate(-1);
          }}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        {step < 3 && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 ? !canContinueStep1() : !canContinueStep2()}
            className="gap-1.5 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {step === 3 && (
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="gap-1.5 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Generate Clips
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
