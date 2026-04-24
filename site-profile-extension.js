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
      .replace(/^_+|_+$/g, "") || `site_${Date.now()}`;
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
    const id = config.id || `site_${safeId(config.name || config.url)}_${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
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

  function migrateSiteConfigs() {
    const migrated = readConfigs().map(normalizeSiteConfig);
    writeConfigs(migrated);
    return migrated;
  }

  function upsertSiteConfig(config) {
    const normalized = normalizeSiteConfig({ ...config, updatedAt: nowIso() });
    const configs = migrateSiteConfigs();
    const index = configs.findIndex((item) => item.id === normalized.id);
    if (index >= 0) configs[index] = normalized;
    else configs.push(normalized);
    writeConfigs(configs);
    return normalized;
  }

  function findCurrentConfig() {
    const currentId = window.__currentSiteProfileId;
    if (!currentId) return null;
    return migrateSiteConfigs().find((item) => item.id === currentId) || null;
  }

  function buildCurrentSiteConfig(existingConfig) {
    const base = existingConfig || findCurrentConfig() || {};
    const name = getEl("siteNameInput")?.value?.trim() || base.name || "이름 없는 사이트";
    const url = getEl("urlInput")?.value?.trim() || base.url || "";
    const parserKey = getEl("parserKeySelect")?.value || base.collector?.parserKey || DEFAULT_PARSER_KEY;
    const repeatCount = Number(getEl("repeatCountInput")?.value || base.collector?.repeatCount || 5);
    const waitMs = Number(getEl("waitMsInput")?.value || base.collector?.waitMs || 1000);

    return normalizeSiteConfig({
      ...base,
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
      select.innerHTML = "";
      for (const parser of parsers) {
        const option = document.createElement("option");
        option.value = parser.key;
        option.textContent = `${parser.name} (${parser.key})`;
        select.appendChild(option);
      }
    } catch (_) {}
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
        writeConfigs(migrateSiteConfigs().filter((item) => item.id !== config.id));
        renderProfilesList();
      });

      item.appendChild(document.createElement("br"));
      item.appendChild(loadBtn);
      item.appendChild(deleteBtn);
      box.appendChild(item);
    });
  }

  async function runProfileInspect(config) {
    const result = await window.api.inspect({
      url: config.url,
      saveLog: getEl("saveLogToggle") ? getEl("saveLogToggle").checked : false,
      siteConfig: config,
    });
    const updated = normalizeSiteConfig({
      ...config,
      lastValidation: {
        status: result && result.count > 0 ? "ok" : "empty",
        matchCount: Number(result?.count || 0),
        testedAt: nowIso(),
        message: result && result.count > 0 ? "정상 추출" : "추출 결과 없음",
      },
    });
    upsertSiteConfig(updated);
    return result;
  }

  function wireButtons() {
    const saveBtn = getEl("saveSiteBtn");
    if (saveBtn && !saveBtn.dataset.profileExt) {
      saveBtn.dataset.profileExt = "1";
      saveBtn.addEventListener("click", () => {
        const saved = upsertSiteConfig(buildCurrentSiteConfig());
        applyConfigToInputs(saved);
        renderProfilesList();
      });
    }

    const runBtn = getEl("runBtn");
    if (runBtn && !runBtn.dataset.profileExt) {
      runBtn.dataset.profileExt = "1";
      runBtn.addEventListener("click", async (event) => {
        const mode = getEl("collectorModeSelect")?.value || "text";
        if (mode !== "text") return;
        event.stopImmediatePropagation();
        const config = buildCurrentSiteConfig();
        const status = getEl("runStatus");
        const resultBox = getEl("resultBox");
        try {
          if (status) status.textContent = "프로필 분석중...";
          const result = await runProfileInspect(config);
          if (resultBox) resultBox.textContent = JSON.stringify(result, null, 2);
          if (status) status.textContent = "완료";
          renderProfilesList();
        } catch (error) {
          if (status) status.textContent = "오류";
          if (resultBox) resultBox.textContent = error?.stack || String(error);
        }
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
    wireButtons();
    renderProfilesList();
  }

  window.siteProfileExtension = {
    normalizeSiteConfig,
    migrateSiteConfigs,
    buildCurrentSiteConfig,
    applyConfigToInputs,
    renderProfilesList,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
