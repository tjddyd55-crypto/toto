const { chromium } = require("playwright");

const ODDS_KEYWORDS = ["odds", "market", "price", "bet", "home", "away"];
const THREE_NUMBER_PATTERN = /(\d+(?:\.\d+)?)[^0-9]+(\d+(?:\.\d+)?)[^0-9]+(\d+(?:\.\d+)?)/;
const THREE_NUMBER_PATTERN_GLOBAL = /(\d+(?:\.\d+)?)[^0-9]+(\d+(?:\.\d+)?)[^0-9]+(\d+(?:\.\d+)?)/g;
const MIN_ODDS = 1.2;
const MAX_ODDS = 10;

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return "";
  }
}

function looksLikeOddsPayload(rawText) {
  const lower = rawText.toLowerCase();
  const hasKeyword = ODDS_KEYWORDS.some((keyword) => lower.includes(keyword));
  const hasThreeNumbers = THREE_NUMBER_PATTERN.test(rawText);
  return hasKeyword || hasThreeNumbers;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractOddsGroups(text) {
  const groups = [];
  let match;
  THREE_NUMBER_PATTERN_GLOBAL.lastIndex = 0;
  while ((match = THREE_NUMBER_PATTERN_GLOBAL.exec(text)) !== null) {
    const a = toNumber(match[1]);
    const b = toNumber(match[2]);
    const c = toNumber(match[3]);
    if (a === null || b === null || c === null) {
      continue;
    }
    groups.push([a, b, c]);
  }
  return groups;
}

function isValidOdds(values) {
  if (!Array.isArray(values) || values.length !== 3) {
    return false;
  }

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return false;
    }
    if (value < MIN_ODDS || value > MAX_ODDS) {
      return false;
    }
  }

  const hasDecimal = values.some((value) => value % 1 !== 0);
  if (!hasDecimal) {
    return false;
  }

  if (values[0] === values[1] && values[1] === values[2]) {
    return false;
  }

  return true;
}

function filterOddsTriplets(candidates) {
  const output = [];
  const dedupe = new Set();

  for (const values of candidates) {
    if (!isValidOdds(values)) {
      continue;
    }
    const key = values.map((item) => item.toFixed(3)).join("|");
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    output.push(values);
  }

  return output;
}

async function crawlUrl(targetUrl) {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();
  const responses = [];

  try {
    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()["content-type"] || "";
      let isJson = false;
      let preview = "";
      let looksLikeOdds = false;

      if (contentType.toLowerCase().includes("json")) {
        try {
          const jsonData = await response.json();
          isJson = true;
          preview = safeStringify(jsonData).slice(0, 500);
        } catch (_) {
          try {
            const textData = await response.text();
            preview = textData.slice(0, 500);
          } catch (_) {
            preview = "";
          }
        }
      } else {
        try {
          const textData = await response.text();
          preview = textData.slice(0, 500);
        } catch (_) {
          preview = "";
        }
      }

      looksLikeOdds = looksLikeOddsPayload(preview);

      responses.push({
        url,
        status,
        "content-type": contentType,
        isJson,
        preview,
        looksLikeOdds,
      });
    });

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    const oddsCandidates = responses.filter((item) => item.looksLikeOdds);
    const oddsTriplets = responses.flatMap((item) => extractOddsGroups(item.preview || ""));
    const oddsFiltered = filterOddsTriplets(oddsTriplets);

    return {
      success: true,
      responseCount: responses.length,
      responses,
      oddsCandidates,
      oddsFiltered,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  crawlUrl,
};
