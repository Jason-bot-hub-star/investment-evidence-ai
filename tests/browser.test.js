"use strict";
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const E = require("../engine");
const D = require("../data");
const root = path.join(__dirname, "..", "public"),
  qa = path.join(__dirname, "..", "qa");
fs.mkdirSync(qa, { recursive: true });
let browser,
  server,
  count = 0;
const passed = [];
function pass(name) {
  count++;
  passed.push(name);
  console.log("PASS browser:", name);
}
const mockPlan = {
  clarification: "模拟网络返回，仅用于自动化测试",
  revisedThesis: "验证苹果盈利归因",
  questions: [
    { id: "q1", title: "盈利口径是否一致？", detail: "test" },
    { id: "q2", title: "主营归因材料是否充分？", detail: "test" },
  ],
};
(async () => {
  server = http.createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/health") {
        res.end(JSON.stringify({ message: "模拟配置检测成功" }));
        return;
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const b = JSON.parse(raw || "{}");
      if (req.headers["x-app-access"] !== "browser-test-code") {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "应用访问码错误（测试响应）" }));
        return;
      }
      const output =
        b.stage === "plan"
          ? mockPlan
          : b.stage === "ask"
            ? {
                answer: "测试模型回答[S24]",
                citations: [
                  { sourceId: "S24", quote: D.sources.S24.quotes[0] },
                ],
              }
            : {
                ...E.historical(b.basis),
                modeLabel: "真实 AI · 自动化网络桩（不是真调用）",
              };
      await new Promise((r) => setTimeout(r, 250));
      res.end(JSON.stringify(output));
      return;
    }
    const clean = decodeURIComponent(req.url.split("?")[0]),
      file = path.resolve(root, "." + (clean === "/" ? "/index.html" : clean));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "application/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "/usr/local/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = "http://127.0.0.1:" + server.address().port;
  await page.goto(url);
  const settle = () =>
    page.waitForFunction(() => !document.getElementById("planBtn").disabled);
  await page.click("#quickStart");
  await page.waitForSelector("#planPanel:not(.hidden)");
  await settle();
  assert.ok(await page.locator("#revisedThesis").inputValue());
  assert.equal(await page.locator("#questionList textarea").count(), 4);
  pass("历史案例拆解、澄清与四个子问题");
  await page.click("#analyzeBtn");
  await page.waitForSelector("#resultSection:not(.hidden)");
  await settle();
  assert.equal(await page.locator(".evidence-card").count(), 4);
  assert.match(await page.locator("#verdictCard").innerText(), /证据不足/);
  pass("历史材料验证主链路");
  await page
    .locator("#evidenceTabs button")
    .filter({ hasText: "无法验证" })
    .click();
  assert.equal(await page.locator(".evidence-card").count(), 1);
  await page
    .locator("#evidenceTabs button")
    .filter({ hasText: "全部证据" })
    .click();
  pass("证据方向筛选与计数");
  await page.locator("#evidenceList .source-link").first().click();
  await page.waitForSelector("#sourceDialog[open]");
  assert.equal(await page.locator("#sourceDetail .highlight").count(), 1);
  assert.equal(
    await page.locator("#sourceDetail a").first().getAttribute("href"),
    D.sources.S24.url,
  );
  await page.keyboard.press("Escape");
  pass("原文抽屉高亮与官方来源链接");
  await page.click("#saveTopBtn");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("evidenceTasksV2")).length,
    ),
    1,
  );
  pass("研究版本保存");
  await page.locator("#suggestedQuestions button").first().click();
  await settle();
  assert.match(await page.locator("#chatHistory").innerText(), /GAAP|口径/);
  assert.match(await page.locator("#chatHistory").innerText(), /没有调用模型/);
  pass("规则追问与模式披露");
  const dl = page.waitForEvent("download");
  await page.click("#exportBtn");
  const download = await dl;
  assert.match(download.suggestedFilename(), /evidence-research/);
  const fp = await download.path();
  const exported = JSON.parse(fs.readFileSync(fp, "utf8"));
  assert.ok(exported.result.evidence.length);
  assert.ok(!JSON.stringify(exported).includes("accessCode"));
  pass("导出冻结研究记录且不包含访问码");
  await page.screenshot({
    path: path.join(qa, "historical-result.png"),
    fullPage: true,
  });
  await page.selectOption("#basis", "gaap");
  assert.equal(await page.locator("#resultSection").isVisible(), false);
  await page.click("#planBtn");
  await settle();
  await page.click("#analyzeBtn");
  await settle();
  assert.match(await page.locator("#verdictCard").innerText(), /前提不成立/);
  await page.click("#saveTopBtn");
  pass("口径修订使旧结果失效并改变结论");
  await page.locator('[data-view="tasks"]').click();
  await page.locator(".task-card>input").nth(0).check();
  await page.locator(".task-card>input").nth(1).check();
  await page.click("#compareBtn");
  await page.waitForSelector("#compareDialog[open]");
  assert.match(await page.locator("#compareContent").innerText(), /前提不成立/);
  assert.match(await page.locator("#compareContent").innerText(), /证据不足/);
  await page.keyboard.press("Escape");
  pass("两条研究版本比较");
  await page.locator(".task-controls select").first().selectOption("已复核");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("evidenceTasksV2"))[0].status,
    ),
    "已复核",
  );
  await page
    .locator(".task-controls button")
    .filter({ hasText: "重新打开" })
    .first()
    .click();
  assert.equal(await page.locator("#basis").inputValue(), "gaap");
  assert.match(await page.locator("#verdictCard").innerText(), /前提不成立/);
  pass("任务状态持久化与版本恢复");
  await page.locator('[data-view="lab"]').click();
  assert.match(await page.locator("#labSummary").innerText(), /模型内不支持/);
  await page.fill("#sim-other", "6.5");
  assert.match(await page.locator("#labSummary").innerText(), /模型内支持/);
  assert.match(await page.locator("#thresholdText").innerText(), /7/);
  pass("假设修改实时翻转结论与显示阈值");
  await page.screenshot({
    path: path.join(qa, "simulation-lab.png"),
    fullPage: true,
  });
  await page.fill("#sim-revenue", "");
  assert.match(await page.locator("#labSummary").innerText(), /参数不完整/);
  assert.equal(
    (await page.locator("#contributionPanel").innerText()).trim(),
    "",
  );
  await page.fill("#sim-revenue", "120");
  pass("非法假设输入清空旧实验结论");
  await page.click("#useScenario");
  await settle();
  assert.match(await page.locator("#companyName").innerText(), /虚构/);
  await page.click("#analyzeBtn");
  await settle();
  assert.match(await page.locator("#verdictCard").innerText(), /模型内支持/);
  assert.match(await page.locator("#modeBanner").innerText(), /全部数值是假设/);
  pass("情景参数进入工作台并保留模拟标识");
  await page.click("#settingsBtn");
  await page.selectOption("#faultMode", "quote");
  await page.click("#applySettings");
  await page.click("#planBtn");
  await settle();
  assert.match(
    await page.locator("#errorText").innerText(),
    /模拟异常演练.*引文/,
  );
  assert.equal(await page.locator("#resultSection").isVisible(), false);
  pass("异常演练不伪装真实接口且不生成结果");
  await page.click("#settingsBtn");
  await page.selectOption("#faultMode", "none");
  await page.selectOption("#runMode", "live");
  await page.fill("#accessCode", "wrong");
  await page.click("#applySettings");
  await page.click("#planBtn");
  await settle();
  assert.match(await page.locator("#errorText").innerText(), /访问码错误/);
  pass("真实模式收到401时不回退本地分析");
  await page.click("#settingsBtn");
  await page.fill("#accessCode", "browser-test-code");
  await page.click("#applySettings");
  await page.fill("#thesis", "苹果两期盈利变化能否用经营因素解释？");
  await page.click("#planBtn");
  await settle();
  assert.equal(
    await page.locator("#revisedThesis").getAttribute("readonly"),
    null,
  );
  await page.fill("#revisedThesis", "修改后的研究问题");
  await page.locator("#questionList textarea").first().fill("实际验证问题");
  await page.click("#analyzeBtn");
  await settle();
  assert.match(await page.locator("#verdictCard").innerText(), /自动化网络桩/);
  pass("真实模式的自由修订与返回渲染（模拟网络）");
  await page.fill("#followupInput", "还有什么材料？");
  await page.click("#askBtn");
  await settle();
  assert.match(await page.locator("#chatHistory").innerText(), /测试模型回答/);
  pass("真实模式追问和引文渲染（模拟网络）");
  await page.click("#settingsBtn");
  await page.click("#testConnectionBtn");
  await page.waitForFunction(() =>
    document
      .querySelector("#connectionResult")
      .textContent.includes("模拟配置检测成功"),
  );
  await page.keyboard.press("Escape");
  pass("部署检测提示不声称模型已联调");
  await page.click("#settingsBtn");
  await page.selectOption("#runMode", "local");
  await page.click("#applySettings");
  await page.click("#appleCase");
  await page.evaluate(() => {
    document.getElementById("planBtn").click();
    document.getElementById("cancelBtn").click();
  });
  await settle();
  assert.equal(await page.locator("#resultSection").isVisible(), false);
  assert.match(await page.locator("#toast").innerText(), /已取消/);
  pass("取消操作不保存未完成结果");
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "overflow " + width,
    );
  }
  pass("五种视口宽度无横向溢出");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#menuBtn");
  await page.locator('[data-view="lab"]').click();
  assert.equal(await page.locator("#labView").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: path.join(qa, "mobile-lab.png"),
    fullPage: true,
  });
  pass("手机导航与情景实验可操作");
  assert.deepEqual(errors, []);
  pass("全流程无浏览器未捕获异常");
  fs.writeFileSync(
    path.join(qa, "browser-results.json"),
    JSON.stringify(
      { passed: count, tests: passed, realModelCalled: false },
      null,
      2,
    ),
  );
  console.log(count + " browser tests passed; model requests mocked.");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.close();
  });
