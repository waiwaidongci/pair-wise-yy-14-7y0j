import { useMemo, useState } from "react";
import type { AppState, ComponentKind } from "../domain/types";
import { DISEASE_LABEL, KIND_LABEL, MORTISES, STATUS_LABEL } from "../domain/types";
import { deriveDiseases, isStale } from "../domain/engine";

interface Props {
  state: AppState;
  buildingId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ComponentList({ state, buildingId, selectedId, onSelect }: Props) {
  const [mortise, setMortise] = useState<string>("全部");
  const [kind, setKind] = useState<"全部" | ComponentKind>("全部");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return state.components
      .filter((c) => c.buildingId === buildingId)
      .filter((c) => (mortise === "全部" ? true : c.mortise === mortise))
      .filter((c) => (kind === "全部" ? true : c.kind === kind))
      .filter((c) =>
        q.trim()
          ? (c.code + c.wood + c.diseaseLocation).toLowerCase().includes(q.trim().toLowerCase())
          : true,
      );
  }, [state.components, buildingId, mortise, kind, q]);

  return (
    <div className="comp-list">
      <div className="list-filters">
        <input placeholder="搜索编号 / 木材 / 病害位置" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {["全部", ...MORTISES].map((m) => (
            <button key={m} className={mortise === m ? "chip on" : "chip"} onClick={() => setMortise(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="chips">
          {(["全部", "beam", "bracket", "column"] as const).map((k) => (
            <button key={k} className={kind === k ? "chip on" : "chip"} onClick={() => setKind(k)}>
              {k === "全部" ? "全部" : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="list-body">
        {rows.map((c) => {
          const d = deriveDiseases(c);
          const stale = isStale(c);
          return (
            <button
              key={c.id}
              className={`list-item sev-row-${d.severity} ${selectedId === c.id ? "selected" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="li-head">
                <strong>{c.code}</strong>
                <span className={`status status-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              </span>
              <span className="li-meta">
                {c.wood} · {c.mortise} · {c.reWidth}×{c.reHeight}mm
              </span>
              <span className="li-meta">
                变形 {c.reDeflection}mm · 病害：{c.diseaseLocation || "无"}
              </span>
              <span className="li-tags">
                {d.diseases.filter((x) => x !== "none").map((x) => (
                  <em key={x} className={`tag tag-${x}`}>{DISEASE_LABEL[x]}</em>
                ))}
                {stale && <em className="tag tag-stale">建议失效</em>}
                {c.status === "processing" && <em className="tag tag-lock">#{c.assignedSlot} {c.lockedBy}</em>}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <p className="hint-line">没有匹配的构件。</p>}
      </div>
    </div>
  );
}
