import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantsService } from "./tenants.service";
import { TenantsController } from "./tenants.controller";
import { Tenant } from "./entities/tenant.entity";
import { AssetsModule } from "../assets/assets.module";

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AssetsModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
