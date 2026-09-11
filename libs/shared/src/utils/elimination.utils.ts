import { ParticipantStatus } from "../enums/competition.enums";
import { EliminationCode } from "../enums/vet.enums";

export interface EliminationDisplayLabel {
  code: string;
  label: string;
  feiLabel: string;
}

export function getEliminationDisplayLabel(
  status: ParticipantStatus | EliminationCode | string,
): EliminationDisplayLabel {
  const normalized = String(status || "").toUpperCase();

  switch (normalized) {
    case ParticipantStatus.ELIMINATED_PP:
    case EliminationCode.METABOLIC:
      return {
        code: "F.C.A.",
        label: "Frecuencia Cardíaca Alta",
        feiLabel: "Failed to Qualify – Metabolic",
      };

    case ParticipantStatus.ELIMINATED_GAIT:
    case EliminationCode.GAIT:
      return {
        code: "Coj.",
        label: "Claudicación / Cojera",
        feiLabel: "Failed to Qualify – Gait",
      };

    case ParticipantStatus.ELIMINATED_TR:
    case EliminationCode.TIME:
      return {
        code: "Ex. T. Rec.",
        label: "Exceso Tiempo de Recuperación (20 min)",
        feiLabel: "Failed to Qualify – Out of Time",
      };

    case EliminationCode.RET:
    case ParticipantStatus.DNF:
      return {
        code: "Ret. Vol.",
        label: "Retiro Voluntario",
        feiLabel: "Retired",
      };

    case EliminationCode.FAIL_WEIGHT:
    case ParticipantStatus.FAIL_WEIGHT:
      return {
        code: "F. P.",
        label: "Falta de Peso (Art. 20)",
        feiLabel: "Failed Weight Control",
      };

    case ParticipantStatus.NO_COMPLETED:
      return {
        code: "N.C.",
        label: "No Completó Tiempo Límite",
        feiLabel: "No Placed",
      };

    case ParticipantStatus.WD:
    case EliminationCode.WD:
      return {
        code: "WD",
        label: "Retiro Antes de Iniciar (Art. 13)",
        feiLabel: "Withdrawn",
      };

    case ParticipantStatus.DQ_ROUTE:
      return {
        code: "Desc. Itin.",
        label: "Desvío de Itinerario (Art. 25)",
        feiLabel: "Disqualified – Route Deviation",
      };

    case ParticipantStatus.DQ_ASSISTANCE:
      return {
        code: "Desc. Asist.",
        label: "Ayuda No Permitida en Meta (Art. 26 lit. a)",
        feiLabel: "Disqualified – Unauthorized Assistance",
      };

    case ParticipantStatus.DQ_DISMOUNTED:
      return {
        code: "Desc. Desm.",
        label: "Avanzar Desmontado en Meta (Art. 26 lit. d)",
        feiLabel: "Disqualified – Dismounted Finish",
      };

    case ParticipantStatus.DQ_VET_ROUTE:
      return {
        code: "Desc. Vet. R.",
        label: "Extenuación / Mala Conducta en Ruta (Art. 34)",
        feiLabel: "Disqualified – Vet Route / Ethics",
      };

    case ParticipantStatus.DQ_OVERTIME:
      return {
        code: "F. Tmp.",
        label: "Fuera de Tiempo / Cierre de Control (Art. 32, 55)",
        feiLabel: "Disqualified – Overtime",
      };

    case ParticipantStatus.DQ_OLYMPIC:
      return {
        code: "Desc. Ol.",
        label: "Eliminado en Presentación Olímpica (Art. 38, 39, 56)",
        feiLabel: "Disqualified – Olympic Review",
      };

    case ParticipantStatus.DQ:
    case EliminationCode.FTQ:
      return {
        code: "DQ",
        label: "Descalificado por Jurado",
        feiLabel: "Disqualified / Failed to Qualify",
      };

    default:
      return {
        code: normalized || "-",
        label: normalized || "Descalificación / Eliminación",
        feiLabel: normalized || "Failed to Qualify",
      };
  }
}

export function isTerminalStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return (
    [
      "DQ",
      "DNF",
      "WD",
      "NO_COMPLETED",
      "FAIL_WEIGHT",
      "RET",
      "GAIT",
      "METABOLIC",
      "TIME",
      "FTQ",
      "DQ_ROUTE",
      "DQ_ASSISTANCE",
      "DQ_DISMOUNTED",
      "DQ_VET_ROUTE",
      "DQ_OVERTIME",
      "DQ_OLYMPIC",
    ].includes(s) ||
    s.startsWith("ELIMINATED") ||
    s.startsWith("DQ_")
  );
}

