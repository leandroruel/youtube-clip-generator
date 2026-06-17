import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FolderOpen, Plus, Trash2, Sparkles, Link, Loader2 } from "lucide-react";

const statusVariant: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  processing: "bg-amber-500/10 text-amber-400",
  ready: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

const thumbGradients = [
  "from-violet-600 to-purple-800",
  "from-blue-600 to-cyan-700",
  "from-emerald-600 to-teal-800",
  "from-orange-600 to-red-700",
  "from-pink-600 to-rose-800",
  "from-indigo-600 to-blue-800",
];

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: api.projects.list,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => api.projects.create(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNewTitle("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const submitYoutubeMutation = useMutation({
    mutationFn: ({
      projectId,
      youtubeUrl,
    }: {
      projectId: string;
      youtubeUrl: string;
    }) => api.videos.submitYoutube(projectId, youtubeUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setExpandedUrl(null);
    },
  });

  return (
    <div className="space-y-8 p-8 pb-24">
      <div className="fade-in-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your video projects
          </p>
        </div>
      </div>

      <div className="fade-in-up animated-border-card" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-xl bg-surface p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim()) createMutation.mutate(newTitle.trim());
            }}
            className="flex gap-3"
          >
            <Input
              placeholder="Project name…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-11 border-border bg-bg-deep text-foreground placeholder:text-muted-foreground/50"
            />
            <Button
              type="submit"
              disabled={!newTitle.trim() || createMutation.isPending}
              className="h-11 gap-2 bg-gradient-to-r from-accent-violet to-accent-cyan text-white shadow-lg shadow-accent-violet/20"
            >
              {createMutation.isPending ? (
                <span className="animate-pulse">Creating…</span>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New Project
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-surface" />
            ))
          : projects?.map((project: Project, i: number) => (
              <div
                key={project.id}
                className="group rounded-xl border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-violet/30 hover:shadow-xl"
              >
                <div
                  className={cn(
                    "flex h-28 items-end justify-end rounded-t-xl bg-gradient-to-br p-4",
                    thumbGradients[i % thumbGradients.length]
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(project.id)}
                    className="h-8 w-8 bg-black/20 text-white/70 hover:bg-black/40 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-accent-violet" />
                    <h3 className="font-semibold text-white">{project.title}</h3>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        statusVariant[project.status] || ""
                      )}
                    >
                      {project.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-3">
                    {expandedUrl === project.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const url = urlInputs[project.id];
                          if (url?.trim()) {
                            submitYoutubeMutation.mutate({
                              projectId: project.id,
                              youtubeUrl: url.trim(),
                            });
                          }
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="YouTube URL…"
                          value={urlInputs[project.id] || ""}
                          onChange={(e) =>
                            setUrlInputs((prev) => ({
                              ...prev,
                              [project.id]: e.target.value,
                            }))
                          }
                          className="h-8 flex-1 border-border bg-bg-deep text-xs placeholder:text-muted-foreground/50"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submitYoutubeMutation.isPending}
                          className="h-8 gap-1 bg-gradient-to-r from-accent-violet to-accent-cyan text-white text-xs"
                        >
                          {submitYoutubeMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setExpandedUrl(project.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent-violet transition-colors"
                      >
                        <Link className="h-3.5 w-3.5" />
                        Add YouTube video
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        {!isLoading && projects?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <p className="text-xs text-muted-foreground/60">
              Create your first project above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
