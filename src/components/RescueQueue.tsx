import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { downstreamOf, fmtTime, priorityOf, recFor, severityOf, SEVERITY_COLOR } from "../engine";
import { Badge, RetestForm, SectionTitle, SeverityBadge, StatusBadge } from "./ui";
import type { ComponentRec } from "../types";

function PriorityScore({ c }: { c: ComponentRec }) {
  const { state } = useStore();
  const down = downstreamOf(state.edges, c.id).length;
  const score = priorityOf(c, down);
  return (
    <span className="score" title={`复测值 ${c.retest} ×2 + 下游构件 ${down} ×5 + 柱网加权`}>
      占位分 <b>{score.toFixed(1)}</b>
      <small>
        （{c.retest}×2 + {down}×5{c.kind === "柱网" ? " +3" : ""}）
      </small>
    </span>
  );
}

function Recommendation({ c }: { c: ComponentRec }) {
  const { dispatch } = useStore();
  if (!c.rec) return null;
  return (
    <div className={`rec-box ${c.rec.valid ? "valid" : "invalid"}`}>
      <div className="rec-head">
        <Badge tone={c.rec.valid ? "green" : "red"}>
          {c.rec.valid ? "修缮建议有效" : "建议已失效"}
        </Badge>
        <Badge tone="slate">{c.rec.level}</Badge>
        <span className="rec-time">{fmtTime(c.rec.issuedAt)}</span>
      </div>
      <p>{c.rec.text}</p>
      <p className="rec-basis">
        依据：复测 {c.rec.basis.deformation}mm · {c.rec.basis.disease} · {c.rec.basis.joint || "未填榫型"}
      </p>
      {!c.rec.valid && (
        <button className="primary" onClick={() => dispatch({ type: "REVERIFY", id: c.id })}>
          重新核对（按当前复测值重算建议）
        </button>
      )}
    </div>
  );
}

function ProcessingRow({ c, onFocus }: { c: ComponentRec; onFocus?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const me = state.surveyors.find((s) => s.id === state.currentSurveyorId);
  const locker = state.surveyors.find((s) => s.id === c.lockedBy);
  const draft = state.drafts.find((d) => d.componentId === c.id && d.surveyorId === state.currentSurveyorId);
  const [note, setNote] = useState(draft?.note ?? "");

  const mine = c.lockedBy === state.currentSurveyorId;

  if (c.status !== "processing") return null;
  return (
    <div className="processing-box">
      {mine ? (
        <>
          <p>
            你正在处理 <b>{c.code}</b>（v{c.version} 起锁定，先到者生效）
          </p>
          <textarea
            placeholder="处理记录：支顶位置、构件复位情况、遗留问题…（暂存后关闭页面仍在）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <div className="inline-tools">
            <button
              onClick={() =>
                dispatch({ type: "SAVE_DRAFT", surveyorId: state.currentSurveyorId, componentId: c.id, note })
              }
            >
              暂存进度
            </button>
            <button
              className="primary"
              onClick={() => {
                dispatch({ type: "FINISH_PROCESSING", id: c.id });
              }}
            >
              完成抢护
            </button>
            <button
              className="ghost-danger"
              onClick={() => dispatch({ type: "RELEASE_PROCESSING", id: c.id })}
            >
              放弃处理（回到队列，草稿保留）
            </button>
          </div>
        </>
      ) : (
        <p>
          <b>{locker?.name ?? "其他测绘员"}</b> 正在处理 {c.code}（{fmtTime(c.lockedAt ?? 0)} 起），你只能查看或排队等候。
          {onFocus && (
            <button className="link" onClick={() => onFocus(c.id)}>
              查看
            </button>
          )}
        </p>
      )}
      {me && !mine && draft && (
        <p className="draft-note">你此前的未完成处理备注：{draft.note || "（无备注）"}</p>
      )}
    </div>
  );
}

export function RescueQueue({
  buildingId,
  focusId,
  onFocusConsumed,
}: {
  buildingId: string;
  focusId?: string;
  onFocusConsumed?: () => void;
}) {
  const { state, dispatch } = useStore();
  const [supportConflict, setSupportConflict] = useState<string | null>(null);
  const seenConflicts = useRef<Set<string>>(new Set());

  const building = state.buildings.find((b) => b.id === buildingId);
  const supports = state.supports.filter((s) => s.buildingId === buildingId);
  const queued = state.components.filter(
    (c) => c.buildingId === buildingId && (c.status === "queued" || c.status === "registered")
  );
  const processing = state.components.filter((c) => c.buildingId === buildingId && c.status === "processing");
  const rescued = state.components.filter((c) => c.buildingId === buildingId && c.status === "rescued");

  const byId = useMemo(() => new Map(state.components.map((c) => [c.id, c])), [state.components]);

  // 监听新冲突（抢占位）
  useEffect(() => {
    for (const cf of state.conflicts) {
      if (seenConflicts.current.has(cf.id)) continue;
      seenConflicts.current.add(cf.id);
      if (cf.kind === "support") setSupportConflict(`${cf.by} 抢占位失败：${cf.detail}。现场值已保留：${cf.kept}`);
    }
  }, [state.conflicts]);

  // 从草稿横幅跳转过来时，滚动定位到对应构件行
  useEffect(() => {
    if (focusId) {
      const el = document.querySelector(`[data-component-id="${focusId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      onFocusConsumed?.();
    }
  }, [focusId, onFocusConsumed]);

  const start = (c: ComponentRec) => {
    dispatch({ type: "START_PROCESSING", id: c.id, baseVersion: c.version });
  };

  return (
    <section className="panel">
      <SectionTitle
        kicker={`${building?.name} · 抢护队列`}
        title="临时支撑与占位"
        extra={
          <div className="inline-tools">
            <button
              onClick={() => {
                const code = prompt("支撑位编号", "ZL-03");
                const cap = Number(prompt("容量（可同时支撑构件数）", "2"));
                if (code && cap > 0) dispatch({ type: "ADD_SUPPORT", buildingId, code, capacity: cap });
              }}
            >
              + 支撑位
            </button>
            <button
              onClick={() => {
                const target = supports[0];
                if (target) dispatch({ type: "SIMULATE_SUPPORT_CONCURRENT", supportId: target.id });
              }}
            >
              并发演练：抢占位冲突
            </button>
          </div>
        }
      />

      {supportConflict && (
        <div className="conflict-banner">
          <strong>占位冲突，现场值已保留</strong>
          <p>{supportConflict}</p>
          <button onClick={() => setSupportConflict(null)}>知道了</button>
        </div>
      )}

      <div className="support-grid">
        {supports.map((s) => {
          const full = s.occupied.length >= s.capacity;
          return (
            <article key={s.id} className={`support-card ${full ? "full" : ""}`}>
              <header>
                <b>{s.code}</b>
                <Badge tone={full ? "red" : "green"}>
                  {s.occupied.length}/{s.capacity} {full ? "已满" : "空闲"}
                </Badge>
              </header>
              <div className="support-occupied">
                {s.occupied.length === 0 && <span className="empty">未占用</span>}
                {s.occupied.map((cid) => {
                  const c = byId.get(cid);
                  return c ? (
                    <span key={cid} className="chip">
                      {c.code}
                      {c.status === "processing" ? "·处理中" : "·已占位"}
                    </span>
                  ) : null;
                })}
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="queue-title">
        抢护队列（{queued.length}）· 按变形与下游构件数占位
        <small>支撑位容量不足时，未占位构件排队等候</small>
      </h3>
      <div className="queue">
        {queued.length === 0 && <p className="empty">队列已清空</p>}
        {queued.map((c) => {
          const occupied = !!c.supportId;
          return (
            <article key={c.id} data-component-id={c.id} className={`queue-row ${focusId === c.id ? "focus" : ""} ${c.dirty ? "dirty" : ""}`}>
              <div className="queue-main">
                <h4>
                  {c.code} <StatusBadge status={c.status} />
                  {c.dirty && <Badge tone="amber">复测值变更·待核对</Badge>}
                  {occupied ? <Badge tone="blue">已占位 {supports.find((s) => s.id === c.supportId)?.code}</Badge> : <Badge tone="slate">排队等候</Badge>}
                </h4>
                <p>
                  {c.kind} · {c.species} · {c.joint || "未填榫型"} · {c.section} · {c.disease}
                </p>
                <p className="component-meta">
                  复测 {c.retest}mm · <SeverityBadge deformation={c.retest} /> · v{c.version}
                </p>
                <PriorityScore c={c} />
                <Recommendation c={c} />
                <RetestForm c={c} />
              </div>
              <div className="queue-actions">
                {!c.dirty && c.rec?.valid && (
                  <button className="primary" onClick={() => start(c)} disabled={!occupied}>
                    {occupied ? "开始处理" : "排队中·无空位"}
                  </button>
                )}
                {c.dirty && <span className="wait-hint">重新核对后可处理</span>}
              </div>
            </article>
          );
        })}
      </div>

      {processing.length > 0 && (
        <>
          <h3 className="queue-title">处理中（{processing.length}）</h3>
          <div className="queue">
            {processing.map((c) => (
              <article key={c.id} className="queue-row processing">
                <div className="queue-main">
                  <h4>
                    {c.code} <StatusBadge status={c.status} />
                    <Badge tone="blue">{supports.find((s) => s.id === c.supportId)?.code}</Badge>
                  </h4>
                  <ProcessingRow c={c} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {rescued.length > 0 && (
        <>
          <h3 className="queue-title">已抢护（{rescued.length}）</h3>
          <div className="queue">
            {rescued.map((c) => (
              <article key={c.id} className="queue-row rescued">
                <div className="queue-main">
                  <h4>
                    {c.code} <StatusBadge status={c.status} /> · v{c.version}
                  </h4>
                  <p className="component-meta">
                    复测 {c.retest}mm · <SeverityBadge deformation={c.retest} /> · {c.disease}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
