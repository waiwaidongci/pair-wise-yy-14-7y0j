import { useMemo, useState } from "react";
import { useStore } from "../store";
import { downstreamOf, edgeStale, severityOf, SEVERITY_COLOR } from "../engine";
import type { ComponentRec, Edge } from "../types";

const LANE_Y: Record<ComponentRec["kind"], number> = { 梁架: 70, 斗拱: 195, 柱网: 320 };
const LANE_X: Record<ComponentRec["kind"], [number, number]> = {
  梁架: [120, 560],
  斗拱: [120, 560],
  柱网: [120, 560],
};

/** 梁架 → 斗拱 → 柱网 传力关系视图；复测值变更的构件其关系边同步标黄待重算 */
export function RelationView({ buildingId, onSelect }: { buildingId: string; onSelect?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const [addFrom, setAddFrom] = useState("");
  const [addTo, setAddTo] = useState("");

  const components = useMemo(
    () => state.components.filter((c) => c.buildingId === buildingId),
    [state.components, buildingId]
  );
  const edges = useMemo(
    () => state.edges.filter((e) => e.buildingId === buildingId),
    [state.edges, buildingId]
  );
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const groups: Record<string, ComponentRec[]> = { 梁架: [], 斗拱: [], 柱网: [] };
    components.forEach((c) => groups[c.kind].push(c));
    (Object.keys(groups) as ComponentRec["kind"][]).forEach((k) => {
      const list = groups[k].sort((a, b) => a.code.localeCompare(b.code, "zh"));
      const [x0, x1] = LANE_X[k];
      list.forEach((c, i) => {
        const x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1);
        m.set(c.id, { x, y: LANE_Y[k] });
      });
    });
    return m;
  }, [components]);

  const downstreamCount = (id: string) => downstreamOf(state.edges, id).length;

  const addEdge = () => {
    if (!addFrom || !addTo || addFrom === addTo) return;
    const label =
      byId.get(addFrom)?.kind === "梁架" && byId.get(addTo)?.kind === "柱网"
        ? "梁架直接传力"
        : byId.get(addFrom)?.kind === "斗拱"
          ? "斗拱传力"
          : "梁架传力";
    dispatch({ type: "ADD_EDGE", from: addFrom, to: addTo, label });
    setAddFrom("");
    setAddTo("");
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件关系视图</p>
          <h2>梁架 · 斗拱 · 柱网传力关系</h2>
        </div>
        <div className="legend">
          <span className="legend-item">
            <span className="dot" style={{ background: "#475569" }} />
            传力边
          </span>
          <span className="legend-item">
            <span className="dot stale" />
            待重算
          </span>
        </div>
      </div>

      <svg viewBox="0 0 680 380" className="relation-map">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
          <marker id="arrow-stale" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#b45309" />
          </marker>
        </defs>

        {(["梁架", "斗拱", "柱网"] as const).map((k) => (
          <text key={k} x="24" y={LANE_Y[k] + 5} fontSize="13" fontWeight="800" fill="#94a3b8">
            {k}层
          </text>
        ))}

        {edges.map((e: Edge) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const stale = edgeStale(e, byId);
          const midY = (a.y + b.y) / 2;
          return (
            <g key={e.id}>
              <path
                d={`M${a.x},${a.y + 24} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y - 24}`}
                fill="none"
                stroke={stale ? "#b45309" : "#94a3b8"}
                strokeWidth="2"
                strokeDasharray={stale ? "6 4" : undefined}
                markerEnd={stale ? "url(#arrow-stale)" : "url(#arrow)"}
              />
              <text x={(a.x + b.x) / 2} y={midY - 6} textAnchor="middle" fontSize="10" fill={stale ? "#b45309" : "#64748b"}>
                {e.label}
                {stale ? " · 待重算" : ""}
              </text>
            </g>
          );
        })}

        {components.map((c) => {
          const p = pos.get(c.id);
          if (!p) return null;
          const color = SEVERITY_COLOR[severityOf(c.retest)];
          const fill = c.kind === "梁架" ? "#854d0e" : c.kind === "斗拱" ? "#0f766e" : "#475569";
          return (
            <g key={c.id} className="node" onClick={() => onSelect?.(c.id)} style={{ cursor: "pointer" }}>
              <rect x={p.x - 62} y={p.y - 22} width="124" height="44" rx="8" fill={fill} opacity={c.dirty ? 0.75 : 1} />
              <circle cx={p.x + 50} cy={p.y - 14} r="6" fill={color} stroke="#fff" strokeWidth="2" />
              {c.dirty && (
                <circle cx={p.x - 50} cy={p.y - 14} r="7" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
              )}
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                {c.code}
              </text>
              <text x={p.x} y={p.y + 40} textAnchor="middle" fontSize="10" fill="#64748b">
                下游 {downstreamCount(c.id)} 件 · v{c.version}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="edge-add">
        <span className="field-label">连传力关系</span>
        <select value={addFrom} onChange={(e) => setAddFrom(e.target.value)}>
          <option value="">上游构件</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}（{c.kind}）
            </option>
          ))}
        </select>
        <span>→</span>
        <select value={addTo} onChange={(e) => setAddTo(e.target.value)}>
          <option value="">下游构件</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}（{c.kind}）
            </option>
          ))}
        </select>
        <button onClick={addEdge} className="primary">
          连边
        </button>
      </div>
    </section>
  );
}
