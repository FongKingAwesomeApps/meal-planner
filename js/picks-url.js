// ── picks-url.js ──────────────────────────────────────────────────────────────
// URL-based picks flow — replaces iMessage copy/paste entirely.
//
// HOW IT WORKS:
//   Family member selects meals in family.html, taps "Send My Picks".
//   App builds a URL: https://fongkingawesomeapps.github.io/meal-planner/?picks=Seth:14,38,52
//   That URL is shared via the Web Share API (native iOS share sheet).
//   When Jenn opens the coordinator and the URL contains ?picks=...,
//   the picks are auto-imported and the approval sheet opens immediately.
//
// FORMAT:  ?picks=Name:id1,id2,id3[&msg=optional+message]
// EXAMPLE: ?picks=Seth:14,38,52&msg=the+wings+are+amazing

const COORDINATOR_URL = 'https://fongkingawesomeapps.github.io/meal-planner/';

// ── BUILD (called from family app) ────────────────────────────────────────────
function buildPicksURL(name, mealIds, message = '') {
  const ids = mealIds.join(',');
  let url = `${COORDINATOR_URL}?picks=${encodeURIComponent(name)}:${ids}`;
  if (message.trim()) {
    url += `&msg=${encodeURIComponent(message.trim())}`;
  }
  return url;
}

// Share via Web Share API (native iOS share sheet) — falls back to clipboard
async function sharePicksURL(name, mealIds, message = '') {
  const url = buildPicksURL(name, mealIds, message);
  const text = `${name}'s meal picks for this week`;

  if (navigator.share) {
    try {
      await navigator.share({ title: text, url });
      return { method: 'share', url };
    } catch (e) {
      if (e.name !== 'AbortError') {
        // Share was cancelled — fall through to clipboard
      }
    }
  }

  // Fallback: copy URL to clipboard
  try {
    await navigator.clipboard.writeText(url);
    return { method: 'clipboard', url };
  } catch {
    return { method: 'manual', url };
  }
}

// ── PARSE (called from coordinator on load) ───────────────────────────────────
function parsePicksFromURL() {
  const params = new URLSearchParams(window.location.search);
  const picks  = params.get('picks');
  const msg    = params.get('msg') || '';

  if (!picks) return null;

  const colonIdx = picks.indexOf(':');
  if (colonIdx < 1) return null;

  const name    = decodeURIComponent(picks.slice(0, colonIdx));
  const idsRaw  = picks.slice(colonIdx + 1);
  const mealIds = idsRaw.split(',').map(Number).filter(n => n > 0);

  if (!name || mealIds.length === 0) return null;

  return { name, mealIds, message: decodeURIComponent(msg) };
}

// Clean the URL after consuming the params (avoids re-triggering on reload)
function clearPicksFromURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete('picks');
  url.searchParams.delete('msg');
  window.history.replaceState({}, '', url.toString());
}

export { buildPicksURL, sharePicksURL, parsePicksFromURL, clearPicksFromURL };
