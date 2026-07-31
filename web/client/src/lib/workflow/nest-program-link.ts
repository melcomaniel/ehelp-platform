/** Maps Nest program UUIDs ↔ localStorage Workflow Builder program IDs (PRG-*). */

const STORAGE_KEY = "ehelp-nest-program-builder-links-v1";

type LinkMap = Record<
  string,
  {
    builderProgramId: string;
  }
>;

function readMap(): LinkMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LinkMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: LinkMap) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getBuilderProgramIdForNest(nestProgramId: string): string | null {
  return readMap()[nestProgramId]?.builderProgramId ?? null;
}

export function getNestProgramIdForBuilder(
  builderProgramId: string,
): string | null {
  const map = readMap();
  for (const [nestId, link] of Object.entries(map)) {
    if (link.builderProgramId === builderProgramId) return nestId;
  }
  return null;
}

export function linkNestProgramToBuilder(
  nestProgramId: string,
  builderProgramId: string,
) {
  const map = readMap();
  map[nestProgramId] = { builderProgramId };
  writeMap(map);
}
