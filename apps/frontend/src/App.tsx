import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { HomePage } from "@/pages/home";
import { CreatePage } from "@/pages/create";
import { ProjectsPage } from "@/pages/projects";
import { VideosPage } from "@/pages/videos";
import { ProcessingPage } from "@/pages/processing";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/videos/processing/:jobId" element={<ProcessingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
