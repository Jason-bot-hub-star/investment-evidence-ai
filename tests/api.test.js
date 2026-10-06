"use strict";
const assert = require("node:assert/strict");
const handler = require("../api/research");
const health = require("../api/health");
const D = require("../data");
let count = 0,
  seq = 0;
async function call(
  overrides = {},
  code = "test-code",
  method = "POST",
  fn = handler,
) {
  const req = {
    method,
    headers: { "x-app-access": code, "x-forwarded-for": "test-" + ++seq },
    body: {
      stage: "plan",
      caseId: "apple",
      basis: "both",
      sourcePolicy: "snapshot",
      thesis: D.apple.thesis,
      revisedThesis: "test revised",
      questions: [{ id: "q1", title: "test question" }],
      ...overrides,
    },
  };
  const result = {};
  const res = {
    setHeader() {},
    status(s) {
      result.status = s;
      return this;
    },
    json(d) {
      result.body = d;
      return this;
    },
  };
  await fn(req, res);
  return result;
}
function env() {
  Object.assign(process.env, {
    MODEL_API_KEY: "UNIT_TEST_NOT_REAL_KEY",
    MODEL_BASE_URL: "https://model.example.test/v1",
    MODEL_NAME: "mock-model",
    APP_ACCESS_CODE: "test-code",
  });
}
async function test(name, fn) {
  await fn();
  count++;
  console.log("PASS api:", name);
}
const plan = {
  clarification: "clarify",
  revisedThesis: "revised",
  questions: [{ title: "question", detail: "detail" }],
};
const analysis = {
  verdict: "证据不足",
  title: "有边界的标题",
  summary: "概述",
  evidence: [
    {
      stance: "support",
      title: "收入",
      body: "线索",
      sourceIds: ["S24"],
      quote: D.sources.S24.quotes[0],
      limit: "不是主营证明",
    },
  ],
  conflict: {
    title: "口径",
    left: "GAAP",
    right: "调整后",
    resolution: "不同口径",
  },
  changes: [{ title: "新数据", detail: "补充原始材料", effect: "可能改变" }],
  missing: ["完整报表"],
};
function mockModel(value) {
  global.fetch = async (url) => {
    assert.ok(
      !url.includes("apple.com"),
      "snapshot should not fetch official pages",
    );
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(value) } }],
      }),
    };
  };
}
(async () => {
  await test("缺失配置503", async () => {
    delete process.env.MODEL_API_KEY;
    assert.equal((await call()).status, 503);
  });
  env();
  await test("错误访问码401", async () =>
    assert.equal((await call({}, "wrong")).status, 401));
  await test("非法方法405", async () =>
    assert.equal((await call({}, "test-code", "GET")).status, 405));
  await test("不支持的案例422", async () =>
    assert.equal((await call({ caseId: "sim" })).status, 422));
  await test("非法口径400", async () =>
    assert.equal((await call({ basis: "unknown" })).status, 400));
  await test("超长输入400", async () =>
    assert.equal((await call({ thesis: "x".repeat(1201) })).status, 400));
  await test("空验证问题400", async () =>
    assert.equal(
      (await call({ stage: "analyze", questions: [] })).status,
      400,
    ));
  await test("模型拆解返回合规结构", async () => {
    mockModel(plan);
    const r = await call();
    assert.equal(r.status, 200);
    assert.equal(r.body.questions[0].id, "q1");
  });
  await test("快照分析不访问网络材料", async () => {
    mockModel(analysis);
    const r = await call({ stage: "analyze" });
    assert.equal(r.status, 200);
    assert.match(r.body.modeLabel, /真实 AI/);
    assert.match(r.body.sourceStatus, /没有现场抓取/);
  });
  await test("伪造引文拦截", async () => {
    const bad = structuredClone(analysis);
    bad.evidence[0].quote = "fabricated";
    mockModel(bad);
    const r = await call({ stage: "analyze" });
    assert.equal(r.status, 502);
    assert.match(r.body.error, /引文/);
  });
  await test("错配来源拦截", async () => {
    const bad = structuredClone(analysis);
    bad.evidence[0].sourceIds = ["S23"];
    mockModel(bad);
    assert.equal((await call({ stage: "analyze" })).status, 502);
  });
  await test("unknown不强行制造引文", async () => {
    const value = structuredClone(analysis);
    value.evidence = [
      {
        stance: "unknown",
        title: "缺失",
        body: "无法验证",
        sourceIds: [],
        quote: "",
        limit: "缺完整报表",
      },
    ];
    mockModel(value);
    assert.equal((await call({ stage: "analyze" })).status, 200);
  });
  await test("追问附带引文通过校验", async () => {
    mockModel({
      answer: "回答[S24]",
      citations: [{ sourceId: "S24", quote: D.sources.S24.quotes[1] }],
    });
    assert.equal(
      (await call({ stage: "ask", question: "为什么" })).status,
      200,
    );
  });
  await test("追问伪造引文拦截", async () => {
    mockModel({
      answer: "回答",
      citations: [{ sourceId: "S24", quote: "wrong" }],
    });
    assert.equal(
      (await call({ stage: "ask", question: "为什么" })).status,
      502,
    );
  });
  await test("模型非JSON拦截", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "NOT_JSON" } }] }),
    });
    assert.equal((await call()).status, 502);
  });
  await test("上游鉴权错误可理解", async () => {
    global.fetch = async () => ({ ok: false, status: 401 });
    const r = await call();
    assert.equal(r.status, 502);
    assert.match(r.body.error, /鉴权/);
  });
  await test("上游限流提示", async () => {
    global.fetch = async () => ({ ok: false, status: 429 });
    assert.match((await call()).body.error, /额度|限流/);
  });
  await test("在线抓取失败不回退", async () => {
    global.fetch = async () => ({ ok: false, status: 503 });
    const r = await call({ stage: "analyze", sourcePolicy: "online" });
    assert.equal(r.status, 502);
    assert.match(r.body.error, /原文暂时不可访问/);
  });
  await test("在线原文变更拦截", async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => "<p>changed</p>",
    });
    assert.match(
      (await call({ stage: "analyze", sourcePolicy: "online" })).body.error,
      /既有摘录不一致/,
    );
  });
  await test("在线复核原文并分析", async () => {
    global.fetch = async (url) =>
      url.includes("apple.com")
        ? {
            ok: true,
            text: async () =>
              url.includes("/2024/")
                ? D.sources.S24.quotes.join(" ")
                : D.sources.S23.quotes.join(" "),
          }
        : {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify(analysis) } }],
            }),
          };
    const r = await call({ stage: "analyze", sourcePolicy: "online" });
    assert.equal(r.status, 200);
    assert.match(r.body.sourceStatus, /在线复核/);
  });
  await test("基础地址拒绝重复chat路径", async () => {
    process.env.MODEL_BASE_URL =
      "https://model.example.test/v1/chat/completions";
    assert.equal((await call()).status, 503);
    env();
  });
  await test("健康检查不调用模型且不泄露密钥", async () => {
    global.fetch = async () => {
      throw new Error("must not call");
    };
    const r = await call({}, "test-code", "GET", health);
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r).includes("UNIT_TEST"));
  });
  await test("健康检查要求正确访问码", async () =>
    assert.equal((await call({}, "wrong", "GET", health)).status, 401));
  console.log(count + " API isolated tests passed; no real model calls.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
