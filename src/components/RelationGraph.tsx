import type { AppState, ComponentNode } from "../domain/types";
import { KIND_LABEL } from "../domain/types";
import { deriveDiseases, downstreamCount } from "../domain/engine";

const ROW_Y: Record<ComponentNode["kind"], number> = {
  beam: 70,
  bracket: 210,
  column: 350,
};

const KIND_COLOR: Record<ComponentNode["kind"], string> = {
  beam: "#854d0e",
  bracket: "#0f766e",
  column: "#475569",
};

function layout(nodes: ComponentNode[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const groups: Record<ComponentNode["kind"], ComponentNode[]> = {
    beam: [],
    bracket: [],
    column: [],
  };
  nodes.forEach((n) => groups[n.kind].push(n));
  const W = 760;
  (Object.keys(groups) as ComponentNode["kind"][]).forEach((k) => {
    groups[k].forEach((n, i) => {
      const x = ((i + 1) * W) / (groups[k].length + 1);
      pos.set(n.id, { x, y: ROW_Y[k] });
    });
  });
  return pos;
}

function edgeStyle(up: ComponentNode, down: ComponentNode) {
  const s = [up, down].map((c) => deriveDiseases(c).severity);
  if (s.includes("severe")) return { stroke: "#dc2626", width: 2.6, dash: "none" };
  if (s.includes("minor")) return { stroke: "#d97706", width: 2, dash: "none" };
  return { stroke: "#94a3b8", width: 1.4, dash: "5 4" };
}

interface Props {
  state: AppState;
  buildingId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function RelationGraph({ state, buildingId, selectedId, onSelect }: Props) {
  const nodes = state.components.filter((c) => c.buildingId === buildingId);
  const pos = layout(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="graph-wrap">
      <svg viewBox="0 0 760 420" className="graph">
        <defs>
          <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.2" orient="auto">
            <path d="M0,0 L7,3.2 L0,6.4 Z" fill="#64748b" />
          </marker>
        </defs>

        {(["beam", "bracket", "column"] as const).map((k) => (
          <g key={k}>
            <text x={14} y={ROW_Y[k] - 34} className="graph-rowlabel">
              {KIND_LABEL[k]}（荷载向下游传递）
            </text>
            <line x1={14} y1={ROW_Y[k] - 26} x2={746} y2={ROW_Y[k] - 26} className="graph-rowline" />
          </g>
        ))}

        {nodes.map((n) =>
          n.downIds.map((did) => {
            if (!byId.has(did)) return null;
            const a = pos.get(n.id)!;
            const b = pos.get(did)!;
            const st = edgeStyle(n, byId.get(did)!);
            const midY = (a.y + b.y) / 2;
            return (
              <path
                key={`${n.id}-${did}`}
                d={`M${a.x},${a.y + 22} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y - 24}`}
                fill="none"
                stroke={st.stroke}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                markerEnd="url(#arrow)"
              />
            );
          }),
        )}

        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const { severity } = deriveDiseases(n);
          const selected = n.id === selectedId;
          const downstream = downstreamCount(n.id, state.components);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className="graph-node"
              onClick={() => onSelect(n.id)}
            >
              <rect
                x={-62}
                y={-22}
                width={124}
                height={46}
                rx={8}
                fill="#fff"
                stroke={severity === "severe" ? "#dc2626" : severity === "minor" ? "#d97706" : KIND_COLOR[n.kind]}
                strokeWidth={selected ? 3 : 1.6}
              />
              <text x={0} y={-5} textAnchor="middle" className="graph-code">
                {n.code.split(" ").slice(-1)[0]}
              </text>
              <text x={0} y={13} textAnchor="middle" className="graph-sub">
                下游{downstream} · {n.reDeflection}mm
              </text>
              {severity !== "none" && (
                <circle
                  cx={54}
                  cy={-14}
                  r={7}
                  fill={severity === "severe" ? "#dc2626" : "#d97706"}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="graph-legend">
        <span><i className="dot dot-severe" />严重病害边/点</span>
        <span><i className="dot dot-minor" />轻微病害</span>
        <span><i className="dot dot-ok" />完好</span>
        <span className="legend-hint">箭头＝传力方向（梁架→斗拱→柱网）；复测值改动后边色与标记自动重算</span>
      </div>
    </div>
  );
}
