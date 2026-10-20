import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { HeaderBrand } from "../components/HeaderBrand";
import { ProgressiveProfilingModal } from "../components/ProgressiveProfilingModal";
import { useAuthStore } from "../store/useAuthStore";
import { Theme, ThemePreference, useTheme, useThemedStyles } from "../theme/useTheme";

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: string }[] = [
  { id: "system", label: "Sistema", icon: "📱" },
  { id: "light", label: "Claro", icon: "☀️" },
  { id: "dark", label: "Oscuro", icon: "🌙" },
];

export const ProfileScreen: React.FC = () => {
  const { user, isGuest, optInMarketing, logout, updateProfile, isLoading } =
    useAuthStore();
  const { colors, isDark, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [modalVisible, setModalVisible] = useState(false);
  const [updatingOptIn, setUpdatingOptIn] = useState(false);

  const handleToggleOptIn = async (val: boolean) => {
    setUpdatingOptIn(true);
    try {
      await updateProfile(undefined, val);
    } catch (err: any) {
      Alert.alert("Error", "No se pudo actualizar el consentimiento.");
    } finally {
      setUpdatingOptIn(false);
    }
  };

  const switchColors = (value: boolean) => ({
    trackColor: { false: colors.switchTrackOff, true: colors.primaryStrong },
    thumbColor: value ? colors.primary : colors.switchThumbOff,
  });

  return (
    <View style={styles.container}>
      <HeaderBrand />

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* User Header Badge */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "IN"}
            </Text>
          </View>

          <Text style={styles.userName}>{user?.name || "Usuario Invitado"}</Text>
          <Text style={styles.userEmail}>{user?.email || "Sin correo asociado"}</Text>

          <View
            style={[
              styles.guestBadge,
              isGuest ? styles.isGuestBadge : styles.isRegBadge,
            ]}
          >
            <Text
              style={[
                styles.guestBadgeText,
                isGuest ? styles.isGuestText : styles.isRegText,
              ]}
            >
              {isGuest ? "MODO INVITADO (SIN REGISTRO)" : "CUENTA VERIFICADA"}
            </Text>
          </View>

          {isGuest && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeButtonText}>
                🚀 Vincular Cuenta (Google / Apple)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Apariencia */}
        <Text style={styles.sectionHeader}>APARIENCIA</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Modo Oscuro</Text>
              <Text style={styles.settingSub}>
                {preference === "system"
                  ? "Siguiendo la preferencia del sistema"
                  : "Selección manual"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => setPreference(val ? "dark" : "light")}
              {...switchColors(isDark)}
            />
          </View>

          <View style={styles.segmented}>
            {THEME_OPTIONS.map((opt) => {
              const active = preference === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setPreference(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.segmentIcon}>{opt.icon}</Text>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Preferencias de Marketing / Novedades */}
        <Text style={styles.sectionHeader}>PREFERENCIAS Y MARKETING</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Opt-In Novedades Ecuestres</Text>
              <Text style={styles.settingSub}>
                Consentimiento explícito para recibir novedades de EquusCronos
              </Text>
            </View>
            {updatingOptIn ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={optInMarketing}
                onValueChange={handleToggleOptIn}
                {...switchColors(optInMarketing)}
              />
            )}
          </View>
        </View>

        {/* Acciones de Sesión */}
        <Text style={styles.sectionHeader}>GESTIÓN DE SESIÓN</Text>
        <View style={styles.settingsCard}>
          {!isGuest ? (
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.loginBtnText}>Iniciar Sesión / Registrarse</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Progressive Profiling Modal */}
      <ProgressiveProfilingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        actionTitle="Guardar tu Perfil y Preferencias"
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
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
      ...cardShadow,
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    avatarText: {
      color: colors.onPrimary,
      fontWeight: "900",
      fontSize: 22,
    },
    userName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    userEmail: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    guestBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginTop: 10,
    },
    isGuestBadge: {
      backgroundColor: colors.warningSoft,
      borderWidth: 1,
      borderColor: colors.warningBorder,
    },
    isRegBadge: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    guestBadgeText: {
      fontSize: 9,
      fontWeight: "900",
    },
    isGuestText: {
      color: colors.warning,
    },
    isRegText: {
      color: colors.primary,
    },
    upgradeButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      marginTop: 14,
      width: "100%",
      alignItems: "center",
    },
    upgradeButtonText: {
      color: colors.onPrimary,
      fontWeight: "800",
      fontSize: 13,
    },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 18,
      marginBottom: 8,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    settingTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    settingSub: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    segmented: {
      flexDirection: "row",
      backgroundColor: colors.surfaceSunken,
      borderRadius: 10,
      padding: 3,
      marginTop: 12,
      gap: 3,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    segmentIcon: {
      fontSize: 12,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    segmentTextActive: {
      color: colors.primary,
    },
    logoutBtn: {
      paddingVertical: 10,
      alignItems: "center",
    },
    logoutBtnText: {
      color: colors.danger,
      fontWeight: "800",
      fontSize: 13,
    },
    loginBtn: {
      paddingVertical: 10,
      alignItems: "center",
    },
    loginBtnText: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 13,
    },
  });
