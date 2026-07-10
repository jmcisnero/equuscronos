import {
  EventSubscriber,
  EntitySubscriberInterface,
  DataSource,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from "typeorm";
import { Injectable } from "@nestjs/common";
import { AuditLog } from "../entities/audit-log.entity";
import { AuditAction } from "@equuscronos/shared";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { User } from "../../users/entities/user.entity";
import { tenantStorage } from "../../auth/tenant.storage";

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private static fallbackTenant: Tenant | null = null;

  constructor(private readonly dataSource: DataSource) {
    this.dataSource.subscribers.push(this);
  }

  // Intercepta creaciones
  async afterInsert(event: InsertEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    const auditLog = event.manager.create(AuditLog, {
      tenant,
      user,
      action: AuditAction.INSERT,
      entityName: event.metadata.tableName,
      entityId: this.extractEntityId(event.entity),
      newData: event.entity,
      ipAddress: store?.ipAddress || null,
      userAgent: store?.userAgent || null,
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta modificaciones
  async afterUpdate(event: UpdateEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    const auditLog = event.manager.create(AuditLog, {
      tenant,
      user,
      action: AuditAction.UPDATE,
      entityName: event.metadata.tableName,
      entityId:
        this.extractEntityId(event.entity) ||
        this.extractEntityId(event.databaseEntity),
      oldData: event.databaseEntity, // Estado anterior
      newData: event.entity, // Estado nuevo
      ipAddress: store?.ipAddress || null,
      userAgent: store?.userAgent || null,
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // Intercepta eliminaciones
  async afterRemove(event: RemoveEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    const auditLog = event.manager.create(AuditLog, {
      tenant,
      user,
      action: AuditAction.DELETE,
      entityName: event.metadata.tableName,
      entityId: event.entityId,
      oldData: event.databaseEntity,
      ipAddress: store?.ipAddress || null,
      userAgent: store?.userAgent || null,
    });
    await event.manager.save(AuditLog, auditLog);
  }

  // ====================================================================
  // MÉTODOS AUXILIARES DE SEGURIDAD
  // ====================================================================

  /**
   * Obtiene el usuario autenticado de la sesión.
   */
  private async getCurrentUser(
    event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
  ): Promise<User | null> {
    const store = tenantStorage.getStore();
    const userId = store?.userId;
    if (userId) {
      try {
        return await event.manager.findOne(User, {
          where: { id: userId },
        });
      } catch (err) {
        console.error("[AuditSubscriber] Error fetching current user:", err);
      }
    }
    return null;
  }

  /**
   * Obtiene el tenant para la auditoría, usando la entidad o un fallback.
   */
  private async getTenantForEntity(
    event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
  ): Promise<Tenant | null> {
    const entity = event.entity;
    if (entity) {
      if (entity.tenant) return entity.tenant;
      if (entity.tenantId) {
        try {
          const tenant = await event.manager.findOne(Tenant, {
            where: { id: entity.tenantId },
          });
          if (tenant) return tenant;
        } catch {}
      }
      if (entity.competition?.tenant) return entity.competition.tenant;
      if (entity.entry?.tenant) return entity.entry.tenant;
    }

    const store = tenantStorage.getStore();
    const tenantId = store?.tenantId;
    if (tenantId) {
      try {
        const tenant = await event.manager.findOne(Tenant, {
          where: { id: tenantId },
        });
        if (tenant) return tenant;
      } catch (err) {
        console.error("[AuditSubscriber] Error fetching tenant from store:", err);
      }
    }

    if (!AuditSubscriber.fallbackTenant) {
      try {
        AuditSubscriber.fallbackTenant = await event.manager.findOne(Tenant, {
          order: { name: "ASC" },
        });
      } catch (err) {
        console.error("[AuditSubscriber] Error fetching fallback tenant:", err);
      }
    }
    return AuditSubscriber.fallbackTenant;
  }

  /**
   * Previene bucles infinitos: No queremos auditar la tabla de auditoría.
   */
  private shouldAudit(tableName: string | undefined): boolean {
    if (!tableName) return false;
    const excludedTables = ["audit_logs", "migrations"];
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
