const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  analyze: (formData) =>
    fetch(`${BASE}/api/complaints/analyze`, { method: "POST", body: formData }).then(handle),
  research: (id) => fetch(`${BASE}/api/complaints/${id}/research`, { method: "POST" }).then(handle),
  approve: (id, draft_text) =>
    fetch(`${BASE}/api/complaints/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true, draft_text }),
    }).then(handle),
  setStatus: (id, status) =>
    fetch(`${BASE}/api/complaints/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(handle),
  list: () => fetch(`${BASE}/api/complaints`).then(handle),
};
