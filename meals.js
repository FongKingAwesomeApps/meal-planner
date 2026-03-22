// ── meals.js ──────────────────────────────────────────────────────────────────
// Loads meals.json asynchronously, merges custom meals, exposes query helpers.

const BASE_URL = '/meal-planner/data/meals.json';

let _meals = [];       // master library (library + custom)
let _loaded = false;
let _callbacks = [];

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadMeals(customMeals = []) {
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const library = await res.json();
    _meals = [...library, ...customMeals.map(m => ({ ...m, custom: true }))];
    _loaded = true;
    _callbacks.forEach(fn => fn(_meals));
    _callbacks = [];
    return _meals;
  } catch (e) {
    console.error('meals.js: failed to load', e);
    // Fall back to custom meals only so app still works offline
    _meals = customMeals.map(m => ({ ...m, custom: true }));
    _loaded = true;
    _callbacks.forEach(fn => fn(_meals));
    _callbacks = [];
    return _meals;
  }
}

// Call fn immediately if loaded, otherwise queue it
function onLoaded(fn) {
  if (_loaded) fn(_meals);
  else _callbacks.push(fn);
}

function allMeals()  { return _meals; }
function isLoaded()  { return _loaded; }

// ── Rating engine ─────────────────────────────────────────────────────────────
// 5-factor majority-rules system
// Returns 'light' | 'balanced' | 'indulgent'
function rateHealth(macros) {
  if (!macros) return 'balanced';
  const { sodium = 0, satFat = 0, fibre = 0, protein = 0, sugar = 0 } = macros;

  const scores = [
    sodium  < 600  ? 'light' : sodium  <= 900  ? 'balanced' : 'indulgent',
    satFat  < 5    ? 'light' : satFat  <= 9    ? 'balanced' : 'indulgent',
    fibre   > 6    ? 'light' : fibre   >= 3    ? 'balanced' : 'indulgent',
    protein > 35   ? 'light' : protein >= 25   ? 'balanced' : 'indulgent',
    sugar   < 8    ? 'light' : sugar   <= 15   ? 'balanced' : 'indulgent',
  ];

  const counts = { light: 0, balanced: 0, indulgent: 0 };
  scores.forEach(s => counts[s]++);
  const max = Math.max(...Object.values(counts));

  // Ties go worse
  if (counts.indulgent === max) return 'indulgent';
  if (counts.balanced  === max) return 'balanced';
  return 'light';
}

// Canadian Food Guide badge: 4 of 5 factors must hit threshold
function rateCFG(macros) {
  if (!macros) return false;
  const { sodium = 0, satFat = 0, sugar = 0, fibre = 0, protein = 0 } = macros;
  const hits = [
    sodium  < 700,
    satFat  < 7,
    sugar   < 12,
    fibre   >= 4,
    protein >= 25,
  ].filter(Boolean).length;
  return hits >= 4;
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function getMeal(id) {
  return _meals.find(m => m.id === id) || null;
}

function filterMeals({ rating, category, search, favourites } = {}) {
  return _meals.filter(m => {
    const health = m.healthOverride || rateHealth(m.macros);
    if (rating && health !== rating) return false;
    if (category && m.cat !== category) return false;
    if (favourites && !favourites.has(m.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function getMealsByCategory() {
  const map = {};
  _meals.forEach(m => {
    if (!map[m.cat]) map[m.cat] = [];
    map[m.cat].push(m);
  });
  return map;
}

// Generate a unique ID for a new custom meal
function newMealId() {
  let id = Date.now() % 1000000;
  while (_meals.find(m => m.id === id)) id++;
  return id;
}

// ── Label helpers ─────────────────────────────────────────────────────────────
const RATING_LABELS = { light: 'Light', balanced: 'Balanced', indulgent: 'Indulgent' };
const CAT_LABELS = {
  pasta:    'Pasta & Italian',
  chicken:  'Chicken',
  pork:     'Pork',
  beef:     'Beef',
  fish:     'Fish & Seafood',
  comfort:  'Comfort & Casual',
  crockpot: 'Crockpot & Slow Cook',
  camping:  'Camping',
};
const CAT_ORDER = ['pasta','chicken','pork','beef','fish','comfort','crockpot','camping'];

export {
  loadMeals, onLoaded, allMeals, isLoaded,
  rateHealth, rateCFG,
  getMeal, filterMeals, getMealsByCategory, newMealId,
  RATING_LABELS, CAT_LABELS, CAT_ORDER,
};
