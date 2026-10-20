import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserDeviceToken } from "./entities/user-device-token.entity";
import { UserCompetitionSubscription } from "./entities/user-competition-subscription.entity";
import { RegisterTokenDto } from "./dto/register-token.dto";
import { SubscribeCompetitionDto } from "./dto/subscribe-competition.dto";
import { Competition } from "../competitions/entities/competition.entity";
import fetch from "node-fetch";

export type NotificationEventType =
  | "STATUS_CHANGE"
  | "STAGE_START"
  | "VET_GATE"
  | "OFFICIAL_RESULTS";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(UserDeviceToken)
    private readonly tokenRepo: Repository<UserDeviceToken>,
    @InjectRepository(UserCompetitionSubscription)
    private readonly subRepo: Repository<UserCompetitionSubscription>,
    @InjectRepository(Competition)
    private readonly compRepo: Repository<Competition>,
  ) {}

  /**
   * Registra o actualiza el token de dispositivo Expo / FCM
   */
  async registerToken(dto: RegisterTokenDto, userId?: string): Promise<UserDeviceToken> {
    const existing = await this.tokenRepo.findOne({
      where: { deviceToken: dto.deviceToken },
    });

    const targetUserId = userId || dto.userId || null;

    if (existing) {
      existing.platform = dto.platform || existing.platform;
      existing.pushProvider = dto.pushProvider || existing.pushProvider;
      existing.isActive = true;
      if (targetUserId) {
        existing.userId = targetUserId;
      }
      return this.tokenRepo.save(existing);
    }

    const tokenEntity = this.tokenRepo.create({
      deviceToken: dto.deviceToken,
      platform: dto.platform || "android",
      pushProvider: dto.pushProvider || "expo",
      userId: targetUserId,
      isActive: true,
    });

    return this.tokenRepo.save(tokenEntity);
  }

  /**
   * Suscribe un token/usuario a una competencia específica con filtros de evento
   */
  async subscribeToCompetition(dto: SubscribeCompetitionDto, userId?: string) {
    const tokenEntity = await this.registerToken(
      { deviceToken: dto.deviceToken },
      userId,
    );

    const competition = await this.compRepo.findOne({
      where: { id: dto.competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competencia ${dto.competitionId} no encontrada.`);
    }

    let sub = await this.subRepo.findOne({
      where: {
        deviceTokenId: tokenEntity.id,
        competitionId: dto.competitionId,
      },
    });

    if (sub) {
      sub.notifyStatusChange = dto.notifyStatusChange ?? sub.notifyStatusChange;
      sub.notifyStageStart = dto.notifyStageStart ?? sub.notifyStageStart;
      sub.notifyVetGate = dto.notifyVetGate ?? sub.notifyVetGate;
      sub.notifyOfficialResults = dto.notifyOfficialResults ?? sub.notifyOfficialResults;
      if (userId) sub.userId = userId;
    } else {
      sub = this.subRepo.create({
        deviceTokenId: tokenEntity.id,
        competitionId: dto.competitionId,
        userId: userId || tokenEntity.userId,
        notifyStatusChange: dto.notifyStatusChange ?? true,
        notifyStageStart: dto.notifyStageStart ?? true,
        notifyVetGate: dto.notifyVetGate ?? true,
        notifyOfficialResults: dto.notifyOfficialResults ?? true,
      });
    }

    return this.subRepo.save(sub);
  }

  /**
   * Desuscribirse de una competencia
   */
  async unsubscribeFromCompetition(deviceToken: string, competitionId: string) {
    const tokenEntity = await this.tokenRepo.findOne({
      where: { deviceToken },
    });
    if (!tokenEntity) return { success: true };

    await this.subRepo.delete({
      deviceTokenId: tokenEntity.id,
      competitionId,
    });

    return { success: true };
  }

  /**
   * Obtiene suscripciones activas para un token de dispositivo
   */
  async getSubscriptionsByDevice(deviceToken: string) {
    const tokenEntity = await this.tokenRepo.findOne({
      where: { deviceToken },
    });
    if (!tokenEntity) return [];

    return this.subRepo.find({
      where: { deviceTokenId: tokenEntity.id },
      relations: ["competition"],
    });
  }

  /**
   * Motor de disparo masivo de notificaciones push vía Expo API
   */
  async sendCompetitionPushNotification(
    competitionId: string,
    eventType: NotificationEventType,
    title: string,
    body: string,
    dataPayload: Record<string, any> = {},
  ) {
    try {
      // 1. Obtener todas las suscripciones activas para la competencia y el tipo de evento
      const query = this.subRepo
        .createQueryBuilder("sub")
        .innerJoinAndSelect("sub.deviceToken", "dt")
        .where("sub.competition_id = :competitionId", { competitionId })
        .andWhere("dt.is_active = true");

      if (eventType === "STATUS_CHANGE") {
        query.andWhere("sub.notify_status_change = true");
      } else if (eventType === "STAGE_START") {
        query.andWhere("sub.notify_stage_start = true");
      } else if (eventType === "VET_GATE") {
        query.andWhere("sub.notify_vet_gate = true");
      } else if (eventType === "OFFICIAL_RESULTS") {
        query.andWhere("sub.notify_official_results = true");
      }

      const subscriptions = await query.getMany();
      if (subscriptions.length === 0) {
        this.logger.log(`No active subscriptions found for competition ${competitionId} (${eventType})`);
        return;
      }

      const expoTokens = subscriptions
        .map((s) => s.deviceToken?.deviceToken)
        .filter((t): t is string => Boolean(t && t.startsWith("ExpoPushToken[")));

      if (expoTokens.length === 0) {
        this.logger.log(`No valid Expo push tokens found among ${subscriptions.length} subscriptions.`);
        return;
      }

      this.logger.log(`Sending Push Notification [${eventType}] to ${expoTokens.length} devices...`);

      // 2. Formatear mensajes para Expo Push Service API
      const messages = expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: {
          ...dataPayload,
          competitionId,
          eventType,
          timestamp: new Date().toISOString(),
        },
      }));

      // 3. Enviar peticiones en bloques (Expo acepta hasta 100 por lote)
      const chunkSize = 100;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });
      }

      this.logger.log(`Successfully dispatched ${messages.length} push notifications for event ${eventType}`);
    } catch (err: any) {
      this.logger.error(`Error sending push notifications: ${err?.message || err}`);
    }
  }
}
