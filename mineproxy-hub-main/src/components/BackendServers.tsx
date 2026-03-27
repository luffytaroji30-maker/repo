import { motion } from "framer-motion";
import { Server, Users, Wifi } from "lucide-react";
import StatusIndicator from "./StatusIndicator";
import { useState, useEffect } from "react";
import { api, BackendServer } from "@/lib/api";

const BackendServers = () => {
  const [servers, setServers] = useState<BackendServer[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<{ servers: BackendServer[] }>('GET', '/api/servers');
        setServers(data.servers || []);
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Server className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Backend Servers</h2>
        <span className="ml-auto text-xs text-muted-foreground">{servers.filter(s => s.status === "online").length}/{servers.length} online</span>
      </div>
      <div className="divide-y divide-border">
        {servers.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No servers configured</div>
        ) : servers.map((server) => (
          <div key={server.name} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors">
            <StatusIndicator status={server.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{server.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{server.address}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{server.players}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground w-16 justify-end">
              <Wifi className="h-3 w-3" />
              <span>{server.ping > 0 ? `${server.ping}ms` : "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default BackendServers;
