import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const Settings = () => {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await api<{ content: string }>('GET', '/api/settings');
      setContent(data.content);
      setOriginal(data.content);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    try {
      const res = await api<{ ok: boolean; error?: string }>('PUT', '/api/settings', { content });
      if (res.ok) {
        setOriginal(content);
        toast.success('Settings saved! Restart proxy to apply.');
      } else {
        toast.error(res.error || 'Save failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const hasChanges = content !== original;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Proxy Settings</h2>
          <span className="text-xs text-muted-foreground">velocity.toml</span>
          {hasChanges && <span className="text-xs text-warning">• Unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setContent(original); }}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } }}
          spellCheck={false}
          className="w-full min-h-[70vh] bg-background rounded-lg border border-border p-4 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
    </motion.div>
  );
};

export default Settings;
