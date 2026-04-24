const menuCrawl = document.getElementById("menuCrawl");
const menuInspector = document.getElementById("menuInspector");
const menuApiFinder = document.getElementById("menuApiFinder");
const menuSavedSites = document.getElementById("menuSavedSites");
const crawlView = document.getElementById("crawlView");
const inspectorView = document.getElementById("inspectorView");
const apiFinderView = document.getElementById("apiFinderView");
const savedSitesView = document.getElementById("savedSitesView");
const urlInput = document.getElementById("urlInput");
const siteNameInput = document.getElementById("siteNameInput");
const runBtn = document.getElementById("runBtn");
const saveSiteBtn = document.getElementById("saveSiteBtn");
const runStatus = document.getElementById("runStatus");
const resultBox = document.getElementById("resultBox");
const versionTop = document.getElementById("versionTop");
const saveLogToggle = document.getElementById("saveLogToggle");
const jsonOnlyToggle = document.getElementById("jsonOnlyToggle");
const decimalOnlyToggle = document.getElementById("decimalOnlyToggle");
const includeIntegerToggle = document.getElementById("includeIntegerToggle");
const removeSameToggle = document.getElementById("removeSameToggle");
const useRangeToggle = document.getElementById("useRangeToggle");
const minFilter = document.getElementById("minFilter");
const maxFilter = document.getElementById("maxFilter");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const runTeamMatchBtn = document.getElementById("runTeamMatchBtn");
const runCompareBtn = document.getElementById("runCompareBtn");
const minSitesToggle = document.getElementById("minSitesToggle");
const bigDiffToggle = document.getElementById("bigDiffToggle");
const diffThresholdInput = document.getElementById("diffThresholdInput");
const pageInfoBox = document.getElementById("pageInfoBox");
const numberCandidatesBox = document.getElementById("numberCandidatesBox");
const oddsCandidatesBox = document.getElementById("oddsCandidatesBox");
const oddsFilteredBox = document.getElementById("oddsFilteredBox");
const dedupedValuesBox = document.getElementById("dedupedValuesBox");
const trustedOddsBox = document.getElementById("trustedOddsBox");
const suspiciousResponsesBox = document.getElementById("suspiciousResponsesBox");
const teamMatchBox = document.getElementById("teamMatchBox");
const matchCompareBox = document.getElementById("matchCompareBox");
const finalMatchDataBox = document.getElementById("finalMatchDataBox");
const savedSitesList = document.getElementById("savedSitesList");
const apiFinderUrlInput = document.getElementById("apiFinderUrlInput");
const apiFinderKeywordInput = document.getElementById("apiFinderKeywordInput");
const apiFinderRunBtn = document.getElementById("apiFinderRunBtn");
const apiFinderLogBox = document.getElementById("apiFinderLogBox");
const detailModal = document.getElementById("detailModal");
const detailText = document.getElementById("detailText");
const closeModalBtn = document.getElementById("closeModalBtn");

let currentMode = "crawl";
let latestInspectorResult = null;
const SITE_CONFIGS_KEY = "siteConfigs";
const inspectorState = {
  rawValues: [],
  filteredValues: [],
  dedupedValues: [],
  trustedOdds: [],
  matchedResults: [],
  comparedMatches: [],
  finalMatches: [],
  currentSite: "",
  currentSiteConfigId: null,
  siteConfigs: [],
  siteRecords: new Map(),
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function switchMode(mode) {
  currentMode = mode;
  const isInspector = mode === "inspector";
  const isApiFinder = mode === "api-finder";
  const isSavedSites = mode === "saved-sites";
  crawlView.style.display = mode === "crawl" ? "block" : "none";
  inspectorView.style.display = isInspector ? "block" : "none";
  apiFinderView.style.display = isApiFinder ? "block" : "none";
  savedSitesView.style.display = isSavedSites ? "block" : "none";
  menuCrawl.classList.toggle("active", mode === "crawl");
  menuInspector.classList.toggle("active", isInspector);
  menuApiFinder.classList.toggle("active", isApiFinder);
  menuSavedSites.classList.toggle("active", isSavedSites);
}

function openModal(content) {
  detailText.textContent = content || "";
  detailModal.style.display = "flex";
}

function closeModal() {
  detailModal.style.display = "none";
}

function createItem(text) {
  const item = document.createElement("div");
  item.className = "item";
  item.textContent = text;
  return item;
}

function setRunStatus(type, text) {
  if (!runStatus) {
    return;
  }
  runStatus.classList.remove("running", "done", "error");
  if (type) {
    runStatus.classList.add(type);
  }
  runStatus.textContent = text;
}

function loadSiteConfigs() {
  try {
    const raw = localStorage.getItem(SITE_CONFIGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function persistSiteConfigs(configs) {
  inspectorState.siteConfigs = Array.isArray(configs) ? configs : [];
  localStorage.setItem(SITE_CONFIGS_KEY, JSON.stringify(inspectorState.siteConfigs));
}

function saveOrUpdateSiteConfig(config) {
  const current = loadSiteConfigs();
  const index = current.findIndex((item) => item.id === config.id);
  if (index >= 0) {
    current[index] = config;
  } else {
    current.push(config);
  }
  persistSiteConfigs(current);
}

function deleteSiteConfig(id) {
  const current = loadSiteConfigs().filter((item) => item.id !== id);
  persistSiteConfigs(current);
}

function getFilterOptions() {
  return {
    decimalOnly: decimalOnlyToggle.checked,
    includeInteger: includeIntegerToggle.checked,
    removeSame: removeSameToggle.checked,
    useRange: useRangeToggle.checked,
    min: toNumber(minFilter.value, 1.2),
    max: toNumber(maxFilter.value, 10),
  };
}

function isValidOdds(arr, options) {
  if (!Array.isArray(arr) || arr.length !== 3) {
    return false;
  }

  for (const value of arr) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return false;
    }
    if (options.useRange && (value < options.min || value > options.max)) {
      return false;
    }
  }

  if (options.decimalOnly && !options.includeInteger) {
    const allDecimal = arr.every((value) => value % 1 !== 0);
    if (!allDecimal) {
      return false;
    }
  }

  if (options.removeSame && arr[0] === arr[1] && arr[1] === arr[2]) {
    return false;
  }

  return true;
}

function extractSiteName(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname || "unknown-site";
  } catch (_) {
    return "unknown-site";
  }
}

function normalizeTeamName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(fc|club)\b/g, "")
    .replace(/[^a-z0-9가-힣]/g, "")
    .trim();
}

function normalizeDate(rawDate) {
  const text = String(rawDate || "").trim();
  if (!text) {
    return "";
  }

  const ymd = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (ymd) {
    const y = ymd[1];
    const m = String(ymd[2]).padStart(2, "0");
    const d = String(ymd[3]).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const md = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (md) {
    const nowYear = new Date().getFullYear();
    const m = String(md[1]).padStart(2, "0");
    const d = String(md[2]).padStart(2, "0");
    return `${nowYear}-${m}-${d}`;
  }

  return "";
}

function normalizeTime(rawTime) {
  const text = String(rawTime || "").trim();
  const m = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) {
    return "";
  }
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}

function extractDateTimeFromText(text) {
  const raw = String(text || "");
  const dateMatch =
    raw.match(/\b\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\b/) ||
    raw.match(/\b\d{1,2}[.\-/]\d{1,2}\b/);
  const timeMatch = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  return {
    date: normalizeDate(dateMatch ? dateMatch[0] : ""),
    time: normalizeTime(timeMatch ? timeMatch[0] : ""),
  };
}

function generateMatchKey(match) {
  return [
    match.date || "",
    match.time || "",
    normalizeTeamName(match.home),
    normalizeTeamName(match.away),
  ].join("|");
}

function buildContextForItem(item, htmlText) {
  if (!item) {
    return "";
  }

  if (item.sourceType === "html" && typeof item.position === "number" && htmlText) {
    const start = Math.max(0, item.position - 200);
    const end = Math.min(htmlText.length, item.position + 200);
    return String(htmlText).slice(start, end);
  }

  return String(item.context || "");
}

function dedupeFilteredValues(values) {
  const bySourceAndOdds = new Map();
  for (const item of values) {
    const oddsKey = item.odds.map((value) => Number(value).toFixed(3)).join("|");
    const key = `${item.sourceRef || ""}::${oddsKey}`;
    if (!bySourceAndOdds.has(key)) {
      bySourceAndOdds.set(key, item);
    }
  }

  const byOdds = new Map();
  for (const item of bySourceAndOdds.values()) {
    const oddsKey = item.odds.map((value) => Number(value).toFixed(3)).join("|");
    if (!byOdds.has(oddsKey)) {
      byOdds.set(oddsKey, item);
    }
  }
  return Array.from(byOdds.values());
}

function countTeamLikeTokens(context) {
  const tokens = String(context || "").match(/[A-Za-z가-힣]{2,}/g) || [];
  const candidates = tokens.filter((token) => {
    if (/^(vs|draw|home|away|odds|w1|w2)$/i.test(token)) {
      return false;
    }
    return true;
  });
  return new Set(candidates.map((token) => token.toLowerCase())).size;
}

function scoreTrustedOdds(item, frequencyMap) {
  const odds = item.odds;
  if (!Array.isArray(odds) || odds.length !== 3) {
    return null;
  }
  if (!odds.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }
  if (odds.some((value) => value < 1.2 || value > 15)) {
    return null;
  }
  if (odds[0] === odds[1] && odds[1] === odds[2]) {
    return null;
  }

  let score = 0;
  const context = String(item.context || "");
  const contextLower = context.toLowerCase();

  if (contextLower.includes("vs")) {
    score += 2;
  }
  if (/(w1|w2|무|draw)/i.test(context)) {
    score += 2;
  }
  if (countTeamLikeTokens(context) >= 2) {
    score += 3;
  }

  const uniqueCount = new Set(odds.map((value) => value.toFixed(3))).size;
  if (uniqueCount <= 2) {
    score -= 2;
  }

  const oddsKey = odds.map((value) => value.toFixed(3)).join("|");
  const freq = frequencyMap.get(oddsKey) || 1;
  if (freq >= 4) {
    score -= 3;
  } else if (freq >= 2) {
    score -= 1;
  }

  if (!context || !/[A-Za-z가-힣]/.test(context)) {
    score -= 2;
  }

  return score;
}

function parseOddsFromLine(line) {
  const numberMatches = String(line).match(/\d+(?:\.\d+)?/g) || [];
  const numbers = numberMatches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (numbers.length < 3) {
    return null;
  }

  return [numbers[0], numbers[1], numbers[2]];
}

function isLikelyTeamText(text) {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }
  if (/\d/.test(value)) {
    return false;
  }
  if (value.length < 2) {
    return false;
  }
  return /[A-Za-z가-힣]/.test(value);
}

function parseTeamsFromLine(line) {
  const text = String(line || "").trim();
  const sepMatched = text.match(/^(.+?)\s*(?:vs|v)\s*(.+)$/i);
  if (sepMatched) {
    return {
      home: sepMatched[1].trim(),
      away: sepMatched[2].trim(),
    };
  }

  const dashedMatched = text.match(/^(.+?)\s*[-:\/]\s*(.+)$/);
  if (dashedMatched && isLikelyTeamText(dashedMatched[1]) && isLikelyTeamText(dashedMatched[2])) {
    return {
      home: dashedMatched[1].trim(),
      away: dashedMatched[2].trim(),
    };
  }

  return null;
}

function runTeamMatchFromText(bodyText) {
  const lines = String(bodyText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parseTime = (line) => {
    const matched = String(line || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    return matched ? `${String(matched[1]).padStart(2, "0")}:${matched[2]}` : "";
  };

  const parseDate = (line) => {
    const value = String(line || "");
    const matched =
      value.match(/\b\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\b/) ||
      value.match(/\b\d{1,2}[.\-/]\d{1,2}\b/);
    return matched ? normalizeDate(matched[0]) : "";
  };

  const results = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    const next = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";

    const odds =
      parseOddsFromLine(current) ||
      parseOddsFromLine(next) ||
      parseOddsFromLine(next2);

    if (!odds) {
      continue;
    }

    const teamCandidates = [
      parseTeamsFromLine(current),
      parseTeamsFromLine(next),
      parseTeamsFromLine(next2),
      parseTeamsFromLine(lines[i - 1] || ""),
    ].filter(Boolean);

    let teams = teamCandidates[0] || null;

    if (!teams) {
      const around = [lines[i - 2] || "", lines[i - 1] || "", current, next, next2].filter(Boolean);
      const teamLike = around.filter((line) => isLikelyTeamText(line));
      if (teamLike.length >= 2) {
        teams = {
          home: teamLike[0],
          away: teamLike[1],
        };
      }
    }

    if (!teams || !teams.home || !teams.away) {
      continue;
    }

    const aroundText = [lines[i - 1] || "", current, next, next2].join(" ");
    const time = parseTime(current) || parseTime(lines[i - 1] || "") || parseTime(next) || parseTime(next2);
    const date = parseDate(current) || parseDate(lines[i - 1] || "") || parseDate(next) || parseDate(next2);
    const hasVs = /(vs| v )/i.test(aroundText);
    const hasTime = Boolean(time);
    const hasTeamPair = Boolean(teams.home && teams.away);

    if (!(hasVs || hasTime || hasTeamPair)) {
      continue;
    }

    const key = `${date}|${time}|${normalizeTeamName(teams.home)}|${normalizeTeamName(teams.away)}|${
      odds ? odds.join("|") : ""
    }`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    results.push({
      date,
      time,
      home: teams.home,
      away: teams.away,
      odds,
    });
  }

  return results;
}

function toCommonMatchRecord(match, pageInfo, siteName) {
  const date = normalizeDate(match.date || pageInfo?.date || "");
  const time = normalizeTime(match.time || pageInfo?.time || "");

  return {
    site: siteName,
    date,
    time,
    home: String(match.home || "").trim(),
    away: String(match.away || "").trim(),
    odds: Array.isArray(match.odds) ? match.odds : [],
    context: "",
    lineIndex: null,
  };
}

function buildComparedMatches(records, options) {
  const groups = new Map();

  for (const record of records) {
    if (!record || !Array.isArray(record.odds) || record.odds.length !== 3) {
      continue;
    }
    if (!record.home || !record.away) {
      continue;
    }

    const key = generateMatchKey(record);
    if (!groups.has(key)) {
      groups.set(key, {
        matchKey: key,
        date: record.date || "",
        time: record.time || "",
        home: record.home,
        away: record.away,
        sites: [],
      });
    }

    groups.get(key).sites.push({
      site: record.site,
      odds: record.odds,
      context: record.context,
      lineIndex: record.lineIndex,
    });
  }

  const output = [];
  for (const group of groups.values()) {
    if (options.minSitesOnly && group.sites.length < 2) {
      continue;
    }

    const homeValues = group.sites.map((item) => Number(item.odds[0])).filter((v) => Number.isFinite(v));
    const drawValues = group.sites.map((item) => Number(item.odds[1])).filter((v) => Number.isFinite(v));
    const awayValues = group.sites.map((item) => Number(item.odds[2])).filter((v) => Number.isFinite(v));
    if (homeValues.length === 0 || drawValues.length === 0 || awayValues.length === 0) {
      continue;
    }

    const maxHome = Math.max(...homeValues);
    const maxDraw = Math.max(...drawValues);
    const maxAway = Math.max(...awayValues);
    const minHome = Math.min(...homeValues);
    const minDraw = Math.min(...drawValues);
    const minAway = Math.min(...awayValues);
    const diffValue = Math.max(maxHome - minHome, maxDraw - minDraw, maxAway - minAway);

    if (options.bigDiffOnly && diffValue < options.diffThreshold) {
      continue;
    }

    const sites = group.sites.map((item) => ({
      ...item,
      isMaxHome: Number(item.odds[0]) === maxHome,
      isMaxDraw: Number(item.odds[1]) === maxDraw,
      isMaxAway: Number(item.odds[2]) === maxAway,
    }));

    output.push({
      ...group,
      diffValue,
      sites,
    });
  }

  return output;
}

function normalizeRawValues(result) {
  if (Array.isArray(result.rawValues) && result.rawValues.length > 0) {
    return result.rawValues.filter(
      (item) => item && Array.isArray(item.odds) && item.odds.length === 3
    );
  }

  return (Array.isArray(result.oddsCandidates) ? result.oddsCandidates : [])
    .filter((odds) => Array.isArray(odds) && odds.length === 3)
    .map((odds, index) => ({
      odds,
      sourceType: "unknown",
      sourceRef: "",
      position: index,
      context: "",
    }));
}

function renderOddsDetails(box, details, title) {
  box.innerHTML = "";

  const summary = createItem(
    JSON.stringify(
      {
        title,
        count: details.length,
      },
      null,
      2
    )
  );
  box.appendChild(summary);

  for (const item of details) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = JSON.stringify(
      {
        odds: item.odds,
        sourceType: item.sourceType || "",
        sourceRef: item.sourceRef || "",
        position: item.position ?? null,
      },
      null,
      2
    );

    row.addEventListener("click", () => {
      openModal(
        JSON.stringify(
          {
            odds: item.odds,
            sourceType: item.sourceType || "",
            sourceRef: item.sourceRef || "",
            position: item.position ?? null,
            context: item.context || "",
          },
          null,
          2
        )
      );
    });

    box.appendChild(row);
  }
}

function renderTrustedOdds(box, details) {
  box.innerHTML = "";
  const summary = createItem(
    JSON.stringify(
      {
        title: "고신뢰 승무패",
        count: details.length,
      },
      null,
      2
    )
  );
  box.appendChild(summary);

  for (const item of details) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = JSON.stringify(
      {
        odds: item.odds,
        score: item.score,
        sourceType: item.sourceType || "",
        position: item.position ?? null,
        context: item.context || "",
      },
      null,
      2
    );
    row.addEventListener("click", () => {
      openModal(JSON.stringify(item, null, 2));
    });
    box.appendChild(row);
  }
}

function renderComparedMatches() {
  matchCompareBox.innerHTML = "";

  const summary = createItem(
    JSON.stringify(
      {
        count: inspectorState.comparedMatches.length,
      },
      null,
      2
    )
  );
  matchCompareBox.appendChild(summary);

  for (const match of inspectorState.comparedMatches) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = JSON.stringify(
      {
        date: match.date,
        time: match.time,
        home: match.home,
        away: match.away,
        diffValue: match.diffValue,
        sites: match.sites.map((site) => ({
          site: site.site,
          odds: site.odds,
          homeMax: site.isMaxHome,
          drawMax: site.isMaxDraw,
          awayMax: site.isMaxAway,
        })),
      },
      null,
      2
    );
    row.addEventListener("click", () => {
      openModal(JSON.stringify(match, null, 2));
    });
    matchCompareBox.appendChild(row);
  }
}

function parseMatchFromContext(context, odds) {
  const lines = String(context || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  const timeMatch = String(context || "").match(/\b\d{1,2}:\d{2}\b/);
  const time = timeMatch ? timeMatch[0] : "";

  const vsLine = lines.find((line) => line.includes("vs"));
  if (!vsLine) {
    return null;
  }

  const split = vsLine.split("vs").map((value) => value.trim());
  if (split.length < 2) {
    return null;
  }

  const home = split[0] || "";
  const away = split[1] || "";

  if (!time || !home || !away || !Array.isArray(odds) || odds.length !== 3) {
    return null;
  }

  return {
    date: null,
    time,
    home,
    away,
    odds,
  };
}

function renderFinalMatchData() {
  finalMatchDataBox.innerHTML = "";

  const summary = createItem(
    JSON.stringify(
      {
        count: inspectorState.finalMatches.length,
      },
      null,
      2
    )
  );
  finalMatchDataBox.appendChild(summary);

  for (const match of inspectorState.finalMatches) {
    const row = document.createElement("div");
    row.className = "item";
    const oddsText = match.odds ? `[${match.odds.join(",")}]` : "[없음]";
    row.textContent = `${match.time} | ${match.home} | ${match.away} | ${oddsText}`;
    row.addEventListener("click", () => {
      openModal(JSON.stringify(match, null, 2));
    });
    finalMatchDataBox.appendChild(row);
  }
}

async function runInspectorAnalysis(targetUrl) {
  const result = await window.api.inspect({
    url: targetUrl,
    saveLog: saveLogToggle.checked,
  });
  latestInspectorResult = result;
  inspectorState.rawValues = normalizeRawValues(result);
  inspectorState.filteredValues = [];
  inspectorState.dedupedValues = [];
  inspectorState.trustedOdds = [];
  inspectorState.finalMatches = [];
  inspectorState.matchedResults = [];
  inspectorState.currentSite = extractSiteName((result.pageInfo || {}).url || "");
  applyFiltersAndRender();
}

function formatApiFinderLog(entry) {
  return [
    `URL: ${entry.url || ""}`,
    `METHOD: ${entry.method || ""}`,
    `STATUS: ${entry.status ?? ""}`,
    "",
    (entry.body || "").slice(0, 1000),
    "",
    "------------------------------------",
  ].join("\n");
}

function renderApiFinderLogs(logs) {
  if (!apiFinderLogBox) {
    return;
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    apiFinderLogBox.value = "탐지 결과 없음";
    return;
  }

  apiFinderLogBox.value = logs.map((entry) => formatApiFinderLog(entry)).join("\n");
}

function renderSavedSitesList() {
  savedSitesList.innerHTML = "";
  const configs = loadSiteConfigs();
  inspectorState.siteConfigs = configs;

  if (configs.length === 0) {
    savedSitesList.appendChild(createItem("저장된 사이트가 없습니다."));
    return;
  }

  for (const config of configs) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = `${config.name} | ${config.url}`;

    const runButton = document.createElement("button");
    runButton.type = "button";
    runButton.textContent = "분석 실행";
    runButton.addEventListener("click", async () => {
      urlInput.value = config.url || "";
      siteNameInput.value = config.name || "";
      inspectorState.currentSiteConfigId = config.id || null;
      switchMode("inspector");
      runBtn.disabled = true;
      setRunStatus("running", "진행중...");
      try {
        await runInspectorAnalysis(config.url || "");
        setRunStatus("done", "완료");
      } catch (error) {
        setRunStatus("error", "오류");
        openModal(error?.stack || String(error));
      } finally {
        runBtn.disabled = false;
      }
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => {
      inspectorState.currentSiteConfigId = config.id || null;
      siteNameInput.value = config.name || "";
      urlInput.value = config.url || "";
      switchMode("inspector");
      setRunStatus(null, "대기중");
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => {
      deleteSiteConfig(config.id);
      if (inspectorState.currentSiteConfigId === config.id) {
        inspectorState.currentSiteConfigId = null;
      }
      renderSavedSitesList();
    });

    row.appendChild(runButton);
    row.appendChild(editButton);
    row.appendChild(deleteButton);
    savedSitesList.appendChild(row);
  }
}

function renderTeamMatches() {
  teamMatchBox.innerHTML = "";
  const summary = createItem(
    JSON.stringify(
      {
        count: inspectorState.matchedResults.length,
      },
      null,
      2
    )
  );
  teamMatchBox.appendChild(summary);

  for (const item of inspectorState.matchedResults) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = JSON.stringify(
      {
        time: item.time || "",
        match: `${item.home || ""} vs ${item.away || ""}`,
        odds: item.odds || [],
      },
      null,
      2
    );
    row.addEventListener("click", () => {
      openModal(JSON.stringify(item, null, 2));
    });
    teamMatchBox.appendChild(row);
  }
}

function recalculateComparedMatches() {
  const allRecords = Array.from(inspectorState.siteRecords.values()).flat();
  inspectorState.comparedMatches = buildComparedMatches(allRecords, {
    minSitesOnly: minSitesToggle.checked,
    bigDiffOnly: bigDiffToggle.checked,
    diffThreshold: toNumber(diffThresholdInput.value, 0.5),
  });
}

function applyFiltersAndRender() {
  if (!latestInspectorResult) {
    return;
  }

  const result = latestInspectorResult;
  const options = getFilterOptions();
  const jsonOnly = jsonOnlyToggle.checked;

  const min = toNumber(minFilter.value, 1.2);
  const max = toNumber(maxFilter.value, 10);

  const responses = Array.isArray(result.responses) ? result.responses : [];
  const filteredResponses = jsonOnly ? responses.filter((item) => item.isJson) : responses;
  const pageInfo = result.pageInfo || {};

  const filteredNumbers = (Array.isArray(result.numberCandidates) ? result.numberCandidates : [])
    .filter((num) => num >= min && num <= max)
    .slice(0, 1000);

  inspectorState.filteredValues = inspectorState.rawValues
    .filter((item) => item && Array.isArray(item.odds))
    .map((item) => ({
      ...item,
      context: buildContextForItem(item, result.html || ""),
    }))
    .filter((item) => isValidOdds(item.odds, options));

  inspectorState.dedupedValues = dedupeFilteredValues(inspectorState.filteredValues);

  const frequencyMap = new Map();
  for (const item of inspectorState.filteredValues) {
    const key = item.odds.map((value) => value.toFixed(3)).join("|");
    frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
  }

  inspectorState.trustedOdds = inspectorState.dedupedValues
    .map((item) => {
      const score = scoreTrustedOdds(item, frequencyMap);
      if (score === null) {
        return null;
      }
      return {
        ...item,
        score,
      };
    })
    .filter((item) => item && item.score >= 2)
    .sort((a, b) => b.score - a.score);

  inspectorState.finalMatches = inspectorState.trustedOdds
    .map((item) => parseMatchFromContext(item.context, item.odds))
    .filter(Boolean);

  if (Array.isArray(result.matches) && result.matches.length > 0) {
    inspectorState.finalMatches = result.matches
      .filter(
        (item) =>
          item &&
          typeof item.time === "string" &&
          item.time &&
          typeof item.home === "string" &&
          item.home &&
          typeof item.away === "string" &&
          item.away
      )
      .map((item) => ({
        date: item.date ?? null,
        time: item.time,
        home: item.home,
        away: item.away,
        odds: Array.isArray(item.odds) && item.odds.length >= 3 ? item.odds.slice(0, 3) : null,
      }));
  }

  const suspicious = filteredResponses.filter((item) => {
    const hasKeyword = /(home|away|team|match|odds)/i.test(item.preview || "");
    const hasOddsGroup = Array.isArray(item.oddsCandidates) && item.oddsCandidates.length > 0;
    return hasKeyword || hasOddsGroup;
  });

  pageInfoBox.textContent = JSON.stringify(
    {
      url: pageInfo.url || "",
      title: pageInfo.title || "",
      responseCount: filteredResponses.length,
      rawValues: inspectorState.rawValues.length,
      filteredValues: inspectorState.filteredValues.length,
      dedupedValues: inspectorState.dedupedValues.length,
      trustedOdds: inspectorState.trustedOdds.length,
      finalMatches: inspectorState.finalMatches.length,
      matchedResults: inspectorState.matchedResults.length,
      comparedMatches: inspectorState.comparedMatches.length,
      logPath: result.logPath || null,
    },
    null,
    2
  );

  numberCandidatesBox.innerHTML = "";
  numberCandidatesBox.appendChild(
    createItem(JSON.stringify({ count: filteredNumbers.length, values: filteredNumbers.slice(0, 300) }, null, 2))
  );

  renderOddsDetails(oddsCandidatesBox, inspectorState.rawValues, "원본 승무패 후보");
  renderOddsDetails(oddsFilteredBox, inspectorState.filteredValues, "필터링 결과");
  renderOddsDetails(dedupedValuesBox, inspectorState.dedupedValues, "중복 제거 결과");
  renderTrustedOdds(trustedOddsBox, inspectorState.trustedOdds);

  suspiciousResponsesBox.innerHTML = "";
  for (const item of suspicious) {
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = JSON.stringify(
      {
        url: item.url,
        status: item.status,
        preview: String(item.preview || "").slice(0, 300),
      },
      null,
      2
    );

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "전체 내용 보기";
    btn.addEventListener("click", () => {
      openModal(item.fullContent || "");
    });

    row.appendChild(btn);
    suspiciousResponsesBox.appendChild(row);
  }

  renderTeamMatches();
  renderComparedMatches();
  renderFinalMatchData();
}

async function renderVersion() {
  try {
    if (!window.api || typeof window.api.getVersion !== "function") {
      versionTop.textContent = "버전: 확인 불가";
      return;
    }
    const version = await window.api.getVersion();
    versionTop.textContent = `버전: ${version}`;
  } catch (_) {
    versionTop.textContent = "버전: 확인 실패";
  }
}

menuCrawl.addEventListener("click", () => switchMode("crawl"));
menuInspector.addEventListener("click", () => switchMode("inspector"));
menuApiFinder.addEventListener("click", () => switchMode("api-finder"));
menuSavedSites.addEventListener("click", () => {
  renderSavedSitesList();
  switchMode("saved-sites");
});
closeModalBtn.addEventListener("click", closeModal);
detailModal.addEventListener("click", (event) => {
  if (event.target === detailModal) {
    closeModal();
  }
});

jsonOnlyToggle.addEventListener("change", () => {
  if (latestInspectorResult) {
    applyFiltersAndRender();
  }
});
minFilter.addEventListener("input", () => {
  if (latestInspectorResult) {
    applyFiltersAndRender();
  }
});
maxFilter.addEventListener("input", () => {
  if (latestInspectorResult) {
    applyFiltersAndRender();
  }
});
decimalOnlyToggle.addEventListener("change", applyFiltersAndRender);
includeIntegerToggle.addEventListener("change", applyFiltersAndRender);
removeSameToggle.addEventListener("change", applyFiltersAndRender);
useRangeToggle.addEventListener("change", applyFiltersAndRender);
applyFilterBtn.addEventListener("click", applyFiltersAndRender);
runTeamMatchBtn.addEventListener("click", () => {
  if (!latestInspectorResult) {
    return;
  }
  if (Array.isArray(latestInspectorResult.matches) && latestInspectorResult.matches.length > 0) {
    inspectorState.matchedResults = latestInspectorResult.matches;
  } else {
    inspectorState.matchedResults = runTeamMatchFromText(latestInspectorResult.bodyText || "");
  }
  const pageInfo = latestInspectorResult.pageInfo || {};
  const siteName = extractSiteName(pageInfo.url || "");
  inspectorState.currentSite = siteName;
  const records = inspectorState.matchedResults.map((match) =>
    toCommonMatchRecord(match, pageInfo, siteName)
  );
  const snapshotKey = `${siteName}::${pageInfo.url || ""}`;
  inspectorState.siteRecords.set(snapshotKey, records);
  recalculateComparedMatches();
  applyFiltersAndRender();
});
runCompareBtn.addEventListener("click", () => {
  recalculateComparedMatches();
  applyFiltersAndRender();
});
minSitesToggle.addEventListener("change", () => {
  recalculateComparedMatches();
  applyFiltersAndRender();
});
bigDiffToggle.addEventListener("change", () => {
  recalculateComparedMatches();
  applyFiltersAndRender();
});
diffThresholdInput.addEventListener("input", () => {
  recalculateComparedMatches();
  applyFiltersAndRender();
});

apiFinderRunBtn.addEventListener("click", async () => {
  const targetUrl = String(apiFinderUrlInput.value || "").trim();
  const keywordFilter = String(apiFinderKeywordInput.value || "").trim();
  if (!targetUrl) {
    return;
  }

  apiFinderRunBtn.disabled = true;
  apiFinderLogBox.value = "탐지중...";

  try {
    const result = await window.api.apiFind({
      url: targetUrl,
      keywordFilter,
    });
    renderApiFinderLogs(result?.logs || []);
  } catch (error) {
    apiFinderLogBox.value = `오류\n${error?.message || String(error)}`;
  } finally {
    apiFinderRunBtn.disabled = false;
  }
});

saveSiteBtn.addEventListener("click", () => {
  const url = String(urlInput.value || "").trim();
  const name = String(siteNameInput.value || "").trim() || extractSiteName(url);
  if (!url) {
    return;
  }

  const id = inspectorState.currentSiteConfigId || `site-${Date.now()}`;
  const config = {
    id,
    name,
    url,
  };
  saveOrUpdateSiteConfig(config);
  inspectorState.currentSiteConfigId = id;
  siteNameInput.value = name;
  setRunStatus("done", "저장 완료");
  renderSavedSitesList();
});

runBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) {
    return;
  }
  runBtn.disabled = true;
  setRunStatus("running", "진행중...");

  try {
    if (currentMode === "crawl") {
      const result = await window.api.crawl(url);
      resultBox.textContent = JSON.stringify(result, null, 2);
      setRunStatus("done", "완료");
      return;
    }

    await runInspectorAnalysis(url);
    if (!siteNameInput.value.trim()) {
      siteNameInput.value = extractSiteName(url);
    }
    setRunStatus("done", "완료");
  } catch (error) {
    setRunStatus("error", "오류");
    openModal(error?.stack || String(error));
  } finally {
    runBtn.disabled = false;
  }
});

renderVersion();
persistSiteConfigs(loadSiteConfigs());
renderSavedSitesList();
switchMode("crawl");
