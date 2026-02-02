// classifyTicker.ts - Classifies tickers into portfolio categories
// Uses Alpha Vantage OVERVIEW API for company fundamentals

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const TECH_SIGNATURES = ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "NVDA", "INTC", "AMD", "CRM", "ORCL", "ADBE", "CSCO"];
const GROWTH_SIGNATURES = ["TSLA", "SHOP", "SQ", "ABNB", "UBER", "LYFT", "PLTR", "SNOW", "RBLX", "DKNG", "HOOD", "RIVN", "LCID", "SOFI"];
const ENERGY_SIGNATURES = ["XLE", "CVX", "XOM", "COP", "SLB", "OXY", "HAL", "MPC", "PSX", "VLO", "EOG", "PXD"];
const CRYPTO_SIGNATURES = ["COIN", "MARA", "RIOT", "MSTR", "CLSK", "HUT", "BITF", "HIVE"];

function classifyTicker(ticker: string, alphaVantageData: any): string {
  ticker = ticker.toUpperCase();

  // Direct signature matches (high confidence)
  if (TECH_SIGNATURES.includes(ticker)) return "TECH";
  if (GROWTH_SIGNATURES.includes(ticker)) return "GROWTH";
  if (ENERGY_SIGNATURES.includes(ticker)) return "ENERGY";
  if (CRYPTO_SIGNATURES.includes(ticker)) return "CRYPTO";

  // Fallback to fundamental analysis
  const sector = (alphaVantageData.Sector || "").toLowerCase();
  const industry = (alphaVantageData.Industry || "").toLowerCase();
  const marketCap = parseFloat(alphaVantageData.MarketCapitalization) || 0;
  const peRatio = parseFloat(alphaVantageData.PERatio) || 0;
  const beta = parseFloat(alphaVantageData.Beta) || 1.0;

  // Crypto-related
  if (industry.includes("crypto") || industry.includes("blockchain") || industry.includes("bitcoin")) {
    return "CRYPTO";
  }

  // Energy sector
  if (sector.includes("energy") || industry.includes("oil") || industry.includes("gas") || industry.includes("petroleum")) {
    return "ENERGY";
  }

  // Large-cap Tech (>$100B market cap in tech/communication sectors)
  if ((sector.includes("technology") || sector.includes("communication")) && marketCap > 100_000_000_000) {
    return "TECH";
  }

  // Growth characteristics (high P/E, high beta, or disruptive industries)
  const growthIndustries = [
    "electric vehicle", "ev", "fintech", "saas", "cloud", "rideshare",
    "e-commerce platform", "gaming", "streaming", "renewable", "solar",
    "autonomous", "space", "biotech"
  ];
  const isGrowthIndustry = growthIndustries.some(kw => industry.includes(kw));
  if (isGrowthIndustry || peRatio > 40 || beta > 1.3) {
    return "GROWTH";
  }

  // Default to MIXED (diversified/value/dividend stocks)
  return "MIXED";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ticker = (body?.ticker || "").toUpperCase().trim();

    if (!ticker) {
      return Response.json({ error: "Ticker required" }, { status: 400 });
    }

    const ALPHA_VANTAGE_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    if (!ALPHA_VANTAGE_KEY) {
      return Response.json({ error: "ALPHA_VANTAGE_API_KEY not configured" }, { status: 500 });
    }

    // Check direct signature first (saves API call)
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

    // Fetch from Alpha Vantage for unknown tickers
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.Symbol) {
      // Ticker not found - default to MIXED
      return Response.json({ 
        ticker, 
        portfolio_category: "MIXED", 
        source: "default",
        warning: "Ticker not found in Alpha Vantage"
      });
    }

    const category = classifyTicker(ticker, data);

    return Response.json({
      ticker: data.Symbol,
      name: data.Name,
      sector: data.Sector,
      industry: data.Industry,
      market_cap: parseFloat(data.MarketCapitalization) || 0,
      pe_ratio: parseFloat(data.PERatio) || 0,
      beta: parseFloat(data.Beta) || 1.0,
      portfolio_category: category,
      source: "alpha_vantage",
    });
  } catch (error: any) {
    console.error("❌ classifyTicker error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
