// Simmer recipe repository — 405 vegetarian (egg-free) recipes across 31 cuisine tracks + fusion.
// Edit any batch file to update recipes; keep ids unique.
import b1 from "./recipes1.js";
import b2 from "./recipes2.js";
import b3 from "./recipes3.js";
import b4 from "./recipes4.js";
import b5 from "./recipes5.js";
import b6 from "./recipes6.js";
import b7 from "./recipes7.js";
import b8 from "./recipes8.js";
import b9 from "./recipes9.js";
import b10 from "./recipes10.js";
import b11 from "./recipes11.js";
import b12 from "./recipes12.js";
import b13 from "./recipes13.js";

export const RECIPES = [...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7, ...b8, ...b9, ...b10, ...b11, ...b12, ...b13];

export const CUISINES = [...new Set(RECIPES.map((r) => r.cuisine))];
