import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "./entities/audit-log.entity";
import { AuditSubscriber } from "./subscribers/audit.subscriber";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditSubscriber],
  exports: [TypeOrmModule], // Exportamos por si otros módulos necesitan leer los logs
})
export class AuditModule {}
