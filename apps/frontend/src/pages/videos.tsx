import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getClipStreamUrl, type Clip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Sparkles,
  Trash2,
  Trash,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 12;

const statusVariant: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-amber-500/10 text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

const thumbGradients = [
  "from-violet-600 to-purple-800",
  "from-blue-600 to-cyan-700",
  "from-emerald-600 to-teal-800",
  "from-orange-600 to-red-700",
  "from-pink-600 to-rose-800",
  "from-indigo-600 to-blue-800",
  "from-teal-600 to-emerald-800",
  "from-rose-600 to-pink-800",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideosPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setSelectedIds(new Set());
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: (clipId: string) => api.clips.delete(clipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      toast.success("Clip deleted");
      setDeletingClipId(null);
    },
    onError: () => {
      toast.error("Failed to delete clip");
      setDeletingClipId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.clips.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      setSelectedIds(new Set());
      toast.success(`${data.deleted} clips deleted`);
    },
    onError: () => {
      toast.error("Failed to delete clips");
    },
  });

  const { data: allClips, isLoading } = useQuery({
    queryKey: ["clips"],
    queryFn: () => api.clips.list(),
  });

  const filteredClips = (allClips ?? []).filter(
    (c) => statusFilter === "all" || c.status === statusFilter
  );
  const totalPages = Math.max(1, Math.ceil(filteredClips.length / PAGE_SIZE));
  const paginatedClips = filteredClips.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const allFilteredSelected = paginatedClips.length > 0 && paginatedClips.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedClips.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8 p-8 pb-24">
      <div className="fade-in-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your rendered captioned clips
          </p>
        </div>
        <div className="flex items-center gap-3">
          {paginatedClips.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-white"
            >
              <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
              Select All
            </button>
          )}
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-36 border-border bg-surface text-sm">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[9/16] rounded-xl bg-surface" />
            </div>
          ))}
        </div>
      ) : paginatedClips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No clips found</p>
          <p className="text-xs text-muted-foreground/60">
            {statusFilter !== "all"
              ? "Try a different filter"
              : "Submit a video to get started"}
          </p>
        </div>
      ) : (
        <div className="fade-in-up grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {paginatedClips.map((clip: Clip, i: number) => (
            <div
              key={clip.id}
              className="relative rounded-xl border border-border bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-accent-violet/30 hover:shadow-xl"
            >
              <div
                onClick={() => setPlayingClipId(playingClipId === clip.id ? null : clip.id)}
                className={cn(
                  "group relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-t-xl",
                  playingClipId === clip.id ? "bg-black" : "cursor-pointer bg-gradient-to-br",
                  playingClipId !== clip.id && thumbGradients[i % thumbGradients.length]
                )}
              >
                <div
                  className="absolute left-2 top-2 z-20 rounded-md bg-black/40 p-1.5 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox checked={selectedIds.has(clip.id)} onCheckedChange={() => toggleSelect(clip.id)} />
                </div>
                {playingClipId === clip.id ? (
                  <video
                    src={getClipStreamUrl(clip.id)}
                    className="h-full w-full object-contain"
                    controls
                    autoPlay
                    playsInline
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-black/20 transition-opacity group-hover:bg-black/10" />
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-hover:scale-110">
                      <Play className="h-6 w-6 fill-white text-white" />
                    </div>
                    <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                      {formatDuration(clip.endTime - clip.startTime)}
                    </span>
                  </>
                )}
              </div>
              <AlertDialog
                open={deletingClipId === clip.id}
                onOpenChange={(open) =>
                  setDeletingClipId(open ? clip.id : null)
                }
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 z-10 h-7 w-7 bg-black/20 text-white/70 opacity-0 transition-opacity hover:bg-black/40 hover:text-red-400 hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete clip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this individual clip.
                      The source video and other clips will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setDeletingClipId(null);
                        deleteMutation.mutate(clip.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-white leading-snug">
                  {clip.text || "Untitled Clip"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      statusVariant[clip.status] || ""
                    )}
                  >
                    {clip.status}
                  </span>
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
      )}

      {filteredClips.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border-border bg-surface text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border-border bg-surface text-muted-foreground hover:text-foreground"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3 shadow-2xl backdrop-blur-md">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-1.5 text-xs text-red-400 hover:text-red-300"
            >
              <Trash className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} clips?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected clips.
              The source video and other clips will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBulkDeleteOpen(false);
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
