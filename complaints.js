import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { supabase, uploadEvidence } from "../services/db.js";
import { classifyIssue, draftComplaint } from "../services/gemini.js";
import { researchAuthority } from "../services/tinyfish.js";
import { priorityScore, priorityLabel, distanceMeters } from "../services/priority.js";
import { notifyCitizen } from "../services/notify.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const SUBMIT_MODE = process.env.SUBMIT_MODE || "sandbox"; // sandbox | email
const OVERDUE_DAYS = Number(process.env.OVERDUE_DAYS || 7);

async function reverseGeocode(lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { address: null, city: process.env.DEFAULT_CITY || "Bengaluru" };
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const data = await (await fetch(url)).json();
  const r = data.results?.[0];
  if (!r) return { address: null, city: process.env.DEFAULT_CITY || "Bengaluru" };
  const comp = (type) => r.address_components.find((c) => c.types.includes(type))?.long_name;
  return {
    address: r.formatted_address,
    city: comp("locality") || comp("administrative_area_level_2") || process.env.DEFAULT_CITY || "Bengaluru",
  };
}

// STEP 1 — citizen uploads photo/description -> AI classifies, dedupes, scores priority.
router.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const { description, email, name } = req.body;
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    if (!req.file && !description) {
      return res.status(400).json({ error: "Provide an image or a description" });
    }

    const ai = await classifyIssue({
      imageBuffer: req.file?.buffer,
      mimeType: req.file?.mimetype,
      description,
    });
    const geo = await reverseGeocode(lat, lng);

    // Duplicate Detector: same category within 50 m that is still open.
    const { data: open } = await supabase
      .from("complaints")
      .select("id, lat, lng, category, status")
      .eq("category", ai.category)
      .not("status", "in", "(resolved,rejected)");
    const duplicates = (open || []).filter((c) => distanceMeters(lat, lng, c.lat, c.lng) <= 50);

    const score = priorityScore({
      category: ai.category,
      severity: ai.severity,
      duplicateCount: duplicates.length,
    });

    const id = randomUUID();
    let imageUrl = null;
    if (req.file) imageUrl = await uploadEvidence(req.file.buffer, req.file.mimetype, id);

    const row = {
      id,
      title: ai.title,
      summary: ai.summary,
      category: ai.category,
      severity: ai.severity,
      description: description || null,
      lat,
      lng,
      address: geo.address || ai.location_hint || null,
      city: geo.city,
      image_url: imageUrl,
      priority_score: score,
      priority_label: priorityLabel(score),
      duplicate_of: duplicates[0]?.id || null,
      duplicate_count: duplicates.length,
      citizen_email: email || null,
      citizen_name: name || null,
      status: "draft",
    };
    const { data, error } = await supabase.from("complaints").insert(row).select().single();
    if (error) throw error;
    res.json({ complaint: data, duplicates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// STEP 2 — TinyFish researches the live government web, then Gemini drafts the complaint.
router.post("/:id/research", async (req, res) => {
  try {
    const { data: c, error } = await supabase.from("complaints").select("*").eq("id", req.params.id).single();
    if (error || !c) return res.status(404).json({ error: "Complaint not found" });

    await supabase.from("complaints").update({ status: "researching" }).eq("id", c.id);

    const research = await researchAuthority({ city: c.city, category: c.category, address: c.address });
    const draft = await draftComplaint({ complaint: c, research, citizenName: c.citizen_name });

    const { data, error: upErr } = await supabase
      .from("complaints")
      .update({
        department: research.department,
        authority: research.authority,
        portal_url: research.portal_url,
        procedure: research.procedure,
        contact: research.contact,
        source_urls: research.source_urls,
        research_confidence: research.confidence,
        agent_stream_url: research.streaming_url,
        draft_text: draft,
        status: "pending_approval",
      })
      .eq("id", c.id)
      .select()
      .single();
    if (upErr) throw upErr;
    res.json({ complaint: data });
  } catch (err) {
    console.error(err);
    await supabase.from("complaints").update({ status: "draft" }).eq("id", req.params.id);
    res.status(500).json({ error: err.message });
  }
});

// STEP 3 — explicit citizen approval (optionally edited text). Nothing is sent before this.
router.post("/:id/approve", async (req, res) => {
  try {
    const { approved, draft_text } = req.body;
    if (approved !== true) return res.status(400).json({ error: "Explicit approval (approved: true) required" });

    const { data: c } = await supabase.from("complaints").select("*").eq("id", req.params.id).single();
    if (!c) return res.status(404).json({ error: "Complaint not found" });
    if (c.status !== "pending_approval") {
      return res.status(409).json({ error: `Cannot approve a complaint in status "${c.status}"` });
    }

    const finalText = draft_text || c.draft_text;
    let reference = `SANDBOX-${c.id.slice(0, 8).toUpperCase()}`;

    if (SUBMIT_MODE === "email" && c.contact?.email) {
      await notifyCitizen(c.contact.email, `Civic complaint: ${c.title}`, `${finalText}\n\nEvidence: ${c.image_url || "n/a"}`);
      reference = `EMAIL-${c.id.slice(0, 8).toUpperCase()}`;
    }
    // sandbox mode: no real submission is made; the complaint is recorded as submitted for the demo.

    const { data, error } = await supabase
      .from("complaints")
      .update({
        draft_text: finalText,
        status: "submitted",
        reference_id: reference,
        submitted_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .select()
      .single();
    if (error) throw error;

    await notifyCitizen(
      c.citizen_email,
      `Your complaint "${c.title}" was submitted`,
      `Reference: ${reference}\nMode: ${SUBMIT_MODE}\nDepartment: ${c.department || "n/a"}`
    );
    res.json({ complaint: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Resolution Tracker — update status.
router.patch("/:id/status", async (req, res) => {
  const allowed = ["submitted", "in_progress", "resolved", "rejected"];
  const { status } = req.body;
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const patch = { status };
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  const { data, error } = await supabase.from("complaints").update(patch).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await notifyCitizen(data.citizen_email, `Complaint update: ${data.title}`, `Status is now "${status}".`);
  res.json({ complaint: data });
});

// Dashboard + map data, with overdue flag.
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("complaints")
    .select("*")
    .order("priority_score", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const now = Date.now();
  const complaints = data.map((c) => ({
    ...c,
    overdue:
      c.status === "submitted" || c.status === "in_progress"
        ? c.submitted_at && now - new Date(c.submitted_at).getTime() > OVERDUE_DAYS * 86400000
        : false,
  }));
  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => ["draft", "researching", "pending_approval"].includes(c.status)).length,
    submitted: complaints.filter((c) => ["submitted", "in_progress"].includes(c.status)).length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    overdue: complaints.filter((c) => c.overdue).length,
  };
  res.json({ stats, complaints });
});

export default router;
