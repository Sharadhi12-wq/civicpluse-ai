import { useState } from "react";
import { api } from "../api.js";
import MapView from "./MapView.jsx";

const STEPS = ["Report", "AI research", "Review & approve", "Done"];

export default function ReportFlow({ onDone }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [coords, setCoords] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const locate = () => {
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Could not get your location. Enter coordinates manually below.")
    );
  };

  const run = async (label, fn) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const analyzeAndResearch = () =>
    run("AI is analysing your report…", async () => {
      const fd = new FormData();
      if (file) fd.append("image", file);
      fd.append("description", description);
      fd.append("name", name);
      fd.append("email", email);
      fd.append("lat", coords.lat);
      fd.append("lng", coords.lng);
      const a = await api.analyze(fd);
      setComplaint(a.complaint);
      setDuplicates(a.duplicates);
      setStep(1);
      setBusy("TinyFish is researching official government websites… (this can take a minute)");
      const r = await api.research(a.complaint.id);
      setComplaint(r.complaint);
      setDraft(r.complaint.draft_text || "");
      setStep(2);
    });

  const approve = () =>
    run("Submitting…", async () => {
      const r = await api.approve(complaint.id, draft);
      setComplaint(r.complaint);
      setStep(3);
      onDone?.();
    });

  const canStart = coords && (file || description.trim());

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 flex gap-2 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex-1 rounded-full px-3 py-1.5 text-center ${
              i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {busy && <div className="mb-4 animate-pulse rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">{busy}</div>}

      {step === 0 && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Photo of the problem</label>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files[0])} />
            {file && <img src={URL.createObjectURL(file)} alt="preview" className="mt-3 max-h-56 rounded-lg" />}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Describe it (optional if you add a photo)</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Large pothole near the bus stop, two bikes slipped here…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border border-slate-300 p-2 text-sm" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border border-slate-300 p-2 text-sm" placeholder="Email for updates (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={locate} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              📍 Use my location
            </button>
            <span className="text-xs text-slate-500">or</span>
            <input
              className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="lat"
              onChange={(e) => setCoords((c) => ({ lat: Number(e.target.value), lng: c?.lng ?? 0 }))}
            />
            <input
              className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="lng"
              onChange={(e) => setCoords((c) => ({ lng: Number(e.target.value), lat: c?.lat ?? 0 }))}
            />
            {coords && <span className="text-xs text-emerald-600">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>}
          </div>
          <button
            disabled={!canStart || !!busy}
            onClick={analyzeAndResearch}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white disabled:opacity-40"
          >
            Analyse &amp; find the right authority
          </button>
        </div>
      )}

      {step === 1 && !busy && <p className="text-sm text-slate-500">Working…</p>}

      {step === 2 && complaint && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{complaint.title}</h3>
                <p className="text-sm text-slate-600">{complaint.summary}</p>
              </div>
              <PriorityBadge label={complaint.priority_label} score={complaint.priority_score} />
            </div>
            {duplicates.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                ⚠️ {duplicates.length} similar open report(s) within 50 m. Your report adds weight to the same issue.
              </p>
            )}
            <MapView complaints={[complaint]} height={220} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h4 className="mb-2 font-semibold">Smart Department Finder (via TinyFish)</h4>
            <p><b>Authority:</b> {complaint.authority || "Not found"}</p>
            <p><b>Department:</b> {complaint.department || "Not found"}</p>
            {complaint.portal_url && (
              <p><b>Portal:</b> <a className="text-indigo-600 underline" href={complaint.portal_url} target="_blank" rel="noreferrer">{complaint.portal_url}</a></p>
            )}
            <p className="mt-2 whitespace-pre-wrap"><b>Procedure:</b> {typeof complaint.procedure === "string" ? complaint.procedure : JSON.stringify(complaint.procedure)}</p>
            <p className="mt-2 text-xs text-slate-500">Confidence: {complaint.research_confidence}</p>
            {complaint.source_urls?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {complaint.source_urls.map((u) => (
                  <li key={u}><a className="text-indigo-600 underline" href={u} target="_blank" rel="noreferrer">{u}</a></li>
                ))}
              </ul>
            )}
            {complaint.agent_stream_url && (
              <a className="mt-2 inline-block text-xs text-indigo-600 underline" href={complaint.agent_stream_url} target="_blank" rel="noreferrer">
                Watch the agent's browser session
              </a>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="mb-2 text-sm font-semibold">Complaint draft (edit if you like)</h4>
            <textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <p className="mt-2 text-xs text-slate-500">Nothing is sent until you approve. Verify the department details above first; AI research can be wrong.</p>
            <button disabled={!!busy} onClick={approve} className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white disabled:opacity-40">
              ✅ I approve, submit this complaint
            </button>
          </div>
        </div>
      )}

      {step === 3 && complaint && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-3xl">🎉</p>
          <h3 className="mt-1 text-lg font-semibold">Complaint recorded</h3>
          <p className="text-sm text-slate-700">Reference: <b>{complaint.reference_id}</b></p>
          <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => window.location.reload()}>
            Report another
          </button>
        </div>
      )}
    </div>
  );
}

export function PriorityBadge({ label, score }) {
  const cls = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-700",
  }[label] || "bg-slate-100 text-slate-600";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label} · {score}</span>;
}
