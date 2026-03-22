// ── storage.js ────────────────────────────────────────────────────────────────
// localStorage abstraction with UTF-8 safe base64 for backup/restore
// All keys namespaced under 'mp_' to avoid collisions
// v2: adds limits per member, partner field for guests, suggestions queue

const KEYS = {
  FAMILY:       'mp_family_v2',
  CUSTOM_MEALS: 'mp_custom_meals_v1',
  WEEK_PLAN:    'mp_week_plan_v1',
  SELECTED:     'mp_selected_v1',
  FAVOURITES:   'mp_favourites_v1',
  SUGGESTIONS:  'mp_suggestions_v1',
};

// ── Default family ─────────────────────────────────────────────────────────────
// Member schema:
//   name       string   display name
//   role       string   'Coordinator' | 'Household' | 'Guest'
//   type       string   'decision' = can pick meals in family app | 'open' = coordinator only
//   colour     string   hex for avatar
//   partner    string?  guest plus-one name shown as "Is NAME coming?"
//   limits     object   enforced hard limits in family app
//     .total        max picks per week
//     .maxIndulgent max Indulgent picks allowed
//     .minLight     min Light picks required before sending

const DEFAULT_FAMILY = [
  {
    name: 'Dave', role: 'Coordinator', type: 'decision', colour: '#007aff',
    limits: { total: 5, maxIndulgent: 2, minLight: 1 }
  },
  {
    name: 'Jenn', role: 'Household', type: 'decision', colour: '#ff2d55',
    limits: { total: 5, maxIndulgent: 2, minLight: 1 }
  },
  {
    name: 'Seth', role: 'Household', type: 'decision', colour: '#34c759',
    limits: { total: 3, maxIndulgent: 1, minLight: 1 }
  },
  {
    name: 'Jared', role: 'Household', type: 'decision', colour: '#ff9500',
    limits: { total: 3, maxIndulgent: 1, minLight: 1 }
  },
  {
    name: 'Michael', role: 'Guest', type: 'decision', colour: '#8e8e93',
    partner: '',
    limits: { total: 3, maxIndulgent: 1, minLight: 1 }
  },
  {
    name: 'Rachael', role: 'Guest', type: 'decision', colour: '#af52de',
    partner: '',
    limits: { total: 3, maxIndulgent: 1, minLight: 1 }
  },
];

// ── UTF-8 safe base64 ─────────────────────────────────────────────────────────
function b64Encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64Decode(str) { return decodeURIComponent(escape(atob(str))); }

// ── Core ──────────────────────────────────────────────────────────────────────
function get(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

// ── Family ────────────────────────────────────────────────────────────────────
function getFamily() { return get(KEYS.FAMILY, DEFAULT_FAMILY); }
function saveFamily(members) { return set(KEYS.FAMILY, members); }
function getMemberByName(name) { return getFamily().find(m => m.name === name) || null; }
function getCoordinator() { return getFamily().find(m => m.role === 'Coordinator') || getFamily()[0]; }
function getLimits(memberName) {
  const m = getMemberByName(memberName);
  return m?.limits || { total: 3, maxIndulgent: 1, minLight: 1 };
}
function updateMember(name, updates) {
  const family = getFamily();
  const idx = family.findIndex(m => m.name === name);
  if (idx < 0) return false;
  family[idx] = { ...family[idx], ...updates };
  return saveFamily(family);
}

// ── Meals ─────────────────────────────────────────────────────────────────────
function getCustomMeals() { return get(KEYS.CUSTOM_MEALS, []); }
function saveCustomMeals(meals) { return set(KEYS.CUSTOM_MEALS, meals); }

// ── Week plan ─────────────────────────────────────────────────────────────────
function getWeekPlan() { return get(KEYS.WEEK_PLAN, {}); }
function saveWeekPlan(plan) { return set(KEYS.WEEK_PLAN, plan); }

// ── Selected ──────────────────────────────────────────────────────────────────
function getSelected() { return get(KEYS.SELECTED, {}); }
function saveSelected(s) { return set(KEYS.SELECTED, s); }

// ── Favourites ────────────────────────────────────────────────────────────────
function getFavourites() { return new Set(get(KEYS.FAVOURITES, [])); }
function saveFavourites(s) { return set(KEYS.FAVOURITES, [...s]); }
function toggleFavourite(id) {
  const f = getFavourites();
  f.has(id) ? f.delete(id) : f.add(id);
  saveFavourites(f);
  return f.has(id);
}

// ── Suggestions ───────────────────────────────────────────────────────────────
function getSuggestions() { return get(KEYS.SUGGESTIONS, []); }
function saveSuggestions(list) { return set(KEYS.SUGGESTIONS, list); }
function addSuggestion(s) {
  const list = getSuggestions();
  list.push({ ...s, id: Date.now(), date: new Date().toLocaleDateString('en-CA'), status: 'pending' });
  return saveSuggestions(list);
}
function removeSuggestion(id) { return saveSuggestions(getSuggestions().filter(s => s.id !== id)); }

// ── Backup / Restore ──────────────────────────────────────────────────────────
function createBackup() {
  return b64Encode(JSON.stringify({
    version: 2,
    date: new Date().toLocaleDateString('en-CA'),
    family: getFamily(),
    customMeals: getCustomMeals(),
    favourites: [...getFavourites()],
  }));
}
function applyRestore(b64) {
  try {
    const d = JSON.parse(b64Decode(b64.trim()));
    if (!d.version) throw new Error('Invalid backup');
    if (d.family)      saveFamily(d.family);
    if (d.customMeals) saveCustomMeals(d.customMeals);
    if (d.favourites)  saveFavourites(new Set(d.favourites));
    return { ok: true, date: d.date };
  } catch (e) { return { ok: false, error: e.message }; }
}

export {
  KEYS, DEFAULT_FAMILY,
  get, set, remove,
  getFamily, saveFamily, getMemberByName, getCoordinator, getLimits, updateMember,
  getCustomMeals, saveCustomMeals,
  getWeekPlan, saveWeekPlan,
  getSelected, saveSelected,
  getFavourites, saveFavourites, toggleFavourite,
  getSuggestions, saveSuggestions, addSuggestion, removeSuggestion,
  createBackup, applyRestore,
};
