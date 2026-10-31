import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { HeaderBrand } from "../components/HeaderBrand";
import { ProgressiveProfilingModal } from "../components/ProgressiveProfilingModal";
import { useAuthStore } from "../store/useAuthStore";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

export const NotificationSettingsScreen: React.FC = () => {
  const { isGuest, deviceToken } = useAuthStore();
  const {
    competitions,
    activeCompetitionId,
    subscriptions,
    fetchSubscriptions,
    toggleSubscription,
  } = useCompetitionStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [modalVisible, setModalVisible] = useState(false);
  const [loadingCompId, setLoadingCompId] = useState<string | null>(null);

  // Canales globales (Neutralización / Vet Gate se excluyen: alta frecuencia)
  const [notifyStatusChange, setNotifyStatusChange] = useState(true);
  const [notifyStageStart, setNotifyStageStart] = useState(true);
  const [notifyFinalResults, setNotifyFinalResults] = useState(true);

  useEffect(() => {
    if (deviceToken) {
      fetchSubscriptions(deviceToken);
    }
  }, [deviceToken]);

  const handleToggleSub = async (competitionId: string) => {
    if (isGuest) {
      setModalVisible(true);
      return;
    }

    if (!deviceToken) {
      Alert.alert("Error", "No se encontró token de dispositivo para push notifications.");
      return;
    }

    setLoadingCompId(competitionId);
    try {
      const isSubscribed = subscriptions.some((s) => s.competitionId === competitionId);
      await toggleSubscription(deviceToken, competitionId, isSubscribed);
    } catch (err: any) {
      Alert.alert("Error", "No se pudo actualizar la suscripción.");
    } finally {
      setLoadingCompId(null);
    }
  };

  const switchProps = (value: boolean) => ({
    trackColor: { false: colors.switchTrackOff, true: colors.primaryStrong },
    thumbColor: value ? colors.primary : colors.switchThumbOff,
  });

  return (
    <View style={styles.container}>
      <HeaderBrand />

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.sectionHeader}>MOTOR DE NOTIFICACIONES PUSH</Text>

        {/* Device Token Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>📲</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Token de Dispositivo Mobile</Text>
              <Text style={styles.statusSub} numberOfLines={1}>
                {deviceToken || "Obteniendo token Expo / FCM..."}
              </Text>
            </View>
            <View
              style={[
                styles.tokenBadge,
                deviceToken ? styles.activeToken : styles.inactiveToken,
              ]}
            >
              <Text
                style={[
                  styles.tokenBadgeText,
                  !deviceToken && styles.inactiveTokenText,
                ]}
              >
                {deviceToken ? "ACTIVO" : "INACTIVO"}
              </Text>
            </View>
          </View>
        </View>

        {/* Canales de Alerta de Competencia */}
        <Text style={styles.sectionHeader}>CANALES DE NOTIFICACIÓN DE EVENTO</Text>
        <View style={styles.channelsCard}>
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Inicio de Competencia</Text>
              <Text style={styles.channelSub}>
                Recibe un aviso cuando la competencia haya comenzado.
              </Text>
            </View>
            <Switch
              value={notifyStatusChange}
              onValueChange={setNotifyStatusChange}
              {...switchProps(notifyStatusChange)}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Largadas de Etapa</Text>
              <Text style={styles.channelSub}>Recibe un aviso cuando se inicie una etapa.</Text>
            </View>
            <Switch
              value={notifyStageStart}
              onValueChange={setNotifyStageStart}
              {...switchProps(notifyStageStart)}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Resultados Finales</Text>
              <Text style={styles.channelSub}>
                Recibe un aviso cuando se finalice la competencia.
              </Text>
            </View>
            <Switch
              value={notifyFinalResults}
              onValueChange={setNotifyFinalResults}
              {...switchProps(notifyFinalResults)}
            />
          </View>
        </View>

        {/* Suscripciones por Competencia */}
        <Text style={styles.sectionHeader}>SUSCRIPCIÓN A COMPETENCIAS ESPECÍFICAS</Text>
        {competitions.map((comp) => {
          const isSubscribed = subscriptions.some((s) => s.competitionId === comp.id);
          const isLoadingComp = loadingCompId === comp.id;

          return (
            <View key={comp.id} style={styles.subCompCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subCompTitle} numberOfLines={1}>
                  {comp.name}
                </Text>
                <Text style={styles.subCompSub}>
                  {comp.tenant?.name || "Organización Ecuestre"} • {comp.location || "Uruguay"}
                </Text>
              </View>

              {isLoadingComp ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <TouchableOpacity
                  style={[
                    styles.subButton,
                    isSubscribed ? styles.subscribedBtn : styles.unsubscribedBtn,
                  ]}
                  onPress={() => handleToggleSub(comp.id)}
                >
                  <Text
                    style={[
                      styles.subButtonText,
                      isSubscribed ? styles.subscribedBtnText : styles.unsubscribedBtnText,
                    ]}
                  >
                    {isSubscribed ? "SIGUIENDO 🔔" : "SEGUIR ➕"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Progressive Profiling Modal */}
      <ProgressiveProfilingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        actionTitle="Activar notificaciones de competencia"
      />
    </View>
  );
};

const createStyles = ({ colors, cardShadow }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    body: {
      flex: 1,
      padding: 16,
    },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 14,
      marginBottom: 8,
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    statusIcon: {
      fontSize: 22,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    statusSub: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 2,
    },
    tokenBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    activeToken: {
      backgroundColor: colors.primarySoft,
    },
    inactiveToken: {
      backgroundColor: colors.dangerSoft,
    },
    tokenBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
    },
    inactiveTokenText: {
      color: colors.danger,
    },
    channelsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    channelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    channelTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    channelSub: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 6,
    },
    subCompCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    subCompTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    subCompSub: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 2,
    },
    subButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    subscribedBtn: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    unsubscribedBtn: {
      backgroundColor: colors.surfaceMuted,
    },
    subButtonText: {
      fontSize: 10,
      fontWeight: "800",
    },
    subscribedBtnText: {
      color: colors.primary,
    },
    unsubscribedBtnText: {
      color: colors.textStrong,
    },
  });
