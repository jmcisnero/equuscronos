import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

interface ProgressiveProfilingModalProps {
  visible: boolean;
  onClose: () => void;
  actionTitle?: string;
  onSuccess?: () => void;
}

export const ProgressiveProfilingModal: React.FC<ProgressiveProfilingModalProps> = ({
  visible,
  onClose,
  actionTitle = "Activar Notificaciones de Competencia",
  onSuccess,
}) => {
  const { loginGoogle, loginApple, isLoading } = useAuthStore();
  const [optInMarketing, setOptInMarketing] = useState(true);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleGoogleSignIn = async () => {
    try {
      // Simulación o llamado al SDK de Google Sign-In con token mock
      const mockGoogleId = `google_${Math.random().toString(36).substring(2, 10)}`;
      const mockEmail = `aficionado_${Math.random().toString(36).substring(2, 6)}@gmail.com`;
      await loginGoogle(mockGoogleId, mockEmail, "Aficionado Google", optInMarketing);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn("Google Sign-In error:", err);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      // Simulación o llamado a Apple Auth (Obligatorio iOS)
      const mockAppleId = `apple_${Math.random().toString(36).substring(2, 10)}`;
      await loginApple(mockAppleId, undefined, "Aficionado Apple", optInMarketing);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn("Apple Sign-In error:", err);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🔔</Text>
          </View>

          <Text style={styles.title}>Completa tu Registro</Text>
          <Text style={styles.subtitle}>
            Para {actionTitle.toLowerCase()}, vincula tu identidad con un solo clic sin perder tu configuración.
          </Text>

          {/* Switch opt-in novedades ecuestres */}
          <View style={styles.optInRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optInTitle}>Novedades Ecuestres</Text>
              <Text style={styles.optInSubtitle}>
                Recibir alertas sobre nuevos raides y calendario de competencias.
              </Text>
            </View>
            <Switch
              value={optInMarketing}
              onValueChange={setOptInMarketing}
              trackColor={{ false: colors.switchTrackOff, true: colors.primaryStrong }}
              thumbColor={optInMarketing ? colors.primary : colors.switchThumbOff}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 15 }} />
          ) : (
            <View style={styles.buttonsContainer}>
              {/* Botón Google */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continuar con Google</Text>
              </TouchableOpacity>

              {/* Botón Apple (Obligatorio en iOS) */}
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.appleIcon}></Text>
                <Text style={styles.appleText}>Sign in with Apple</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
            <Text style={styles.cancelLinkText}>Continuar en Modo Invitado</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: isDark ? colors.background : colors.surface,
    borderRadius: 20,
    padding: 22,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 17,
  },
  optInRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? colors.surface : colors.surfaceSunken,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
  },
  optInTitle: {
    color: colors.textStrong,
    fontSize: 12,
    fontWeight: "700",
  },
  optInSubtitle: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  buttonsContainer: {
    width: "100%",
    gap: 10,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: isDark ? "#ffffff" : colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  googleIcon: {
    color: "#4285F4",
    fontWeight: "900",
    fontSize: 16,
  },
  googleText: {
    color: "#1e293b",
    fontWeight: "800",
    fontSize: 14,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: isDark ? colors.border : "#000000",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  appleIcon: {
    color: "#ffffff",
    fontSize: 18,
  },
  appleText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  cancelLink: {
    marginTop: 14,
  },
  cancelLinkText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
