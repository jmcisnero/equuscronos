import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { RegisterTokenDto } from "./dto/register-token.dto";
import { SubscribeCompetitionDto } from "./dto/subscribe-competition.dto";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("register-token")
  @HttpCode(HttpStatus.OK)
  async registerToken(@Body() dto: RegisterTokenDto, @Req() req: any) {
    const userId = req.user?.id || undefined;
    const tokenEntity = await this.notificationsService.registerToken(dto, userId);
    return {
      success: true,
      data: tokenEntity,
    };
  }

  @Post("subscribe")
  @HttpCode(HttpStatus.OK)
  async subscribe(@Body() dto: SubscribeCompetitionDto, @Req() req: any) {
    const userId = req.user?.id || undefined;
    const subscription = await this.notificationsService.subscribeToCompetition(dto, userId);
    return {
      success: true,
      data: subscription,
    };
  }

  @Post("unsubscribe")
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Body("deviceToken") deviceToken: string,
    @Body("competitionId") competitionId: string,
  ) {
    return this.notificationsService.unsubscribeFromCompetition(deviceToken, competitionId);
  }

  @Get("subscriptions")
  async getSubscriptions(@Query("deviceToken") deviceToken: string) {
    if (!deviceToken) {
      return { success: true, data: [] };
    }
    const subscriptions = await this.notificationsService.getSubscriptionsByDevice(deviceToken);
    return {
      success: true,
      data: subscriptions,
    };
  }
}
