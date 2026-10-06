import type { ComponentRec, Edge, Rec } from "./types";

/** 病害程度（按复测变形量分级） */
export function severityOf(deformation: number): "轻微" | "中等" | "严重" {
  if (deformation >= 15) return "严重";
  if (deformation >= 6) return "中等";
  return "轻微";
}

/** 病害程度配色 */
export const SEVERITY_COLOR: Record<"轻微" | "中等" | "严重", string> = {
  轻微: "#0f766e",
  中等: "#b45309",
  严重: "#b91c1c",
};

/**
 * 修缮建议规则：依据复测值、病害位置、榫卯类型生成。
 * 任一项复测值变动后，调用方需将 rec.valid 置为 false；重新核对后重算。
 */
export function recFor(c: ComponentRec): Rec {
  const d = c.retest;
  const disease = c.disease;
  const critical = /柱脚|糟朽|开裂|劈裂/.test(disease);
  let level: Rec["level"];
  let text: string;
  if (d >= 15 || (critical && d >= 10)) {
    level = "立即支顶";
    text = "变形超限且病害位于关键受力部位，建议立即支顶、卸载并更换受损构件";
  } else if (d >= 6 || critical || /歪闪|变形/.test(disease)) {
    level = "支撑";
    text = "建议增设临时支撑限制变形发展，待复测稳定后择期更换构件";
  } else if (d > 0) {
    level = "监测";
    text = "变形在允许范围内，建议继续监测并加密复测频次";
  } else {
    level = "正常";
    text = "构件状态良好，按常规巡检养护";
  }
  return {
    level,
    text,
    valid: true,
    issuedAt: Date.now(),
    basis: { deformation: d, disease, joint: c.joint },
  };
}

/** 沿传力边向下游递归（梁架→斗拱→柱网），返回受影响的全部下游构件 id */
export function downstreamOf(edges: Edge[], id: string): string[] {
  const out = new Set<string>();
  const walk = (x: string) => {
    for (const e of edges) {
      if (e.from === x && !out.has(e.to)) {
        out.add(e.to);
        walk(e.to);
      }
    }
  };
  walk(id);
  return [...out];
}

/**
 * 抢护优先级：按变形量与下游构件数占位。
 * 变形分 ×2 + 下游数 ×5，柱网构件额外加权（竖向承重关键）。
 */
export function priorityOf(c: ComponentRec, downstreamCount: number): number {
  return c.retest * 2 + downstreamCount * 5 + (c.kind === "柱网" ? 3 : 0);
}

/** 关系边是否待核对：两端任一构件复测值变更（dirty）即失效重算 */
export function edgeStale(e: Edge, byId: Map<string, ComponentRec>): boolean {
  const a = byId.get(e.from);
  const b = byId.get(e.to);
  return !!a?.dirty || !!b?.dirty;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
