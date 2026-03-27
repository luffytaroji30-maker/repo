import { motion } from "framer-motion";
import { Users, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { api, Player } from "@/lib/api";

const PlayerList = () => {
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<{ players: Player[] }>('GET', '/api/players');
        setPlayers(data.players || []);
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Users className="h-4 w-4 text-accent" />
        <h2 className="font-semibold text-sm">Online Players</h2>
        <span className="ml-auto text-xs text-muted-foreground">{players.length} connected</span>
      </div>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-secondary rounded-md pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto console-scroll divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {search ? "No matching players" : "No players online"}
          </div>
        ) : filtered.map((player) => (
          <div key={player.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors">
            <div className="h-7 w-7 rounded bg-secondary flex items-center justify-center">
              <img
                src={`https://mc-heads.net/avatar/${player.name}/28`}
                alt={player.name}
                className="rounded"
                loading="lazy"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{player.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{player.server}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PlayerList;
