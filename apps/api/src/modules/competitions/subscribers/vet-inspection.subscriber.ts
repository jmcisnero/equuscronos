import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import { VetInspection } from '../entities/vet-inspection.entity';
import { CompetitionEntry } from '../../competition-entries/entities/competition-entry.entity';
import { ParticipantStatus, EliminationCode } from '@equuscronos/shared';
import { MotricityStatus } from '@equuscronos/shared';

@EventSubscriber()
export class VetInspectionSubscriber implements EntitySubscriberInterface<VetInspection> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return VetInspection;
  }

  // Se ejecuta automáticamente tras insertar un control veterinario
  async afterInsert(event: InsertEvent<VetInspection>) {
    await this.validateRegulatedParameters(event);
  }

  async afterUpdate(event: UpdateEvent<VetInspection>) {
    await this.validateRegulatedParameters(event);
  }

  private async validateRegulatedParameters(event: InsertEvent<VetInspection> | UpdateEvent<VetInspection>) {
    const inspection = event.entity as VetInspection;
    const { manager } = event;

    // 1. Obtener el límite de pulso de la competencia (Default 65 según Art. 31)
    // Buscamos a través de la relación TimingRecord -> Entry -> Competition
    const inspectionWithDetails = await manager.findOne(VetInspection, {
      where: { id: inspection.id },
      relations: ['timingRecord', 'timingRecord.entry', 'timingRecord.entry.competition'],
    });

    if (!inspectionWithDetails) return;

    const entry = inspectionWithDetails.timingRecord.entry;
    const maxHeartRate = inspectionWithDetails.timingRecord.entry.competition.maxHeartRate || 65;

    let shouldDisqualify = false;
    let reason = '';
    let eliminationCode: EliminationCode = null;

    // 2. REGLA DE PULSO (Art. 31)
    if (inspection.heartRate > maxHeartRate) {
      shouldDisqualify = true;
      reason = `Pulso excedido: ${inspection.heartRate} bpm (Máx: ${maxHeartRate})`;
      eliminationCode = EliminationCode.METABOLIC;
    }

    // 3. REGLA DE MOTRICIDAD / TROTE (Art. 31)
    if (inspection.motricity === MotricityStatus.NOT_APTO) {
      shouldDisqualify = true;
      reason = 'No apto en prueba de trote / Claudicación detectada.';
      eliminationCode = EliminationCode.GAIT;
    }

    // 4. EJECUCIÓN DE LA DESCALIFICACIÓN
    if (shouldDisqualify) {
      // Actualizamos el binomio
      await manager.update(CompetitionEntry, entry.id, {
        status: ParticipantStatus.DQ,
      });

      // Marcamos el registro de tiempo como no aprobado para la auditoría
      await manager.update('timing_records', inspectionWithDetails.timingRecord.id, {
        isApproved: false,
        eliminationType: eliminationCode,
        eliminationReason: reason,
      });
      
      console.log(`[EquusCronos] Binomio ${entry.bibNumber} descalificado automáticamente: ${reason}`);
    }
  }
}
