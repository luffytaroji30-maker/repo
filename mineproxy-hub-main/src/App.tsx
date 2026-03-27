import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, NavLink, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Zap, LayoutDashboard, Package, FolderOpen, Settings, LogOut, Power } from "lucide-react";
import StatusIndicator from "@/components/StatusIndicator";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Plugins from "./pages/Plugins.tsx";
import Files from "./pages/Files.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/plugins", icon: Package, label: "Plugins" },
  { to: "/files", icon: FolderOpen, label: "Files" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const Shell = () => {
  const { logout } = useAuth();
  const location = useLocation();

  const handleStop = async () => {
    if (!confirm("Stop the proxy?")) return;
    try {
      await api("POST", "/api/server/stop");
      toast.success("Stop signal sent");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card/50 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 p-4 border-b border-border">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center glow-primary">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">HellCore</h1>
            <StatusIndicator status="online" label="Online" />
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border space-y-0.5">
          <button
            onClick={handleStop}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Power className="h-4 w-4" />
            Stop Proxy
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const AuthGate = () => {
  const { authed, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  return authed ? <Shell /> : <Login />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AuthGate />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
