import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api, getStreamUrl } from "@/lib/api";
import { AiPreview } from "@/components/ai-preview";
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
  Link2,
  ChevronLeft,
  ScanFace,
  Eye,
} from "lucide-react";

const STEP_LABELS = ["Video", "Formato", "Preview", "Revisão"];

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

const framingOptions = [
  { id: "auto", label: "Automático", desc: "Recomendado — IA enquadra automaticamente", badge: "IA" },
  { id: "face", label: "Foco no rosto", desc: "Centraliza nos rostos detectados", badge: "IA" },
  { id: "center", label: "Centro", desc: "Enquadramento fixo central" },
  { id: "split", label: "Tela dividida", desc: "Divide a tela com transcrição" },
  { id: "react", label: "Reação", desc: "Picture-in-picture com câmera" },
];

export function CreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initialUrl = searchParams.get("url") || "";

  const [step, setStep] = useState(1);
  const [url, setUrl] = useState(initialUrl);
  const [format, setFormat] = useState<FormatId | null>(null);
  const [framing, setFraming] = useState<string | null>(null);
  const [faceDetectionReady, setFaceDetectionReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const step3Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [, setProjectId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const needsAiPreview = framing && ["auto", "face"].includes(framing);
  const urlError = url.trim() && !extractYoutubeId(url) ? "Invalid URL. Please enter a valid YouTube link." : null;
  const youtubeId = extractYoutubeId(url);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const project = await api.projects.create(extractVideoTitle(url));
      const result = await api.videos.submitYoutube(project.id, url);
      return { projectId: project.id, videoId: result.videoId, jobId: result.jobId };
    },
    onSuccess: (data) => {
      setProjectId(data.projectId);
      setVideoId(data.videoId);
      setJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const { data: video } = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => api.videos.get(videoId!),
    enabled: !!videoId,
    refetchInterval: (query) => {
      if (!query.state.data) return 2000;
      if (query.state.data.proxyPath && query.state.data.status !== "pending") return false;
      return 2000;
    },
  });

  const videoReady = video?.proxyPath && video?.status !== "pending";

  useEffect(() => {
    if (step === 3) {
      setFaceDetectionReady(false);
      setTimedOut(false);
      step3Timer.current = setTimeout(() => setTimedOut(true), 45_000);
    }
    return () => {
      if (step3Timer.current) clearTimeout(step3Timer.current);
    };
  }, [step]);

  function canContinueStep1() {
    return url.trim() && !urlError;
  }

  function canContinueStep2() {
    if (format === null || framing === null) return false;
    return true;
  }

  function canContinueStep3() {
    if (!needsAiPreview) return true;
    if (videoReady && faceDetectionReady) return true;
    if (timedOut) return true;
    if (video && video.status !== "pending" && !video.proxyPath) return true;
    return false;
  }



  async function handleNextFromStep1() {
    if (!url.trim() || urlError) return;
    await submitMutation.mutateAsync();
    setStep(2);
  }

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
              <h3 className="text-lg font-bold text-white">Format & AI Detection</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose your output format and configure AI face detection
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
                    setFraming(null);
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
                <div className="flex items-center gap-2">
                  <ScanFace className="h-5 w-5 text-accent-violet" />
                  <span className="text-sm font-medium text-white">Enquadramento</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {framingOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFraming(o.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all duration-200",
                        framing === o.id
                          ? "border-accent-violet bg-accent-violet/10 ring-1 ring-accent-violet"
                          : "border-border bg-bg-deep hover:border-accent-violet/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            framing === o.id ? "text-accent-violet" : "text-white"
                          )}
                        >
                          {o.label}
                        </p>
                        {o.badge && (
                          <span className="rounded bg-accent-violet/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-violet">
                            {o.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{o.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
      {
        const previewUnavailable = video && !video.proxyPath && video.status !== "pending";

        if (!needsAiPreview) {
          return (
            <div className="mx-auto max-w-xl space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Preview</h3>
                <p className="mt-1 text-sm text-muted-foreground">Pré-visualização não necessária para este modo de enquadramento</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-bg-deep p-12">
                <Eye className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Pronto para gerar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O enquadramento selecionado não requer preview de detecção facial.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="mx-auto max-w-xl space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Preview de Detecção Facial</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique se a IA está detectando rostos corretamente no seu vídeo
              </p>
            </div>

            {videoReady ? (
              <div className="space-y-4">
                <AiPreview
                  videoUrl={getStreamUrl(videoId!)}
                  mode="multiple"
                  onReady={() => setFaceDetectionReady(true)}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Detectando rostos — caixas mostram as faces identificadas</span>
                </div>
              </div>
            ) : previewUnavailable ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-bg-deep p-12">
                <Eye className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Preview não disponível</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O preview do vídeo não pôde ser baixado. Você pode continuar mesmo assim.
                  </p>
                </div>
              </div>
            ) : timedOut ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-bg-deep p-12">
                <Eye className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Ainda carregando?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O preview está demorando mais que o esperado. Você pode pular e continuar.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-bg-deep p-12">
                <Loader2 className="h-10 w-10 animate-spin text-accent-violet" />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Preparando preview do vídeo...</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O vídeo está sendo baixado e processado. Geralmente leva 1-2 minutos.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 4:
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
                  <p className="text-xs text-muted-foreground">Format</p>
                  <p className="text-sm font-medium text-white">
                    {format === "vertical" ? "Vertical (9:16)" : "Horizontal (16:9)"}
                  </p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-3">
                <ScanFace className="h-4 w-4 text-accent-violet" />
                <div>
                  <p className="text-xs text-muted-foreground">Enquadramento</p>
                  <p className="text-sm font-medium text-white capitalize">
                    {framingOptions.find((o) => o.id === framing)?.label || framing}
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

        {step < 4 && (
          <Button
            onClick={step === 1 ? handleNextFromStep1 : () => setStep(step + 1)}
            disabled={
              step === 1 ? !canContinueStep1() || submitMutation.isPending
              : step === 2 ? !canContinueStep2()
              : step === 3 ? !canContinueStep3()
              : false
            }
            className="gap-1.5 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
          >
            {step === 3 && needsAiPreview && !faceDetectionReady && !timedOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === 1 && submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {step === 3 && needsAiPreview && !faceDetectionReady ? (timedOut ? "Skip" : "Loading...") : step === 1 && submitMutation.isPending ? "Starting..." : "Next"}
          </Button>
        )}

        {step === 4 && (
          <Button
            onClick={() => navigate(`/videos/processing/${jobId}`)}
            className="gap-1.5 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
          >
            Generate Clips
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
