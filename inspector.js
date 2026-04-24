const { chromium } = require("playwright");
const fs = require("fs");

let allMatches = [];

async function autoScrollAll(page) {
  await page.evaluate(async () => {
    const scrollables = Array.from(document.querySelectorAll("*")).filter(
      (el) => el.scrollHeight > el.clientHeight
    );

    for (const el of scrollables) {
      await new Promise((resolve) => {
        let total = 0;
        const distance = 300;

        const timer = setInterval(() => {
          el.scrollBy(0, distance);
          total += distance;

          if (total >= el.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    }
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function parseMatchesFromText(text) {
  console.log("===== DEBUG START =====");
  console.log("TEXT LENGTH:", text ? text.length : 0);
  if (!text || text.length === 0) {
    console.log("ERROR: TEXT EMPTY");
  }
  console.log("TEXT PREVIEW:", String(text).slice(0, 300));

  const lines = String(text || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  console.log("LINES COUNT:", lines.length);
  console.log("LINES SAMPLE:", lines.slice(0, 20));

  const matches = [];
  const unique = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.toLowerCase().includes("vs")) {
      console.log("VS FOUND:", line);
    }
    if (!line.toLowerCase().includes("vs")) {
      continue;
    }

    const vsLine = line;
    const splitTeams = vsLine.split(/vs/i).map((value) => cleanText(value));
    const home = splitTeams[0] || "";
    const away = splitTeams[1] || "";

    let league = "";

    for (let j = i; j >= i - 5; j -= 1) {
      if (j < 0) break;

      const text = lines[j];

      if (
        text.includes("리그") ||
        text.includes("컵") ||
        text.includes("League") ||
        text.includes("Liga")
      ) {
        league = text;
        break;
      }
    }

    let time = "";
    for (let j = i; j >= i - 10; j -= 1) {
      if (j < 0) {
        break;
      }
      const matched = lines[j].match(/\d{1,2}:\d{2}/);
      if (matched) {
        time = matched[0];
        break;
      }
    }

    const oddsBlock = lines.slice(i, i + 6);
    const debugOddsBlock = lines.slice(i, i + 8);
    console.log("BLOCK:", debugOddsBlock);
    const blockText = oddsBlock ? oddsBlock.join(" ") : "";
    console.log("BLOCK TEXT:", blockText);
    const odds = (blockText.match(/\d+(\.\d+)?/g) || [])
      .map((value) => Number(value))
      .filter((value) => typeof value === "number" && !Number.isNaN(value));
    console.log("NUMS RAW:", blockText.match(/\d+(\.\d+)?/g));
    console.log("ODDS FINAL:", odds);

    const finalOdds = odds && odds.length >= 3 ? odds.slice(0, 3) : null;
    console.log("MATCH:", time, league, home, away, finalOdds);

    const key = `${time}_${home}_${away}`;
    if (unique[key]) {
      continue;
    }
    unique[key] = true;

    matches.push({
      date: null,
      time,
      league,
      home,
      away,
      odds: finalOdds,
    });
  }

  console.log("TOTAL MATCHES:", matches.length);
  console.log("===== DEBUG END =====");
  return matches;
}

async function inspectUrl(targetUrl) {
  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage();

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await page.waitForTimeout(2000);

    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1000);

    for (let i = 0; i < 5; i += 1) {
      await autoScrollAll(page);
      await page.waitForTimeout(1000);
    }

    const title = await page.title();
    allMatches = [];

    for (let i = 0; i < 5; i += 1) {
      const text = await page.innerText("body");
      const matches = parseMatchesFromText(text);

      console.log("RUN", i, "COUNT:", matches.length);

      allMatches = [...allMatches, ...matches];

      await page.waitForTimeout(1000);
    }

    const unique = {};

    allMatches = allMatches.filter((match) => {
      const key = `${match.home}_${match.away}`;

      if (unique[key]) return false;

      unique[key] = true;
      return true;
    });

    allMatches = allMatches.filter((match) => match.odds && match.odds.length === 3);

    const finalMatches = allMatches.map((match) => ({
      site: "x10x10",
      time: match.time,
      league: match.league || "",
      home: match.home,
      away: match.away,
      odds: match.odds,
    }));

    console.log("FINAL COUNT:", finalMatches.length);

    fs.writeFileSync(
      "matches_x10x10.json",
      JSON.stringify(finalMatches, null, 2)
    );

    console.log("저장 완료");

    // TODO: 다른 사이트 데이터도 동일 구조로 저장
    // TODO: 추후 home + away 기준으로 매칭 예정

    return {
      success: true,
      count: finalMatches.length,
      matches: finalMatches,
      pageInfo: {
        url: targetUrl,
        title,
      },
      html: "",
      bodyText: "",
      responses: [],
      numberCandidates: [],
      oddsCandidates: [],
      oddsFiltered: [],
      rawValues: finalMatches.map((item, index) => ({
        odds: item.odds,
        sourceType: "text",
        sourceRef: targetUrl,
        position: index,
        context: `${item.time}\n${item.home} vs ${item.away}\n${
          item.odds ? item.odds.join(" ") : ""
        }`,
      })),
      oddsFilteredDetails: [],
      dedupedOdds: [],
      keywordResponses: [],
      oddsCandidateResponses: [],
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  inspectUrl,
};
