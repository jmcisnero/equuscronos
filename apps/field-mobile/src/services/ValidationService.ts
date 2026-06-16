import { TimeRecordType } from "@equuscronos/shared";

export class ValidationService {
  /**
   * Valida la secuencia e idempotencia de un nuevo registro de tiempo en SQLite.
   */
  static async validateTimingRecord(
    db: any,
    entryId: string,
    stageId: string,
    recordType: TimeRecordType,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // 1. Validar Idempotencia / Duplicidad (Guardia de Idempotencia)
      if (recordType === TimeRecordType.VET_IN) {
        const vetInRecords = await db.getAllAsync(
          `SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = ? AND is_void = 0;`,
          [entryId, stageId, recordType],
        );

        if (vetInRecords.length >= 2) {
          return {
            isValid: false,
            error:
              "Máximo de 2 intentos de inspección veterinaria (VET_IN) permitidos por etapa.",
          };
        }

        if (vetInRecords.length === 1) {
          // Verificar si el primer VET_IN requiere rechequeo
          const inspection = await db.getFirstAsync(
            `SELECT vi.is_recheck_required 
             FROM vet_inspections vi
             JOIN timing_records tr ON vi.timing_record_id = tr.id
             WHERE tr.entry_id = ? AND tr.stage_id = ? AND tr.record_type = 'VET_IN' AND tr.is_void = 0;`,
            [entryId, stageId],
          );

          if (!inspection) {
            return {
              isValid: false,
              error:
                "No se puede registrar un segundo intento de VET_IN si el primero aún no ha sido inspeccionado.",
            };
          }

          if (inspection.is_recheck_required !== 1) {
            return {
              isValid: false,
              error:
                "Error: Registro duplicado. Si fue un error, el Administrador debe anular el registro previo.",
            };
          }
        }
      } else {
        // Para cualquier otro record_type, solo se permite uno activo (is_void = 0)
        const existing = await db.getFirstAsync(
          `SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = ? AND is_void = 0;`,
          [entryId, stageId, recordType],
        );

        if (existing) {
          return {
            isValid: false,
            error:
              "Error: Registro duplicado. Si fue un error, el Administrador debe anular el registro previo.",
          };
        }
      }

      // 2. Validar Secuencia Causal FEU (Secuenciador)
      if (recordType === TimeRecordType.ARRIVAL) {
        const startRecord = await db.getFirstAsync(
          `SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = ? AND is_void = 0;`,
          [entryId, stageId, TimeRecordType.START],
        );
        if (!startRecord) {
          return {
            isValid: false,
            error:
              "Carrera no iniciada. Espere la orden de largada oficial desde el Admin.",
          };
        }
      }

      if (recordType === TimeRecordType.VET_IN) {
        const arrivalRecord = await db.getFirstAsync(
          `SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = ? AND is_void = 0;`,
          [entryId, stageId, TimeRecordType.ARRIVAL],
        );
        if (!arrivalRecord) {
          return {
            isValid: false,
            error:
              "Secuencia inválida: No se puede registrar ingreso veterinario (VET_IN) sin haber cruzado la meta (ARRIVAL).",
          };
        }
      }

      return { isValid: true };
    } catch (error: any) {
      console.error(
        "[ValidationService] Error validating timing record:",
        error,
      );
      return {
        isValid: false,
        error: `Error de validación interna: ${error.message}`,
      };
    }
  }

  /**
   * Valida si se puede registrar una nueva inspección veterinaria para un timing_record_id dado.
   */
  static async validateVetInspection(
    db: any,
    timingRecordId: string,
  ): Promise<{ isValid: boolean; error?: string; isRecheck?: boolean }> {
    try {
      // Verificar si ya existe una inspección para este timing_record_id
      const existing = await db.getFirstAsync(
        `SELECT is_recheck_required FROM vet_inspections WHERE timing_record_id = ?;`,
        [timingRecordId],
      );

      if (existing) {
        if (existing.is_recheck_required === 0) {
          return {
            isValid: false,
            error: "Inspección finalizada. No se permiten rechequeos.",
          };
        } else {
          return {
            isValid: true,
            isRecheck: true,
          };
        }
      }

      return { isValid: true, isRecheck: false };
    } catch (error: any) {
      console.error(
        "[ValidationService] Error validating vet inspection:",
        error,
      );
      return {
        isValid: false,
        error: `Error de validación interna: ${error.message}`,
      };
    }
  }
}
