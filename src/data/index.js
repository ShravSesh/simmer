// Simmer recipe repository — vegetarian recipes across 31 cuisine tracks + fusion.
// Egg-free throughout EXCEPT the four cards in batch 18 (cp12-cp15), which the
// household's prep book asked for; those carry tags:["egg"] so they stay easy
// to filter out.
//
// kid:true marks a recipe as child-friendly. It is set on every dish in the
// Chef Prep Recipe Book — batch 18 in full, plus the existing recipes the book
// already covered.
// Every cuisine carries at least 15 recipes; keep it that way when adding tracks.
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
import b14 from "./recipes14.js";
import b15 from "./recipes15.js";
import b16 from "./recipes16.js";
import b17 from "./recipes17.js";
import b18 from "./recipes18.js";

export const RECIPES = [...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7, ...b8, ...b9, ...b10, ...b11, ...b12, ...b13, ...b14, ...b15, ...b16, ...b17, ...b18];

export const CUISINES = [...new Set(RECIPES.map((r) => r.cuisine))];
