import { cn } from "@/lib/utils";

const variants = {
  Numeric: "bg-info-soft text-info",
  Categorical: "bg-purple-soft text-purple",
  Target: "bg-success-soft text-success",
  Model: "bg-primary-soft text-primary",
  Classification: "bg-info-soft text-info",
  Regression: "bg-purple-soft text-purple",
  Good: "bg-success-soft text-success",
  Mid: "bg-warning-soft text-warning",
  Bad: "bg-destructive/10 text-destructive",
} as const;

export function Pill({
  children,
  variant = "Model",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
