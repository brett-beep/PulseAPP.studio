// Quick test script for Finlight API
// Replace YOUR_FINLIGHT_KEY with your actual key

const FINLIGHT_KEY = "sk_fdf3b472bad35e87232b83264f605c45d5e6077ddd8738d7d9bbe6f73d075706"; // Replace this

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

console.log(`Testing Finlight API from ${yesterday} to ${today}...`);

fetch("https://api.finlight.me/v2/articles", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "Content-Type": "application/json",
    "X-API-KEY": FINLIGHT_KEY,
  },
  body: JSON.stringify({
    from: yesterday,
    to: today,
    language: "en",
    orderBy: "publishDate",
    order: "DESC",
    pageSize: 10,
    page: 1,
  }),
})
  .then(async (response) => {
    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log("Response:", text.slice(0, 500)); // First 500 chars
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`\n✅ Success! Got ${data.articles?.length || 0} articles`);
    } else {
      console.log(`\n❌ Error: ${response.status}`);
    }
  })
  .catch((err) => {
    console.error("❌ Network error:", err.message);
  });
