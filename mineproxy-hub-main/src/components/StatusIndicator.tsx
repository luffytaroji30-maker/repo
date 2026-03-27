import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "offline" | "warning";
  label?: string;
  className?: string;
}

const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-full",
          status === "online" && "bg-success animate-pulse-glow",
          status === "offline" && "bg-destructive",
          status === "warning" && "bg-warning animate-pulse-glow"
        )}
      />
      {label && (
        <span className="text-sm text-muted-foreground capitalize">{label}</span>
      )}
    </div>
  );
};

export default StatusIndicator;
