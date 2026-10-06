import type { AppState, Building, ComponentNode, Mortise } from "./types";
import { measureSignature, sealVersion } from "./engine";

interface SeedComp {
  code: string;
  kind: ComponentNode["kind"];
  wood: string;
  mortise: Mortise;
  width: number;
  height: number;
  diseaseLocation: string;
  deflection: number;
  reDeflection: number;
  downIds?: string[];
  verified?: boolean;
  surveyor?: string;
}

function makeBuilding(id: string, name: string, slotCount: number): Building {
  return { id, name, slotCount, slots: Array.from({ length: slotCount }, (_, i) => i + 1) };
}

function makeComps(buildingId: string, rows: SeedComp[]): ComponentNode[] {
  const partial = rows.map((r, i) => {
    const id = `${buildingId}-n${i + 1}`;
    return { id, ...r };
  });
  return partial.map((r) => {
    const downIds = (r.downIds ?? []).map((d) => `${buildingId}-${d}`);
    const base: ComponentNode = {
      id: r.id,
      buildingId,
      code: r.code,
      kind: r.kind,
      wood: r.wood,
      mortise: r.mortise,
      width: r.width,
      height: r.height,
      diseaseLocation: r.diseaseLocation,
      deflection: r.deflection,
      reDeflection: r.reDeflection,
      reWidth: r.width,
      reHeight: r.height,
      downIds,
      status: "unverified",
      currentVersion: null,
      history: [],
      lockedBy: null,
      lockedAt: null,
      assignedSlot: null,
    };
    if (r.verified) {
      const v = sealVersion(base, r.surveyor ?? "勘测组", Date.now() - 86400000 * 2);
      base.currentVersion = v;
      base.history = [v];
      base.status = "waiting";
    }
    return base;
  });
}

export function createSeed(): AppState {
  const buildings = [
    makeBuilding("b1", "关帝庙大殿", 3),
    makeBuilding("b2", "文昌阁", 2),
  ];

  // 传力路径：梁架 → 斗拱 → 柱网；downIds 指向荷载下游
  const b1 = makeComps("b1", [
    {
      code: "梁架 L-A-03",
      kind: "beam",
      wood: "松木",
      mortise: "透榫",
      width: 180,
      height: 240,
      diseaseLocation: "东端端部开裂",
      deflection: 14,
      reDeflection: 22,
      downIds: ["n5", "n6", "n7"],
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "梁架 L-B-01",
      kind: "beam",
      wood: "杉木",
      mortise: "燕尾榫",
      width: 160,
      height: 220,
      diseaseLocation: "跨中垂弯",
      deflection: 6,
      reDeflection: 9,
      downIds: ["n5", "n8"],
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "梁架 L-C-05",
      kind: "beam",
      wood: "松木",
      mortise: "半榫",
      width: 150,
      height: 200,
      diseaseLocation: "无",
      deflection: 0,
      reDeflection: 2,
      downIds: ["n6"],
    },
    {
      code: "梁架 L-A-04",
      kind: "beam",
      wood: "榆木",
      mortise: "箍头榫",
      width: 190,
      height: 250,
      diseaseLocation: "榫肩受潮、轻微开裂",
      deflection: 11,
      reDeflection: 26,
      downIds: ["n7", "n8"],
      verified: true,
      surveyor: "林砚",
    },
    {
      code: "斗拱 D-07",
      kind: "bracket",
      wood: "楠木",
      mortise: "斗口榫",
      width: 120,
      height: 150,
      diseaseLocation: "栌斗轻微变形",
      deflection: 4,
      reDeflection: 6,
      downIds: ["n9"],
      verified: true,
      surveyor: "林砚",
    },
    {
      code: "斗拱 D-08",
      kind: "bracket",
      wood: "楠木",
      mortise: "斗口榫",
      width: 120,
      height: 150,
      diseaseLocation: "翘件松动",
      deflection: 7,
      reDeflection: 12,
      downIds: ["n9"],
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "斗拱 D-09",
      kind: "bracket",
      wood: "楠木",
      mortise: "半榫",
      width: 110,
      height: 140,
      diseaseLocation: "无",
      deflection: 1,
      reDeflection: 3,
      downIds: ["n10"],
    },
    {
      code: "斗拱 D-10",
      kind: "bracket",
      wood: "樟木",
      mortise: "斗口榫",
      width: 120,
      height: 150,
      diseaseLocation: "耍头糟朽",
      deflection: 9,
      reDeflection: 18,
      downIds: ["n10"],
      verified: true,
      surveyor: "林砚",
    },
    {
      code: "柱网 C-12",
      kind: "column",
      wood: "楠木",
      mortise: "管脚榫",
      width: 320,
      height: 320,
      diseaseLocation: "柱脚糟朽",
      deflection: 10,
      reDeflection: 15,
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "柱网 C-13",
      kind: "column",
      wood: "楠木",
      mortise: "管脚榫",
      width: 320,
      height: 320,
      diseaseLocation: "柱身向东倾斜",
      deflection: 8,
      reDeflection: 13,
    },
    {
      code: "柱网 C-14",
      kind: "column",
      wood: "柏木",
      mortise: "管脚榫",
      width: 300,
      height: 300,
      diseaseLocation: "柱顶榫卯松动",
      deflection: 5,
      reDeflection: 8,
    },
  ]);

  const b2 = makeComps("b2", [
    {
      code: "梁架 L-W-02",
      kind: "beam",
      wood: "杉木",
      mortise: "燕尾榫",
      width: 150,
      height: 200,
      diseaseLocation: "梁头开裂",
      deflection: 9,
      reDeflection: 16,
      downIds: ["n4", "n5"],
      verified: true,
      surveyor: "林砚",
    },
    {
      code: "梁架 L-W-03",
      kind: "beam",
      wood: "松木",
      mortise: "透榫",
      width: 160,
      height: 210,
      diseaseLocation: "无",
      deflection: 2,
      reDeflection: 4,
      downIds: ["n5"],
    },
    {
      code: "梁架 L-W-04",
      kind: "beam",
      wood: "榆木",
      mortise: "半榫",
      width: 140,
      height: 190,
      diseaseLocation: "跨中受潮变形",
      deflection: 12,
      reDeflection: 24,
      downIds: ["n4"],
      verified: true,
      surveyor: "林砚",
    },
    {
      code: "斗拱 D-W-03",
      kind: "bracket",
      wood: "楠木",
      mortise: "斗口榫",
      width: 110,
      height: 140,
      diseaseLocation: "交互枨松动",
      deflection: 5,
      reDeflection: 10,
      downIds: ["n6"],
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "斗拱 D-W-04",
      kind: "bracket",
      wood: "樟木",
      mortise: "斗口榫",
      width: 110,
      height: 140,
      diseaseLocation: "散斗糟朽",
      deflection: 8,
      reDeflection: 14,
      downIds: ["n6"],
      verified: true,
      surveyor: "周衡",
    },
    {
      code: "柱网 C-W-05",
      kind: "column",
      wood: "楠木",
      mortise: "管脚榫",
      width: 280,
      height: 280,
      diseaseLocation: "柱脚糟朽倾斜",
      deflection: 13,
      reDeflection: 21,
      verified: true,
      surveyor: "林砚",
    },
  ]);

  // 让其中两条已核对记录的复测值相对封存版本发生改动 → 修缮建议失效，待重新核对
  b1[0].reDeflection = 24;
  b2[3].reDeflection = 13;

  const components = [...b1, ...b2];
  return { buildings, components, conflicts: [], seq: 100 };
}

export function seedSignatureSamples() {
  void measureSignature;
}
