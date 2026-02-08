/**
 * One-off script: call Finlight with ticker:AAPL (same date range as the app)
 * to see what Apple-related articles they return (e.g. iPad, MacBook, iPhone 17e).
 *
 * Run from repo root:
 *   FINLIGHT_API_KEY=your_key deno run --allow-env --allow-net scripts/finlight-ticker-aapl.ts
 *
 * Or export the key first:
 *   export FINLIGHT_API_KEY=your_key
 *   deno run --allow-env --allow-net scripts/finlight-ticker-aapl.ts
 */

const FINLIGHT_API_BASE = "https://api.finlight.me";

function getDateFromHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const apiKey = Deno.env.get("FINLIGHT_API_KEY");
  if (!apiKey) {
    console.error("❌ Set FINLIGHT_API_KEY in the environment.");
    Deno.exit(1);
  }

  const fromDate = getDateFromHoursAgo(48);
  const toDate = new Date().toISOString().slice(0, 10);

  console.log("🔍 Finlight ticker:AAPL (same 48h window as app)\n");
  console.log(`   from: ${fromDate}, to: ${toDate}\n`);

  const response = await fetch(`${FINLIGHT_API_BASE}/v2/articles`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      query: "ticker:AAPL",
      from: fromDate,
      to: toDate,
      language: "en",
      orderBy: "publishDate",
      order: "DESC",
      pageSize: 25,
    }),
  });

  if (!response.ok) {
    console.error("❌ Finlight error:", response.status, await response.text());
    Deno.exit(1);
  }

  const data = await response.json();
  const articles = data.articles || [];

  console.log(`✅ Finlight returned ${articles.length} articles for ticker:AAPL\n`);
  console.log("--- HEADLINES (order as returned by Finlight - we do not re-rank) ---\n");

  articles.forEach((a: any, i: number) => {
    const title = a.title || "(no title)";
    const published = a.publishDate ? new Date(a.publishDate).toISOString() : "?";
    const source = a.source || "?";
    console.log(`${i + 1}. ${title}`);
    console.log(`   Published: ${published} | Source: ${source}`);
    if (a.summary) console.log(`   Summary: ${(a.summary as string).slice(0, 120)}...`);
    console.log("");
  });

  const hasProductNews = articles.some(
    (a: any) =>
      /ipad|macbook|iphone\s*17|product\s*launch|announces/i.test(a.title || "") ||
      /ipad|macbook|iphone\s*17|product\s*launch/i.test(a.summary || "")
  );
  console.log("---");
  if (hasProductNews) {
    console.log("✅ At least one article looks like product/launch news (iPad, MacBook, iPhone 17, etc.).");
  } else {
    console.log("⚠️ No headlines in this set clearly look like Apple product/launch news.");
    console.log("   If you expected iPad/MacBook stories, the gap may be on Finlight's tagging or coverage.");
  }
}

main();
