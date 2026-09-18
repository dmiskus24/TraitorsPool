# The Traitors: New Blood — Castle Pool

A mobile-friendly draft + season scoring app for Dave, Jaz, Brody, Bo, Sarah and Mike.

## Features
- 22 official *The Traitors: New Blood* contestants preloaded
- 18-pick snake draft (3 contestants per pool player)
- Live shared picks with Supabase Realtime
- Draft selections persist across devices
- Leaderboard automatically sums contestant scoring events
- Personal episode scorecard for each pool member with checkboxes for every point category
- Scorecards reopen with previously saved boxes checked, so episode scoring can be corrected later
- Admin season tracker for shields, survival, votes, murders, banishments, finale bonuses and wins
- Responsive castle-inspired UI
- LocalStorage demo mode when Supabase is not configured

## Draft order
1. Brody → Sarah → Dave → Mike → Jaz → Bo
2. Bo → Jaz → Mike → Dave → Sarah → Brody
3. Brody → Sarah → Dave → Mike → Jaz → Bo

## Quick start locally
```bash
npm install
cp .env.example .env
npm run dev
```

The app works without Supabase in local demo mode, but data will only be saved in that browser.

## Enable shared saving (recommended)
1. Create a free Supabase project.
2. Open **SQL Editor** and run everything in `supabase.sql`.
3. In Supabase, go to **Project Settings → API** and copy the Project URL and public/anon key.
4. Create `.env` from `.env.example` and add the two values.
5. Run `npm run dev` and test the draft from two browsers/devices.

> The included SQL uses simple public read/write policies so six friends can use the app without accounts. Anyone who knows the deployed site URL could technically write to the database. For a private production app, add Supabase Auth and stricter RLS policies.

## Deploy on Vercel (easiest)
1. Push this folder to a GitHub repository.
2. Import the repo into Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables.
4. Deploy. Vercel will detect Vite automatically.

## Deploy with GitHub Pages
Because Vite asset paths can vary with repository names, Vercel/Netlify is the easiest option. If using GitHub Pages, set Vite's `base` to your repository path before building, or use a custom domain.

## Scoring rules
| Event | Points |
|---|---:|
| Survives an episode | +1 |
| Wins a shield | +2 |
| Faithful votes for a Traitor | +2 |
| Traitor survives a Round Table | +2 |
| Traitor participates in successful murder | +2 |
| Traitor successfully recruits | +3 |
| Faithful helps banish a Traitor | +3 |
| Makes Final 5 | +5 |
| Makes Final 3 | +5 |
| Faithful wins | +10 |
| Traitor wins | +12 |

Each pool member can open **My Scorecard**, choose the episode, and check the categories earned by each of their drafted contestants. Saving the scorecard adds/removes the matching scoring events and immediately recalculates contestant and owner totals. Admin controls remain available for commissioner corrections.

## Important note about “automatic” episode tracking
The app automatically **calculates and updates points** once episode outcomes are entered. It does not scrape NBC/Peacock automatically because there is no official public Traitors results API wired into this project. This avoids spoilers, scraping failures, and incorrect scoring.
