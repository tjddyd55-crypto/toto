const PARSER_REGISTRY = {
  default_text_vs_v1: {
    key: "default_text_vs_v1",
    name: "기본 V1 텍스트 파서",
    mode: "text",
    version: "1",
    description: "본문 텍스트에서 A vs B 형태와 주변 배당 숫자를 찾아 경기 데이터를 추출하는 기본 방식입니다.",
  },
};

function normalizeParserKey(parserKey) {
  const key = String(parserKey || "").trim();
  return key || "default_text_vs_v1";
}

function getParserMeta(parserKey) {
  const key = normalizeParserKey(parserKey);
  return PARSER_REGISTRY[key] || PARSER_REGISTRY.default_text_vs_v1;
}

function listParsers() {
  return Object.values(PARSER_REGISTRY);
}

module.exports = {
  getParserMeta,
  listParsers,
  normalizeParserKey,
};
