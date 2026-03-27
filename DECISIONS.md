# Meal Planner PWA — Project Decisions & State
*Last updated: Mar 27 2026*

---

## Project Overview
Family meal planning PWA with two apps:
- **Coordinator** (`index.html`) — Dave & Jenn, full planning access
- **Family** (`family.html`) — Seth, Jared, Michael, Rachael, picks meals weekly

---

## URLs & Infrastructure

| Item | Value |
|------|-------|
| Coordinator URL | `https://fongkingawesomeapps.github.io/meal-planner/?fid=fam-rqrvsmp8` |
| Family URL | `https://fongkingawesomeapps.github.io/meal-planner/family.html?fid=fam-rqrvsmp8#fid=fam-rqrvsmp8` |
| GitHub repo | `FongKingAwesomeApps/meal-planner` |
| Worker URL | `https://meal-planner-api.davekingca.workers.dev` |
| Worker project path | `C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d\src\index.ts` |
| Family ID | `fam-rqrvsmp8` |

**Deploy commands (PowerShell):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d"
wrangler deploy
```

---

## File Structure
```
meal-planner/
├── index.html                  — Coordinator app (~143KB)
├── family.html                 — Family picker app (~54KB)
├── manifest.json               — Coordinator PWA manifest (coordinator-icon-*.png)
├── manifest-family.json        — Family PWA manifest (family-icon-*.png)
├── 404.html                    — GitHub Pages redirect (fam- IDs only)
├── sw.js                       — Service worker v6
├── css/design-system.css
├── js/
│   ├── storage.js
│   ├── sync.js                 — Worker sync, fid from URL/hash/localStorage
│   ├── meals.js                — newMealId() starts at 10001
│   └── picks-url.js
└── data/meals.json             — 81 built-in meals
```

**Icons:**
- Coordinator: `coordinator-icon-180.png`, `coordinator-icon-192.png`, `coordinator-icon-512.png`
- Family: `family-icon-180.png`, `family-icon-192.png`, `family-icon-512.png`

---

## Architecture Decisions

### iOS PWA — Family ID persistence
**Problem:** iOS strips `?fid=` query params when saving PWA to home screen.  
**Solution:** `sync.js` init() rewrites the URL to include `#fid=xxx` hash fragment, which iOS preserves. Family app link format: `family.html?fid=fam-xxx#fid=fam-xxx`.  
**Storage:** Coordinator uses `mp_family_id`, family app uses `mp_family_id_family` (separate keys to prevent cross-contamination).  
**isConnected():** Checks `_familyId || localStorage.getItem('mp_family_id')` — localStorage fallback critical for PWA reopens without URL params.

### Separate manifests
**Problem:** Both apps shared `manifest.json` with `start_url: /meal-planner/` — family PWA always opened coordinator.  
**Solution:** `family.html` uses `manifest-family.json` with `start_url: /meal-planner/family.html`. Different icons too.

### Worker POST accepts picks
The Worker `POST /family/:id` endpoint accepts these fields:  
`weekPlan, family, customMeals, weekOffset, picks, suggestions`  
Picks have a `status` field: `pending | approved | dismissed`.

### Filter chips — two rows
Coordinator Meals tab has two `chip-row` divs:
- `#meals-filter-chips-top` — All, Saved, Light, Balanced, Indulgent
- `#meals-filter-chips-cats` — categories  

`renderFilterChips()` called at boot AND on `renderMeals()`. `setFilter()` queries both rows.

### Family app dual filter
Two independent filter states: `ffHealth` and `ffCat`. Both can be active simultaneously. `fF()` function handles toggling — tap same chip again to deselect.

### Validation protocol (ALWAYS follow before delivering)
1. `new Function(...)` syntax test on script content (with imports stripped)
2. Check for duplicate function declarations
3. Check backtick count is even
4. Check all key functions present
5. Check no stray `async` keywords or double-brace issues
6. Compare dropped/added functions vs previous version

---

## Confirmed Built Features

### Coordinator
- Two-row filter chips (health + categories)
- Picks load from Worker on boot (`loadPicksFromWorker`)
- Multi-person approve sheet with coloured avatars
- Approve All saves `status:'approved'` to Worker
- Dismiss All saves `status:'dismissed'` to Worker
- Shopping list: quantities multiply (2 lbs × 2 = 4 lbs)
- Shopping list: "Additional Items" free-text field
- Sync sheet: 3-section layout (Coordinator / Family / Code)
- Auto-approve coordinator-tier picks (Dave/Jenn skip queue)
- Notify family via push when plan is set
- Family code entry card on home (input + Connect button)
- `connectFamilyId()` function wired to Connect button
- `_pushSubscription` declared as module-level variable
- Reset section: Clear Meals, Clear Plan, Start Fresh
- Add/Edit family members with pick limits
- Edit meal (long-press on pill)
- Build from suggestion (AI)
- Favourites (bookmark icon on each meal)
- Week navigation (‹ › on Plan screen)
- Settings → Notifications toggle (async, checks localStorage)

### Family App
- First-run code entry card (`family-first-run`)
- Settings tab with notifications, FAQ, switch user, code entry
- Two-row filter chips (health top, categories bottom)
- Dual filter (simultaneous health + category)
- Favourites (bookmark on each meal)
- Suggest tab (free text or URL)
- Plan tab (read-only week view)
- Pick limits enforced (max Indulgent, min Light)
- Push notification toggle

### Worker
- RFC 8291 encrypted Web Push
- VAPID JWT signing
- `POST /family/:id` accepts: `weekPlan, family, customMeals, weekOffset, picks, suggestions`
- `POST /family/:id/pick` — stores picks, pushes to coordinator
- `POST /family/:id/notify-family` — pushes to family subscribers
- `POST /family/:id/push/subscribe` and `/unsubscribe`
- `GET /ai/recipe` — proxies to Anthropic API

---

## Known Remaining Issues / Backlog

### Bugs
- Family PWA home screen still opening coordinator on some devices (manifest fix deployed, requires fresh PWA install to take effect)

### Features — Next Priority
1. `DECISIONS.md` committed to GitHub repo
2. Week navigation on Home screen (currently Plan only)
3. Post-meal ratings (thumbs up/down on Plan screen)
4. Push to family when picks approved
5. Favourites sync to Worker (currently localStorage only)
6. Week plan history (dated keys, never overwrite)
7. Previous week browser on Plan screen

### Long Term
- More recipes + meal photos
- Meal prep page with one-time shopping list
- Upload 50 meal prep recipes with step-by-step photos
- Full member profile editing (name, colour, role, delete)
- Meal frequency tracking
- Special menus / saved collections
- Per-week notes field

---

## Safe Restore Points
| Commit | Date | Notes |
|--------|------|-------|
| `964cd3b` | Mar 25 2026 | Last known good before session 4 corruption |
| `272603c` | Mar 25 2026 | Most recent working version (session 4 complete) |

**Rule:** Never patch a corrupted file. Always restore from GitHub first, then apply targeted patches with validation.

---

## New Chat Orientation Paste

```
Meal Planner PWA — GitHub: FongKingAwesomeApps/meal-planner
Coordinator: https://fongkingawesomeapps.github.io/meal-planner/?fid=fam-rqrvsmp8
Family: https://fongkingawesomeapps.github.io/meal-planner/family.html?fid=fam-rqrvsmp8
Worker: https://meal-planner-api.davekingca.workers.dev
Worker path: C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d\src\index.ts
Deploy: cd "C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d" ; wrangler deploy
Execution policy: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Family ID: fam-rqrvsmp8
Last good commit: 964cd3b

See DECISIONS.md in the repo for full project state.
```
