export type Kind = "梁架" | "柱网" | "斗拱";
export type Joint = "燕尾榫" | "透榫" | "半榫" | "箍头榫" | "直榫" | "斗口榫";
export type Status = "registered" | "queued" | "processing" | "rescued";

export interface Surveyor {
  id: string;
  name: string;
}

export interface Rec {
  level: "正常" | "监测" | "支撑" | "立即支顶";
  text: string;
  valid: boolean;
  issuedAt: number;
  basis: { deformation: number; disease: string; joint: string };
}

export interface Marker {
  x: number; // 百分比 0-100（建筑立面图）
  y: number;
}

export interface ComponentRec {
  id: string;
  buildingId: string;
  code: string;
  kind: Kind;
  species: string; // 木材种类
  joint: Joint | ""; // 榫卯类型
  section: string; // 截面尺寸
  disease: string; // 病害位置
  deformation: number; // 变形（初次登记值 mm）
  retest: number; // 复测值 mm
  dirty: boolean; // 复测值变更、待重新核对
  status: Status;
  version: number;
  rec?: Rec;
  marker: Marker;
  supportId?: string; // 占用的临时支撑位
  lockedBy?: string; // 处理中的测绘员
  lockedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Edge {
  id: string;
  buildingId: string;
  from: string; // 上游构件（传力起点）
  to: string; // 下游构件（传力终点）
  label: string;
}

export interface Support {
  id: string;
  buildingId: string;
  code: string;
  capacity: number;
  occupied: string[]; // 占用构件 id
}

export interface Building {
  id: string;
  name: string;
  era: string;
}

export interface VersionEntry {
  id: string;
  componentId: string;
  version: number;
  at: number;
  by: string;
  action: string;
  summary: string;
  snapshot: ComponentRec;
}

export interface ConflictEntry {
  id: string;
  at: number;
  kind: "component" | "support" | "processing";
  componentId?: string;
  componentCode?: string;
  supportCode?: string;
  by: string; // 后到者
  winnerBy: string; // 先到者
  detail: string;
  kept: string; // 后到者保留的现场值
}

export interface DraftEntry {
  id: string;
  surveyorId: string;
  componentId: string;
  startedAt: number;
  note: string;
}

export interface PersistState {
  buildings: Building[];
  components: ComponentRec[];
  edges: Edge[];
  supports: Support[];
  versions: VersionEntry[];
  conflicts: ConflictEntry[];
  drafts: DraftEntry[];
  surveyors: Surveyor[];
  currentSurveyorId: string;
  selectedBuildingId: string;
}
