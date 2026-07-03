import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "./entities/audit-log.entity";
import { AuditAction, UserRole } from "@equuscronos/shared";

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(
    currentUser: any,
    page = 1,
    limit = 10,
    userId?: string,
    action?: string,
    entityType?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page as any, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as any, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // RLS Enforcement: CLUB_ADMIN can only see their own club's audit logs.
    if (currentUser.role === UserRole.CLUB_ADMIN) {
      where.tenant = { id: currentUser.tenantId };
    }

    if (userId) {
      where.user = { id: userId };
    }

    if (action) {
      if (action === "CREATE") {
        where.action = AuditAction.INSERT;
      } else {
        where.action = action as AuditAction;
      }
    }

    if (entityType) {
      const typeMap: Record<string, string> = {
        Horse: "horses",
        Competition: "competitions",
        Rider: "riders",
        horse: "horses",
        competition: "competitions",
        rider: "riders",
        horses: "horses",
        competitions: "competitions",
        riders: "riders",
      };
      where.entityName = typeMap[entityType] || entityType;
    }

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: ["user", "tenant"],
      order: { createdAt: "DESC" },
      skip,
      take: limitNum,
    });

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }
}
