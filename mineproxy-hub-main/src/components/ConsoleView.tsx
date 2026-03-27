import { motion } from "framer-motion";
import { Terminal, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

const levelColor = (level: string) => {
  switch (level) {
    case "ERROR": return "text-destructive";
    case "WARN": return "text-warning";
    case "CMD": return "text-primary";
    default: return "text-muted-foreground";
  }
};

const ConsoleView = () => {
  const [command, setCommand] = useState("");
  const { logs, connected, sendCommand, connect, disconnect } = useWebSocket();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { connect(); return () => { disconnect(); }; }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = () => {
    if (!command.trim()) return;
    sendCommand(command);
    setCommand("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Console</h2>
        <span className={`ml-auto text-[10px] ${connected ? 'text-primary' : 'text-destructive'}`}>
          {connected ? '● Live' : '○ Disconnected'}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="h-[280px] overflow-y-auto console-scroll p-4 font-mono text-xs space-y-1 bg-background/50"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-muted-foreground/60 shrink-0">{log.time}</span>
            <span className={`shrink-0 w-12 ${levelColor(log.level)}`}>[{log.level}]</span>
            <span className={log.level === "CMD" ? "text-primary" : "text-foreground/80"}>{log.msg}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-border">
        <span className="text-primary text-sm font-mono">{">"}</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a command..."
          className="flex-1 bg-transparent text-sm font-mono placeholder:text-muted-foreground focus:outline-none"
        />
        <button onClick={handleSend} className="p-1.5 rounded hover:bg-secondary transition-colors">
          <Send className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  );
};

export default ConsoleView;
