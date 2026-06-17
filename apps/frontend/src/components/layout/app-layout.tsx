import { Outlet } from "react-router-dom";
import { AppSidebar } from "./app-sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />

      <div className="flex flex-1 flex-col bg-background">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
