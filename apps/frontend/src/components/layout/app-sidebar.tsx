import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Video,
  Sparkles,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/videos", label: "My Videos", icon: Video },
];

export function AppSidebar() {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-bg-deep">
      <div className="flex items-center gap-3 border-b border-border px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan shadow-lg shadow-accent-violet/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span
          className="text-lg font-bold tracking-tight text-white"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          CLIPFLARE
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-accent-violet/10 text-accent-violet shadow-sm"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-xl bg-gradient-to-br from-accent-violet/10 to-accent-cyan/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-violet" />
            <span
              className="text-xs font-semibold uppercase tracking-wider text-accent-violet"
            >
              PRO PLAN
            </span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full w-2/3 rounded-full bg-gradient-to-r from-accent-violet to-accent-cyan"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            8 / 12 credits used
          </p>
        </div>
      </div>
    </aside>
  );
}
