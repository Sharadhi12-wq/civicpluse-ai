# CivicPulse AI — From Complaint to Action

> Report a problem. Let AI find the solution.

A citizen uploads a photo of a civic problem (pothole, garbage, water leak, broken streetlight, open manhole, exposed wire). The platform:

1. **Classifies** the issue with Gemini (category, severity, summary)
2. **Locates** it (browser geolocation + Google Geocoding)
3. **Detects duplicates** (same category within 50 m) and computes a **priority score**
4. Uses **TinyFish** to browse live government websites and find the responsible department, official complaint procedure, contacts and source URLs (no hardcoded portals)
5. **Drafts** a formal complaint with evidence
6. Waits for **explicit citizen approval** — nothing is sent before that
7. Tracks status on a **dashboard** with a **community impact map** (markers + heatmap) and overdue detection

## Architecture

```
React + Tailwind (Vite)  ->  Express API  ->  Gemini (vision + drafting)
                                          ->  TinyFish SDK (live web research)
                                          ->  Supabase (Postgres + Storage)
                                          ->  Google Maps (geocoding + map)
                                          ->  SMTP (status emails)
```

## Setup

### 1. Supabase
- Create a project, run `supabase/schema.sql` in the SQL editor.
- Create a **public** Storage bucket named `evidence`.

### 2. Backend
```bash
cd backend
cp .env.example .env     # fill in keys
npm install
npm run dev              # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env     # set VITE_GOOGLE_MAPS_API_KEY
npm install
npm run dev              # http://localhost:5173
```

API keys needed: TinyFish (agent.tinyfish.ai), Gemini (aistudio.google.com), Supabase, Google Maps (enable Maps JavaScript + Geocoding APIs).

## Safe-submission design

`SUBMIT_MODE=sandbox` (default) records the complaint and a `SANDBOX-…` reference but **does not contact any real authority**. `SUBMIT_MODE=email` emails the department contact TinyFish found, and only after the user clicks approve. TinyFish is instructed to research only: never log in, fill or submit forms. Always have a human verify the department before real submission, since AI research can be wrong.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/complaints/analyze` | multipart: `image`, `description`, `lat`, `lng`, `name`, `email` → classify, dedupe, priority |
| POST | `/api/complaints/:id/research` | TinyFish research + Gemini draft |
| POST | `/api/complaints/:id/approve` | body `{ approved: true, draft_text }` |
| PATCH | `/api/complaints/:id/status` | `in_progress` / `resolved` / `rejected` |
| GET | `/api/complaints` | list + stats + overdue flag |

## Demo script

1. Upload a pothole photo, tap "Use my location".
2. Show the AI classification and priority badge.
3. Show TinyFish's department, procedure and source links (and the live agent session link).
4. Edit the draft, approve, show the sandbox reference.
5. Open the Dashboard: map hotspot, status tiles, resolve the complaint.

## Push to GitHub

```bash
git init
git add .
git commit -m "CivicPulse AI MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/civicpulse-ai.git
git push -u origin main
```

Never commit `.env` files (already in `.gitignore`).
