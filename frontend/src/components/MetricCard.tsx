import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Tone = "success" | "warning" | "destructive" | "primary" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  destructive: "border-l-destructive",
  primary: "border-l-primary",
  neutral: "border-l-border",
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  description,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  description?: string;
}) {
  const cardContent = (
    <div
      className={cn(
        "bg-card rounded-xl border border-border border-l-4 p-5 shadow-sm transition-all duration-200 hover:shadow-md",
        description && "cursor-help hover:border-l-primary-hover",
        toneStyles[tone],
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );

  if (!description) return cardContent;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-[280px] p-3 text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-md rounded-lg"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

