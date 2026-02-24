# Briefing Memory & Story Tracker — Base44 Entities

Create these entities in your Base44 app so the briefing memory system (Piece 1) can persist data.

---

## 1. BriefingMemory

**Purpose:** One record per user per calendar day. Stores what was said in the most recent briefing (overwrites if same user + same date).

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | User identifier (same as `created_by` in DailyBriefing, e.g. email). |
| `date` | string | `YYYY-MM-DD` (briefing date). |
| `user_listened` | boolean | Whether the user played the audio (default `true` for now). |
| `macro_stories` | string | JSON array of `{ story_key, headline, key_fact }`. |
| `portfolio_stories` | string | JSON object keyed by ticker: `{ [ticker]: { story_key, headline, key_fact, price_at_briefing, change_at_briefing } }`. |
| `watch_items_mentioned` | string | JSON array of strings (e.g. `["NVDA earnings (2026-02-25)", "CPI (2026-03-11)"]`). |
| `created_at` | string | ISO date string. |

**Index / unique:** Use a unique constraint or composite key on `(user_id, date)` so upsert overwrites the same day.

---

## 2. StoryTracker

**Purpose:** Per user, per story (macro or portfolio or watch item). Tracks first_mentioned, last_mentioned, mention_count, and a 7-day cycle for reset. Same-day subsequent briefings do not increment mention_count.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | User identifier. |
| `story_key` | string | Stable id for the event (e.g. `fed_rate_path`, `ba_vietnam_orders`, `watch:cpi_2026_03_11`). |
| `first_mentioned` | string | `YYYY-MM-DD` — start of current 7-day cycle. |
| `last_mentioned` | string | `YYYY-MM-DD` — last calendar day we mentioned this story. |
| `mention_count` | number | Number of calendar days we’ve mentioned this story in the current cycle (1–3 for framing; resets after 7 days). |
| `status` | string | `"active"` \| `"fading"` \| `"resolved"`. |
| `related_ticker` | string \| null | Ticker if portfolio story (e.g. `"BA"`); null for macro/watch. |
| `mentions` | string | JSON array of `{ date, angle, key_fact }` (history of mentions). |
| `created_at` | string | ISO date. |
| `updated_at` | string | ISO date. |

**Index:** Unique on `(user_id, story_key)` so we can upsert by that pair.

---

## 3. BriefingDelivery

**Purpose:** Append-only log of each briefing delivered. Used to count “briefings today” for first_briefing_today vs same-day subsequent.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | User identifier. |
| `date` | string | `YYYY-MM-DD`. |
| `created_at` | string | ISO date. |

**Index:** Optional index on `(user_id, date)` for fast “count deliveries today” queries.

---

## Retention (optional)

- **BriefingMemory:** Keep last 30 days (delete or archive where `date < today - 30`). Can be done with a scheduled job or TTL if Base44 supports it.
- **StoryTracker:** Mark as `resolved` when `last_mentioned` is 7+ days ago (cleanup job). See `cleanupStaleStories` in the Piece 1 prompt.
- **BriefingDelivery:** Can be pruned after 30 days if you only need “count today” and not long-term history.
