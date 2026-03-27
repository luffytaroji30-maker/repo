import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, FileText, Upload, FolderPlus, FilePlus, Download, Trash2, Pencil, ArrowLeft, Save, Search, Archive } from 'lucide-react';
import { api, FileEntry, formatBytes } from '@/lib/api';
import { toast } from 'sonner';

const EDITABLE = /\.(yml|yaml|json|properties|txt|cfg|conf|sk|toml|xml|log|md|csv|sh|bat)$/i;
const ARCHIVE = /\.(zip|tar|tar\.gz|tgz|tar\.bz2|gz)$/i;

const Files = () => {
  const [pathParts, setPathParts] = useState<string[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ path: string; content: string; saved: boolean } | null>(null);
  const [search, setSearch] = useState('');

  const currentPath = pathParts.join('/');

  const loadDir = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ entries: FileEntry[] }>('GET', `/api/files?path=${encodeURIComponent(currentPath)}`);
      setEntries(data.entries || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [currentPath]);

  useEffect(() => { loadDir(); }, [loadDir]);

  const navigate = (name: string) => {
    setSearch('');
    setPathParts(prev => [...prev, name]);
  };

  const goTo = (idx: number) => {
    setSearch('');
    setPathParts(idx < 0 ? [] : pathParts.slice(0, idx + 1));
  };

  const handleUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer();
      await fetch(`/api/files/upload?path=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin', body: buf
      });
    }
    toast.success('Files uploaded');
    loadDir();
  };

  const handleNewFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    await api('POST', '/api/files/mkdir', { path: currentPath ? `${currentPath}/${name}` : name });
    loadDir();
  };

  const handleNewFile = async () => {
    const name = prompt('File name:');
    if (!name) return;
    await api('PUT', '/api/files/write', { path: currentPath ? `${currentPath}/${name}` : name, content: '' });
    loadDir();
  };

  const handleDelete = async (fp: string) => {
    if (!confirm(`Delete "${fp}"?`)) return;
    await api('DELETE', `/api/files?path=${encodeURIComponent(fp)}`);
    toast.success('Deleted');
    loadDir();
  };

  const handleRename = async (fp: string, oldName: string) => {
    const newName = prompt('Rename to:', oldName);
    if (!newName || newName === oldName) return;
    const dir = fp.substring(0, fp.length - oldName.length);
    await api('POST', '/api/files/rename', { oldPath: fp, newPath: dir + newName });
    toast.success('Renamed');
    loadDir();
  };

  const handleExtract = async (fp: string) => {
    if (!confirm(`Extract "${fp}"?`)) return;
    const res = await api<{ ok: boolean; error?: string }>('POST', '/api/files/extract', { path: fp });
    if (res.ok) { toast.success('Extracted'); loadDir(); }
    else toast.error(res.error || 'Extract failed');
  };

  const handleEdit = async (fp: string) => {
    try {
      const data = await api<{ content: string }>('GET', `/api/files/read?path=${encodeURIComponent(fp)}`);
      setEditing({ path: fp, content: data.content, saved: true });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await api('PUT', '/api/files/write', { path: editing.path, content: editing.content });
      setEditing(prev => prev ? { ...prev, saved: true } : null);
      toast.success('File saved');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Editor view
  if (editing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium truncate">{editing.path}</span>
            {!editing.saved && <span className="text-xs text-warning">• Unsaved</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Save className="h-3 w-3" /> Save
            </button>
            <button
              onClick={() => {
                if (!editing.saved && !confirm('Unsaved changes. Leave?')) return;
                setEditing(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </div>
        </div>
        <textarea
          value={editing.content}
          onChange={(e) => setEditing(prev => prev ? { ...prev, content: e.target.value, saved: false } : null)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } }}
          spellCheck={false}
          className="w-full min-h-[60vh] bg-background rounded-lg border border-border p-4 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </motion.div>
    );
  }

  const filtered = entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => goTo(-1)} className="text-primary hover:underline">server</button>
          {pathParts.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-muted-foreground">›</span>
              <button onClick={() => goTo(i)} className="text-primary hover:underline">{seg}</button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer">
            <Upload className="h-3 w-3" /> Upload
            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
          </label>
          <button onClick={handleNewFolder} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <FolderPlus className="h-3 w-3" /> Folder
          </button>
          <button onClick={handleNewFile} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <FilePlus className="h-3 w-3" /> File
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full bg-secondary rounded-md pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* File list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-right p-3 font-medium w-24">Size</th>
              <th className="text-right p-3 font-medium w-40 hidden md:table-cell">Modified</th>
              <th className="text-right p-3 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{search ? 'No matches' : 'Empty folder'}</td></tr>
            ) : (
              filtered.map((entry) => {
                const fp = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                const editable = !entry.isDir && EDITABLE.test(entry.name);
                const archive = !entry.isDir && ARCHIVE.test(entry.name);
                return (
                  <tr key={entry.name} className="hover:bg-secondary/50 transition-colors">
                    <td className="p-3">
                      <button
                        onClick={() => entry.isDir ? navigate(entry.name) : editable ? handleEdit(fp) : undefined}
                        className={`flex items-center gap-2 ${entry.isDir || editable ? 'hover:text-primary cursor-pointer' : ''}`}
                      >
                        {entry.isDir ? <FolderOpen className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="truncate">{entry.name}</span>
                        {editable && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">edit</span>}
                      </button>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{entry.isDir ? '—' : formatBytes(entry.size)}</td>
                    <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                      {entry.modified ? new Date(entry.modified).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!entry.isDir && (
                          <a href={`/api/files/download?path=${encodeURIComponent(fp)}`} className="p-1 rounded hover:bg-secondary transition-colors" title="Download">
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        )}
                        {editable && (
                          <button onClick={() => handleEdit(fp)} className="p-1 rounded hover:bg-secondary transition-colors" title="Edit">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <button onClick={() => handleRename(fp, entry.name)} className="p-1 rounded hover:bg-secondary transition-colors" title="Rename">
                          <Pencil className="h-3.5 w-3.5 text-accent" />
                        </button>
                        {archive && (
                          <button onClick={() => handleExtract(fp)} className="p-1 rounded hover:bg-secondary transition-colors" title="Extract">
                            <Archive className="h-3.5 w-3.5 text-warning" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(fp)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default Files;
