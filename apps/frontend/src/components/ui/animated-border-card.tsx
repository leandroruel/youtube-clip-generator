import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AnimatedBorderCardProps {
  children: ReactNode;
  className?: string;
  speed?: number;
}

export function AnimatedBorderCard({
  children,
  className,
  speed = 4,
}: AnimatedBorderCardProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={
        { "--border-spin-speed": `${speed}s` } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "conic-gradient(from 0deg, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.3))",
          animation: `borderSpin var(--border-spin-speed, 4s) linear infinite`,
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1.5px",
          borderRadius: "inherit",
        }}
      />
      <div className="relative rounded-[inherit] bg-card">{children}</div>
    </div>
  );
}
