// ── sync.js ───────────────────────────────────────────────────────────────────
// Syncs shared family state with the Cloudflare Worker backend.
// Wraps storage.js — reads from localStorage first (fast), syncs in background.
//
// Usage:
//   import * as Sync from './js/sync.js';
//   await Sync.init();           // call once on app boot
//   Sync.getFamilyId()           // returns the familyId from the URL
//   Sync.pull()                  // fetch latest state from server
//   Sync.push(field, value)      // write a field to server
//   Sync.sendPicks(name, ids)    // submit picks to server (with push notification)
//   Sync.sendSuggestion(data)    // submit suggestion to server

import * as Store from './storage.js';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = 'https://meal-planner-api.davekingca.workers.dev';

// ── State ─────────────────────────────────────────────────────────────────────
let _familyId   = null;
let _apiBase    = API_BASE;
let _syncing    = false;
let _lastPull   = 0;
const PULL_INTERVAL_MS = 30_000; // pull at most every 30 seconds

// ── Init ──────────────────────────────────────────────────────────────────────
// Call once on app boot. Reads familyId from URL params.
async function init() {
  // Read fid from query string OR hash (hash is preserved by iOS when adding to home screen)
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace('#',''));
  _familyId = params.get('fid') || hashParams.get('fid') || localStorage.getItem('mp_family_id') || null;

  if (_familyId) {
    // Persist so it survives navigation
    localStorage.setItem('mp_family_id', _familyId);
    // Pull latest state from server in background
    pull().catch(() => {}); // non-blocking
  }

  return _familyId;
}

function getFamilyId() { return _familyId; }
function isConnected()  { return !!_familyId; }

function getCoordinatorURL() {
  if (!_familyId) return window.location.origin + '/meal-planner/';
  return window.location.origin + '/meal-planner/?fid=' + _familyId;
}

function getFamilyAppURL() {
  if (!_familyId) return window.location.origin + '/meal-planner/family.html';
  return window.location.origin + '/meal-planner/family.html?fid=' + _familyId;
}

// Direct app URLs (for sharing as links, not home screen)
function getCoordinatorDirectURL() {
  if (!_familyId) return window.location.origin + '/meal-planner/';
  return window.location.origin + '/meal-planner/?fid=' + _familyId;
}

function getFamilyAppDirectURL() {
  if (!_familyId) return window.location.origin + '/meal-planner/family.html';
  return window.location.origin + '/meal-planner/family.html?fid=' + _familyId;
}

// ── Pull — fetch latest state from server ─────────────────────────────────────
async function pull() {
  if (!_familyId) return null;
  if (_syncing)   return null;

  const now = Date.now();
  if (now - _lastPull < PULL_INTERVAL_MS) return null; // throttle

  _syncing  = true;
  _lastPull = now;

  try {
    const res  = await fetch(`${_apiBase}/family/${_familyId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Merge server state into localStorage
    // Server is authoritative for shared fields
    if (data.weekPlan)    Store.saveWeekPlan(data.weekPlan);
    if (data.family?.length) Store.saveFamily(data.family);
    if (data.customMeals) Store.saveCustomMeals(data.customMeals);

    // Queue pending picks for approval sheet
    if (data.picks?.length) {
      const pending = data.picks.filter(p => p.status === 'pending');
      if (pending.length) {
        localStorage.setItem('mp_pending_picks', JSON.stringify(pending));
      }
    }

    // Queue pending suggestions
    if (data.suggestions?.length) {
      const pending = data.suggestions.filter(s => s.status === 'pending');
      localStorage.setItem('mp_pending_suggestions', JSON.stringify(pending));
    }

    _syncing = false;
    return data;
  } catch (e) {
    _syncing = false;
    console.warn('Sync pull failed (offline?):', e.message);
    return null;
  }
}

// ── Push — write a field update to server ─────────────────────────────────────
async function push(updates) {
  if (!_familyId) return false;
  try {
    const res = await fetch(`${_apiBase}/family/${_familyId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updates),
    });
    return res.ok;
  } catch (e) {
    console.warn('Sync push failed (offline?):', e.message);
    return false;
  }
}

// ── Convenience push wrappers ─────────────────────────────────────────────────
async function pushWeekPlan(plan) {
  Store.saveWeekPlan(plan);          // save locally immediately
  return push({ weekPlan: plan });   // sync to server
}

async function pushFamily(members) {
  Store.saveFamily(members);
  return push({ family: members });
}

async function pushCustomMeals(meals) {
  Store.saveCustomMeals(meals);
  return push({ customMeals: meals });
}

// ── Picks (family app → coordinator) ─────────────────────────────────────────
// Called from the family app when Seth/Jared tap Send
async function sendPicks(name, mealIds, message = '') {
  if (!_familyId) {
    // Fallback: use URL-based picks (existing behaviour)
    return { method: 'url', url: buildPicksURL(name, mealIds, message) };
  }
  try {
    const res = await fetch(`${_apiBase}/family/${_familyId}/pick`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from:           name,
        mealIds,
        message,
        coordinatorUrl: getCoordinatorURL(),
      }),
    });
    if (res.ok) return { method: 'server', ok: true };
    throw new Error('HTTP ' + res.status);
  } catch (e) {
    // Fallback to URL
    console.warn('sendPicks server failed, falling back to URL:', e.message);
    return { method: 'url', url: buildPicksURL(name, mealIds, message) };
  }
}

// ── Suggestions (family app → coordinator) ────────────────────────────────────
async function sendSuggestion(name, type, content) {
  if (!_familyId) {
    // Fallback: package into URL
    const data = btoa(JSON.stringify({ from: name, type, content }));
    return { method: 'url', url: getCoordinatorURL() + '&suggestion=' + encodeURIComponent(data) };
  }
  try {
    const res = await fetch(`${_apiBase}/family/${_familyId}/suggest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: name, type, content, coordinatorUrl: getCoordinatorURL() }),
    });
    if (res.ok) return { method: 'server', ok: true };
    throw new Error('HTTP ' + res.status);
  } catch (e) {
    const data = btoa(JSON.stringify({ from: name, type, content }));
    return { method: 'url', url: getCoordinatorURL() + '&suggestion=' + encodeURIComponent(data) };
  }
}

// ── Push notification subscription ───────────────────────────────────────────
async function subscribePush(name, role = 'coordinator') {
  if (!_familyId || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'not supported' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: await getVapidPublicKey(),
    });

    const res = await fetch(`${_apiBase}/family/${_familyId}/push/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, role, subscription: sub.toJSON() }),
    });

    return { ok: res.ok };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function getVapidPublicKey() {
  const res  = await fetch(`${_apiBase}/vapid-public-key`);
  if (!res.ok) throw new Error('Could not fetch VAPID key');
  const data = await res.json();
  if (!data.key) throw new Error('No VAPID key in response');
  return urlBase64ToUint8Array(data.key);
}

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData  = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ── URL-based picks fallback (used when no fid) ───────────────────────────────
function buildPicksURL(name, mealIds, message) {
  const COORDINATOR = getCoordinatorURL();
  const url = new URL(COORDINATOR);
  url.searchParams.set('picks', `${encodeURIComponent(name)}:${mealIds.join(',')}`);
  if (message) url.searchParams.set('msg', message);
  return url.toString();
}

// ── Family ID generation (coordinator first-run) ──────────────────────────────
function generateFamilyId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rand  = () => chars[Math.floor(Math.random() * chars.length)];
  return 'fam-' + Array.from({length:8}, rand).join('');
}

function setFamilyId(id) {
  _familyId = id;
  localStorage.setItem('mp_family_id', id);
  // Write to BOTH query string and hash so it works in browser and PWA
  const url = new URL(window.location.href);
  url.searchParams.set('fid', id);
  url.hash = 'fid=' + id;
  window.history.replaceState({}, '', url.toString());
}

export {
  init, getFamilyId, isConnected,
  getCoordinatorURL, getFamilyAppURL,
  getCoordinatorDirectURL, getFamilyAppDirectURL,
  pull, push,
  pushWeekPlan, pushFamily, pushCustomMeals,
  sendPicks, sendSuggestion,
  subscribePush,
  generateFamilyId, setFamilyId,
  notifyFamily,
};

// Notify family members when plan is published or picks approved
async function notifyFamily(familyId, notification) {
  if (!familyId) return;
  try {
    await fetch(`${_apiBase}/family/${familyId}/notify-family`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(notification),
    });
  } catch(e) { console.warn('notifyFamily failed:', e.message); }
}
