import React, { useEffect, useState } from 'react';
import { db, collection, query, where, orderBy, getDocs, deleteDoc, doc, User } from '../lib/firebase';
import { MasteringSettings } from '../types';
import { History, Calendar, Trash2, Settings, ExternalLink, Sparkles, FolderOpen, ArrowUpRight } from 'lucide-react';

interface HistoryDashboardProps {
  user: User | null;
  onApplySettings: (settings: MasteringSettings, fileName: string) => void;
  // Trigger update when a new master is saved
  refreshTrigger: number;
}

interface SavedProject {
  id: string;
  fileName: string;
  settings: MasteringSettings;
  createdAt: any;
  presetUsed?: string;
}

export default function HistoryDashboard({ user, onApplySettings, refreshTrigger }: HistoryDashboardProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const loadedProjects: SavedProject[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedProjects.push({
          id: doc.id,
          fileName: data.fileName,
          settings: data.settings,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          presetUsed: data.presetUsed
        });
      });
      setProjects(loadedProjects);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError('Could not load history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user, refreshTrigger]);

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this mastering project from your history?')) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project.');
    }
  };

  if (!user) {
    return (
      <div className="bg-[#0e0e10]/60 border border-zinc-900 rounded-2xl p-6 text-center space-y-4">
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 text-zinc-500 inline-flex">
          <History className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-zinc-300 text-sm font-semibold">Mixdown & Master History</h4>
          <p className="text-zinc-500 text-xs max-w-xs mx-auto leading-relaxed">
            Create an account or log in to view your cloud project history, save your mastered tracks, and recall settings instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
          <History className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm uppercase font-mono tracking-wider">Cloud Project History</h4>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded-full">
          {projects.length} Saved
        </span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-zinc-500 text-xs font-mono">
          Loading historic mixdowns...
        </div>
      ) : error ? (
        <div className="py-6 text-center text-red-400 text-xs">{error}</div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-zinc-500 text-xs">No projects in history yet.</p>
          <p className="text-[10px] text-zinc-600 max-w-[240px] mx-auto leading-relaxed">
            Upload a file, customize the DSP settings, hit 'Render & Master', then save the finished master to your cloud account!
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-[#121214] border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all group"
            >
              <div className="truncate space-y-1.5 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-zinc-200 truncate block max-w-[180px] sm:max-w-xs" title={project.fileName}>
                    {project.fileName}
                  </span>
                  {project.settings.loudness && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-emerald-400 border border-emerald-500/10">
                      {project.settings.loudness === 'cd' ? '-7 LUFS' : project.settings.loudness === 'club' ? '-9 LUFS' : '-14 LUFS'}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-mono text-zinc-500">
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1 text-zinc-600" />
                    {project.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span className="capitalize text-zinc-400">
                    {project.settings.character} Tone
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  id={`apply-project-${project.id}`}
                  onClick={() => onApplySettings(project.settings, project.fileName)}
                  className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                  title="Load mix settings into active rack sliders"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`delete-project-${project.id}`}
                  onClick={(e) => handleDelete(project.id, e)}
                  className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 rounded-lg transition-colors cursor-pointer"
                  title="Remove from cloud history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
