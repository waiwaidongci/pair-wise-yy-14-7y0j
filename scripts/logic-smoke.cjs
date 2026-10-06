// 抢护台核心逻辑冒烟测试：队列占位、复测失效、并发冲突、草稿持久化、旧版恢复
const { reducer, init } = require("./store.cjs");
const { downstreamOf, priorityOf, severityOf, recFor } = require("./engine.cjs");

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  passed += 1;
}

let s = init();

// 1. 初始队列：b1 6 个构件，2 个支撑位（容量 2×2=4）→ 4 占位、2 排队
const b1 = s.components.filter((c) => c.buildingId === "b1");
assert(b1.length === 6, "b1 有 6 个构件");
assert(b1.filter((c) => c.supportId).length === 4, "4 个构件占位");
assert(b1.filter((c) => !c.supportId).length === 2, "2 个排队等候");
const c6 = s.components.find((c) => c.id === "c6");
assert(c6.supportId === "sup1" || c6.supportId === "sup2", "最高分 c6 占位");
const c5 = s.components.find((c) => c.id === "c5");
assert(!c5.supportId, "c5 排队等候");

// 2. 复测值变更：建议失效、退出队列、释放占位；排队者递补
s = reducer(s, { type: "RETEST", id: "c6", baseVersion: c6.version, retest: 20.2 });
let x = s.components.find((c) => c.id === "c6");
assert(x.dirty === true && x.rec.valid === false && x.status === "registered" && !x.supportId, "c6 复测后失效并退出队列");
assert(s.components.find((c) => c.id === "c5").supportId, "c5 递补占位");

// 3. 重新核对：建议恢复有效，回到队列并重新占位
s = reducer(s, { type: "REVERIFY", id: "c6" });
x = s.components.find((c) => c.id === "c6");
assert(x.dirty === false && x.rec.valid === true && x.status === "queued" && x.supportId, "c6 核对后回到队列并占位");
assert(!s.components.find((c) => c.id === "c5").supportId, "c5 回到排队");

// 4. 并发：旧 baseVersion 提交 → 冲突，先到者生效，后到值不写入
const before = s;
s = reducer(s, { type: "UPDATE_COMPONENT", id: "c6", baseVersion: 1, patch: { retest: 99 }, summary: "恶意覆盖" });
assert(s.components.find((c) => c.id === "c6").retest === 20.2, "冲突后现场值未写入");
assert(s.conflicts.length === 1, "产生 1 条冲突记录");
assert(s.conflicts[0].kept.includes("恶意覆盖"), "后到者现场值被保留");

// 5. 并发演练：两人同时提交
s = reducer(s, { type: "SIMULATE_CONCURRENT", id: "c6" });
assert(s.conflicts.length === 2 && s.conflicts[1].kind === "component", "并发演练产生构件冲突");

// 6. 处理中锁定：第二人处理同一构件 → 冲突
const vNow = s.components.find((c) => c.id === "c6").version;
s = reducer(s, { type: "START_PROCESSING", id: "c6", baseVersion: vNow });
assert(s.components.find((c) => c.id === "c6").status === "processing", "c6 进入处理中");
s = reducer(s, { type: "SWITCH_SURVEYOR", id: "s2" });
s = reducer(s, { type: "START_PROCESSING", id: "c6", baseVersion: vNow });
assert(s.conflicts.length === 3, "第二人处理被拒");
assert(s.components.find((c) => c.id === "c6").lockedBy === "s1", "锁定仍归先到者");
s = reducer(s, { type: "SWITCH_SURVEYOR", id: "s1" });

// 7. 完成抢护：释放占位，排队者递补
s = reducer(s, { type: "FINISH_PROCESSING", id: "c6" });
x = s.components.find((c) => c.id === "c6");
assert(x.status === "rescued" && !x.supportId, "c6 已抢护并释放占位");
assert(s.components.find((c) => c.id === "c5").supportId, "c5 递补占位");

// 8. 草稿（未完成处理）持久化
s = reducer(s, { type: "SAVE_DRAFT", surveyorId: "s2", componentId: "c3", note: "柱脚量测未完成" });
assert(s.drafts.some((d) => d.componentId === "c3" && d.note === "柱脚量测未完成"), "草稿保存");

// 9. 恢复旧版：字段回滚、建议失效待核对
const v1 = s.versions.find((v) => v.componentId === "c6" && v.version === 1);
s = reducer(s, { type: "RESTORE_VERSION", versionId: v1.id });
x = s.components.find((c) => c.id === "c6");
assert(x.retest === 18.5 && x.dirty === true && x.rec.valid === false, "恢复旧版后复测值回滚且建议失效");

// 10. 登记新构件进入队列
s = reducer(s, {
  type: "ADD_COMPONENT",
  buildingId: "b1",
  values: { code: "梁架A-09", kind: "梁架", species: "杉木", joint: "透榫", section: "180x240mm", disease: "开裂", deformation: 3, retest: 3.2, marker: { x: 50, y: 30 } },
});
assert(s.components.some((c) => c.code === "梁架A-09"), "新构件登记成功");

// 11. 连传力边
s = reducer(s, { type: "ADD_EDGE", from: "c7", to: "c8", label: "梁架传力" });
assert(s.edges.filter((e) => e.buildingId === "b2").length === 2, "新增传力边");

// 12. 抢占位冲突演练
s = reducer(s, { type: "SIMULATE_SUPPORT_CONCURRENT", supportId: "sup1" });
assert(s.conflicts.some((cf) => cf.kind === "support"), "抢占位冲突记录");

// 13. 引擎纯函数
assert(severityOf(4) === "轻微" && severityOf(8) === "中等" && severityOf(18) === "严重", "病害分级");
assert(downstreamOf(s.edges, "c2").includes("c6") && downstreamOf(s.edges, "c2").length === 2, "下游构件递归");
assert(priorityOf(s.components.find((c) => c.id === "c6"), 0) >= 40, "占位分计算");
const r = recFor({ retest: 20, disease: "柱脚糟朽", joint: "透榫" });
assert(r.level === "立即支顶", "建议规则命中");

console.log(`\n全部 ${passed} 项断言通过 ✅`);
