import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LayoutDashboard, Trash2 } from "lucide-react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { Modal } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";

export default function DashboardListPage() {
  const { dashboards, isLoading, fetchDashboards, createDashboard, deleteDashboard } =
    useDashboardStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const d = await createDashboard({ title, description: description || undefined });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      navigate(`/dashboard/${d.id}`);
    } catch {
      toast("error", "Failed to create dashboard");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this dashboard?")) return;
    try {
      await deleteDashboard(id);
      toast("success", "Dashboard deleted");
    } catch {
      toast("error", "Failed to delete dashboard");
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboards</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Create, configure, and monitor analytical dashboards
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
        >
          <Plus size={16} />
          New Dashboard
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white" />
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <LayoutDashboard size={20} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            No dashboards created
          </h3>
          <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Connect a database or upload a dataset to begin generating dashboards.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            Create Dashboard
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/dashboard/${d.id}`)}
              className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {d.title}
                  </h3>
                  {d.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {d.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(d.id, e)}
                  className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                <span>{d.widget_count} widget{d.widget_count !== 1 ? "s" : ""}</span>
                <span>{new Date(d.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Dashboard">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="e.g. Sales Overview"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="Brief description"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Dashboard
          </button>
        </form>
      </Modal>
    </div>
  );
}
