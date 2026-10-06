(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./data"));
  else root.ResearchEngine = factory(root.ResearchData);
})(typeof globalThis !== "undefined" ? globalThis : this, function (D) {
  "use strict";
  const round = (n, d = 1) => Number(n.toFixed(d));
  const growth = (a, b) => (b === 0 ? null : (a / b - 1) * 100);
  function evidence(
    id,
    stance,
    title,
    body,
    sourceIds,
    quote,
    limit,
    questionIds,
  ) {
    return { id, stance, title, body, sourceIds, quote, limit, questionIds };
  }
  function historical(basis = "both") {
    const es = [
      evidence(
        "E1",
        "support",
        "收入增长，为业务规模扩大提供线索",
        "本期收入 949 亿美元；公司披露同比增长 6%。它支持规模增长，但不能单独证明经营利润增长。",
        ["S24"],
        D.sources.S24.quotes[0],
        "收入不等于利润；缺少成本、费用与分部利润数据。",
        ["q2"],
      ),
      evidence(
        "E2",
        basis === "adjusted" ? "context" : "oppose",
        "GAAP 每股收益下降，盈利改善不能一概而论",
        "FY2024 Q4 为 0.97 美元/股，FY2023 Q4 为 1.46 美元/股；按披露值计算，同比约 -33.6%。",
        ["S24", "S23"],
        D.sources.S24.quotes[1],
        "这是 GAAP EPS，不是净利润；也不能直接与非 GAAP 指标混为一谈。",
        ["q1", "q3"],
      ),
      evidence(
        "E3",
        basis === "gaap" ? "context" : "support",
        "调整后每股收益增长，但不等于主营归因成立",
        "剔除一次性费用后 EPS 为 1.64 美元，公司披露同比增长 12%。",
        ["S24"],
        D.sources.S24.quotes[2],
        "非 GAAP 指标需要核对调节表；还可能受到股数和税项变化影响。",
        ["q1", "q3"],
      ),
      evidence(
        "E4",
        "unknown",
        "经营因素到底贡献多少，现有材料无法确定",
        "当前两份业绩稿摘录没有提供足够信息来分解营业利润、税项和股数对盈利变化的贡献。",
        [],
        "",
        "两份材料都来自发行人，不能视为两个独立信息源。",
        ["q2", "q4"],
      ),
    ];
    const labels = {
      both: [
        "证据不足",
        "先澄清“盈利”的口径，再讨论改善的来源",
        "GAAP EPS 下降与调整后 EPS 增长并不矛盾。业务收入增长是支持性线索，但现有材料无法证明经营改善是主要贡献。",
      ],
      gaap: [
        "前提不成立",
        "若用 GAAP EPS 衡量，“盈利改善”不成立",
        "GAAP 稀释 EPS 由 1.46 降至 0.97 美元。调整后 EPS 增长不能替代 GAAP 口径，也不能被拿来支持这个口径下的盈利改善。",
      ],
      adjusted: [
        "部分支持",
        "调整后 EPS 改善成立，经营主因仍待验证",
        "公司披露剔除一次性费用后的 EPS 同比增长 12%；但收入、EPS 和主营利润并非同一指标，不能据此完成因果归因。",
      ],
    };
    const [verdict, title, summary] = labels[basis] || labels.both;
    return {
      kind: "historical",
      modeLabel: "真实材料快照 · 本地规则分析",
      verdict,
      title,
      summary,
      basis,
      evidence: es,
      metrics: [
        {
          label: "收入同比",
          value: "+6%",
          detail: "公司披露 · S24",
          tone: "up",
        },
        {
          label: "GAAP EPS 同比",
          value: "−33.6%",
          detail: "程序计算 · S24 / S23",
          tone: "down",
        },
        {
          label: "调整后 EPS 同比",
          value: "+12%",
          detail: "公司披露 · 非 GAAP",
          tone: "up",
        },
      ],
      comparison: [
        { label: "营业收入", before: 89.5, after: 94.9, unit: "十亿美元" },
        { label: "GAAP 稀释 EPS", before: 1.46, after: 0.97, unit: "美元/股" },
      ],
      formula:
        "GAAP EPS 同比 = (0.97 ÷ 1.46 − 1) × 100% ≈ −33.56%。收入同比 6% 与调整后 EPS 同比 12% 直接采用公司披露值。",
      conflict: {
        title: "不是证据互相打架，而是口径没有对齐",
        left: "GAAP EPS：同比下降约 33.6%",
        right: "调整后 EPS：公司披露同比增长 12%",
        resolution:
          "先分别记录两种口径，再检验经营解释。一次性费用可以使两者方向不同；不挑选对命题有利的口径，也不把 EPS 当作净利润。",
      },
      changes: [
        {
          title: "营业利润贡献得到验证",
          detail:
            "补充完整利润表与分部利润；若经营利润增量足以解释盈利改善，增强支持。",
          effect: "可能增强支持",
        },
        {
          title: "股数或税项解释了主要改善",
          detail:
            "补充加权平均股数、有效税率和非 GAAP 调节表；若非经营因素主导，减弱经营归因。",
          effect: "可能削弱支持",
        },
        {
          title: "原始口径无法复核",
          detail: "如果一次性项目与调整口径无法在财报中对应，维持无法验证。",
          effect: "维持证据不足",
        },
      ],
      missing: [
        "完整利润表及营业利润变动",
        "非 GAAP 指标与 GAAP 的调节表",
        "加权平均股数及税项变化",
        "可独立交叉核验的资料",
      ],
      coverage: { answered: 3, total: 4 },
      sourceStatus:
        "引用来自两期官方材料的已核验摘录；本次没有实时拉取数据或调用模型。",
    };
  }
  function validateInputs(v) {
    for (const key of ["revenue", "cost", "expense", "other", "tax"]) {
      if (
        typeof v[key] !== "number" ||
        !Number.isFinite(v[key]) ||
        v[key] < 0 ||
        v[key] > 10000
      )
        throw new Error("情景数值必须是 0–10000 之间的有效数字。");
    }
    if (
      v.cash !== null &&
      (typeof v.cash !== "number" ||
        !Number.isFinite(v.cash) ||
        Math.abs(v.cash) > 10000)
    )
      throw new Error("现金流应为有效数字，或留空表示未知。");
  }
  function simulate(v) {
    validateInputs(v);
    const b = D.baseline;
    const op0 = b.revenue - b.cost - b.expense,
      op1 = v.revenue - v.cost - v.expense,
      np0 = op0 + b.other - b.tax,
      np1 = op1 + v.other - v.tax;
    const delta = np1 - np0,
      opDelta = op1 - op0,
      otherDelta = v.other - b.other,
      taxEffect = b.tax - v.tax;
    const share = delta > 0 ? (opDelta / delta) * 100 : null;
    const growthOK = delta > 0;
    const mainly = growthOK && opDelta > 0 && share > 50;
    const verdict = !growthOK
      ? "前提不成立"
      : mainly
        ? "模型内支持"
        : "模型内不支持";
    const es = [
      evidence(
        "SIM1",
        opDelta > 0 ? "support" : "oppose",
        opDelta > 0 ? "简化经营利润增加" : "简化经营利润没有增加",
        `经营利润从 ${op0} 变为 ${round(op1)}，增量 ${round(opDelta)}（假设单位：百万元）。`,
        ["SIM"],
        "",
        "经营利润简化为收入减营业成本、期间费用，未覆盖真实会计的全部项目。",
        ["q2"],
      ),
      evidence(
        "SIM2",
        !growthOK ? "oppose" : mainly ? "support" : "oppose",
        !growthOK
          ? "净利润未改善，命题前提不成立"
          : mainly
            ? "经营增量超过净利润增量的一半"
            : "经营增量没有超过净利润增量的一半",
        `净利润从 ${np0} 变为 ${round(np1)}；${share === null ? "净利润增量不为正，不计算贡献率。" : `经营增量 / 净利润增量 = ${round(share)}%。`}`,
        ["SIM"],
        "",
        "“主要”在本模型中人为定义为贡献率大于 50%，不是行业标准。贡献率可因其他因素抵消而超过 100%。",
        ["q1", "q2"],
      ),
      evidence(
        "SIM3",
        otherDelta > 0 ? "oppose" : "context",
        "其他收益与税费也在改变利润",
        `其他收益贡献 ${round(otherDelta)}，税费变化贡献 ${round(taxEffect)}；两者合计 ${round(otherDelta + taxEffect)}。`,
        ["SIM"],
        "",
        "其他收益不全部等于一次性损益；此处只作为非经营项的简化代理。",
        ["q3"],
      ),
      evidence(
        "SIM4",
        v.cash === null ? "unknown" : "context",
        v.cash === null
          ? "现金流没有输入，盈利质量暂不可验证"
          : "现金流已输入，但不能单独完成盈利质量判断",
        v.cash === null
          ? "情景只提供利润表假设，尚未提供经营现金流。"
          : `假设经营现金流 ${v.cash}，对比基期 ${b.cash}。`,
        v.cash === null ? [] : ["SIM"],
        "",
        "现金流和利润存在时间差；不能仅用一项现金流数据断定财务质量。",
        ["q4"],
      ),
    ];
    const flipAt = 2 * opDelta + np0 - op1 + v.tax;
    const possibleRange =
      opDelta > 0
        ? `在其他参数保持不变且净利润仍增长时，其他收益低于 ${round(flipAt, 2)}，才满足“经营贡献 > 50%”；等于该值恰好 50%，不满足严格大于。`
        : "当前经营增量不为正，仅降低其他收益无法使经营改善成为正向主因。";
    return {
      kind: "synthetic",
      modeLabel: "全部虚构 · 简化规则计算",
      verdict,
      title: !growthOK
        ? "先确认盈利增长，再追问增长来自哪里"
        : mainly
          ? "在当前假设下，经营改善是主要正向贡献"
          : "在当前假设下，非经营因素不能被忽略",
      summary: `示例制造 A 是虚构公司。净利润变动 ${round(delta)} 百万元，其中经营变化贡献 ${round(opDelta)}、其他收益贡献 ${round(otherDelta)}、税费变化贡献 ${round(taxEffect)}。这是一组可重算的假设，不是实际投资结论。`,
      evidence: es,
      metrics: [
        {
          label: "净利润同比 · 假设",
          value:
            (growth(np1, np0) > 0 ? "+" : "") + round(growth(np1, np0)) + "%",
          detail: `${np0} → ${round(np1)} 百万元`,
          tone: growthOK ? "up" : "down",
        },
        {
          label: "经营增量贡献率",
          value: share === null ? "不适用" : round(share) + "%",
          detail: "带符号增量比 · 非概率",
          tone: mainly ? "neutral" : "amber",
        },
        {
          label: "待补充材料",
          value: v.cash === null ? "现金流缺失" : "仍需外部核验",
          detail: "虚构数据，不代表事实充分",
          tone: "blue",
        },
      ],
      comparison: [
        {
          label: "简化经营利润",
          before: op0,
          after: op1,
          unit: "百万元 · 假设",
        },
        { label: "净利润", before: np0, after: np1, unit: "百万元 · 假设" },
      ],
      formula: `经营利润 = 收入 − 成本 − 期间费用；净利润 = 经营利润 + 其他收益 − 税费。\n净利润变动 ${round(delta)} = 经营贡献 ${round(opDelta)} + 其他收益贡献 ${round(otherDelta)} + 税费影响 ${round(taxEffect)}。`,
      contributions: [
        { label: "经营变化", value: opDelta },
        { label: "其他收益", value: otherDelta },
        { label: "税费变化", value: taxEffect },
      ],
      conflict: {
        title: "利润增长，不代表经营贡献一定占主导",
        left: `经营利润增量 ${round(opDelta)} 百万元`,
        right: `净利润增量 ${round(delta)} 百万元`,
        resolution:
          "使用带符号利润桥拆分贡献。正向贡献可以被税费等负向贡献抵消，所以贡献率可能超过 100%，不应归一化成概率或可信度。",
      },
      changes: [
        {
          title: "调低或调高其他收益",
          detail: possibleRange,
          effect: "结论可翻转",
        },
        {
          title: "调整营业成本",
          detail:
            "在收入不变时，提高成本会压低经营利润；观察是否还满足净利润增长与经营贡献阈值。",
          effect: "直接影响主因",
        },
        {
          title: "补充真实数据后重新验证",
          detail:
            "该模型只证明产品计算链路；切换真实材料或接入模型后，需要重新检验事实和会计口径。",
          effect: "从假设回到事实",
        },
      ],
      missing:
        v.cash === null
          ? ["经营现金流", "真实财务报表及原始公告", "独立来源交叉验证"]
          : ["真实财务报表及原始公告", "现金流差异解释", "独立来源交叉验证"],
      coverage: { answered: 3, total: 4 },
      sourceStatus: "所有数值均来自当前情景参数，非接口数据、非真实公司财报。",
      inputs: { ...v },
      calculation: {
        op0,
        op1,
        np0,
        np1,
        delta,
        opDelta,
        otherDelta,
        taxEffect,
        share,
        flipAt,
      },
    };
  }
  function answerLocal(question, result) {
    const q = question.trim();
    if (!q) return "请输入想继续研究的问题。";
    if (/买入|卖出|稳赚|保证|买卖点/.test(q))
      return "这里只辅助验证研究命题，不给出买卖指令或收益保证。可以继续询问证据、口径、风险和待补材料。";
    if (result.kind === "synthetic") {
      if (/阈值|翻转|改变|其他收益/.test(q))
        return result.changes[0].detail + "（虚构情景，本地规则回答）";
      if (/现金|缺|补充/.test(q))
        return (
          "还需补充：" +
          result.missing.join("、") +
          "。即便补齐假设，也不能代替真实财务数据。"
        );
      if (/贡献|计算|利润/.test(q))
        return result.formula + "\n经营贡献率不是概率，也不是模型置信度。";
    } else {
      if (/GAAP|口径|矛盾|冲突|下降/i.test(q))
        return (
          result.conflict.resolution +
          " 本案例 GAAP EPS 为 0.97 美元，上一期为 1.46 美元 [S24][S23]；调整后 EPS 同比增长 12% [S24]。"
        );
      if (/收入|主营|经营/.test(q))
        return "收入同比增长 6% [S24] 只能支持业务规模增长。成本、费用、税项和股数都可能影响盈利；缺少完整利润表与调节表时，不能证明“主要来自经营”。";
      if (/缺|补充|改变|下一步/.test(q))
        return (
          "优先补充：" +
          result.missing.join("、") +
          "。" +
          result.changes[0].detail
        );
    }
    return "当前为本地规则问答，没有调用大模型。该问题超出预设解释范围，请使用下方建议问题，或切换真实 AI 模式；不会用固定报告假装回答任意问题。";
  }
  return { historical, simulate, answerLocal, validateInputs, growth, round };
});
