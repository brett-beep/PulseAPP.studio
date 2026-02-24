/**
 * Static US economic calendar — events retail investors care about.
 *
 * UPDATE STRATEGY: Manual. When the Fed/BLS/BEA publish new schedules (e.g. quarterly),
 * update this list. Sources:
 *   - FOMC: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 *   - BLS (CPI, NFP): https://www.bls.gov/schedule/
 *   - BEA (GDP, PCE): https://www.bea.gov/news/schedule
 *   - ISM: https://www.ismworld.org/
 * No scraping or cron required; a quick paste when schedules are released is enough.
 */

export type StaticEconomicEvent = {
  event: string;
  date: string; // YYYY-MM-DD
  country?: string;
  impact?: string;
  previous?: string;
  estimate?: string;
  unit?: string;
};

export type EconomicEventForBriefing = StaticEconomicEvent & { within_3_business_days: boolean };

/**
 * Predetermined US events that matter most to retail investors.
 * Dates are approximate (release day); update when official schedules publish.
 */
const ECONOMIC_CALENDAR_US: StaticEconomicEvent[] = [
  // ─── FOMC (rate decisions / meetings) ───
  { event: "FOMC meeting", date: "2026-03-17", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-04-28", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-06-16", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-07-28", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-09-15", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-10-27", country: "US", impact: "high" },
  { event: "FOMC meeting", date: "2026-12-08", country: "US", impact: "high" },
  // ─── CPI (inflation) ───
  { event: "CPI (Consumer Price Index)", date: "2026-02-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-03-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-04-10", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-05-12", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-06-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-07-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-08-12", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-09-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-10-11", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-11-12", country: "US", impact: "high" },
  { event: "CPI (Consumer Price Index)", date: "2026-12-11", country: "US", impact: "high" },
  // ─── Non-Farm Payrolls (jobs) ───
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-02-06", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-03-06", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-04-03", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-05-01", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-06-05", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-07-03", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-08-07", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-09-04", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-10-02", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-11-06", country: "US", impact: "high" },
  { event: "Non-Farm Payrolls (Employment Situation)", date: "2026-12-04", country: "US", impact: "high" },
  // ─── GDP ───
  { event: "GDP (advance)", date: "2026-04-30", country: "US", impact: "high" },
  { event: "GDP (advance)", date: "2026-07-30", country: "US", impact: "high" },
  { event: "GDP (advance)", date: "2026-10-29", country: "US", impact: "high" },
  { event: "GDP (advance)", date: "2027-01-28", country: "US", impact: "high" },
  // ─── PCE (Fed's preferred inflation gauge) ───
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-02-27", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-03-27", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-04-30", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-05-29", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-06-27", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-07-31", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-08-28", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-09-30", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-10-30", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-11-25", country: "US", impact: "high" },
  { event: "PCE (Personal Consumption Expenditures)", date: "2026-12-23", country: "US", impact: "high" },
  // ─── Consumer Confidence ───
  { event: "Consumer Confidence (Conference Board)", date: "2026-02-25", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-03-25", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-04-28", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-05-27", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-06-25", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-07-28", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-08-26", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-09-30", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-10-28", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-11-25", country: "US", impact: "medium" },
  { event: "Consumer Confidence (Conference Board)", date: "2026-12-30", country: "US", impact: "medium" },
  // ─── ISM Manufacturing ───
  { event: "ISM Manufacturing PMI", date: "2026-02-02", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-03-02", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-04-01", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-05-01", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-06-02", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-07-01", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-08-03", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-09-01", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-10-01", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-11-02", country: "US", impact: "medium" },
  { event: "ISM Manufacturing PMI", date: "2026-12-01", country: "US", impact: "medium" },
  // ─── Retail Sales ───
  { event: "Retail Sales", date: "2026-02-13", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-03-13", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-04-14", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-05-14", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-06-12", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-07-15", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-08-14", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-09-15", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-10-15", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-11-16", country: "US", impact: "medium" },
  { event: "Retail Sales", date: "2026-12-15", country: "US", impact: "medium" },
];

/**
 * Returns US economic events for the briefing with cadence metadata.
 * - High impact (FOMC, CPI, NFP, PCE, GDP): included if within next 14 days.
 * - Medium impact (ISM, Retail Sales, Consumer Confidence): included if within next 7 days.
 * - Each event gets within_3_business_days: true when the event is today or in the next 3 business days
 *   (remind every day in that window); otherwise the LLM should mention selectively.
 */
export function getUpcomingEconomicEvents(): EconomicEventForBriefing[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const HIGH_IMPACT_DAYS = 14;
  const MEDIUM_IMPACT_DAYS = 7;

  const result: EconomicEventForBriefing[] = [];

  for (const e of ECONOMIC_CALENDAR_US) {
    const parts = e.date.split("-").map(Number);
    if (parts.length !== 3) continue;
    const eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(eventDate.getTime())) continue;
    if (eventDate < today) continue;

    const calendarDaysUntil = Math.round((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const isHigh = e.impact === "high";
    const windowDays = isHigh ? HIGH_IMPACT_DAYS : MEDIUM_IMPACT_DAYS;
    if (calendarDaysUntil > windowDays) continue;

    const businessDaysUntil = getBusinessDaysUntil(today, eventDate);
    const within_3_business_days = businessDaysUntil >= 0 && businessDaysUntil <= 3;

    result.push({ ...e, within_3_business_days });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getBusinessDaysUntil(today: Date, eventDate: Date): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  if (e < t) return -1;
  if (e.getTime() === t.getTime()) return 0;
  let count = 0;
  const cur = new Date(t);
  cur.setDate(cur.getDate() + 1);
  while (cur <= e) {
    if (!isWeekend(cur)) count++;
    if (cur.getTime() >= e.getTime()) break;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
