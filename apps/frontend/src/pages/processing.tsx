import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Job, type Clip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2, Loader2, X, ChevronLeft, ArrowRight } from "lucide-react";

const STAGES = [
  { id: "queued", label: "Video queued for download" },
  { id: "downloading", label: "Downloading & processing video" },
  { id: "analyzing", label: "Analyzing & generating clips" },
  { id: "ready", label: "Clips ready!" },
];

function getCurrentStage(job: Job | undefined, clipsCount: number): number {
  if (!job) return 0;
  if (job.status === "pending" || job.status === "queued") return 0;
  if (job.status === "processing") return 1;
  if (job.status === "completed") {
    if (clipsCount > 0) return 3;
    return 2;
  }
  return -1;
}

export function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const notifiedReady = useRef(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.jobs.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data?.status === "completed" || query.state.data?.status === "failed" ? false : 2000,
  });

  const { data: allClips } = useQuery({
    queryKey: ["all-clips"],
    queryFn: () => api.clips.list(),
    enabled: !!job && job.status === "completed",
    refetchInterval: (query) => {
      if (!query.state.data || !job) return 4000;
      const hasProjectClips = query.state.data.some((c: Clip) => c.projectId === job.projectId);
      return hasProjectClips ? false : 4000;
    },
  });

  const projectClips = job && allClips
    ? allClips.filter((c: Clip) => c.projectId === job.projectId)
    : [];

  useEffect(() => {
    if (projectClips.length > 0 && !notifiedReady.current) {
      notifiedReady.current = true;
      toast.success("Clips are ready!");
    }
  }, [projectClips]);

  const currentIdx = getCurrentStage(job, projectClips.length);

  return (
    <div className="fade-in-up mx-auto max-w-3xl space-y-8 p-8 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">Processing your video</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentIdx === 3
              ? "All clips have been generated successfully."
              : "This may take a few minutes. We will notify you when it's ready."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-8">
          <div className="space-y-3">
            {STAGES.map((stage, i) => {
              const isLastDone = currentIdx === STAGES.length - 1;
              const isActive = i === currentIdx && !isLastDone;
              const isDone = i < currentIdx || (isLastDone && i === currentIdx);
              const isError = currentIdx === -1;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 transition-all",
                    isActive && !isError && "border-accent-violet bg-accent-violet/5",
                    isDone && "border-emerald-500/30 bg-emerald-500/5",
                    isError && "border-red-500/30 bg-red-500/5",
                    !isActive && !isDone && !isError && "border-border opacity-50"
                  )}
                >
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : isActive && !isError ? (
                      <Loader2 className="h-5 w-5 animate-spin text-accent-violet" />
                    ) : isError ? (
                      <X className="h-5 w-5 text-red-400" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-border" />
                    )}
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDone && "text-emerald-400",
                        isActive && !isError && "text-white",
                        isError && "text-red-400",
                        !isActive && !isDone && !isError && "text-muted-foreground"
                      )}
                    >
                      {stage.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {currentIdx === -1 && job?.error && (
            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
              {job.error}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          {currentIdx === 3 ? (
            <Button
              onClick={() => navigate("/videos")}
              className="gap-2 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30"
            >
              View Clips
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : currentIdx === -1 ? (
            <Button
              variant="outline"
              onClick={() => navigate("/create")}
              className="gap-1.5 border-border bg-surface text-muted-foreground hover:text-foreground"
            >
              Try Again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
