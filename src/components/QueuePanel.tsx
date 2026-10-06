import type { AppState, ComponentNode } from "../domain/types";
import { KIND_LABEL, STATUS_LABEL } from "../domain/types";
import { computeQueue, deriveDiseases, downstreamCount, isStale } from "../domain/engine";

interface Props {
  state: AppState;
  buildingId: string;
  onSelect: (id: string) => void;
}

function Row({ c, priority, downstream, onSelect, badge }: {
  c: ComponentNode;
  priority?: number;
  downstream: number;
  onSelect: (id: string) => void;
  badge: string;
}) {
  const { severity } = deriveDiseases(c);
  return (
    <button className={`queue-row sev-row-${severity}`} onClick={() => onSelect(c.id)}>
      <span className="q-badge">{badge}</span>
      <span className="q-main">
        <strong>{c.code}</strong>
        <small>{KIND_LABEL[c.kind]} · {c.wood} · {c.mortise}</small>
      </span>
      <span className="q-metric">
        <b>{c.reDeflection}mm</b>
        <small>变形</small>
      </span>
      <span className="q-metric">
        <b>{downstream}</b>
        <small>下游构件</small>
      </span>
      {priority != null && (
        <span className="q-metric">
          <b>{priority}</b>
          <small>占位优先值</small>
        </span>
      )}
      {c.status === "processing" && (
        <span className="q-slot">#{c.assignedSlot} 位 · {c.lockedBy}</span>
      )}
    </button>
  );
}

export default function QueuePanel({ state, buildingId, onSelect }: Props) {
  const scoped: AppState = {
    ...state,
    buildings: state.buildings.filter((b) => b.id === buildingId),
    components: state.components.filter((c) => c.buildingId === buildingId),
  };
  const { processing, waiting, promotable } = computeQueue(scoped);
  const building = state.buildings.find((b) => b.id === buildingId)!;
  const stale = scoped.components.filter((c) => isStale(c) && c.status !== "processing");
  const done = scoped.components.filter((c) => c.status === "done");
  const occupied = processing.length;

  return (
    <div className="queue-panel">
      <div className="slots-bar">
        <span>{building.name} 临时支撑位</span>
        <div className="slots">
          {building.slots.map((s) => {
            const holder = processing.find((p) => p.component.assignedSlot === s);
            return (
              <span key={s} className={holder ? "slot busy" : "slot free"} title={holder ? holder.component.code : "空闲"}>
                <b>#{s}</b>
                {holder ? <small>{holder.component.code.split(" ").pop()} · {holder.component.lockedBy}</small> : <small>空闲</small>}
              </span>
            );
          })}
        </div>
        <strong>{occupied}/{building.slotCount}</strong>
      </div>

      <h4>处理中（占 {occupied} 位）</h4>
      {processing.length === 0 && <p className="hint-line">暂无开工构件。</p>}
      {processing.map((i) => (
        <Row key={i.component.id} c={i.component} downstream={i.downstream} onSelect={onSelect} badge="处理中" />
      ))}

      <h4>
        候队（支撑位容量不足时等候 · 前 {promotable} 名可补位）
      </h4>
      {waiting.length === 0 && <p className="hint-line">队列已空。</p>}
      {waiting.map((i, idx) => (
        <div key={i.component.id} className={idx < promotable ? "queue-canpromote" : ""}>
          <Row c={i.component} priority={i.priority} downstream={i.downstream} onSelect={onSelect}
            badge={idx < promotable ? `候补 #${idx + 1}` : `排队 #${idx + 1}`} />
        </div>
      ))}

      {stale.length > 0 && (
        <>
          <h4 className="stale-title">复测值改动 · 已退出队列，待重新核对</h4>
          {stale.map((c) => (
            <Row key={c.id} c={c}
              downstream={downstreamCount(c.id, scoped.components)}
              onSelect={onSelect} badge="失效" />
          ))}
        </>
      )}

      {done.length > 0 && (
        <details className="done-fold">
          <summary>已修缮（{done.length}）</summary>
          {done.map((c) => (
            <Row key={c.id} c={c}
              downstream={0}
              onSelect={onSelect} badge={STATUS_LABEL.done} />
          ))}
        </details>
      )}
    </div>
  );
}
