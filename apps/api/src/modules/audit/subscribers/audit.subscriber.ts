import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '@equuscronos/shared';
import { Tenant } from '../../tenants/entities/tenant.entity';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private static fallbackTenant: Tenant | null = null;
  
  // Escucha cambios en TODAS las entidades del sistema
  listenTo() {
    return 'all';
  }

  // Intercepta creaciones
  async afterInsert(event: InsertEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const auditLog = event.manager.create(AuditLog, {
      tenant,
      action: AuditAction.INSERT,
      entityName: event.metadata.tableName,
      entityId: this.extractEntityId(event.entity),
      newData: event.entity,
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta modificaciones (Ej: Cambio de pulso de 65 a 60)
  async afterUpdate(event: UpdateEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const auditLog = event.manager.create(AuditLog, {
      tenant,
      action: AuditAction.UPDATE,
      entityName: event.metadata.tableName,
      entityId: this.extractEntityId(event.entity) || this.extractEntityId(event.databaseEntity),
      oldData: event.databaseEntity, // Estado anterior
      newData: event.entity,         // Estado nuevo
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta eliminaciones
  async afterRemove(event: RemoveEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const auditLog = event.manager.create(AuditLog, {
      tenant,
      action: AuditAction.DELETE,
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
   * Obtiene el tenant para la auditoría, usando la entidad o un fallback.
   */
  private async getTenantForEntity(event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>): Promise<Tenant | null> {
    const entity = event.entity;
    if (entity) {
      if (entity.tenant) return entity.tenant;
      if (entity.competition?.tenant) return entity.competition.tenant;
      if (entity.entry?.tenant) return entity.entry.tenant;
    }

    if (!AuditSubscriber.fallbackTenant) {
      try {
        AuditSubscriber.fallbackTenant = await event.manager.findOne(Tenant, { order: { name: 'ASC' } });
      } catch (err) {
        console.error('[AuditSubscriber] Error fetching fallback tenant:', err);
      }
    }
    return AuditSubscriber.fallbackTenant;
  }

  /**
   * Previene bucles infinitos: No queremos auditar la tabla de auditoría.
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
