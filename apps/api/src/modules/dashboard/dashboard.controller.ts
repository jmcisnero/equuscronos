import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("1. Dashboard Central")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
@Controller("admin/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  @ApiOperation({
    summary:
      "Obtener métricas y estadísticas operativas del padrón ecuestre en tiempo real",
  })
  getStats() {
    return this.dashboardService.getStats();
  }
}
