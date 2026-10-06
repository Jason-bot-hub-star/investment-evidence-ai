"use strict";
const D = ResearchData,
  E = ResearchEngine,
  $ = (id) => document.getElementById(id);
const SIM_THESIS = "示例制造 A 的盈利改善主要来自经营改善。";
const ALT_THESIS =
  "以 GAAP 稀释 EPS 衡量，苹果 2024 财年第四季度盈利是否同比改善？";
const state = {
  view: "workbench",
  caseId: "apple",
  basis: "both",
  runMode: "local",
  sourcePolicy: "snapshot",
  fault: "none",
  sim: { ...D.presets.windfall.values },
  plan: null,
  result: null,
  record: null,
  chat: [],
  filter: "all",
  busy: false,
  controller: null,
  tasks: [],
  selected: new Set(),
  revision: 0,
};
let toastTimer,
  lastFocus = null;
const stanceMeta = {
  support: { label: "支持", icon: "+" },
  oppose: { label: "反对", icon: "−" },
  unknown: { label: "无法验证", icon: "?" },
  context: { label: "口径补充", icon: "·" },
};
function el(tag, content, cls) {
  const n = document.createElement(tag);
  if (content !== undefined && content !== null)
    n.textContent = String(content);
  if (cls) n.className = cls;
  return n;
}
function button(label, cls, fn) {
  const b = el("button", label, cls);
  b.type = "button";
  if (fn) b.addEventListener("click", fn);
  return b;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3300);
}
function openDialog(id) {
  lastFocus = document.activeElement;
  const d = $(id);
  if (!d.open) d.showModal();
}
function closeDialog(id) {
  $(id).close();
  lastFocus?.focus?.();
}
for (const b of document.querySelectorAll("[data-close]"))
  b.onclick = () => closeDialog(b.dataset.close);
for (const d of document.querySelectorAll("dialog"))
  d.addEventListener("click", (event) => {
    if (event.target === d) {
      const r = d.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        d.close();
    }
  });
function hideError() {
  $("errorBox").classList.add("hidden");
}
function showError(message) {
  $("errorText").textContent = message;
  $("errorBox").classList.remove("hidden");
  $("errorBox").scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const node = $("step" + i);
    node.classList.toggle("active", i === n);
    node.classList.toggle("done", i < n);
  }
}
function navigate(view) {
  if (state.busy) return;
  state.view = view;
  for (const [key, id] of [
    ["workbench", "workspaceView"],
    ["lab", "labView"],
    ["tasks", "tasksView"],
  ])
    $(id).classList.toggle("hidden", key !== view);
  for (const n of document.querySelectorAll("[data-view]")) {
    n.classList.toggle("active", n.dataset.view === view);
    n.setAttribute("aria-current", n.dataset.view === view ? "page" : "false");
  }
  $("viewTitle").textContent = {
    workbench: "验证工作台",
    lab: "情景实验",
    tasks: "研究任务",
  }[view];
  $("sidebar").classList.remove("open");
  if (view === "lab") renderLab();
  if (view === "tasks") renderTasks();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
for (const n of document.querySelectorAll("[data-view]"))
  n.onclick = () => navigate(n.dataset.view);
$("menuBtn").onclick = () => {
  $("sidebar").classList.toggle("open");
  $("menuBtn").setAttribute(
    "aria-expanded",
    $("sidebar").classList.contains("open"),
  );
};
$("guideBtn").onclick = () => openDialog("guideDialog");
$("settingsBtn").onclick = () => openDialog("settingsDialog");
$("bannerSettings").onclick = () => openDialog("settingsDialog");
$("dismissError").onclick = hideError;
function modeUI() {
  const synthetic = state.caseId === "sim",
    live = state.runMode === "live";
  $("modeBanner").classList.toggle("synthetic", synthetic);
  const p = $("modeBanner").querySelector("p");
  p.replaceChildren(
    el(
      "strong",
      synthetic ? "虚构情景" : live ? "真实 AI 模式" : "历史材料案例",
    ),
    document.createTextNode(
      synthetic
        ? " · 全部数值是假设；本地规则可重算，不是模型或数据接口返回。"
        : live
          ? " · " +
            (state.sourcePolicy === "snapshot"
              ? "使用已核验官方摘录；不会现场抓取数据。"
              : "会在线复核官方网页；失败则停止，不回退为演示。")
          : " · 使用苹果官方财报摘录与本地规则；不是实时 AI 分析。",
    ),
  );
  $("bannerSettings").textContent = live ? "查看接入设置 →" : "接入真实 AI →";
  $("connection").classList.toggle("live", live);
  $("connection").replaceChildren(
    el("i"),
    document.createTextNode(
      (live ? "真实 AI · 待请求验证" : "本地案例 · 无模型调用") +
        (state.fault !== "none" ? " · 异常演练" : ""),
    ),
  );
  $("basis").disabled = synthetic;
  $("basisHelp").textContent = synthetic
    ? "情景使用简化净利润口径；经营贡献超过增量的 50% 才算“主要”。"
    : "不同口径可能给出相反方向，先不要混用。";
  $("inputHint").textContent = live
    ? "限定苹果两期材料，支持自由修订；不覆盖任意股票。"
    : "本地规则支持预设命题与口径修订；自由命题需接入真实 AI。";
}
function sourcesUI() {
  const ids = state.caseId === "sim" ? ["SIM"] : ["S24", "S23"];
  $("sourceCount").textContent =
    state.caseId === "sim" ? "全部为假设" : "2 份原始材料";
  $("sourceList").replaceChildren(
    ...ids.map((id) => {
      const s = D.sources[id],
        b = button("", "source-row", () => showSource(id));
      b.append(el("span", id === "SIM" ? "◇" : "▤", "doc-icon"));
      const t = el("div");
      t.append(el("strong", s.short), el("small", s.date));
      b.append(t, el("span", "↗", "arrow"));
      return b;
    }),
  );
  $("sourceFoot").textContent =
    state.caseId === "sim"
      ? "没有真实公告或出处链接，不冒充接口数据。"
      : "同一发行人的两期公告，不等于两个独立信息源。";
}
function invalidate(message) {
  state.plan = null;
  state.result = null;
  state.record = null;
  state.chat = [];
  state.revision++;
  $("planPanel").classList.add("hidden");
  $("resultSection").classList.add("hidden");
  $("loadingPanel").classList.add("hidden");
  $("welcome").classList.remove("hidden");
  hideError();
  setStep(1);
  if (message) toast(message);
}
function selectCase(id) {
  if (state.busy) return;
  state.caseId = id;
  if (id === "sim" && state.runMode === "live") {
    state.runMode = "local";
    $("runMode").value = "local";
    toast("虚构情景使用本地计算，已退出真实 AI 模式。");
  }
  $("thesis").value = id === "apple" ? D.apple.thesis : SIM_THESIS;
  $("companyName").textContent =
    id === "apple" ? "苹果 AAPL" : "示例制造 A · 虚构";
  $("periodLabel").textContent =
    id === "apple" ? D.apple.period : "假设比较期 / 基期 · 单位百万元";
  $("caseTag").textContent = id === "apple" ? "HISTORICAL" : "SYNTHETIC";
  $("appleCase").classList.toggle("selected", id === "apple");
  $("simCase").classList.toggle("selected", id === "sim");
  $("exampleButtons").classList.toggle("hidden", id === "sim");
  $("welcome").querySelector("h2").textContent =
    id === "apple"
      ? "“盈利增长”，可能有两种答案。"
      : "利润增长，不一定主要来自经营。";
  $("welcome").querySelector("p").textContent =
    id === "apple"
      ? "GAAP 每股收益下降，调整后每股收益却增长。先把口径拆开，才能知道证据究竟支持什么。"
      : "通过虚构情景拆分经营、其他收益与税费贡献。去情景实验改一个参数，观察结论何时翻转。";
  $("welcome")
    .querySelector(".preview-facts")
    .classList.toggle("hidden", id === "sim");
  $("welcome").querySelector(".welcome-caption").textContent =
    id === "apple"
      ? "苹果 FY2024 Q4 历史材料；第一项为程序计算，第二项为公司披露。"
      : "全部为假设数据，不代表任何真实公司。";
  sourcesUI();
  modeUI();
  invalidate();
}
$("appleCase").onclick = () => selectCase("apple");
$("simCase").onclick = () => selectCase("sim");
for (const b of document.querySelectorAll("[data-template]"))
  b.onclick = () => {
    if (b.dataset.template === "gaap") {
      $("thesis").value = ALT_THESIS;
      $("basis").value = "gaap";
      state.basis = "gaap";
    } else {
      $("thesis").value = D.apple.thesis;
      $("basis").value = "both";
      state.basis = "both";
    }
    invalidate();
  };
$("thesis").oninput = () => invalidate();
$("basis").onchange = () => {
  state.basis = $("basis").value;
  invalidate();
};
$("applySettings").onclick = () => {
  const next = $("runMode").value;
  if (next === "live" && state.caseId === "sim") {
    selectCase("apple");
    toast("真实 AI 目前只支持苹果历史材料，已切换案例。");
  }
  state.runMode = next;
  state.sourcePolicy = $("sourcePolicy").value;
  state.fault = $("faultMode").value;
  modeUI();
  invalidate();
  closeDialog("settingsDialog");
  toast(
    next === "live"
      ? "已选择真实 AI，首次请求后才知道能否成功。"
      : "已切回本地案例，无模型费用。",
  );
};
function setBusy(value) {
  state.busy = value;
  for (const n of document.querySelectorAll("button,input,select,textarea")) {
    if (n.id === "cancelBtn") continue;
    if (value) {
      n.dataset.wasDisabled = n.disabled ? "1" : "0";
      n.disabled = true;
    } else {
      n.disabled = n.dataset.wasDisabled === "1";
      delete n.dataset.wasDisabled;
    }
  }
  if (!value) modeUI();
}
async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (state.controller?.signal.aborted)
    throw new DOMException("操作已取消", "AbortError");
}
function loading(show, title, steps = []) {
  $("loadingPanel").classList.toggle("hidden", !show);
  if (!show) return;
  $("loadingTitle").textContent = title;
  $("loadingSubtitle").textContent =
    state.runMode === "live"
      ? "等待服务端真实响应；引用不通过就停止。"
      : "本地规则演示 · 以下为界面进度，不代表联网或模型调用。";
  $("loadingSteps").replaceChildren(
    ...steps.map((t) => el("div", t, "loading-step")),
  );
}
async function animateSteps() {
  const rows = [...$("loadingSteps").children];
  for (const row of rows) {
    await wait(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160,
    );
    row.classList.add("complete");
  }
}
function fault() {
  if (state.fault === "none") return;
  throw new Error(
    {
      source:
        "[模拟异常演练] 原始材料访问超时。本次不生成结论；关闭异常演练后可重试。",
      auth: "[模拟异常演练] 模型鉴权失败。没有发出真实模型请求；可用于演示错误处理。",
      quote:
        "[模拟异常演练] 引文校验失败，结果被拦截。未使用无来源的文字补成证据。",
    }[state.fault],
  );
}
async function execute(fn) {
  if (state.busy) return;
  hideError();
  state.controller = new AbortController();
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    if (e.name === "AbortError") toast("已取消本次操作，没有保存未完成结果。");
    else showError(e.message || "请求失败，请检查网络后重试。");
  } finally {
    loading(false);
    setBusy(false);
    state.controller = null;
  }
}
$("cancelBtn").onclick = () => state.controller?.abort();
async function request(stage, extra = {}) {
  const timer = setTimeout(() => state.controller?.abort(), 65000);
  try {
    const r = await fetch("/api/research", {
      method: "POST",
      signal: state.controller?.signal,
      headers: {
        "Content-Type": "application/json",
        "X-App-Access": $("accessCode").value,
      },
      body: JSON.stringify({
        stage,
        caseId: "apple",
        thesis: $("thesis").value,
        basis: state.basis,
        sourcePolicy: state.sourcePolicy,
        revisedThesis: $("revisedThesis").value,
        questions: readQuestions(),
        ...extra,
      }),
    });
    let out;
    try {
      out = await r.json();
    } catch {
      throw new Error(
        "当前网址没有可用的 AI 后端。请部署完整代码并配置环境变量；预览站只支持本地案例与情景模拟。",
      );
    }
    if (!r.ok) throw new Error(out.error || "接口请求失败");
    if (state.controller?.signal.aborted)
      throw new DOMException("cancel", "AbortError");
    return out;
  } finally {
    clearTimeout(timer);
  }
}
function readQuestions() {
  return [...$("questionList").querySelectorAll("textarea")].map((t) => ({
    id: t.dataset.questionId,
    title: t.value,
  }));
}
function renderPlan(plan) {
  $("planPanel").classList.remove("collapsed");
  if ($("togglePlan")) $("togglePlan").classList.add("hidden");
  $("planPanel").querySelector("h2").textContent =
    "02  先确认，我们在验证同一件事";
  $("clarificationText").textContent = plan.clarification;
  $("revisedThesis").value = plan.revisedThesis;
  $("revisedThesis").readOnly = state.runMode === "local";
  $("revisedThesis").previousElementSibling.querySelector("span").textContent =
    state.runMode === "live" ? "可修改" : "本地规则按所选口径生成";
  $("questionList").replaceChildren(
    ...plan.questions.map((q, i) => {
      const row = el("div", null, "question-item");
      row.append(el("span", String(i + 1).padStart(2, "0"), "question-no"));
      const content = el("div", null, "question-content"),
        input = el("textarea", null, "question-edit");
      input.value = q.title;
      input.dataset.questionId = q.id || "q" + (i + 1);
      input.maxLength = 350;
      input.rows = 2;
      input.readOnly = state.runMode === "local";
      input.setAttribute("aria-label", "验证子问题 " + (i + 1));
      input.oninput = () => {
        state.result = null;
        state.record = null;
        $("resultSection").classList.add("hidden");
      };
      content.append(input);
      if (q.detail) content.append(el("p", q.detail));
      row.append(content);
      return row;
    }),
  );
  $("questionHint").textContent =
    state.runMode === "live"
      ? "可修改问题；修改后重新验证。"
      : "可回左侧切换盈利口径，生成不同的验证结论。";
  $("welcome").classList.add("hidden");
  $("planPanel").classList.remove("hidden");
  $("planPanel").classList.add("fade-in");
  setStep(2);
}
$("revisedThesis").oninput = () => {
  state.result = null;
  state.record = null;
  $("resultSection").classList.add("hidden");
};
async function startPlan() {
  await execute(async () => {
    const thesis = $("thesis").value.trim();
    if (!thesis) throw new Error("先写下一个想验证的投资判断。");
    if (state.runMode === "local") {
      const allowed =
        state.caseId === "apple" ? [D.apple.thesis, ALT_THESIS] : [SIM_THESIS];
      if (!allowed.includes(thesis))
        throw new Error(
          "本地规则不理解任意新命题。请点预设命题恢复，或接入真实 AI；不会把同一份报告伪装成新答案。",
        );
    }
    loading(
      true,
      state.runMode === "live" ? "正在请求 AI 拆解" : "正在整理验证问题",
      [
        "核对研究主体与比较期间",
        "区分盈利口径与归因问题",
        "生成待确认的验证清单",
      ],
    );
    await animateSteps();
    fault();
    if (state.runMode === "live") state.plan = await request("plan");
    else
      state.plan = {
        clarification:
          state.caseId === "apple"
            ? "“盈利”可能指 GAAP EPS，也可能指调整后 EPS。先选定口径；即使指标改善，也需要证据才能把原因归到经营。"
            : "所有输入均为虚构。本模型将“主要”定义为：净利润增长、经营利润增量为正，并占净利润增量的 50% 以上。",
        revisedThesis:
          state.caseId === "apple"
            ? D.apple.revised[state.basis]
            : "在指定的虚构输入下，检验净利润是否增长，以及经营利润增量占净利润增量是否超过 50%。",
        questions:
          state.caseId === "apple"
            ? D.apple.questions
            : [
                {
                  id: "q1",
                  title: "净利润是否比基期增长？",
                  detail: "先验证命题前提。",
                },
                {
                  id: "q2",
                  title: "经营增量是否超过净利润增量的一半？",
                  detail: "依据简化模型，不是市场通用标准。",
                },
                {
                  id: "q3",
                  title: "其他收益与税费贡献了多少？",
                  detail: "带符号拆分，保留抵消关系。",
                },
                {
                  id: "q4",
                  title: "现金流与真实材料是否齐备？",
                  detail: "留空的现金流不能自动编造。",
                },
              ],
      };
    renderPlan(state.plan);
  });
}
$("planBtn").onclick = startPlan;
$("quickStart").onclick = startPlan;
function snapshotRecord(result) {
  return {
    id: globalThis.crypto?.randomUUID?.() || "r" + Date.now(),
    createdAt: new Date().toISOString(),
    caseId: state.caseId,
    basis: state.basis,
    runMode: state.runMode,
    sourcePolicy: state.sourcePolicy,
    thesis: $("thesis").value,
    revisedThesis: $("revisedThesis").value,
    questions: readQuestions(),
    plan: structuredClone(state.plan),
    result: structuredClone(result),
    sim: state.caseId === "sim" ? { ...state.sim } : null,
    chat: [],
    status: "待补证据",
    version: "2.0.0",
  };
}
$("analyzeBtn").onclick = () =>
  execute(async () => {
    if (!state.plan) throw new Error("请先拆解命题。");
    if (
      !$("revisedThesis").value.trim() ||
      readQuestions().some((q) => !q.title.trim())
    )
      throw new Error("澄清后的命题和每个子问题都需要保留内容。");
    state.result = null;
    state.record = null;
    $("resultSection").classList.add("hidden");
    loading(
      true,
      state.runMode === "live" ? "正在验证材料与结论" : "正在计算并组织证据",
      [
        "读取选定材料或假设参数",
        "分别检查支持、反对和未知",
        "对齐冲突口径与结论边界",
      ],
    );
    await animateSteps();
    fault();
    state.result =
      state.runMode === "live"
        ? await request("analyze")
        : state.caseId === "apple"
          ? E.historical(state.basis)
          : E.simulate(state.sim);
    state.chat = [];
    state.filter = "all";
    state.record = snapshotRecord(state.result);
    renderResult();
    setStep(3);
    $("resultSection").scrollIntoView({ block: "start", behavior: "smooth" });
  });
function renderVerdict(r) {
  const card = $("verdictCard");
  card.className =
    "verdict-card " + (r.kind === "synthetic" ? "synthetic " : "") + "fade-in";
  const top = el("div", null, "verdict-top");
  top.append(
    el("span", r.verdict, "verdict-badge"),
    el("span", r.modeLabel, "mode-label"),
  );
  card.replaceChildren(top, el("h2", r.title), el("p", r.summary));
  $("metricGrid").replaceChildren(
    ...r.metrics.map((m) => {
      const n = el("div", null, "metric " + m.tone);
      n.append(
        el("span", m.label, "metric-label"),
        el("strong", m.value, m.value.length > 7 ? "long" : ""),
        el("small", m.detail),
      );
      return n;
    }),
  );
}
function renderEvidence() {
  const r = state.result;
  if (!r) return;
  const categories = ["all", "support", "oppose", "unknown", "context"];
  $("evidenceTabs").replaceChildren(
    ...categories.map((key) => {
      const count =
        key === "all"
          ? r.evidence.length
          : r.evidence.filter((e) => e.stance === key).length;
      const b = button(
        key === "all" ? "全部证据" : stanceMeta[key].label,
        key === state.filter ? "selected" : "",
        () => {
          state.filter = key;
          renderEvidence();
        },
      );
      b.append(el("span", count));
      b.setAttribute("aria-pressed", key === state.filter ? "true" : "false");
      return b;
    }),
  );
  $("evidenceCount").textContent = r.evidence.length;
  const rows = r.evidence.filter(
    (e) => state.filter === "all" || e.stance === state.filter,
  );
  $("evidenceList").replaceChildren(
    ...rows.map((e) => {
      const card = el("article", null, "evidence-card fade-in"),
        head = el("div", null, "evidence-heading");
      head.append(
        el("span", stanceMeta[e.stance].icon, "stance-icon " + e.stance),
      );
      const content = el("div", null, "evidence-content"),
        title = el("div", null, "evidence-title-row");
      title.append(el("h3", e.title), el("span", e.id));
      content.append(
        el("span", stanceMeta[e.stance].label, "stance-label " + e.stance),
        title,
        el("p", e.body),
      );
      if (e.quote) content.append(el("div", "“" + e.quote + "”", "quote-box"));
      const bottom = el("div", null, "evidence-bottom");
      for (const id of e.sourceIds || [])
        if (D.sources[id])
          bottom.append(
            button(
              id + " · " + (id === "SIM" ? "假设输入" : "原始材料") + " ↗",
              "source-link",
              () => showSource(id, e.quote),
            ),
          );
      if (!(e.sourceIds || []).length)
        bottom.append(el("span", "暂无足够原始材料", "muted"));
      content.append(bottom);
      const limit = el("span", null, "limit-text");
      limit.append(el("b", "边界："), document.createTextNode(e.limit || ""));
      content.append(limit);
      head.append(content);
      card.append(head);
      return card;
    }),
  );
  if (!rows.length)
    $("evidenceList").append(
      el("p", "当前筛选下没有证据。不为凑齐分类而生成内容。", "field-help"),
    );
  $("coverageText").textContent =
    r.sourceStatus + " 证据数量只用于分类，不以多数票决定结论。";
}
function renderComparison() {
  const p = $("comparisonPanel");
  p.replaceChildren(
    el("div", "PERIOD COMPARISON", "section-kicker"),
    el("h2", "两期数据，不混口径"),
    el(
      "p",
      state.result.kind === "synthetic"
        ? "基期 vs 比较期 · 全部为假设"
        : "基期 FY2023 Q4 → 本期 FY2024 Q4",
      "comparison-period",
    ),
  );
  for (const row of state.result.comparison || []) {
    const wrap = el("div", null, "bar-row");
    wrap.append(el("h3", row.label + " · " + row.unit));
    const max = Math.max(Math.abs(row.before), Math.abs(row.after), 1);
    for (const [key, label] of [
      ["before", "基期"],
      ["after", "本期"],
    ]) {
      const barRow = el(
          "div",
          null,
          "bar-track " + (key === "after" ? "current" : ""),
        ),
        track = el("div", null, "track"),
        bar = el("div", null, "bar");
      bar.style.width =
        Math.max(0, Math.min(100, (Math.abs(row[key]) / max) * 100)) + "%";
      track.append(bar);
      barRow.append(
        el("span", label, "bar-label"),
        track,
        el("span", row[key], "bar-value"),
      );
      wrap.append(barRow);
    }
    p.append(wrap);
  }
  p.append(el("p", state.result.formula, "formula"));
}
function renderResult() {
  const r = state.result;
  const pp = $("planPanel");
  pp.classList.add("collapsed");
  pp.querySelector("h2").textContent =
    "研究问题已确认 · " + readQuestions().length + " 个子问题";
  let toggle = $("togglePlan");
  if (!toggle) {
    toggle = button("查看已确认问题", "button small ghost", () => {
      pp.classList.toggle("collapsed");
      toggle.textContent = pp.classList.contains("collapsed")
        ? "查看已确认问题"
        : "收起问题";
      toggle.setAttribute(
        "aria-expanded",
        String(!pp.classList.contains("collapsed")),
      );
    });
    toggle.id = "togglePlan";
    pp.querySelector(".panel-heading").append(toggle);
  }
  toggle.classList.remove("hidden");
  toggle.textContent = "查看已确认问题";
  toggle.setAttribute("aria-expanded", "false");
  renderVerdict(r);
  renderEvidence();
  renderComparison();
  $("resultStamp").textContent =
    (r.kind === "synthetic" ? "虚构情景" : "苹果历史案例") +
    " · " +
    new Date(state.record.createdAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }) +
    " · 已冻结本次输入";
  const c = $("conflictPanel");
  c.replaceChildren(
    el("div", "CONFLICT RESOLUTION", "section-kicker"),
    el("h2", r.conflict.title),
    el("div", r.conflict.left, "conflict-pill"),
    el("div", r.conflict.right, "conflict-pill"),
    el("p", r.conflict.resolution, "conflict-resolution"),
  );
  const changes = $("changesPanel");
  changes.replaceChildren(
    el("div", "WHAT WOULD CHANGE OUR MIND", "section-kicker"),
    el("h2", "哪些新信息，会改变当前结论？"),
  );
  const grid = el("div", null, "changes-grid");
  r.changes.forEach((item, i) => {
    const card = el("div", null, "change-item");
    card.append(
      el("span", "0" + (i + 1), "change-no"),
      el("h3", item.title),
      el("p", item.detail),
      el("span", item.effect, "change-effect"),
    );
    grid.append(card);
  });
  changes.append(grid);
  $("answerMode").textContent =
    state.runMode === "live"
      ? "真实 AI · 引文结构校验"
      : "本地规则问答 · 非 AI";
  const suggestions =
    r.kind === "synthetic"
      ? [
          "什么条件会让结论翻转？",
          "贡献率是怎样计算的？",
          "现金流缺失有什么影响？",
        ]
      : [
          "为什么两种口径会矛盾？",
          "收入增长能证明主营改善吗？",
          "还需要补充哪些材料？",
        ];
  $("suggestedQuestions").replaceChildren(
    ...suggestions.map((q) =>
      button(q, "", () => {
        $("followupInput").value = q;
        askQuestion();
      }),
    ),
  );
  renderChat();
  $("welcome").classList.add("hidden");
  $("resultSection").classList.remove("hidden");
}
function showSource(id, quote) {
  const s = D.sources[id];
  if (!s) return;
  $("sourceTitle").textContent = s.short;
  const body = $("sourceDetail");
  body.replaceChildren();
  const meta = el("div", null, "source-meta");
  [s.publisher, s.date, s.period, s.location].forEach((v) =>
    meta.append(el("span", v)),
  );
  body.append(meta);
  if (id === "SIM") {
    const recordInputs =
      state.result?.kind === "synthetic" ? state.result.inputs : state.sim;
    body.append(
      el(
        "p",
        "全部是假设数据；不提供伪造的公告链接。当前材料属于 " +
          (state.result?.kind === "synthetic"
            ? "已验证的结果快照。"
            : "实验参数。"),
        "source-note",
      ),
    );
    for (const [key, name] of Object.entries({
      revenue: "营业收入",
      cost: "营业成本",
      expense: "期间费用",
      other: "其他收益",
      tax: "税费",
      cash: "经营现金流",
    })) {
      body.append(
        el(
          "div",
          name +
            "：基期 " +
            D.baseline[key] +
            " / 比较期 " +
            (recordInputs[key] ?? "缺失"),
          "source-excerpt",
        ),
      );
    }
  } else {
    s.quotes.forEach((q) =>
      body.append(
        el("div", q, "source-excerpt " + (quote === q ? "highlight" : "")),
      ),
    );
    body.append(
      el(
        "p",
        "原文摘录，不是整份报告；高亮对应当前证据的逐字引用。",
        "source-note",
      ),
    );
    const links = el("div", null, "source-actions");
    for (const [url, label] of [
      [s.url, "打开官方原文 ↗"],
      [s.pdf, "查看原始财务报表 PDF ↗"],
    ]) {
      const a = el("a", label, "button");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.append(a);
    }
    body.append(links);
  }
  body.append(el("p", s.note, "source-note"));
  openDialog("sourceDialog");
}
function renderChat() {
  $("chatHistory").replaceChildren(
    ...state.chat.map((m) => {
      const bubble = el("div", m.text, "chat-bubble " + m.role);
      if (m.role === "assistant") bubble.append(el("small", m.mode));
      return bubble;
    }),
  );
}
async function askQuestion() {
  if (!state.result) return;
  const q = $("followupInput").value.trim();
  if (!q) {
    toast("先输入一个追问。");
    return;
  }
  await execute(async () => {
    fault();
    let answer;
    if (state.runMode === "live") {
      const out = await request("ask", { question: q });
      answer = out.answer;
      if (out.citations?.length)
        answer +=
          "\n" +
          out.citations
            .map((c) => "[" + c.sourceId + "] “" + c.quote + "”")
            .join("\n");
    } else {
      await wait(120);
      answer = E.answerLocal(q, state.result);
    }
    state.chat.push(
      { role: "user", text: q },
      {
        role: "assistant",
        text: answer,
        mode:
          state.runMode === "live"
            ? "真实模型回复 · 请人工复核推论"
            : "本地规则回答 · 没有调用模型",
      },
    );
    state.chat = state.chat.slice(-12);
    state.record.chat = structuredClone(state.chat);
    renderChat();
    $("followupInput").value = "";
    setStep(4);
    $("chatHistory").lastElementChild?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  });
}
$("askBtn").onclick = askQuestion;
$("followupInput").onkeydown = (e) => {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    askQuestion();
  }
};
$("revisionBtn").onclick = () => {
  $("thesis").focus();
  $("thesis").scrollIntoView({ block: "center", behavior: "smooth" });
  toast("修改命题或口径后，旧结果会失效；已保存的任务不受影响。");
};
function loadTasks() {
  try {
    const value = JSON.parse(localStorage.getItem("evidenceTasksV2") || "[]");
    state.tasks = Array.isArray(value)
      ? value
          .filter((v) => v && typeof v.id === "string" && v.result && v.plan)
          .slice(0, 20)
      : [];
  } catch {
    state.tasks = [];
  }
  updateCount();
}
function persistTasks() {
  try {
    localStorage.setItem("evidenceTasksV2", JSON.stringify(state.tasks));
    updateCount();
    return true;
  } catch {
    toast("本机存储不可用，请用导出保存研究记录。");
    return false;
  }
}
function updateCount() {
  $("taskCount").textContent = state.tasks.length;
}
function saveTask() {
  if (!state.record || !state.result) return;
  const existing = state.tasks.findIndex((t) => t.id === state.record.id);
  const rec = structuredClone({ ...state.record, chat: state.chat });
  if (existing >= 0) {
    rec.status = state.tasks[existing].status;
    state.tasks[existing] = rec;
  } else state.tasks.unshift(rec);
  state.tasks = state.tasks.slice(0, 20);
  if (persistTasks()) {
    toast(
      existing >= 0
        ? "已更新这次研究的追问记录。"
        : "已保存到本机研究任务，可比较或重新打开。",
    );
    setStep(4);
  }
}
$("saveTopBtn").onclick = saveTask;
$("saveBtn").onclick = saveTask;
function downloadJSON(data, name) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    ),
    a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("exportBtn").onclick = () => {
  if (state.record)
    downloadJSON(
      {
        ...state.record,
        chat: state.chat,
        sources:
          state.caseId === "apple"
            ? [D.sources.S24, D.sources.S23]
            : [D.sources.SIM],
      },
      "evidence-research-" + state.record.createdAt.slice(0, 10) + ".json",
    );
};
function restoreTask(task) {
  state.caseId = task.caseId;
  state.runMode = task.runMode;
  state.basis = task.basis;
  state.sourcePolicy = task.sourcePolicy;
  state.fault = "none";
  $("faultMode").value = "none";
  $("runMode").value = task.runMode;
  $("sourcePolicy").value = task.sourcePolicy;
  selectCase(task.caseId);
  $("thesis").value = task.thesis;
  $("basis").value = task.basis;
  if (task.sim) state.sim = { ...task.sim };
  state.plan = structuredClone(task.plan);
  renderPlan(state.plan);
  $("revisedThesis").value = task.revisedThesis;
  const fields = $("questionList").querySelectorAll("textarea");
  task.questions.forEach((q, i) => {
    if (fields[i]) fields[i].value = q.title;
  });
  state.result = structuredClone(task.result);
  state.record = structuredClone(task);
  state.chat = structuredClone(task.chat || []);
  state.filter = "all";
  modeUI();
  renderResult();
  setStep(4);
  navigate("workbench");
  toast("已恢复保存时的输入与结果；这是历史记录，没有重新调用接口。");
}
function renderTasks() {
  updateCount();
  const box = $("taskList");
  box.replaceChildren();
  if (!state.tasks.length) {
    const empty = el("div", null, "task-empty");
    empty.append(
      el("h2", "把第一条研究留下来"),
      el("p", "完成验证后点击“保存为研究任务”，就能在这里继续。"),
    );
    box.append(empty);
    return;
  }
  for (const t of state.tasks) {
    const card = el("article", null, "task-card"),
      check = el("input");
    check.type = "checkbox";
    check.checked = state.selected.has(t.id);
    check.setAttribute("aria-label", "选择比较：" + t.thesis);
    check.onchange = () => {
      if (check.checked) {
        if (state.selected.size >= 2) {
          check.checked = false;
          toast("一次比较两个版本，请先取消一个。");
          return;
        }
        state.selected.add(t.id);
      } else state.selected.delete(t.id);
    };
    const body = el("div", null, "task-body");
    body.append(el("h3", t.thesis, "task-title"));
    const meta = el("div", null, "task-meta");
    [
      new Date(t.createdAt).toLocaleString("zh-CN"),
      t.result.modeLabel,
      t.id.slice(0, 8),
    ].forEach((v) => meta.append(el("span", v)));
    body.append(meta);
    const controls = el("div", null, "task-controls"),
      select = el("select");
    select.setAttribute("aria-label", "研究状态");
    for (const label of ["待补证据", "继续观察", "已复核"]) {
      const option = el("option", label);
      option.value = label;
      select.append(option);
    }
    select.value = t.status;
    select.onchange = () => {
      t.status = select.value;
      persistTasks();
    };
    controls.append(
      select,
      button("重新打开", "button small", () => restoreTask(t)),
      button("导出", "button small ghost", () =>
        downloadJSON(t, "research-" + t.id.slice(0, 8) + ".json"),
      ),
      button("删除", "button small ghost", () => {
        if (!confirm("删除当前浏览器中的这条研究记录？已导出的文件不受影响。"))
          return;
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        state.selected.delete(t.id);
        persistTasks();
        renderTasks();
      }),
    );
    body.append(
      controls,
      el("p", "待补充：" + (t.result.missing || []).join("、"), "task-missing"),
    );
    card.append(check, body, el("span", t.result.verdict, "task-verdict"));
    box.append(card);
  }
}
$("compareBtn").onclick = () => {
  const selected = state.tasks.filter((t) => state.selected.has(t.id));
  if (selected.length !== 2) {
    toast("先勾选两条研究记录，再比较。");
    return;
  }
  const wrap = el("div", null, "compare-table-wrap"),
    table = el("table", null, "compare-table"),
    head = el("tr");
  ["比较项", "版本 A", "版本 B"].forEach((s) => head.append(el("th", s)));
  table.append(head);
  const rows = [
    ["来源模式", (t) => t.result.modeLabel],
    ["原始命题", (t) => t.thesis],
    ["澄清后的问题", (t) => t.revisedThesis],
    [
      "盈利口径",
      (t) =>
        ({ both: "比较两种口径", gaap: "GAAP EPS", adjusted: "调整后 EPS" })[
          t.basis
        ] || t.basis,
    ],
    ["结论", (t) => t.result.verdict + "：" + t.result.title],
    [
      "关键指标",
      (t) => t.result.metrics.map((m) => m.label + " " + m.value).join("；"),
    ],
    [
      "假设输入",
      (t) =>
        t.sim
          ? Object.entries(t.sim)
              .map(([k, v]) => k + "=" + v)
              .join(", ")
          : "真实历史材料，未使用模拟输入",
    ],
    ["待补证据", (t) => (t.result.missing || []).join("；")],
  ];
  for (const [label, fn] of rows) {
    const tr = el("tr");
    tr.append(el("td", label), ...selected.map((t) => el("td", fn(t))));
    table.append(tr);
  }
  wrap.append(table);
  $("compareContent").replaceChildren(
    el(
      "p",
      "比较冻结的研究版本，不代表已重新拉取数据。不同来源模式不可当成同口径投资结论。",
      "field-help",
    ),
    wrap,
  );
  openDialog("compareDialog");
};
const simFields = {
  revenue: "营业收入",
  cost: "营业成本",
  expense: "期间费用",
  other: "其他收益",
  tax: "税费",
  cash: "经营现金流",
};
function setupSimInputs() {
  $("simInputs").replaceChildren(
    ...Object.entries(simFields).map(([key, label]) => {
      const row = el("div", null, "sim-row"),
        input = el("input");
      input.type = "number";
      input.step = ".5";
      input.id = "sim-" + key;
      input.min = key === "cash" ? "-10000" : "0";
      input.max = "10000";
      input.placeholder = key === "cash" ? "留空=未知" : "";
      input.setAttribute("aria-label", "比较期" + label);
      input.value = state.sim[key] ?? "";
      input.oninput = () => {
        const v = input.value === "" ? null : Number(input.value);
        state.sim[key] = v;
        try {
          E.validateInputs(state.sim);
          input.setCustomValidity("");
          renderLabResults();
          if (state.caseId === "sim" && state.result)
            invalidate("情景已修改，工作台旧结果失效；保存的历史版本仍保留。");
        } catch (e) {
          input.setCustomValidity(e.message);
          $("labSummary").replaceChildren(
            el("h2", "参数不完整或不合法"),
            el("p", e.message, "field-help"),
          );
          $("contributionPanel").replaceChildren();
          $("thresholdText").textContent =
            "修正参数后再计算，旧结论不继续显示。";
        }
        if (key === "other") {
          $("otherSlider").value = v ?? 0;
          $("otherValue").textContent = v ?? "—";
        }
        for (const p of $("presetButtons").children)
          p.classList.remove("active");
      };
      row.append(
        el("span", label),
        el("span", D.baseline[key], "base-value"),
        input,
      );
      return row;
    }),
  );
}
function renderLab() {
  setupSimInputs();
  $("presetButtons").replaceChildren(
    ...Object.entries(D.presets).map(([id, preset]) =>
      button(preset.label, "", () => {
        state.sim = { ...preset.values };
        setupSimInputs();
        renderLabResults();
        for (const b of $("presetButtons").children)
          b.classList.toggle("active", b.textContent === preset.label);
        if (state.caseId === "sim" && state.result) invalidate();
      }),
    ),
  );
  renderLabResults();
}
function renderLabResults() {
  const r = E.simulate(state.sim),
    c = r.calculation;
  const summary = $("labSummary");
  summary.replaceChildren(
    el("div", "DETERMINISTIC · NOT AI", "section-kicker"),
    el("span", r.verdict, "verdict-badge"),
    el("h2", r.title, "lab-result-title"),
  );
  const values = el("div", null, "lab-values");
  for (const [v, label] of [
    [E.round(c.np1), "比较期净利润 · 百万元"],
    [c.share === null ? "不适用" : E.round(c.share) + "%", "经营增量贡献率"],
  ]) {
    const n = el("div");
    n.append(el("strong", v), el("span", label));
    values.append(n);
  }
  summary.append(values, el("p", r.summary, "field-help"));
  const bridge = $("contributionPanel");
  bridge.replaceChildren(
    el("div", "PROFIT BRIDGE · 假设数据", "section-kicker"),
    el("h2", "净利润变化，从哪里来？"),
  );
  const max = Math.max(...r.contributions.map((x) => Math.abs(x.value)), 1);
  for (const item of r.contributions) {
    const row = el("div", null, "contribution-row"),
      track = el("div", null, "contribution-track"),
      fill = el(
        "div",
        null,
        "contribution-fill " + (item.value < 0 ? "negative" : ""),
      );
    fill.style.width = (Math.abs(item.value) / max) * 100 + "%";
    track.append(fill);
    row.append(
      el("span", item.label),
      track,
      el("strong", (item.value > 0 ? "+" : "") + E.round(item.value)),
    );
    bridge.append(row);
  }
  bridge.append(el("p", r.formula, "formula"));
  $("thresholdText").textContent = r.changes[0].detail;
  $("otherValue").textContent = state.sim.other;
  $("otherSlider").value = state.sim.other;
}
$("otherSlider").oninput = () => {
  state.sim.other = Number($("otherSlider").value);
  $("sim-other").value = state.sim.other;
  try {
    renderLabResults();
    if (state.caseId === "sim" && state.result) invalidate();
  } catch (e) {
    toast(e.message);
  }
};
$("useScenario").onclick = () => {
  try {
    E.validateInputs(state.sim);
    selectCase("sim");
    navigate("workbench");
    startPlan();
  } catch (e) {
    toast(e.message);
  }
};
$("testConnectionBtn").onclick = async () => {
  $("connectionResult").textContent = "正在检查部署配置，不会发起付费模型调用…";
  $("testConnectionBtn").disabled = true;
  try {
    const r = await fetch("/api/health", {
      headers: { "X-App-Access": $("accessCode").value },
      signal: AbortSignal.timeout(10000),
    });
    let out;
    try {
      out = await r.json();
    } catch {
      throw new Error("该网址没有部署检测接口；预览站不提供服务端模型调用。");
    }
    if (!r.ok) throw new Error(out.error || "配置检测失败");
    $("connectionResult").textContent =
      out.message + " 配置齐备不等于实际模型请求已成功。";
  } catch (e) {
    $("connectionResult").textContent = e.message;
  } finally {
    $("testConnectionBtn").disabled = false;
  }
};
document.addEventListener("keydown", (event) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key === "Enter" &&
    !state.busy &&
    !document.querySelector("dialog[open]") &&
    state.view === "workbench"
  ) {
    event.preventDefault();
    startPlan();
  }
  if (event.key === "Escape") $("sidebar").classList.remove("open");
});
loadTasks();
sourcesUI();
modeUI();
setStep(1);
