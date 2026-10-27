import type * as NotificationsModule from "expo-notifications";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * Servicio de Push Notifications (desacoplado).
 *
 * - NO registra el token en el backend: eso lo hace useAuthStore tras un login exitoso.
 * - NUNCA lanza excepciones: ante cualquier fallo retorna null, para no bloquear
 *   el renderizado ni la carga de datos públicos (competencias / leaderboard).
 * - Sin un projectId de EAS válido (UUID) no intenta pedir token remoto.
 * - Expo Go (SDK 53+) en Android lanza un error al IMPORTAR expo-notifications,
 *   por eso el módulo se carga de forma diferida y solo fuera de Expo Go
 *   (development build / producción).
 */

/** true cuando la app corre dentro de Expo Go (sin push remoto). */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cachedModule: typeof NotificationsModule | null | undefined;

/** Carga diferida y segura de expo-notifications (null en Expo Go o ante error). */
function getNotifications(): typeof NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (isExpoGo) {
    console.warn("[PushNotifications] Expo Go detectado: notificaciones push deshabilitadas (usar development build).");
    cachedModule = null;
    return null;
  }
  try {
    const mod: typeof NotificationsModule = require("expo-notifications");
    // Comportamiento de las notificaciones con la app en primer plano
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    cachedModule = mod;
  } catch (error) {
    console.warn("[PushNotifications] expo-notifications no disponible:", error);
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * Registra listeners de notificaciones (primer plano y tap).
 * Devuelve una función de limpieza; no hace nada en Expo Go.
 */
export function addNotificationListeners(handlers: {
  onReceived?: (title?: string | null, body?: string | null) => void;
  onResponse?: (data: Record<string, unknown>) => void;
}): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => undefined;
  const received = Notifications.addNotificationReceivedListener((n) =>
    handlers.onReceived?.(n.request.content.title, n.request.content.body),
  );
  const response = Notifications.addNotificationResponseReceivedListener((r) =>
    handlers.onResponse?.((r.notification.request.content.data ?? {}) as Record<string, unknown>),
  );
  return () => {
    received.remove();
    response.remove();
  };
}

/**
 * Datos de la notificación que abrió la app desde estado "cerrada" (cold start).
 * null si no aplica / Expo Go.
 */
export async function getInitialNotificationData(): Promise<Record<string, unknown> | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    return (last?.notification.request.content.data ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Resuelve el projectId de EAS en orden de prioridad:
 * 1. Variable de entorno EXPO_PUBLIC_EAS_PROJECT_ID
 * 2. app.json → expo.extra.eas.projectId
 * 3. Constants.easConfig (builds de EAS)
 */
export function getEasProjectId(): string | null {
  const candidates = [
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    (Constants.expoConfig?.extra as any)?.eas?.projectId,
    (Constants as any).easConfig?.projectId,
  ];
  const valid = candidates.find(isValidUuid);
  return valid ?? null;
}

async function ensureAndroidChannel(Notifications: typeof NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10b981",
    });
  } catch (error) {
    console.warn("[PushNotifications] No se pudo crear el canal Android:", error);
  }
}

/**
 * Solicita permisos y obtiene el Expo Push Token.
 * @returns el token, o null si no está disponible (sin lanzar nunca).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn("[PushNotifications] Emulador/simulador detectado: push remoto deshabilitado.");
      return null;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      console.warn(
        "[PushNotifications] No hay un projectId de EAS válido (UUID). " +
          "Se omite el token remoto (comportamiento esperado en Expo Go / desarrollo local). " +
          "Ejecute `eas init` o defina EXPO_PUBLIC_EAS_PROJECT_ID para habilitarlo.",
      );
      return null;
    }

    const Notifications = getNotifications();
    if (!Notifications) return null;

    await ensureAndroidChannel(Notifications);

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("[PushNotifications] El usuario no otorgó permiso para notificaciones.");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[PushNotifications] Token obtenido:", token);
    return token ?? null;
  } catch (error) {
    console.warn("[PushNotifications] Error obteniendo el push token (se continúa sin push):", error);
    return null;
  }
}
