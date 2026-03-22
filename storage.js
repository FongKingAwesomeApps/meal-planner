// ── storage.js ────────────────────────────────────────────────────────────────
// localStorage abstraction with UTF-8 safe base64 for backup/restore
// All keys are namespaced under 'mp_' to avoid collisions

const KEYS = {
  FAMILY:      'mp_family_v1',
  CUSTOM_MEALS:'mp_custom_meals_v1',
  WEEK_PLAN:   'mp_week_plan_v1',
  SELECTED:    'mp_selected_v1',
  FAVOURITES:  'mp_favourites_v1',
  SETTINGS:    'mp_settings_v1',
};

// ── UTF-8 safe base64 ─────────────────────────────────────────────────────────
function b64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64Decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

// ── Core get/set ──────────────────────────────────────────────────────────────
function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(key); return true; }
  catch { return false; }
}

// ── Domain helpers ────────────────────────────────────────────────────────────
function getFamily() {
  return get(KEYS.FAMILY, [
    { name: 'Jenn',    role: 'Coordinator', type: 'open',     colour: '#007aff' },
    { name: 'Seth',    role: 'Household',   type: 'decision', colour: '#34c759' },
    { name: 'Jared',   role: 'Household',   type: 'decision', colour: '#ff9500' },
    { name: 'Michael', role: 'Guest',       type: 'open',     colour: '#8e8e93' },
    { name: 'Rachael', role: 'Guest',       type: 'open',     colour: '#8e8e93' },
  ]);
}
function saveFamily(members) { return set(KEYS.FAMILY, members); }

function getCustomMeals() { return get(KEYS.CUSTOM_MEALS, []); }
function saveCustomMeals(meals) { return set(KEYS.CUSTOM_MEALS, meals); }

function getWeekPlan() { return get(KEYS.WEEK_PLAN, {}); }
function saveWeekPlan(plan) { return set(KEYS.WEEK_PLAN, plan); }

function getSelected() { return get(KEYS.SELECTED, {}); }
function saveSelected(selected) { return set(KEYS.SELECTED, selected); }

function getFavourites() { return new Set(get(KEYS.FAVOURITES, [])); }
function saveFavourites(favSet) { return set(KEYS.FAVOURITES, [...favSet]); }
function toggleFavourite(mealId) {
  const favs = getFavourites();
  favs.has(mealId) ? favs.delete(mealId) : favs.add(mealId);
  saveFavourites(favs);
  return favs.has(mealId);
}

// ── Backup / Restore ──────────────────────────────────────────────────────────
function createBackup() {
  const data = {
    version: 1,
    date: new Date().toLocaleDateString('en-CA'),
    family:      getFamily(),
    customMeals: getCustomMeals(),
    favourites:  [...getFavourites()],
  };
  return b64Encode(JSON.stringify(data));
}

function applyRestore(b64string) {
  try {
    const data = JSON.parse(b64Decode(b64string.trim()));
    if (!data.version) throw new Error('Invalid backup');
    if (data.family)      saveFamily(data.family);
    if (data.customMeals) saveCustomMeals(data.customMeals);
    if (data.favourites)  saveFavourites(new Set(data.favourites));
    return { ok: true, date: data.date };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export {
  KEYS,
  get, set, remove,
  getFamily, saveFamily,
  getCustomMeals, saveCustomMeals,
  getWeekPlan, saveWeekPlan,
  getSelected, saveSelected,
  getFavourites, saveFavourites, toggleFavourite,
  createBackup, applyRestore,
};
