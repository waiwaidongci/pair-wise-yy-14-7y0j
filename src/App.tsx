import { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore } from "./store";
import { TopBar } from "./components/TopBar";
import { BuildingsTab } from "./components/BuildingsTab";
import { DiseaseMap } from "./components/DiseaseMap";
import { RelationView } from "./components/RelationView";
import { RescueQueue } from "./components/RescueQueue";
import { HistoryPanel } from "./components/HistoryPanel";
import { Badge } from "./components/ui";
import { downstreamOf, severityOf } from "./engine";

type Tab = "overview" | "buildings" | "disease" | "relation" | "queue" | "history";

function Overview({ onNavigate }: { onNavigate: (t: Tab, focusId?: string) => void }) {
  const { state } = useStore();
  const buildingId = state.selectedBuildingId;
  const components = state.components.filter((c) => c.buildingId === buildingId);
  const queued = components.filter((c) => c.status === "queued" || c.status === "registered");
  const processing = components.filter((c) => c.status === "processing");
  const rescued = components.filter((c) => c.status === "rescued");
  const dirty = components.filter((c) => c.dirty);
  const diseasePoints = components.filter((c) => severityOf(c.retest) !== "轻微" || c.disease).length;

  const myDrafts = state.drafts.filter((d) => {
    const c = state.components.find((x) => x.id === d.componentId);
    return d.surveyorId === state.currentSurveyorId && c && c.status !== "rescued";
  });

  const queueRows = queued
    .map((c) => ({
      c,
      down: downstreamOf(state.edges, c.id).length,
    }))
    .sort((a, b) => b.c.retest * 2 + b.down * 5 - (a.c.retest * 2 + a.down * 5));

  return (
    <>
      <section className="metrics">
        <article>
          <small>构件数量</small>
          <strong>{components.length}</strong>
        </article>
        <article>
          <small>病害点</small>
          <strong>{diseasePoints}</strong>
        </article>
        <article>
          <small>待抢护（排队+占位）</small>
          <strong>{queued.length}</strong>
        </article>
        <article>
          <small>已抢护</small>
          <strong>{rescued.length}</strong>
        </article>
      </section>

      {myDrafts.length > 0 && (
        <div className="draft-banner">
          <strong>你有 {myDrafts.length} 项未完成处理，关闭页面后仍保留</strong>
          <div className="draft-banner-list">
            {myDrafts.map((d) => {
              const c = state.components.find((x) => x.id === d.componentId);
              return (
                <span key={d.id} className="chip">
                  {c?.code} · {d.note || "未填写备注"}
                  <button className="link" onClick={() => onNavigate("queue", c?.id)}>
                    继续处理 →
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {dirty.length > 0 && (
        <div className="conflict-banner">
          <strong>{dirty.length} 项构件复测值已变更，修缮建议失效、关系边与病害标记待重新核对</strong>
          <p>
            {dirty.map((c) => c.code).join("、")}
            ，重新核对后才会回到抢护队列。
          </p>
          <button onClick={() => onNavigate("queue")}>前往抢护台核对</button>
        </div>
      )}

      <section className="panel">
        <div className="heading">
          <div>
            <p>{state.buildings.find((b) => b.id === buildingId)?.name}</p>
            <h2>抢护次序概览</h2>
          </div>
          <button onClick={() => onNavigate("queue")}>进入抢护台</button>
        </div>
        <div className="queue">
          {queueRows.length === 0 && <p className="empty">队列已清空</p>}
          {queueRows.slice(0, 6).map(({ c, down }, i) => (
            <article key={c.id} className="queue-row">
              <div className="queue-main">
                <h4>
                  <span className="rank">{i + 1}</span>
                  {c.code}
                  <Badge tone={c.supportId ? "blue" : "slate"}>{c.supportId ? "已占位" : "排队等候"}</Badge>
                  {c.dirty && <Badge tone="amber">待核对</Badge>}
                </h4>
                <p className="component-meta">
                  {c.kind} · {c.disease} · 复测 {c.retest}mm · 下游 {down} 件
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="overview-shortcuts">
          <button onClick={() => onNavigate("buildings")}>构件登记</button>
          <button onClick={() => onNavigate("disease")}>病害标记图</button>
          <button onClick={() => onNavigate("relation")}>梁架关系视图</button>
          <button onClick={() => onNavigate("history")}>旧版 / 冲突 / 草稿</button>
        </div>
      </section>
    </>
  );
}

function ConflictToast() {
  const { state, dispatch } = useStore();
  const [shown, setShown] = useState<string | null>(null);
  const latest = state.conflicts[0];

  useEffect(() => {
    if (latest && latest.id !== shown) {
      setShown(latest.id);
      const t = setTimeout(() => setShown(null), 8000);
      return () => clearTimeout(t);
    }
  }, [latest, shown]);

  if (!latest || latest.id !== shown) return null;
  return (
    <div className="toast" role="alert">
      <strong>并发冲突：{latest.by} 未写入</strong>
      <p>
        {latest.componentCode ?? latest.supportCode} · {latest.detail}
      </p>
      <p className="kept">现场值已保留：{latest.kept}</p>
      <button onClick={() => dispatch({ type: "DISMISS_CONFLICT", id: latest.id })}>知道了</button>
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const buildingId = state.selectedBuildingId;

  const navigate = (t: Tab, focus?: string) => {
    setTab(t);
    setFocusId(focus);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "总览" },
    { key: "buildings", label: "构件登记" },
    { key: "disease", label: "病害标记图" },
    { key: "relation", label: "梁架关系" },
    { key: "queue", label: "抢护队列" },
    { key: "history", label: "旧版·冲突·草稿" },
  ];

  return (
    <main className="app">
      <TopBar />
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <Overview onNavigate={navigate} />}
      {tab === "buildings" && <BuildingsTab onSelectComponent={() => setTab("queue")} />}
      {tab === "disease" && <DiseaseMap buildingId={buildingId} onSelect={() => setTab("buildings")} />}
      {tab === "relation" && <RelationView buildingId={buildingId} onSelect={() => setTab("buildings")} />}
      {tab === "queue" && (
        <RescueQueue buildingId={buildingId} focusId={focusId} onFocusConsumed={() => setFocusId(undefined)} />
      )}
      {tab === "history" && <HistoryPanel onContinueDraft={(id) => navigate("queue", id)} />}

      <ConflictToast />
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
