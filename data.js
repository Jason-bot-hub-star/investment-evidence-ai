/* Public historical excerpts only. No keys, private data or live market quotes. */
(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.ResearchData = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const sources = {
    S24: {
      id: "S24",
      kind: "historical",
      title: "Apple reports fourth quarter results",
      short: "苹果 FY2024 Q4 业绩公告",
      publisher: "Apple Newsroom",
      date: "2024-10-31",
      period: "截至 2024-09-28 的财季",
      location: "业绩公告首段及非 GAAP 脚注",
      url: "https://www.apple.com/newsroom/2024/10/apple-reports-fourth-quarter-results/",
      pdf: "https://www.apple.com/newsroom/pdfs/fy2024-q4/FY24_Q4_Consolidated_Financial_Statements.pdf",
      quotes: [
        "The Company posted quarterly revenue of $94.9 billion, up 6 percent year over year",
        "quarterly diluted earnings per share of $0.97",
        "up 12 percent year over year when excluding the one-time charge",
        "Diluted earnings per share was $1.64",
      ],
      note: "第四条去除了网页上紧邻数字的脚注标记。1.64 美元为剔除一次性费用后的非 GAAP 每股收益。这里只收入已核对的正文摘录，未解析完整财务报表。",
    },
    S23: {
      id: "S23",
      kind: "historical",
      title: "Apple reports fourth quarter results",
      short: "苹果 FY2023 Q4 业绩公告",
      publisher: "Apple Newsroom",
      date: "2023-11-02",
      period: "截至 2023-09-30 的财季",
      location: "业绩公告首段",
      url: "https://www.apple.com/newsroom/2023/11/apple-reports-fourth-quarter-results/",
      pdf: "https://www.apple.com/newsroom/pdfs/fy2023-q4/FY23_Q4_Consolidated_Financial_Statements.pdf",
      quotes: [
        "The Company posted quarterly revenue of $89.5 billion, down 1 percent year over year",
        "quarterly earnings per diluted share of $1.46, up 13 percent year over year",
      ],
      note: "本段的同比 13% 是 FY2023 Q4 对比 FY2022 Q4，不是 FY2024 的同比增速。",
    },
    SIM: {
      id: "SIM",
      kind: "synthetic",
      title: "示例制造 A · 可编辑假设数据",
      short: "情景输入表（全部虚构）",
      publisher: "用户设定 / 本地计算",
      date: "非真实报告期",
      period: "假设基期与比较期",
      location: "情景实验参数表",
      url: null,
      quotes: [],
      note: "不是上市公司、公告或金融接口返回。所有数值仅用于检验产品交互与简化归因规则，不能用于实际投资。",
    },
  };
  const apple = {
    id: "apple",
    name: "苹果 AAPL",
    period: "FY2024 Q4 / FY2023 Q4",
    thesis: "苹果 2024 财年第四季度盈利改善主要来自经营改善。",
    revised: {
      both: "比较苹果 FY2024 Q4 与 FY2023 Q4 的 GAAP / 调整后稀释 EPS，并验证现有材料能否支持经营主因判断。",
      gaap: "以 GAAP 稀释 EPS 衡量，验证苹果 FY2024 Q4 盈利是否同比改善，以及经营因素能否解释变化。",
      adjusted:
        "以剔除一次性费用后的稀释 EPS 衡量，验证苹果 FY2024 Q4 的改善是否主要来自经营。",
    },
    questions: [
      {
        id: "q1",
        title: "盈利是否真的改善？",
        detail: "分别检查 GAAP 与调整后 EPS，避免混用口径。",
      },
      {
        id: "q2",
        title: "经营改善有哪些证据？",
        detail: "核对收入与盈利方向，但不把收入增长直接等同于利润贡献。",
      },
      {
        id: "q3",
        title: "哪些因素可能解释冲突？",
        detail: "区分一次性费用、税项、股数变化与经营本身。",
      },
      {
        id: "q4",
        title: "还缺什么才能完成归因？",
        detail: "列出完整利润表、非 GAAP 调节表、股数及分部数据。",
      },
    ],
    values: {
      revenue: { before: 89.5, after: 94.9, unit: "十亿美元" },
      eps: { before: 1.46, after: 0.97, unit: "美元/股" },
      adjustedEPS: 1.64,
    },
  };
  const presets = {
    windfall: {
      label: "非经常性因素驱动",
      values: {
        revenue: 120,
        cost: 86,
        expense: 21,
        other: 8,
        tax: 5,
        cash: null,
      },
    },
    operating: {
      label: "经营改善驱动",
      values: {
        revenue: 120,
        cost: 86,
        expense: 21,
        other: 2,
        tax: 4,
        cash: 16,
      },
    },
    pressure: {
      label: "盈利承压",
      values: {
        revenue: 108,
        cost: 84,
        expense: 20,
        other: 2,
        tax: 3,
        cash: 4,
      },
    },
  };
  const baseline = {
    revenue: 100,
    cost: 70,
    expense: 20,
    other: 2,
    tax: 3,
    cash: 11,
  };
  return { sources, apple, presets, baseline, version: "2.0.0" };
});
