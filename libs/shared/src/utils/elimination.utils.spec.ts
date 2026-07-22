import { getEliminationDisplayLabel } from "./elimination.utils";
import { ParticipantStatus } from "../enums/competition.enums";
import { EliminationCode } from "../enums/vet.enums";

describe("elimination.utils", () => {
  describe("getEliminationDisplayLabel", () => {
    it("should return F.C.A. for ParticipantStatus.ELIMINATED_PP", () => {
      const result = getEliminationDisplayLabel(ParticipantStatus.ELIMINATED_PP);
      expect(result.code).toBe("F.C.A.");
      expect(result.label).toBe("Frecuencia Cardíaca Alta");
      expect(result.feiLabel).toBe("Failed to Qualify – Metabolic");
    });

    it("should return F.C.A. for EliminationCode.METABOLIC", () => {
      const result = getEliminationDisplayLabel(EliminationCode.METABOLIC);
      expect(result.code).toBe("F.C.A.");
    });

    it("should return Coj. for ParticipantStatus.ELIMINATED_GAIT and EliminationCode.GAIT", () => {
      expect(getEliminationDisplayLabel(ParticipantStatus.ELIMINATED_GAIT).code).toBe("Coj.");
      expect(getEliminationDisplayLabel(EliminationCode.GAIT).code).toBe("Coj.");
    });

    it("should return Ex. T. Rec. for ELIMINATED_TR and TIME", () => {
      expect(getEliminationDisplayLabel(ParticipantStatus.ELIMINATED_TR).code).toBe("Ex. T. Rec.");
      expect(getEliminationDisplayLabel(EliminationCode.TIME).code).toBe("Ex. T. Rec.");
    });

    it("should return Ret. Vol. for RET and DNF", () => {
      expect(getEliminationDisplayLabel(EliminationCode.RET).code).toBe("Ret. Vol.");
      expect(getEliminationDisplayLabel(ParticipantStatus.DNF).code).toBe("Ret. Vol.");
    });

    it("should return F. P. for FAIL_WEIGHT", () => {
      expect(getEliminationDisplayLabel(ParticipantStatus.FAIL_WEIGHT).code).toBe("F. P.");
    });

    it("should return N.C. for NO_COMPLETED", () => {
      expect(getEliminationDisplayLabel(ParticipantStatus.NO_COMPLETED).code).toBe("N.C.");
    });
  });
});
