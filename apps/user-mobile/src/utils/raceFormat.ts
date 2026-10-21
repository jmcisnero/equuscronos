/**
 * Utilidades de presentación de carrera.
 * Espejo 1:1 de apps/public-web/src/components/LeaderboardShared.tsx y
 * FinalResultsTable.tsx para garantizar los mismos formatos y reglas en web y móvil.
 */
import { getEliminationDisplayLabel, isTerminalStatus } from "@equuscronos/shared";
import { Competition, LeaderboardEntry } from "../types";

/** Límite por defecto de pulsaciones si la competencia no lo define (igual que la web). */
export const DEFAULT_MAX_HEART_RATE = 65;

export { isTerminalStatus };

/** Hora de reloj HH:MM:SS desde un ISO string. */
export function formatHHMMSS(dateStr?: string | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Duración de carrera HH:MM:SS desde milisegundos. */
export function formatTime(ms?: number | null): string {
  if (ms === undefined || ms === null || isNaN(ms)) return "--";
  const total = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

/** Diferencia con el líder: "LÍDER", "+Xm YYs" o "--". */
export function formatGap(gapMs: number, totalRaceTimeMs: number): { text: string; isLeader: boolean } {
  if (!totalRaceTimeMs) return { text: "--", isLeader: false };
  if (gapMs === 0) return { text: "LÍDER", isLeader: true };
  if (!gapMs || isNaN(gapMs)) return { text: "--", isLeader: false };
  const total = Math.floor(gapMs / 1000);
  return {
    text: `+${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`,
    isLeader: false,
  };
}

/** Diferencia con el líder en formato planilla FEU: "Líder" o "+HH:MM:SS". */
export function formatGapHMS(gapMs: number, totalRaceTimeMs: number): { text: string; isLeader: boolean } {
  if (!totalRaceTimeMs) return { text: "--", isLeader: false };
  if (gapMs === 0) return { text: "Líder", isLeader: true };
  if (!gapMs || isNaN(gapMs)) return { text: "--", isLeader: false };
  return { text: `+${formatTime(gapMs)}`, isLeader: false };
}

/** Velocidad promedio con 3 decimales (estándar histórico de planillas FEU). */
export function formatSpeed(speed?: number | null): string {
  const n = Number(speed);
  return speed !== null && speed !== undefined && !isNaN(n) && n > 0 ? `${n.toFixed(3)} km/h` : "--";
}

/** Fecha DD/MM/AAAA sin desfase de zona horaria para fechas "YYYY-MM-DD". */
export function formatDateDMY(dateStr?: string | null): string {
  if (!dateStr) return "A confirmar";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "A confirmar";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Hora de largada programada "HH:MM:SS" -> "HH:MM". */
export function formatStartTime(time?: string | null): string {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

/** Plan de etapas ordenado y distancia total. */
export function getStagePlan(competition?: Competition | null) {
  const stages = [...(competition?.stages || [])]
    .map((s) => ({
      stageNumber: s.stageNumber,
      distanceKm: Number(s.distanceKm) || 0,
      neutralizationMinutes: s.neutralizationMinutes ?? 0,
    }))
    .sort((a, b) => a.stageNumber - b.stageNumber);
  const totalKm = stages.reduce((sum, s) => sum + s.distanceKm, 0);
  return { stages, totalKm };
}

export function formatKm(km: number): string {
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

export type StatusTone = "race" | "vet" | "rest" | "provisional" | "finished" | "out" | "neutral";

export interface RaceStatusInfo {
  icon: string;
  label: string;
  tone: StatusTone;
  /** Descripción reglamentaria completa (para accesibilidad / detalle) */
  description?: string;
  pulsing?: boolean;
}

/**
 * Mismo mapeo que renderStatusBadge() de la web. Las eliminaciones usan
 * estrictamente getEliminationDisplayLabel() de @equuscronos/shared.
 */
export function getRaceStatusInfo(status: string): RaceStatusInfo {
  if (isTerminalStatus(status)) {
    const info = getEliminationDisplayLabel(status);
    const icon =
      status === "NO_COMPLETED"
        ? "❌"
        : ["DNF", "RET", "WD", "FAIL_WEIGHT"].includes(status)
        ? "⚠️"
        : "🛑";
    return { icon, label: info.code, tone: "out", description: `${info.label} (${info.feiLabel})` };
  }
  switch (status) {
    case "IN_RACE":
      return { icon: "🏇", label: "Carrera", tone: "race", pulsing: true };
    case "FINISHED_PROVISIONAL":
      return { icon: "🏁", label: "Prov.", tone: "provisional", description: "Finalizado provisional" };
    case "VET_CHECK":
      return { icon: "🩺", label: "Vet", tone: "vet", pulsing: true, description: "En inspección veterinaria" };
    case "RESTING":
      return { icon: "⏱️", label: "Neutr.", tone: "rest", description: "Cumpliendo neutralización" };
    case "FINISHED":
      return { icon: "🏁", label: "Fin", tone: "finished" };
    default: {
      const info = getEliminationDisplayLabel(status);
      return { icon: "", label: info.code, tone: "neutral", description: info.label };
    }
  }
}

/**
 * Trofeo FEU al Menor Pulso (Art. 42). Mismo algoritmo que FinalResultsTable:
 * entre los clasificados, menor pulso de la Etapa 1; empate -> mejor posición.
 */
export function computeTrophyWinnerBib(leaderboard: LeaderboardEntry[]): number | null {
  const candidates = leaderboard
    .filter(
      (e) =>
        e.status === "FINISHED" ||
        e.status === "FINISHED_PROVISIONAL" ||
        (e.rank !== null && e.rank !== undefined && e.rank > 0),
    )
    .map((e) => {
      const pulse = e.stages?.find((s) => s.stageNumber === 1)?.heartRate;
      return {
        bibNumber: e.bibNumber,
        pulse: pulse !== undefined && pulse !== null && !isNaN(pulse) ? pulse : null,
        rank: e.rank ?? Infinity,
      };
    })
    .filter((c): c is { bibNumber: number; pulse: number; rank: number } => c.pulse !== null);

  if (candidates.length === 0) return null;
  const minPulse = Math.min(...candidates.map((c) => c.pulse));
  const tied = candidates.filter((c) => c.pulse === minPulse).sort((a, b) => a.rank - b.rank);
  return tied[0]?.bibNumber ?? null;
}

/** Etapas ya disputadas (para el historial clínico). */
export function getPreviousStages(entry: LeaderboardEntry) {
  return (entry.stages || []).filter(
    (s) => s.stageNumber < entry.currentStage || entry.status === "FINISHED",
  );
}
