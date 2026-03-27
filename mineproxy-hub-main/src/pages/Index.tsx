import { Users, Activity, Cpu, Globe } from "lucide-react";
import StatCard from "@/components/StatCard";
import BackendServers from "@/components/BackendServers";
import PlayerList from "@/components/PlayerList";
import ConsoleView from "@/components/ConsoleView";
import { useServerInfo } from "@/hooks/useServerInfo";
import { formatBytes } from "@/lib/api";

const Index = () => {
  const info = useServerInfo();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Players Online" value={info ? String(info.onlinePlayers) : "—"} sub={info ? `Proxy ${info.status}` : "Loading…"} accent />
        <StatCard icon={Globe} label="Uptime" value={info?.uptime || "—"} sub="Since last restart" />
        <StatCard icon={Activity} label="CPU Load" value={info ? `${info.cpuUsage}%` : "—"} sub="1 min avg" />
        <StatCard icon={Cpu} label="Memory" value={info ? formatBytes(info.memoryUsed) : "—"} sub={info ? `of ${formatBytes(info.memoryTotal)}` : ""} />
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        <BackendServers />
        <PlayerList />
      </div>

      {/* Console */}
      <ConsoleView />
    </div>
  );
};

export default Index;
