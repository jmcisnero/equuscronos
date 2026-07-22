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
        label: "Retiro Antes de Iniciar",
        feiLabel: "Withdrawn",
      };

    case ParticipantStatus.DQ:
    case EliminationCode.FTQ:
      return {
        code: "DQ",
        label: "Descalificado",
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
