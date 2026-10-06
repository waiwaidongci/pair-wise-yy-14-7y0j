import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  ComponentRec,
  ConflictEntry,
  DraftEntry,
  Edge,
  PersistState,
  Rec,
  Support,
  VersionEntry,
} from "./types";
import { downstreamOf, priorityOf, recFor } from "./engine";

const STORAGE_KEY = "gujian-rescue-desk:v1";

let seq = 0;
function rid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}-${Date.now().toString(36)}`;
}
const now = () => Date.now();

// ---------------------------------------------------------------------------
// 初始数据：一座古建大院 + 一座偏殿，构件覆盖梁架 / 斗拱 / 柱网三类
// ---------------------------------------------------------------------------
function seed(): PersistState {
  const t = now();
  const surveyors = [
    { id: "s1", name: "测绘员·甲" },
    { id: "s2", name: "测绘员·乙" },
  ];
  const mk = (
    id: string,
    buildingId: string,
    code: string,
    kind: ComponentRec["kind"],
    species: string,
    joint: ComponentRec["joint"],
    section: string,
    disease: string,
    deformation: number,
    retest: number,
    mx: number,
    my: number
  ): ComponentRec => ({
    id,
    buildingId,
    code,
    kind,
    species,
    joint,
    section,
    disease,
    deformation,
    retest,
    dirty: false,
    status: "queued",
    version: 1,
    rec: { ...recFor({ retest, disease, joint } as ComponentRec), issuedAt: t },
    marker: { x: mx, y: my },
    createdAt: t,
    updatedAt: t,
  });

  const components: ComponentRec[] = [
    mk("c1", "b1", "梁架A-01", "梁架", "杉木", "燕尾榫", "200×280mm", "梁端开裂", 8, 8.2, 22, 28),
    mk("c2", "b1", "梁架A-03", "梁架", "杉木", "透榫", "180×240mm", "梁端开裂", 12, 12.4, 78, 26),
    mk("c3", "b1", "斗拱D-07", "斗拱", "楠木", "半榫", "120×120mm", "斗拱歪闪", 4, 4.1, 22, 46),
    mk("c4", "b1", "斗拱D-09", "斗拱", "杉木", "燕尾榫", "140×140mm", "斗拱变形", 10, 10.6, 78, 44),
    mk("c5", "b1", "柱网C-05", "柱网", "楠木", "箍头榫", "φ200mm", "柱脚糟朽", 6, 6.3, 22, 80),
    mk("c6", "b1", "柱网C-12", "柱网", "楠木", "半榫", "φ220mm", "柱脚糟朽", 18, 18.5, 78, 82),
    mk("c7", "b2", "梁架B-02", "梁架", "杉木", "透榫", "180×240mm", "梁头劈裂", 5, 5.1, 50, 30),
    mk("c8", "b2", "柱网C-08", "柱网", "楠木", "直榫", "φ200mm", "柱身倾斜", 9, 9.4, 50, 78),
  ];

  const edges: Edge[] = [
    { id: "e1", buildingId: "b1", from: "c1", to: "c3", label: "斗拱传力" },
    { id: "e2", buildingId: "b1", from: "c2", to: "c4", label: "斗拱传力" },
    { id: "e3", buildingId: "b1", from: "c3", to: "c5", label: "柱网传力" },
    { id: "e4", buildingId: "b1", from: "c4", to: "c6", label: "柱网传力" },
    { id: "e5", buildingId: "b1", from: "c2", to: "c6", label: "梁架直接传力" },
    { id: "e6", buildingId: "b2", from: "c7", to: "c8", label: "梁架传力" },
  ];

  const supports: Support[] = [
    { id: "sup1", buildingId: "b1", code: "ZL-01", capacity: 2, occupied: [] },
    { id: "sup2", buildingId: "b1", code: "ZL-02", capacity: 2, occupied: [] },
    { id: "sup3", buildingId: "b2", code: "ZL-01", capacity: 2, occupied: [] },
  ];

  const versions: VersionEntry[] = components.map((c) => ({
    id: rid("v"),
    componentId: c.id,
    version: 1,
    at: t,
    by: "测绘员·甲",
    action: "登记",
    summary: `登记 ${c.code}：${c.species}·${c.joint || "未填榫型"}·${c.section}·${c.disease}`,
    snapshot: { ...c },
  }));

  const drafts: DraftEntry[] = [
    {
      id: "d1",
      surveyorId: "s2",
      componentId: "c5",
      startedAt: t - 3600_000,
      note: "柱脚糟朽范围待量测，墩接高度待确认",
    },
  ];

  return {
    buildings: [
      { id: "b1", name: "普宁寺·大乘阁", era: "清代乾隆年间" },
      { id: "b2", name: "古建二号院·正殿", era: "明代" },
    ],
    components,
    edges,
    supports,
    versions,
    conflicts: [],
    drafts,
    surveyors,
    currentSurveyorId: "s1",
    selectedBuildingId: "b1",
  };
}

// ---------------------------------------------------------------------------
// 队列重算：按变形 + 下游构件数占位，容量不足排队等候
// ---------------------------------------------------------------------------
function reconcile(state: PersistState): PersistState {
  const components = state.components.map((c) => ({ ...c }));
  const supports: Support[] = state.supports.map((s) => ({ ...s, occupied: [] }));

  for (const b of state.buildings) {
    const pool = components
      .filter(
        (c) =>
          c.buildingId === b.id &&
          !c.dirty && // 复测值变更待核对的构件不占位，重新核对后才回到队列
          (c.status === "queued" || c.status === "registered")
      )
      .map((c) => {
        const down = downstreamOf(state.edges, c.id).length;
        return { c, score: priorityOf(c, down) };
      })
      .sort((a, z) => z.score - a.score);

    for (const item of pool) {
      const free = supports.find(
        (s) => s.buildingId === b.id && s.occupied.length < s.capacity
      );
      if (free) {
        item.c.supportId = free.id;
        free.occupied.push(item.c.id);
      } else {
        item.c.supportId = undefined;
      }
      if (item.c.status === "registered") item.c.status = "queued";
    }

    // 处理中的构件保留其占位；已抢护 / 待核对的构件释放占位
    for (const c of components) {
      if (c.buildingId !== b.id) continue;
      if (c.status === "processing" && c.supportId) {
        const sup = supports.find((s) => s.id === c.supportId);
        if (sup && !sup.occupied.includes(c.id)) sup.occupied.push(c.id);
      } else if (c.dirty || c.status === "rescued") {
        c.supportId = undefined;
      }
    }
  }

  return { ...state, components, supports };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export interface FormValues {
  code: string;
  kind: ComponentRec["kind"];
  species: string;
  joint: ComponentRec["joint"];
  section: string;
  disease: string;
  deformation: number;
  retest: number;
  marker: { x: number; y: number };
}

type Action =
  | { type: "ADD_COMPONENT"; buildingId: string; values: FormValues }
  | { type: "UPDATE_COMPONENT"; id: string; baseVersion: number; patch: Partial<ComponentRec>; summary: string }
  | { type: "RETEST"; id: string; baseVersion: number; retest: number }
  | { type: "REVERIFY"; id: string }
  | { type: "START_PROCESSING"; id: string; baseVersion: number }
  | { type: "FINISH_PROCESSING"; id: string }
  | { type: "RELEASE_PROCESSING"; id: string }
  | { type: "SAVE_DRAFT"; surveyorId: string; componentId: string; note: string }
  | { type: "DISCARD_DRAFT"; id: string }
  | { type: "RESTORE_VERSION"; versionId: string }
  | { type: "SIMULATE_CONCURRENT"; id: string }
  | { type: "SIMULATE_SUPPORT_CONCURRENT"; supportId: string }
  | { type: "SWITCH_SURVEYOR"; id: string }
  | { type: "SELECT_BUILDING"; id: string }
  | { type: "ADD_BUILDING"; name: string }
  | { type: "ADD_EDGE"; from: string; to: string; label: string }
  | { type: "ADD_SUPPORT"; buildingId: string; code: string; capacity: number }
  | { type: "DISMISS_CONFLICT"; id: string }
  | { type: "RESET" };

function currentName(state: PersistState): string {
  return state.surveyors.find((s) => s.id === state.currentSurveyorId)?.name ?? "未知测绘员";
}

function lastEditorName(state: PersistState, componentId: string): string {
  const v = state.versions.find((x) => x.componentId === componentId);
  return v?.by ?? "先到测绘员";
}

function pushVersion(
  state: PersistState,
  c: ComponentRec,
  action: string,
  summary: string
): VersionEntry {
  return {
    id: rid("v"),
    componentId: c.id,
    version: c.version,
    at: now(),
    by: currentName(state),
    action,
    summary,
    snapshot: { ...c },
  };
}

function conflictEntry(
  state: PersistState,
  partial: Omit<ConflictEntry, "id" | "at" | "by" | "winnerBy"> & { winnerBy?: string }
): ConflictEntry {
  return {
    id: rid("cf"),
    at: now(),
    by: currentName(state),
    winnerBy: partial.winnerBy ?? "先到测绘员",
    ...partial,
  };
}

export function reducer(state: PersistState, action: Action): PersistState {
  switch (action.type) {
    case "ADD_COMPONENT": {
      const t = now();
      const c: ComponentRec = {
        id: rid("c"),
        buildingId: action.buildingId,
        code: action.values.code.trim() || "未命名构件",
        kind: action.values.kind,
        species: action.values.species.trim(),
        joint: action.values.joint,
        section: action.values.section.trim(),
        disease: action.values.disease.trim(),
        deformation: action.values.deformation,
        retest: action.values.retest,
        dirty: false,
        status: "registered",
        version: 1,
        rec: { ...recFor({ retest: action.values.retest, disease: action.values.disease, joint: action.values.joint } as ComponentRec), issuedAt: t },
        marker: action.values.marker,
        createdAt: t,
        updatedAt: t,
      };
      const ver = pushVersion(state, c, "登记", `登记 ${c.code}：${c.species}·${c.joint || "未填榫型"}·${c.section}·${c.disease}`);
      return reconcile({ ...state, components: [...state.components, c], versions: [ver, ...state.versions] });
    }

    case "UPDATE_COMPONENT": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c) return state;
      if (c.version !== action.baseVersion) {
        const cf = conflictEntry(state, {
          kind: "component",
          componentId: c.id,
          componentCode: c.code,
          winnerBy: lastEditorName(state, c.id),
          detail: `基于旧版 v${action.baseVersion} 提交，构件当前已被改至 v${c.version}`,
          kept: action.summary,
        });
        return { ...state, conflicts: [cf, ...state.conflicts] };
      }
      const updated: ComponentRec = { ...c, ...action.patch, version: c.version + 1, updatedAt: now() };
      const ver = pushVersion(state, updated, "修改", action.summary);
      return reconcile({
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        versions: [ver, ...state.versions],
      });
    }

    case "RETEST": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c) return state;
      if (c.version !== action.baseVersion) {
        const cf = conflictEntry(state, {
          kind: "component",
          componentId: c.id,
          componentCode: c.code,
          winnerBy: lastEditorName(state, c.id),
          detail: `复测值修改基于旧版 v${action.baseVersion}，构件当前为 v${c.version}`,
          kept: `复测值 ${action.retest}mm（后到者现场值，未写入）`,
        });
        return { ...state, conflicts: [cf, ...state.conflicts] };
      }
      const updated: ComponentRec = {
        ...c,
        retest: action.retest,
        dirty: true,
        status: "registered", // 退出抢护队列，重新核对后再回到队列
        supportId: undefined,
        lockedBy: undefined,
        lockedAt: undefined,
        rec: c.rec ? { ...c.rec, valid: false } : undefined,
        version: c.version + 1,
        updatedAt: now(),
      };
      const ver = pushVersion(
        state,
        updated,
        "复测",
        `复测值 ${c.retest} → ${action.retest}mm，修缮建议失效，关系边与病害标记待重算`
      );
      return reconcile({
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        versions: [ver, ...state.versions],
      });
    }

    case "REVERIFY": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c || c.status === "rescued") return state;
      const rec: Rec = { ...recFor(c), valid: true, issuedAt: now() };
      const updated: ComponentRec = {
        ...c,
        dirty: false,
        rec,
        status: "registered",
        version: c.version + 1,
        updatedAt: now(),
      };
      const ver = pushVersion(state, updated, "核对", `重新核对完成，建议恢复有效（${rec.level}），回到抢护队列`);
      return reconcile({
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        versions: [ver, ...state.versions],
      });
    }

    case "START_PROCESSING": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c || c.status === "rescued") return state;
      if (c.lockedBy && c.lockedBy !== state.currentSurveyorId) {
        const winner = state.surveyors.find((s) => s.id === c.lockedBy)?.name ?? "先到测绘员";
        const cf = conflictEntry(state, {
          kind: "processing",
          componentId: c.id,
          componentCode: c.code,
          winnerBy: winner,
          detail: `构件正由 ${winner} 处理中（v${c.version} 起锁定）`,
          kept: `继续处理 ${c.code} 的现场作业（未生效）`,
        });
        return { ...state, conflicts: [cf, ...state.conflicts] };
      }
      const updated: ComponentRec = {
        ...c,
        status: "processing",
        lockedBy: state.currentSurveyorId,
        lockedAt: now(),
        version: c.version + 1,
        updatedAt: now(),
      };
      const hasDraft = state.drafts.some(
        (d) => d.surveyorId === state.currentSurveyorId && d.componentId === c.id
      );
      const drafts = hasDraft
        ? state.drafts
        : [
            ...state.drafts,
            {
              id: rid("d"),
              surveyorId: state.currentSurveyorId,
              componentId: c.id,
              startedAt: now(),
              note: "",
            } satisfies DraftEntry,
          ];
      return {
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        drafts,
      };
    }

    case "FINISH_PROCESSING": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c) return state;
      const updated: ComponentRec = {
        ...c,
        status: "rescued",
        lockedBy: undefined,
        lockedAt: undefined,
        supportId: undefined,
        version: c.version + 1,
        updatedAt: now(),
      };
      const ver = pushVersion(state, updated, "完成", `${c.code} 抢护完成，解除临时支撑并释放队列占位`);
      return reconcile({
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        versions: [ver, ...state.versions],
        drafts: state.drafts.filter((d) => d.componentId !== c.id),
      });
    }

    case "RELEASE_PROCESSING": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c) return state;
      const updated: ComponentRec = {
        ...c,
        status: "queued",
        lockedBy: undefined,
        lockedAt: undefined,
        version: c.version + 1,
        updatedAt: now(),
      };
      return {
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
      };
    }

    case "SAVE_DRAFT": {
      const exists = state.drafts.some(
        (d) => d.surveyorId === action.surveyorId && d.componentId === action.componentId
      );
      const drafts = exists
        ? state.drafts.map((d) =>
            d.surveyorId === action.surveyorId && d.componentId === action.componentId
              ? { ...d, note: action.note }
              : d
          )
        : [
            ...state.drafts,
            {
              id: rid("d"),
              surveyorId: action.surveyorId,
              componentId: action.componentId,
              startedAt: now(),
              note: action.note,
            } satisfies DraftEntry,
          ];
      return { ...state, drafts };
    }

    case "DISCARD_DRAFT":
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id) };

    case "RESTORE_VERSION": {
      const v = state.versions.find((x) => x.id === action.versionId);
      if (!v) return state;
      const c = state.components.find((x) => x.id === v.componentId);
      if (!c) return state;
      const snap = v.snapshot;
      const updated: ComponentRec = {
        ...snap,
        id: c.id,
        buildingId: c.buildingId,
        version: c.version + 1,
        createdAt: c.createdAt,
        updatedAt: now(),
        // 恢复旧值后需重新核对
        dirty: true,
        status: "registered",
        supportId: undefined,
        lockedBy: undefined,
        lockedAt: undefined,
        rec: c.rec ? { ...c.rec, valid: false } : undefined,
      };
      const ver = pushVersion(state, updated, "恢复", `恢复到 v${v.version}（${v.summary}），建议失效待重新核对`);
      return reconcile({
        ...state,
        components: state.components.map((x) => (x.id === c.id ? updated : x)),
        versions: [ver, ...state.versions],
      });
    }

    case "SIMULATE_CONCURRENT": {
      const c = state.components.find((x) => x.id === action.id);
      if (!c) return state;
      const other = state.surveyors.find((s) => s.id !== state.currentSurveyorId) ?? state.surveyors[0];
      const winner = lastEditorName(state, c.id);
      const cf: ConflictEntry = {
        id: rid("cf"),
        at: now(),
        kind: "component",
        componentId: c.id,
        componentCode: c.code,
        by: other.name,
        winnerBy: winner,
        detail: `${other.name} 与 ${winner} 同时提交（base v${Math.max(1, c.version - 1)}），先到者写入 v${c.version}`,
        kept: `复测值 ${(c.retest + 0.8).toFixed(1)}mm（后到者现场值，未写入）`,
      };
      return { ...state, conflicts: [cf, ...state.conflicts] };
    }

    case "SIMULATE_SUPPORT_CONCURRENT": {
      const sup = state.supports.find((s) => s.id === action.supportId);
      if (!sup) return state;
      const me = currentName(state);
      const cf: ConflictEntry = {
        id: rid("cf"),
        at: now(),
        kind: "support",
        supportCode: sup.code,
        by: me,
        winnerBy: "系统占位",
        detail: `${sup.code} 容量 ${sup.capacity} 已被先到构件占满，占位请求基于旧版提交`,
        kept: `选择支撑位 ${sup.code}（后到者现场值，未生效）`,
      };
      return { ...state, conflicts: [cf, ...state.conflicts] };
    }

    case "SWITCH_SURVEYOR":
      return { ...state, currentSurveyorId: action.id };

    case "SELECT_BUILDING":
      return { ...state, selectedBuildingId: action.id };

    case "ADD_BUILDING": {
      const b = { id: rid("b"), name: action.name.trim() || "未命名建筑", era: "清代" };
      return { ...state, buildings: [...state.buildings, b], selectedBuildingId: b.id };
    }

    case "ADD_EDGE":
      return {
        ...state,
        edges: [
          ...state.edges,
          { id: rid("e"), buildingId: state.components.find((c) => c.id === action.from)?.buildingId ?? state.selectedBuildingId, from: action.from, to: action.to, label: action.label },
        ],
      };

    case "ADD_SUPPORT":
      return {
        ...state,
        supports: [
          ...state.supports,
          { id: rid("sup"), buildingId: action.buildingId, code: action.code.trim() || "ZL-新", capacity: action.capacity, occupied: [] },
        ],
      };

    case "DISMISS_CONFLICT":
      return { ...state, conflicts: state.conflicts.filter((c) => c.id !== action.id) };

    case "RESET":
      localStorage.removeItem(STORAGE_KEY);
      seq = 0;
      return seed();

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 持久化
// ---------------------------------------------------------------------------
export function init(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as PersistState;
      if (data && Array.isArray(data.components) && Array.isArray(data.buildings)) {
        return reconcile(data);
      }
    }
  } catch {
    // 落盘数据损坏时重新开始
  }
  return reconcile(seed());
}

const StoreCtx = createContext<{
  state: PersistState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储不可用时静默降级为内存态
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
