import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Servicio de Push Notifications (desacoplado).
 *
 * - NO registra el token en el backend: eso lo hace useAuthStore tras un login exitoso.
 * - NUNCA lanza excepciones: ante cualquier fallo retorna null, para no bloquear
 *   el renderizado ni la carga de datos públicos (competencias / leaderboard).
 * - Sin un projectId de EAS válido (UUID) no intenta pedir token remoto. Es el
 *   comportamiento esperado en Expo Go sin `eas init`.
 */

// Configurar cómo se comportan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

async function ensureAndroidChannel(): Promise<void> {
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

    await ensureAndroidChannel();

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
