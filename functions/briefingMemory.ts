/**
 * Briefing Memory & Story Tracker (Piece 1).
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
 *    - created_at: string (ISO date)
 *
 * 2) StoryTracker
 *    - user_id: string
 *    - story_key: string
 *    - first_mentioned: string (YYYY-MM-DD)
 *    - last_mentioned: string (YYYY-MM-DD)
 *    - mention_count: number
 *    - status: string ("active" | "fading" | "resolved")
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
  created_at: string;
}

export interface StoryTrackerMention {
  date: string;
  angle: string;
  key_fact: string;
}

/**
 * Generate a fallback story_key if the LLM didn't provide one.
 * snake_case, max 40 chars.
 */
export function generateFallbackKey(text: string): string {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  return words.join("_").substring(0, 40);
}

/**
 * Normalize event name + date into a stable watch-item key for story_tracker.
 * e.g. "FOMC meeting" + "2026-03-17" -> "watch:fomc_meeting_2026_03_17"
 */
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

/**
 * Returns true if two dates are the same calendar day (YYYY-MM-DD).
 */
function isSameCalendarDay(a: string, b: string): boolean {
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

/**
 * Returns true if first_mentioned is at least STORY_CYCLE_DAYS (7) days ago.
 */
function isNewCycle(first_mentioned: string, today: string): boolean {
  const first = new Date(first_mentioned);
  const t = new Date(today);
  if (isNaN(first.getTime()) || isNaN(t.getTime())) return false;
  const diffMs = t.getTime() - first.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays >= STORY_CYCLE_DAYS;
}

/**
 * Save or overwrite briefing memory for (user_id, date). One record per user per day.
 */
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

/**
 * Record one briefing delivery for (user_id, date). Append-only. Used to count briefings today (first vs same-day subsequent).
 */
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

/**
 * Get number of briefings delivered for this user on this date (for first_briefing_today logic).
 */
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
  related_ticker: string | null;
  mentions: string;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert story tracker. Respects:
 * - Same calendar day: do NOT increment mention_count (intra-day subsequent).
 * - 7-day cycle: if first_mentioned is 7+ days ago, reset to new cycle (mention_count = 1).
 * - Otherwise: increment mention_count (cap at 3 for display), update last_mentioned, append to mentions.
 */
export async function upsertStoryTracker(
  base44: {
    asServiceRole: {
      entities: {
        StoryTracker: {
          filter: (q: object) => Promise<StoryTrackerRecord[]>;
          create: (d: object) => Promise<{ id: string }>;
          update: (id: string, d: object) => Promise<unknown>;
        };
      };
    };
  },
  user_id: string,
  story_key: string,
  mention: { date: string; angle: string; key_fact: string },
  options: { related_ticker?: string | null } = {}
): Promise<void> {
  const today = mention.date.slice(0, 10);
  const existingList = await base44.asServiceRole.entities.StoryTracker.filter({
    user_id,
    story_key,
  });
  const existing = Array.isArray(existingList) && existingList.length > 0 ? (existingList as StoryTrackerRecord[])[0] : null;

  const newMention = { date: mention.date, angle: mention.angle, key_fact: mention.key_fact };
  let mentionsArr: StoryTrackerMention[] = [];

  if (existing) {
    const raw = existing.mentions;
    if (Array.isArray(raw)) mentionsArr = raw as StoryTrackerMention[];
    else if (typeof raw === "string") {
      try {
        mentionsArr = JSON.parse(raw);
      } catch {
        mentionsArr = [];
      }
    }
    const alreadyMentionedToday = mentionsArr.some((m) => isSameCalendarDay(m.date, today));
    if (alreadyMentionedToday) {
      // Same-day subsequent: do NOT increment. Optionally append a brief "intra-day" mention for history.
      mentionsArr.push({ ...newMention, angle: "[intra-day] " + (mention.angle || "").slice(0, 80) });
      await base44.asServiceRole.entities.StoryTracker.update(existing.id, {
        last_mentioned: today,
        mentions: JSON.stringify(mentionsArr),
      });
      return;
    }
    if (isNewCycle(existing.first_mentioned, today)) {
      // New 7-day cycle: reset to mention_count = 1.
      mentionsArr = [newMention];
      await base44.asServiceRole.entities.StoryTracker.update(existing.id, {
        first_mentioned: today,
        last_mentioned: today,
        mention_count: 1,
        status: "active",
        mentions: JSON.stringify(mentionsArr),
      });
      return;
    }
    // New day, same cycle: increment (cap at 3 for display; we store actual count).
    const newCount = Math.min((existing.mention_count || 0) + 1, 99);
    let status = existing.status || "active";
    if (newCount >= 6) status = "fading";
    mentionsArr.push(newMention);
    await base44.asServiceRole.entities.StoryTracker.update(existing.id, {
      last_mentioned: today,
      mention_count: newCount,
      status,
      mentions: JSON.stringify(mentionsArr),
    });
    return;
  }

  // Create new tracker.
  await base44.asServiceRole.entities.StoryTracker.create({
    user_id,
    story_key,
    first_mentioned: today,
    last_mentioned: today,
    mention_count: 1,
    status: "active",
    related_ticker: options.related_ticker ?? null,
    mentions: JSON.stringify([newMention]),
  });
}