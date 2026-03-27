import { Users, Activity, Cpu, Globe } from "lucide-react";
import StatCard from "@/components/StatCard";
import BackendServers from "@/components/BackendServers";
import PlayerList from "@/components/PlayerList";
import ConsoleView from "@/components/ConsoleView";
import { useServerInfo } from "@/hooks/useServerInfo";
import { formatBytes, formatUptime } from "@/lib/api";

const Index = () => {
  const info = useServerInfo();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Players Online" value={info ? String(info.playerCount ?? 0) : "—"} sub={info ? `Proxy ${info.online ? 'Online' : 'Offline'}` : "Loading…"} accent />
        <StatCard icon={Globe} label="Uptime" value={info?.uptime != null ? formatUptime(info.uptime) : "—"} sub="Since last restart" />
        <StatCard icon={Activity} label="CPU Load" value={info?.cpuLoad != null ? `${info.cpuLoad}%` : "—"} sub="1 min avg" />
        <StatCard icon={Cpu} label="Memory" value={info?.memUsed != null ? formatBytes(info.memUsed) : "—"} sub={info?.memTotal != null ? `of ${formatBytes(info.memTotal)}` : ""} />
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
