import { motion } from "framer-motion"

const stocks = [
  { symbol: "AAPL", change: "+0.72%", positive: true },
  { symbol: "TSLA", change: "-3.45%", positive: false },
  { symbol: "NVDA", change: "+2.18%", positive: true },
  { symbol: "MSFT", change: "+0.34%", positive: true },
  { symbol: "GOOG", change: "-0.89%", positive: false },
  { symbol: "AMZN", change: "+1.56%", positive: true },
  { symbol: "META", change: "+0.92%", positive: true },
  { symbol: "BTC", change: "+4.21%", positive: true },
]

export function MarketTicker() {
  return (
    <div className="relative mt-12 overflow-hidden py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      
      <motion.div
        className="flex gap-6"
        animate={{ x: [0, -800] }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {[...stocks, ...stocks].map((stock, i) => (
          <div
            key={`${stock.symbol}-${i}`}
            className="flex shrink-0 items-center gap-2 glass-card rounded-full px-5 py-2.5"
          >
            <span className="font-semibold text-foreground">{stock.symbol}</span>
            <span
              className={`text-sm font-semibold ${
                stock.positive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {stock.change}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
