Meal Planner PWA — Project Decisions & State
Last updated: Mar 27 2026
---
Project Overview
Family meal planning PWA with two apps:
Coordinator (`index.html`) — Dave & Jenn, full planning access
Family (`family.html`) — Seth, Jared, Michael, Rachael, picks meals weekly
---
URLs & Infrastructure
Item	Value
Coordinator URL	`https://fongkingawesomeapps.github.io/meal-planner/?fid=fam-rqrvsmp8`
Family URL	`https://fongkingawesomeapps.github.io/meal-planner/family.html?fid=fam-rqrvsmp8#fid=fam-rqrvsmp8`
GitHub repo	`FongKingAwesomeApps/meal-planner`
Worker URL	`https://meal-planner-api.davekingca.workers.dev`
Worker project path	`C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d\src\index.ts`
Family ID	`fam-rqrvsmp8`
Deploy commands (PowerShell):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\davek\meal-planner-api\meal-planner-api\broken-shape-913d"
wrangler deploy
```
---
File Structure
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
Icons:
Coordinator: `coordinator-icon-180.png`, `coordinator-icon-192.png`, `coordinator-icon-512.png`
Family: `family-icon-180.png`, `family-icon-192.png`, `family-icon-512.png`
---
Architecture Decisions
iOS PWA — Family ID persistence
Problem: iOS strips `?fid=` query params when saving PWA to home screen.  
Solution: `sync.js` init() rewrites the URL to include `#fid=xxx` hash fragment, which iOS preserves. Family app link format: `family.html?fid=fam-xxx#fid=fam-xxx`.  
Storage: Coordinator uses `mp_family_id`, family app uses `mp_family_id_family` (separate keys to prevent cross-contamination).  
isConnected(): Checks `_familyId || localStorage.getItem('mp_family_id')` — localStorage fallback critical for PWA reopens without URL params.
Separate manifests
Problem: Both apps shared `manifest.json` with `start_url: /meal-planner/` — family PWA always opened coordinator.  
Solution: `family.html` uses `manifest-family.json` with `start_url: /meal-planner/family.html`. Different icons too.
Worker POST accepts picks
The Worker `POST /family/:id` endpoint accepts these fields:  
`weekPlan, family, customMeals, weekOffset, picks, suggestions`  
Picks have a `status` field: `pending | approved | dismissed`.
Filter chips — two rows
Coordinator Meals tab has two `chip-row` divs:
`#meals-filter-chips-top` — All, Saved, Light, Balanced, Indulgent
`#meals-filter-chips-cats` — categories
`renderFilterChips()` called at boot AND on `renderMeals()`. `setFilter()` queries both rows.
Family app dual filter
Two independent filter states: `ffHealth` and `ffCat`. Both can be active simultaneously. `fF()` function handles toggling — tap same chip again to deselect.
Validation protocol (ALWAYS follow before delivering)
`new Function(...)` syntax test on script content (with imports stripped)
Check for duplicate function declarations
Check backtick count is even
Check all key functions present
Check no stray `async` keywords or double-brace issues
Compare dropped/added functions vs previous version
---
Confirmed Built Features
Coordinator
Two-row filter chips (health + categories)
Picks load from Worker on boot (`loadPicksFromWorker`)
Multi-person approve sheet with coloured avatars
Approve All saves `status:'approved'` to Worker
Dismiss All saves `status:'dismissed'` to Worker
Shopping list: quantities multiply (2 lbs × 2 = 4 lbs)
Shopping list: "Additional Items" free-text field
Sync sheet: 3-section layout (Coordinator / Family / Code)
Auto-approve coordinator-tier picks (Dave/Jenn skip queue)
Notify family via push when plan is set
Family code entry card on home (input + Connect button)
`connectFamilyId()` function wired to Connect button
`_pushSubscription` declared as module-level variable
Reset section: Clear Meals, Clear Plan, Start Fresh
Add/Edit family members with pick limits
Edit meal (long-press on pill)
Build from suggestion (AI)
Favourites (bookmark icon on each meal)
Week navigation (‹ › on Plan screen)
Settings → Notifications toggle (async, checks localStorage)
Family App
First-run code entry card (`family-first-run`)
Settings tab with notifications, FAQ, switch user, code entry
Two-row filter chips (health top, categories bottom)
Dual filter (simultaneous health + category)
Favourites (bookmark on each meal)
Suggest tab (free text or URL)
Plan tab (read-only week view)
Pick limits enforced (max Indulgent, min Light)
Push notification toggle
Worker
RFC 8291 encrypted Web Push
VAPID JWT signing
`POST /family/:id` accepts: `weekPlan, family, customMeals, weekOffset, picks, suggestions`
`POST /family/:id/pick` — stores picks, pushes to coordinator
`POST /family/:id/notify-family` — pushes to family subscribers
`POST /family/:id/push/subscribe` and `/unsubscribe`
`GET /ai/recipe` — proxies to Anthropic API
---
Known Remaining Issues / Backlog
Bugs
Family PWA home screen still opening coordinator on some devices (manifest fix deployed, requires fresh PWA install to take effect)
Features — Next Priority
`DECISIONS.md` committed to GitHub repo
Week navigation on Home screen (currently Plan only)
Post-meal ratings (thumbs up/down on Plan screen)
Push to family when picks approved
Favourites sync to Worker (currently localStorage only)
Week plan history (dated keys, never overwrite)
Previous week browser on Plan screen
Long Term
More recipes + meal photos
Meal prep page with one-time shopping list
Upload 50 meal prep recipes with step-by-step photos
Full member profile editing (name, colour, role, delete)
Meal frequency tracking
Special menus / saved collections
Per-week notes field
---
Safe Restore Points
Commit	Date	Notes
`964cd3b`	Mar 25 2026	Last known good before session 4 corruption
`272603c`	Mar 25 2026	Most recent working version (session 4 complete)
Rule: Never patch a corrupted file. Always restore from GitHub first, then apply targeted patches with validation.
---
New Chat Orientation Paste
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
---
Full Backlog — Everything Discussed But Not Yet Built
🐛 Bugs / Incomplete
Family PWA still opens coordinator on some devices — manifest fix deployed but requires fresh PWA install (delete + re-add home screen icon)
Coordinator filter chips empty on Meals tab first visit — `renderFilterChips()` now called at boot, needs verification after latest deploy
Notifications toggle — `_pushSubscription` declaration fix deployed, needs real-device test to confirm
Shopping list qty display — shows quantity × count but doesn't always calculate product correctly when qty includes descriptive text (e.g. "2 lbs cut into chunks")
Push notification on picks approved — coordinator approves but family members don't receive a notification confirming approval
Picks reappear after dismiss — Worker status update may not be saving correctly in all cases; needs end-to-end retest after latest Worker deploy
`apple-mobile-web-app-capable` deprecation warning — low priority cosmetic, Chrome warning only
---
📋 Short-Term Features (Next 1–3 Sessions)
Coordinator
Week navigation on Home screen — currently ‹ › arrows only on Plan screen; home screen always shows current week even if you've navigated away on Plan
Post-meal ratings — thumbs up/down on Plan screen after a meal is cooked; free-text comment; stored per meal per week
Push notification to family when plan is set — currently fires via `/notify-family` endpoint but needs verification; family should get a push when the week plan is published
Push notification to family when picks approved — notify Seth/Jared that their picks were accepted
Clear selection ✕ on meals count label — tapping "N selected ✕" should confirm and clear; wired to `confirmClearMeals()` but visual ✕ indicator wasn't confirmed working
Favourites sync to Worker — currently localStorage only; if Dave selects a fav it doesn't appear on Jenn's device
Coordinator picks approval sheet — show each person's picks against their configured limits (e.g. "Seth — 2/3 picks, 1 Indulgent used"); brief analysis visible before approving
`DECISIONS.md` committed to GitHub repo — upload this file
Family App
Week plan read-only view — Plan tab exists but needs verification it pulls fresh data from Worker and renders correctly
Notifications to family on plan publish — family members should get a push when the week's meals are set
Limit bar dots — Indulgent showing too many circles on family app in some cases
---
🔮 Long-Term / Nice-to-Have
Planning & History
Week plan history — store plans with dated keys, never overwrite; allow browsing previous weeks
Previous week browser on Plan screen — navigate back to see what was cooked
Duplicate previous week's plan — one tap to copy last week as a starting point
Per-week notes field — free text field attached to the week (e.g. "Camping weekend, skip Thursday")
Meal frequency tracking — show how many times each meal has been planned; surface "haven't had this in a while" suggestions
Special menus / saved collections — curated meal sets for specific occasions (camping trip, Christmas week, BBQ month) that can be activated for a week
Meal Library
More recipes — library currently has 81 meals; goal is to grow significantly
Meal photos — photo for each meal displayed in recipe sheet and meal list
Meal prep page — dedicated screen with a one-time shopping list decoupled from the week plan; for batch cooking sessions
50 meal prep recipes — with step-by-step photos, uploaded separately from the main library
Update FAQ throughout — FAQ content written for current feature set; needs updating as features change
Macro calculation improvement — AI estimates macros but they're rough; option to pull from a nutrition API for custom meals
Edit meal category — currently can edit meal details but not reassign category after saving
Family & Social
Full family member profile editing — currently can edit limits only; need to edit name, colour, role, delete member
Rating-based meal suggestions — after post-meal rating, app learns preferences; "Seth always rates chicken dishes highly" surfaced as suggestions
Meal suggestion improvements — URL-based suggestions (YouTube, AllRecipes) currently generates a recipe "inspired by" the link since the Worker can't fetch URLs; could improve with a fetch-proxy approach
Guest frequency — track which weeks guests (Michael, Rachael) are attending to adjust shopping quantities automatically
Technical
Cloud as source of truth for all state — favourites, custom meals, family config currently split between localStorage and Worker; full sync would mean any device is fully interchangeable
Offline-first improvements — currently works offline but changes made offline aren't queued for sync when back online
Per-device coordinator access — Dave and Jenn both use the coordinator but changes on one device don't appear on the other until pull interval (30s); real-time would require WebSockets or SSE
VAPID key rotation — push notification keys currently hardcoded as Worker secrets; should have a rotation mechanism
Export to calendar — export week plan as .ics file for iOS Calendar
Print-friendly shopping list — formatted PDF or print stylesheet for the shopping list
Design
Indulgent limit bar dots fix — showing too many circles in some edge cases on family app
Meal picker balance bar — live updating mini bar below filter chips showing running L/B/I totals as you select; warn when over on Indulgent or under on Light target (visually flag pills, not hard block)
Decision tree reconnected — over/under weekly balance targets should visually flag meal pills in the picker (not block, just colour hint); e.g. if 3 Indulgent already selected, remaining Indulgent meals show a subtle orange tint
