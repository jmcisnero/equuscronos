import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  
  // Escucha cambios en TODAS las entidades del sistema
  listenTo() {
    return 'all';
  }

  // Intercepta creaciones
  async afterInsert(event: InsertEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const auditLog = event.manager.create(AuditLog, {
      action: 'INSERT',
      entityName: event.metadata.tableName,
      entityId: this.extractEntityId(event.entity),
      newData: event.entity,
      // Nota: userId y tenantId se inyectarían aquí usando ClsService (AsyncLocalStorage) 
      // en una iteración posterior cuando integremos la autenticación JWT.
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta modificaciones (Ej: Cambio de pulso de 65 a 60)
  async afterUpdate(event: UpdateEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const auditLog = event.manager.create(AuditLog, {
      action: 'UPDATE',
      entityName: event.metadata.tableName,
      entityId: this.extractEntityId(event.entity) || this.extractEntityId(event.databaseEntity),
      oldData: event.databaseEntity, // Estado anterior (Ej: { maxHeartRate: 65 })
      newData: event.entity,         // Estado nuevo (Ej: { maxHeartRate: 60 })
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta eliminaciones
  async afterRemove(event: RemoveEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const auditLog = event.manager.create(AuditLog, {
      action: 'DELETE',
      entityName: event.metadata.tableName,
      entityId: event.entityId,
      oldData: event.databaseEntity,
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // ====================================================================
  // MÉTODOS AUXILIARES DE SEGURIDAD
  // ====================================================================

  /**
   * Previene bucles infinitos: No queremos auditar la tabla de auditoría.
   * Tampoco auditamos tablas internas de TypeORM como migrations.
   */
  private shouldAudit(tableName: string | undefined): boolean {
    if (!tableName) return false;
    const excludedTables = ['audit_logs', 'migrations'];
    return !excludedTables.includes(tableName);
  }

  /**
   * Extrae el ID de la entidad de forma segura.
   */
  private extractEntityId(entity: any): string | null {
    if (!entity) return null;
    return entity.id ? String(entity.id) : null;
  }
}
