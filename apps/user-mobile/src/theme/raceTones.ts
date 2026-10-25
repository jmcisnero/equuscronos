import { StatusTone } from "../utils/raceFormat";

export interface Tone {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

/**
 * Tonos semánticos de carrera para cada tema. Los textos superan contraste
 * AA (≥4.5:1) sobre su fondo para lectura en pista bajo sol directo.
 */
export function getRaceTones(isDark: boolean) {
  const status: Record<StatusTone, Tone> = isDark
    ? {
        race: { bg: "rgba(16,185,129,0.16)", text: "#6EE7B7", border: "rgba(16,185,129,0.45)", dot: "#10B981" },
        vet: { bg: "rgba(245,158,11,0.16)", text: "#FCD34D", border: "rgba(245,158,11,0.45)", dot: "#F59E0B" },
        rest: { bg: "rgba(14,165,233,0.16)", text: "#7DD3FC", border: "rgba(14,165,233,0.45)", dot: "#0EA5E9" },
        provisional: { bg: "rgba(59,130,246,0.16)", text: "#93C5FD", border: "rgba(59,130,246,0.45)", dot: "#3B82F6" },
        finished: { bg: "#F8FAFC", text: "#0F172A", border: "#CBD5E1", dot: "#0F172A" },
        out: { bg: "rgba(244,63,94,0.16)", text: "#FDA4AF", border: "rgba(244,63,94,0.45)", dot: "#F43F5E" },
        neutral: { bg: "#334155", text: "#E2E8F0", border: "#475569", dot: "#94A3B8" },
      }
    : {
        race: { bg: "#ECFDF5", text: "#022C22", border: "#6EE7B7", dot: "#059669" },
        vet: { bg: "#FFFBEB", text: "#451A03", border: "#FCD34D", dot: "#D97706" },
        rest: { bg: "#F0F9FF", text: "#082F49", border: "#7DD3FC", dot: "#0284C7" },
        provisional: { bg: "#EFF6FF", text: "#172554", border: "#93C5FD", dot: "#2563EB" },
        finished: { bg: "#0F172A", text: "#FFFFFF", border: "#334155", dot: "#FFFFFF" },
        out: { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3", dot: "#E11D48" },
        neutral: { bg: "#F1F5F9", text: "#1E293B", border: "#E2E8F0", dot: "#64748B" },
      };

  // Podio: mismos tonos ámbar/plata/bronce que la web
  const podium: Record<1 | 2 | 3 | "other", Tone> = isDark
    ? {
        1: { bg: "rgba(251,191,36,0.2)", text: "#FDE68A", border: "#F59E0B", dot: "" },
        2: { bg: "rgba(203,213,225,0.16)", text: "#E2E8F0", border: "#94A3B8", dot: "" },
        3: { bg: "rgba(251,146,60,0.18)", text: "#FDBA74", border: "#EA580C", dot: "" },
        other: { bg: "#0F172A", text: "#CBD5E1", border: "#334155", dot: "" },
      }
    : {
        1: { bg: "#FEF3C7", text: "#451A03", border: "#FCD34D", dot: "" },
        2: { bg: "#F1F5F9", text: "#0F172A", border: "#CBD5E1", dot: "" },
        3: { bg: "#FFEDD5", text: "#431407", border: "#FDBA74", dot: "" },
        other: { bg: "#F8FAFC", text: "#334155", border: "#E2E8F0", dot: "" },
      };

  return {
    status,
    podium,
    /** Verde marca EquusCronos (#1C4F38) aclarado en oscuro para contraste */
    heartOk: isDark ? "#10B981" : "#1C4F38",
    heartHigh: isDark ? "#F43F5E" : "#E11D48",
    /**
     * Relleno del corazón de HeartPulseBadge (número blanco encima): tonos más
     * profundos que heartOk/heartHigh para mantener contraste del texto blanco.
     * Sincronizado con public-web (Art. 31/54: ≤ límite verde, > límite carmín).
     */
    heartFill: {
      ok: isDark ? "#15803D" : "#1C4F38",
      high: "#E11D48",
      empty: "#94A3B8",
    },
    trophy: "#F59E0B",
    /** Tostado de marca (#AD8F6C) para LÍDER y acentos */
    accent: isDark ? "#D6BC97" : "#8A6D4B",
    timeAccent: isDark ? "#6EE7B7" : "#1C4F38",
    bibBg: isDark ? "#F8FAFC" : "#0F172A",
    bibText: isDark ? "#0F172A" : "#FFFFFF",
    recheck: {
      PENDING: isDark
        ? { bg: "rgba(197,138,65,0.2)", text: "#FCD34D", border: "rgba(197,138,65,0.5)", dot: "" }
        : { bg: "#FDF3E6", text: "#7C4A12", border: "#E7C38F", dot: "" },
      PASSED: isDark
        ? { bg: "rgba(16,185,129,0.16)", text: "#6EE7B7", border: "rgba(16,185,129,0.45)", dot: "" }
        : { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "" },
      OBSERVED: isDark
        ? { bg: "rgba(245,158,11,0.18)", text: "#FDE68A", border: "rgba(245,158,11,0.5)", dot: "" }
        : { bg: "#FEF3C7", text: "#78350F", border: "#FCD34D", dot: "" },
      FAILED: isDark
        ? { bg: "rgba(244,63,94,0.16)", text: "#FDA4AF", border: "rgba(244,63,94,0.45)", dot: "" }
        : { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3", dot: "" },
    } as Record<"PENDING" | "PASSED" | "OBSERVED" | "FAILED", Tone>,
  };
}
