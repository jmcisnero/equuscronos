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

  /** Claves ya notificadas en este proceso (evita duplicados por concurrencia). */
  private readonly sentKeys = new Set<string>();

  /** Columna de preferencia de la suscripción para cada tipo de evento. */
  private static readonly EVENT_COLUMN: Record<NotificationEventType, string> = {
    STATUS_CHANGE: "sub.notify_status_change",
    STAGE_START: "sub.notify_stage_start",
    VET_GATE: "sub.notify_vet_gate",
    OFFICIAL_RESULTS: "sub.notify_official_results",
  };

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
   * Igual que sendCompetitionPushNotification, pero envía una sola vez por
   * `key` dentro del proceso (p. ej. "stage-start:<stageId>").
   */
  async sendCompetitionPushNotificationOnce(
    key: string,
    competitionId: string,
    eventType: NotificationEventType | NotificationEventType[],
    title: string,
    body: string,
    dataPayload: Record<string, any> = {},
  ) {
    if (this.sentKeys.has(key)) return;
    this.sentKeys.add(key);
    return this.sendCompetitionPushNotification(competitionId, eventType, title, body, dataPayload);
  }

  /**
   * Motor de disparo masivo de notificaciones push vía Expo API.
   * Con varios tipos de evento, notifica a quien tenga activado cualquiera de ellos.
   */
  async sendCompetitionPushNotification(
    competitionId: string,
    eventType: NotificationEventType | NotificationEventType[],
    title: string,
    body: string,
    dataPayload: Record<string, any> = {},
  ) {
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
    const eventLabel = eventTypes.join("|");
    try {
      // 1. Obtener todas las suscripciones activas para la competencia y el tipo de evento
      const query = this.subRepo
        .createQueryBuilder("sub")
        .innerJoinAndSelect("sub.deviceToken", "dt")
        .where("sub.competition_id = :competitionId", { competitionId })
        .andWhere("dt.is_active = true");

      const flagColumns = eventTypes.map((t) => `${NotificationsService.EVENT_COLUMN[t]} = true`);
      query.andWhere(`(${flagColumns.join(" OR ")})`);

      const subscriptions = await query.getMany();
      if (subscriptions.length === 0) {
        this.logger.log(`No active subscriptions found for competition ${competitionId} (${eventLabel})`);
        return;
      }

      // Expo emite tokens con prefijo "ExponentPushToken[" (estándar) o "ExpoPushToken["
      const expoTokens = subscriptions
        .map((s) => s.deviceToken?.deviceToken)
        .filter((t): t is string =>
          Boolean(t && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))),
        );

      if (expoTokens.length === 0) {
        this.logger.log(`No valid Expo push tokens found among ${subscriptions.length} subscriptions.`);
        return;
      }

      this.logger.log(`Sending Push Notification [${eventLabel}] to ${expoTokens.length} devices...`);

      // 2. Formatear mensajes para Expo Push Service API
      const messages = expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: {
          ...dataPayload,
          competitionId,
          eventType: eventTypes[0],
          timestamp: new Date().toISOString(),
        },
      }));

      // 3. Enviar peticiones en bloques (Expo acepta hasta 100 por lote)
      const chunkSize = 100;
      let failed = 0;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        // Expo responde 200 aunque fallen tickets individuales: revisar cada uno
        const payload: any = await res.json().catch(() => null);
        if (!res.ok) {
          failed += chunk.length;
          this.logger.error(`Expo Push HTTP ${res.status}: ${JSON.stringify(payload)}`);
          continue;
        }
        const tickets: any[] = Array.isArray(payload?.data) ? payload.data : [];
        tickets.forEach((ticket, idx) => {
          if (ticket?.status === "error") {
            failed++;
            this.logger.warn(
              `Expo ticket error for ${chunk[idx]?.to}: ${ticket.message} (${ticket.details?.error ?? "unknown"})`,
            );
          }
        });
      }

      this.logger.log(
        `Dispatched ${messages.length - failed}/${messages.length} push notifications for event ${eventLabel}`,
      );
    } catch (err: any) {
      this.logger.error(`Error sending push notifications: ${err?.message || err}`);
    }
  }
}
