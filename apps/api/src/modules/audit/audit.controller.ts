import { Controller, Get, Query, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("Auditoría (Audit)")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
@Controller("admin/audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Listar logs de auditoría paginados" })
  findAll(
    @Request() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
  ) {
    return this.auditService.findAll(
      req.user,
      page,
      limit,
      userId,
      action,
      entityType,
    );
  }
}
