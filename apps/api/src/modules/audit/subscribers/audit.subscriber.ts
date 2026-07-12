import {
  EventSubscriber,
  EntitySubscriberInterface,
  DataSource,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from "typeorm";
import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
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

    // Extraer entityId con cadena de fallback para entidades con PK diferida (ej: TimingRecord en transacciones)
    let entityId = this.extractEntityId(event.entity, event);

    // Salvaguarda explícita para TimingRecord / timing_records
    if (event.metadata.tableName === "timing_records" || !entityId) {
      const rawId = event.entity?.id;
      const entryId =
        event.entity?.entry?.id ||
        event.entity?.entry_id ||
        event.entity?.entryId;
      if (!entityId) {
        entityId = rawId ? String(rawId) : entryId ? String(entryId) : null;
      }
    }

    const safeEntityId = this.toSafeUuid(entityId);

    if (!safeEntityId) {
      // Salvaguarda: no abortar la transacción principal si no podemos extraer un ID válido.
      // Esto previene que un fallo de auditoría rompa la inserción de timing_records.
      console.warn(
        `[AuditSubscriber] afterInsert: No se pudo extraer ni generar un entityId válido para tabla "${event.metadata.tableName}". Audit log omitido.`,
      );
      return;
    }

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    try {
      const auditLog = event.manager.create(AuditLog, {
        tenant,
        user,
        action: AuditAction.INSERT,
        entityName: event.metadata.tableName,
        entityId: safeEntityId,
        newData: event.entity,
        ipAddress: store?.ipAddress || null,
        userAgent: store?.userAgent || null,
      });
      await event.manager.save(AuditLog, auditLog);
    } catch (err) {
      // Fallar silenciosamente: la auditoría NUNCA debe romper la operación principal
      console.error(
        `[AuditSubscriber] afterInsert: Error al guardar audit log para ${event.metadata.tableName}:`,
        err?.message || err,
      );
    }
  }

  // Intercepta modificaciones
  async afterUpdate(event: UpdateEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    let entityId =
      this.extractEntityId(event.entity, event) ||
      this.extractEntityId(event.databaseEntity, event);

    if (event.metadata.tableName === "timing_records" || !entityId) {
      const rawId = event.entity?.id || event.databaseEntity?.id;
      const entryId =
        event.entity?.entry?.id ||
        event.entity?.entry_id ||
        event.entity?.entryId ||
        event.databaseEntity?.entry?.id ||
        event.databaseEntity?.entry_id ||
        event.databaseEntity?.entryId;
      if (!entityId) {
        entityId = rawId ? String(rawId) : entryId ? String(entryId) : null;
      }
    }

    const safeEntityId = this.toSafeUuid(entityId);

    if (!safeEntityId) {
      // Si no podemos extraer el ID de la entidad (por ejemplo, en actualizaciones de nivel de consulta),
      // no registramos la auditoría para evitar violar la restricción NOT NULL de entity_id.
      return;
    }

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    try {
      const auditLog = event.manager.create(AuditLog, {
        tenant,
        user,
        action: AuditAction.UPDATE,
        entityName: event.metadata.tableName,
        entityId: safeEntityId,
        oldData: event.databaseEntity, // Estado anterior
        newData: event.entity, // Estado nuevo
        ipAddress: store?.ipAddress || null,
        userAgent: store?.userAgent || null,
      });
      await event.manager.save(AuditLog, auditLog);
    } catch (err) {
      console.error(
        `[AuditSubscriber] afterUpdate: Error al guardar audit log para ${event.metadata.tableName}:`,
        err?.message || err,
      );
    }
  }

  // Intercepta eliminaciones
  async afterRemove(event: RemoveEvent<any>) {
    if (!this.shouldAudit(event.metadata.tableName)) return;

    let entityId = event.entityId
      ? String(event.entityId)
      : this.extractEntityId(event.databaseEntity, event);

    if (event.metadata.tableName === "timing_records" || !entityId) {
      const rawId = event.entityId || event.databaseEntity?.id;
      const entryId =
        event.databaseEntity?.entry?.id ||
        event.databaseEntity?.entry_id ||
        event.databaseEntity?.entryId;
      if (!entityId) {
        entityId = rawId ? String(rawId) : entryId ? String(entryId) : null;
      }
    }

    const safeEntityId = this.toSafeUuid(entityId);

    if (!safeEntityId) {
      console.warn(
        `[AuditSubscriber] afterRemove: No se pudo extraer ni generar un entityId válido para tabla "${event.metadata.tableName}". Audit log omitido.`,
      );
      return;
    }

    const tenant = await this.getTenantForEntity(event);
    if (!tenant) return;

    const user = await this.getCurrentUser(event);

    const store = tenantStorage.getStore();
    try {
      const auditLog = event.manager.create(AuditLog, {
        tenant,
        user,
        action: AuditAction.DELETE,
        entityName: event.metadata.tableName,
        entityId: safeEntityId,
        oldData: event.databaseEntity,
        ipAddress: store?.ipAddress || null,
        userAgent: store?.userAgent || null,
      });
      await event.manager.save(AuditLog, auditLog);
    } catch (err) {
      console.error(
        `[AuditSubscriber] afterRemove: Error al guardar audit log para ${event.metadata.tableName}:`,
        err?.message || err,
      );
    }
  }

  // ====================================================================
  // MÉTODOS AUXILIARES DE SEGURIDAD
  // ====================================================================

  /**
   * Obtiene el usuario autenticado de la sesión.
   */
  private async getCurrentUser(event: any): Promise<User | null> {
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
  private async getTenantForEntity(event: any): Promise<Tenant | null> {
    const entity = event.entity || event.databaseEntity;
    if (entity) {
      if (entity.tenant) {
        if (typeof entity.tenant === "string") {
          try {
            const tenant = await event.manager.findOne(Tenant, {
              where: { id: entity.tenant },
            });
            if (tenant) return tenant;
          } catch {}
        } else if (entity.tenant.id) {
          try {
            const tenant = await event.manager.findOne(Tenant, {
              where: { id: entity.tenant.id },
            });
            if (tenant) return tenant;
          } catch {}
        }
      }

      const tenantIdField = entity.tenantId || entity.tenant_id;
      if (tenantIdField) {
        try {
          const tenant = await event.manager.findOne(Tenant, {
            where: { id: String(tenantIdField) },
          });
          if (tenant) return tenant;
        } catch {}
      }

      if (entity.competition?.tenant) {
        const t = entity.competition.tenant;
        const id = typeof t === "string" ? t : t.id;
        if (id) {
          try {
            const tenant = await event.manager.findOne(Tenant, {
              where: { id: String(id) },
            });
            if (tenant) return tenant;
          } catch {}
        }
      }

      if (entity.entry?.tenant) {
        const t = entity.entry.tenant;
        const id = typeof t === "string" ? t : t.id;
        if (id) {
          try {
            const tenant = await event.manager.findOne(Tenant, {
              where: { id: String(id) },
            });
            if (tenant) return tenant;
          } catch {}
        }
      }
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
        console.error(
          "[AuditSubscriber] Error fetching tenant from store:",
          err,
        );
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
   * Extrae el ID de la entidad de forma segura con cadena de fallback.
   *
   * Cadena de resolución:
   * 1. entity.id (PK estándar UUID)
   * 2. Columnas PK extraídas de los metadatos de TypeORM (event.metadata.primaryColumns)
   * 3. entity.entry?.id (fallback referencial para timing_records y vet_inspections)
   * 4. entity.entry_id
   */
  private extractEntityId(entity: any, event?: any): string | null {
    if (!entity) return null;

    // 1. PK directa
    if (entity.id) return String(entity.id);

    // 2. Intentar extraer PK desde metadatos de TypeORM
    if (event?.metadata?.primaryColumns?.length > 0) {
      for (const col of event.metadata.primaryColumns) {
        const val = entity[col.propertyName];
        if (val) return String(val);
      }
    }

    // 3. Fallback referencial: entry.id (timing_records, vet_inspections)
    if (entity.entry?.id) return String(entity.entry.id);
    if (entity.entry_id) return String(entity.entry_id);

    return null;
  }

  /**
   * Asegura que el valor de entityId sea un UUID válido. Si no lo es,
   * lo transforma determinísticamente a formato UUID usando un hash MD5.
   */
  private toSafeUuid(val: any): string | null {
    if (!val) return null;
    const str = String(val);
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(str)) {
      return str.toLowerCase();
    }
    try {
      const hash = crypto.createHash("md5").update(str).digest("hex");
      return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    } catch (err) {
      console.error(
        "[AuditSubscriber] Error generating safe UUID from string:",
        err,
      );
      return null;
    }
  }
}
