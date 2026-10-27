import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
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

interface ExpoPushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
}

interface ExpoPushTicket {
  status?: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const EXPO_TOKEN_PREFIXES = ["ExponentPushToken[", "ExpoPushToken["];
const isExpoToken = (t: string | null | undefined): t is string =>
  Boolean(t && EXPO_TOKEN_PREFIXES.some((p) => t.startsWith(p)));

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
      const expoTokens = [
        ...new Set(subscriptions.map((s) => s.deviceToken?.deviceToken).filter(isExpoToken)),
      ];

      if (expoTokens.length === 0) {
        this.logger.log(`No valid Expo push tokens found among ${subscriptions.length} subscriptions.`);
        return;
      }

      this.logger.log(`Sending Push Notification [${eventLabel}] to ${expoTokens.length} devices...`);

      await this.dispatchExpo(expoTokens, title, body, {
        ...dataPayload,
        competitionId,
        eventType: eventTypes[0],
      }, eventLabel);
    } catch (err: unknown) {
      this.logger.error(`Error sending push notifications: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * Difusión de una competencia recién publicada a TODOS los dispositivos
   * activos (incluye invitados/anónimos). Una competencia nueva aún no tiene
   * suscriptores, por eso no puede usarse el envío por suscripción.
   * Clave idempotente por competencia para evitar duplicados.
   */
  async broadcastNewCompetition(competition: {
    id: string;
    name: string;
    competitionDate: string | Date;
    location?: string | null;
  }): Promise<void> {
    const key = `competition-created:${competition.id}`;
    if (this.sentKeys.has(key)) return;
    this.sentKeys.add(key);

    try {
      const rows = await this.tokenRepo.find({
        where: { isActive: true, pushProvider: "expo" },
        select: ["deviceToken"],
      });
      const tokens = [...new Set(rows.map((r) => r.deviceToken).filter(isExpoToken))];
      if (tokens.length === 0) {
        this.logger.log(`Broadcast competition ${competition.id}: no active devices.`);
        return;
      }

      const date =
        typeof competition.competitionDate === "string"
          ? competition.competitionDate.substring(0, 10)
          : competition.competitionDate.toISOString().substring(0, 10);
      const where = competition.location ? ` · ${competition.location}` : "";

      await this.dispatchExpo(
        tokens,
        `🐎 Nueva competencia: ${competition.name}`,
        `${date}${where}. Tocá para ver los detalles.`,
        {
          competitionId: competition.id,
          eventType: "COMPETITION_CREATED",
          name: competition.name,
          competitionDate: date,
          location: competition.location ?? null,
        },
        "COMPETITION_CREATED",
      );
    } catch (err: unknown) {
      this.logger.error(`Error broadcasting new competition: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * Envía mensajes vía Expo Push API en lotes de 100, registra errores por
   * ticket y desactiva los tokens que Expo reporta como no registrados.
   */
  private async dispatchExpo(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
    label: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      channelId: "default",
      data: { ...data, timestamp },
    }));

    const chunkSize = 100;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      try {
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
        const payload = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
        if (!res.ok) {
          failed += chunk.length;
          this.logger.error(`Expo Push HTTP ${res.status}: ${JSON.stringify(payload)}`);
          continue;
        }
        const tickets = Array.isArray(payload?.data) ? payload.data : [];
        tickets.forEach((ticket, idx) => {
          if (ticket?.status !== "error") return;
          failed++;
          const code = ticket.details?.error ?? "unknown";
          this.logger.warn(`Expo ticket error for ${chunk[idx]?.to}: ${ticket.message} (${code})`);
          if (code === "DeviceNotRegistered" && chunk[idx]) invalidTokens.push(chunk[idx].to);
        });
      } catch (err: unknown) {
        failed += chunk.length;
        this.logger.error(`Expo Push batch failed: ${(err as Error)?.message ?? err}`);
      }
    }

    if (invalidTokens.length > 0) {
      await this.tokenRepo
        .update({ deviceToken: In(invalidTokens) }, { isActive: false })
        .catch((err: Error) => this.logger.warn(`Token cleanup failed: ${err.message}`));
      this.logger.log(`Deactivated ${invalidTokens.length} unregistered push tokens.`);
    }

    this.logger.log(
      `Dispatched ${messages.length - failed}/${messages.length} push notifications for event ${label}`,
    );
  }
}
