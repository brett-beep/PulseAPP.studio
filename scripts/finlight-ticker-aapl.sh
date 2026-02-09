#!/bin/bash
# Call Finlight with ticker:AAPL (same 48h window as the app).
# Usage: FINLIGHT_API_KEY=your_key ./scripts/finlight-ticker-aapl.sh
# Or:    export FINLIGHT_API_KEY=your_key && ./scripts/finlight-ticker-aapl.sh

if [ -z "$FINLIGHT_API_KEY" ] || [ "$FINLIGHT_API_KEY" = "your_real_finlight_key" ]; then
  echo "❌ Set FINLIGHT_API_KEY to your real key."
  exit 1
fi

# macOS: date -v-48H; Linux: date -d "48 hours ago"
FROM=$(date -v-48H +%Y-%m-%d 2>/dev/null || date -d "48 hours ago" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
TO=$(date +%Y-%m-%d)

echo "🔍 Finlight ticker:AAPL (48h window)"
echo "   from: $FROM, to: $TO"
echo ""

RESP=$(curl -s -X POST "https://api.finlight.me/v2/articles" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $FINLIGHT_API_KEY" \
  -d "{\"query\":\"ticker:AAPL\",\"from\":\"$FROM\",\"to\":\"$TO\",\"language\":\"en\",\"orderBy\":\"publishDate\",\"order\":\"DESC\",\"pageSize\":25}")

if echo "$RESP" | grep -q '"articles"'; then
  echo "✅ Headlines (order from Finlight):"
  echo "$RESP" | grep -o '"title":"[^"]*"' | sed 's/"title":"//;s/"$//' | nl
  echo ""
  echo "--- Full response saved to /tmp/finlight-aapl.json ---"
  echo "$RESP" > /tmp/finlight-aapl.json
  if echo "$RESP" | grep -qiE 'ipad|macbook|iphone.?17|product.?launch'; then
    echo "✅ At least one article looks like product/launch news."
  else
    echo "⚠️ No obvious iPad/MacBook/iPhone 17 product headlines in this set."
  fi
else
  echo "❌ Error or unexpected response:"
  echo "$RESP" | head -5
  exit 1
fi
