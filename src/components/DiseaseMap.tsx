import type { ComponentNode } from "../domain/types";
import { DISEASE_LABEL, KIND_LABEL } from "../domain/types";
import { deriveDiseases } from "../domain/engine";

interface Mark {
  x: number;
  y: number;
  tag: string;
}

function locate(c: ComponentNode): Mark[] {
  const loc = c.diseaseLocation;
  const marks: Mark[] = [];
  const has = (...ks: string[]) => ks.some((k) => loc.includes(k));

  if (c.kind === "beam") {
    if (has("东端", "东", "梁头", "端部", "榫肩")) marks.push({ x: 60, y: 92, tag: "端部" });
    if (has("西端", "西")) marks.push({ x: 380, y: 92, tag: "端部" });
    if (has("跨中", "垂弯", "弯曲")) marks.push({ x: 220, y: 92, tag: "跨中" });
    if (has("受潮", "潮")) marks.push({ x: 150, y: 80, tag: "受潮" });
  } else if (c.kind === "bracket") {
    if (has("栌斗")) marks.push({ x: 220, y: 130, tag: "栌斗" });
    if (has("耍头")) marks.push({ x: 220, y: 70, tag: "耍头" });
    if (has("翘")) marks.push({ x: 150, y: 100, tag: "翘件" });
    if (has("交互")) marks.push({ x: 290, y: 96, tag: "交互枨" });
    if (has("散斗")) marks.push({ x: 150, y: 66, tag: "散斗" });
  } else {
    if (has("柱脚")) marks.push({ x: 220, y: 150, tag: "柱脚" });
    if (has("柱身", "倾斜")) marks.push({ x: 220, y: 100, tag: "柱身" });
    if (has("柱顶", "榫卯", "顶")) marks.push({ x: 220, y: 52, tag: "柱顶" });
  }
  if (marks.length === 0 && c.reDeflection > 0) {
    marks.push(c.kind === "beam" ? { x: 220, y: 92, tag: "变形点" } : { x: 220, y: 96, tag: "变形点" });
  }
  return marks;
}

export default function DiseaseMap({ component }: { component: ComponentNode }) {
  const marks = locate(component);
  const { diseases, severity } = deriveDiseases(component);
  const fill = severity === "severe" ? "#7c2d12" : severity === "minor" ? "#a16207" : "#78716c";
  const markerFill = severity === "severe" ? "#dc2626" : "#d97706";

  return (
    <div className="disease-map">
      <svg viewBox="0 0 440 200">
        {component.kind === "beam" && (
          <>
            <rect x={50} y={74} width={340} height={36} rx={4} fill={fill} opacity={0.85} />
            <rect x={50} y={74} width={26} height={36} fill="#44403c" opacity={0.7} />
            <rect x={364} y={74} width={26} height={36} fill="#44403c" opacity={0.7} />
            <text x={220} y={98} textAnchor="middle" className="dm-label">{KIND_LABEL[component.kind]}示意</text>
          </>
        )}
        {component.kind === "column" && (
          <>
            <rect x={206} y={36} width={28} height={132} rx={3} fill={fill} opacity={0.85} />
            <rect x={180} y={168} width={80} height={12} rx={2} fill="#44403c" opacity={0.7} />
            <line x1={220} y1={40} x2={220 + component.reDeflection} y2={166} stroke="#dc2626" strokeDasharray="4 3" />
            <text x={250} y={104} className="dm-label">倾斜 {component.reDeflection}mm</text>
          </>
        )}
        {component.kind === "bracket" && (
          <>
            <rect x={150} y={120} width={140} height={20} fill={fill} opacity={0.85} />
            <rect x={176} y={92} width={88} height={18} fill={fill} opacity={0.8} />
            <rect x={202} y={62} width={36} height={22} fill={fill} opacity={0.8} />
            <rect x={196} y={40} width={48} height={16} fill={fill} opacity={0.75} />
            <rect x={140} y={148} width={160} height={12} fill="#44403c" opacity={0.7} />
          </>
        )}

        {marks.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r={9} fill={markerFill} opacity={0.25}>
              <animate attributeName="r" values="8;13;8" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={m.x} cy={m.y} r={5} fill={markerFill} />
            <text x={m.x} y={m.y - 14} textAnchor="middle" className="dm-mark">{m.tag}</text>
          </g>
        ))}
      </svg>
      <div className="disease-tags">
        {diseases.map((d) => (
          <span key={d} className={`tag tag-${d} ${severity === "severe" ? "tag-severe" : ""}`}>
            {DISEASE_LABEL[d]}
          </span>
        ))}
      </div>
    </div>
  );
}
