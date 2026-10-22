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

## Glucose-impact model (`lib/impact.ts`)
1. **GI estimate per dish** from its category (rice & batter 70, rice dishes 65, whole-grain breads 58, dals & legumes 38, vegetable curries 40, dairy & salads 35, sweets 65…). The food dataset has no GI values, so these are labelled estimates.
2. **Meal glucose load** = Σ (carbs − fibre) × GI / 100 for each dish (INDB values × portion), damped for protein, fat and fibre on the same plate (factor 0.65–1).
3. **Bands**: low < 20, moderate 20–40, high > 40.
4. **Personal calibration**: after 3 meals with a pre-meal and ~2 h reading, fit the person's own factor k (mg/dL per unit of load) by least squares; predicted rise = k × load, shown with an expected curve.
5. **Suggestions** only add or swap (smaller portion of the top contributor + salad, add dal/sprouts, rice → khichdi) and show the % drop in load.

No device: the person sees load bands and swaps, never an invented mg/dL number.

## Food detector
The NutriX YOLOv8n detector runs in the browser (ONNX + onnxruntime-web) before the AI call. See `model/README.md`.

## Dish data
1,169 dishes from INDB, a reference table and the regional layer. See `data/README.md`.

## Next
- Use confirmed photo + dish labels to retrain the detector
- CGM CSV upload; n8n weekly-note workflow calling `/api/insight`
- Hindi and regional languages
