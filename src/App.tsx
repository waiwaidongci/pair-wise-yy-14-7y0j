import { useMemo, useState } from "react";
import "./styles.css";
import { useStore, getSurveyor, setSurveyor, resetAll } from "./domain/store";
import { computeQueue, deriveDiseases, isStale } from "./domain/engine";
import RelationGraph from "./components/RelationGraph";
import ComponentList from "./components/ComponentList";
import ComponentDetail from "./components/ComponentDetail";
import RegisterForm from "./components/RegisterForm";
import QueuePanel from "./components/QueuePanel";
import ConflictsPanel from "./components/ConflictsPanel";

function App() {
  const state = useStore();
  const [surveyor, setSurveyorState] = useState(getSurveyor());
  const [buildingId, setBuildingId] = useState(state.buildings[0]?.id ?? "b1");
  const [selectedId, setSelectedId] = useState<string | null>(
    state.components.find((c) => c.buildingId === buildingId)?.id ?? null,
  );
  const [tab, setTab] = useState<"board" | "register">("board");

  const selected =
    state.components.find((c) => c.id === selectedId && c.buildingId === buildingId) ??
    state.components.find((c) => c.buildingId === buildingId) ??
    null;

  const stats = useMemo(() => {
    const mine = state.components.filter((c) => c.buildingId === buildingId);
    const scoped = { ...state, buildings: state.buildings.filter((b) => b.id === buildingId), components: mine };
    const q = computeQueue(scoped);
    return {
      total: mine.length,
      diseases: mine.filter((c) => deriveDiseases(c).severity !== "none").length,
      mortises: new Set(mine.map((c) => c.mortise)).size,
      waiting: q.waiting.length,
      processing: q.processing.length,
      stale: mine.filter(isStale).length,
    };
  }, [state, buildingId]);

  const changeSurveyor = (name: string) => {
    setSurveyorState(name);
    setSurveyor(name);
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">强风灾后 · 古建筑木结构抢护工作台</p>
          <h1>续作抢护台</h1>
        </div>
        <div className="topbar-right">
          <label className="surveyor">
            <span>当前测绘员</span>
            <input value={surveyor} onChange={(e) => changeSurveyor(e.target.value)} />
          </label>
          <select
            className="building-select"
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setSelectedId(state.components.find((c) => c.buildingId === e.target.value)?.id ?? null);
            }}
          >
            {state.buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}（支撑位 {b.slotCount}）</option>
            ))}
          </select>
          <button
            className="ghost"
            onClick={() => {
              if (confirm("恢复演示数据？当前队列与旧版留档将被清空。")) {
                resetAll();
                setSelectedId(null);
              }
            }}
          >
            重置演示
          </button>
        </div>
      </header>

      <section className="metrics">
        <article><small>在册构件</small><strong>{stats.total}</strong></article>
        <article><small>病害点</small><strong>{stats.diseases}</strong></article>
        <article><small>榫卯类型</small><strong>{stats.mortises}</strong></article>
        <article><small>处理中 / 候队</small><strong>{stats.processing}/{stats.waiting}</strong></article>
        <article className={stats.stale ? "metric-alert" : ""}>
          <small>建议失效待核</small><strong>{stats.stale}</strong>
        </article>
      </section>

      <nav className="tabs">
        <button className={tab === "board" ? "tab on" : "tab"} onClick={() => setTab("board")}>抢护队列与关系</button>
        <button className={tab === "register" ? "tab on" : "tab"} onClick={() => setTab("register")}>登记新构件</button>
        <span className="persist-hint">数据保存在本机浏览器：关掉页面再打开，队列、旧版留档和未完成处理仍在</span>
      </nav>

      {tab === "register" ? (
        <section className="panel">
          <h2>登记受灾构件</h2>
          <RegisterForm state={state} buildingId={buildingId} />
        </section>
      ) : (
        <div className="board-grid">
          <section className="panel">
            <div className="heading">
              <h2>抢护队列</h2>
              <span className="hint-line">按变形与下游构件数占位，容量不足先排队</span>
            </div>
            <QueuePanel state={state} buildingId={buildingId} onSelect={setSelectedId} />
          </section>

          <section className="panel">
            <div className="heading">
              <h2>梁架 · 斗拱 · 柱网传力关系</h2>
              <span className="hint-line">点选构件查看复测与修缮</span>
            </div>
            <RelationGraph
              state={state}
              buildingId={buildingId}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            <ConflictsPanel state={state} />
          </section>

          <section className="panel list-panel">
            <div className="heading"><h2>构件清单与筛选</h2></div>
            <ComponentList
              state={state}
              buildingId={buildingId}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          </section>

          <section className="panel detail-panel">
            {selected ? (
              <ComponentDetail key={selected.id} state={state} component={selected} surveyor={surveyor} />
            ) : (
              <p className="hint-line">请选择一个构件。</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
