import { TinyFish } from "@tiny-fish/sdk";

// Reads TINYFISH_API_KEY from the environment.
const client = new TinyFish();

/**
 * Smart Department Finder + Evidence Collector.
 * TinyFish navigates live government websites (no hardcoded portals) and returns
 * the responsible department, the official complaint procedure and source URLs.
 */
export async function researchAuthority({ city, category, address }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${city} municipal corporation ${category.replace("_", " ")} complaint official website`
  )}`;

  const goal = `
You are helping a citizen report a "${category.replace("_", " ")}" problem near "${address || city}" in ${city}, India.
Starting from these search results, open the OFFICIAL government / municipal website (ignore blogs and news).
Find and return ONLY valid JSON with this shape:
{
  "department": "name of the department responsible for this issue",
  "authority": "name of the municipal body / authority",
  "portal_url": "official complaint portal URL if one exists, else null",
  "procedure": "step-by-step official complaint procedure in 2-5 short steps",
  "contact": { "email": null, "phone": null, "helpline": null },
  "source_urls": ["official pages you actually visited and used"],
  "confidence": "high | medium | low"
}
Rules: use only information visible on the pages you visit. Use null for anything you cannot find.
Do NOT log in, do NOT fill in or submit any form, and do NOT create any complaint.`.trim();

  const response = await client.agent.run({ url: searchUrl, goal });
  return normalize(response);
}

function normalize(response) {
  // The SDK returns the agent's output under `result` (shape can vary by SDK version),
  // so handle objects and JSON strings defensively.
  let raw = response?.result ?? response?.output ?? response;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      raw = {};
    }
  }
  return {
    department: raw?.department ?? null,
    authority: raw?.authority ?? null,
    portal_url: raw?.portal_url ?? null,
    procedure: raw?.procedure ?? null,
    contact: raw?.contact ?? {},
    source_urls: Array.isArray(raw?.source_urls) ? raw.source_urls : [],
    confidence: raw?.confidence ?? "low",
    streaming_url: response?.streaming_url ?? null,
  };
}
