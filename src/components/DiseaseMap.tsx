import { useMemo } from "react";
import { useStore } from "../store";
import { severityOf, SEVERITY_COLOR } from "../engine";
import type { ComponentRec } from "../types";

/** 建筑立面病害标记图：复测值变更后标记变虚、待重新核对 */
export function DiseaseMap({ buildingId, onSelect }: { buildingId: string; onSelect?: (id: string) => void }) {
  const { state } = useStore();
  const components = useMemo(
    () => state.components.filter((c) => c.buildingId === buildingId && c.status !== "rescued"),
    [state.components, buildingId]
  );

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>病害标记图</p>
          <h2>立面病害点位</h2>
        </div>
        <div className="legend">
          {(["轻微", "中等", "严重"] as const).map((s) => (
            <span key={s} className="legend-item">
              <span className="dot" style={{ background: SEVERITY_COLOR[s] }} />
              {s}
            </span>
          ))}
          <span className="legend-item">
            <span className="dot stale" />
            虚线 = 复测值变更，待重新核对
          </span>
        </div>
      </div>

      <svg viewBox="0 0 600 380" className="disease-map">
        {/* 台明（地面） */}
        <line x1="0" y1="340" x2="600" y2="340" stroke="#94a3b8" strokeWidth="4" />
        {/* 柱 */}
        {[130, 300, 470].map((x) => (
          <g key={x}>
            <rect x={x - 11} y="150" width="22" height="190" fill="#475569" />
            <rect x={x - 16} y="138" width="32" height="14" rx="2" fill="#334155" />
          </g>
        ))}
        {/* 斗拱 */}
        {[130, 300, 470].map((x) => (
          <g key={`d-${x}`}>
            <rect x={x - 20} y="124" width="40" height="14" rx="2" fill="#0f766e" />
            <rect x={x - 26} y="112" width="52" height="12" rx="2" fill="#115e59" />
          </g>
        ))}
        {/* 梁架 */}
        <rect x="40" y="86" width="520" height="26" rx="3" fill="#854d0e" />
        <rect x="50" y="66" width="500" height="22" rx="3" fill="#a16207" />
        <rect x="60" y="48" width="480" height="18" rx="3" fill="#854d0e" />

        {/* 病害标记 */}
        {components.map((c) => {
          const cx = 40 + (c.marker.x / 100) * 520;
          const cy = 40 + (c.marker.y / 100) * 300;
          const color = SEVERITY_COLOR[severityOf(c.retest)];
          return (
            <g
              key={c.id}
              className="marker"
              onClick={() => onSelect?.(c.id)}
              style={{ cursor: "pointer" }}
            >
              {c.dirty && <circle cx={cx} cy={cy} r="16" fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="4 3" />}
              <circle
                cx={cx}
                cy={cy}
                r="11"
                fill={color}
                stroke="#fff"
                strokeWidth="2.5"
                opacity={c.dirty ? 0.55 : 1}
              />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
                {c.kind[0]}
              </text>
              <text x={cx} cy={cy - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
                {c.code}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="marker-table">
        {components.length === 0 && <p className="empty">暂无病害构件</p>}
        {components.map((c) => (
          <MarkerRow key={c.id} c={c} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function MarkerRow({ c, onSelect }: { c: ComponentRec; onSelect?: (id: string) => void }) {
  const color = SEVERITY_COLOR[severityOf(c.retest)];
  return (
    <button className="marker-row" onClick={() => onSelect?.(c.id)}>
      <span className="dot" style={{ background: color }} />
      <b>{c.code}</b>
      <span>{c.disease}</span>
      <span>
        复测 {c.retest}mm · {severityOf(c.retest)}
      </span>
      {c.dirty && <span className="stale-tag">待核对</span>}
    </button>
  );
}
