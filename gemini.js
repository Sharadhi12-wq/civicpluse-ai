import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const CATEGORIES = [
  "pothole",
  "garbage",
  "water_leakage",
  "broken_streetlight",
  "open_manhole",
  "exposed_wire",
  "other",
];

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

/** Classify a civic issue from an optional image and/or text description. */
export async function classifyIssue({ imageBuffer, mimeType, description }) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are a civic-issue triage assistant.
Classify the reported problem. Respond ONLY with JSON:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "severity": integer 1-5 (5 = immediate danger to people),
  "title": short title (max 10 words),
  "summary": 1-2 sentence factual description of what is visible/reported,
  "location_hint": any street/landmark/area text you can read or infer from the input, or ""
}
Citizen description: ${description || "(none provided)"}`;

  const parts = [{ text: prompt }];
  if (imageBuffer) {
    parts.push({
      inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType || "image/jpeg" },
    });
  }

  const result = await model.generateContent(parts);
  const data = parseJson(result.response.text());
  if (!CATEGORIES.includes(data.category)) data.category = "other";
  return data;
}

/** Draft a formal complaint using the researched department and procedure. */
export async function draftComplaint({ complaint, research, citizenName }) {
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `Write a concise, polite, formal civic complaint letter.
Complaint details:
- Issue: ${complaint.title} (${complaint.category}), severity ${complaint.severity}/5
- Summary: ${complaint.summary}
- Address: ${complaint.address || "see coordinates"}
- Coordinates: ${complaint.lat}, ${complaint.lng}
- Priority: ${complaint.priority_label}
Addressed to: ${research.department || "the concerned municipal authority"}
Official procedure found: ${research.procedure || "n/a"}
Reporter: ${citizenName || "A concerned citizen"}

Rules: include a subject line, the exact location, why it is a risk, a request for action
within a reasonable time, and a reference to the evidence photo attached.
Do NOT invent reference numbers, phone numbers or laws that are not given above.
Under 200 words. Plain text.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
