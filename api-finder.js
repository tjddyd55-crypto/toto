const { chromium } = require("playwright");

const URL_KEYWORDS = ["match", "calendar", "list", "odds", "pre"];

function includesTargetKeyword(url) {
  const lower = String(url || "").toLowerCase();
  return URL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function runApiFinder(targetUrl, keywordFilter) {
  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage();
  const seen = new Set();
  const logs = [];

  try {
    page.on("response", async (response) => {
      try {
        const url = response.url();
        if (seen.has(url)) {
          return;
        }

        const contentType = String(response.headers()["content-type"] || "").toLowerCase();
        if (!contentType.includes("application/json")) {
          return;
        }

        if (!includesTargetKeyword(url)) {
          return;
        }

        if (keywordFilter && !url.toLowerCase().includes(String(keywordFilter).toLowerCase())) {
          return;
        }

        seen.add(url);

        const method = response.request().method();
        const status = response.status();
        let body = "";

        try {
          body = await response.text();
        } catch (_) {
          body = "";
        }

        logs.push({
          url,
          method,
          status,
          body: String(body || "").slice(0, 1000),
        });
      } catch (_) {
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForTimeout(2500);

    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(700);
    }

    await page.waitForTimeout(2000);

    return logs;
  } finally {
    await browser.close();
  }
}

module.exports = {
  runApiFinder,
};
