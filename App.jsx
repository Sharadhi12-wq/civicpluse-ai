import { useState } from "react";
import ReportFlow from "./components/ReportFlow.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [tab, setTab] = useState("report");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-bold text-indigo-700">CivicPulse AI</h1>
            <p className="text-xs text-slate-500">Report a problem. Let AI find the solution.</p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {[["report", "Report"], ["dashboard", "Dashboard"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 ${tab === k ? "bg-white shadow font-medium" : "text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "report" ? (
          <ReportFlow onDone={() => setRefreshKey((k) => k + 1)} />
        ) : (
          <Dashboard refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
