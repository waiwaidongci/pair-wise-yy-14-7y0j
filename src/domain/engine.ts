import type {
  AppState,
  ComponentNode,
  DiseaseTag,
  Severity,
  SuggestionVersion,
} from "./types";

/** 由复测值 + 病害位置 + 榫卯类型生成签名，任一项改动都会让已封存建议失效 */
export function measureSignature(c: ComponentNode): string {
  return [
    c.reWidth,
    c.reHeight,
    Math.round(c.reDeflection * 10) / 10,
    c.diseaseLocation.trim(),
    c.mortise,
    c.wood,
  ].join("|");
}

/** 按规则重新识别病害标记与等级 */
export function deriveDiseases(c: Pick<ComponentNode, "reDeflection" | "diseaseLocation" | "mortise">): {
  diseases: DiseaseTag[];
  severity: Severity;
} {
  const diseases: DiseaseTag[] = [];
  const loc = c.diseaseLocation;
  if (/糟朽|腐朽/.test(loc)) diseases.push("decay");
  if (/裂/.test(loc)) diseases.push("crack");
  if (/潮|霉/.test(loc)) diseases.push("moist");
  if (/松|脱/.test(loc) || c.reDeflection >= 8) diseases.push("loose");
  if (c.reDeflection > 0) diseases.push("deform");

  const severe =
    c.reDeflection >= 20 || diseases.includes("decay") || diseases.length >= 3;
  const minor = c.reDeflection > 0 || diseases.length > 0;
  const severity: Severity = severe ? "severe" : minor ? "minor" : "none";
  return { diseases: diseases.length ? Array.from(new Set(diseases)) : ["none"], severity };
}

/** 依据复测值、病害、截面和榫卯重新生成修缮建议 */
export function deriveAdvice(c: ComponentNode): string {
  const { diseases, severity } = deriveDiseases(c);
  if (severity === "none") return "复测无异常，继续例行监测。";

  const parts: string[] = [];
  if (diseases.includes("decay")) {
    parts.push(
      c.kind === "column" ? "柱脚糟朽：临时支撑卸荷后局部墩接，剔补糟朽段" : "糟朽部位剔补嵌实，糟朽率超 1/4 时更换构件",
    );
  }
  if (diseases.includes("crack")) {
    parts.push(
      `端部开裂：裂缝 ${c.reWidth}×${c.reHeight}mm 截面处用碳纤维布或铁箍加固，注环氧补缝`,
    );
  }
  if (diseases.includes("loose")) {
    parts.push(`${c.mortise}节点回软：加楔背紧，必要时植入暗销`);
  }
  if (diseases.includes("moist")) parts.push("受潮部位通风除湿，做防腐处理后复查含水率");
  if (diseases.includes("deform")) {
    if (c.reDeflection >= 20) parts.push(`残余变形 ${c.reDeflection}mm 超限，须拨正复位并全程应力监测`);
    else if (c.reDeflection >= 8) parts.push(`变形 ${c.reDeflection}mm，设置临时支顶控制发展`);
    else parts.push(`轻微变形 ${c.reDeflection}mm，继续监测`);
  }
  const prefix = severity === "severe" ? "【抢护】" : "【保养】";
  return prefix + parts.join("；") + "。";
}

/** 下游构件数（沿传力方向 BFS，含直接与间接） */
export function downstreamCount(id: string, components: ComponentNode[]): number {
  const byId = new Map(components.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const queue = [...(byId.get(id)?.downIds ?? [])];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    queue.push(...(byId.get(cur)?.downIds ?? []));
  }
  return seen.size;
}

export interface QueueItem {
  component: ComponentNode;
  priority: number;
  downstream: number;
}

/**
 * 抢护队列：支撑位容量不足时先排队等候。
 * 占位优先级 = 变形mm + 下游构件数 * 6 + 严重病害加权 25。
 * 处理中的构件继续占用支撑位；候队按优先级排序，前 promotable 条可开工占位。
 * 复测值改动导致建议失效的候队构件退出队列，重新核对后才回来。
 */
export function computeQueue(state: AppState): {
  processing: QueueItem[];
  waiting: QueueItem[];
  promotable: number;
} {
  const rank = (component: ComponentNode): QueueItem => {
    const downstream = downstreamCount(component.id, state.components);
    const { severity } = deriveDiseases(component);
    const priority =
      component.reDeflection * 1.0 + downstream * 6 + (severity === "severe" ? 25 : 0);
    return { component, priority: Math.round(priority * 10) / 10, downstream };
  };

  const processing = state.components
    .filter((c) => c.status === "processing")
    .map(rank)
    .sort((a, b) => b.priority - a.priority);

  const waiting = state.components
    .filter(
      (c) =>
        c.status === "waiting" &&
        !!c.currentVersion &&
        c.currentVersion.measureHash === measureSignature(c),
    )
    .map(rank)
    .sort((a, b) => b.priority - a.priority);

  const capacity = state.buildings[0]?.slotCount ?? 0;
  return {
    processing,
    waiting,
    promotable: Math.max(0, capacity - processing.length),
  };
}

export function nextVersion(prev: SuggestionVersion | null): number {
  return prev ? prev.version + 1 : 1;
}

export function sealVersion(
  c: ComponentNode,
  surveyor: string,
  at: number,
): SuggestionVersion {
  const derived = deriveDiseases(c);
  return {
    version: nextVersion(c.currentVersion),
    createdAt: at,
    surveyor,
    measureHash: measureSignature(c),
    advice: deriveAdvice(c),
    diseases: derived.diseases,
    severity: derived.severity,
    reDeflection: c.reDeflection,
  };
}

/** 复测值是否相对已封存版本发生变化 */
export function isStale(c: ComponentNode): boolean {
  return !!c.currentVersion && c.currentVersion.measureHash !== measureSignature(c);
}

export function uid(prefix: string, seq: number): string {
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
