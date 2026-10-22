# NutriX Glucose

Snap an Indian meal → see each dish with a katori portion → add glucose readings → see how *your* meals affect *your* glucose. Weekly AI pattern note with guardrails, plus a read-only educator view.

Built for the Forge hackathon (problem P031, "Diabetes apps don't understand dosa").

## Pages
| Route | What it does |
|---|---|
| `/` | Participant picker, latest meal's rise, meals/day (north-star metric), recent meals |
| `/log` | Photo → Claude vision → dish list with katori/piece portions → user confirms → save |
| `/glucose` | Manual readings, 7-day timeline with meal markers, rise per meal |
| `/insights` | Avg rise per dish chart, weekly AI note |
| `/educator` | Read-only: participants overview, weekly dish table, AI note, meal photos |

## How it works
- **Claude vision** (`app/api/analyze`) returns dishes, portions and confidence as JSON. It never estimates nutrition.
- **Nutrition** is looked up by script from `lib/dishes.ts` (katori = 180 g). ⚠️ Values are placeholders: replace with checked IFCT 2017 values.
- **Glucose rise** (`lib/glucose.ts`) = highest reading 15–150 min after the meal − latest reading in the 60 min before.
- **Weekly note** (`app/api/insight`): only dishes with ≥3 meals with readings are described; banned-phrase check (no medical advice, no restrictive eating) with one retry, then a safe template.
- **Pilot metric**: seconds to log each meal are saved (`log_seconds`) and shown to the educator.

Runs without any keys: photo analysis returns a sample thali, notes use a template, data stays in the browser. "Try it with a sample week" loads demo data.

## Setup
```bash
npm install
cp .env.example .env.local   # add keys
npm run dev
```
1. **Claude**: set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`).
2. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Vercel**: import this GitHub repo, add the same env vars, deploy. Every push to `main` redeploys.

## Before real patients
The Supabase policies are open (anon key, no login) for the demo. Add Supabase Auth and per-user row-level security before the pilot.

## Next
- Swap in the NutriX YOLOv8 detector (Roboflow) as first pass, Claude as fallback
- Use confirmed photo + dish labels to retrain the detector
- CGM CSV upload; n8n weekly-note workflow calling `/api/insight`
- Hindi and regional languages
