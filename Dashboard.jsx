import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import MapView from "./MapView.jsx";
import { PriorityBadge } from "./ReportFlow.jsx";

export default function Dashboard({ refreshKey }) {
  const [data, setData] = useState({ stats: {}, complaints: [] });
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.list().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  const rows = data.complaints.filter((c) => {
    if (filter === "all") return true;
    if (filter === "pending") return ["draft", "researching", "pending_approval"].includes(c.status);
    if (filter === "submitted") return ["submitted", "in_progress"].includes(c.status);
    if (filter === "overdue") return c.overdue;
    return c.status === filter;
  });

  const update = async (id, status) => {
    await api.setStatus(id, status);
    load();
  };

  const s = data.stats;
  const tiles = [
    ["all", "Total", s.total],
    ["pending", "Pending", s.pending],
    ["submitted", "Submitted", s.submitted],
    ["resolved", "Resolved", s.resolved],
    ["overdue", "Overdue", s.overdue],
  ];

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-xl border p-4 text-left ${filter === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
          >
            <div className="text-2xl font-bold">{n ?? 0}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </button>
        ))}
      </div>

      <MapView complaints={data.complaints} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Issue</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
              <th className="p-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.address || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}</div>
                  {c.duplicate_count > 0 && <div className="text-xs text-amber-700">{c.duplicate_count} similar report(s) nearby</div>}
                </td>
                <td className="p-3"><PriorityBadge label={c.priority_label} score={c.priority_score} /></td>
                <td className="p-3 text-xs">{c.department || "-"}</td>
                <td className="p-3 text-xs">
                  {c.status.replace("_", " ")}
                  {c.overdue && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">overdue</span>}
                  {c.reference_id && <div className="text-slate-400">{c.reference_id}</div>}
                </td>
                <td className="p-3">
                  {["submitted", "in_progress"].includes(c.status) && (
                    <select
                      className="rounded border border-slate-300 p-1 text-xs"
                      value=""
                      onChange={(e) => e.target.value && update(c.id, e.target.value)}
                    >
                      <option value="">Change…</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">No complaints here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
