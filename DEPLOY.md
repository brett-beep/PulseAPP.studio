# Deploying from GitHub (Base44)

## ⚠️ Secrets after GitHub deploy

When you **deploy functions by pushing to GitHub**, Base44 may not re-inject secrets (environment variables) into the function runtime. If you see errors like "API key not configured" or "FINLIGHT_API_KEY not set" after a deploy from Git, use this workaround.

### Workaround (per function that uses secrets)

1. In Base44: **Code → Functions → [Your Function]**
2. Make a **small edit** in the code (e.g. add an empty line or a comment)
3. Click **Save & Deploy**

This re-triggers secret injection for that function. Repeat for each function that relies on secrets.

### Functions that use Base44 secrets

Secret names must match Base44 exactly (e.g. `MARKETAUX_API_KEY` not `MARKETAUX_KEY`, `NEWSAPI_API_KEY` not `NEWSAPI_KEY`).

| Function             | Secrets used |
|----------------------|--------------|
| `generateBriefing`   | `FINNHUB_API_KEY`, `FINLIGHT_API_KEY`, `MARKETAUX_API_KEY`, `NEWSAPI_API_KEY` |
| `fetchNewsCards`     | `FINLIGHT_API_KEY`, `MARKETAUX_API_KEY`, `NEWSAPI_API_KEY` |
| `refreshNewsCache`   | `FINLIGHT_API_KEY` |
| `joinWaitlist`       | `LOOPS_API_KEY` |
| `createCheckout`     | `STRIPE_SECRET_KEY`, `BASE44_APP_ID` |
| `stripeWebhook`      | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

### When to do this

- After **pushing function changes from GitHub** (e.g. `git push origin main`)
- If a function suddenly reports "key not configured" or 401/403 from an API that used to work

### If it still fails

Confirm with Base44 support whether the issue happens only when deploying from GitHub, or also when editing in the AI builder or deploying manually from the app. That helps them fix the root cause.

---

**Quick reminder after push:** run `npm run remind-secrets` to print these steps.

---

### Briefing Memory & Story Tracker (Piece 1)

The `generateBriefing` function saves briefing memory and story tracker data after each successful Stage 3 run. You must create these Base44 entities and grant the function access:

- **BriefingMemory** — one per user per day (macro_stories, portfolio_stories, watch_items_mentioned).
- **StoryTracker** — per user per story_key (first_mentioned, last_mentioned, mention_count, 7-day cycle reset).
- **BriefingDelivery** — append-only log for “briefings today” (first vs same-day subsequent).

See **docs/BRIEFING_MEMORY_ENTITIES.md** for exact field names and types. Create the entities in the Base44 dashboard before deploying, or the memory save will fail (errors are logged but do not block briefing delivery).
