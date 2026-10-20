import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserDeviceToken } from "./entities/user-device-token.entity";
import { UserCompetitionSubscription } from "./entities/user-competition-subscription.entity";
import { Competition } from "../competitions/entities/competition.entity";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDeviceToken,
      UserCompetitionSubscription,
      Competition,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
