# Personalization & Memory Code — For Claude Analysis

This document contains the full personalization and memory-related code for the Pulse briefing pipeline. Use it to analyze bugs, inconsistencies, or improvements (e.g. why briefings might not feel personalized, story continuity issues, or memory not being used correctly).

**Files covered:**
- `docs/BRIEFING_MEMORY_ENTITIES.md` — Base44 entity definitions
- `functions/briefingMemory.ts` — save/load memory, story tracker, delivery records
- `functions/generateBriefing.ts` — personalization types, load context, prompt blocks, continuity, save invocation, freshness

---

## 1. Entity reference: `docs/BRIEFING_MEMORY_ENTITIES.md`

```markdown
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
| `mention_count` | number | Number of calendar days we've mentioned this story in the current cycle (1–3 for framing; resets after 7 days). |
| `status` | string | `"active"` \| `"fading"` \| `"resolved"`. |
| `related_ticker` | string \| null | Ticker if portfolio story (e.g. `"BA"`); null for macro/watch. |
| `mentions` | string | JSON array of `{ date, angle, key_fact }` (history of mentions). |
| `created_at` | string | ISO date. |
| `updated_at` | string | ISO date. |

**Index:** Unique on `(user_id, story_key)` so we can upsert by that pair.

---

## 3. BriefingDelivery

**Purpose:** Append-only log of each briefing delivered. Used to count "briefings today" for first_briefing_today vs same-day subsequent.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | User identifier. |
| `date` | string | `YYYY-MM-DD`. |
| `created_at` | string | ISO date. |

**Index:** Optional index on `(user_id, date)` for fast "count deliveries today" queries.

---

## Retention (optional)

- **BriefingMemory:** Keep last 30 days (delete or archive where `date < today - 30`). Can be done with a scheduled job or TTL if Base44 supports it.
- **StoryTracker:** Mark as `resolved` when `last_mentioned` is 7+ days ago (cleanup job). See `cleanupStaleStories` in the Piece 1 prompt.
- **BriefingDelivery:** Can be pruned after 30 days if you only need "count today" and not long-term history.
```

---

## 2. File: `functions/briefingMemory.ts` (full)

```typescript
/**
 * Briefing Memory & Story Tracker (Piece 1).
 * Base44: deployed as standalone function — invoked via base44.functions.invoke("briefingMemory", { userId, briefingDate, analyzedBrief, tickerMarketMap, scriptwriterResult }).
 *
 * REQUIRED BASE44 ENTITIES (create in Base44 dashboard):
 *
 * 1) BriefingMemory
 *    - user_id: string
 *    - date: string (YYYY-MM-DD)
 *    - user_listened: boolean (default true)
 *    - macro_stories: string (JSON array of { story_key, headline, key_fact })
 *    - portfolio_stories: string (JSON object keyed by ticker: { story_key, headline, key_fact, price_at_briefing, change_at_briefing })
 *    - watch_items_mentioned: string (JSON array of strings)
 *    - holdings_at_time: string (JSON array of ticker strings — snapshot of portfolio when briefing was generated)
 *    - created_at: string (ISO date)
 *
 * 2) StoryTracker
 *    - user_id: string
 *    - story_key: string
 *    - first_mentioned: string (YYYY-MM-DD)
 *    - last_mentioned: string (YYYY-MM-DD)
 *    - mention_count: number
 *    - status: string ("active" | "fading" | "resolved")
 *    - event_type: string ("breaking" | "developing" | "recurring" | "one_off" | "escalation")
 *    - big_event: boolean (true if this is a major multi-day event — persists once set)
 *    - related_ticker: string | null
 *    - mentions: string (JSON array of { date, angle, key_fact })
 *    - created_at: string (ISO date)
 *    - updated_at: string (ISO date)
 *
 * 3) BriefingDelivery
 *    - user_id: string
 *    - date: string (YYYY-MM-DD)
 *    - created_at: string (ISO date)
 *
 * RULES:
 * - mention_count = number of calendar days we've mentioned this story (max 3 for framing).
 * - Same-day subsequent briefing: do NOT increment mention_count (intra-day).
 * - 7-day cycle: if first_mentioned is 7+ days ago, reset to new cycle (mention_count = 1, first_mentioned = today).
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const STORY_CYCLE_DAYS = 7;

export interface MacroStoryMemory {
  story_key: string;
  headline: string;
  key_fact: string;
}

export interface PortfolioStoryMemory {
  story_key: string;
  headline: string;
  key_fact: string;
  price_at_briefing: number | null;
  change_at_briefing: string | null;
}

export interface BriefingMemoryPayload {
  user_id: string;
  date: string;
  user_listened: boolean;
  macro_stories: MacroStoryMemory[];
  portfolio_stories: Record<string, PortfolioStoryMemory>;
  watch_items_mentioned: string[];
  holdings_at_time: string[];
  created_at: string;
}

export interface StoryTrackerMention {
  date: string;
  angle: string;
  key_fact: string;
}

export function generateFallbackKey(text: string): string {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  return words.join("_").substring(0, 40);
}

export function watchItemStoryKey(event: string, date: string): string {
  const norm = String(event || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 30);
  const dateNorm = String(date || "").replace(/-/g, "_").substring(0, 10);
  return `watch:${norm}_${dateNorm}`;
}

function isSameCalendarDay(a: string, b: string): boolean {
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function isNewCycle(first_mentioned: string, today: string): boolean {
  const first = new Date(first_mentioned);
  const t = new Date(today);
  if (isNaN(first.getTime()) || isNaN(t.getTime())) return false;
  const diffMs = t.getTime() - first.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays >= STORY_CYCLE_DAYS;
}

export async function saveBriefingMemory(
  base44: { asServiceRole: { entities: { BriefingMemory: { filter: (q: object) => Promise<{ id: string }[]>; create: (d: object) => Promise<{ id: string }>; update: (id: string, d: object) => Promise<unknown> } } } },
  memory: BriefingMemoryPayload
): Promise<void> {
  const payload = {
    user_id: memory.user_id,
    date: memory.date,
    user_listened: memory.user_listened,
    macro_stories: JSON.stringify(memory.macro_stories),
    portfolio_stories: JSON.stringify(memory.portfolio_stories),
    watch_items_mentioned: JSON.stringify(memory.watch_items_mentioned),
    holdings_at_time: JSON.stringify(memory.holdings_at_time),
  };
  const existing = await base44.asServiceRole.entities.BriefingMemory.filter({
    user_id: memory.user_id,
    date: memory.date,
  });
  if (Array.isArray(existing) && existing.length > 0) {
    await base44.asServiceRole.entities.BriefingMemory.update((existing as { id: string }[])[0].id, payload);
  } else {
    await base44.asServiceRole.entities.BriefingMemory.create(payload);
  }
}

export async function recordBriefingDelivery(
  base44: { asServiceRole: { entities: { BriefingDelivery: { create: (d: object) => Promise<unknown> } } } },
  user_id: string,
  date: string
): Promise<void> {
  await base44.asServiceRole.entities.BriefingDelivery.create({
    user_id,
    date,
  });
}

export async function getBriefingCountToday(
  base44: { asServiceRole: { entities: { BriefingDelivery: { filter: (q: object) => Promise<unknown[]> } } } },
  user_id: string,
  date: string
): Promise<number> {
  const list = await base44.asServiceRole.entities.BriefingDelivery.filter({
    user_id,
    date,
  });
  return Array.isArray(list) ? list.length : 0;
}

interface StoryTrackerRecord {
  id: string;
  user_id: string;
  story_key: string;
  first_mentioned: string;
  last_mentioned: string;
  mention_count: number;
  status: string;
  event_type: string;
  big_event: boolean;
  related_ticker: string | null;
  mentions: string;
  created_at: string;
  updated_at: string;
}

export async function upsertStoryTracker(
  base44: { asServiceRole: { entities: { StoryTracker: { filter: (q: object) => Promise<StoryTrackerRecord[]>; create: (d: object) => Promise<{ id: string }>; update: (id: string, d: object) => Promise<unknown> } } } },
  user_id: string,
  story_key: string,
  mention: { date: string; angle: string; key_fact: string },
  options: { related_ticker?: string | null; event_type?: string; big_event?: boolean } = {}
): Promise<void> {
  const today = mention.date.slice(0, 10);
  const existingList = await base44.asServiceRole.entities.StoryTracker.filter({ user_id, story_key });
  const existing = Array.isArray(existingList) && existingList.length > 0 ? (existingList as StoryTrackerRecord[])[0] : null;

  const newMention = { date: mention.date, angle: mention.angle, key_fact: mention.key_fact };
  let mentionsArr: StoryTrackerMention[] = [];

  if (existing) {
    const raw = existing.mentions;
    if (Array.isArray(raw)) mentionsArr = raw as StoryTrackerMention[];
    else if (typeof raw === "string") {
      try { mentionsArr = JSON.parse(raw); } catch { mentionsArr = []; }
    }
    const alreadyMentionedToday = mentionsArr.some((m) => isSameCalendarDay(m.date, today));
    if (alreadyMentionedToday) {
      mentionsArr.push({ ...newMention, angle: "[intra-day] " + (mention.angle || "").slice(0, 80) });
      const intraUpdate: Record<string, unknown> = { last_mentioned: today, mentions: JSON.stringify(mentionsArr) };
      if (options.event_type) intraUpdate.event_type = options.event_type;
      if (options.big_event && !existing.big_event) intraUpdate.big_event = true;
      await base44.asServiceRole.entities.StoryTracker.update(existing.id, intraUpdate);
      return;
    }
    if (isNewCycle(existing.first_mentioned, today)) {
      mentionsArr = [newMention];
      await base44.asServiceRole.entities.StoryTracker.update(existing.id, {
        first_mentioned: today, last_mentioned: today, mention_count: 1, status: "active",
        event_type: options.event_type || existing.event_type || "breaking",
        big_event: existing.big_event || options.big_event || false,
        mentions: JSON.stringify(mentionsArr),
      });
      return;
    }
    const newCount = Math.min((existing.mention_count || 0) + 1, 99);
    let status = existing.status || "active";
    if (newCount >= 6) status = "fading";
    mentionsArr.push(newMention);
    await base44.asServiceRole.entities.StoryTracker.update(existing.id, {
      last_mentioned: today, mention_count: newCount, status,
      event_type: options.event_type || existing.event_type || "developing",
      big_event: existing.big_event || options.big_event || false,
      mentions: JSON.stringify(mentionsArr),
    });
    return;
  }

  await base44.asServiceRole.entities.StoryTracker.create({
    user_id, story_key, first_mentioned: today, last_mentioned: today, mention_count: 1,
    status: "active", event_type: options.event_type || "breaking", big_event: options.big_event || false,
    related_ticker: options.related_ticker ?? null, mentions: JSON.stringify([newMention]),
  });
}

type Base44ForMemory = Parameters<typeof saveBriefingMemory>[0];

export async function saveBriefingMemoryComplete(
  base44: Base44ForMemory,
  userId: string,
  briefingDate: string,
  analyzedBrief: {
    macro_selections?: Array<{ story_key?: string; hook?: string; facts?: unknown[]; event_type?: string; big_event?: boolean }>;
    portfolio_selections?: Array<{ ticker?: string; story_key?: string; hook?: string; facts?: unknown[]; event_type?: string; big_event?: boolean }>;
    watch_items?: {
      primary?: { event?: string; date?: string; why_it_matters?: string } | null;
      secondary?: { event?: string; date?: string; why_it_matters?: string } | null;
    };
  },
  tickerMarketMap: Record<string, { quote?: { current_price?: number; change_pct?: number } }>,
  scriptwriterResult: { watch_items_mentioned?: Array<{ event?: string; date?: string }> } | null | undefined,
  holdingsAtTime: string[] = []
): Promise<void> {
  const macroStories = (analyzedBrief.macro_selections || []).map((s) => ({
    story_key: s.story_key || generateFallbackKey(s.hook || ""),
    headline: String(s.hook || "").slice(0, 200),
    key_fact: Array.isArray(s.facts) && s.facts[0] ? String(s.facts[0]).slice(0, 300) : "",
  }));
  const portfolioStories: Record<string, { story_key: string; headline: string; key_fact: string; price_at_briefing: number | null; change_at_briefing: string | null }> = {};
  for (const ps of analyzedBrief.portfolio_selections || []) {
    const ticker = ps.ticker || "";
    const q = tickerMarketMap[ticker]?.quote;
    portfolioStories[ticker] = {
      story_key: ps.story_key || generateFallbackKey(ticker + "_" + (ps.hook || "")),
      headline: String(ps.hook || "").slice(0, 200),
      key_fact: Array.isArray(ps.facts) && ps.facts[0] ? String(ps.facts[0]).slice(0, 300) : "",
      price_at_briefing: q?.current_price != null ? q.current_price : null,
      change_at_briefing: q?.change_pct != null ? (q.change_pct >= 0 ? "+" : "") + q.change_pct.toFixed(2) + "%" : null,
    };
  }
  const watchItemsList = Array.isArray(scriptwriterResult?.watch_items_mentioned)
    ? scriptwriterResult.watch_items_mentioned.map((w) => (w && (w.event || w.date)) ? `${w.event || ""} (${w.date || ""})` : "").filter(Boolean)
    : [];

  await saveBriefingMemory(base44, {
    user_id: userId, date: briefingDate, user_listened: true,
    macro_stories: macroStories, portfolio_stories: portfolioStories,
    watch_items_mentioned: watchItemsList, holdings_at_time: holdingsAtTime,
    created_at: new Date().toISOString(),
  });
  console.log("💾 [Memory] Briefing memory saved for", userId, "—", macroStories.length, "macro,", Object.keys(portfolioStories).length, "portfolio stories");

  const macroSelectionsRaw = analyzedBrief.macro_selections || [];
  const portfolioSelectionsRaw = analyzedBrief.portfolio_selections || [];
  const eventTypeLookup = new Map<string, { event_type?: string; big_event?: boolean }>();
  for (const s of macroSelectionsRaw) {
    const key = s.story_key || generateFallbackKey(s.hook || "");
    eventTypeLookup.set(key, { event_type: s.event_type, big_event: s.big_event });
  }
  for (const s of portfolioSelectionsRaw) {
    const key = s.story_key || generateFallbackKey((s.ticker || "") + "_" + (s.hook || ""));
    eventTypeLookup.set(key, { event_type: s.event_type, big_event: s.big_event });
  }

  const allStoriesForTracker = [
    ...macroStories.map((s) => ({ ...s, related_ticker: null as string | null })),
    ...Object.entries(portfolioStories).map(([ticker, s]) => ({ ...s, related_ticker: ticker })),
  ];
  for (const story of allStoriesForTracker) {
    const meta = eventTypeLookup.get(story.story_key);
    await upsertStoryTracker(base44, userId, story.story_key, {
      date: briefingDate, angle: story.headline, key_fact: story.key_fact,
    }, { related_ticker: story.related_ticker ?? null, event_type: meta?.event_type, big_event: meta?.big_event });
  }
  const primary = analyzedBrief.watch_items?.primary;
  const secondary = analyzedBrief.watch_items?.secondary;
  if (primary?.event && primary?.date) {
    await upsertStoryTracker(base44, userId, watchItemStoryKey(primary.event, primary.date), {
      date: briefingDate, angle: primary.event + " (" + primary.date + ")", key_fact: primary.why_it_matters || "",
    }, { related_ticker: null });
  }
  if (secondary?.event && secondary?.date) {
    await upsertStoryTracker(base44, userId, watchItemStoryKey(secondary.event, secondary.date), {
      date: briefingDate, angle: secondary.event + " (" + secondary.date + ")", key_fact: secondary.why_it_matters || "",
    }, { related_ticker: null });
  }
  console.log("💾 [Memory] Story tracker updated —", allStoriesForTracker.length, "stories + watch items");
  await recordBriefingDelivery(base44, userId, briefingDate);
  console.log("💾 [Memory] Briefing delivery recorded for", userId, "on", briefingDate);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json() as { userId?: string; briefingDate?: string; analyzedBrief?: unknown; tickerMarketMap?: unknown; scriptwriterResult?: unknown; holdingsAtTime?: string[] };
    const { userId, briefingDate, analyzedBrief, tickerMarketMap, scriptwriterResult, holdingsAtTime } = body;
    if (!userId || !briefingDate) {
      return Response.json({ error: "userId and briefingDate required" }, { status: 400 });
    }
    await saveBriefingMemoryComplete(
      base44, userId, briefingDate,
      (analyzedBrief ?? {}) as Parameters<typeof saveBriefingMemoryComplete>[3],
      (tickerMarketMap ?? {}) as Parameters<typeof saveBriefingMemoryComplete>[4],
      scriptwriterResult as Parameters<typeof saveBriefingMemoryComplete>[5],
      Array.isArray(holdingsAtTime) ? holdingsAtTime : []
    );
    return Response.json({ success: true });
  } catch (err) {
    console.error("⚠️ [briefingMemory] Failed:", err);
    return Response.json({ error: String((err as Error)?.message ?? err) }, { status: 500 });
  }
});
```

---

## 3. File: `functions/generateBriefing.ts` — Personalization types and load

### 3.1 Interfaces (Stage 0)

```typescript
// STAGE 0: PERSONALIZATION CONTEXT — Memory + Story Tracker

interface StoryTrackerEntry {
  story_key: string;
  first_mentioned: string;
  last_mentioned: string;
  mention_count: number;
  status: string;
  event_type: string;
  big_event: boolean;
  related_ticker: string | null;
  mentions: Array<{ date: string; angle: string; key_fact: string }>;
}

interface BriefingMemoryRecord {
  date: string;
  macro_stories: Array<{ story_key: string; headline: string; key_fact: string }>;
  portfolio_stories: Record<string, { story_key: string; headline: string; key_fact: string; price_at_briefing: number | null; change_at_briefing: string | null }>;
  watch_items_mentioned: string[];
  holdings_at_time: string[];
}

interface PersonalizationContext {
  last_briefings: BriefingMemoryRecord[];
  active_stories: StoryTrackerEntry[];
  holdings_changed: { added: string[]; removed: string[] };
  user_day_count: number;
  days_since_last: number;
  user_listened_last: boolean;
}
```

### 3.2 `loadPersonalizationContext`

```typescript
async function loadPersonalizationContext(
  base44: any,
  userId: string,
  todayStr: string,
  currentHoldings: string[]
): Promise<PersonalizationContext> {
  const empty: PersonalizationContext = {
    last_briefings: [],
    active_stories: [],
    holdings_changed: { added: [], removed: [] },
    user_day_count: 0,
    days_since_last: 999,
    user_listened_last: true,
  };

  try {
    const [memoryRecords, trackerRecords, deliveryRecords] = await Promise.all([
      base44.asServiceRole.entities.BriefingMemory.filter({ user_id: userId }),
      base44.asServiceRole.entities.StoryTracker.filter({ user_id: userId }),
      base44.asServiceRole.entities.BriefingDelivery.filter({ user_id: userId }),
    ]);

    const memories = (Array.isArray(memoryRecords) ? memoryRecords : []) as Array<Record<string, any>>;
    const trackers = (Array.isArray(trackerRecords) ? trackerRecords : []) as Array<Record<string, any>>;
    const deliveries = (Array.isArray(deliveryRecords) ? deliveryRecords : []) as Array<Record<string, any>>;

    const user_day_count = new Set(deliveries.map((d) => String(d.date || "").slice(0, 10))).size;

    const parsedMemories: BriefingMemoryRecord[] = memories
      .map((m) => {
        const parseJson = (v: unknown, fallback: unknown) => {
          if (typeof v === "string") { try { return JSON.parse(v); } catch { return fallback; } }
          return v ?? fallback;
        };
        return {
          date: String(m.date || ""),
          macro_stories: parseJson(m.macro_stories, []) as BriefingMemoryRecord["macro_stories"],
          portfolio_stories: parseJson(m.portfolio_stories, {}) as BriefingMemoryRecord["portfolio_stories"],
          watch_items_mentioned: parseJson(m.watch_items_mentioned, []) as string[],
          holdings_at_time: parseJson(m.holdings_at_time, []) as string[],
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);

    const activeStories: StoryTrackerEntry[] = trackers
      .filter((t) => t.status === "active" || t.status === "fading")
      .map((t) => {
        let mentionsArr: StoryTrackerEntry["mentions"] = [];
        if (typeof t.mentions === "string") { try { mentionsArr = JSON.parse(t.mentions); } catch { /* */ } }
        else if (Array.isArray(t.mentions)) { mentionsArr = t.mentions; }
        return {
          story_key: String(t.story_key || ""),
          first_mentioned: String(t.first_mentioned || ""),
          last_mentioned: String(t.last_mentioned || ""),
          mention_count: Number(t.mention_count) || 0,
          status: String(t.status || "active"),
          event_type: String(t.event_type || "breaking"),
          big_event: Boolean(t.big_event),
          related_ticker: t.related_ticker ?? null,
          mentions: mentionsArr,
        };
      });

    const lastBriefing = parsedMemories[0];
    const previousHoldings = lastBriefing?.holdings_at_time || [];
    const currentSet = new Set(currentHoldings.map((t) => t.toUpperCase()));
    const previousSet = new Set(previousHoldings.map((t) => String(t).toUpperCase()));
    const added = currentHoldings.filter((t) => !previousSet.has(t.toUpperCase()));
    const removed = previousHoldings.filter((t) => !currentSet.has(String(t).toUpperCase()));

    let days_since_last = 999;
    if (lastBriefing?.date) {
      const lastDate = new Date(lastBriefing.date);
      const today = new Date(todayStr);
      if (!isNaN(lastDate.getTime()) && !isNaN(today.getTime())) {
        days_since_last = Math.max(0, Math.round((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)));
      }
    }

    console.log(`🧠 [Stage 0] Personalization: ${user_day_count} briefings total, ${parsedMemories.length} recent memories, ${activeStories.length} active stories, ${days_since_last}d since last`);

    return {
      last_briefings: parsedMemories,
      active_stories: activeStories,
      holdings_changed: { added, removed },
      user_day_count,
      days_since_last,
      user_listened_last: lastBriefing ? true : true,
    };
  } catch (err: any) {
    console.warn(`⚠️ [Stage 0] Failed to load personalization context: ${err?.message ?? err}`);
    return empty;
  }
}
```

### 3.3 `buildPersonalizationPromptBlock` (Stage 2 analyst prompts)

```typescript
function buildPersonalizationPromptBlock(ctx: PersonalizationContext): string {
  if (ctx.user_day_count === 0 && ctx.active_stories.length === 0) {
    return `
═══════════════════════════════════════
PERSONALIZATION CONTEXT
═══════════════════════════════════════
NEW USER — no prior briefings. Classify all stories as "breaking" (give full context on every story). Set big_event: true for any dominating multi-day event.
`;
  }

  const storyTrackerLines = ctx.active_stories
    .filter((s) => s.status === "active" || s.status === "fading")
    .map((s) => {
      const lastMention = s.mentions.length > 0 ? s.mentions[s.mentions.length - 1] : null;
      return `  ${s.story_key} | mentions=${s.mention_count} | last=${s.last_mentioned} | type=${s.event_type}${s.big_event ? " | BIG_EVENT" : ""} | last_angle="${(lastMention?.angle || "").slice(0, 80)}"`;
    })
    .join("\n");

  const lastBriefingSummary = ctx.last_briefings.length > 0
    ? ctx.last_briefings.map((b) => {
        const macroKeys = b.macro_stories.map((s) => s.story_key).join(", ");
        const portKeys = Object.entries(b.portfolio_stories).map(([t, s]) => `${t}:${s.story_key}`).join(", ");
        const watchStr = b.watch_items_mentioned.slice(0, 3).join("; ");
        return `  ${b.date}: macro=[${macroKeys}] portfolio=[${portKeys}]${watchStr ? ` watch=[${watchStr}]` : ""}`;
      }).join("\n")
    : "  (none)";

  const holdingsChangedStr = (ctx.holdings_changed.added.length > 0 || ctx.holdings_changed.removed.length > 0)
    ? `\nHOLDINGS CHANGES: added=[${ctx.holdings_changed.added.join(",")}] removed=[${ctx.holdings_changed.removed.join(",")}]`
    : "";

  return `
═══════════════════════════════════════
PERSONALIZATION CONTEXT
═══════════════════════════════════════
User briefings to date: ${ctx.user_day_count} | Days since last briefing: ${ctx.days_since_last}${holdingsChangedStr}

ACTIVE STORY TRACKER (stories mentioned in recent briefings — use these to classify event_type):
${storyTrackerLines || "  (no tracked stories)"}

RECENT BRIEFING SUMMARIES (what was covered):
${lastBriefingSummary}

═══════════════════════════════════════
STORY CLASSIFICATION RULES
═══════════════════════════════════════
For EACH story you select (macro or portfolio), you MUST assign an event_type and optionally big_event:

1. Check the ACTIVE STORY TRACKER above. If a story_key matching this event already exists:
   - If the tracker shows mention_count 1-2 AND there is new information → "developing"
   - If mention_count 3+ AND there is genuinely new information → "developing"
   - If mention_count 3+ AND there is NO new information → "recurring"
   - ESCALATION: If a tracked story has a DRAMATIC new development... classify as "escalation" regardless of mention_count.

2. If no matching story_key exists in the tracker:
   - The user has NEVER heard about this → "breaking"
   - If it's a one-time announcement unlikely to have follow-ups → "one_off"
   - Default → "breaking"

3. STORY_KEY STABILITY + UMBRELLA: Reuse existing story_keys from the tracker when covering the same event.

4. big_event: Set to true for events that will dominate markets for days/weeks...

5. big_event_tier (set ONLY when big_event=true): Tier 1/2/3 rules...

BIG EVENT DETECTION RULES: (a)-(f)...
`;
}
```

**Injection points:** This block is appended in:
- `buildAnalystPromptMacro(..., pContext)` → `${pContext ? buildPersonalizationPromptBlock(pContext) : ""}`
- `buildAnalystPromptPortfolio(..., pContext)` → `${pContext ? buildPersonalizationPromptBlock(pContext) : ""}`

---

## 4. Stage 3 Scriptwriter — continuity and watch history

### 4.1 Where personalization is passed in

Personalization is loaded once in parallel with other data:

```typescript
const [tickerMarketMap, macroCandidates, earningsCalendar, marketSnapshotForAnalyst, personalizationContext] = await Promise.all([
  fetchAllTickerMarketData(briefingTickers),
  fetchMacroCandidates(userInterests),
  fetchEarningsCalendar(briefingTickers, finnhubKey),
  fetchMarketSnapshot(),
  loadPersonalizationContext(base44, userEmail, date, briefingTickers),
]);
console.log(`📋 [Stage 0] memories=${personalizationContext.last_briefings?.length || 0} active_stories=${personalizationContext.active_stories?.length || 0} days_since=${personalizationContext.days_since_last} day_count=${personalizationContext.user_day_count || 0}`);
```

Then passed to Stage 2 (macro + portfolio analyst) and Stage 3:

- `buildAnalystPromptMacro(rawIntelligence, isWeekendDay, marketSnapshotForAnalyst, personalizationContext)`
- `buildAnalystPromptPortfolio(rawIntelligence, isWeekendDay, personalizationContext)`
- `buildScriptwriterPrompt({ ..., personalizationContext, macroSameEvent })`

### 4.2 Watch item history (from last_briefings)

```typescript
const watchItemHistory = (() => {
  if (!pCtx || pCtx.last_briefings.length === 0) return {};
  const allWatchItems: string[] = [];
  for (const b of pCtx.last_briefings) {
    allWatchItems.push(...(b.watch_items_mentioned || []));
  }
  return { recent_watch_items: allWatchItems.slice(0, 6) };
})();
```

This is included in the scriptwriter prompt as `<watch_history>${JSON.stringify(watchItemHistory)}</watch_history>`.

### 4.3 Continuity block (Stage 3)

When `pCtx` exists and `pCtx.user_day_count > 0`, the scriptwriter gets a **CONTINUITY & PERSONALIZATION** block that includes:

- "You are a personal financial assistant who has been briefing ${name} daily. You remember what you told them."
- **PRICE SINCE LAST BRIEFING** — for each portfolio selection, previous price vs current (from `last_briefings[0].portfolio_stories`) so the script can say "Since we last spoke, Nvidia is up 3.4%".
- **NEW HOLDINGS** / **REMOVED HOLDINGS** — from `pCtx.holdings_changed`.
- **EVENT TYPE SCRIPTING** — BREAKING / DEVELOPING / ESCALATION / RECURRING / ONE_OFF and **WATCH ITEM PROGRESSION**.
- **RELATIONSHIP STAGE** — NEW USER (day_count ≤ 3), GETTING COMFORTABLE (≤ 14), ESTABLISHED, with briefing #.
- **MISSED BRIEFINGS** — when `days_since_last >= 5` or `>= 2`.
- **BIG EVENT PROTOCOL** — for `pCtx.active_stories.filter(s => s.big_event)` with tier and days-since-first scripting.

If `pCtx` is null or `user_day_count === 0`, `continuityBlock` is `""` and the scriptwriter gets no continuity text.

---

## 5. "Already covered today" (freshness)

Stories already covered in a **same-day** briefing are tracked so the pipeline can avoid repeating them. This uses `DailyBriefing` + `news_stories`, not BriefingMemory:

```typescript
// STEP 1A.5: Build "already covered today" set for freshness
const seenStoryKeys = new Set<string>();
try {
  const todaysBriefings = await base44.asServiceRole.entities.DailyBriefing.filter({
    date,
    created_by: userEmail,
  });
  for (const briefing of todaysBriefings || []) {
    const stories = Array.isArray(briefing?.news_stories)
      ? briefing.news_stories
      : (typeof briefing?.news_stories === "string"
          ? JSON.parse(briefing.news_stories || "[]")
          : []);
    for (const s of stories || []) {
      const key = normalizeStoryKey(s);
      if (key) seenStoryKeys.add(key);
    }
  }
  console.log(`🧠 [Freshness] Found ${seenStoryKeys.size} story keys already covered today`);
} catch (e: any) {
  console.warn(`⚠️ [Freshness] Could not read prior briefings: ${e.message}`);
}
```

So "already covered today" is driven by **DailyBriefing.news_stories** for this user/date; **BriefingMemory** and **StoryTracker** are used for cross-day continuity and classification.

---

## 6. Saving briefing memory (after Stage 3)

After a successful Stage 3 run, memory is persisted by invoking the standalone `briefingMemory` function:

```typescript
console.log("💾 [Memory] Saving briefing memory...");
try {
  await base44.asServiceRole.functions.invoke("briefingMemory", {
    userId: userEmail,
    briefingDate: date,
    analyzedBrief,
    tickerMarketMap,
    scriptwriterResult,
    holdingsAtTime: briefingTickers,
  });
} catch (memoryErr: any) {
  console.error("⚠️ [Memory] Failed:", memoryErr?.message, memoryErr?.stack ?? memoryErr);
}
```

So the **current** briefing’s `analyzedBrief`, `tickerMarketMap`, `scriptwriterResult`, and `briefingTickers` are what get written to BriefingMemory and StoryTracker; the **next** run’s `loadPersonalizationContext` will see that data (and any prior days).

---

## 7. Summary for analysis

- **BriefingMemory** — one row per (user_id, date); stores macro/portfolio/watch_items/holdings_at_time for that day. Read by `loadPersonalizationContext` (all memories for user, then sort by date desc, take 3). Used for: last-briefing summary, price-since-last, holdings diff, watch history, days_since_last.
- **StoryTracker** — one row per (user_id, story_key). Updated by `briefingMemory` (upsertStoryTracker) for each macro/portfolio story and watch item. Read by `loadPersonalizationContext` (filter user, status active|fading). Used for: event_type classification, big_event, continuity block, big-event protocol.
- **BriefingDelivery** — append-only per delivery. Read by `loadPersonalizationContext` to compute `user_day_count` (unique dates). Also written by `briefingMemory` after saving memory.
- **user_day_count** — number of **distinct dates** the user has had a delivery (from BriefingDelivery), not "number of briefings."
- **days_since_last** — derived from **last briefing date** (from BriefingMemory: last_briefings[0].date) vs today. So it depends on the most recent **saved** BriefingMemory record.
- **holdings_changed** — diff of current holdings vs `last_briefings[0].holdings_at_time` (from BriefingMemory).
- **continuityBlock** is only added when `personalizationContext.user_day_count > 0`. New users (0 deliveries) get no continuity block even if they have BriefingMemory/StoryTracker data from the same run (that run hasn’t been saved yet).

If something still feels wrong (e.g. "briefing doesn’t feel personalized" or "story continuity is off"), things to check: that `briefingMemory` is actually invoked and succeeding after each briefing; that Base44 entities and indexes match the code; that `user_id`/`created_by`/email are consistent; and that the LLM is receiving and following the personalization and continuity blocks.
