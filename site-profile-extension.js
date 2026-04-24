(() => {
  const SITE_CONFIGS_KEY = "siteConfigs";
  const DEFAULT_PARSER_KEY = "default_text_vs_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeId(value) {
    return String(value || "site")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "site";
  }

  function stableConfigId(config) {
    return `site_${safeId(config.name || config.url || "site")}`;
  }

  function dedupeKey(config) {
    return `${String(config.url || "").trim().toLowerCase()}::${String(config.name || "").trim().toLowerCase()}`;
  }

  function readConfigs() {
    try {
      const raw = localStorage.getItem(SITE_CONFIGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeConfigs(configs) {
    localStorage.setItem(SITE_CONFIGS_KEY, JSON.stringify(configs, null, 2));
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function getFilterState() {
    return {
      decimalOnly: getEl("decimalOnlyToggle") ? getEl("decimalOnlyToggle").checked : true,
      includeInteger: getEl("includeIntegerToggle") ? getEl("includeIntegerToggle").checked : false,
      removeSame: getEl("removeSameToggle") ? getEl("removeSameToggle").checked : true,
      useRange: getEl("useRangeToggle") ? getEl("useRangeToggle").checked : true,
      min: Number(getEl("minFilter")?.value || 1.2),
      max: Number(getEl("maxFilter")?.value || 10),
    };
  }

  function normalizeSiteConfig(config) {
    const createdAt = config.createdAt || nowIso();
    const id = config.id && !String(config.id).match(/_\d{14}$/)
      ? config.id
      : stableConfigId(config);
    const parserKey = config.collector?.parserKey || config.parserKey || DEFAULT_PARSER_KEY;

    return {
      id,
      name: config.name || "이름 없는 사이트",
      url: config.url || "",
      enabled: config.enabled !== false,
      collector: {
        mode: config.collector?.mode || config.collectorMode || "text",
        parserKey,
        repeatCount: Number(config.collector?.repeatCount || config.repeatCount || 5),
        scrollMode: config.collector?.scrollMode || "wheel_and_wait",
        waitMs: Number(config.collector?.waitMs || config.waitMs || 1000),
      },
      api: {
        enabled: Boolean(config.api?.enabled),
        selectedUrl: config.api?.selectedUrl || "",
        method: config.api?.method || "GET",
        keywordFilter: config.api?.keywordFilter || "",
        sampleBody: config.api?.sampleBody || "",
      },
      filters: {
        decimalOnly: config.filters?.decimalOnly !== false,
        includeInteger: Boolean(config.filters?.includeInteger),
        removeSame: config.filters?.removeSame !== false,
        useRange: config.filters?.useRange !== false,
        min: Number(config.filters?.min || 1.2),
        max: Number(config.filters?.max || 10),
      },
      lastValidation: {
        status: config.lastValidation?.status || "",
        matchCount: Number(config.lastValidation?.matchCount || 0),
        testedAt: config.lastValidation?.testedAt || "",
        message: config.lastValidation?.message || "",
      },
      createdAt,
      updatedAt: config.updatedAt || nowIso(),
    };
  }

  function validationFromResult(result) {
    const count = Number(result?.count ?? (Array.isArray(result?.matches) ? result.matches.length : 0));
    return {
      status: count > 0 ? "ok" : "empty",
      matchCount: count,
      testedAt: nowIso(),
      message: count > 0 ? "정상 추출" : "추출 결과 없음",
    };
  }

  function mergeConfig(existing, incoming) {
    const a = normalizeSiteConfig(existing || {});
    const b = normalizeSiteConfig(incoming || {});
    const aCount = Number(a.lastValidation?.matchCount || 0);
    const bCount = Number(b.lastValidation?.matchCount || 0);
    const betterValidation = bCount >= aCount ? b.lastValidation : a.lastValidation;
    return normalizeSiteConfig({
      ...a,
      ...b,
      id: a.id || b.id,
      collector: { ...a.collector, ...b.collector },
      api: { ...a.api, ...b.api },
      filters: { ...a.filters, ...b.filters },
      lastValidation: betterValidation,
      createdAt: a.createdAt || b.createdAt,
      updatedAt: nowIso(),
    });
  }

  function migrateSiteConfigs() {
    const byKey = new Map();
    for (const raw of readConfigs()) {
      const normalized = normalizeSiteConfig(raw);
      const key = dedupeKey(normalized) || normalized.id;
      if (byKey.has(key)) {
        byKey.set(key, mergeConfig(byKey.get(key), normalized));
      } else {
        byKey.set(key, normalized);
      }
    }
    const migrated = Array.from(byKey.values());
    writeConfigs(migrated);
    return migrated;
  }

  function upsertSiteConfig(config) {
    const normalized = normalizeSiteConfig({ ...config, updatedAt: nowIso() });
    const configs = migrateSiteConfigs();
    const key = dedupeKey(normalized);
    const index = configs.findIndex((item) => item.id === normalized.id || dedupeKey(item) === key);
    if (index >= 0) configs[index] = mergeConfig(configs[index], normalized);
    else configs.push(normalized);
    writeConfigs(configs);
    const saved = index >= 0 ? configs[index] : normalized;
    window.__currentSiteProfileId = saved.id;
    return saved;
  }

  function findCurrentConfig() {
    const currentId = window.__currentSiteProfileId;
    const configs = migrateSiteConfigs();
    if (!currentId) return null;
    return configs.find((item) => item.id === currentId) || null;
  }

  function buildCurrentSiteConfig(existingConfig) {
    const base = existingConfig || findCurrentConfig() || {};
    const name = getEl("siteNameInput")?.value?.trim() || base.name || "이름 없는 사이트";
    const url = getEl("urlInput")?.value?.trim() || base.url || "";
    const parserKey = getEl("parserKeySelect")?.value || base.collector?.parserKey || DEFAULT_PARSER_KEY;
    const repeatCount = Number(getEl("repeatCountInput")?.value || base.collector?.repeatCount || 5);
    const waitMs = Number(getEl("waitMsInput")?.value || base.collector?.waitMs || 1000);
    const lastResult = window.__lastInspectorResult;
    const lastValidation = lastResult && Number(lastResult.count || 0) >= 0
      ? validationFromResult(lastResult)
      : base.lastValidation;

    return normalizeSiteConfig({
      ...base,
      id: base.id || stableConfigId({ name, url }),
      name,
      url,
      collector: {
        ...(base.collector || {}),
        mode: getEl("collectorModeSelect")?.value || base.collector?.mode || "text",
        parserKey,
        repeatCount,
        scrollMode: "wheel_and_wait",
        waitMs,
      },
      api: {
        ...(base.api || {}),
        keywordFilter: getEl("apiFinderKeywordInput")?.value || base.api?.keywordFilter || "",
      },
      filters: getFilterState(),
      lastValidation,
    });
  }

  function applyConfigToInputs(config) {
    const normalized = normalizeSiteConfig(config || {});
    window.__currentSiteProfileId = normalized.id;
    if (getEl("siteNameInput")) getEl("siteNameInput").value = normalized.name || "";
    if (getEl("urlInput")) getEl("urlInput").value = normalized.url || "";
    if (getEl("apiFinderUrlInput")) getEl("apiFinderUrlInput").value = normalized.url || "";
    if (getEl("parserKeySelect")) getEl("parserKeySelect").value = normalized.collector.parserKey || DEFAULT_PARSER_KEY;
    if (getEl("collectorModeSelect")) getEl("collectorModeSelect").value = normalized.collector.mode || "text";
    if (getEl("repeatCountInput")) getEl("repeatCountInput").value = normalized.collector.repeatCount || 5;
    if (getEl("waitMsInput")) getEl("waitMsInput").value = normalized.collector.waitMs || 1000;
    if (getEl("decimalOnlyToggle")) getEl("decimalOnlyToggle").checked = normalized.filters.decimalOnly;
    if (getEl("includeIntegerToggle")) getEl("includeIntegerToggle").checked = normalized.filters.includeInteger;
    if (getEl("removeSameToggle")) getEl("removeSameToggle").checked = normalized.filters.removeSame;
    if (getEl("useRangeToggle")) getEl("useRangeToggle").checked = normalized.filters.useRange;
    if (getEl("minFilter")) getEl("minFilter").value = normalized.filters.min;
    if (getEl("maxFilter")) getEl("maxFilter").value = normalized.filters.max;
  }

  function ensureProfileToolbar() {
    const toolbar = getEl("urlInput")?.closest(".toolbar");
    if (!toolbar || getEl("parserKeySelect")) return;

    const modeSelect = document.createElement("select");
    modeSelect.id = "collectorModeSelect";
    modeSelect.innerHTML = '<option value="text">본문 텍스트 수집</option><option value="api">API 수집 준비</option>';

    const parserSelect = document.createElement("select");
    parserSelect.id = "parserKeySelect";
    parserSelect.innerHTML = '<option value="default_text_vs_v1">기본 V1 텍스트 파서</option>';

    const repeatInput = document.createElement("input");
    repeatInput.id = "repeatCountInput";
    repeatInput.type = "number";
    repeatInput.min = "1";
    repeatInput.value = "5";
    repeatInput.title = "반복 수집 횟수";
    repeatInput.style.width = "72px";

    const waitInput = document.createElement("input");
    waitInput.id = "waitMsInput";
    waitInput.type = "number";
    waitInput.min = "100";
    waitInput.step = "100";
    waitInput.value = "1000";
    waitInput.title = "대기 시간(ms)";
    waitInput.style.width = "86px";

    const profileLabel = document.createElement("span");
    profileLabel.textContent = "수집방식/파서키";
    profileLabel.style.fontSize = "12px";
    profileLabel.style.color = "#555";

    toolbar.insertBefore(profileLabel, getEl("runBtn"));
    toolbar.insertBefore(modeSelect, getEl("runBtn"));
    toolbar.insertBefore(parserSelect, getEl("runBtn"));
    toolbar.insertBefore(repeatInput, getEl("runBtn"));
    toolbar.insertBefore(waitInput, getEl("runBtn"));
  }

  async function loadParserOptions() {
    try {
      const parsers = await window.api.getParsers();
      const select = getEl("parserKeySelect");
      if (!select || !Array.isArray(parsers)) return;
      const currentValue = select.value || DEFAULT_PARSER_KEY;
      select.innerHTML = "";
      for (const parser of parsers) {
        const option = document.createElement("option");
        option.value = parser.key;
        option.textContent = `${parser.name} (${parser.key})`;
        select.appendChild(option);
      }
      select.value = currentValue;
    } catch (_) {}
  }

  function setBox(id, value) {
    const box = getEl(id);
    if (!box) return;
    box.innerHTML = "";
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    box.appendChild(item);
  }

  function renderListBox(id, items, mapper) {
    const box = getEl(id);
    if (!box) return;
    box.innerHTML = "";
    const list = Array.isArray(items) ? items : [];
    const summary = document.createElement("div");
    summary.className = "item";
    summary.textContent = `count: ${list.length}`;
    box.appendChild(summary);
    list.slice(0, 300).forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "item";
      row.textContent = mapper ? mapper(item, index) : JSON.stringify(item, null, 2);
      box.appendChild(row);
    });
  }

  function renderInspectorResult(result) {
    if (!result || !result.success) return;
    window.__lastInspectorResult = result;
    setBox("pageInfoBox", {
      url: result.pageInfo?.url || "",
      title: result.pageInfo?.title || "",
      siteName: result.siteName || result.pageInfo?.siteName || "",
      parserKey: result.parserKey || result.pageInfo?.parserKey || "",
      count: result.count || 0,
    });
    renderListBox("numberCandidatesBox", result.rawValues || result.numberCandidates || []);
    renderListBox("oddsCandidatesBox", result.oddsCandidates || []);
    renderListBox("oddsFilteredBox", result.oddsFiltered || []);
    renderListBox("dedupedValuesBox", result.dedupedOdds || result.rawValues || []);
    renderListBox("trustedOddsBox", result.rawValues || [], (item) => JSON.stringify({ odds: item.odds, context: item.context }, null, 2));
    renderListBox("suspiciousResponsesBox", result.oddsCandidateResponses || []);
    renderListBox("teamMatchBox", result.matches || [], (match) => `${match.time || ""} | ${match.home || ""} vs ${match.away || ""} | ${Array.isArray(match.odds) ? match.odds.join(" / ") : ""}`);
    renderListBox("matchCompareBox", []);
    renderListBox("finalMatchDataBox", result.matches || [], (match) => `${match.site || ""} | ${match.time || ""} | ${match.home || ""} vs ${match.away || ""} | ${Array.isArray(match.odds) ? match.odds.join(" / ") : ""}`);
  }

  function renderProfilesList() {
    const box = getEl("savedSitesList");
    if (!box) return;
    const configs = migrateSiteConfigs();
    box.innerHTML = "";
    if (configs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "저장된 사이트가 없습니다.";
      box.appendChild(empty);
      return;
    }

    configs.forEach((config) => {
      const item = document.createElement("div");
      item.className = "item";
      const status = config.lastValidation.status || "미검증";
      const count = config.lastValidation.matchCount || 0;
      item.innerHTML = `<strong>${config.name}</strong><br>${config.url}<br>방식: ${config.collector.mode} / 파서키: ${config.collector.parserKey}<br>마지막 상태: ${status} / 추출 ${count}건`;

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.textContent = "불러오기";
      loadBtn.addEventListener("click", () => {
        applyConfigToInputs(config);
        const menuInspector = getEl("menuInspector");
        if (menuInspector) menuInspector.click();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "삭제";
      deleteBtn.addEventListener("click", () => {
        const key = dedupeKey(config);
        writeConfigs(migrateSiteConfigs().filter((item) => item.id !== config.id && dedupeKey(item) !== key));
        if (window.__currentSiteProfileId === config.id) window.__currentSiteProfileId = null;
        renderProfilesList();
      });

      item.appendChild(document.createElement("br"));
      item.appendChild(loadBtn);
      item.appendChild(deleteBtn);
      box.appendChild(item);
    });
  }

  function updateValidationFromResult(config, result) {
    window.__lastInspectorResult = result;
    const updated = normalizeSiteConfig({
      ...config,
      lastValidation: validationFromResult(result),
    });
    const saved = upsertSiteConfig(updated);
    renderProfilesList();
    return saved;
  }

  function patchInspectApi() {
    if (!window.api || !window.api.inspect || window.api.inspect.__siteProfilePatched) return;
    const originalInspect = window.api.inspect.bind(window.api);
    const patchedInspect = async (payload) => {
      const config = buildCurrentSiteConfig();
      const nextPayload = {
        ...(payload || {}),
        siteConfig: (payload && payload.siteConfig) || config,
      };
      const result = await originalInspect(nextPayload);
      renderInspectorResult(result);
      if (nextPayload.url || config.url) {
        updateValidationFromResult(config, result);
      }
      return result;
    };
    patchedInspect.__siteProfilePatched = true;
    window.api.inspect = patchedInspect;
  }

  function wireButtons() {
    const saveBtn = getEl("saveSiteBtn");
    if (saveBtn && !saveBtn.dataset.profileExt) {
      saveBtn.dataset.profileExt = "1";
      saveBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const saved = upsertSiteConfig(buildCurrentSiteConfig());
        applyConfigToInputs(saved);
        renderProfilesList();
      }, true);
    }

    const menuSavedSites = getEl("menuSavedSites");
    if (menuSavedSites && !menuSavedSites.dataset.profileExt) {
      menuSavedSites.dataset.profileExt = "1";
      menuSavedSites.addEventListener("click", () => setTimeout(renderProfilesList, 0));
    }
  }

  function init() {
    ensureProfileToolbar();
    migrateSiteConfigs();
    loadParserOptions().then(() => {
      const current = findCurrentConfig();
      if (current) applyConfigToInputs(current);
    });
    patchInspectApi();
    wireButtons();
    renderProfilesList();
  }

  window.siteProfileExtension = {
    normalizeSiteConfig,
    migrateSiteConfigs,
    buildCurrentSiteConfig,
    applyConfigToInputs,
    renderProfilesList,
    renderInspectorResult,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
