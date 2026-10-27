import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompetitionsService } from "./competitions.service";
import { CompetitionsController } from "./competitions.controller";
import { Competition } from "./entities/competition.entity";
import { Stage } from "./entities/stage.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { TimingModule } from "../timing/timing.module";

@Module({
  imports: [
    // Registramos las entidades principales de este dominio (bounded context)
    TypeOrmModule.forFeature([Competition, Stage]),
    // Push a suscriptores al cambiar el estado de la competencia (largada)
    NotificationsModule,
    // RealTimeGateway (instancia única exportada por TimingModule)
    forwardRef(() => TimingModule),
  ],
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService], // Lo exportamos por si otros módulos necesitan consultar datos de la carrera
})
export class CompetitionsModule {}
