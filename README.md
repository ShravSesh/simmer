# 🔥 Simmer — swipe right on dinner

A pantry-driven recipe swiping app with a built-in repository of **673
vegetarian (egg-free) recipes across 31 cuisines**, at least 15 of each,
including 38 salads. Recipes carry every meal they belong to, so a dish can
be both lunch and dinner. No AI keys, no
per-use costs — recipe matching runs entirely on-device. Installable on phones
(PWA), with shared households synced through Supabase.

## What you need
- A free [Supabase](https://supabase.com) account (household sync)
- A free [Vercel](https://vercel.com) account (hosting)

## Deploy (about 8 minutes)

### 1. Supabase (3 min)
1. Create a new project at supabase.com.
2. Open **SQL Editor**, paste the contents of `schema.sql`, hit **Run**.
3. Go to **Project Settings → API** and copy:
   - Project URL (like `https://abcd1234.supabase.co`)
   - `anon` public key

### 2. Vercel (4 min)
1. Push this folder to a GitHub repo (contents at repo root).
2. vercel.com → **Add New Project** → import the repo. Framework: **Vite**.
3. Add two **Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
4. Deploy.

### 3. Install on phones
- **iPhone**: open the URL in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → menu → **Install app**.

### 4. Partner joins your household
1. Tap **👥 Solo** → **Create a household** → get a code like `MANGO-42`.
2. Partner (same URL): **👥 Solo** → enter code → **Join**.
3. Shared pantry, staples, shopping list, and matches — synced every ~20s
   and on app focus.

## The recipe repository
- Lives in `src/data/recipes1.js` … `recipes17.js` (+ `index.js`).
- Each recipe: id, name, cuisine, meal (+ optional `meals` array), minutes,
  description, base servings,
  matchable core ingredients, full quantified ingredient list, steps, macros.
- Edit or add recipes anytime — keep ids and names unique, keep every
  cuisine at 15+, redeploy (git push).
- Cuisines: North & South Indian, Indo-Chinese, Italian, Mexican, Thai,
  Chinese, Japanese, Korean, Vietnamese, Malaysian, Indonesian, Middle
  Eastern, Mediterranean/Greek, Moroccan, West African, Ethiopian,
  Peruvian/South American, Continental, Spanish, and Fusion.

## Features
- Swipe deck matched against your pantry (strict or ±2 mode), with meal /
  cuisine / time filters and session mood learning
- Serving-size stepper: scale any recipe's quantities to 1–8 servings
- Cook mode with auto-detected step timers
- Smart empty state: shows which single ingredient unlocks the most recipes
- Staples, shopping list, "pick dinner for me", grocery derivation
- Costs: Supabase + Vercel free tiers. That's it.

