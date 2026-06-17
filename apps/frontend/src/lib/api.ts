import { QueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface Project {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  projectId: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  thumbnailPath: string | null;
  duration: number | null;
  status: string;
  audioPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Clip {
  id: string;
  projectId: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string | null;
  status: string;
  outputPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  projectId: string;
  type: string;
  status: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

export const api = {
  projects: {
    list: () =>
      apiFetch<{ projects: Project[] }>("/v1/projects").then((r) => r.projects),
    get: (id: string) => apiFetch<Project>(`/v1/projects/${id}`),
    create: (title: string) =>
      apiFetch<Project>("/v1/projects", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    update: (id: string, title: string) =>
      apiFetch<Project>(`/v1/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    delete: (id: string) =>
      apiFetch<void>(`/v1/projects/${id}`, { method: "DELETE" }),
  },
  clips: {
    list: () =>
      apiFetch<{ clips: Clip[] }>("/v1/clips").then((r) => r.clips),
    get: (id: string) => apiFetch<Clip>(`/v1/clips/${id}`),
    delete: (id: string) =>
      apiFetch<void>(`/v1/clips/${id}`, { method: "DELETE" }),
  },
  videos: {
    list: () =>
      apiFetch<{ videos: Video[] }>("/v1/videos").then((r) => r.videos),
    get: (id: string) => apiFetch<Video>(`/v1/videos/${id}`),
    delete: (id: string) =>
      apiFetch<void>(`/v1/videos/${id}`, { method: "DELETE" }),
    submitYoutube: (projectId: string, youtubeUrl: string) =>
      apiFetch<{ jobId: string; message: string }>("/v1/videos/youtube", {
        method: "POST",
        body: JSON.stringify({ projectId, youtubeUrl }),
      }),
  },
  jobs: {
    list: () =>
      apiFetch<{ jobs: Job[] }>("/v1/jobs").then((r) => r.jobs),
    get: (id: string) => apiFetch<Job>(`/v1/jobs/${id}`),
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
