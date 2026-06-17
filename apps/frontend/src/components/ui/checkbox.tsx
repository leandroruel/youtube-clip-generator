import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}

export function Checkbox({ checked, onCheckedChange, id }: CheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-accent-violet bg-accent-violet text-white"
          : "border-border bg-transparent hover:border-accent-violet/50"
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}
