// classifyTicker.ts - Classifies tickers into portfolio categories
// Uses signature lists only (no external API). Unknown tickers default to MIXED.

const TECH_SIGNATURES = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "INTC", "AMD", "CRM", "ORCL", "ADBE", "CSCO"];
const GROWTH_SIGNATURES = ["TSLA", "SHOP", "SQ", "ABNB", "UBER", "LYFT", "PLTR", "SNOW", "RBLX", "DKNG", "HOOD", "RIVN", "LCID", "SOFI"];
const ENERGY_SIGNATURES = ["XLE", "CVX", "XOM", "COP", "SLB", "OXY", "HAL", "MPC", "PSX", "VLO", "EOG", "PXD"];
const CRYPTO_SIGNATURES = ["COIN", "MARA", "RIOT", "MSTR", "CLSK", "HUT", "BITF", "HIVE"];

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const ticker = (body?.ticker || "").toUpperCase().trim();

    if (!ticker) {
      return Response.json({ error: "Ticker required" }, { status: 400 });
    }

    if (TECH_SIGNATURES.includes(ticker)) {
      return Response.json({ ticker, portfolio_category: "TECH", source: "signature" });
    }
    if (GROWTH_SIGNATURES.includes(ticker)) {
      return Response.json({ ticker, portfolio_category: "GROWTH", source: "signature" });
    }
    if (ENERGY_SIGNATURES.includes(ticker)) {
      return Response.json({ ticker, portfolio_category: "ENERGY", source: "signature" });
    }
    if (CRYPTO_SIGNATURES.includes(ticker)) {
      return Response.json({ ticker, portfolio_category: "CRYPTO", source: "signature" });
    }

    // Unknown ticker – default to MIXED (no external API)
    return Response.json({
      ticker,
      portfolio_category: "MIXED",
      source: "default",
    });
  } catch (error: any) {
    console.error("❌ classifyTicker error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
