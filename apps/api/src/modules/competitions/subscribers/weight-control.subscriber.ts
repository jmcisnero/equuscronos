import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  DataSource,
} from 'typeorm';
import { CompetitionEntry } from '../../competition-entries/entities/competition-entry.entity';
import { ParticipantStatus, EliminationCode } from '@equuscronos/shared';

// Importamos la entidad que mapea la tabla weight_controls creada en tu SQL
// Asegúrate de tener esta entidad creada en la carpeta entities/
import { WeightControl } from '../entities/weight-control.entity'; 

@EventSubscriber()
export class WeightControlSubscriber implements EntitySubscriberInterface<WeightControl> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return WeightControl;
  }

  async afterInsert(event: InsertEvent<WeightControl>) {
    const control = event.entity as WeightControl;
    const { manager } = event;

    // 1. Traer la inscripción asociada para conocer las reglas de la competencia
    const entry = await manager.findOne(CompetitionEntry, {
      where: { id: control.entry?.id }, // Se asume que se pasa el entry_id al crear el control
      relations: ['competition', 'competition.competitionType'],
    });

    if (!entry) return;

    // 2. Extraer el peso mínimo del reglamento (JSON defaultRules) o usar 85kg por defecto (Art. 20)
    const rules = entry.competition.competitionType.defaultRules || {};
    const baseMinWeight = rules.min_weight_kg || 85;

    // 3. Aplicar la lógica de tolerancia (1kg no acumulable)
    let allowedWeight = baseMinWeight;
    if (control.controlType !== 'INITIAL') {
      allowedWeight = baseMinWeight - 1; // 84kg permitidos en etapas/llegada
    }

    // 4. Ejecutar la descalificación implacable
    if (control.weightRecorded < allowedWeight) {
      const reason = `Falta de peso en control ${control.controlType}: Registró ${control.weightRecorded}kg (Mínimo: ${allowedWeight}kg)`;

      // A. "Hachazo": Cambiamos el estado del jinete a DQ
      await manager.update(CompetitionEntry, entry.id, {
        status: ParticipantStatus.DQ,
      });

      // (Opcional) B. Si tuvieras que insertar un registro temporal de eliminación, lo harías aquí.
      
      console.log(`[EquusCronos] Binomio ${entry.bibNumber} DESCALIFICADO por PESO: ${reason}`);
    }
  }
}
