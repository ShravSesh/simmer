import React, { useState, useEffect, useRef, useCallback } from "react";
import { loadKey, saveKey, keyExists, subscribeKeys, syncConfigured, configError, SyncError } from "./storage.js";
import { RECIPES as REPO_RAW } from "./data/index.js";

const COMMUNITY_KEY = "simmer-community-recipes";

// A dish usually belongs to more than one meal — a grain bowl is lunch and
// dinner, a salad is both and sometimes neither. `meal` stays the primary,
// used for display and by the recipe editor; `meals` is the full set a recipe
// can be filtered into. Recipes without a `meals` array fall back to their
// single `meal`, so nothing has to be rewritten to keep working.
const mealsOf = (card) => (card?.mealTypes?.length ? card.mealTypes : [card?.mealType].filter(Boolean));
const servesMeal = (card, meal) => !meal || mealsOf(card).includes(meal);

// Adapt repo entries to the app's card shape once at load.
const REPO = REPO_RAW.map((r) => ({
  repoId: r.id, name: r.name, cuisine: r.cuisine, emoji: r.emoji,
  minutes: r.mins, mealType: r.meal, mealTypes: r.meals || [r.meal], desc: r.desc, tags: r.tags || [],
  kid: !!r.kid,
  ingredients: r.core, serves: r.serves, ingFull: r.ing,
  steps: r.steps, macros: r.mac, alts: r.alts || {},
}));

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&family=Outfit:wght@400;500;600;700;800&display=swap');
* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
@keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

const C = {
  bg: "#FFFCF5", ink: "#1E2B20", faint: "#69766B", line: "#EBE6D8",
  green: "#12B76A", greenSoft: "#DCFAE6", red: "#FF4438", redSoft: "#FFE6E2",
  gold: "#FFAA1D", goldSoft: "#FFF3D6", purple: "#7C5CFF", purpleSoft: "#EFEAFF",
  pink: "#FF5E7E", card: "#FFFFFF",
};

const CATEGORIES = [
  { id: "veg", label: "Veggies", emoji: "🥬" },
  { id: "fruit", label: "Fruits", emoji: "🍋" },
  { id: "protein", label: "Proteins", emoji: "🍗" },
  { id: "grain", label: "Grains", emoji: "🍚" },
  { id: "dairy", label: "Dairy", emoji: "🧀" },
  { id: "spice", label: "Spices & Sauces", emoji: "🌶️" },
  { id: "other", label: "Other", emoji: "🥫" },
];

const OLD_STAPLES_LIST = ["salt", "pepper", "cooking oil", "water", "sugar", "basic dried spices"];
const V8_STAPLES_LIST = ["salt", "pepper", "cooking oil", "sugar", "soy sauce", "peanut butter", "rice", "wheat flour", "ginger", "garlic", "green chilli", "red chilli", "basic dried spices"];
const V24_STAPLES_LIST = ["salt", "pepper", "cooking oil", "sugar", "soy sauce", "peanut butter", "rice", "wheat flour", "ginger", "garlic", "green chilli", "red chilli", "milk", "butter", "olive oil", "vinegar", "lemon juice", "basic dried spices"];
// v2.6: the Indian spice box + curry leaves are assumed-available
const SPICE_BOX = ["cumin seeds", "mustard seeds", "coriander seeds", "fenugreek seeds", "fennel seeds", "nigella seeds", "sesame seeds", "ajwain", "black pepper", "cardamom", "cinnamon", "cloves", "bay leaves", "asafoetida", "saffron", "turmeric", "curry leaves"];
// Indian kitchen essentials beyond spices
const INDIAN_PANTRY = ["tamarind", "jaggery", "ghee", "chana dal", "urad dal", "besan"];
const STAPLES_LIST = [...V24_STAPLES_LIST, ...SPICE_BOX, ...INDIAN_PANTRY];

const STAPLE_CATS = [
  { id: "basics", label: "Basics", emoji: "🧂" },
  { id: "oils", label: "Oils & Fats", emoji: "🫒" },
  { id: "aromatics", label: "Aromatics", emoji: "🧄" },
  { id: "spicebox", label: "Spice Box", emoji: "🫙" },
  { id: "dairy", label: "Dairy", emoji: "🥛" },
  { id: "grains", label: "Grains", emoji: "🌾" },
  { id: "other", label: "Other", emoji: "🥫" },
];

function stapleCategory(name) {
  const n = name.toLowerCase();
  if (["salt", "pepper", "sugar", "vinegar", "lemon juice", "soy sauce", "basic dried spices", "black pepper"].some(x => n === x)) return "basics";
  if (["cooking oil", "olive oil", "butter", "ghee", "coconut oil", "sesame oil"].some(x => n === x)) return "oils";
  if (["ginger", "garlic", "green chilli", "red chilli", "curry leaves", "onion"].some(x => n === x)) return "aromatics";
  if (["milk", "cream", "yogurt", "buttermilk"].some(x => n === x)) return "dairy";
  if (["rice", "wheat flour", "flour", "semolina", "peanut butter", "besan", "chana dal", "urad dal"].some(x => n === x)) return "grains";
  if (["tamarind", "jaggery"].some(x => n === x)) return "basics";
  if (SPICE_BOX.some(s => n === s.toLowerCase())) return "spicebox";
  return "other";
}

const LEGACY_STAPLES = [OLD_STAPLES_LIST, V8_STAPLES_LIST, V24_STAPLES_LIST];
const CODE_WORDS = ["MANGO","OLIVE","CHILI","BASIL","HONEY","PESTO","RAMEN","TACO","MISO","KIMCHI","THYME","COCOA"];
const CUISINE_OPTIONS = [...new Set(REPO.map((r) => r.cuisine))];
const TIME_OPTIONS = [20, 30, 45];
const MEAL_OPTIONS = [
  { id: "breakfast", label: "Breakfast", emoji: "🍳" },
  { id: "lunch", label: "Lunch", emoji: "🥪" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "dessert", label: "Dessert", emoji: "🍰" },
  { id: "snack", label: "Snack", emoji: "🍿" },
  { id: "salad", label: "Salad", emoji: "🥗" },
];

const QUICK_ADD = [
  { cat: "veg", items: ["onion","tomato","spinach","carrot","potato","bell pepper","mushroom","broccoli","cauliflower","peas","okra","cucumber","coriander","mint"] },
  { cat: "fruit", items: ["lemon","lime","banana","apple","mango","orange"] },
  { cat: "protein", items: ["tofu","paneer","chickpeas","lentils","black beans","kidney beans","edamame","tempeh"] },
  { cat: "grain", items: ["pasta","bread","tortillas","noodles","oats","quinoa","poha","semolina"] },
  { cat: "dairy", items: ["cheese","yogurt","cream","ghee","condensed milk"] },
  { cat: "spice", items: ["honey","sriracha","curry powder","cumin seeds","garam masala","mustard","tahini"] },
  { cat: "other", items: ["canned tomatoes","coconut milk","almonds","cashews"] },
];

const CAT_KEYWORDS = {
  veg: ["spinach","kale","lettuce","arugula","cabbage","broccoli","cauliflower","carrot","potato","sweet potato","onion","garlic","ginger","tomato","cucumber","zucchini","squash","pumpkin","eggplant","pepper","bell pepper","capsicum","mushroom","celery","asparagus","green bean","pea","corn","beet","radish","turnip","leek","scallion","spring onion","shallot","okra","bok choy","chard","brussels","cilantro","coriander","parsley","basil","mint","dill","rosemary","thyme","sage","fennel","artichoke","avocado"],
  fruit: ["apple","banana","orange","lemon","lime","mango","pineapple","grape","strawberry","blueberry","raspberry","blackberry","peach","plum","pear","cherry","watermelon","melon","cantaloupe","kiwi","papaya","pomegranate","apricot","fig","date","coconut","cranberry","guava"],
  protein: ["chicken","beef","pork","lamb","turkey","duck","fish","salmon","tuna","cod","tilapia","shrimp","prawn","crab","lobster","egg","tofu","tempeh","seitan","paneer","chickpea","lentil","black bean","kidney bean","pinto bean","edamame","sausage","bacon","ham","ground","mince","steak","anchovy","sardine"],
  grain: ["rice","pasta","spaghetti","penne","macaroni","noodle","ramen","udon","soba","bread","tortilla","pita","naan","flour","oat","oatmeal","quinoa","barley","couscous","bulgur","polenta","cornmeal","cereal","cracker","breadcrumb","vermicelli","orzo","farro","millet","poha","semolina","rava"],
  dairy: ["milk","cheese","cheddar","mozzarella","parmesan","feta","gouda","brie","yogurt","yoghurt","butter","cream","sour cream","cream cheese","ricotta","ghee","buttermilk","half and half","mascarpone","cottage cheese"],
  spice: ["cumin","turmeric","paprika","chili","cayenne","cinnamon","nutmeg","clove","cardamom","oregano","curry","garam masala","soy sauce","fish sauce","oyster sauce","hoisin","sriracha","hot sauce","ketchup","mustard","mayo","mayonnaise","vinegar","sesame oil","olive oil","honey","maple syrup","tahini","miso","gochujang","harissa","pesto","salsa","vanilla","bay leaf","saffron","za'atar","sumac","peppercorn","stock","broth","bouillon"],
  other: ["chocolate","cocoa","nut","almond","walnut","cashew","peanut","pistachio","pecan","seed","chia","flax","raisin","canned","jam","pickle","olive","caper","sun dried","tortilla chip","popcorn","protein powder","yeast","baking"],
};

function localGuess(name) {
  const n = name.toLowerCase();
  for (const [cat, words] of Object.entries(CAT_KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return null;
}

// Human-readable text for a failed sync. SyncError already carries a
// user-facing message; anything else is unexpected.
const msg = (e) => (e instanceof SyncError ? e.message : `Something went wrong: ${e?.message || e}`);

// Storage keys for one namespace: a household (`hh:CODE:*`, in Supabase) or
// solo mode (`simmer-*`, in localStorage). storage.js routes on the prefix.
//
// INVARIANT: never write a namespace that hasn't been read successfully.
// Writes replace the whole value rather than merging, so writing data that
// came from somewhere else — solo data, or a stale deck — silently destroys
// whatever the household actually had. `loadedCodeRef` below enforces this.
const nsKeys = (code) => ({
  pantry: code ? `hh:${code}:pantry` : "simmer-pantry",
  matches: code ? `hh:${code}:matches` : "simmer-matches",
  staples: code ? `hh:${code}:staples` : "simmer-staples",
  shopping: code ? `hh:${code}:shopping` : "simmer-shopping",
  stock: code ? `hh:${code}:stock-counts` : "simmer-stock-counts",
  // Cook history. Separate from matches on purpose: clearing matches must not
  // erase the record of what was actually cooked.
  cooked: code ? `hh:${code}:cooked` : "simmer-cooked",
  // User edits to the quick-add catalogue: {add:[names], hide:[names]}.
  // Stored as edits rather than a full list so the built-in suggestions can
  // still grow in future releases without overwriting anyone's changes.
  quick: code ? `hh:${code}:quick-add` : "simmer-quick-add",
  // "egg-free" (default) or "eggs". Household-scoped on purpose: a household
  // shares one kitchen, so the toggle follows the pantry rather than the device.
  diet: code ? `hh:${code}:diet` : "simmer-diet",
});

// Recipes and pantry suggestions that only make sense once eggs are allowed.
const DIET_EGG_FREE = "egg-free";
const usesEgg = (r) => (r?.tags || []).includes("egg");
const EGG_PANTRY = ["eggs"];

/* ==================================================================
   Making a recipe healthier

   "Healthy" here means exactly what the household asked for: high protein
   AND low calorie. Protein is measured as a share of calories rather than
   in grams, because grams alone just rewards a bigger serving.

   The suggestions are generated by rules rather than hand-written per
   recipe — there are 739 of them, and a hand-written variant for each would
   rot the moment a recipe changed. Each rule knows how to spot its own
   opportunity, what to say about it, how it moves the macros, and how to
   rewrite the ingredient line so the card can show the change.

   Every `delta` below is for the WHOLE RECIPE and is divided by the serving
   count when applied. Stating them per-serving quietly assumed two servings
   and inflated everything on a dish that feeds four.
   ================================================================== */

const HEALTHY_PROTEIN_SHARE = 0.20; // ≥20% of calories from protein
const HEALTHY_CAL = 450;            // per serving

const proteinShare = (m) => (m && m.cal > 0 ? (m.p * 4) / m.cal : 0);
const fatShare = (m) => (m && m.cal > 0 ? (m.f * 9) / m.cal : 0);
const DRINK_RE = /\b(chai|tea|coffee|soda|lassi|juice|lemonade|smoothie|milkshake|sharbat|thandai|shake|cooler|latte)\b/i;
const isDrink = (card) => DRINK_RE.test(card?.name || "");
// A pure condiment is not a plate either. The "&" test matters: "Coconut
// Chutney & Idli" is a breakfast and can take a protein source, a jar of lime
// pickle cannot.
const CONDIMENT_RE = /\b(pickle|chutney|podi|thecha|relish|jam|dip|dressing|raita|pachadi|salsa|sambal|masala powder|spice mix)\b/i;
// Sweet or savoury, judged from the ingredients rather than a keyword list of
// dish names. This decides which protein source is even plausible: a scoop of
// powder disappears into anything sweet, a cup of chickpeas does not.
const SWEET_RE = /condensed milk|\bsugar\b|jaggery|honey|syrup|chocolate|\bjam\b|milkmaid|custard|\bcocoa\b/;
const SAVOURY_RE = /onion|garlic|chilli|chili|\bcumin\b|masala|soy sauce|\bpepper\b|tomato|curry leaves|mustard seeds|vinegar|sriracha|gochujang|\bmiso\b|sesame oil|\bginger\b|cheese/;
const isSweet = (card, rows) => card?.mealType === "dessert"
  || (["breakfast", "snack"].includes(card?.mealType)
      && anyRow(rows, SWEET_RE) && !anyRow(rows, SAVOURY_RE));

const isCondiment = (card) => {
  const nm = card?.name || "";
  return CONDIMENT_RE.test(nm) && !/[&+]|with /i.test(nm);
};
// What supplies the fat in a fat-heavy dish. Split in two on purpose:
// FAT_TRIM is what can safely be halved in the ingredient list, FAT_DAIRY is
// fat that has to be swapped rather than cut — halving the milk in a porridge
// gives you less porridge, not a lighter one.
const OIL_RE = /\boil\b|\bghee\b|\bbutter\b|tahini|nut butter/;
const NUT_RE = /peanuts?|cashews?|almonds?|walnuts?|pistachios?|pine nuts?|sesame seeds|grated coconut|avocado|olives/;
const FAT_TRIM = new RegExp(`${OIL_RE.source}|${NUT_RE.source}`);
const FAT_DAIRY = /\bmilk\b|\bcream\b|mayonnaise|\bcheese\b|khoya|condensed milk/;
const FAT_CARRIER = new RegExp(`${FAT_TRIM.source}|${FAT_DAIRY.source}`);
const isHealthy = (m) => !!m && proteinShare(m) >= HEALTHY_PROTEIN_SHARE && m.cal <= HEALTHY_CAL;

// Ingredient rows are [qty, unit, name]; qty null means "to taste".
const rowName = (row) => String(row?.[2] || "");
const anyRow = (rows, re) => (rows || []).some((r) => re.test(rowName(r).toLowerCase()));
const mapRow = (rows, re, fn) => (rows || []).map((r) => (re.test(rowName(r).toLowerCase()) ? fn(r) : r));

// Ordered by how much they move the needle — at most MAX_TIPS are applied so
// the card stays readable rather than becoming a lecture.
const MAX_TIPS = 4;

// How much of a thing a recipe actually contains.
//
// This exists because fixed deltas were wrong. Sugar in this repository ranges
// from a teaspoon to a cup and a half — a seventy-fold spread — so a flat
// "halving the sugar saves 40g of carbs" turned a bowl of overnight oats into
// a zero-carb dish. Rules that act on a measurable ingredient now derive their
// delta from the quantity in front of them.
//
// Per-unit weights are ordinary kitchen approximations; `count` covers a null
// unit, which in this data means a countable piece ("10 cashews").
const GRAMS = {
  sugar:  { tsp: 4, tbsp: 12, cup: 200, g: 1, ml: 1, pinch: 0.3, count: 4 },
  fat:    { tsp: 4.5, tbsp: 14, cup: 218, g: 1, ml: 0.9, pinch: 0.3, count: 5 },
  cream:  { tsp: 5, tbsp: 15, cup: 240, g: 1, ml: 1, count: 15 },
  solid:  { tsp: 5, tbsp: 15, cup: 225, g: 1, ml: 1, count: 100 },
  nuts:   { tsp: 3, tbsp: 8, cup: 130, g: 1, ml: 1, count: 1.4 },
  liquid: { tsp: 5, tbsp: 15, cup: 240, g: 1, ml: 1, l: 1000, count: 400 },
  cheese: { tsp: 2.5, tbsp: 7, cup: 110, g: 1, ml: 1, count: 30 },
};

const gramsOf = (rows, re, table) => (rows || []).reduce((sum, r) => {
  if (!re.test(rowName(r).toLowerCase())) return sum;
  const q = Number(r[0]);
  if (!Number.isFinite(q) || q <= 0) return sum;
  const unit = String(r[1] || "").toLowerCase();
  return sum + q * (table[unit] ?? table.count);
}, 0);

// Rough per-gram figures for the swaps below, so a delta is arithmetic on a
// real quantity rather than a guess.
const PER_G = {
  sugar:   { cal: 4, c: 1 },
  fat:     { cal: 9, f: 1 },
  cream:   { cal: 3.4, f: 0.37, p: 0.02 },
  yogurt:  { cal: 0.6, f: 0.03, p: 0.10 },
  paneer:  { cal: 3.1, f: 0.20, p: 0.18 },
  tofu:    { cal: 1.4, f: 0.08, p: 0.17 },
  cashew:  { cal: 5.5, f: 0.44, p: 0.18 },
  coconut: { cal: 2.3, f: 0.24 },
  coconutLight: { cal: 0.7, f: 0.06 },
  cheese:  { cal: 4.0, f: 0.33, p: 0.25 },
};

const HEALTH_RULES = [
  {
    id: "airfry",
    label: "Air-fry it",
    test: ({ rows, text }) => anyRow(rows, /oil for (deep )?frying/) || /deep-?fry|deep frying/.test(text),
    note: "Air-fry at 200°C for 12–15 min, or oven-bake at 220°C, brushing on a tablespoon of oil. Same crust, a fraction of the fat.",
    delta: { cal: -300, p: 0, c: -6, f: -34 },
    rewrite: (rows) => mapRow(rows, /oil for (deep )?frying/, () => [1, "tbsp", "cooking oil, for brushing"]),
  },
  {
    id: "powder",
    group: "protein",
    label: "Hide a scoop of protein",
    // Only where a scoop genuinely disappears: sweets, and sweet or porridge-
    // like breakfasts. Stirring whey into a curry is not a serious suggestion.
    test: ({ card, rows, text }) => {
      if (!["dessert", "breakfast"].includes(card.mealType)) return false;
      // A shake takes a scoop; a cup of tea does not.
      if (isDrink(card) && !/smoothie|milkshake|\bshake\b/i.test(card.name || "")) return false;
      return isSweet(card, rows)
        || anyRow(rows, /\boats?\b|pancake|porridge|banana|berries/)
        || /pancake|smoothie|porridge|overnight oats|milkshake/.test(text);
    },
    note: "Whisk in a scoop of unflavoured whey or soy protein with the dry ingredients. It disappears into the texture.",
    delta: { cal: 120, p: 25, c: -2, f: 2 },
    add: [1, "scoop", "unflavoured protein powder"],
  },
  {
    id: "protein",
    group: "protein",
    label: "Give it a protein base",
    // Only worth suggesting when the dish is actually short on protein.
    // Not on drinks, and not on anything too small to be a meal — a cup of
    // chickpeas belongs in a curry, not in a 60-calorie glass of lime soda.
    // Never on anything sweet: the powder rule above owns those, and a cup of
    // chickpeas on condensed-milk toast is not a suggestion anyone would take.
    test: ({ card, rows, macros }) => proteinShare(macros) < 0.16 && macros.cal >= 150
      && !isDrink(card) && !isCondiment(card) && !isSweet(card, rows),
    note: null, // filled in per cuisine below
    delta: { cal: 200, p: 25, c: 20, f: 6 },
    add: null,
  },
  {
    id: "fat",
    group: "fat",
    label: "Cut the cooking fat",
    // Gram-based rather than "a row with 3+ tbsp": two rows of two tablespoons
    // each is the same amount of fat and was previously invisible.
    test: ({ rows }) => gramsOf(rows, /\bghee\b|\bbutter\b|\boil\b/, GRAMS.fat) >= 40,
    note: "Drop the ghee or oil to a single tablespoon and use a non-stick pan. In a spiced dish you will not miss it.",
    deltaFor: (rows) => {
      const excess = Math.max(0, gramsOf(rows, /\bghee\b|\bbutter\b|\boil\b/, GRAMS.fat) - 14);
      return { cal: -excess * PER_G.fat.cal, p: 0, c: 0, f: -excess * PER_G.fat.f };
    },
    rewrite: (rows) => (rows || []).map((r) =>
      /ghee|butter|oil/.test(rowName(r).toLowerCase()) && /tbsp/.test(String(r[1] || "")) && Number(r[0]) >= 3
        ? [1, r[1], r[2]] : r),
  },
  {
    id: "oilheavy",
    group: "fat",
    label: "Ease off the fat it leans on",
    // A dish can be fat-dominant without any one line hitting three
    // tablespoons — a small dish dressed in oil, or one built on peanuts. The
    // carrier is whatever is actually supplying the fat, not just oil.
    test: ({ macros, rows }) => fatShare(macros) >= 0.35 && anyRow(rows, FAT_CARRIER),
    // The advice has to name what is actually carrying the fat, or it reads as
    // boilerplate — "use less oil" on a milk pudding is not useful.
    noteFor: (rows) => anyRow(rows, FAT_TRIM)
      ? "A third or more of the calories here are fat. Use half the oil or nuts and add them at the very end — you taste them more that way, so less goes further."
      : "A third or more of the calories here are fat, and it is coming from the dairy. Use low-fat milk, or two-thirds of the cream or mayo — the texture holds up better than you would expect.",
    deltaFor: (rows) => {
      // Oils and nuts are weighed separately — a piece of one is not the
      // weight of a piece of the other — and halved.
      const trimmed = (gramsOf(rows, OIL_RE, GRAMS.fat) + gramsOf(rows, NUT_RE, GRAMS.nuts)) / 2;
      // Dairy is swapped rather than cut, so it needs its own arithmetic:
      // going from whole to low-fat removes roughly 2.5 g of fat per 100 g,
      // which is the whole point on a milk sweet where the dairy IS the fat.
      const dairy = gramsOf(rows, FAT_DAIRY, GRAMS.liquid) * 0.025;
      const saved = trimmed + dairy;
      return { cal: -saved * PER_G.fat.cal, p: 0, c: 0, f: -saved * PER_G.fat.f };
    },
    // Only halve what can be halved; dairy gets swapped in the note instead.
    rewrite: (rows) => (rows || []).map((r) =>
      FAT_TRIM.test(rowName(r).toLowerCase()) && typeof r[0] === "number" && r[0] > 1
        ? [Math.round(r[0] * 50) / 100, r[1], r[2]] : r),
  },
  {
    id: "cream",
    label: "Yogurt instead of cream",
    test: ({ rows }) => anyRow(rows, /(^|[^a-z])cream(?!\s*cheese)/),
    note: "Use thick Greek yogurt in place of the cream, stirred in off the heat so it cannot split.",
    deltaFor: (rows) => {
      const g = gramsOf(rows, /(^|[^a-z])cream(?!\s*cheese)/, GRAMS.cream);
      return {
        cal: g * (PER_G.yogurt.cal - PER_G.cream.cal),
        p: g * (PER_G.yogurt.p - PER_G.cream.p),
        c: 0,
        f: g * (PER_G.yogurt.f - PER_G.cream.f),
      };
    },
    rewrite: (rows) => mapRow(rows, /(^|[^a-z])cream(?!\s*cheese)/, (r) => [r[0], r[1], "thick Greek yogurt"]),
  },
  {
    id: "paneer",
    label: "Tofu for paneer",
    test: ({ rows }) => anyRow(rows, /paneer/),
    note: "Swap firm tofu for the paneer — press it 15 min first and it browns exactly the same way, for half the fat. (Paneer is no slouch on protein; this one is a calorie and fat win.)",
    deltaFor: (rows) => {
      const g = gramsOf(rows, /paneer/, GRAMS.solid);
      return {
        cal: g * (PER_G.tofu.cal - PER_G.paneer.cal),
        p: g * (PER_G.tofu.p - PER_G.paneer.p),
        c: 0,
        f: g * (PER_G.tofu.f - PER_G.paneer.f),
      };
    },
    rewrite: (rows) => mapRow(rows, /paneer/, (r) => [r[0], r[1], rowName(r).replace(/paneer/i, "firm tofu")]),
  },
  {
    id: "cashew",
    label: "Lose the cashew paste",
    test: ({ rows }) => (rows || []).some((r) => /cashew/.test(rowName(r).toLowerCase()) && Number(r[0]) >= 8),
    note: "Blend silken tofu instead of the cashews for the same silk with a fraction of the fat and more protein.",
    deltaFor: (rows) => {
      const g = gramsOf(rows, /cashew/, GRAMS.nuts);
      return {
        cal: 55 - g * PER_G.cashew.cal,
        p: 6 - g * PER_G.cashew.p,
        c: 2,
        f: 3 - g * PER_G.cashew.f,
      };
    },
    rewrite: (rows) => mapRow(rows, /cashew/, (r) => [100, "g", "silken tofu (for the paste)"]),
  },
  {
    id: "coconut",
    label: "Lighten the coconut milk",
    test: ({ rows }) => anyRow(rows, /coconut milk/),
    note: "Use light coconut milk, or cut full-fat with an equal part of stock. The spice carries the dish either way.",
    deltaFor: (rows) => {
      const g = gramsOf(rows, /coconut milk/, GRAMS.liquid);
      return {
        cal: g * (PER_G.coconutLight.cal - PER_G.coconut.cal),
        p: 0, c: 0,
        f: g * (PER_G.coconutLight.f - PER_G.coconut.f),
      };
    },
    rewrite: (rows) => mapRow(rows, /coconut milk/, (r) => [r[0], r[1], "light coconut milk"]),
  },
  {
    id: "sugar",
    label: "Halve the sugar",
    test: ({ rows }) => anyRow(rows, /\bsugar\b|condensed milk|jaggery|honey|syrup/),
    note: "Halve the sugar and lean on cardamom, cinnamon or vanilla instead — the spice reads as sweetness.",
    deltaFor: (rows) => {
      const saved = gramsOf(rows, /\bsugar\b|jaggery|honey|syrup|condensed milk/, GRAMS.sugar) / 2;
      return { cal: -saved * PER_G.sugar.cal, p: 0, c: -saved * PER_G.sugar.c, f: 0 };
    },
    rewrite: (rows) => mapRow(rows, /\bsugar\b|jaggery/, (r) =>
      (typeof r[0] === "number" ? [Math.round(r[0] * 50) / 100, r[1], r[2]] : r)),
  },
  {
    id: "grain",
    label: "Trade up the grain",
    test: ({ rows }) => (rows || []).some((r) => {
      const n = rowName(r).toLowerCase();
      return /\brice\b|all-purpose flour|maida|\bpasta\b|noodles/.test(n)
        && !/rice flour|rice vinegar|rice cakes?|rice paper|rice noodles/.test(n);
    }),
    note: "Use brown rice, whole-wheat flour or a wholegrain pasta — or cut the rice half-and-half with cauliflower rice for the same plate with more fibre.",
    delta: { cal: -80, p: 6, c: -22, f: 0 },
  },
  {
    id: "cheese",
    label: "Less cheese, grated finer",
    test: ({ rows }) => anyRow(rows, /cheese|mozzarella|cheddar|parmesan|feta/) && !anyRow(rows, /cottage cheese/),
    note: "Use two-thirds of the cheese but grate it finer — it still covers everything and you taste it just as much.",
    deltaFor: (rows) => {
      const saved = gramsOf(rows, /cheese|mozzarella|cheddar|parmesan|feta/, GRAMS.cheese) / 3;
      return {
        cal: -saved * PER_G.cheese.cal, p: -saved * PER_G.cheese.p,
        c: 0, f: -saved * PER_G.cheese.f,
      };
    },
    // Costs protein, so it is dropped again below if it would leave the dish
    // less protein-dense than it started.
    mayCostProtein: true,
  },
  {
    id: "greens",
    label: "Bulk it with greens",
    test: ({ card, macros }) => macros.cal >= 380 && !isDrink(card) && !isCondiment(card),
    note: "Fold in two big handfuls of spinach or a head of shredded cabbage at the end. It fills the plate for almost nothing.",
    delta: { cal: 50, p: 6, c: 8, f: 0 },
    add: [2, "handful", "spinach or shredded cabbage"],
  },
];

// What to add when a dish needs protein, chosen so the suggestion belongs in
// the dish rather than being tofu every time.
const PROTEIN_ADDS = [
  { test: (c) => /indian|andhra|tamil|kerala|karnataka|punjabi|bengali|gujarati|rajasthani|maharashtrian|mangalorean/.test(c.cuisine),
    row: [1, "cup", "cooked chickpeas or sprouted moong"],
    note: "Stir a cup of chickpeas or sprouted moong through it — it belongs in the dish and nearly doubles the protein." },
  { test: (c) => /chinese|japanese|korean|thai|vietnamese|indonesian|malaysian|indo-chinese/.test(c.cuisine),
    row: [200, "g", "firm tofu, cubed and seared"],
    note: "Sear 200 g of pressed tofu and fold it in at the end, or throw in a cup of edamame." },
  { test: (c) => /mexican|peruvian/.test(c.cuisine),
    row: [1, "cup", "black beans"],
    note: "Add a cup of black beans — it is already the right flavour and it carries the protein." },
  { test: (c) => /middle eastern|mediterranean|moroccan|ethiopian|west african|spanish|italian|continental/.test(c.cuisine),
    row: [1, "cup", "cooked white beans or lentils"],
    note: "Add a cup of white beans or brown lentils; in this cuisine it reads as part of the recipe, not an addition." },
  { test: () => true,
    row: [200, "g", "firm tofu, cubed"],
    note: "Add 200 g of pressed, seared tofu, or a cup of any cooked bean you have." },
];

// Apply the matching rules to a card and return everything the UI needs.
function healthify(card) {
  const macros = card?.macros;
  if (!macros) return null;
  const already = isHealthy(macros);
  const rows = card.ingFull || [];
  const text = [...(card.steps || []), ...rows.map(rowName)].join(" ").toLowerCase();
  const ctx = { card, rows, text, macros };

  const tips = [];
  let nextRows = rows;
  let next = { ...macros };
  // Deltas are whole-recipe; the card's macros are per serving.
  const serves = Math.max(1, Number(card.serves) || 2);

  // Two passes. First pick the rules that apply, then drop any that would
  // leave the dish less protein-dense than it started — "healthy" here means
  // high protein AND low calorie, so a change that trades protein away for
  // calories is not the trade that was asked for, however much lighter it is.
  const usedGroups = new Set();
  const picked = [];
  for (const rule of HEALTH_RULES) {
    if (picked.length >= MAX_TIPS) break;
    if (rule.group && usedGroups.has(rule.group)) continue;
    let ok = false;
    try { ok = rule.test(ctx); } catch { ok = false; }
    if (!ok) continue;

    let note = rule.noteFor ? rule.noteFor(rows) : rule.note;
    let add = rule.add;
    if (rule.id === "protein") {
      const pick = PROTEIN_ADDS.find((x) => x.test(card)) || PROTEIN_ADDS[PROTEIN_ADDS.length - 1];
      note = pick.note; add = pick.row;
    }
    if (rule.group) usedGroups.add(rule.group);
    // A rule that acts on a measurable ingredient computes its delta from the
    // quantity actually present; the rest carry a fixed one.
    let delta = rule.delta;
    if (rule.deltaFor) {
      try { delta = rule.deltaFor(rows); } catch { delta = rule.delta || {}; }
    }
    picked.push({ rule, note, add, delta });
  }

  // Rounded exactly as the card will display them, so the checks below judge
  // the numbers the user actually sees rather than the raw arithmetic.
  //
  // And bounded. The two halves of this calculation do not share a source of
  // truth: a recipe's macros are hand-authored per serving, while the deltas
  // above are derived from the ingredient list. Where the authored figure
  // under-counts what the ingredients imply, a stack of derived subtractions
  // outruns what it can absorb — which is how swapping the paneer, the cream
  // and half the oil turned a 380-calorie palak paneer into a 130-calorie one.
  // The swaps are still right; the arithmetic just cannot be trusted to the
  // last calorie, so no set of suggestions may claim to remove more than half
  // the calories or three-quarters of the fat.
  // The bounds are proportions of the dish's own figures, with no absolute
  // minimum: an absolute floor of 80 calories both invented calories for a
  // 70-calorie drink and then pinned it there, so cutting its honey changed
  // nothing on screen.
  const CAL_FLOOR = 0.5, FAT_FLOOR = 0.25;
  const round = (m) => ({
    cal: Math.round(Math.max(macros.cal * CAL_FLOOR, m.cal)),
    p: Math.max(0, Math.round(m.p)),
    c: Math.max(0, Math.round(m.c)),
    f: Math.round(Math.max(macros.f * FAT_FLOOR, m.f)),
  });
  const totals = (list) => list.reduce((acc, { rule, delta }) => {
    const d = delta || rule.delta || {};
    return {
      cal: acc.cal + (d.cal || 0) / serves,
      p: acc.p + (d.p || 0) / serves,
      c: acc.c + (d.c || 0) / serves,
      f: acc.f + (d.f || 0) / serves,
    };
  }, { ...macros });

  let applied = picked;

  // Repair 1: a change that trades protein away for calories is not the trade
  // that was asked for, however much lighter it leaves the dish.
  if (applied.some((x) => x.rule.mayCostProtein)
      && proteinShare(round(totals(applied))) < proteinShare(macros)) {
    applied = applied.filter((x) => !x.rule.mayCostProtein);
  }

  // Repair 2: adding a whole-food protein source brings some fat with it. On a
  // dish already leaning on oil or nuts that can tip it over into genuinely
  // fatty, which no threshold on the fat rule alone can catch — the dish only
  // becomes fatty *because* of the protein suggestion. So decide the two
  // together: if the result would be fat-dominant and nothing is already
  // addressing the fat, add the rule that does.
  const fatRule = HEALTH_RULES.find((r) => r.id === "oilheavy");
  const hasFatTip = applied.some((x) => x.rule.group === "fat");
  const after = round(totals(applied));
  if (!hasFatTip && fatShare(after) > 0.35 && fatShare(after) > fatShare(macros)
      && anyRow(rows, FAT_CARRIER)) {
    applied = [...applied, {
      rule: fatRule,
      note: fatRule.noteFor ? fatRule.noteFor(rows) : fatRule.note,
      add: fatRule.add,
      delta: fatRule.deltaFor ? fatRule.deltaFor(rows) : fatRule.delta,
    }].slice(0, MAX_TIPS);
  }

  applied = applied.filter(({ rule, delta }) => {
    if (!rule.deltaFor) return true;
    const d = delta || {};
    return Math.abs(d.cal || 0) >= 5 || Math.abs(d.p || 0) >= 1 || Math.abs(d.f || 0) >= 1;
  });

  for (const { rule, note, add } of applied) {
    tips.push({ id: rule.id, label: rule.label, note });
    if (rule.rewrite) nextRows = rule.rewrite(nextRows);
    if (add) nextRows = [...nextRows, add];
  }
  next = totals(applied);

  // Nothing matched but the dish still is not high-protein and light. Say
  // something true rather than showing an empty panel.
  if (!tips.length && !already) {
    tips.push({
      id: "portion",
      label: "Build the plate around it",
      note: "Nothing here swaps out cleanly. Keep the portion as written and put a large salad or a bowl of dal beside it — that is where the protein and the volume come from.",
    });
  }

  // Deltas are estimates stacked on estimates, so floor them at something
  // physically sensible rather than letting a heavily-swapped dish go negative.
  // Floors the estimate without ever pushing a genuinely light dish *up* — a
  // 70-calorie pickle is not improved by being called 80, and a fat-free one
  // must not acquire a gram of fat on the way through.
  next = round(next);
  // A physical bound on the estimate: no home cook turns a plate of food into
  // a protein shake. Past ~55% of calories from protein the arithmetic has
  // drifted, so pull it back rather than printing a number nobody believes.
  const cap = Math.floor((next.cal * 0.55) / 4);
  if (next.p > cap) next.p = Math.max(0, cap);

  return { already, tips, macros: next, before: macros, ingFull: nextRows };
}

/* ==================================================================
   Ingredient matching

   Recipes list ingredients as free text ("garlic cloves", "black
   pepper") and so does the pantry, so matching is string work, not id
   lookup. Everything below exists to make "2 garlic cloves" match a
   pantry entry of "garlic" without also matching "peanut butter" to a
   staple of "butter".
   ================================================================== */

// Cheap key for dedupe/lookup. Not used for matching — tokenize is.
const norm = (s) => s.toLowerCase().trim().replace(/s$/, "");

// A shopping entry is {n, from} — `from` records which list it was swiped out
// of, so buying it puts it back there. Older entries are plain strings with no
// origin; they read as "no origin recorded" and default to the pantry, so no
// migration is needed and nothing has to be rewritten on load.
const shopName = (e) => (typeof e === "string" ? e : e?.n ?? "");
const shopFrom = (e) => (typeof e === "string" ? null : e?.from ?? null);

// Split into comparable word tokens: drop parentheticals ("(optional)") and
// punctuation, then singularise so "tomatoes"/"tomato" and "berries"/"berry"
// land on the same token.
const tokenize = (s) =>
  s.toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/ies$/, "i").replace(/oes$/, "o").replace(/s$/, "").replace(/^peppercorn$/, "pepper"));

// heads where a bare generic must NOT absorb a modified compound:
// staple "pepper" (black pepper) ≠ "padron peppers"; "milk" ≠ "coconut milk"; "butter" ≠ "peanut butter"
const AMBIGUOUS_HEADS = new Set(["pepper", "milk", "butter", "clove"]);

// trailing form nouns that don't change identity: "cheddar cheese" is cheddar, "garlic cloves" is garlic
const TRAILING_FORMS = new Set(["cheese", "leaf", "leave", "clove", "stalk", "sprig", "head", "bulb", "seed"]);
const stripForm = (t) => (t.length >= 2 && TRAILING_FORMS.has(t[t.length - 1]) ? t.slice(0, -1) : t);

// Words where the raw form and the prepared product are different ingredients.
// "mustard seeds" is a whole spice you temper in oil; "mustard" is the
// condiment. Stripping the form noun would otherwise reduce the first to the
// second and treat having either as covering both.
//
// This is deliberately narrow. It is NOT the same rule as AMBIGUOUS_HEADS —
// that stops a bare head absorbing a compound with the same head ("butter" vs
// "peanut butter"); this stops form-stripping equating two different products.
// Most seeds don't belong here: "cumin seeds" really is "cumin".
const FORM_CHANGES_IDENTITY = new Set(["mustard"]);

// True when two token lists name the same ingredient.
//
// The rule is subset-on-a-shared-head: the last token is the noun being
// named, so it must agree, and the shorter phrase's words must all appear
// in the longer one. That lets "garlic" match "fresh garlic" while keeping
// "chicken stock" away from "vegetable stock" (heads agree, but "chicken"
// isn't in the other phrase — so neither is a subset of the other).
function tokensMatch(ta, tb) {
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false; // head nouns must agree
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // A bare ambiguous head must not swallow a modified compound: a staple of
  // "butter" should not mark "peanut butter" as already covered.
  if (short.length === 1 && long.length > 1 && AMBIGUOUS_HEADS.has(short[0])) return false;
  const ls = new Set(long);
  return short.every((w) => ls.has(w));
}

// Match on the raw tokens first; if that fails and either side ends in a
// form noun ("cloves", "leaves"), retry with it stripped. Two passes rather
// than always stripping, so "bay leaf" keeps its head when compared to
// another leaf.
function ingMatch(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  if (tokensMatch(ta, tb)) return true;
  const sa = stripForm(ta), sb = stripForm(tb);
  if (sa === ta && sb === tb) return false; // nothing to strip; already decided
  // Refuse when stripping would collapse a compound onto a bare word that
  // names a different product — "mustard seeds" must not become "mustard".
  const collapsed = (orig, stripped) =>
    stripped.length === 1 && orig.length > 1 && FORM_CHANGES_IDENTITY.has(stripped[0]);
  if (collapsed(ta, sa) || collapsed(tb, sb)) return false;
  return tokensMatch(sa, sb);
}

function ingInList(ing, list) {
  return list.some((x) => ingMatch(ing, x));
}
// Sort a recipe's core ingredients into four buckets against the pantry:
//   uses     — in the pantry (or reachable via a substitution)
//   missing  — not in pantry, not a staple, no usable substitute
//   rescues  — uses that are flagged "use soon", worth surfacing
//   swaps    — {need, have} pairs where a substitution was applied
// Staples are assumed on hand and deliberately land in none of them.
function computeFit(recipe, pantry, staples) {
  const pNames = pantry.map((p) => p.name);
  const soon = pantry.filter((p) => p.useSoon).map((p) => p.name);
  const uses = [], missing = [], rescues = [], swaps = [];
  const alts = recipe.alts || {};
  for (const ing of recipe.ingredients || []) {
    if (ingInList(ing, pNames)) {
      uses.push(ing);
      if (ingInList(ing, soon)) rescues.push(ing);
    } else if (ingInList(ing, staples)) {
      // staple — covered, skip
    } else {
      // check alts: can the user substitute something they DO have?
      const subs = alts[ing] || [];
      const hit = subs.find((s) => ingInList(s, pNames));
      if (hit) {
        uses.push(hit);
        swaps.push({ need: ing, have: hit });
        if (ingInList(hit, soon)) rescues.push(hit);
      } else {
        missing.push(ing);
      }
    }
  }
  return { uses, missing, rescues, swaps };
}

let uidCounter = 0;
const uid = () => Date.now() + "-" + (uidCounter++);

/* ==================================================================
   Cuisine similarity

   Derived from the repository's own ingredients rather than a
   hand-written table, so it stays correct as recipes are added and
   encodes what the food actually shares rather than someone's guess.

   Each cuisine becomes a vector over its core ingredients, TF-IDF
   weighted: an ingredient present in every cuisine (onion, salt) says
   nothing about identity, while one confined to a few (gochujang,
   berbere, tamarind) says a great deal. Cosine similarity between two
   vectors is then "how alike do these two cuisines cook".

   Computed once at module load — 31 cuisines is a trivial matrix.
   ================================================================== */
const CUISINE_SIM = (() => {
  const profile = {}, recipeCount = {};
  for (const r of REPO) {
    const c = (r.cuisine || "").toLowerCase();
    if (!c) continue;
    recipeCount[c] = (recipeCount[c] || 0) + 1;
    profile[c] = profile[c] || {};
    for (const ing of r.ingredients || []) {
      const k = norm(ing);
      profile[c][k] = (profile[c][k] || 0) + 1;
    }
  }
  const names = Object.keys(profile);
  const docFreq = {};
  for (const c of names) for (const k of Object.keys(profile[c])) docFreq[k] = (docFreq[k] || 0) + 1;

  const vec = {};
  for (const c of names) {
    const v = {};
    let mag = 0;
    for (const [k, f] of Object.entries(profile[c])) {
      const w = (f / recipeCount[c]) * Math.log(names.length / docFreq[k]);
      if (w > 0) { v[k] = w; mag += w * w; }
    }
    mag = Math.sqrt(mag) || 1;
    for (const k of Object.keys(v)) v[k] /= mag;
    vec[c] = v;
  }

  const sim = {};
  for (const a of names) {
    sim[a] = {};
    for (const b of names) {
      if (a === b) continue;
      let dot = 0;
      for (const [k, w] of Object.entries(vec[a])) if (vec[b][k]) dot += w * vec[b][k];
      sim[a][b] = dot;
    }
  }
  return { names, sim, count: recipeCount };
})();

// Cuisines ranked by similarity to `cuisine`, closest first.
const rankedByCloseness = (cuisine) => {
  const row = CUISINE_SIM.sim[cuisine];
  if (!row) return [];
  return Object.entries(row).sort((a, b) => b[1] - a[1]).map(([c]) => c);
};

// Geography is the one thing NOT derivable from ingredients — two cuisines can
// share a pantry and sit continents apart — so this map is hand-authored.
//
// It exists to stop the deck pooling. 13 of the 31 cuisines are South Asian,
// so ranking purely by ingredient distance hands back a screen of Indian food:
// "furthest from Thai" scored bengali, rajasthani, punjabi and maharashtrian
// as the top four, which is technically true and useless as a change of scene.
const CUISINE_REGION = {
  "north indian": "south asia", "south indian": "south asia", punjabi: "south asia",
  gujarati: "south asia", rajasthani: "south asia", bengali: "south asia",
  maharashtrian: "south asia", andhra: "south asia", karnataka: "south asia",
  kerala: "south asia", tamil: "south asia", mangalorean: "south asia",
  "indo-chinese": "south asia",
  chinese: "east asia", japanese: "east asia", korean: "east asia",
  thai: "southeast asia", vietnamese: "southeast asia",
  malaysian: "southeast asia", indonesian: "southeast asia",
  "middle eastern": "west asia", moroccan: "north africa",
  ethiopian: "east africa", "west african": "west africa",
  italian: "south europe", spanish: "south europe", mediterranean: "south europe",
  continental: "north europe",
  mexican: "latin america", peruvian: "latin america",
  fusion: "other",
};
const regionOf = (c) => CUISINE_REGION[c] || "other";

// Cuisines least like everything in `rejected`, spread across regions.
//
// Distance is scored on the worst case — a candidate only counts as far if it
// is far from EVERY rejected cuisine, otherwise after rejecting Thai and
// Italian we could serve Vietnamese on the grounds it is unlike Italian.
//
// The result is then round-robined across regions rather than returned in
// straight distance order, so the head of the list is one option from each
// part of the world instead of five from whichever region happens to be
// over-represented in the repository.
const furthestFrom = (rejected) => {
  const from = [...new Set(rejected.filter((c) => CUISINE_SIM.sim[c]))];
  if (!from.length) return [];
  const rejectedRegions = new Set(from.map(regionOf));

  const scored = CUISINE_SIM.names
    .filter((c) => !from.includes(c))
    .map((c) => ({ c, d: Math.max(...from.map((r) => CUISINE_SIM.sim[r][c] ?? 0)), region: regionOf(c) }))
    .sort((a, b) => a.d - b.d);

  // A different region is the point of the jump, so those come first; the
  // rejects' own region is kept only as a fallback if nothing else is left.
  const near = scored.filter((x) => rejectedRegions.has(x.region));
  const away = scored.filter((x) => !rejectedRegions.has(x.region));

  const byRegion = {};
  for (const x of away) (byRegion[x.region] = byRegion[x.region] || []).push(x);
  // Regions ordered by their best candidate, then taken one at a time.
  const regions = Object.keys(byRegion).sort((a, b) => byRegion[a][0].d - byRegion[b][0].d);
  const out = [];
  for (let i = 0; ; i++) {
    let added = false;
    for (const r of regions) {
      if (byRegion[r][i]) { out.push(byRegion[r][i].c); added = true; }
    }
    if (!added) break;
  }
  return [...out, ...near.map((x) => x.c)];
};

/* ==================================================================
   Deck selection

   Picks the next `count` cards. Two stages: score every candidate,
   then choose from the ranked list. Scoring is a single "tier" number
   built from penalties and bonuses — lower tier is better, and score
   is its negation plus jitter, so higher score wins.
   ================================================================== */
// Reads the tail of the swipe history and says how the deck should behave.
//
//   3 consecutive lefts  -> explore: jump to cuisines unlike what was rejected
//   1+ consecutive rights -> exploit: close in on what was liked, tightening
//                            with each further right swipe
//
// The tightening is deliberately gradual. One right swipe is weak evidence, so
// it reaches for the second-closest cuisine; a run of them is strong evidence,
// so it converges on the closest.
const LEFT_STREAK_TO_JUMP = 3;
function readMood(swipes) {
  let rights = 0, lefts = 0;
  for (let i = swipes.length - 1; i >= 0; i--) {
    if (swipes[i].dir === "right") { if (lefts) break; rights++; }
    else { if (rights) break; lefts++; }
  }
  const recent = (n, dir) => swipes.filter((s) => s.dir === dir).slice(-n).map((s) => (s.cuisine || "").toLowerCase()).filter(Boolean);
  if (rights > 0) {
    // depth 1 -> second-closest, 2 -> closest, 3+ -> closest and stay there
    return { mode: "exploit", depth: rights, seeds: recent(3, "right") };
  }
  if (lefts >= LEFT_STREAK_TO_JUMP) {
    return { mode: "explore", depth: lefts, seeds: recent(LEFT_STREAK_TO_JUMP, "left") };
  }
  return { mode: "neutral", depth: 0, seeds: [] };
}

function pickFromRepo(recipes, { pantry, staples, mode, exclude, swipes, cuisines = [], maxTime = null, mealType = null, count = 5 }) {
  const liked = new Set(swipes.filter((s) => s.dir === "right").map((s) => (s.cuisine || "").toLowerCase()));
  const passed = new Set(swipes.filter((s) => s.dir === "left").map((s) => (s.cuisine || "").toLowerCase()));

  // Explore/exploit steering, unless a manual cuisine filter is already
  // deciding what the deck shows.
  const mood = cuisines.length ? { mode: "neutral", depth: 0, seeds: [] } : readMood(swipes);
  const steer = {};
  if (mood.mode === "explore") {
    // Far cuisines get the bonus; the ones just rejected are pushed away hard.
    const far = furthestFrom(mood.seeds).filter((c) => (CUISINE_SIM.count[c] || 0) >= 5);
    far.slice(0, 8).forEach((c, i) => { steer[c] = -60 + i * 5; });
    for (const c of mood.seeds) steer[c] = (steer[c] || 0) + 80;
  } else if (mood.mode === "exploit") {
    // depth 1 favours the second-closest, depth 2+ the closest.
    for (const seed of mood.seeds) {
      const near = rankedByCloseness(seed);
      const order = mood.depth === 1 ? [near[1], near[0], near[2]] : [near[0], near[1], near[2]];
      order.forEach((c, i) => { if (c) steer[c] = (steer[c] || 0) - (45 - i * 12); });
      steer[seed] = (steer[seed] || 0) - (mood.depth >= 2 ? 30 : 10);
    }
  }
  const wanted = new Set(cuisines.map((c) => c.toLowerCase()));
  // Time-of-day meal preference (device local time, soft boost)
  const hr = new Date().getHours();
  const timeMeals = hr < 10 ? ["breakfast"] : hr < 14 ? ["lunch", "salad"] : hr < 18 ? ["snack", "dessert"] : ["dinner"];
  const eligible = recipes
    .filter((r) => !exclude.has(r.name.toLowerCase()))
    .filter((r) => !wanted.size || wanted.has((r.cuisine || "").toLowerCase()))
    .filter((r) => !maxTime || (r.minutes || 0) <= maxTime)
    .filter((r) => servesMeal(r, mealType))
    .map((r) => {
      const fit = computeFit(r, pantry, staples);
      return { r, fit };
    })
    .filter(({ fit }) => (mode === "strict" ? fit.missing.length === 0 : fit.missing.length <= 2));

  // Supply normalisation.
  //
  // The repository is lopsided in ways that are honest — Indian cuisine has a
  // far bigger breakfast repertoire than Italian does — but a deck that simply
  // samples the pool inherits that lopsidedness whole. So each region is
  // penalised in proportion to how over-represented it is IN THIS POOL, which
  // is filter-aware for free: filter to breakfast and it corrects breakfast's
  // skew, filter to one cuisine and there is only one region so it does
  // nothing.
  //
  // Logarithmic rather than linear so a region at twice its fair share is
  // nudged while one at ten times is pushed hard, and clamped so this can
  // never outrank the missing-ingredient tiers — the deck's first job is still
  // telling you what you can actually cook tonight.
  const SUPPLY_K = 22;
  const SUPPLY_CLAMP = 40;
  const poolByRegion = {};
  for (const c of eligible) {
    const rg = regionOf((c.r.cuisine || "").toLowerCase());
    poolByRegion[rg] = (poolByRegion[rg] || 0) + 1;
  }
  const regionsPresent = Object.keys(poolByRegion).length;
  const fairShare = 1 / Math.max(1, regionsPresent);
  const supplyPenalty = (rg) => {
    if (regionsPresent < 2 || !eligible.length) return 0;
    const share = (poolByRegion[rg] || 0) / eligible.length;
    if (share <= 0) return 0;
    const p = SUPPLY_K * Math.log(share / fairShare);
    return Math.max(-SUPPLY_CLAMP, Math.min(SUPPLY_CLAMP, p));
  };

  const candidates = eligible
    .map((c) => {
      const cz = (c.r.cuisine || "").toLowerCase();
      // Tier by missing count (0 = best, then 1, then 2) — shuffled within each tier
      let tier = c.fit.missing.length * 100;
      // Primary within tier: recipes using what you actually added come first
      // 40 per pantry item guarantees peas-recipe beats staple-only crêpes
      tier -= c.fit.uses.length * 40;
      // Mood: cuisine preferences from swipe history
      if (liked.has(cz)) tier -= 10;
      if (passed.has(cz) && !liked.has(cz)) tier += 10;
      // Explore/exploit steering (0 when neither is active)
      tier += steer[cz] || 0;
      // Supply normalisation: over-represented regions get pushed down,
      // under-represented ones pulled up.
      tier += supplyPenalty(regionOf(cz));
      // Rescue bonus for use-soon items
      if (c.fit.rescues.length) tier -= 5;
      // Time-of-day: boost matching meal type when no manual meal filter is set
      if (!mealType && mealsOf(c.r).some((m) => timeMeals.includes(m))) tier -= 15;
      // Jitter for variety between shuffles. Note the range (0–50) is wider
      // than the pantry-use step (40), so this can occasionally reorder
      // across one "uses" step — deliberate, it keeps decks from being
      // identical, but it means ranking is not strictly deterministic.
      const score = -tier + Math.random() * 50;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);

  // Pick phase. Diversify only when nothing else is steering the deck: no
  // cuisine filter, and no swipe history to learn a preference from. Once
  // the user has expressed a taste, honour it instead of spreading wide.
  const hasVibe = liked.size > 0;
  const diversify = mode === "flexible" && !wanted.size && !hasVibe;
  let picks;
  if (diversify && candidates.length > count) {
    // Split: recipes using pantry items vs staple-only freebies
    const pantryHits = candidates.filter((c) => c.fit.uses.length > 0).sort((a, b) => b.score - a.score);
    const freebies = candidates.filter((c) => c.fit.uses.length === 0);
    // Fill first from pantry hits, then round-robin freebies across cuisines
    picks = pantryHits.slice(0, count);
    if (picks.length < count) {
      // Round-robin by REGION, not cuisine. With 13 South Asian labels a
      // per-cuisine rotation still returns a mostly-Indian deck; per-region
      // gives one from each part of the world before repeating any.
      const byRegion = {};
      for (const c of freebies) {
        const reg = regionOf((c.r.cuisine || "").toLowerCase());
        (byRegion[reg] = byRegion[reg] || []).push(c);
      }
      // Shuffle within each region so the same cuisine doesn't always lead it.
      for (const reg of Object.keys(byRegion)) byRegion[reg].sort(() => Math.random() - 0.5);
      const regKeys = Object.keys(byRegion).sort(() => Math.random() - 0.5);
      let round = 0;
      while (picks.length < count) {
        let added = false;
        for (const reg of regKeys) {
          if (picks.length >= count) break;
          if (byRegion[reg][round]) { picks.push(byRegion[reg][round]); added = true; }
        }
        if (!added) break;
        round++;
      }
    }
  } else {
    picks = candidates.slice(0, count);
    // When every pick came from an already-liked cuisine, swap the last one
    // for something outside it — stops the deck narrowing to one cuisine.
    if (!wanted.size && liked.size && picks.length === count) {
      const wild = candidates.find(
        (c) => !liked.has((c.r.cuisine || "").toLowerCase()) && !picks.includes(c)
      );
      if (wild && picks.every((p) => liked.has((p.r.cuisine || "").toLowerCase()))) {
        picks[picks.length - 1] = wild;
      }
    }
  }
  return picks.map((c, i) => ({
    ...c.r, ...c.fit, id: uid(),
    wildcard: !wanted.size && liked.size ? !liked.has((c.r.cuisine || "").toLowerCase()) && i === picks.length - 1 : false,
  }));
}

// Transient confirmation banner. Lives here rather than inside one tab
// because MatchesTab called showToast without having one — a ReferenceError
// the moment you tapped "got it" on a staple.
function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const showToast = useCallback((msg, action = null) => {
    setToast({ msg, action });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), action ? 3000 : 1500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []); // don't fire after unmount
  return { toast, setToast, showToast };
}

function Toast({ toast, setToast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 40,
      background: C.ink, color: "#fff", borderRadius: 99, padding: "8px 10px 8px 16px",
      fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", animation: "slideDown .15s ease",
      boxShadow: "0 8px 24px rgba(30,43,32,.35)", display: "flex", alignItems: "center", gap: 8,
    }}>
      {toast.msg}
      {toast.action && (
        <button onClick={() => { toast.action.fn(); setToast(null); }} style={{
          border: "none", background: C.pink, color: "#fff", borderRadius: 99,
          padding: "5px 12px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer",
        }}>{toast.action.label}</button>
      )}
    </div>
  );
}

/* ==================================================================
   App

   Owns all persisted state and the sync lifecycle. The tab components
   below are presentational: they receive values and persist* callbacks
   and never touch storage.js directly.

   Two storage namespaces exist — solo (localStorage) and household
   (Supabase) — and exactly one is live at a time, chosen by
   profile.code. See nsKeys for the invariant that governs writes.
   ================================================================== */

export default function Simmer() {
  const [tab, setTab] = useState("swipe");
  const [profile, setProfile] = useState(null);
  const [pantry, setPantry] = useState(null);
  const [matches, setMatches] = useState(null);
  const [staples, setStaples] = useState(null);
  const [shopping, setShopping] = useState([]);
  const [stockCounts, setStockCounts] = useState({});
  const [community, setCommunity] = useState([]);
  const [cooked, setCooked] = useState([]);
  const [quickEdits, setQuickEdits] = useState({ add: [], hide: [] });
  const [diet, setDiet] = useState(DIET_EGG_FREE);
  const [recipeSheet, setRecipeSheet] = useState(false);
  const [favSheet, setFavSheet] = useState(false);
  const [cookedSheet, setCookedSheet] = useState(false);
  const [mode, setMode] = useState("flexible");
  const [hhOpen, setHhOpen] = useState(false);
  const [matchFlash, setMatchFlash] = useState(null);
  const [openTarget, setOpenTarget] = useState(null);
  // last household-sync failure, surfaced in the household panel
  const [syncError, setSyncError] = useState(null);

  // Session-only state: never persisted, reset on household change and on
  // any change that invalidates the current deck.
  const [deck, setDeck] = useState([]);
  const [swipes, setSwipes] = useState([]);
  const [seen, setSeen] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [maxTime, setMaxTime] = useState(null);
  const [mealType, setMealType] = useState(null);
  const [history, setHistory] = useState([]);
  const [exhausted, setExhausted] = useState(null); // { matchable, unlock: [{name, count}] }
  const sessionRef = useRef(0);
  const cuisinesRef = useRef(cuisines); cuisinesRef.current = cuisines;
  const maxTimeRef = useRef(maxTime); maxTimeRef.current = maxTime;
  const mealTypeRef = useRef(mealType); mealTypeRef.current = mealType;

  // Mirrors of persisted state. The persist*/deal callbacks are memoised and
  // run from timers and event handlers, so they read current values through
  // these refs rather than capturing them in a stale closure.
  const pantryRef = useRef(pantry); pantryRef.current = pantry;
  const matchesRef = useRef(matches); matchesRef.current = matches;
  const staplesRef = useRef(staples); staplesRef.current = staples;
  const profileRef = useRef(profile); profileRef.current = profile;
  const shoppingRef = useRef(shopping); shoppingRef.current = shopping;
  const cookedRef = useRef(cooked); cookedRef.current = cooked;
  const quickEditsRef = useRef(quickEdits); quickEditsRef.current = quickEdits;
  const dietRef = useRef(diet); dietRef.current = diet;

  // Which namespace the in-memory state was actually loaded from: a household
  // code, or null for solo. `undefined` means nothing has loaded yet. Writes
  // are refused whenever this disagrees with profile.code — see persistNs.
  const loadedCodeRef = useRef(undefined);

  // Load every persisted value for one namespace and install it in state.
  // Throws if a shared read fails — callers must handle that, because the
  // alternative (falling back to empty) is what used to overwrite real data.
  const loadNamespace = useCallback(async (code) => {
    const k = nsKeys(code);
    const [p, m, s, sh, sc, ck, qa, dt] = await Promise.all([
      loadKey(k.pantry, []),
      loadKey(k.matches, []),
      loadKey(k.staples, STAPLES_LIST),
      loadKey(k.shopping, []),
      loadKey(k.stock, {}),
      loadKey(k.cooked, []),
      loadKey(k.quick, { add: [], hide: [] }),
      loadKey(k.diet, DIET_EGG_FREE),
    ]);
    // Staples migration. Older builds stored a bare array; current builds
    // store {v, items}. Two cases are handled differently on purpose:
    //   - an untouched legacy default set is replaced wholesale, so users who
    //     never customised it get the new defaults
    //   - a customised set is preserved and only gains genuinely new items,
    //     so nobody's edits are discarded
    // staples stored either as legacy array or versioned {v, items}
    let sItems = Array.isArray(s) ? s : (s?.items || STAPLES_LIST);
    let sVer = Array.isArray(s) ? 0 : (s?.v || 0);
    if (LEGACY_STAPLES.some((L) => sItems.length === L.length && L.every((x) => sItems.includes(x)))) {
      sItems = STAPLES_LIST; // untouched default set → adopt the new default wholesale
    } else if (sVer < 27) {
      // customized set: append only the never-before-seen spice items (one-time, versioned)
      const have = new Set(sItems.map(norm));
      sItems = [...sItems, ...SPICE_BOX.filter((x) => !have.has(norm(x))), ...INDIAN_PANTRY.filter((x) => !have.has(norm(x)))];
    }
    const migrated = sItems;
    if (sVer < 27 || Array.isArray(s)) saveKey(k.staples, { v: 27, items: migrated }).catch(() => {});
    // Legacy migration: `out` used to mean "in the pantry but I've run out".
    // Deselecting now removes an item outright, so that state no longer
    // exists — anything still carrying it is something the user had already
    // said they don't have, and it belongs back in quick add, not in the list.
    const pantryItems = (p || []).filter((x) => !x.out).map(({ out, ...rest }) => rest);
    setPantry(pantryItems); setMatches(m); setStaples(migrated); setShopping(sh); setStockCounts(sc || {});
    setCooked(Array.isArray(ck) ? ck : []);
    setQuickEdits({ add: qa?.add || [], hide: qa?.hide || [] });
    // Anything unrecognised falls back to egg-free — the safe default.
    setDiet(dt === "eggs" ? "eggs" : DIET_EGG_FREE);
    // Only now does state genuinely represent this namespace, so only now is
    // it safe to write back to it. On a throw above we never reach this line.
    loadedCodeRef.current = code ?? null;
  }, []);

  useEffect(() => {
    (async () => {
      const prof = await loadKey("simmer-profile", { code: null });
      setProfile(prof);
      try {
        await loadNamespace(prof.code);
      } catch (e) {
        // Household unreachable at boot. Show solo data so the app still
        // works, and keep the code so the 20s refresh keeps retrying. Because
        // loadedCodeRef now says "solo" while profile.code says "household",
        // persistNs refuses every write until a refresh succeeds — which is
        // what stops this solo data being written over the household's.
        setSyncError(
          `Can't reach household ${prof.code} — ${msg(e)} ` +
          `Showing your solo pantry meanwhile; edits are paused so nothing ` +
          `gets overwritten.`,
        );
        await loadNamespace(null).catch(() => {});
      }
    })();
  }, [loadNamespace]);

  // community recipes: global, all households; skip any id already baked into the repo
  const repoIds = React.useMemo(() => new Set(REPO.map((r) => r.repoId)), []);
  const loadCommunity = useCallback(async () => {
    const raw = await loadKey(COMMUNITY_KEY, []);
    setCommunity((Array.isArray(raw) ? raw : []).filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  const saveCommunity = useCallback(async (nextList) => {
    // read-merge-write to shrink the lost-update window
    const latest = await loadKey(COMMUNITY_KEY, []);
    const byId = new Map((Array.isArray(latest) ? latest : []).map((r) => [r.repoId, r]));
    for (const r of nextList) byId.set(r.repoId, r);
    const merged = [...byId.values()];
    await saveKey(COMMUNITY_KEY, merged);
    setCommunity(merged.filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  const deleteCommunity = useCallback(async (repoId) => {
    const latest = await loadKey(COMMUNITY_KEY, []);
    const merged = (Array.isArray(latest) ? latest : []).filter((r) => r.repoId !== repoId);
    await saveKey(COMMUNITY_KEY, merged);
    setCommunity(merged.filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  useEffect(() => {
    // The community pool is nice-to-have: log and carry on rather than
    // blocking the app when it can't be fetched.
    const pull = () => loadCommunity().catch((e) => console.warn("community pool:", msg(e)));
    pull();
    const iv = setInterval(pull, 30000);
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [loadCommunity]);

  // Egg recipes are held back unless the household has opted in. Filtering at
  // the pool means the deck, the meal-prep grid and the filter counts all agree
  // without each having to remember the rule.
  const allRecipes = React.useMemo(
    () => [...REPO, ...community].filter((r) => diet === "eggs" || !usesEgg(r)),
    [community, diet],
  );
  const allRecipesRef = useRef(allRecipes); allRecipesRef.current = allRecipes;

  // Every shared write can fail (offline, RLS, unconfigured build). Surface it
  // instead of dropping it on the floor: a silent failure here is why a
  // household could look created and store nothing.
  const persist = useCallback((key, value) => {
    saveKey(key, value).then(
      () => setSyncError(null),
      (e) => setSyncError(e instanceof SyncError ? e.message : String(e?.message || e)),
    );
  }, []);

  // Update local state and write it back, but only if state actually came from
  // the namespace we're about to write. If a household failed to load, state
  // holds solo data (or a previous household's) and writing it would overwrite
  // the real thing — so refuse, and say so, rather than showing an edit that
  // is about to be destroyed or silently dropped.
  const persistNs = useCallback((field, value, setLocal, stored) => {
    const code = profileRef.current?.code ?? null;
    if (loadedCodeRef.current !== code) {
      setSyncError(
        code
          ? `Not synced with household ${code} yet — that change wasn't saved. ` +
            `It'll save normally once the household loads.`
          : "Still loading — that change wasn't saved. Try again in a moment.",
      );
      return;
    }
    setLocal(value);
    persist(nsKeys(code)[field], stored === undefined ? value : stored);
  }, [persist]);

  const persistPantry = useCallback((next) => persistNs("pantry", next, setPantry), [persistNs]);
  const persistMatches = useCallback((next) => persistNs("matches", next, setMatches), [persistNs]);
  const persistStaples = useCallback((next) => persistNs("staples", next, setStaples, { v: 27, items: next }), [persistNs]);
  const persistShopping = useCallback((next) => persistNs("shopping", next, setShopping), [persistNs]);
  const persistCooked = useCallback((next) => persistNs("cooked", next, setCooked), [persistNs]);
  const persistQuickEdits = useCallback((next) => persistNs("quick", next, setQuickEdits), [persistNs]);
  const persistDiet = useCallback((next) => persistNs("diet", next, setDiet), [persistNs]);

  const stockRef = useRef(stockCounts); stockRef.current = stockCounts;
  // learn what the household actually stocks: bump on pantry adds and shopping-list buys
  const bumpStock = useCallback((names, cats = {}) => {
    const next = { ...stockRef.current };
    for (const n of names) {
      const key = norm(n);
      const prev = next[key] || { name: n, cat: cats[n] || localGuess(n) || "other", n: 0 };
      next[key] = { ...prev, name: n, n: prev.n + 1 };
    }
    persistNs("stock", next, setStockCounts);
  }, [persistNs]);

  const resetSession = useCallback(() => {
    sessionRef.current++;
    setDeck([]); setSwipes([]); setSeen([]); setHistory([]); setExhausted(null);
  }, []);
  const softReset = useCallback(() => {
    sessionRef.current++;
    setDeck([]); setSeen([]); setExhausted(null);
  }, []);
  const resetSeen = useCallback(() => {
    sessionRef.current++;
    setSeen([]); setDeck([]); setExhausted(null);
  }, []);

  // pantry/staples/custom-recipes changed → current deck is stale; reshuffle against fresh data.
  // Signature covers active item names + staples + recipe count; mood (swipes) survives.
  const matchSig = [
    (pantry || []).map((p) => norm(p.name)).sort().join("|"),
    (staples || []).map(norm).sort().join("|"),
    allRecipes.length,
  ].join("§");
  const sigRef = useRef(null);
  useEffect(() => {
    if (pantry === null || staples === null) return;
    if (sigRef.current === null) { sigRef.current = matchSig; return; } // initial load
    if (sigRef.current !== matchSig) {
      sigRef.current = matchSig;
      softReset(); // clears deck + seen + exhausted; auto-deal effect rebuilds instantly
    }
  }, [matchSig, pantry, staples, softReset]);

  const createHousehold = async () => {
    try {
      let code = null;
      for (let i = 0; i < 8 && !code; i++) {
        const candidate = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + "-" + (10 + Math.floor(Math.random() * 90));
        if (!(await keyExists(`hh:${candidate}:meta`))) code = candidate;
      }
      if (!code) return "Couldn't generate a free code, try again.";
      const k = nsKeys(code);
      // Seed the household's data first; only claim the code once the writes
      // landed, so a half-written household can't be joined.
      await Promise.all([
        saveKey(k.pantry, pantryRef.current || []),
        saveKey(k.matches, matchesRef.current || []),
        saveKey(k.staples, { v: 27, items: staplesRef.current || STAPLES_LIST }),
        saveKey(k.shopping, shoppingRef.current || []),
        saveKey(k.cooked, cookedRef.current || []),
        saveKey(k.quick, quickEditsRef.current || { add: [], hide: [] }),
        saveKey(k.diet, dietRef.current || DIET_EGG_FREE),
      ]);
      await saveKey(`hh:${code}:meta`, { createdAt: Date.now() });
      // The writes above seeded this household *from* current state, so state
      // and namespace already agree — no reload needed before writes resume.
      loadedCodeRef.current = code;
      const prof = { code };
      setProfile(prof); await saveKey("simmer-profile", prof);
      setSyncError(null);
      resetSession();
      return null;
    } catch (e) {
      return msg(e);
    }
  };

  const joinHousehold = async (raw) => {
    const code = raw.trim().toUpperCase();
    if (!code) return "Enter a code.";
    try {
      // keyExists now throws if the server is unreachable, so a genuine
      // "false" here really does mean no such household.
      if (!(await keyExists(`hh:${code}:meta`))) return "Household not found. Check the code.";
      await loadNamespace(code);
      const prof = { code };
      setProfile(prof); await saveKey("simmer-profile", prof);
      setSyncError(null);
      resetSession();
      return null;
    } catch (e) {
      return msg(e);
    }
  };

  const leaveHousehold = async () => {
    const prof = { code: null };
    setProfile(prof); await saveKey("simmer-profile", prof);
    await loadNamespace(null).catch(() => {});
    setSyncError(null);
    resetSession();
  };

  const dealCards = useCallback(
    (currentSwipes, currentSeen, append, target = 20) => {
      const p = pantryRef.current || [], s = staplesRef.current || [];
      if (p.length === 0) return;
      setExhausted(null);
      const exclude = new Set(currentSeen.map((n) => n.toLowerCase()));
      const cards = pickFromRepo(allRecipesRef.current, {
        pantry: p, staples: s, mode, exclude, swipes: currentSwipes,
        cuisines: cuisinesRef.current, maxTime: maxTimeRef.current,
        mealType: mealTypeRef.current, count: target,
      });
      if (cards.length) {
        setSeen((sn) => [...sn, ...cards.map((c) => c.name)]);
        setDeck((d) => (append ? [...d, ...cards] : cards));
        return;
      }
      if (append) return; // topping up an existing deck; silence is fine
      // Nothing matched. Work out which single ingredient would unlock the
      // most recipes: look at recipes that are exactly one over the current
      // tolerance, and count how often each missing ingredient appears.
      const filterPass = allRecipes
        .filter((r) => { const w = cuisinesRef.current.map((c) => c.toLowerCase()); return !w.length || w.includes(r.cuisine); })
        .filter((r) => !maxTimeRef.current || r.minutes <= maxTimeRef.current)
        .filter((r) => servesMeal(r, mealTypeRef.current));
      const fits = filterPass.map((r) => computeFit(r, p, s));
      const threshold = mode === "strict" ? 0 : 2;
      const matchable = filterPass.filter((_, i) => fits[i].missing.length <= threshold).length;
      const counts = {};
      filterPass.forEach((r, i) => {
        if (fits[i].missing.length === threshold + 1) {
          for (const ing of fits[i].missing) counts[ing] = (counts[ing] || 0) + 1;
        }
      });
      const unlock = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      setExhausted({ matchable, unlock });
    },
    [mode]
  );

  useEffect(() => {
    if (tab === "swipe" && pantry?.length && deck.length === 0 && !exhausted) {
      dealCards(swipes, seen, false);
    }
  }, [tab, pantry, deck.length, exhausted, mode, cuisines, maxTime, mealType]);

  // Turning eggs off has to reach cards that were already dealt. Filtering the
  // pool only governs the *next* deal, so without this an egg recipe stays on
  // screen until it is swiped, and undo could even bring one back. Emptying the
  // deck here lets the effect above re-deal from the now-filtered pool.
  useEffect(() => {
    if (diet === "eggs") return;
    setDeck((d) => (d.some(usesEgg) ? d.filter((c) => !usesEgg(c)) : d));
    setHistory((h) => (h.some((e) => usesEgg(e.card)) ? h.filter((e) => !usesEgg(e.card)) : h));
  }, [diet]);

  const handleSwipe = useCallback(
    (card, dir) => {
      const nextSwipes = [...swipes, { name: card.name, cuisine: card.cuisine, dir }];
      setSwipes(nextSwipes);
      const nextDeck = deck.filter((c) => c.id !== card.id);
      setDeck(nextDeck);
      let savedAt = null;
      if (dir === "right") {
        savedAt = Date.now();
        const match = { ...card, savedAt };
        persistMatches([match, ...(matchesRef.current || [])]);
        setMatchFlash({ card, savedAt });
      }
      setHistory((h) => [...h.slice(-19), { card, dir, savedAt }]);
      if (nextDeck.length <= 8) dealCards(nextSwipes, seen, true, 10);
    },
    [swipes, deck, seen, dealCards, persistMatches]
  );

  const undoSwipe = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setDeck((d) => [{ ...last.card, id: uid() }, ...d]);
      setSwipes((s) => s.slice(0, -1));
      // Drop it from `seen` too. Putting the card back in the deck is not
      // enough on its own — `seen` is the exclude list for dealing, so without
      // this the card would vanish again on the next shuffle.
      setSeen((sn) => {
        const i = sn.lastIndexOf(last.card.name);
        return i === -1 ? sn : [...sn.slice(0, i), ...sn.slice(i + 1)];
      });
      if (last.dir === "right" && last.savedAt) {
        persistMatches((matchesRef.current || []).filter((m) => m.savedAt !== last.savedAt));
      }
      setMatchFlash(null);
      return h.slice(0, -1);
    });
  }, [persistMatches]);

  // Keep household data fresh across devices. Realtime (below) is the primary
  // path; this poll is the fallback for a dropped socket or a missed event, so
  // sync degrades to the old 20s behaviour rather than stopping.
  //
  // Still last-write-wins with no merge — a value edited on two devices at
  // once keeps whichever wrote last. Fine for a shared pantry; it would not be
  // for anything where a lost edit matters.
  useEffect(() => {
    const code = profile?.code;
    if (!code) return;
    // A failed refresh must leave state alone. Falling back to empty here and
    // then persisting a later edit would overwrite the household's real data.
    const refresh = () =>
      loadNamespace(code).then(
        () => setSyncError(null),
        (e) => setSyncError(msg(e)),
      );
    const iv = setInterval(refresh, 20000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [profile?.code, loadNamespace]);

  // Realtime: the other device's write arrives as a push, so a change shows up
  // in well under a second instead of waiting out the poll interval.
  //
  // On an event we refetch the whole namespace rather than applying the
  // payload directly. The payload would need the staples migration and the
  // shape handling in loadNamespace duplicated here to be applied safely, and
  // one code path for "load the household" is worth the extra round trip.
  //
  // Debounced because a single user action can touch several keys at once
  // (adding to the pantry also bumps stock counts), and createHousehold writes
  // five — without this that would be five refetches.
  useEffect(() => {
    const code = profile?.code;
    if (!code) return;
    const k = nsKeys(code);
    let timer = null;
    const unsubscribe = subscribeKeys(
      `hh:${code}`,
      [k.pantry, k.matches, k.staples, k.shopping, k.stock, k.cooked, k.quick, k.diet],
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          loadNamespace(code).then(() => setSyncError(null), (e) => setSyncError(msg(e)));
        }, 250);
      },
    );
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [profile?.code, loadNamespace]);

  useEffect(() => {
    if (!matchFlash) return;
    const t = setTimeout(() => setMatchFlash(null), 2200);
    return () => clearTimeout(t);
  }, [matchFlash]);

  if (profile === null || pantry === null || matches === null || staples === null) {
    return (
      <Shell tab={tab} setTab={setTab} matchCount={0} hhCode={null} onHousehold={() => {}} onAddRecipe={() => {}} onFavorites={() => {}} favCount={0} onCooked={() => {}} cookedCount={0}>
        <style>{FONTS}</style>
        <Center><p style={{ color: C.faint, animation: "pulse 1.4s infinite" }}>Warming up…</p></Center>
      </Shell>
    );
  }

  return (
    <Shell tab={tab} setTab={setTab} matchCount={matches.length} hhCode={profile.code} onHousehold={() => setHhOpen(true)} onAddRecipe={() => setRecipeSheet(true)} onFavorites={() => setFavSheet(true)} favCount={(matches || []).filter((m) => m.fav).length} onCooked={() => setCookedSheet(true)} cookedCount={(cooked || []).length}>
      <style>{FONTS}</style>
      {cookedSheet && (
        <CookedSheet
          cooked={cooked}
          onClose={() => setCookedSheet(false)}
          onCookAgain={(entry) => {
            // The recipe may have been cleared from matches; re-save it so it
            // can be opened, scaled and cooked again like any other match.
            const savedAt = Date.now();
            persistMatches([{ ...entry, savedAt, uses: [], missing: [] }, ...(matches || [])]);
            setOpenTarget(savedAt); setTab("matches"); setCookedSheet(false);
          }}
        />
      )}
      {favSheet && (
        <FavSheet
          matches={matches || []}
          onClose={() => setFavSheet(false)}
          onClearFavs={() => {
            // Un-hearting a normal match just drops the heart; it is still in
            // Matches. But a favourite that "clear matches" hid lives ONLY
            // here — un-hearting it would strand it with no way back, so it
            // is removed outright instead.
            persistMatches((matches || [])
              .filter((m) => !(m.fav && m.listHidden))
              .map((m) => (m.fav ? { ...m, fav: false } : m)));
          }}
          onOpen={(savedAt) => {
            // Opening a favourite that "clear" hid returns it to the list —
            // that is what "hidden until I view faves" resolves to.
            persistMatches((matches || []).map((m) => (m.savedAt === savedAt ? { ...m, listHidden: false } : m)));
            setOpenTarget(savedAt); setTab("matches");
          }}
        />
      )}
      {recipeSheet && (
        <RecipeSheet
          community={community}
          onSave={saveCommunity}
          onDelete={deleteCommunity}
          onClose={() => { setRecipeSheet(false); softReset(); }}
        />
      )}
      {hhOpen && (
        <HouseholdPanel
          syncError={syncError}
          code={profile.code} poolCount={community.length}
          diet={diet} onDiet={persistDiet}
          onCreate={createHousehold} onJoin={joinHousehold}
          onLeave={leaveHousehold} onClose={() => setHhOpen(false)}
        />
      )}
      {matchFlash && (
        <MatchFlash
          card={matchFlash.card}
          onUndo={undoSwipe}
          onCook={() => {
            setOpenTarget(matchFlash.savedAt);
            setMatchFlash(null);
            setTab("matches");
          }}
        />
      )}
      {tab === "pantry" && <PantryTab diet={diet} pantry={pantry} persist={persistPantry} staples={staples} persistStaples={persistStaples} shopping={shopping} persistShopping={persistShopping} matches={matches} stockCounts={stockCounts} bumpStock={bumpStock} quickEdits={quickEdits} persistQuickEdits={persistQuickEdits} />}
      {tab === "swipe" && (
        <SwipeTab
          pantry={pantry} deck={deck} exhausted={exhausted} onResetSeen={resetSeen}
          allRecipes={allRecipes} staples={staples} persistPantry={persistPantry}
          mode={mode} swipes={swipes} cuisines={cuisines} maxTime={maxTime} mealType={mealType}
          canUndo={history.length > 0} onUndo={undoSwipe}
          setCuisines={(next) => { setCuisines(next); softReset(); }}
          setMaxTime={(t) => { setMaxTime(t); softReset(); }}
          setMealType={(t) => { setMealType(t); softReset(); }}
          setMode={(m) => { setMode(m); softReset(); }}
          onDeal={() => dealCards(swipes, seen, false)}
          onSwipe={handleSwipe} onReset={resetSession}
          goPantry={() => setTab("pantry")}
        />
      )}
      {tab === "prep" && (
        <MealPrepTab
          pantry={pantry} staples={staples} allRecipes={allRecipes} mode={mode}
        />
      )}
      {tab === "matches" && (
        <MatchesTab
          matches={matches} persist={persistMatches} pantry={pantry} bumpStock={bumpStock}
          persistPantry={persistPantry} staples={staples}
          shopping={shopping} persistShopping={persistShopping}
          openTarget={openTarget} clearOpenTarget={() => setOpenTarget(null)}
          cooked={cooked} persistCooked={persistCooked}
        />
      )}
    </Shell>
  );
}

/* ----------------------------- Shell ------------------------------ */

function Shell({ tab, setTab, matchCount, hhCode, onHousehold, onAddRecipe, onFavorites, favCount, onCooked, cookedCount, children }) {
  const tabs = [
    { id: "pantry", label: "Pantry", emoji: "🧺" },
    { id: "swipe", label: "Swipe", emoji: "🔥" },
    { id: "matches", label: "Matches", emoji: "💚" },
    { id: "prep", label: "Meal prep", emoji: "🗓️" },
  ];
  return (
    <div style={{
      fontFamily: "'Outfit', sans-serif", background: C.bg, color: C.ink,
      height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <header style={{ padding: "10px 20px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        {/* The wordmark doubles as the way home. It is a button rather than
            an anchor because this is in-app navigation with no URL behind it,
            styled to look exactly as it did before. */}
        <button
          onClick={() => setTab("swipe")}
          aria-label="Simmer — back to swiping"
          style={{
            border: "none", padding: 0, cursor: "pointer",
            fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26, letterSpacing: "-0.02em",
            background: `linear-gradient(90deg, ${C.green}, ${C.gold})`,
            WebkitBackgroundClip: "text", backgroundClip: "text",
            WebkitTextFillColor: "transparent", color: "transparent",
            lineHeight: 1.1,
          }}
        >
          Simmer
        </button>
        <button onClick={onHousehold} style={{
          marginLeft: "auto", border: `1.5px solid ${hhCode ? C.green : C.line}`,
          background: hhCode ? C.greenSoft : "#fff", color: hhCode ? C.green : C.faint,
          borderRadius: 99, padding: "5px 11px", fontFamily: "inherit",
          fontWeight: 700, fontSize: 12, cursor: "pointer",
        }} aria-label={hhCode ? `Household ${hhCode}` : "Solo — tap to share a pantry"}>
          {hhCode ? "👥" : "👤"}
        </button>
        <button onClick={onAddRecipe} aria-label="Add recipe" style={{
          border: `1.5px solid ${C.line}`, background: "#fff", borderRadius: 99,
          padding: "6px 11px", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          cursor: "pointer", color: C.ink,
        }}>➕</button>
        <button onClick={onFavorites} aria-label="Favorites" style={{
          border: `1.5px solid ${favCount ? "#FF4466" : C.line}`,
          background: favCount ? "#FFF0F3" : "#fff", borderRadius: 99,
          padding: "6px 11px", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          cursor: "pointer", color: favCount ? "#FF4466" : C.faint,
        }}>♥</button>
        {/* Opens a sheet; it is not a toggle and has no selected state. It
            used to take a gold fill and border whenever anything had been
            cooked, which read as permanently switched on. Neutral now, matching
            the ➕ beside it; the count still shows as plain text. */}
        <button onClick={onCooked} aria-label="Cooked" style={{
          border: `1.5px solid ${C.line}`, background: "#fff", borderRadius: 99,
          padding: "6px 11px", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          cursor: "pointer", color: C.ink,
        }}>🍳{cookedCount ? ` ${cookedCount}` : ""}</button>
      </header>
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {children}
      </main>
      <nav style={{
        display: "flex", borderTop: `1px solid ${C.line}`, background: "#FFFFFFDD",
        backdropFilter: "blur(8px)", paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "9px 0 11px", border: "none", background: "transparent",
            cursor: "pointer", color: tab === t.id ? C.green : C.faint,
            fontFamily: "inherit", fontWeight: tab === t.id ? 800 : 500, fontSize: 12,
            borderTop: tab === t.id ? `2.5px solid ${C.green}` : "2.5px solid transparent",
            marginTop: -1, position: "relative",
          }}>
            <div style={{ fontSize: 18, marginBottom: 1, filter: tab === t.id ? "none" : "grayscale(.4)" }}>{t.emoji}</div>
            {t.label}
            {t.id === "matches" && matchCount > 0 && (
              <span style={{
                position: "absolute", top: 5, right: "25%",
                background: `linear-gradient(135deg, ${C.pink}, ${C.red})`, color: "#fff",
                borderRadius: 99, fontSize: 10, fontWeight: 800, padding: "1px 6px",
              }}>{matchCount}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

const Center = ({ children }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
    {children}
  </div>
);

/* --------------------------- match flash -------------------------- */

function MatchFlash({ card, onCook, onUndo }) {
  return (
    <div onClick={onCook} style={{
      position: "absolute", bottom: 72, left: 16, right: 16, zIndex: 60,
      background: C.green, borderRadius: 16, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: `0 8px 28px ${C.green}66`, cursor: "pointer",
      animation: "slideUp .25s ease",
    }}>
      <span style={{ fontSize: 28 }}>{card.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
          Saved! {card.name}
        </div>
        <div style={{ color: "#ffffffAA", fontSize: 11.5 }}>→ view recipe</div>
      </div>
      {onUndo && (
        // Sits inside a card whose whole surface opens the recipe, so this has
        // to stop the click travelling up, or undoing would also navigate.
        <button
          onClick={(e) => { e.stopPropagation(); onUndo(); }}
          aria-label="Undo this swipe"
          style={{
            border: "1.5px solid #ffffff88", background: "#ffffff22", color: "#fff",
            borderRadius: 99, padding: "5px 11px", fontFamily: "inherit",
            fontWeight: 800, fontSize: 12, cursor: "pointer", flexShrink: 0,
          }}
        >↩️ Undo</button>
      )}
      <span style={{ color: "#fff", fontSize: 18 }}>→</span>
    </div>
  );
}

/* ------------------------- household panel ------------------------ */

function HouseholdPanel({ code, poolCount, syncError, diet, onDiet, onCreate, onJoin, onLeave, onClose }) {
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const doCreate = async () => {
    setBusy(true); setErr(null);
    const e = await onCreate();
    setBusy(false);
    if (e) setErr(e);
  };
  const doJoin = async () => {
    setBusy(true); setErr(null);
    const e = await onJoin(joinCode);
    setBusy(false);
    if (e) setErr(e); else setJoinCode("");
  };

  return (
    <div style={{
      position: "absolute", inset: 0, background: "#1E2B2066", zIndex: 50,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 20px",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, padding: "20px 18px", width: "100%", maxWidth: 380,
        border: `1.5px solid ${C.line}`, boxShadow: "0 12px 40px rgba(30,43,32,.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20 }}>👥 Household</span>
          <button onClick={onClose} style={{
            marginLeft: "auto", border: "none", background: "#F3F1E8", borderRadius: "50%",
            width: 28, height: 28, cursor: "pointer", color: C.faint, fontSize: 14,
          }}>✕</button>
        </div>

        {!syncConfigured && (
          <p style={{
            background: C.redSoft, color: C.red, borderRadius: 10, padding: "10px 12px",
            fontSize: 13, fontWeight: 600, margin: "0 0 12px", lineHeight: 1.45,
          }}>
            {configError
              ? `Household sync is misconfigured — nothing will be shared. ${configError}`
              : "Household sync isn't set up for this build — nothing will be shared. " +
                "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy."}
          </p>
        )}

        {/* One icon, two states: a plain egg means eggs are in, a struck-out
            egg means they are out. Crossed out is the default. */}
        {(() => {
          const on = diet === "eggs";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <button
                onClick={() => onDiet(on ? DIET_EGG_FREE : "eggs")}
                role="switch"
                aria-checked={on}
                aria-label={on ? "Eggs allowed — tap to hide egg recipes" : "Eggs hidden — tap to allow egg recipes"}
                title={on ? "Eggs allowed" : "Eggs hidden"}
                style={{
                  position: "relative", width: 46, height: 46, flexShrink: 0,
                  borderRadius: 14, cursor: "pointer", padding: 0, lineHeight: 1,
                  border: `1.5px solid ${on ? C.green : C.line}`,
                  background: on ? C.greenSoft : "#F3F1E8",
                  fontSize: 22, transition: "background .15s ease, border-color .15s ease",
                }}
              >
                <span style={{ opacity: on ? 1 : 0.4, filter: on ? "none" : "grayscale(1)" }}>🥚</span>
                {/* The strike is drawn rather than typed: the combining
                    long-stroke character renders inconsistently across the
                    platforms this runs on. */}
                {!on && (
                  <span aria-hidden="true" style={{
                    position: "absolute", left: 9, right: 9, top: "50%",
                    height: 2.5, borderRadius: 2, background: C.red,
                    transform: "rotate(-45deg)",
                  }} />
                )}
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {on ? "Eggs are in" : "Eggs are out"}
                </div>
                <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.4 }}>
                  {on
                    ? `Egg recipes show up, and eggs are in quick add.${code ? " For everyone here." : ""}`
                    : "Egg recipes stay hidden everywhere."}
                </div>
              </div>
            </div>
          );
        })()}

        {code ? (
          <>
            <p style={{ fontSize: 14, color: C.faint, margin: "0 0 10px" }}>
              You're sharing a pantry and matches with household:
            </p>
            <div style={{
              background: `linear-gradient(135deg, ${C.greenSoft}, ${C.goldSoft})`,
              borderRadius: 12, padding: "12px 14px", textAlign: "center",
              fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 24, color: C.green,
              letterSpacing: "0.04em", marginBottom: 10,
            }}>{code}</div>
            <p style={{ fontSize: 12.5, color: C.faint, margin: "0 0 14px" }}>
              Share this code with your people. Anyone who enters it sees and edits the same pantry, staples, and matches, so only give it to your household.
            </p>
            <button onClick={onLeave} style={{
              width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.red}`,
              background: C.redSoft, color: C.red, fontFamily: "inherit", fontWeight: 700,
              fontSize: 14, cursor: "pointer",
            }}>Leave household (back to solo)</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: C.faint, margin: "0 0 14px" }}>
              You're in solo mode: your pantry is private to you. Create a household to share one pantry with your people, or join theirs with a code.
            </p>
            <button onClick={doCreate} disabled={busy || !syncConfigured} style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${C.green}, #0DA35C)`, color: "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
              marginBottom: 12, opacity: busy || !syncConfigured ? 0.6 : 1,
            }}>{busy ? "Working…" : "Create a household (takes your current pantry)"}</button>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doJoin()}
                placeholder="Enter code, e.g. MANGO-42"
                style={{
                  flex: 1, padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${C.line}`,
                  fontFamily: "inherit", fontSize: 14, outline: "none", color: C.ink,
                  textTransform: "uppercase",
                }}
              />
              <button onClick={doJoin} disabled={busy || !syncConfigured} style={{
                padding: "0 16px", borderRadius: 12, border: `1.5px solid ${C.green}`,
                background: "#fff", color: C.green, fontFamily: "inherit", fontWeight: 700,
                fontSize: 14, cursor: "pointer", opacity: busy || !syncConfigured ? 0.6 : 1,
              }}>Join</button>
            </div>
            <p style={{ fontSize: 12, color: C.faint, margin: "10px 0 0" }}>
              Household data is visible to everyone with the code.
            </p>
          </>
        )}
        {(err || syncError) && (
          <p style={{ color: C.red, fontSize: 13, fontWeight: 600, margin: "10px 0 0", lineHeight: 1.45 }}>
            {err || syncError}
          </p>
        )}
        {poolCount > 0 && (
          <p style={{ fontSize: 12, color: C.faint, margin: "12px 0 0", textAlign: "center" }}>
            📚 {poolCount} recipes in the community pool
          </p>
        )}
        {/* Which build this device is actually running. A device serving a
            stale service-worker cache shows an old id here, which is the
            fastest way to tell "bug" from "hasn't updated yet". */}
        <p style={{ fontSize: 11, color: C.line, margin: "10px 0 0", textAlign: "center" }}>
          build {__BUILD_ID__}
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Pantry tab --------------------------- */

/* ------------------------- Custom recipes ------------------------- */

const MEAL_IDS = ["breakfast", "lunch", "dinner", "dessert", "snack", "salad"];

function parseIngLine(line) {
  const t = line.trim();
  if (!t) return null;
  const m = t.match(/^(\d+\s*\/\s*\d+|\d*\.?\d+)?\s*(g|kg|ml|l|tbsp|tsp|cups?|inch|pinch|slices?|cans?)?\s+?(.*)$/i);
  if (!m || !m[3]) return [null, null, t];
  let qty = null;
  if (m[1]) {
    const frac = m[1].split("/");
    qty = frac.length === 2 ? Number(frac[0]) / Number(frac[1]) : Number(m[1]);
  }
  let unit = m[2] ? m[2].toLowerCase().replace(/^cups$/, "cup").replace(/^slices$/, "slice").replace(/^cans$/, "can") : null;
  return [qty, unit, m[3].trim()];
}

const coreFrom = (ing) =>
  ing
    .map(([, , name]) => name.split(",")[0].trim())
    .filter((n) => n && !ingInList(n, STAPLES_LIST));

const fieldStyle = {
  width: "100%", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${C.line}`,
  fontFamily: "inherit", fontSize: 14, background: "#fff", color: C.ink, marginBottom: 8,
};

function RecipeSheet({ community, onSave, onDelete, onClose }) {
  const empty = { name: "", cuisine: "", meal: "dinner", mins: "", serves: "2", emoji: "", desc: "", ing: "", steps: "", cal: "", p: "", c: "", f: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (r) => {
    setEditingId(r.repoId);
    setForm({
      name: r.name, cuisine: r.cuisine, meal: r.mealType, mins: String(r.minutes),
      serves: String(r.serves), emoji: r.emoji || "", desc: r.desc || "",
      ing: (r.ingFull || []).map(([q, u, n]) => [q, u, n].filter((x) => x != null && x !== "").join(" ")).join("\n"),
      steps: (r.steps || []).join("\n"),
      cal: r.macros ? String(r.macros.cal) : "", p: r.macros ? String(r.macros.p) : "",
      c: r.macros ? String(r.macros.c) : "", f: r.macros ? String(r.macros.f) : "",
    });
  };

  const save = async () => {
    setErr(null);
    const ing = form.ing.split("\n").map(parseIngLine).filter(Boolean);
    const steps = form.steps.split("\n").map((s) => s.trim()).filter(Boolean);
    const mins = parseInt(form.mins, 10), serves = parseInt(form.serves, 10);
    if (!form.name.trim()) return setErr("Give it a name.");
    if (!form.cuisine.trim()) return setErr("Pick or type a cuisine.");
    if (!mins || mins < 1) return setErr("Minutes must be a number.");
    if (!serves || serves < 1) return setErr("Servings must be at least 1.");
    if (ing.length < 1) return setErr("Add at least one ingredient (one per line).");
    if (steps.length < 2) return setErr("Add at least two steps (one per line).");
    const core = coreFrom(ing);
    if (!core.length) return setErr("Every ingredient is a staple — add at least one real ingredient so matching works.");
    const macros = [form.cal, form.p, form.c, form.f].every((v) => v.trim() !== "" && !isNaN(Number(v)))
      ? { cal: Number(form.cal), p: Number(form.p), c: Number(form.c), f: Number(form.f) }
      : null;
    const entry = {
      repoId: editingId || "cu" + Date.now(),
      name: form.name.trim(), cuisine: form.cuisine.trim().toLowerCase(),
      emoji: form.emoji.trim() || "🍲", minutes: mins, mealType: form.meal, mealTypes: [form.meal],
      desc: form.desc.trim() || "A household original.", tags: ["custom"],
      ingredients: core, serves, ingFull: ing, steps, macros, custom: true,
    };
    try {
      await onSave([entry]);
    } catch (e) {
      return setErr(msg(e)); // keep the form populated so nothing is retyped
    }
    setForm(empty); setEditingId(null);
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "88%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, flex: 1 }}>
            {editingId ? "Edit recipe" : "Add recipe"}
          </span>
          <button onClick={onClose} style={{ border: "none", background: "#F3F1E8", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.faint }}>✕</button>
        </div>
        <input style={fieldStyle} placeholder="Recipe name *" value={form.name} onChange={set("name")} />
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...fieldStyle, flex: 2 }} list="cuisine-opts" placeholder="Cuisine * (pick or type)" value={form.cuisine} onChange={set("cuisine")} />
          <datalist id="cuisine-opts">{CUISINE_OPTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          <input style={{ ...fieldStyle, flex: 1 }} placeholder="Emoji" value={form.emoji} onChange={set("emoji")} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...fieldStyle, flex: 1 }} value={form.meal} onChange={set("meal")}>
            {MEAL_IDS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input style={{ ...fieldStyle, flex: 1 }} placeholder="Minutes *" inputMode="numeric" value={form.mins} onChange={set("mins")} />
          <input style={{ ...fieldStyle, flex: 1 }} placeholder="Serves *" inputMode="numeric" value={form.serves} onChange={set("serves")} />
        </div>
        <input style={fieldStyle} placeholder="One-line description" value={form.desc} onChange={set("desc")} />
        <textarea style={{ ...fieldStyle, minHeight: 96 }} placeholder={"Ingredients, one per line *\ne.g.\n200 g paneer\n2 tbsp cream\nsalt"} value={form.ing} onChange={set("ing")} />
        <textarea style={{ ...fieldStyle, minHeight: 96 }} placeholder={"Steps, one per line * (at least 2)"} value={form.steps} onChange={set("steps")} />
        <div style={{ fontSize: 12, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", margin: "2px 0 6px" }}>Macros per serving (optional)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={fieldStyle} placeholder="kcal" inputMode="numeric" value={form.cal} onChange={set("cal")} />
          <input style={fieldStyle} placeholder="protein g" inputMode="numeric" value={form.p} onChange={set("p")} />
          <input style={fieldStyle} placeholder="carbs g" inputMode="numeric" value={form.c} onChange={set("c")} />
          <input style={fieldStyle} placeholder="fat g" inputMode="numeric" value={form.f} onChange={set("f")} />
        </div>
        {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 700, margin: "4px 0 8px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={save} style={{ ...btnPrimary, flex: 1 }}>{editingId ? "Save changes" : "Add recipe"}</button>
          {editingId && (
            <button onClick={() => { setForm(empty); setEditingId(null); }} style={{
              padding: "12px 16px", borderRadius: 14, border: `1.5px solid ${C.line}`, background: "#fff",
              color: C.faint, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Cancel</button>
          )}
        </div>

        {community.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.06em", margin: "18px 0 8px" }}>
              🏠 Custom recipes ({community.length})
            </div>
            {community.map((r) => (
              <div key={r.repoId} style={{
                display: "flex", alignItems: "center", gap: 10, background: "#fff",
                border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "9px 12px", marginBottom: 6,
              }}>
                <span style={{ fontSize: 20 }}>{r.emoji}</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: C.faint, textTransform: "capitalize" }}>{r.cuisine} · {r.minutes} min · serves {r.serves}</div>
                </span>
                <button onClick={() => startEdit(r)} aria-label={`Edit ${r.name}`} style={{ border: "none", background: "#F3F1E8", borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13 }}>✏️</button>
                <button onClick={() => onDelete(r.repoId).catch((e) => setErr(msg(e)))} aria-label={`Delete ${r.name}`} style={{ border: "none", background: C.redSoft, color: C.red, borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}


// Recipes actually cooked, newest first. Deliberately separate from matches:
// clearing matches must not erase what you've cooked, so this holds its own
// snapshot and survives independently.
function CookedSheet({ cooked, onClose, onCookAgain }) {
  const when = (ts) => {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} wk ago`;
    return `${Math.floor(days / 30)} mo ago`;
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "80%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, flex: 1, color: "#9A6700" }}>🍳 Cooked</span>
          <button onClick={onClose} style={{ border: "none", background: "#F3F1E8", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.faint }}>✕</button>
        </div>
        {cooked.length === 0 ? (
          <p style={{ color: C.faint, fontSize: 14, textAlign: "center", padding: "20px 0" }}>
            Nothing cooked yet. Tap “✓ Cooked it” on a saved recipe and it lands here — even if you clear your matches.
          </p>
        ) : (
          cooked.map((c) => (
            <button key={c.repoId || c.name} onClick={() => onCookAgain(c)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 12,
              padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.faint, textTransform: "capitalize" }}>
                  {c.cuisine} · {when(c.lastCookedAt)}{c.times > 1 ? ` · cooked ${c.times}×` : ""}
                </div>
              </div>
              <span style={{ color: "#9A6700", fontSize: 12, fontWeight: 800 }}>Cook again →</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function FavSheet({ matches, onClose, onOpen, onClearFavs }) {
  const favs = matches.filter((m) => m.fav);
  const clear = () => {
    if (!window.confirm(
      `Remove all ${favs.length} favourite${favs.length === 1 ? "" : "s"}? The recipes stay in Matches unless they were already cleared from there.`,
    )) return;
    onClearFavs();
    onClose();
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "80%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, color: "#FF4466" }}>♥ Favorites</span>
          {favs.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: C.faint }}>{favs.length}</span>
          )}
          <span style={{ flex: 1 }} />
          {favs.length > 0 && (
            <button onClick={clear} style={{
              border: `1.5px solid ${C.line}`, background: "#fff", color: C.faint,
              borderRadius: 99, padding: "5px 12px", marginRight: 8,
              fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>Clear</button>
          )}
          <button onClick={onClose} style={{ border: "none", background: "#F3F1E8", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.faint }}>✕</button>
        </div>
        {favs.length === 0 ? (
          <p style={{ color: C.faint, fontSize: 14, textAlign: "center", padding: "20px 0" }}>
            No favorites yet. Tap ♡ on a saved recipe to add it here.
          </p>
        ) : (
          favs.map((m) => (
            <button key={m.savedAt} onClick={() => { onOpen(m.savedAt); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 12,
              padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 22 }}>{m.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.faint, textTransform: "capitalize" }}>{m.cuisine} · {m.minutes} min</div>
              </div>
              <span style={{ color: "#FF4466", fontSize: 16 }}>→</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PantryTab({ diet, pantry, persist, staples, persistStaples, shopping, persistShopping, matches, stockCounts, bumpStock, quickEdits, persistQuickEdits }) {
  const [subTab, setSubTab] = useState("items");
  const [name, setName] = useState("");
  const [listAdd, setListAdd] = useState("");
  const [search, setSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(pantry.length === 0);
  const [quickEditing, setQuickEditing] = useState(false);
  const [quickNew, setQuickNew] = useState("");
  const { toast, setToast, showToast } = useToast();
  const pantryRef = useRef(pantry);
  pantryRef.current = pantry;
  const shoppingRef = useRef(shopping);
  shoppingRef.current = shopping;

  const addNames = (names) => {
    const cleaned = names.map((s) => s.trim()).filter(Boolean)
      .filter((n) => !pantry.some((p) => p.name.toLowerCase() === n.toLowerCase()));
    if (!cleaned.length) return;
    const base = Date.now();
    const newItems = cleaned.map((n, i) => {
      const guess = localGuess(n);
      return { id: base + i, name: n, cat: guess || "other", useSoon: false };
    });
    persist([...newItems, ...pantry]);
    bumpStock(cleaned, Object.fromEntries(newItems.map((it) => [it.name, it.cat])));
    // "Use soon" used to be offered after selecting an item. Selecting is gone
    // — tapping removes — so it is offered here, at the only other moment the
    // user is thinking about a specific item.
    if (newItems.length === 1) {
      const only = newItems[0];
      showToast(`✓ ${only.name} added`, { label: "⏰ use soon", fn: () => toggleSoon(only.id) });
    } else {
      showToast(`✓ ${newItems.length} added`);
    }
  };

  const add = () => { addNames(name.split(",")); setName(""); };

  const addToShopping = (itemName, from = null) => {
    const cur = shoppingRef.current;
    if (cur.some((s) => norm(shopName(s)) === norm(itemName))) {
      showToast(`${itemName} already on the list 🛒`);
      return;
    }
    persistShopping([...cur, { n: itemName, from }]);
    showToast(`${itemName} → shopping list 🛒`);
  };
  const onList = (n) => shopping.some((s) => norm(shopName(s)) === norm(n));
  const isStaple = (n) => staples.some((s) => norm(s) === norm(n));
  const hidden = (n) => onList(n) || isStaple(n);

  const toggleSoon = (id) => persist(pantryRef.current.map((p) => (p.id === id ? { ...p, useSoon: !p.useSoon } : p)));

  // Staples are the "assume I always have this" list, so promoting an item
  // moves it rather than copying it — a name in both would be matched twice
  // and shown in neither place consistently.
  const makeStaple = (item) => {
    if (staples.some((x) => norm(x) === norm(item.name))) {
      showToast(`${item.name} is already a staple`);
      return;
    }
    persistStaples([...staples, item.name]);
    persist(pantryRef.current.filter((x) => x.id !== item.id));
    showToast(`${item.name} → staples 🧂`);
  };
  // Deselecting is removal: the pantry lists what you have, nothing more.
  // Anything in the quick-add catalogue reappears there straight away.
  const removeItem = (id) => {
    const item = pantryRef.current.find((p) => p.id === id);
    persist(pantryRef.current.filter((p) => p.id !== id));
    if (item) showToast(`${item.name} removed`);
  };

  const inPantry = (n) => pantry.some((p) => p.name.toLowerCase() === n.toLowerCase());
  // Quick add is strictly a shortcut for things you don't have yet. Once an
  // item is in the pantry it lives in the main list and only there, so it
  // can't be in two places showing two different states.
  // NB: `hidden` is also what filters the main list, so this stays separate —
  // folding inPantry into it would empty the pantry list entirely.
  const qAdd = quickEdits?.add || [];
  const qHide = quickEdits?.hide || [];
  const isHiddenSuggestion = (n) => qHide.some((x) => norm(x) === norm(n));
  const inQuickAdd = (n) => !hidden(n) && !inPantry(n) && !isHiddenSuggestion(n);

  const hideSuggestion = (n) => {
    persistQuickEdits({ add: qAdd.filter((x) => norm(x) !== norm(n)), hide: [...qHide, n] });
    showToast(`${n} hidden from quick add`);
  };
  const addSuggestion = (raw) => {
    const names = raw.split(",").map((x) => x.trim()).filter(Boolean)
      .filter((n) => !qAdd.some((x) => norm(x) === norm(n)));
    if (!names.length) return;
    persistQuickEdits({ add: [...qAdd, ...names], hide: qHide.filter((h) => !names.some((n) => norm(n) === norm(h))) });
    showToast(`${names.length === 1 ? names[0] : `${names.length} items`} → quick add`);
  };
  const restoreSuggestions = () => {
    persistQuickEdits({ add: qAdd, hide: [] });
    showToast("Hidden suggestions restored");
  };
  const q = search.trim().toLowerCase();
  const grouped = CATEGORIES.map((c) => ({
    ...c, items: pantry.filter((p) =>
      p.cat === c.id &&
      !hidden(p.name) &&
      (!q || p.name.toLowerCase().includes(q))
    ),
  })).filter((g) => g.items.length);

  const stockedNames = pantry.map((p) => p.name);

  const gotIt = (g) => {
    // Clearing the shopping list happens on every path — you bought it, so it
    // comes off the list whether or not anything else needed changing.
    if (g.manual) persistShopping(shopping.filter((s) => norm(shopName(s)) !== norm(g.ing)));

    // Back to where it was swiped from. Anything added by hand has no origin
    // and defaults to the pantry.
    if (g.from === "staples") {
      if (!isStaple(g.ing)) persistStaples([...staples, g.ing]);
      showToast(`✓ ${g.ing} → staples 🧂`);
      return;
    }
    if (isStaple(g.ing)) { showToast(`✓ ${g.ing} restocked (staple)`); return; }
    if (pantry.some((p) => p.name.toLowerCase() === g.ing.toLowerCase())) {
      showToast(`${g.ing} is already in your pantry`);
      return;
    }
    const guess = localGuess(g.ing);
    persist([{ id: Date.now(), name: g.ing, cat: guess || "other", useSoon: false }, ...pantry]);
    bumpStock([g.ing]);
    showToast(`✓ ${g.ing} → pantry`);
  };
  const addListItems = () => {
    const items = listAdd.split(",").map((s) => s.trim()).filter(Boolean)
      .filter((n) => !shopping.some((s) => norm(shopName(s)) === norm(n)));
    if (items.length) persistShopping([...shopping, ...items.map((n) => ({ n, from: null }))]);
    setListAdd("");
  };

  const subTabs = [
    { id: "items", label: `🧺 Pantry` },
    { id: "staples", label: `🧂 Staples` },
    { id: "list", label: `🛒 List${shopping.length ? ` (${shopping.length})` : ""}` },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px" }}>
      <Toast toast={toast} setToast={setToast} />

      <div style={{ display: "flex", background: "#F0EDE2", borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, border: "none", borderRadius: 10, padding: "8px 0", fontSize: 13,
            fontFamily: "inherit", fontWeight: 700, cursor: "pointer",
            background: subTab === t.id ? "#fff" : "transparent",
            color: subTab === t.id ? C.ink : C.faint,
            boxShadow: subTab === t.id ? "0 1px 4px rgba(0,0,0,.12)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === "items" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add items: spinach, rice, paneer…"
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.line}`,
                fontFamily: "inherit", fontSize: 15, background: "#fff", outline: "none", color: C.ink,
              }}
            />
            <button onClick={add} style={{
              padding: "0 18px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${C.green}, #0DA35C)`,
              color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}>Add</button>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "center" }}>
            <button onClick={() => setQuickOpen(!quickOpen)} style={toolbarBtn(C.green)}>
              ⚡ Quick add {quickOpen ? "▴" : "▾"}
            </button>
          </div>

          {quickOpen && (
            <div style={{
              background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 14,
              padding: "10px 12px", marginBottom: 12, animation: "slideDown .15s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.faint, fontWeight: 600, flex: 1 }}>
                  {quickEditing ? "Tap an item to hide it from quick add" : "Tap to add · swipe right → shopping list"}
                </span>
                <button onClick={() => { setQuickEditing((v) => !v); setQuickNew(""); }} style={{
                  border: `1.5px solid ${quickEditing ? C.green : C.line}`,
                  background: quickEditing ? C.greenSoft : "#fff",
                  color: quickEditing ? C.green : C.faint, borderRadius: 99, padding: "4px 11px",
                  fontFamily: "inherit", fontWeight: 700, fontSize: 11.5, cursor: "pointer",
                }}>{quickEditing ? "Done" : "Edit"}</button>
              </div>

              {quickEditing && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={quickNew}
                      onChange={(e) => setQuickNew(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addSuggestion(quickNew); setQuickNew(""); } }}
                      placeholder="Add to quick add, e.g. paneer, curry leaves"
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.line}`,
                        fontFamily: "inherit", fontSize: 13, background: "#fff", outline: "none", color: C.ink,
                      }}
                    />
                    <button onClick={() => { addSuggestion(quickNew); setQuickNew(""); }} style={{
                      padding: "0 14px", borderRadius: 10, border: "none", background: C.green,
                      color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer",
                    }}>Add</button>
                  </div>
                  {qHide.length > 0 && (
                    <button onClick={restoreSuggestions} style={{
                      marginTop: 6, border: "none", background: "transparent", color: C.faint,
                      fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
                    }}>restore {qHide.length} hidden</button>
                  )}
                </div>
              )}

              {(() => {
                // Built-in suggestions, plus anything stocked 3+ times (learned
                // from behaviour), plus whatever the user added by hand.
                // Eggs only appear in the catalogue once the household has
                // opted in; anyone already carrying them keeps them, since the
                // pantry list is separate from these suggestions.
                const catalogue = QUICK_ADD.map((g) => (
                  g.cat === "protein" && diet === "eggs"
                    ? { ...g, items: [...EGG_PANTRY, ...g.items] }
                    : g
                ));
                const staticNorms = new Set(catalogue.flatMap((g) => g.items.map((n) => norm(n))));
                const learned = Object.values(stockCounts || {})
                  .filter((e) => e.n >= 3 && !staticNorms.has(norm(e.name)))
                  .sort((a, b) => b.n - a.n)
                  .slice(0, 15);
                const extras = {};
                for (const e of learned) (extras[e.cat] = extras[e.cat] || []).push(e.name);
                for (const n of qAdd) {
                  if (staticNorms.has(norm(n))) continue;
                  const cat = localGuess(n) || "other";
                  (extras[cat] = extras[cat] || []).unshift(n);
                }
                return catalogue.map((g) => ({ ...g, items: [...(extras[g.cat] || []), ...g.items] }));
              })().map((g) => {
                const meta = CATEGORIES.find((c) => c.id === g.cat);
                if (!g.items.some((n) => inQuickAdd(n))) return null;
                return (
                  <div key={g.cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {g.items.filter(inQuickAdd).map((n) => (
                        // Always "new" here — anything already in the pantry is
                        // filtered out above, so a normal tap only ever adds.
                        <SmartChip
                          key={n}
                          p={{ name: n, useSoon: false }}
                          isNew
                          prefix={quickEditing ? "− " : "+ "}
                          onTap={() => (quickEditing ? hideSuggestion(n) : addNames([n]))}
                          onSwipeRight={quickEditing ? undefined : () => addToShopping(n)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pantry.length > 10 && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search pantry…"
              style={{
                width: "100%", padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.line}`,
                fontFamily: "inherit", fontSize: 13.5, background: "#fff", outline: "none",
                color: C.ink, marginBottom: 12,
              }}
            />
          )}

          {pantry.length === 0 && !quickOpen && (
            <Center>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🧺</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Your pantry is empty</p>
              <p style={{ color: C.faint, fontSize: 14 }}>
                Add what you have — recipes match to your pantry.
              </p>
            </Center>
          )}

          {pantry.length > 0 && (
            <p style={{ fontSize: 11.5, color: C.faint, margin: "0 0 10px", lineHeight: 1.5 }}>
              Tap to remove · swipe right → shopping list · long-press → staples
            </p>
          )}

          {grouped.map((g) => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                {g.emoji} {g.label} · {g.items.length}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {g.items.map((p) => (
                  <SmartChip
                    key={p.id}
                    p={p}
                    onTap={() => removeItem(p.id)}
                    onSwipeRight={() => addToShopping(p.name, "pantry")}
                    onLongPress={() => makeStaple(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "staples" && (
        <StaplesEditor
          staples={staples}
          persistStaples={persistStaples}
          onShop={(name) => addToShopping(name, "staples")}
          onRemoved={(s) => showToast(`${s} → quick add`)}
        />
      )}

      {subTab === "list" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={listAdd}
              onChange={(e) => setListAdd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addListItems()}
              placeholder="Add to list: coconut milk, limes…"
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.line}`,
                fontFamily: "inherit", fontSize: 15, background: "#fff", outline: "none", color: C.ink,
              }}
            />
            <button onClick={addListItems} style={{
              padding: "0 18px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${C.pink}, #F04368)`,
              color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}>Add</button>
          </div>
          {shopping.length === 0 ? (
            <Center>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>List is empty</p>
              <p style={{ color: C.faint, fontSize: 13 }}>
                Add items above or tap "Add to list" on a saved recipe.
              </p>
            </Center>
          ) : (
            <>
            <p style={{ fontSize: 11, color: C.faint, margin: "0 0 8px", lineHeight: 1.5 }}>
              Tap when you've bought it · long-press to drop it from the list
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {shopping.map((entry) => {
                const item = shopName(entry);
                const from = shopFrom(entry);
                return (
                  <SmartChip
                    key={item}
                    p={{ name: item, useSoon: false }}
                    prefix={from === "staples" ? "🧂 " : ""}
                    onTap={() => gotIt({ ing: item, from, manual: true })}
                    onLongPress={() => {
                      persistShopping(shopping.filter((s) => norm(shopName(s)) !== norm(item)));
                      showToast(`${item} removed from list`);
                    }}
                  />
                );
              })}
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SmartChip({ p, isNew, prefix, onTap, onSwipeRight, onLongPress }) {
  const [dx, setDx] = useState(0);
  const startX = useRef(null);
  const movedRef = useRef(false);
  const handledRef = useRef(0);
  const longTimer = useRef(null);
  const longFired = useRef(false);
  const THRESHOLD = 52;
  const LONG_PRESS_MS = 500;

  // A long press must not also register as a tap when the finger lifts, so it
  // sets longFired and every release path checks it.
  const cancelLongPress = () => clearTimeout(longTimer.current);
  useEffect(() => () => clearTimeout(longTimer.current), []);

  const finish = (d) => {
    handledRef.current = Date.now();
    setDx(0);
    startX.current = null;
    if (d >= THRESHOLD) onSwipeRight?.();
    else if (!movedRef.current) onTap?.();
  };

  const down = (e) => {
    startX.current = e.clientX;
    movedRef.current = false;
    longFired.current = false;
    if (onLongPress) {
      cancelLongPress();
      longTimer.current = setTimeout(() => {
        if (movedRef.current || startX.current === null) return; // became a swipe
        longFired.current = true;
        handledRef.current = Date.now(); // suppress the click that follows
        setDx(0);
        onLongPress();
      }, LONG_PRESS_MS);
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    if (startX.current === null) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 8) { movedRef.current = true; cancelLongPress(); }
    if (longFired.current || !onSwipeRight) return;
    setDx(Math.max(0, Math.min(d, 84)));
  };
  const up = () => {
    cancelLongPress();
    if (longFired.current) { startX.current = null; setDx(0); return; }
    if (startX.current !== null) finish(dx);
  };
  const cancel = () => { cancelLongPress(); startX.current = null; setDx(0); };
  const click = () => {
    // fallback for webviews that never fire pointerup
    if (longFired.current || Date.now() - handledRef.current < 500) return;
    setDx(0); startX.current = null;
    onTap?.();
  };

  const armed = dx >= THRESHOLD;
  const pull = Math.min(dx / THRESHOLD, 1);

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}>
      {onSwipeRight && dx > 5 && (
        <span style={{
          position: "absolute", left: 3, top: "50%",
          transform: `translateY(-50%) scale(${0.6 + pull * 0.5})`,
          opacity: pull, fontSize: 15, zIndex: 0, pointerEvents: "none",
        }}>🛒</span>
      )}
      <button
        type="button"
        onClick={click}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          padding: "6px 12px", borderRadius: 99, fontSize: 13.5, fontFamily: "inherit",
          fontWeight: isNew ? 500 : 600, cursor: "pointer", position: "relative", zIndex: 1,
          userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          touchAction: "pan-y",
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform .18s ease, background .12s ease, border-color .12s ease" : "none",
          // Every chip shown is something you actually have (or, in quick add,
          // something you could add). There is no "deselected but still
          // listed" state any more — deselecting removes the item — so nothing
          // is greyed or struck through. "Use soon" keeps its accent; it is a
          // real signal rather than a restatement of the default.
          border: armed ? `1.5px solid ${C.pink}` : p.useSoon ? `1.5px solid ${C.gold}` : `1.5px solid ${C.line}`,
          background: armed ? "#FFF0F3" : p.useSoon ? C.goldSoft : "#fff",
          color: armed ? C.pink : p.useSoon ? "#9A6700" : C.ink,
        }}>
        {prefix ?? (isNew ? "+ " : p.useSoon ? "⏰ " : "")}{p.name}
        {p.sorting && <span style={{ fontSize: 10, marginLeft: 4, animation: "pulse 1.2s infinite" }}>…</span>}
      </button>
    </span>
  );
}

const toolbarBtn = (color) => ({
  border: "none", background: "transparent", color, fontFamily: "'Outfit', sans-serif",
  fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0,
});

function StaplesEditor({ staples, persistStaples, onShop, onRemoved }) {
  const [adding, setAdding] = useState("");
  // Demoting a staple puts it back in the quick-add catalogue, which happens
  // for free: `hidden()` filters staples out of quick add, so dropping it here
  // makes it selectable again.
  const removeStaple = (s) => { persistStaples(staples.filter((x) => x !== s)); onRemoved?.(s); };
  const addStaple = () => {
    const items = adding.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      .filter((x) => !staples.includes(x));
    if (items.length) persistStaples([...staples, ...items]);
    setAdding("");
  };

  const grouped = STAPLE_CATS.map((cat) => ({
    ...cat,
    items: staples.filter((s) => stapleCategory(s) === cat.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{
      background: C.goldSoft, border: `1.5px dashed ${C.gold}88`,
      borderRadius: 14, padding: "12px 14px",
    }}>
      <p style={{ fontSize: 11, color: "#9A6700", margin: "0 0 8px", lineHeight: 1.5 }}>
        Assumed always in stock. Swipe right → shopping list · long-press → back to quick add
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={() => persistStaples(STAPLES_LIST)} style={{
          border: "none", background: "transparent", color: C.faint,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
        }}>restore defaults</button>
      </div>
      {grouped.map((g) => (
        <div key={g.id} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9A6700", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {g.emoji} {g.label}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {g.items.map((s) => (
              <SmartChip
                key={s}
                p={{ name: s, useSoon: false }}
                prefix=""
                onSwipeRight={() => onShop?.(s)}
                onLongPress={() => removeStaple(s)}
              />
            ))}
          </div>
        </div>
      ))}
      {staples.length === 0 && (
        <span style={{ fontSize: 13, color: C.faint }}>No staples assumed.</span>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStaple()}
          placeholder="Add a staple, e.g. coconut oil"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.line}`,
            fontFamily: "inherit", fontSize: 13, background: "#fff", outline: "none", color: C.ink,
          }}
        />
        <button onClick={addStaple} style={{
          padding: "0 14px", borderRadius: 10, border: "none", background: C.gold,
          color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>Add</button>
      </div>
    </div>
  );
}

/* ---------------------------- Swipe tab --------------------------- */

function SwipeTab({ pantry, deck, exhausted, onResetSeen, allRecipes, staples, persistPantry, mode, swipes, cuisines, maxTime, mealType, canUndo, onUndo, setCuisines, setMaxTime, setMealType, setMode, onDeal, onSwipe, onReset, goPantry }) {
  const addToPantry = (name) => {
    const existing = pantry.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return; // already have it
    persistPantry([{ id: Date.now(), name, cat: localGuess(name) || "other", useSoon: false }, ...pantry]);
  };
  const [openFilter, setOpenFilter] = useState(null);
  const toggleCuisine = (c) =>
    setCuisines(cuisines.includes(c) ? cuisines.filter((x) => x !== c) : [...cuisines, c]);

  if (pantry.length === 0) {
    return (
      <Center>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🥕</div>
        <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
          First, stock the pantry
        </p>
        <p style={{ color: C.faint, fontSize: 14, marginBottom: 16, maxWidth: 260 }}>
          Add ingredients to your pantry and recipes will appear here.
        </p>
        <button onClick={goPantry} style={btnPrimary}>Open pantry</button>
      </Center>
    );
  }

  const meal = MEAL_OPTIONS.find((m) => m.id === mealType);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{
        display: "flex", gap: 6, overflowX: "auto", padding: "2px 20px 8px",
        scrollbarWidth: "none", WebkitOverflowScrolling: "touch", flexShrink: 0, alignItems: "center",
      }}>
        <ModeToggle mode={mode} setMode={setMode} />
        <FilterBtn
          active={!!mealType} color={C.pink}
          label={meal ? `${meal.emoji} ${meal.label}` : "🍽 Meal"}
          onClick={() => setOpenFilter(openFilter === "meal" ? null : "meal")}
        />
        <FilterBtn
          active={cuisines.length > 0} color={C.green}
          label={cuisines.length ? `🌍 ${cuisines.length} cuisine${cuisines.length > 1 ? "s" : ""}` : "🌍 Cuisine"}
          onClick={() => setOpenFilter(openFilter === "cuisine" ? null : "cuisine")}
        />
        <FilterBtn
          active={!!maxTime} color={C.gold}
          label={maxTime ? `⏱ ≤${maxTime}m` : "⏱ Time"}
          onClick={() => setOpenFilter(openFilter === "time" ? null : "time")}
        />
      </div>

      {openFilter && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 30 }} onClick={() => setOpenFilter(null)} />
          <div style={{
            position: "absolute", top: 42, left: 16, right: 16, zIndex: 31,
            background: "#fff", borderRadius: 16, border: `1.5px solid ${C.line}`,
            boxShadow: "0 14px 44px rgba(30,43,32,.22)", padding: "14px 14px 12px",
            animation: "slideDown .15s ease",
          }}>
            {openFilter === "meal" && (
              <>
                <PopTitle>Meal</PopTitle>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <PopChip on={!mealType} color={C.pink} onClick={() => { setMealType(null); setOpenFilter(null); }}>Any</PopChip>
                  {MEAL_OPTIONS.map((m) => (
                    <PopChip key={m.id} on={mealType === m.id} color={C.pink}
                      onClick={() => { setMealType(mealType === m.id ? null : m.id); setOpenFilter(null); }}>
                      {m.emoji} {m.label}
                    </PopChip>
                  ))}
                </div>
              </>
            )}
            {openFilter === "cuisine" && (
              <>
                <PopTitle>Cuisines</PopTitle>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <PopChip on={cuisines.length === 0} color={C.green} onClick={() => setCuisines([])}>Any</PopChip>
                  {CUISINE_OPTIONS.map((c) => (
                    <PopChip key={c} on={cuisines.includes(c)} color={C.green} onClick={() => toggleCuisine(c)}>{c}</PopChip>
                  ))}
                </div>
                <button onClick={() => setOpenFilter(null)} style={{ ...btnPrimary, width: "100%", padding: "10px 0", fontSize: 14 }}>Done</button>
              </>
            )}
            {openFilter === "time" && (
              <>
                <PopTitle>Time</PopTitle>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <PopChip on={!maxTime} color={C.gold} onClick={() => { setMaxTime(null); setOpenFilter(null); }}>Any</PopChip>
                  {TIME_OPTIONS.map((t) => (
                    <PopChip key={t} on={maxTime === t} color={C.gold}
                      onClick={() => { setMaxTime(maxTime === t ? null : t); setOpenFilter(null); }}>
                      ⏱ ≤{t} min
                    </PopChip>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* What this session is leaning toward, read off the right-swipes.
          Shows from the first one and lists up to four cuisines, most-swiped
          first. Hidden when a manual cuisine filter is on — the deck is then
          following that, not a mood. */}
      {(() => {
        if (cuisines.length || deck.length === 0) return null;
        const counts = {};
        for (const s of swipes) if (s.dir === "right" && s.cuisine) counts[s.cuisine.toLowerCase()] = (counts[s.cuisine.toLowerCase()] || 0) + 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
        if (!top.length) return null;
        return (
          <div style={{ textAlign: "center", fontSize: 12, color: C.faint, fontWeight: 700, padding: "0 20px 4px", flexShrink: 0, lineHeight: 1.4 }}>
            🔥 Vibing <span style={{ color: C.ink, textTransform: "capitalize" }}>{top.join(" · ")}</span>
          </div>
        );
      })()}
      <div style={{ flex: 1, position: "relative", margin: "2px 16px 12px" }}>
{(deck.length === 0 && !exhausted) && (
          <Center>
            <div style={{ fontSize: 36, animation: "pulse 1.2s infinite" }}>🔥</div>
            <p style={{ color: C.faint, fontSize: 13, marginTop: 8 }}>Finding recipes…</p>
          </Center>
        )}
        {deck.length === 0 && exhausted && (
          <div style={{
            position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "24px 20px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            {exhausted.matchable > 0 ? (
              <>
                <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19, marginBottom: 6 }}>
                  You've seen all {exhausted.matchable} matching recipes
                </p>
                <p style={{ color: C.faint, fontSize: 13.5, maxWidth: 260, marginBottom: 14 }}>
                  Shuffle back, adjust filters, or add an ingredient.
                </p>
                <button onClick={onResetSeen} style={{ ...btnPrimary, marginBottom: 14 }}>🔄 Shuffle them back in</button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19, marginBottom: 6 }}>
                  No recipes match yet
                </p>
                <p style={{ color: C.faint, fontSize: 13.5, maxWidth: 260, marginBottom: 14 }}>
                  {mode === "strict" ? "Loosen a filter or add an ingredient:" : "Loosen a filter or add an ingredient:"}
                </p>
              </>
            )}
            <div style={{ width: "100%", maxWidth: 280 }}>
              {mode === "strict" && (
                <button onClick={() => setMode("flexible")} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.green}`,
                  background: C.greenSoft, color: C.green, fontFamily: "inherit", fontWeight: 700,
                  fontSize: 13, cursor: "pointer", marginBottom: 10, textAlign: "left",
                }}>💡 Switch to ±2 for recipes needing 1-2 extra items</button>
              )}
              {exhausted.unlock?.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    🔓 Add & unlock
                  </div>
                  {exhausted.unlock.slice(0, 2).map((u) => (
                    <button key={u.name} onClick={() => addToPantry(u.name)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 12,
                      padding: "9px 12px", marginBottom: 6, fontSize: 13.5,
                      fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                    }}>
                      <span style={{ fontWeight: 700, textTransform: "capitalize" }}>+ {u.name}</span>
                      <span style={{ color: C.green, fontWeight: 800 }}>+{u.count} recipe{u.count > 1 ? "s" : ""}</span>
                    </button>
                  ))}
                </>
              )}
              <button onClick={goPantry} style={{
                width: "100%", padding: "10px 0", borderRadius: 12, border: `1.5px solid ${C.line}`,
                background: "#fff", color: C.ink, fontFamily: "inherit", fontWeight: 700,
                fontSize: 13, cursor: "pointer", marginTop: 4,
              }}>🧺 Open pantry</button>
            </div>
          </div>
        )}
        {(() => {
          // compute top unlock for last-card hint (only when deck is thinning)
          let topUnlock = null;
          if (deck.length <= 3) {
            const threshold = mode === "strict" ? 0 : 2;
            const filterPass = allRecipes
              .filter((r) => { const w = cuisines.map((c) => c.toLowerCase()); return !w.length || w.includes(r.cuisine); })
              .filter((r) => !maxTime || r.minutes <= maxTime)
              .filter((r) => servesMeal(r, mealType));
            const counts = {};
            for (const r of filterPass) {
              const missing = r.ingredients.filter((ing) => !ingInList(ing, pantry.map((x) => x.name)) && !ingInList(ing, staples));
              if (missing.length === threshold + 1) {
                for (const ing of missing) counts[ing] = (counts[ing] || 0) + 1;
              }
            }
            const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (best && best[1] >= 2) topUnlock = { name: best[0], count: best[1] };
          }
          return deck.slice(0, 3).map((card, i) => (
            <SwipeCard key={card.id} card={card} index={i} onSwipe={onSwipe} topId={deck[0]?.id}
              isLast={deck.length === 1} unlock={deck.length === 1 ? topUnlock : null} />
          )).reverse();
        })()}
      </div>

      {/* Undo and reset-vibe live below the deck rather than in the filter
          row. That row scrolls horizontally on a narrow screen, so both
          controls sat off the right edge exactly when they were wanted —
          mid-swipe. Here they are always on screen and never move.
          flexShrink:0 keeps the strip from being squeezed by the deck above. */}
      {(canUndo || swipes.length > 0) && (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "0 20px 10px",
        }}>
          {canUndo && (
            <button onClick={onUndo} aria-label="Undo last swipe" style={{
              border: `1.5px solid ${C.purple}`, background: C.purpleSoft, color: C.purple,
              borderRadius: 99, padding: "7px 16px", fontFamily: "inherit",
              fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}>↩️ Undo</button>
          )}
          {swipes.length > 0 && (
            <button onClick={onReset} aria-label="Reset the session vibe" style={{
              border: `1.5px solid ${C.line}`, background: "#fff", color: C.faint,
              borderRadius: 99, padding: "7px 16px", fontFamily: "inherit",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>🔥 Reset vibe</button>
          )}
        </div>
      )}
    </div>
  );
}

const PopTitle = ({ children }) => (
  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15, marginBottom: 10 }}>{children}</div>
);

const PopChip = ({ on, color, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: "7px 13px", borderRadius: 99, fontSize: 13, fontFamily: "'Outfit', sans-serif",
    fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${on ? color : C.line}`,
    background: on ? color : "#fff",
    color: on ? "#fff" : C.ink,
  }}>{children}</button>
);

const FilterBtn = ({ active, color, label, onClick }) => (
  <button onClick={onClick} style={{
    flexShrink: 0, padding: "6px 12px", borderRadius: 99, fontSize: 12.5,
    fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${active ? color : C.line}`,
    background: active ? color : "#fff",
    color: active ? "#fff" : C.faint,
  }}>{label} ▾</button>
);

function ModeToggle({ mode, setMode }) {
  return (
    <div style={{ display: "flex", background: "#F0EDE2", borderRadius: 99, padding: 3, flexShrink: 0 }}>
      {[
        { id: "strict", label: "Pantry only" },
        { id: "flexible", label: "±2" },
      ].map((m) => (
        <button key={m.id} onClick={() => setMode(m.id)} style={{
          border: "none", borderRadius: 99, padding: "5px 11px", fontSize: 12,
          fontFamily: "inherit", fontWeight: 700, cursor: "pointer",
          background: mode === m.id ? C.green : "transparent",
          color: mode === m.id ? "#fff" : C.faint,
        }}>{m.label}</button>
      ))}
    </div>
  );
}

function SwipeCard({ card, index, onSwipe, topId, isLast, unlock }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [lighter, setLighter] = useState(false);
  const health = React.useMemo(() => healthify(card), [card]);
  // An already-healthy card has nothing to swap, so its panel is informational
  // and its ingredient list never changes.
  const showSwapped = lighter && health && !health.already;
  const [leaving, setLeaving] = useState(null);
  const start = useRef(null);
  const dirLock = useRef(null);
  const scrollEl = useRef(null);
  const isTop = card.id === topId;

  const onDown = (e) => {
    if (!isTop) return;
    e.preventDefault();
    start.current = { x: e.clientX, y: e.clientY, t: Date.now(), scrollStart: scrollEl.current?.scrollTop || 0 };
    dirLock.current = null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = (e) => {
    if (!start.current) return;
    e.preventDefault();
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dirLock.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dirLock.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (dirLock.current === "h") {
      setDrag({ x: dx, y: dy, active: true });
    } else if (dirLock.current === "v" && scrollEl.current) {
      scrollEl.current.scrollTop = start.current.scrollStart - dy;
    }
  };
  const onUp = () => {
    if (!start.current) return;
    const x = drag.x;
    start.current = null;
    if (dirLock.current === "h" && Math.abs(x) > 90) {
      const dir = x > 0 ? "right" : "left";
      setLeaving(dir);
      setTimeout(() => onSwipe(card, dir), 180);
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
    dirLock.current = null;
  };

  const x = leaving ? (leaving === "right" ? 500 : -500) : drag.x;
  const rot = x / 18;
  const stampOpacity = Math.min(Math.abs(drag.x) / 90, 1);
  const mealMeta = MEAL_OPTIONS.find((m) => m.id === card.mealType);

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: "absolute", inset: 0, touchAction: "none",
        transform: `translate(${x}px, ${drag.y * 0.15}px) rotate(${rot}deg) scale(${1 - index * 0.035}) translateY(${index * 10}px)`,
        transition: drag.active && !leaving ? "none" : "transform .25s ease, opacity .2s ease",
        opacity: leaving ? 0 : 1,
        zIndex: 10 - index,
        cursor: isTop ? "grab" : "default",
        animation: "cardIn .3s ease",
      }}
    >
      <div style={{
        height: "100%", background: C.card, borderRadius: 24, overflow: "hidden",
        border: `1.5px solid ${C.line}`, boxShadow: "0 10px 32px rgba(30,43,32,.14)",
        display: "flex", flexDirection: "column", position: "relative", userSelect: "none",
      }}>
        {isTop && (
          <>
            <Stamp label="COOK IT" color={C.green} side="left" opacity={drag.x > 0 ? stampOpacity : 0} />
            <Stamp label="SKIP" color={C.red} side="right" opacity={drag.x < 0 ? stampOpacity : 0} />
          </>
        )}
        <>
            <div style={{
              background: `linear-gradient(140deg, ${tintFor(card.cuisine)} 0%, #FFFFFF 140%)`,
              padding: "12px 16px 10px",
              display: "flex", flexDirection: "column", gap: 6, flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>{card.emoji}</span>
                <h2 style={{
                  fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 21,
                  lineHeight: 1.12, margin: 0, letterSpacing: "-0.01em", flex: 1,
                }}>{card.name}</h2>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pill("#FFFFFFB0", C.ink)}>{card.cuisine}</span>
                <span style={pill("#FFFFFFB0", C.ink)}>⏱ {card.minutes} min</span>
                {mealMeta && <span style={pill("#FFFFFFB0", C.ink)}>{mealMeta.emoji} {mealMeta.label}</span>}
                {card.macros && (
                  <span style={pill("#FFFFFFB0", C.ink)}>
                    🔥 {(showSwapped ? health.macros : card.macros).cal} cal
                  </span>
                )}
                {card.wildcard && <span style={pill(C.purple, "#fff")}>🃏 wildcard</span>}
                {card.custom && <span style={pill(C.gold, "#fff")}>🏠 custom</span>}
                {health && (
                  <HealthBtn
                    already={health.already}
                    on={lighter}
                    onClick={() => setLighter((v) => !v)}
                  />
                )}
              </div>
            </div>
            <div ref={scrollEl} style={{ padding: "10px 16px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", touchAction: "none" }}>
              <p style={{ margin: 0, color: C.faint, fontSize: 13.5, lineHeight: 1.4, flexShrink: 0 }}>{card.desc}</p>
              {card.rescues?.length > 0 && (
                <div style={{ background: C.goldSoft, borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#9A6700", flexShrink: 0 }}>
                  ⏰ Rescues: {card.rescues.join(", ")}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {card.uses?.length > 0 && <IngRow label="You have" color={C.green} items={card.uses} />}
                {card.missing?.length > 0 && <IngRow label="Need" color={C.red} items={card.missing} />}
                {card.swaps?.length > 0 && (
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 800, color: C.gold }}>Swap: </span>
                    <span style={{ color: C.faint }}>{card.swaps.map((s) => `${s.need} → your ${s.have}`).join(", ")}</span>
                  </div>
                )}
              </div>
              {lighter && <HealthPanel health={health} />}
              <div style={{ height: 1, background: C.line, margin: "4px 0", flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                Ingredients · serves {card.serves || 2}
                {showSwapped && <span style={{ color: C.purple }}> · lighter</span>}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                {(showSwapped ? health.ingFull : card.ingFull || []).map((row, i) => {
                  const qty = row[0] != null ? row[0] : "";
                  const unit = row[1] || "";
                  const name = row[2] || "";
                  const displayText = [qty, unit, name].filter(Boolean).join(" ");
                  const orig = (card.ingFull || [])[i];
                  const changed = showSwapped
                    && (!orig || orig[0] !== row[0] || orig[1] !== row[1] || orig[2] !== row[2]);
                  return (
                    <span key={i} style={{
                      background: changed ? C.purpleSoft : "#FFFFFFD0",
                      border: `1px solid ${changed ? C.purple : C.line}`,
                      borderRadius: 99, padding: "3px 9px", fontSize: 12,
                      fontWeight: changed ? 800 : 600, color: changed ? C.purple : C.ink,
                    }}>{displayText}</span>
                  );
                })}
              </div>
              <div style={{ height: 1, background: C.line, margin: "4px 0", flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                Steps
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: C.ink, flexShrink: 0 }}>
                {(card.steps || []).map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
              </ol>
              {card.macros && (() => {
                const m = showSwapped ? health.macros : card.macros;
                return (
                  <div style={{ fontSize: 11.5, color: showSwapped ? C.purple : C.faint, flexShrink: 0, marginTop: 2 }}>
                    {m.cal} cal · {m.p}g protein · {m.c}g carbs · {m.f}g fat per serving
                    {showSwapped && " (lighter)"}
                  </div>
                );
              })()}
              {isLast && unlock && (
                <div style={{
                  background: C.goldSoft, borderRadius: 10, padding: "6px 12px", marginTop: 4,
                  fontSize: 12, fontWeight: 700, color: "#9A6700", textAlign: "center", flexShrink: 0,
                }}>
                  Last card — adding <span style={{ textTransform: "capitalize" }}>{unlock.name}</span> unlocks +{unlock.count} more
                </div>
              )}
            </div>
          </>
      </div>
    </div>
  );
}

// The health control. One icon in three states: a green badge when the dish
// already clears the bar, an outline when it does not, and a filled state
// while the lighter version is showing.
function HealthBtn({ already, on, onClick }) {
  const color = already ? C.green : on ? C.purple : C.faint;
  const bg = already ? C.greenSoft : on ? C.purpleSoft : "#FFFFFFB0";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={already ? undefined : on}
      aria-label={already
        ? "Already high-protein and light — tap for details"
        : on ? "Showing the lighter version — tap to go back" : "Show a lighter, higher-protein version"}
      title={already ? "Already high-protein and light" : on ? "Showing the lighter version" : "Make it lighter"}
      style={{
        border: `1.5px solid ${already ? C.green : on ? C.purple : C.line}`,
        background: bg, color, borderRadius: 99, cursor: "pointer",
        padding: "3px 9px", fontSize: 13, lineHeight: 1.35, fontFamily: "inherit",
        fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      <span style={{ fontSize: 14 }}>🏋️‍♀️</span>
      {already && <span style={{ fontSize: 11.5 }}>high protein</span>}
    </button>
  );
}

// The panel the toggle reveals. Kept deliberately plain: a list of changes,
// then the before/after, then the caveat.
function HealthPanel({ health }) {
  if (!health) return null;
  const { already, tips, macros, before } = health;
  const dCal = macros.cal - before.cal;
  return (
    <div style={{
      background: already ? C.greenSoft : C.purpleSoft, borderRadius: 12,
      padding: "9px 11px", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: already ? C.green : C.purple }}>
        {already
          ? "Already high-protein and light — nothing to fix"
          // Adding a protein source can cost calories. Trading 96 of them for
          // 25 g of protein is a good deal, but calling the result "lighter"
          // when the number went up would be a lie.
          : dCal > 0
            ? "Higher-protein version — costs a few calories"
            : "Lighter, higher-protein version"}
      </div>
      {tips.map((t) => (
        <div key={t.id} style={{ fontSize: 12.5, lineHeight: 1.45, color: C.ink }}>
          <b>{t.label}.</b> <span style={{ color: C.faint }}>{t.note}</span>
        </div>
      ))}
      {!already && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11.5 }}>
            <span style={{ color: C.faint, textDecoration: "line-through" }}>
              {before.cal} cal · {before.p}g protein
            </span>
            <span style={{ color: C.faint }}>→</span>
            <span style={{ fontWeight: 800, color: C.purple }}>
              {macros.cal} cal · {macros.p}g protein
            </span>
            {dCal !== 0 && (
              <span style={{ color: dCal < 0 ? C.green : C.faint, fontWeight: 700 }}>
                ({dCal < 0 ? "" : "+"}{dCal} cal)
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: C.faint, lineHeight: 1.4 }}>
            Estimated, not measured — the swaps are real, the numbers are arithmetic on them.
          </div>
        </>
      )}
    </div>
  );
}

const Stamp = ({ label, color, side, opacity }) => (
  <div style={{
    position: "absolute", top: 22, [side]: 18, zIndex: 5, opacity,
    transform: `rotate(${side === "left" ? -14 : 14}deg)`,
    border: `4px solid ${color}`, color, borderRadius: 10,
    padding: "4px 12px", fontWeight: 800, fontSize: 24, letterSpacing: "0.06em",
    fontFamily: "'Outfit', sans-serif", background: "#FFFFFFF0",
    boxShadow: `0 4px 14px ${color}44`,
  }}>{label}</div>
);

const IngRow = ({ label, color, items }) => {
  const shown = items.slice(0, 5);
  const extra = items.length - shown.length;
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
      <span style={{ fontWeight: 800, color }}>{label}: </span>
      <span style={{ color: C.faint }}>{shown.join(", ")}{extra > 0 ? ` +${extra} more` : ""}</span>
    </div>
  );
};

const CUISINE_TINTS = {
  italian: "#FFE0CC", thai: "#D4F5D9", mexican: "#FFDCC4",
  japanese: "#D6E6FF", chinese: "#FFDCD4", korean: "#FFD6E8", mediterranean: "#D4F0DC",
  french: "#E4DAFF", continental: "#EFE8D0", "middle eastern": "#FCE6B4", vietnamese: "#CFF0E4",
  "north indian": "#FFE6B8", "south indian": "#FFEBD0", andhra: "#FFD9B3", karnataka: "#F5E6C8",
  kerala: "#D4EAD4", tamil: "#FFE4CC", punjabi: "#FFE0B8", rajasthani: "#FFD6A8",
  gujarati: "#FFF0CC", bengali: "#FFE8D0", maharashtrian: "#FFD4B8", mangalorean: "#D8ECDA",
  spanish: "#FFE4D4", moroccan: "#F5DCC8", fusion: "#E8DCF0", indonesian: "#D8F0DC",
  malaysian: "#DCF0E8", peruvian: "#F0E0D0", ethiopian: "#F0DCC4", "west african": "#F0E4CC",
};
function tintFor(cuisine) {
  const key = (cuisine || "").toLowerCase();
  if (CUISINE_TINTS[key]) return CUISINE_TINTS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 70%, 86%)`;
}

const pill = (bg, color) => ({
  background: bg, color, borderRadius: 99, padding: "4px 10px",
  fontSize: 12, fontWeight: 700, textTransform: "capitalize",
});
const btnPrimary = {
  padding: "12px 22px", borderRadius: 14, border: "none",
  background: `linear-gradient(135deg, ${C.green}, #0DA35C)`,
  color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, cursor: "pointer",
};

/* ---------------------------- cook mode --------------------------- */

/* --------------------------- Matches tab -------------------------- */

const FRACTIONS = [[0.25,"¼"],[0.33,"⅓"],[0.5,"½"],[0.66,"⅔"],[0.75,"¾"]];
function fmtQty(q) {
  if (q == null) return "";
  const whole = Math.floor(q + 1e-6);
  const frac = q - whole;
  for (const [v, sym] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.06) return whole ? `${whole}${sym}` : sym;
  }
  if (frac < 0.06) return String(whole);
  const rounded = Math.round(q * 10) / 10;
  return String(rounded);
}
function scaledIng(m, serves) {
  const base = m.serves || 2;
  const factor = serves / base;
  return (m.ingFull || []).map(([q, u, name]) => {
    const sq = q == null ? null : q * factor;
    return [sq == null ? "" : fmtQty(sq), u || "", name].filter(Boolean).join(" ").trim();
  });
}

/* ==================================================================
   Meal prep

   A grid of breakfast / lunch / dinner across 3, 5 or 7 days, filled
   from the same picker the swipe deck uses so it respects the pantry,
   the region balancing and the meal tagging.

   Rendered days-down rather than days-across: three meal columns fit a
   phone, seven day columns do not. Same grid, turned ninety degrees.
   ================================================================== */
const PREP_MEALS = ["breakfast", "lunch", "dinner"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PREP_SPANS = [3, 5, 7];

function MealPrepTab({ pantry, staples, allRecipes, mode }) {
  const [span, setSpan] = useState(5);
  const [startDay, setStartDay] = useState(() => new Date().getDay());
  const [plan, setPlan] = useState({});
  const [cellFilters, setCellFilters] = useState({});
  const [openKey, setOpenKey] = useState(null);
  const [filterKey, setFilterKey] = useState(null);
  const seenRef = useRef({});
  const { toast, setToast, showToast } = useToast();

  const cellKey = (d, meal) => `${d}:${meal}`;
  const dayLabel = (d) => DAY_NAMES[(startDay + d) % 7];

  // One pick for one slot. `used` keeps the week from repeating itself.
  const pickFor = useCallback((meal, used, filter = {}) => {
    const [hit] = pickFromRepo(allRecipes, {
      pantry: pantry || [], staples: staples || [], mode,
      exclude: used, swipes: [],
      cuisines: filter.cuisines || [],
      maxTime: filter.maxTime ?? null,
      mealType: meal, count: 1,
    });
    return hit || null;
  }, [allRecipes, pantry, staples, mode]);

  // Fill every empty slot, leaving anything already there alone.
  const fillPlan = useCallback((keep = {}, days = span, filters = cellFilters) => {
    const used = new Set(Object.values(keep).filter(Boolean).map((r) => r.name.toLowerCase()));
    const next = { ...keep };
    for (let d = 0; d < days; d++) {
      for (const meal of PREP_MEALS) {
        const k = cellKey(d, meal);
        if (next[k]) continue;
        const hit = pickFor(meal, used, filters[k]);
        if (hit) { next[k] = hit; used.add(hit.name.toLowerCase()); }
      }
    }
    return next;
  }, [span, cellFilters, pickFor]);

  // Build on arrival, and whenever the span grows into empty slots.
  useEffect(() => {
    setPlan((prev) => fillPlan(prev));
  }, [span, fillPlan]);

  // What every slot other than `k` is already using, so a swap never
  // duplicates another meal in the plan.
  const usedElsewhere = (source, k) => new Set(Object.entries(source)
    .filter(([key, r]) => key !== k && r)
    .map(([, r]) => r.name.toLowerCase()));

  const replaceCell = (d, meal) => {
    const k = cellKey(d, meal);
    const current = plan[k];
    const elsewhere = usedElsewhere(plan, k);

    // The slot's own history. Excluding only `elsewhere` would leave the card
    // that is already here in the running, and it is by definition the
    // top-ranked one for this slot — so the swipe would re-pick it and look
    // like nothing happened. Carrying the history forward also stops repeated
    // swipes ping-ponging between the same best two.
    let seen = seenRef.current[k] || new Set();
    if (current) seen.add(current.name.toLowerCase());

    let hit = pickFor(meal, new Set([...elsewhere, ...seen]), cellFilters[k]);
    if (!hit) {
      // Rotation exhausted: start it over rather than dead-ending the slot,
      // still holding back whatever is on screen right now.
      seen = new Set(current ? [current.name.toLowerCase()] : []);
      hit = pickFor(meal, new Set([...elsewhere, ...seen]), cellFilters[k]);
    }
    if (!hit) { showToast("Nothing else matches that slot"); return; }

    seen.add(hit.name.toLowerCase());
    seenRef.current[k] = seen;
    setPlan((prev) => ({ ...prev, [k]: hit }));
  };

  const applyCellFilter = (k, filter) => {
    setCellFilters((f) => ({ ...f, [k]: filter }));
    const [, meal] = k.split(":");
    // A new filter is a new candidate space, so the old rotation is meaningless.
    delete seenRef.current[k];
    const hit = pickFor(meal, usedElsewhere(plan, k), filter);
    if (!hit) { showToast("No recipe fits those filters"); return; }
    seenRef.current[k] = new Set([hit.name.toLowerCase()]);
    setPlan((prev) => ({ ...prev, [k]: hit }));
  };

  const reshuffle = () => { seenRef.current = {}; setPlan(fillPlan({})); };

  const open = openKey ? plan[openKey] : null;

  if (!pantry?.length) {
    return (
      <Center>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🗓️</div>
        <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Add your pantry first</p>
        <p style={{ color: C.faint, fontSize: 14, maxWidth: 250 }}>
          Meal prep builds the week from what you have.
        </p>
      </Center>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px", position: "relative" }}>
      <Toast toast={toast} setToast={setToast} />

      {/* Span, then start day beneath it. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        {PREP_SPANS.map((n) => (
          <button key={n} onClick={() => setSpan(n)} style={{
            border: `1.5px solid ${span === n ? C.green : C.line}`,
            background: span === n ? C.greenSoft : "#fff",
            color: span === n ? C.green : C.faint,
            borderRadius: 99, padding: "6px 14px", fontFamily: "inherit",
            fontWeight: 800, fontSize: 13, cursor: "pointer",
          }}>{n} days</button>
        ))}
        <button onClick={reshuffle} style={{
          marginLeft: "auto", border: `1.5px solid ${C.line}`, background: "#fff",
          color: C.faint, borderRadius: 99, padding: "6px 12px",
          fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}>🔄 Reshuffle</button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.faint, fontWeight: 700, marginRight: 2 }}>Start</span>
        {DAY_NAMES.map((d, i) => (
          <button key={d} onClick={() => setStartDay(i)} style={{
            border: `1.5px solid ${startDay === i ? C.gold : C.line}`,
            background: startDay === i ? C.goldSoft : "#fff",
            color: startDay === i ? "#9A6700" : C.faint,
            borderRadius: 99, padding: "4px 9px", fontFamily: "inherit",
            fontWeight: 700, fontSize: 11.5, cursor: "pointer",
          }}>{d}</button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: C.faint, margin: "0 0 8px", lineHeight: 1.5 }}>
        Tap a meal to open it · swipe to swap it · long-press to filter that slot
      </p>

      {/* Meal columns; days run down. */}
      <div style={{
        display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr", gap: 5,
        alignItems: "stretch",
      }}>
        <span />
        {PREP_MEALS.map((m) => (
          <div key={m} style={{
            fontSize: 10.5, fontWeight: 800, color: C.faint, textTransform: "uppercase",
            letterSpacing: "0.05em", textAlign: "center", paddingBottom: 2,
          }}>{m.slice(0, 5)}</div>
        ))}

        {Array.from({ length: span }, (_, d) => (
          <React.Fragment key={d}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.ink, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>{dayLabel(d)}</div>
            {PREP_MEALS.map((meal) => {
              const k = cellKey(d, meal);
              return (
                <PlanCell
                  key={k}
                  recipe={plan[k]}
                  filtered={!!(cellFilters[k]?.cuisines?.length || cellFilters[k]?.maxTime)}
                  onTap={() => plan[k] && setOpenKey(k)}
                  onSwipe={() => replaceCell(d, meal)}
                  onLongPress={() => setFilterKey(k)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {open && <PrepRecipeSheet recipe={open} onClose={() => setOpenKey(null)} />}
      {filterKey && (
        <PrepFilterSheet
          value={cellFilters[filterKey] || {}}
          onClose={() => setFilterKey(null)}
          onApply={(f) => { applyCellFilter(filterKey, f); setFilterKey(null); }}
        />
      )}
    </div>
  );
}

// One slot in the grid. Same gesture arbitration as SmartChip — a horizontal
// drag past the threshold swaps the recipe, a hold opens filters, a clean tap
// opens the card — but sized as a tile rather than a chip.
function PlanCell({ recipe, filtered, onTap, onSwipe, onLongPress }) {
  const [dx, setDx] = useState(0);
  const startX = useRef(null);
  const moved = useRef(false);
  const handled = useRef(0);
  const longTimer = useRef(null);
  const longFired = useRef(false);
  const THRESHOLD = 56;

  const cancelLong = () => clearTimeout(longTimer.current);
  useEffect(() => () => clearTimeout(longTimer.current), []);

  const down = (e) => {
    startX.current = e.clientX;
    moved.current = false;
    longFired.current = false;
    cancelLong();
    longTimer.current = setTimeout(() => {
      if (moved.current || startX.current === null) return;
      longFired.current = true;
      handled.current = Date.now();
      setDx(0);
      onLongPress();
    }, 500);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    if (startX.current === null) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 8) { moved.current = true; cancelLong(); }
    if (longFired.current) return;
    setDx(Math.max(-90, Math.min(d, 90)));
  };
  const up = () => {
    cancelLong();
    const d = dx;
    setDx(0);
    if (longFired.current) { startX.current = null; return; }
    if (startX.current === null) return;
    startX.current = null;
    handled.current = Date.now();
    if (Math.abs(d) >= THRESHOLD) onSwipe();
    else if (!moved.current) onTap();
  };
  const cancel = () => { cancelLong(); startX.current = null; setDx(0); };
  const click = () => {
    if (longFired.current || Date.now() - handled.current < 500) return;
    setDx(0); startX.current = null;
    onTap();
  };

  const pull = Math.min(Math.abs(dx) / THRESHOLD, 1);

  if (!recipe) {
    return (
      <div style={{
        border: `1.5px dashed ${C.line}`, borderRadius: 12, minHeight: 74,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.line, fontSize: 18,
      }}>—</div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12 }}>
      {pull > 0.15 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", color: C.purple, fontSize: 18, opacity: pull,
        }}>🔄</div>
      )}
      <button
        type="button"
        onClick={click}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: "100%", minHeight: 74, textAlign: "left", position: "relative",
          border: `1.5px solid ${filtered ? C.gold : C.line}`,
          background: "#fff", borderRadius: 12, padding: "8px 9px",
          fontFamily: "inherit", cursor: "pointer", display: "block",
          userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          touchAction: "pan-y",
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform .18s ease" : "none",
          opacity: 1 - pull * 0.35,
        }}
      >
        <div style={{ fontSize: 17, lineHeight: 1, marginBottom: 3 }}>{recipe.emoji}</div>
        <div style={{
          fontSize: 11.5, fontWeight: 700, color: C.ink, lineHeight: 1.25,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{recipe.name}</div>
        <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>
          {recipe.minutes}m
          {recipe.macros?.cal != null && ` · ${recipe.macros.cal}cal`}
          {recipe.missing?.length ? ` · need ${recipe.missing.length}` : ""}
        </div>
      </button>
    </div>
  );
}

// Full card for one planned meal.
function PrepRecipeSheet({ recipe, onClose }) {
  const [serves, setServes] = useState(recipe.serves || 2);
  const [lighter, setLighter] = useState(false);
  const health = React.useMemo(() => healthify(recipe), [recipe]);
  const showSwapped = lighter && health && !health.already;
  // Scaling runs off whichever ingredient list is on screen.
  const ings = scaledIng(showSwapped ? { ...recipe, ingFull: health.ingFull } : recipe, serves);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "88%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 30 }}>{recipe.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19, lineHeight: 1.2 }}>{recipe.name}</div>
            <div style={{ fontSize: 12, color: C.faint, textTransform: "capitalize", marginTop: 2 }}>
              {recipe.cuisine} · {recipe.minutes} min
              {recipe.macros && ` · ${(showSwapped ? health.macros : recipe.macros).cal} cal`}
            </div>
            {health && (
              <div style={{ marginTop: 6 }}>
                <HealthBtn already={health.already} on={lighter} onClick={() => setLighter((v) => !v)} />
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "#F3F1E8", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.faint, flexShrink: 0 }}>✕</button>
        </div>

        <p style={{ fontSize: 13.5, color: C.faint, margin: "0 0 12px", lineHeight: 1.5 }}>{recipe.desc}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.faint }}>Serves</span>
          <button onClick={() => setServes((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
          <span style={{ fontWeight: 800, fontSize: 14, minWidth: 16, textAlign: "center" }}>{serves}</span>
          <button onClick={() => setServes((n) => Math.min(8, n + 1))} style={stepBtn}>+</button>
        </div>

        {lighter && <div style={{ marginBottom: 12 }}><HealthPanel health={health} /></div>}

        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Ingredients{showSwapped && <span style={{ color: C.purple }}> · lighter</span>}
        </div>
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
          {ings.map((line, i) => <li key={i}>{line}</li>)}
        </ul>

        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Method</div>
        <ol style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.65 }}>
          {(recipe.steps || []).map((s, i) => <li key={i} style={{ marginBottom: 5 }}>{s}</li>)}
        </ol>

        {recipe.macros && (() => {
          const m = showSwapped ? health.macros : recipe.macros;
          const tone = showSwapped ? C.purple : C.ink;
          return (
            <div style={{ display: "flex", gap: 8, fontSize: 12, color: C.faint }}>
              <span><b style={{ color: tone }}>{m.cal}</b> cal</span>
              <span><b style={{ color: tone }}>{m.p}g</b> protein</span>
              <span><b style={{ color: tone }}>{m.c}g</b> carbs</span>
              <span><b style={{ color: tone }}>{m.f}g</b> fat</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

const stepBtn = {
  border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink,
  borderRadius: "50%", width: 26, height: 26, fontSize: 15, fontWeight: 800,
  cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
};

// Filters for one slot only, so a single dinner can be pinned to a cuisine
// without disturbing the rest of the week.
function PrepFilterSheet({ value, onClose, onApply }) {
  const [cuisines, setCuisines] = useState(value.cuisines || []);
  const [maxTime, setMaxTime] = useState(value.maxTime ?? null);
  const toggle = (c) => setCuisines((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "80%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 19, flex: 1 }}>Filter this meal</span>
          <button onClick={onClose} style={{ border: "none", background: "#F3F1E8", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.faint }}>✕</button>
        </div>

        <PopTitle>Time</PopTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <PopChip on={!maxTime} color={C.gold} onClick={() => setMaxTime(null)}>Any</PopChip>
          {TIME_OPTIONS.map((t) => (
            <PopChip key={t} on={maxTime === t} color={C.gold} onClick={() => setMaxTime(maxTime === t ? null : t)}>
              ⏱ ≤{t} min
            </PopChip>
          ))}
        </div>

        <PopTitle>Cuisine</PopTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {CUISINE_OPTIONS.map((c) => (
            <PopChip key={c} on={cuisines.includes(c)} color={C.purple} onClick={() => toggle(c)}>{c}</PopChip>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setCuisines([]); setMaxTime(null); }} style={{
            flex: 1, padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.line}`,
            background: "#fff", color: C.faint, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>Clear</button>
          <button onClick={() => onApply({ cuisines, maxTime })} style={{ ...btnPrimary, flex: 2 }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function MatchesTab({ matches, persist, pantry, persistPantry, staples, shopping, persistShopping, openTarget, clearOpenTarget, bumpStock, cooked, persistCooked }) {
  const { toast, setToast, showToast } = useToast();
  const [openId, setOpenId] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [servesMap, setServesMap] = useState({}); // savedAt -> chosen servings
  const [lighterMap, setLighterMap] = useState({}); // savedAt -> lighter view on?
  const toggleLighter = (savedAt) => setLighterMap((s) => ({ ...s, [savedAt]: !s[savedAt] }));
  const setServes = (savedAt, n) => setServesMap((s) => ({ ...s, [savedAt]: Math.max(1, Math.min(8, n)) }));

  const openMatch = useCallback((m) => setOpenId(m.savedAt), []);

  useEffect(() => {
    if (openTarget) {
      const m = matches.find((x) => x.savedAt === openTarget);
      if (m) openMatch(m);
      clearOpenTarget();
    }
  }, [openTarget]);

  const removeMatch = (m) => {
    persist(matches.filter((x) => x.savedAt !== m.savedAt));
    if (openId === m.savedAt) setOpenId(null);
  };

  // "Cooked it" does two things: marks the recipe's pantry ingredients out of
  // stock (they stay in the pantry list, greyed out, one tap from restocking,
  // and matching skips them until then), and records the cook in the log.
  //
  // The log is deduped by recipe rather than append-per-cook, so it stays
  // bounded by distinct recipes and can show a count. It keeps a full snapshot
  // so a cooked recipe is still viewable after matches are cleared.
  const markUsed = (m) => {
    const used = m.uses || [];
    const n = pantry.filter((p) => used.some((u) => ingMatch(p.name, u))).length;
    // Used up means gone from the pantry, not greyed out inside it — they go
    // back to quick add, one tap from being restocked.
    persistPantry(pantry.filter((p) => !used.some((u) => ingMatch(p.name, u))));

    const id = m.repoId || m.name;
    const prev = (cooked || []).find((c) => (c.repoId || c.name) === id);
    const { uses, missing, rescues, swaps, savedAt, fav, listHidden, ...recipe } = m;
    const entry = { ...recipe, times: (prev?.times || 0) + 1, lastCookedAt: Date.now() };
    persistCooked([entry, ...(cooked || []).filter((c) => (c.repoId || c.name) !== id)]);

    showToast(n ? `Cooked · ${n} ingredient${n > 1 ? "s" : ""} used up` : "Added to your cooked list");
  };

  // Clearing empties the Matches tab. Favourites are kept but hidden from the
  // list — they stay reachable through the ♥ sheet, which is what "hide favs
  // until I view faves" means. Everything else is dropped outright.
  const clearMatches = () => {
    const favs = matches.filter((m) => m.fav);
    const dropped = matches.length - favs.length;
    if (!window.confirm(
      favs.length
        ? `Clear ${dropped} saved recipe${dropped === 1 ? "" : "s"}? Your ${favs.length} favourite${favs.length === 1 ? "" : "s"} stay saved under ♥.`
        : `Clear all ${dropped} saved recipe${dropped === 1 ? "" : "s"}? This can't be undone.`,
    )) return;
    persist(favs.map((m) => ({ ...m, listHidden: true })));
    setOpenId(null);
    showToast(favs.length ? `Cleared · ${favs.length} favourite${favs.length === 1 ? "" : "s"} kept under ♥` : "Matches cleared");
  };

  const pickDinner = () => {
    if (visible.length < 2 || spinning) return;
    setSpinning(true);
    let ticks = 0;
    const iv = setInterval(() => {
      setHighlightId(visible[Math.floor(Math.random() * visible.length)].savedAt);
      ticks++;
      if (ticks > 9) {
        clearInterval(iv);
        const chosen = visible[Math.floor(Math.random() * visible.length)];
        setHighlightId(chosen.savedAt);
        setSpinning(false);
        openMatch(chosen);
        setTimeout(() => setHighlightId(null), 1600);
      }
    }, 120);
  };

  // Matches hidden by "clear" stay in storage (they are favourites) but are
  // out of the list until reopened from the ♥ sheet, which un-hides them.
  const visible = matches.filter((m) => !m.listHidden);

  const stockedNames = pantry.map((p) => p.name);

  const gotIt = (g) => {
    // As in PantryTab: the list entry clears on every path.
    if (g.manual) persistShopping(shopping.filter((s) => norm(shopName(s)) !== norm(g.ing)));
    if (isStaple(g.ing)) { showToast(`✓ ${g.ing} restocked (staple)`); return; }
    if (pantry.some((p) => p.name.toLowerCase() === g.ing.toLowerCase())) return;
    const guess = localGuess(g.ing);
    persistPantry([{ id: Date.now(), name: g.ing, cat: guess || "other", useSoon: false }, ...pantry]);
    bumpStock([g.ing]);
  };

  if (visible.length === 0) {
    return (
      <Center>
        <div style={{ fontSize: 44, marginBottom: 10 }}>💚</div>
        <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>No matches yet</p>
        <p style={{ color: C.faint, fontSize: 14, maxWidth: 250 }}>
          Swipe right on recipes you like.
          {matches.some((m) => m.fav) && " Your favourites are still saved under ♥."}
        </p>
      </Center>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 24px", position: "relative" }}>
      <Toast toast={toast} setToast={setToast} />

      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.faint, fontWeight: 700 }}>
          {visible.length} saved
        </span>
        <button onClick={clearMatches} style={{
          marginLeft: "auto", border: `1.5px solid ${C.line}`, background: "#fff",
          color: C.faint, borderRadius: 99, padding: "5px 12px",
          fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}>Clear matches</button>
      </div>

      {visible.length >= 2 && (
        <button onClick={pickDinner} disabled={spinning} style={{
          width: "100%", padding: "12px 0", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
          color: "#fff", fontFamily: "inherit", fontWeight: 800,
          fontSize: 14, cursor: "pointer", marginBottom: 12,
          boxShadow: `0 6px 20px ${C.purple}44`,
        }}>{spinning ? "Picking…" : "🎲 Pick for me"}</button>
      )}

      {visible.map((m) => {
        const open = openId === m.savedAt;
        const usedInPantry = (m.uses || []).filter((u) =>
          pantry.some((p) => ingMatch(p.name, u))
        );
        return (
          <div key={m.savedAt} style={{
            background: "#fff", borderRadius: 16, marginBottom: 10, overflow: "hidden",
            border: `2px solid ${highlightId === m.savedAt ? C.purple : C.line}`,
            boxShadow: highlightId === m.savedAt ? `0 0 0 3px ${C.purpleSoft}` : "none",
            transition: "border-color .1s ease, box-shadow .1s ease",
          }}>
            <button onClick={() => (open ? setOpenId(null) : openMatch(m))} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
              border: "none",
              background: `linear-gradient(120deg, ${tintFor(m.cuisine)}, #FFFFFF 150%)`,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.ink,
            }}>
              <span style={{ fontSize: 28, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.1))" }}>{m.emoji}</span>
              <span style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 17, lineHeight: 1.15 }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: C.faint, textTransform: "capitalize" }}>
                  {m.fav ? "♥ " : ""}{m.custom ? "🏠 " : ""}{m.cuisine} · {m.minutes} min
                  {m.macros?.cal != null && ` · ${m.macros.cal} cal`}
                </div>
              </span>
              <span style={{ color: C.faint, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div style={{ padding: "14px 16px 16px" }}>
                {(() => {
                  const steps = m.steps || m.full?.steps || [];
                  const macros = m.macros || (m.full?.macros ? { cal: m.full.macros.calories, p: m.full.macros.protein_g, c: m.full.macros.carbs_g, f: m.full.macros.fat_g } : null);
                  const serves = servesMap[m.savedAt] || m.serves || 2;
                  // Community saves carry a different macro shape and no
                  // ingredient rows, so healthify only runs on repo cards.
                  const health = m.ingFull && macros ? healthify({ ...m, macros }) : null;
                  const lighter = !!lighterMap[m.savedAt];
                  const showSwapped = lighter && health && !health.already;
                  const shown = showSwapped ? { ...m, ingFull: health.ingFull } : m;
                  const ings = m.ingFull ? scaledIng(shown, serves) : (m.full?.ingredients || []);
                  const shownMacros = showSwapped ? health.macros : macros;
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: C.faint, fontWeight: 700 }}>Serves</span>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 0, border: `1.5px solid ${C.line}`, borderRadius: 99, overflow: "hidden" }}>
                          <button onClick={() => setServes(m.savedAt, serves - 1)} disabled={serves <= 1} style={{
                            border: "none", background: "#fff", width: 34, height: 30, fontSize: 16, fontWeight: 800,
                            color: serves <= 1 ? C.line : C.ink, cursor: serves <= 1 ? "default" : "pointer", fontFamily: "inherit",
                          }}>−</button>
                          <span style={{ minWidth: 28, textAlign: "center", fontWeight: 800, fontSize: 14.5 }}>{serves}</span>
                          <button onClick={() => setServes(m.savedAt, serves + 1)} disabled={serves >= 8} style={{
                            border: "none", background: "#fff", width: 34, height: 30, fontSize: 16, fontWeight: 800,
                            color: serves >= 8 ? C.line : C.ink, cursor: serves >= 8 ? "default" : "pointer", fontFamily: "inherit",
                          }}>+</button>
                        </div>
                        {m.ingFull && serves !== (m.serves || 2) && (
                          <span style={{ fontSize: 11.5, color: C.gold, fontWeight: 700 }}>scaled from {m.serves}</span>
                        )}
                        {health && (
                          <span style={{ marginLeft: "auto" }}>
                            <HealthBtn already={health.already} on={lighter} onClick={() => toggleLighter(m.savedAt)} />
                          </span>
                        )}
                      </div>
                      {lighter && health && (
                        <div style={{ marginBottom: 12 }}><HealthPanel health={health} /></div>
                      )}
                      {macros && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                          {[
                            { label: "kcal", val: shownMacros.cal, bg: C.goldSoft, color: "#9A6700" },
                            { label: "protein", val: shownMacros.p + "g", bg: C.greenSoft, color: C.green },
                            { label: "carbs", val: shownMacros.c + "g", bg: "#DCE9FF", color: "#2E5DA8" },
                            { label: "fat", val: shownMacros.f + "g", bg: C.redSoft, color: C.red },
                          ].map((s) => (
                            <div key={s.label} style={{
                              background: s.bg, borderRadius: 10, padding: "7px 11px",
                              textAlign: "center", minWidth: 62,
                            }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.val}</div>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                            </div>
                          ))}
                          <span style={{ fontSize: 10.5, color: showSwapped ? C.purple : C.faint, alignSelf: "flex-end", paddingBottom: 2 }}>
                            per serving{showSwapped ? " · lighter" : ""}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.faint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Ingredients</div>
                      <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>
                        {ings.map((ing, i) => <li key={i}>{ing}</li>)}
                      </ul>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.faint, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Steps</div>
                      <ol style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 14.5, lineHeight: 1.65 }}>
                        {steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                      </ol>
                    </>
                  );
                })()}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => {
                    persist(matches.map((x) => x.savedAt === m.savedAt ? { ...x, fav: !x.fav } : x));
                  }} style={{
                    padding: "9px 14px", borderRadius: 14, border: `1.5px solid ${m.fav ? "#FF4466" : C.line}`,
                    background: m.fav ? "#FFF0F3" : "#fff", color: m.fav ? "#FF4466" : C.faint,
                    fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  }}>{m.fav ? "♥ Favorited" : "♡ Favorite"}</button>
                  {(m.uses || []).some((u) => pantry.some((p) => ingMatch(p.name, u))) && (
                    <button onClick={() => markUsed(m)} style={{
                      padding: "9px 14px", borderRadius: 14, border: `1.5px solid ${C.green}`,
                      background: C.greenSoft, color: C.green, fontFamily: "inherit",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>✓ Cooked it</button>
                  )}
                  {m.missing?.length > 0 && (
                    <button onClick={() => {
                      const newItems = (m.missing || []).filter((ing) =>
                        !shopping.some((s) => norm(shopName(s)) === norm(ing))
                      );
                      if (newItems.length) {
                        persistShopping([...shopping, ...newItems.map((n) => ({ n, from: null }))]);
                      }
                    }} style={{
                      padding: "9px 14px", borderRadius: 14, border: `1.5px solid ${C.pink}`,
                      background: "#FFF0F3", color: C.pink, fontFamily: "inherit",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>🛒 Add {m.missing.length} to list</button>
                  )}
                  <button onClick={() => removeMatch(m)} style={{
                    padding: "9px 14px", borderRadius: 14, border: `1.5px solid ${C.line}`,
                    background: "#fff", color: C.faint, fontFamily: "inherit",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
