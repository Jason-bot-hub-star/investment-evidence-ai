"use strict";
const assert = require("node:assert/strict");
const D = require("../data");
const E = require("../engine");
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS engine:", name);
}
test("历史GAAP与调整后口径给出不同结论", () => {
  assert.equal(E.historical("gaap").verdict, "前提不成立");
  assert.equal(E.historical("adjusted").verdict, "部分支持");
  assert.equal(E.historical("both").verdict, "证据不足");
});
test("GAAP同比计算正确", () =>
  assert.ok(Math.abs(E.growth(0.97, 1.46) + 33.5616438356) < 0.000001));
test("非经营驱动情景利润桥一致", () => {
  const r = E.simulate(D.presets.windfall.values),
    c = r.calculation;
  assert.equal(c.np0, 9);
  assert.equal(c.np1, 16);
  assert.equal(c.delta, c.opDelta + c.otherDelta + c.taxEffect);
  assert.equal(r.verdict, "模型内不支持");
});
test("经营驱动情景贡献率允许超过100%", () => {
  const r = E.simulate(D.presets.operating.values);
  assert.equal(r.verdict, "模型内支持");
  assert.equal(r.calculation.share, 150);
});
test("盈利承压不计算增量贡献率", () => {
  const r = E.simulate(D.presets.pressure.values);
  assert.equal(r.verdict, "前提不成立");
  assert.equal(r.calculation.share, null);
});
test("翻转阈值为其他收益7", () =>
  assert.equal(E.simulate(D.presets.windfall.values).calculation.flipAt, 7));
test("等于50%不满足严格主要定义", () => {
  const r = E.simulate({ ...D.presets.windfall.values, other: 7 });
  assert.equal(r.calculation.share, 50);
  assert.equal(r.verdict, "模型内不支持");
});
test("低于其他收益阈值可翻转", () =>
  assert.equal(
    E.simulate({ ...D.presets.windfall.values, other: 6.5 }).verdict,
    "模型内支持",
  ));
test("缺失现金流保留unknown", () => {
  assert.ok(
    E.simulate(D.presets.windfall.values).evidence.some(
      (e) => e.id === "SIM4" && e.stance === "unknown",
    ),
  );
});
test("补充现金流不再声称缺失", () => {
  assert.equal(
    E.simulate(D.presets.operating.values).evidence.find((e) => e.id === "SIM4")
      .stance,
    "context",
  );
});
test("非法数值被拒绝", () => {
  for (const value of [NaN, Infinity, -1, null, 10001])
    assert.throws(() =>
      E.simulate({ ...D.presets.windfall.values, revenue: value }),
    );
});
test("零净利润增量不除以零", () => {
  const r = E.simulate({ ...D.baseline });
  assert.equal(r.calculation.share, null);
  assert.equal(r.verdict, "前提不成立");
});
test("规则问答不装成任意AI回答", () => {
  assert.match(E.answerLocal("讲个故事", E.historical()), /超出预设解释/);
  assert.match(E.answerLocal("告诉我买入点", E.historical()), /不.*买卖/);
});
test("没有虚构来源网址", () => {
  assert.equal(D.sources.SIM.url, null);
  assert.equal(D.sources.S24.kind, "historical");
});
console.log(count + " engine tests passed.");
