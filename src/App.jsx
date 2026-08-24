import React, { useState, useEffect, useRef, useCallback } from "react";
import { loadKey, saveKey, keyExists } from "./storage.js";
import { RECIPES as REPO_RAW } from "./data/index.js";

const COMMUNITY_KEY = "simmer-community-recipes";

// Adapt repo entries to the app's card shape once at load.
const REPO = REPO_RAW.map((r) => ({
  repoId: r.id, name: r.name, cuisine: r.cuisine, emoji: r.emoji,
  minutes: r.mins, mealType: r.meal, desc: r.desc, tags: r.tags || [],
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

const nsKeys = (code) => ({
  pantry: code ? `hh:${code}:pantry` : "simmer-pantry",
  matches: code ? `hh:${code}:matches` : "simmer-matches",
  staples: code ? `hh:${code}:staples` : "simmer-staples",
  shopping: code ? `hh:${code}:shopping` : "simmer-shopping",
  stock: code ? `hh:${code}:stock-counts` : "simmer-stock-counts",
  shared: !!code,
});

const norm = (s) => s.toLowerCase().trim().replace(/s$/, "");

// token-level plural-aware comparison
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

function tokensMatch(ta, tb) {
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false; // head nouns must agree
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 1 && long.length > 1 && AMBIGUOUS_HEADS.has(short[0])) return false;
  const ls = new Set(long);
  return short.every((w) => ls.has(w));
}

function ingMatch(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  if (tokensMatch(ta, tb)) return true;
  const sa = stripForm(ta), sb = stripForm(tb);
  if (sa !== ta || sb !== tb) return tokensMatch(sa, sb);
  return false;
}

function ingInList(ing, list) {
  return list.some((x) => ingMatch(ing, x));
}
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

function pickFromRepo(recipes, { pantry, staples, mode, exclude, swipes, cuisines = [], maxTime = null, mealType = null, count = 5 }) {
  const liked = new Set(swipes.filter((s) => s.dir === "right").map((s) => (s.cuisine || "").toLowerCase()));
  const passed = new Set(swipes.filter((s) => s.dir === "left").map((s) => (s.cuisine || "").toLowerCase()));
  const wanted = new Set(cuisines.map((c) => c.toLowerCase()));
  // Time-of-day meal preference (device local time, soft boost)
  const hr = new Date().getHours();
  const timeMeals = hr < 10 ? ["breakfast"] : hr < 14 ? ["lunch"] : hr < 18 ? ["snack", "dessert"] : ["dinner"];
  const candidates = recipes
    .filter((r) => !exclude.has(r.name.toLowerCase()))
    .filter((r) => !wanted.size || wanted.has((r.cuisine || "").toLowerCase()))
    .filter((r) => !maxTime || (r.minutes || 0) <= maxTime)
    .filter((r) => !mealType || r.mealType === mealType)
    .map((r) => {
      const fit = computeFit(r, pantry, staples);
      return { r, fit };
    })
    .filter(({ fit }) => (mode === "strict" ? fit.missing.length === 0 : fit.missing.length <= 2))
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
      // Rescue bonus for use-soon items
      if (c.fit.rescues.length) tier -= 5;
      // Time-of-day: boost matching meal type when no manual meal filter is set
      if (!mealType && timeMeals.includes(c.r.mealType)) tier -= 15;
      // Random within tier for variety on every shuffle
      const score = -tier + Math.random() * 50;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);

  // Pick phase: pantry-using recipes first, then cuisine diversity for the rest
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
      const byCuisine = {};
      for (const c of freebies) {
        const cz = (c.r.cuisine || "").toLowerCase();
        (byCuisine[cz] = byCuisine[cz] || []).push(c);
      }
      const czKeys = Object.keys(byCuisine).sort(() => Math.random() - 0.5);
      let round = 0;
      while (picks.length < count) {
        let added = false;
        for (const cz of czKeys) {
          if (picks.length >= count) break;
          if (byCuisine[cz][round]) { picks.push(byCuisine[cz][round]); added = true; }
        }
        if (!added) break;
        round++;
      }
    }
  } else {
    picks = candidates.slice(0, count);
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

/* ------------------------------ App ------------------------------- */

export default function Simmer() {
  const [tab, setTab] = useState("swipe");
  const [profile, setProfile] = useState(null);
  const [pantry, setPantry] = useState(null);
  const [matches, setMatches] = useState(null);
  const [staples, setStaples] = useState(null);
  const [shopping, setShopping] = useState([]);
  const [stockCounts, setStockCounts] = useState({});
  const [community, setCommunity] = useState([]);
  const [recipeSheet, setRecipeSheet] = useState(false);
  const [favSheet, setFavSheet] = useState(false);
  const [mode, setMode] = useState("flexible");
  const [hhOpen, setHhOpen] = useState(false);
  const [matchFlash, setMatchFlash] = useState(null);
  const [openTarget, setOpenTarget] = useState(null);

  // session-only
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

  const pantryRef = useRef(pantry); pantryRef.current = pantry;
  const matchesRef = useRef(matches); matchesRef.current = matches;
  const staplesRef = useRef(staples); staplesRef.current = staples;
  const profileRef = useRef(profile); profileRef.current = profile;
  const shoppingRef = useRef(shopping); shoppingRef.current = shopping;

  const loadNamespace = useCallback(async (code) => {
    const k = nsKeys(code);
    const [p, m, s, sh, sc] = await Promise.all([
      loadKey(k.pantry, [], k.shared),
      loadKey(k.matches, [], k.shared),
      loadKey(k.staples, STAPLES_LIST, k.shared),
      loadKey(k.shopping, [], k.shared),
      loadKey(k.stock, {}, k.shared),
    ]);
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
    if (sVer < 27 || Array.isArray(s)) saveKey(k.staples, { v: 27, items: migrated }, k.shared);
    setPantry(p); setMatches(m); setStaples(migrated); setShopping(sh); setStockCounts(sc || {});
  }, []);

  useEffect(() => {
    (async () => {
      const prof = await loadKey("simmer-profile", { code: null });
      setProfile(prof);
      await loadNamespace(prof.code);
    })();
  }, [loadNamespace]);

  // community recipes: global, all households; skip any id already baked into the repo
  const repoIds = React.useMemo(() => new Set(REPO.map((r) => r.repoId)), []);
  const loadCommunity = useCallback(async () => {
    const raw = await loadKey(COMMUNITY_KEY, [], true);
    setCommunity((Array.isArray(raw) ? raw : []).filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  const saveCommunity = useCallback(async (nextList) => {
    // read-merge-write to shrink the lost-update window
    const latest = await loadKey(COMMUNITY_KEY, [], true);
    const byId = new Map((Array.isArray(latest) ? latest : []).map((r) => [r.repoId, r]));
    for (const r of nextList) byId.set(r.repoId, r);
    for (const id of [...byId.keys()]) if (!nextList.some((r) => r.repoId === id) && nextList.__deleted?.includes(id)) byId.delete(id);
    const merged = [...byId.values()];
    await saveKey(COMMUNITY_KEY, merged, true);
    setCommunity(merged.filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  const deleteCommunity = useCallback(async (repoId) => {
    const latest = await loadKey(COMMUNITY_KEY, [], true);
    const merged = (Array.isArray(latest) ? latest : []).filter((r) => r.repoId !== repoId);
    await saveKey(COMMUNITY_KEY, merged, true);
    setCommunity(merged.filter((r) => !repoIds.has(r.repoId)));
  }, [repoIds]);
  useEffect(() => {
    loadCommunity();
    const iv = setInterval(loadCommunity, 30000);
    const onVis = () => { if (document.visibilityState === "visible") loadCommunity(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [loadCommunity]);

  const allRecipes = React.useMemo(() => [...REPO, ...community], [community]);
  const allRecipesRef = useRef(allRecipes); allRecipesRef.current = allRecipes;

  const persistPantry = useCallback((next) => {
    const k = nsKeys(profileRef.current?.code);
    setPantry(next); saveKey(k.pantry, next, k.shared);
  }, []);
  const persistMatches = useCallback((next) => {
    const k = nsKeys(profileRef.current?.code);
    setMatches(next); saveKey(k.matches, next, k.shared);
  }, []);
  const persistStaples = useCallback((next) => {
    const k = nsKeys(profileRef.current?.code);
    setStaples(next); saveKey(k.staples, { v: 27, items: next }, k.shared);
  }, []);
  const persistShopping = useCallback((next) => {
    const k = nsKeys(profileRef.current?.code);
    setShopping(next); saveKey(k.shopping, next, k.shared);
  }, []);

  const stockRef = useRef(stockCounts); stockRef.current = stockCounts;
  // learn what the household actually stocks: bump on pantry adds and shopping-list buys
  const bumpStock = useCallback((names, cats = {}) => {
    const k = nsKeys(profileRef.current?.code);
    const next = { ...stockRef.current };
    for (const n of names) {
      const key = norm(n);
      const prev = next[key] || { name: n, cat: cats[n] || localGuess(n) || "other", n: 0 };
      next[key] = { ...prev, name: n, n: prev.n + 1 };
    }
    setStockCounts(next); saveKey(k.stock, next, k.shared);
  }, []);

  const resetSession = useCallback(() => {
    sessionRef.current++;
    setDeck([]); setSwipes([]); setSeen([]); setHistory([]); setExhausted(null);
  }, []);
  const softReset = useCallback(() => {
    sessionRef.current++;
    setDeck([]); setSeen([]); setExhausted(null);
  }, []);
  const modeReset = useCallback(() => {
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
    (pantry || []).filter((p) => !p.out).map((p) => norm(p.name)).sort().join("|"),
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
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      const candidate = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + "-" + (10 + Math.floor(Math.random() * 90));
      if (!(await keyExists(`hh:${candidate}:meta`, true))) code = candidate;
    }
    if (!code) return "Couldn't generate a code, try again.";
    await saveKey(`hh:${code}:meta`, { createdAt: Date.now() }, true);
    const k = nsKeys(code);
    await Promise.all([
      saveKey(k.pantry, pantryRef.current || [], true),
      saveKey(k.matches, matchesRef.current || [], true),
      saveKey(k.staples, { v: 27, items: staplesRef.current || STAPLES_LIST }, true),
      saveKey(k.shopping, shoppingRef.current || [], true),
    ]);
    const prof = { code };
    setProfile(prof); await saveKey("simmer-profile", prof);
    resetSession();
    return null;
  };

  const joinHousehold = async (raw) => {
    const code = raw.trim().toUpperCase();
    if (!code) return "Enter a code.";
    if (!(await keyExists(`hh:${code}:meta`, true))) return "Household not found. Check the code.";
    const prof = { code };
    setProfile(prof); await saveKey("simmer-profile", prof);
    await loadNamespace(code);
    resetSession();
    return null;
  };

  const leaveHousehold = async () => {
    const prof = { code: null };
    setProfile(prof); await saveKey("simmer-profile", prof);
    await loadNamespace(null);
    resetSession();
  };

  const dealCards = useCallback(
    (currentSwipes, currentSeen, append, target = 20) => {
      const p = (pantryRef.current || []).filter((x) => !x.out), s = staplesRef.current || [];
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
      // Nothing matched: figure out why and how to help.
      const filterPass = allRecipes
        .filter((r) => { const w = cuisinesRef.current.map((c) => c.toLowerCase()); return !w.length || w.includes(r.cuisine); })
        .filter((r) => !maxTimeRef.current || r.minutes <= maxTimeRef.current)
        .filter((r) => !mealTypeRef.current || r.mealType === mealTypeRef.current);
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
    if (tab === "swipe" && pantry?.some((x) => !x.out) && deck.length === 0 && !exhausted) {
      dealCards(swipes, seen, false);
    }
  }, [tab, pantry, deck.length, exhausted, mode, cuisines, maxTime, mealType]);

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
      if (last.dir === "right" && last.savedAt) {
        persistMatches((matchesRef.current || []).filter((m) => m.savedAt !== last.savedAt));
      }
      setMatchFlash(null);
      return h.slice(0, -1);
    });
  }, [persistMatches]);

  // keep household data fresh across devices: refetch on focus + every 20s
  useEffect(() => {
    const code = profile?.code;
    if (!code) return;
    const refresh = () => loadNamespace(code);
    const iv = setInterval(refresh, 20000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [profile?.code, loadNamespace]);

  useEffect(() => {
    if (!matchFlash) return;
    const t = setTimeout(() => setMatchFlash(null), 2200);
    return () => clearTimeout(t);
  }, [matchFlash]);

  if (profile === null || pantry === null || matches === null || staples === null) {
    return (
      <Shell tab={tab} setTab={setTab} matchCount={0} hhCode={null} onHousehold={() => {}} onAddRecipe={() => {}} onFavorites={() => {}} favCount={0}>
        <style>{FONTS}</style>
        <Center><p style={{ color: C.faint, animation: "pulse 1.4s infinite" }}>Warming up…</p></Center>
      </Shell>
    );
  }

  return (
    <Shell tab={tab} setTab={setTab} matchCount={matches.length} hhCode={profile.code} onHousehold={() => setHhOpen(true)} onAddRecipe={() => setRecipeSheet(true)} onFavorites={() => setFavSheet(true)} favCount={(matches || []).filter((m) => m.fav).length}>
      <style>{FONTS}</style>
      {favSheet && (
        <FavSheet
          matches={matches || []}
          onClose={() => setFavSheet(false)}
          onOpen={(savedAt) => { setOpenTarget(savedAt); setTab("matches"); }}
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
          code={profile.code} poolCount={community.length}
          onCreate={createHousehold} onJoin={joinHousehold}
          onLeave={leaveHousehold} onClose={() => setHhOpen(false)}
        />
      )}
      {matchFlash && (
        <MatchFlash
          card={matchFlash.card}
          onCook={() => {
            setOpenTarget(matchFlash.savedAt);
            setMatchFlash(null);
            setTab("matches");
          }}
        />
      )}
      {tab === "pantry" && <PantryTab pantry={pantry} persist={persistPantry} staples={staples} persistStaples={persistStaples} shopping={shopping} persistShopping={persistShopping} matches={matches} stockCounts={stockCounts} bumpStock={bumpStock} />}
      {tab === "swipe" && (
        <SwipeTab
          pantry={pantry.filter((x) => !x.out)} deck={deck} exhausted={exhausted} onResetSeen={resetSeen}
          allRecipes={allRecipes} staples={staples} persistPantry={persistPantry}
          mode={mode} swipes={swipes} cuisines={cuisines} maxTime={maxTime} mealType={mealType}
          canUndo={history.length > 0} onUndo={undoSwipe}
          setCuisines={(next) => { setCuisines(next); softReset(); }}
          setMaxTime={(t) => { setMaxTime(t); softReset(); }}
          setMealType={(t) => { setMealType(t); softReset(); }}
          setMode={(m) => { setMode(m); modeReset(); }}
          onDeal={() => dealCards(swipes, seen, false)}
          onSwipe={handleSwipe} onReset={resetSession}
          goPantry={() => setTab("pantry")}
        />
      )}
      {tab === "matches" && (
        <MatchesTab
          matches={matches} persist={persistMatches} pantry={pantry} bumpStock={bumpStock}
          persistPantry={persistPantry} staples={staples}
          shopping={shopping} persistShopping={persistShopping}
          openTarget={openTarget} clearOpenTarget={() => setOpenTarget(null)}
        />
      )}
    </Shell>
  );
}

/* ----------------------------- Shell ------------------------------ */

function Shell({ tab, setTab, matchCount, hhCode, onHousehold, onAddRecipe, onFavorites, favCount, children }) {
  const tabs = [
    { id: "pantry", label: "Pantry", emoji: "🧺" },
    { id: "swipe", label: "Swipe", emoji: "🔥" },
    { id: "matches", label: "Matches", emoji: "💚" },
  ];
  return (
    <div style={{
      fontFamily: "'Outfit', sans-serif", background: C.bg, color: C.ink,
      height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <header style={{ padding: "10px 20px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26, letterSpacing: "-0.02em",
          background: `linear-gradient(90deg, ${C.green}, ${C.gold})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Simmer
        </span>
        <button onClick={onHousehold} style={{
          marginLeft: "auto", border: `1.5px solid ${hhCode ? C.green : C.line}`,
          background: hhCode ? C.greenSoft : "#fff", color: hhCode ? C.green : C.faint,
          borderRadius: 99, padding: "5px 11px", fontFamily: "inherit",
          fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}>
          👥 {hhCode || "Solo"}
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
        }}>♥{favCount ? ` ${favCount}` : ""}</button>
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

function MatchFlash({ card, onCook }) {
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
      <span style={{ color: "#fff", fontSize: 18 }}>→</span>
    </div>
  );
}

/* ------------------------- household panel ------------------------ */

function HouseholdPanel({ code, poolCount, onCreate, onJoin, onLeave, onClose }) {
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
            <button onClick={doCreate} disabled={busy} style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${C.green}, #0DA35C)`, color: "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
              marginBottom: 12, opacity: busy ? 0.6 : 1,
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
              <button onClick={doJoin} disabled={busy} style={{
                padding: "0 16px", borderRadius: 12, border: `1.5px solid ${C.green}`,
                background: "#fff", color: C.green, fontFamily: "inherit", fontWeight: 700,
                fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1,
              }}>Join</button>
            </div>
            <p style={{ fontSize: 12, color: C.faint, margin: "10px 0 0" }}>
              Household data is visible to everyone with the code.
            </p>
          </>
        )}
        {err && <p style={{ color: C.red, fontSize: 13, fontWeight: 600, margin: "10px 0 0" }}>{err}</p>}
        {poolCount > 0 && (
          <p style={{ fontSize: 12, color: C.faint, margin: "12px 0 0", textAlign: "center" }}>
            📚 {poolCount} recipes in the community pool
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Pantry tab --------------------------- */

/* ------------------------- Custom recipes ------------------------- */

const MEAL_IDS = ["breakfast", "lunch", "dinner", "dessert", "snack"];

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
      emoji: form.emoji.trim() || "🍲", minutes: mins, mealType: form.meal,
      desc: form.desc.trim() || "A household original.", tags: ["custom"],
      ingredients: core, serves, ingFull: ing, steps, macros, custom: true,
    };
    await onSave([entry]);
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
                <button onClick={() => onDelete(r.repoId)} aria-label={`Delete ${r.name}`} style={{ border: "none", background: C.redSoft, color: C.red, borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}


function FavSheet({ matches, onClose, onOpen }) {
  const favs = matches.filter((m) => m.fav);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(30,43,32,.35)", zIndex: 80, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.bg, borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "80%",
        overflowY: "auto", padding: "18px 20px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, flex: 1, color: "#FF4466" }}>♥ Favorites</span>
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

function PantryTab({ pantry, persist, staples, persistStaples, shopping, persistShopping, matches, stockCounts, bumpStock }) {
  const [subTab, setSubTab] = useState("items");
  const [name, setName] = useState("");
  const [listAdd, setListAdd] = useState("");
  const [search, setSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(pantry.length === 0);
  const [toast, setToast] = useState(null);
  const pantryRef = useRef(pantry);
  pantryRef.current = pantry;
  const shoppingRef = useRef(shopping);
  shoppingRef.current = shopping;
  const toastTimer = useRef(null);

  const showToast = (msg, action = null) => {
    setToast({ msg, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 3000 : 1500);
  };

  const addNames = (names) => {
    const cleaned = names.map((s) => s.trim()).filter(Boolean)
      .filter((n) => !pantry.some((p) => p.name.toLowerCase() === n.toLowerCase()));
    if (!cleaned.length) return;
    const base = Date.now();
    const newItems = cleaned.map((n, i) => {
      const guess = localGuess(n);
      return { id: base + i, name: n, cat: guess || "other", useSoon: false, out: false };
    });
    persist([...newItems, ...pantry]);
    bumpStock(cleaned, Object.fromEntries(newItems.map((it) => [it.name, it.cat])));
  };

  const add = () => { addNames(name.split(",")); setName(""); };

  const addToShopping = (itemName) => {
    const cur = shoppingRef.current;
    if (cur.some((s) => norm(s) === norm(itemName))) {
      showToast(`${itemName} already on the list 🛒`);
      return;
    }
    persistShopping([...cur, itemName]);
    showToast(`${itemName} → shopping list 🛒`);
  };
  const onList = (n) => shopping.some((s) => norm(s) === norm(n));
  const isStaple = (n) => staples.some((s) => norm(s) === norm(n));
  const hidden = (n) => onList(n) || isStaple(n);

  const toggleOut = (id) => {
    const item = pantry.find((p) => p.id === id);
    if (!item) return;
    persist(pantry.map((p) => (p.id === id ? { ...p, out: !p.out } : p)));
    if (item.out) {
      showToast(`✓ ${item.name} selected`, { label: "⏰ use soon", fn: () => toggleSoon(id) });
    }
  };

  const toggleSoon = (id) => persist(pantryRef.current.map((p) => (p.id === id ? { ...p, useSoon: !p.useSoon } : p)));
  const removeItem = (id) => persist(pantryRef.current.filter((p) => p.id !== id));

  const inPantry = (n) => pantry.some((p) => p.name.toLowerCase() === n.toLowerCase());
  const q = search.trim().toLowerCase();
  const grouped = CATEGORIES.map((c) => ({
    ...c, items: pantry.filter((p) =>
      p.cat === c.id &&
      !hidden(p.name) &&
      (!q || p.name.toLowerCase().includes(q))
    ),
  })).filter((g) => g.items.length);

  const stockedNames = pantry.filter((p) => !p.out).map((p) => p.name);

  const gotIt = (g) => {
    if (isStaple(g.ing)) {
      if (g.manual) persistShopping(shopping.filter((s) => norm(s) !== norm(g.ing)));
      showToast(`✓ ${g.ing} restocked (staple)`);
      return;
    }
    const existing = pantry.find((p) => p.name.toLowerCase() === g.ing.toLowerCase());
    if (existing) persist(pantry.map((p) => (p.id === existing.id ? { ...p, out: false } : p)));
    else {
      const guess = localGuess(g.ing);
      persist([{ id: Date.now(), name: g.ing, cat: guess || "other", useSoon: false, out: false }, ...pantry]);
    }
    if (g.manual) persistShopping(shopping.filter((s) => norm(s) !== norm(g.ing)));
    bumpStock([g.ing]);
    showToast(`✓ ${g.ing} → pantry`);
  };
  const addListItems = () => {
    const items = listAdd.split(",").map((s) => s.trim()).filter(Boolean)
      .filter((n) => !shopping.some((s) => norm(s) === norm(n)));
    if (items.length) persistShopping([...shopping, ...items]);
    setListAdd("");
  };

  const subTabs = [
    { id: "items", label: `🧺 Pantry` },
    { id: "staples", label: `🧂 Staples` },
    { id: "list", label: `🛒 List${shopping.length ? ` (${shopping.length})` : ""}` },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px" }}>
      {toast && (
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
      )}

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
              {(() => {
                // learn from behavior: items stocked 3+ times join their category group
                const staticNorms = new Set(QUICK_ADD.flatMap((g) => g.items.map((n) => norm(n))));
                const learned = Object.values(stockCounts || {})
                  .filter((e) => e.n >= 3 && !staticNorms.has(norm(e.name)))
                  .sort((a, b) => b.n - a.n)
                  .slice(0, 15);
                const extras = {};
                for (const e of learned) (extras[e.cat] = extras[e.cat] || []).push(e.name);
                return QUICK_ADD.map((g) => ({ ...g, items: [...(extras[g.cat] || []), ...g.items] }));
              })().map((g) => {
                const meta = CATEGORIES.find((c) => c.id === g.cat);
                if (g.items.every((n) => hidden(n))) return null;
                return (
                  <div key={g.cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {g.items.filter((n) => !hidden(n)).map((n) => {
                        const existing = pantry.find((p) => p.name.toLowerCase() === n.toLowerCase());
                        return (
                          <SmartChip
                            key={n}
                            p={existing || { name: n, out: true, useSoon: false }}
                            isNew={!existing}
                            onTap={() => (existing ? toggleOut(existing.id) : addNames([n]))}
                            onSwipeRight={() => addToShopping(n)}
                          />
                        );
                      })}
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
            <p style={{ fontSize: 11.5, color: C.faint, margin: "0 0 10px" }}>
              Tap to mark used · long-press to delete
            </p>
          )}

          {grouped.map((g) => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                {g.emoji} {g.label} · {g.items.filter((p) => !p.out).length}/{g.items.length}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {g.items.map((p) => (
                  <SmartChip
                    key={p.id}
                    p={p}
                    onTap={() => toggleOut(p.id)}
                    onSwipeRight={() => addToShopping(p.name)}
                    onDelete={() => removeItem(p.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "staples" && (
        <StaplesEditor staples={staples} persistStaples={persistStaples} />
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {shopping.map((item) => (
                <span key={item} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  border: `1.5px solid ${C.pink}`, background: "#FFF0F3",
                  borderRadius: 99, padding: "5px 6px 5px 12px", fontSize: 13.5, fontWeight: 600, color: C.ink,
                }}>
                  <button onClick={() => gotIt({ ing: item, manual: true })} style={{
                    border: "none", background: "transparent", fontFamily: "inherit", fontWeight: 600,
                    fontSize: 13.5, color: C.ink, cursor: "pointer", padding: 0,
                  }}>{item}</button>
                  <button onClick={() => persistShopping(shopping.filter((s) => norm(s) !== norm(item)))} aria-label={`Remove ${item}`} style={{
                    border: "none", background: "#F3F1E8", color: C.faint, borderRadius: "50%",
                    width: 19, height: 19, fontSize: 10, cursor: "pointer", lineHeight: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SmartChip({ p, isNew, onTap, onSwipeRight, onDelete }) {
  const [dx, setDx] = useState(0);
  const startX = useRef(null);
  const movedRef = useRef(false);
  const handledRef = useRef(0);
  const THRESHOLD = 52;

  const finish = (d) => {
    handledRef.current = Date.now();
    setDx(0);
    startX.current = null;
    if (d >= THRESHOLD) onSwipeRight();
    else if (!movedRef.current) onTap();
  };

  const down = (e) => {
    startX.current = e.clientX;
    movedRef.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    if (startX.current === null) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 8) movedRef.current = true;
    setDx(Math.max(0, Math.min(d, 84)));
  };
  const up = () => { if (startX.current !== null) finish(dx); };
  const cancel = () => { startX.current = null; setDx(0); };
  const click = () => {
    // fallback for webviews that never fire pointerup
    if (Date.now() - handledRef.current < 500) return;
    setDx(0); startX.current = null;
    onTap();
  };

  const armed = dx >= THRESHOLD;
  const pull = Math.min(dx / THRESHOLD, 1);
  const on = !isNew && !p.out;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}>
      {dx > 5 && (
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
          fontWeight: on ? 700 : 500, cursor: "pointer", position: "relative", zIndex: 1,
          userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          touchAction: "pan-y",
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform .18s ease, background .12s ease, border-color .12s ease" : "none",
          border: armed ? `1.5px solid ${C.pink}` : on ? `1.5px solid ${p.useSoon ? C.gold : C.green}` : `1.5px solid ${C.line}`,
          background: armed ? "#FFF0F3" : on ? (p.useSoon ? C.goldSoft : C.greenSoft) : "#fff",
          color: armed ? C.pink : on ? (p.useSoon ? "#9A6700" : "#0B7A46") : C.ink,
        }}>
        {isNew ? "+ " : on ? (p.useSoon ? "⏰ " : "✓ ") : ""}{p.name}
        {p.sorting && <span style={{ fontSize: 10, marginLeft: 4, animation: "pulse 1.2s infinite" }}>…</span>}
      </button>
      {onDelete && !isNew && p.out && (
        <button type="button" onClick={onDelete} aria-label={`Delete ${p.name}`} style={{
          border: "none", background: "#F3F1E8", color: C.faint, borderRadius: "50%",
          width: 20, height: 20, fontSize: 10, cursor: "pointer", lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>✕</button>
      )}
    </span>
  );
}

const toolbarBtn = (color) => ({
  border: "none", background: "transparent", color, fontFamily: "'Outfit', sans-serif",
  fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0,
});

function StaplesEditor({ staples, persistStaples }) {
  const [adding, setAdding] = useState("");
  const removeStaple = (s) => persistStaples(staples.filter((x) => x !== s));
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
              <span key={s} style={{
                background: "#fff", border: `1px solid ${C.line}`, borderRadius: 99,
                padding: "3px 6px 3px 8px", fontSize: 12.5, fontWeight: 500, color: C.ink,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {s}
                <button onClick={() => removeStaple(s)} aria-label={`Remove ${s}`} style={{
                  border: "none", background: "#F3F1E8", color: C.faint, borderRadius: "50%",
                  width: 16, height: 16, fontSize: 10, cursor: "pointer", lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </span>
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
    persistPantry([{ id: Date.now(), name, cat: localGuess(name) || "other", useSoon: false, out: false }, ...pantry]);
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
        {canUndo && (
          <button onClick={onUndo} aria-label="Undo last swipe" style={{
            flexShrink: 0, border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink,
            borderRadius: 99, padding: "5px 11px", fontFamily: "inherit",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>↩️</button>
        )}
        {swipes.length > 0 && (
          <button onClick={onReset} style={{
            flexShrink: 0, border: "none", background: "transparent", color: C.faint,
            fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
          }}>reset</button>
        )}
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

      {(() => {
        if (cuisines.length || deck.length === 0) return null;
        const counts = {};
        for (const s of swipes) if (s.dir === "right" && s.cuisine) counts[s.cuisine.toLowerCase()] = (counts[s.cuisine.toLowerCase()] || 0) + 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
        if (Object.values(counts).reduce((a, b) => a + b, 0) < 2) return null;
        return (
          <div style={{ textAlign: "center", fontSize: 12, color: C.faint, fontWeight: 700, padding: "0 20px 4px", flexShrink: 0 }}>
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
              .filter((r) => !mealType || r.mealType === mealType);
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
                {card.wildcard && <span style={pill(C.purple, "#fff")}>🃏 wildcard</span>}
                {card.custom && <span style={pill(C.gold, "#fff")}>🏠 custom</span>}
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
              <div style={{ height: 1, background: C.line, margin: "4px 0", flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                Ingredients · serves {card.serves || 2}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                {(card.ingFull || []).map((row, i) => {
                  const qty = row[0] != null ? row[0] : "";
                  const unit = row[1] || "";
                  const name = row[2] || "";
                  const displayText = [qty, unit, name].filter(Boolean).join(" ");
                  return (
                    <span key={i} style={{
                      background: "#FFFFFFD0", border: `1px solid ${C.line}`,
                      borderRadius: 99, padding: "3px 9px", fontSize: 12, fontWeight: 600, color: C.ink,
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
              {card.macros && (
                <div style={{ fontSize: 11.5, color: C.faint, flexShrink: 0, marginTop: 2 }}>
                  {card.macros.cal} cal · {card.macros.p}g protein · {card.macros.c}g carbs · {card.macros.f}g fat per serving
                </div>
              )}
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

function MatchesTab({ matches, persist, pantry, persistPantry, staples, shopping, persistShopping, openTarget, clearOpenTarget, bumpStock }) {
  const [openId, setOpenId] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [servesMap, setServesMap] = useState({}); // savedAt -> chosen servings
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

  const markUsed = (m) => {
    const used = m.uses || [];
    persistPantry(pantry.map((p) => (used.some((u) => ingMatch(p.name, u)) ? { ...p, out: true } : p)));
  };

  const pickDinner = () => {
    if (matches.length < 2 || spinning) return;
    setSpinning(true);
    let ticks = 0;
    const iv = setInterval(() => {
      setHighlightId(matches[Math.floor(Math.random() * matches.length)].savedAt);
      ticks++;
      if (ticks > 9) {
        clearInterval(iv);
        const chosen = matches[Math.floor(Math.random() * matches.length)];
        setHighlightId(chosen.savedAt);
        setSpinning(false);
        openMatch(chosen);
        setTimeout(() => setHighlightId(null), 1600);
      }
    }, 120);
  };

  const stockedNames = pantry.filter((p) => !p.out).map((p) => p.name);

  const gotIt = (g) => {
    if (isStaple(g.ing)) {
      if (g.manual) persistShopping(shopping.filter((s) => norm(s) !== norm(g.ing)));
      showToast(`✓ ${g.ing} restocked (staple)`);
      return;
    }
    const existing = pantry.find((p) => p.name.toLowerCase() === g.ing.toLowerCase());
    if (existing) persistPantry(pantry.map((p) => (p.id === existing.id ? { ...p, out: false } : p)));
    else {
      const guess = localGuess(g.ing);
      persistPantry([{ id: Date.now(), name: g.ing, cat: guess || "other", useSoon: false, out: false }, ...pantry]);
    }
    if (g.manual) persistShopping(shopping.filter((s) => norm(s) !== norm(g.ing)));
    bumpStock([g.ing]);
  };

  if (matches.length === 0) {
    return (
      <Center>
        <div style={{ fontSize: 44, marginBottom: 10 }}>💚</div>
        <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>No matches yet</p>
        <p style={{ color: C.faint, fontSize: 14, maxWidth: 250 }}>
          Swipe right on recipes you like.
        </p>
      </Center>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 24px", position: "relative" }}>

      {matches.length >= 2 && (
        <button onClick={pickDinner} disabled={spinning} style={{
          width: "100%", padding: "12px 0", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
          color: "#fff", fontFamily: "inherit", fontWeight: 800,
          fontSize: 14, cursor: "pointer", marginBottom: 12,
          boxShadow: `0 6px 20px ${C.purple}44`,
        }}>{spinning ? "Picking…" : "🎲 Pick for me"}</button>
      )}

      {matches.map((m) => {
        const open = openId === m.savedAt;
        const usedInPantry = (m.uses || []).filter((u) =>
          pantry.some((p) => !p.out && ingMatch(p.name, u))
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
                <div style={{ fontSize: 12.5, color: C.faint, textTransform: "capitalize" }}>{m.fav ? "♥ " : ""}{m.custom ? "🏠 " : ""}{m.cuisine} · {m.minutes} min</div>
              </span>
              <span style={{ color: C.faint, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div style={{ padding: "14px 16px 16px" }}>
                {(() => {
                  const steps = m.steps || m.full?.steps || [];
                  const macros = m.macros || (m.full?.macros ? { cal: m.full.macros.calories, p: m.full.macros.protein_g, c: m.full.macros.carbs_g, f: m.full.macros.fat_g } : null);
                  const serves = servesMap[m.savedAt] || m.serves || 2;
                  const ings = m.ingFull ? scaledIng(m, serves) : (m.full?.ingredients || []);
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
                      </div>
                      {macros && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                          {[
                            { label: "kcal", val: macros.cal, bg: C.goldSoft, color: "#9A6700" },
                            { label: "protein", val: macros.p + "g", bg: C.greenSoft, color: C.green },
                            { label: "carbs", val: macros.c + "g", bg: "#DCE9FF", color: "#2E5DA8" },
                            { label: "fat", val: macros.f + "g", bg: C.redSoft, color: C.red },
                          ].map((s) => (
                            <div key={s.label} style={{
                              background: s.bg, borderRadius: 10, padding: "7px 11px",
                              textAlign: "center", minWidth: 62,
                            }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.val}</div>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                            </div>
                          ))}
                          <span style={{ fontSize: 10.5, color: C.faint, alignSelf: "flex-end", paddingBottom: 2 }}>per serving</span>
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
                  {(m.uses || []).some((u) => pantry.some((p) => !p.out && ingMatch(p.name, u))) && (
                    <button onClick={() => markUsed(m)} style={{
                      padding: "9px 14px", borderRadius: 14, border: `1.5px solid ${C.green}`,
                      background: C.greenSoft, color: C.green, fontFamily: "inherit",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>✓ Used</button>
                  )}
                  {m.missing?.length > 0 && (
                    <button onClick={() => {
                      const newItems = (m.missing || []).filter((ing) =>
                        !shopping.some((s) => norm(s) === norm(ing))
                      );
                      if (newItems.length) {
                        persistShopping([...shopping, ...newItems]);
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
