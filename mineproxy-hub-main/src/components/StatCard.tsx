import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

const StatCard = ({ icon: Icon, label, value, sub, accent }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border bg-card p-5 ${accent ? "border-primary/30 glow-primary" : "border-border"}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-md ${accent ? "bg-primary/10" : "bg-secondary"}`}>
          <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
};

export default StatCard;
