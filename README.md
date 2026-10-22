# NutriX Glucose

Snap any meal (Indian dishes and every other cuisine) → AI names each dish and estimates the portion and nutrition → add glucose readings (manual, or import a CGM/meter CSV) → see how *your* meals affect *your* glucose. Includes a personal glucose-impact model, "what helps you" tag effects, small experiments, an educator review view, and consent, export and delete for privacy.

Built for the Forge hackathon (problem P031, "Diabetes apps don't understand dosa").

## Pages
| Route | What it does |
|---|---|
| `/` | Time in range, today's glucose load, 2-hour reading reminders, logging streak, model progress, 7-day load chart, today's plate with full nutrition |
| `/log` | Photo, voice or typed text ("2 roti, 1 katori dal, chai") → on-device YOLO detector / AI (OpenRouter or Anthropic) / offline parser → confirm → glucose impact, predicted rise, key nutrients, swap ideas, context tags, quick re-log |
| `/check` | Before you eat: snap, say or type a plate → expected rise, what your own history says (per dish, time of day, walking after), gentler swaps; "I'm eating this" hands it to `/log` |
| `/glucose` | Readings, time in range, timeline, CSV import (LibreView, Dexcom Clarity, generic; mg/dL or mmol/L) |
| `/insights` | Personal model fit, what helps you (tag effects), small experiments, surprises, rise per dish, weekly AI note, educator notes |
| `/educator` | Participants overview with flags (lows, highs, missing readings or meals), dish table, review notes, meal photos, CSV export of everything |
| `/privacy` | What we store, CSV/JSON export, delete all my data, install + reminder settings |

**Installable app (PWA):** `app/manifest.ts`, icons in `public/icons`, `public/sw.js` caches pages, code, the detector model and dish data so logging works offline. Reminders (`lib/reminders.ts`): notifications when a meal isn't logged by its time or a 2-hour reading is due (while the app is open or in the background), plus a calendar file with daily alarms that works when the app is closed.

## How it works
- **Dish names and nutrition**: the AI returns each dish, its grams and nutrition for the visible portion. The closest INDB dish is shown alongside as a reference. Manual logging uses INDB (1,169 dishes, 29 micronutrients) directly.
- **Glucose load** (`lib/impact.ts`): estimated GI by dish type × available carbs, damped for mixed meals. Bands: low < 20, moderate 20–40, high > 40.
- **Personal model**: after 3+ meals with readings, mg/dL per unit of load is fitted per person and used to predict rises.
- **Glucose rise** (`lib/glucose.ts`) = highest reading 15–150 min after the meal − latest reading 60 min before to 10 min after.
- **Tag effects** (`lib/tags.ts`): measured rise minus the model's expectation, compared for meals with and without a tag.
- **Weekly note** (`app/api/insight`): guardrails for no medical advice and no restrictive eating.

Runs without keys: the detector still runs in the browser, data stays in the browser, and "Try it with sample data" loads 30 days.

## Setup
```bash
npm install
cp .env.example .env.local   # add keys
npm run dev
```
1. **AI**: set `OPENROUTER_API_KEY` (optional `AI_MODEL`) or `ANTHROPIC_API_KEY`.
2. **Supabase (login + shared data)**:
   1. Create a project. Run all of `supabase/schema.sql` in the SQL editor.
   2. Authentication → Providers: keep Email on. Authentication → URL configuration: set Site URL to your Vercel URL.
   3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and redeploy.
   4. The educator signs in, creates a profile (e.g. `EDU1`), then run `update profiles set role = 'educator' where id = 'EDU1';`
3. **Vercel**: every push to `main` redeploys.

## Privacy
With Supabase on, everyone signs in with an email link, must accept consent, and row-level security limits each participant to their own data. Educators can read all participants and write review notes. Participants can export or delete everything from `/privacy`.

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
