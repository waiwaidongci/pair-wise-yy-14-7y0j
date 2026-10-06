// 抢护台领域模型：登记信息、传力关系、复测版本、支撑位与并发冲突

export type ComponentKind = "column" | "beam" | "bracket";

export const KIND_LABEL: Record<ComponentKind, string> = {
  column: "柱网",
  beam: "梁架",
  bracket: "斗拱",
};

export type Mortise = "燕尾榫" | "透榫" | "半榫" | "箍头榫" | "管脚榫" | "斗口榫";

export const MORTISES: Mortise[] = ["燕尾榫", "透榫", "半榫", "箍头榫", "管脚榫", "斗口榫"];
export const WOODS = ["楠木", "松木", "杉木", "榆木", "柏木", "樟木"];
export type Severity = "none" | "minor" | "severe";

export const SEVERITY_LABEL: Record<Severity, string> = {
  none: "完好",
  minor: "轻微",
  severe: "严重",
};

export type DiseaseTag = "decay" | "crack" | "deform" | "loose" | "moist" | "none";

export const DISEASE_LABEL: Record<DiseaseTag, string> = {
  decay: "糟朽",
  crack: "开裂",
  deform: "变形",
  loose: "榫卯松动",
  moist: "受潮",
  none: "无",
};

export type Status = "unverified" | "waiting" | "processing" | "done";

export const STATUS_LABEL: Record<Status, string> = {
  unverified: "待核对",
  waiting: "候队",
  processing: "处理中",
  done: "已修缮",
};

/** 一次核对（复测确认）封存的建议版本 */
export interface SuggestionVersion {
  version: number;
  createdAt: number;
  surveyor: string;
  /** 封存时的复测值签名，改动即失效 */
  measureHash: string;
  advice: string;
  diseases: DiseaseTag[];
  severity: Severity;
  /** 复核前的复测形变 mm（留档） */
  reDeflection: number;
}

export interface ComponentNode {
  id: string;
  buildingId: string;
  /** 构件编号，如 L-A-03 */
  code: string;
  kind: ComponentKind;
  wood: string;
  mortise: Mortise;
  /** 截面宽 mm */
  width: number;
  /** 截面高 mm */
  height: number;
  diseaseLocation: string;
  /** 初始（登记）形变 mm */
  deflection: number;
  /** 最近一次复测形变 mm */
  reDeflection: number;
  /** 复测截面尺寸 */
  reWidth: number;
  reHeight: number;
  /** 传力方向上的下游构件 id（本构件把荷载传给谁） */
  downIds: string[];
  status: Status;
  /** 已核对封存的当前建议版本；复测值变动后置空表示失效 */
  currentVersion: SuggestionVersion | null;
  history: SuggestionVersion[];
  /** 处理人（支撑位占用者） */
  lockedBy: string | null;
  lockedAt: number | null;
  assignedSlot: number | null;
}

export interface Building {
  id: string;
  name: string;
  /** 临时支撑位容量 */
  slotCount: number;
  /** 候选支撑位 */
  slots: number[];
}

export type ConflictKind = "component" | "slot";

export interface Conflict {
  id: string;
  kind: ConflictKind;
  at: number;
  buildingId: string;
  componentId: string;
  componentCode: string;
  slot: number;
  surveyor: string;
  winner: string;
  /** 后到者现场填写的表单值，予以保留 */
  onSite: {
    reDeflection: number;
    reWidth: number;
    reHeight: number;
  };
}

export interface AppState {
  buildings: Building[];
  components: ComponentNode[];
  conflicts: Conflict[];
  seq: number;
}
