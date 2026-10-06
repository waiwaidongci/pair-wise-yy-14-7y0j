import { useSyncExternalStore } from "react";
import type {
  AppState,
  ComponentNode,
  Conflict,
  Mortise,
  Status,
} from "./types";
import {
  deriveDiseases,
  isStale,
  measureSignature,
  sealVersion,
  uid,
} from "./engine";
import { createSeed } from "./seed";

const STORAGE_KEY = "hxyfront-62013-rescue-v1";
const SURVEYOR_KEY = "hxyfront-62013-surveyor";
const CHANNEL = "hxyfront-62013-rescue";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* 损坏则回落到种子 */
  }
  return createSeed();
}

let state: AppState = load();
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(CHANNEL);
} catch {
  channel = null;
}

const listeners = new Set<() => void>();
function emit(local: boolean) {
  if (local) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    channel?.postMessage({ type: "state", state });
  }
  listeners.forEach((l) => l());
}

// 其他标签页的写入直接到达
channel?.addEventListener("message", (e: MessageEvent) => {
  if (e.data?.type === "state" && e.data.state) {
    state = e.data.state as AppState;
    emit(false);
  }
});
// 兜底：其他文档（同域）localStorage 变更
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try {
      state = JSON.parse(e.newValue) as AppState;
      emit(false);
    } catch {
      /* ignore */
    }
  }
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getSurveyor(): string {
  return localStorage.getItem(SURVEYOR_KEY) ?? "测绘员甲";
}
export function setSurveyor(name: string) {
  localStorage.setItem(SURVEYOR_KEY, name);
  listeners.forEach((l) => l());
}
export function useSurveyor(): string {
  return useSyncExternalStore(
    (l) => {
      const h = () => l();
      window.addEventListener("storage", h);
      return () => window.removeEventListener("storage", h);
    },
    getSurveyor,
    getSurveyor,
  );
}

function mutate(next: AppState) {
  state = next;
  emit(true);
}

function patchComponent(
  prev: AppState,
  id: string,
  fn: (c: ComponentNode) => ComponentNode,
): AppState {
  return { ...prev, components: prev.components.map((c) => (c.id === id ? fn(c) : c)) };
}

export interface RegisterInput {
  buildingId: string;
  code: string;
  kind: ComponentNode["kind"];
  wood: string;
  mortise: Mortise;
  width: number;
  height: number;
  diseaseLocation: string;
  deflection: number;
  downIds: string[];
}

/** 新登记构件，处于待核对状态 */
export function registerComponent(input: RegisterInput) {
  const seq = state.seq + 1;
  const c: ComponentNode = {
    id: uid("comp", seq),
    buildingId: input.buildingId,
    code: input.code,
    kind: input.kind,
    wood: input.wood,
    mortise: input.mortise,
    width: input.width,
    height: input.height,
    diseaseLocation: input.diseaseLocation,
    deflection: input.deflection,
    reDeflection: input.deflection,
    reWidth: input.width,
    reHeight: input.height,
    downIds: input.downIds,
    status: "unverified",
    currentVersion: null,
    history: [],
    lockedBy: null,
    lockedAt: null,
    assignedSlot: null,
  };
  mutate({ ...state, components: [...state.components, c], seq });
}

export interface SurveyPatch {
  reDeflection?: number;
  reWidth?: number;
  reHeight?: number;
  diseaseLocation?: string;
  wood?: string;
  mortise?: Mortise;
}

/**
 * 复测值改动：只改复测数据，已封存建议随即失效（标记 stale），
 * 关系边风险色与病害标记由派生函数自动重算；不直接覆盖历史版本。
 */
export function saveSurvey(id: string, patch: SurveyPatch) {
  mutate(
    patchComponent(state, id, (c) => ({
      ...c,
      ...patch,
    })),
  );
}

export interface VerifyResult {
  ok: boolean;
  conflict?: Conflict;
}

/**
 * 重新核对：按当前复测值封存新版本，构件回到抢护队列（候队）。
 */
export function verifyComponent(id: string, surveyor: string): VerifyResult {
  const target = state.components.find((c) => c.id === id);
  if (!target) return { ok: false };
  const at = Date.now();
  const version = sealVersion(
    {
      ...target,
      reDeflection: target.reDeflection,
      reWidth: target.reWidth,
      reHeight: target.reHeight,
    },
    surveyor,
    at,
  );
  const next = patchComponent(state, id, (c) => ({
    ...c,
    currentVersion: version,
    history: [...c.history, version],
    // 已在处理中的保持占位；其余回到候队
    status: c.status === "processing" ? "processing" : ("waiting" as Status),
  }));
  mutate(next);
  return { ok: true };
}

export interface ClaimResult {
  ok: boolean;
  conflict?: Conflict;
}

/**
 * 开工占位：两人并发处理同一构件或同一支撑位时，先到者生效，
 * 后到者保留现场值并看到冲突记录。
 */
export function claimComponent(
  id: string,
  surveyor: string,
  onSite: { reDeflection: number; reWidth: number; reHeight: number },
): ClaimResult {
  const target = state.components.find((c) => c.id === id);
  if (!target) return { ok: false };
  if (target.lockedBy && target.lockedBy !== surveyor) {
    const conflict = recordConflict("component", target, surveyor, target.lockedBy, target.assignedSlot ?? 0, onSite);
    return { ok: false, conflict };
  }
  if (target.lockedBy === surveyor) return { ok: true };

  const capacity =
    state.buildings.find((b) => b.id === target.buildingId)?.slotCount ?? 0;
  const busy = new Map<number, string>();
  state.components
    .filter((c) => c.status === "processing" && c.assignedSlot != null)
    .forEach((c) => busy.set(c.assignedSlot!, c.lockedBy ?? "?"));
  if (busy.size >= capacity) {
    return { ok: false };
  }
  const freeSlot = Array.from({ length: capacity }, (_, i) => i + 1).find(
    (s) => !busy.has(s),
  )!;

  const next = patchComponent(state, id, (c) => ({
    ...c,
    status: "processing",
    lockedBy: surveyor,
    lockedAt: Date.now(),
    assignedSlot: freeSlot,
  }));
  mutate(next);
  return { ok: true };
}

/** 完成修缮：释放支撑位，后续候队者按优先级补位 */
export function completeComponent(id: string, surveyor: string): ClaimResult {
  const target = state.components.find((c) => c.id === id);
  if (!target) return { ok: false };
  if (target.lockedBy && target.lockedBy !== surveyor) {
    const conflict = recordConflict(
      "component",
      target,
      surveyor,
      target.lockedBy,
      target.assignedSlot ?? 0,
      {
        reDeflection: target.reDeflection,
        reWidth: target.reWidth,
        reHeight: target.reHeight,
      },
    );
    return { ok: false, conflict };
  }
  const next = patchComponent(state, id, (c) => ({
    ...c,
    status: "done",
    lockedBy: null,
    lockedAt: null,
    assignedSlot: null,
  }));
  mutate(next);
  return { ok: true };
}

/** 释放（中途退出）：构件回到候队，支撑位释放 */
export function releaseComponent(id: string, surveyor: string) {
  const target = state.components.find((c) => c.id === id);
  if (!target) return;
  if (target.lockedBy && target.lockedBy !== surveyor) {
    recordConflict(
      "component",
      target,
      surveyor,
      target.lockedBy,
      target.assignedSlot ?? 0,
      { reDeflection: target.reDeflection, reWidth: target.reWidth, reHeight: target.reHeight },
    );
    return;
  }
  mutate(
    patchComponent(state, id, (c) => ({
      ...c,
      status: "waiting",
      lockedBy: null,
      lockedAt: null,
      assignedSlot: null,
    })),
  );
}

/**
 * 抢占指定支撑位（支撑位并发）：若该支撑位已被他人占用，后到者失败并留冲突，
 * 现场表单值保留不入库。
 */
export function claimSlot(
  id: string,
  slot: number,
  surveyor: string,
  onSite: { reDeflection: number; reWidth: number; reHeight: number },
): ClaimResult {
  const target = state.components.find((c) => c.id === id);
  if (!target) return { ok: false };
  const holder = state.components.find(
    (c) =>
      c.buildingId === target.buildingId &&
      c.status === "processing" &&
      c.assignedSlot === slot,
  );
  if (holder && holder.lockedBy !== surveyor) {
    const conflict = recordConflict("slot", target, surveyor, holder.lockedBy ?? "?", slot, onSite);
    return { ok: false, conflict };
  }
  if (target.lockedBy && target.lockedBy !== surveyor) {
    const conflict = recordConflict("component", target, surveyor, target.lockedBy, slot, onSite);
    return { ok: false, conflict };
  }
  const capacity =
    state.buildings.find((b) => b.id === target.buildingId)?.slotCount ?? 0;
  if (slot < 1 || slot > capacity) return { ok: false };

  mutate(
    patchComponent(state, id, (c) => ({
      ...c,
      status: "processing",
      lockedBy: surveyor,
      lockedAt: Date.now(),
      assignedSlot: slot,
    })),
  );
  return { ok: true };
}

function recordConflict(
  kind: Conflict["kind"],
  target: ComponentNode,
  surveyor: string,
  winner: string,
  slot: number,
  onSite: Conflict["onSite"],
): Conflict {
  const seq = state.seq + 1;
  const conflict: Conflict = {
    id: uid("conflict", seq),
    kind,
    at: Date.now(),
    buildingId: target.buildingId,
    componentId: target.id,
    componentCode: target.code,
    slot,
    surveyor,
    winner,
    onSite,
  };
  state = { ...state, conflicts: [conflict, ...state.conflicts], seq };
  emit(true);
  return conflict;
}

export function dismissConflict(id: string) {
  mutate({ ...state, conflicts: state.conflicts.filter((c) => c.id !== id) });
}

export function resetAll() {
  mutate(createSeed());
}

export { deriveDiseases, isStale, measureSignature };
