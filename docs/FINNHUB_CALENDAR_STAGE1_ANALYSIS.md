# Finnhub Calendar Stage 1 — Analysis vs Claude Prompt

This doc compares the Claude prompt (`cursor-stage1-finnhub-calendar.md`) to the actual codebase and our prior discussion. Use it to implement the calendar integration correctly.

---

## 1. What to keep from the Claude prompt

- **One global earnings call** (no `symbol`) is correct: Finnhub `calendar/earnings?from=&to=&token=` returns all earnings in the range; we then filter to user holdings + major tickers. No per-ticker calls needed.
- **Parallel block**: Add two new calls alongside existing Stage 1A+1B; no extra latency.
- **Put calendar in raw intelligence**: Add `upcoming_events: { earnings, economic }` to the object passed to Stage 2 (and optionally show a human-readable block in the prompt).
- **Stage 2 prompt**: Add an UPCOMING EVENTS section and a rule that watch_items MUST prioritize calendar data.
- **Graceful failure**: Try/catch on both calendar calls, return `[]` on error so the pipeline never breaks.

---

## 2. Adjustments required (codebase-accurate)

### 2.1 Variable and function names

Claude’s snippet uses different names than the codebase. Use these:

| Claude doc | Actual in code |
|------------|-----------------|
| `fetchTickerMarketData(holdings)` | **`fetchAllTickerMarketData(briefingTickers)`** — and it returns a **map** `Record<string, TickerMarketData>`, not an array. |
| `fetchMacroCandidates(sectorInterests)` | **`fetchMacroCandidates(userInterests)`** — param is `userInterests`. |
| `holdingTickers` / `holdings` | **`briefingTickers`** — array of ticker strings (uppercase). |
| `FINNHUB_KEY` | **`Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY`** — same pattern as elsewhere in this file (e.g. around line 1214). |

So the parallel block should look like:

```ts
const [tickerMarketMap, macroCandidates, earningsCalendar, economicCalendar] = await Promise.all([
  fetchAllTickerMarketData(briefingTickers),
  fetchMacroCandidates(userInterests),
  fetchEarningsCalendar(briefingTickers, finnhubKey),  // pass key explicitly
  fetchEconomicCalendar(finnhubKey),
]);
```

Get `finnhubKey` once before the `Promise.all` (same way as in `fetchMarketSnapshot`).

---

### 2.2 Where to attach `upcoming_events`

- **Do not** change `buildRawIntelligencePackage` signature or its return type for this.
- **After** `buildRawIntelligencePackage(...)` is called (around line 3836), **mutate** the result:

  ```ts
  const rawIntelligence = buildRawIntelligencePackage(...);
  rawIntelligence.upcoming_events = {
    earnings: earningsCalendar,
    economic: economicCalendar,
  };
  ```

- **TypeScript**: Extend the `RawIntelligencePackage` interface (around line 2132) with an optional field so this is type-safe and backward compatible:

  ```ts
  upcoming_events?: {
    earnings: Array<{ ticker: string; date: string; estimated_eps?: number; quarter?: number; year?: number; hour?: string }>;
    economic: Array<{ event: string; date: string; country?: string; impact?: string; previous?: string; estimate?: string; unit?: string }>;
  };
  ```

---

### 2.3 Earnings date range

- Claude: 14 days.
- We discussed **30 days** for earnings so “What to Watch” can mention events further out (e.g. “Walmart earnings in three weeks”).
- **Recommendation**: Use **30 days** for earnings (`to = today + 30`). Keep economic at 7 days. If you prefer 14 for earnings to match Claude, that’s a one-line change.

---

### 2.4 Economic calendar: API and impact field

- Finnhub’s **economic** calendar may be part of a **paid** “Economic-1” tier ($50/month). The **earnings** calendar is on the standard/free API.
- **Implementation**: Call the economic endpoint in a try/catch; on failure or 403, return `[]` and log. Pipeline must work with earnings-only if economic is unavailable.
- **Impact field**: The doc uses `e.impact === 'high' || e.impact === 'medium'`. Some APIs use numeric impact (e.g. 1–3). Check Finnhub’s real response (or their docs) and normalize: e.g. if they use numbers, treat `2` and `3` as medium/high. If the field is missing, still include the event but omit impact in the formatted line.

---

### 2.5 Prompt injection point and guards

- **Where**: Add the UPCOMING EVENTS block in **`buildAnalystPrompt`**, **before** the “RAW INTELLIGENCE PACKAGE” section (so the Analyst sees the rule and the list before the big JSON).
- **Guard**: If `rawIntelligence.upcoming_events` is missing or both arrays are empty, either:
  - Omit the UPCOMING EVENTS block, or
  - Add one line: “No calendar data for this run. Populate watch_items from news/context as before.”
- **Format**: When present, format earnings and economic lists as in the Claude doc, but use the actual property names from our normalized shapes (e.g. `estimated_eps`, `hour`, `event`, `date`, `impact`, `estimate`, `previous`, `unit`). Handle missing fields (e.g. no `e.estimated_eps`) so we don’t print “undefined”.

---

### 2.6 watch_items schema (unchanged)

- We keep the **existing** Stage 2 schema for `watch_items`: object with `primary` and `secondary` (each with `event`, `date`, `importance`, `affects_holdings`, `why_it_matters`, `is_future_event`). Do **not** change to a string. The Analyst fills these from the calendar + narrative; the UPCOMING EVENTS rule tells them to prioritize calendar events.

---

### 2.7 Scriptwriter “What to Watch” (not in Claude doc)

- In Stage 3, when we have calendar data (e.g. `analyzedBrief.watch_items` populated from calendar), we should **avoid** the phrase “No major catalysts coming up” and prefer specific events from watch_items.
- This can be a small addition to the existing “What to Watch” instructions in the scriptwriter prompt (e.g. “When watch_items contain specific dates from the calendar, lead with those. Do not say ‘no major catalysts’ when calendar data was provided.”). Optional to do in this same PR or in a follow-up.

---

## 3. Open question before implementation

**Economic calendar access**

- If your Finnhub account does **not** have the paid Economic tier, the economic calendar call may return 403 or an error. The plan is: catch, log, and return `[]`, so the pipeline still runs with earnings-only.
- **Question for you**: Do you already have (or plan to have) Finnhub economic calendar access? If not, we can either:
  - Implement both calls and rely on graceful fallback (earnings-only if economic fails), or
  - Implement **earnings only** first and add economic later when you confirm access.

Once you confirm, implementation can proceed without changing the overall structure.

---

## 4. Implementation checklist (corrected)

1. **Earnings**
   - Add `fetchEarningsCalendar(userHoldings: string[], finnhubKey: string)`.
   - One GET to `calendar/earnings?from=today&to=today+30&token=...` (no symbol).
   - Normalize to `{ ticker, date, estimated_eps, quarter, year, hour }`.
   - Filter to holdings + major tickers (e.g. AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA); dedupe by ticker+date if needed.
   - Return `[]` on error.

2. **Economic**
   - Add `fetchEconomicCalendar(finnhubKey: string)`.
   - GET `calendar/economic?from=today&to=today+7&token=...`.
   - Normalize to `{ event, date, country, impact, previous, estimate, unit }`; filter to high/medium impact (handle both string and numeric impact if needed).
   - Return `[]` on error.

3. **Pipeline**
   - Before the existing `Promise.all`, define `finnhubKey = Deno.env.get("FINNHUB_API_KEY") || FINNHUB_FALLBACK_KEY`.
   - Extend `Promise.all` to include `fetchEarningsCalendar(briefingTickers, finnhubKey)` and `fetchEconomicCalendar(finnhubKey)`.
   - Destructure as `[tickerMarketMap, macroCandidates, earningsCalendar, economicCalendar]`.
   - After `buildRawIntelligencePackage(...)`, set `rawIntelligence.upcoming_events = { earnings: earningsCalendar, economic: economicCalendar }`.
   - Add `RawIntelligencePackage.upcoming_events` as optional in the interface.

4. **Stage 2 prompt**
   - In `buildAnalystPrompt`, before “RAW INTELLIGENCE PACKAGE”, if `rawIntelligence.upcoming_events` exists and has data, add the UPCOMING EVENTS block (formatted list + WATCH ITEMS RULE). Else add a single line that no calendar data is present.
   - Ensure all referenced fields (e.g. `estimated_eps`, `hour`, `impact`) are safely handled when missing.

5. **Logging**
   - Log: `📅 [Stage 1] Earnings calendar: N upcoming events (M for user holdings)` and `📅 [Stage 1] Economic calendar: K events` (and in Stage 1D: “Upcoming events: N earnings, K economic”).

6. **Verify**
   - Run a briefing; confirm logs, Stage 2 watch_items use calendar dates, and “What to Watch” in the script mentions specific events when calendar data exists.

---

## 5. Summary

- Claude’s overall design (one earnings call, filter client-side; economic call; add to raw intelligence; Stage 2 rule) is correct.
- Use the **actual** function and variable names from the codebase, attach **`upcoming_events`** after building raw intelligence, extend the **interface** for type safety, and **guard** the prompt when `upcoming_events` is missing.
- Prefer **30 days** for earnings; keep economic at 7 days; handle economic API failure gracefully; optionally tighten Stage 3 “What to Watch” wording in this or a follow-up PR.
- One open decision: implement economic call with graceful fallback, or earnings-only until you confirm Finnhub economic access.
