import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOGO = require("../../assets/logo_isotipo.png");
/** Proporción nativa del recorte del isotipo (740x600) */
const LOGO_ASPECT = 740 / 600;

export const HeaderBrand: React.FC = () => {
  const { isLiveSocket, isClosed } = useCompetitionStore();
  const { isDark, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  // Estado de conexión del feed. Nunca se rotula como "oficial":
  // EquusCronos no es un canal emitido por la federación.
  const status = isClosed
    ? { label: "FINALIZADA", badge: styles.closedBadge, dot: styles.closedDot }
    : isLiveSocket
    ? { label: "EN VIVO", badge: styles.liveBadge, dot: styles.liveDot }
    : { label: "SINCRONIZANDO", badge: styles.pollingBadge, dot: styles.pollingDot };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.titleRow}>
        <View style={styles.logoTile}>
          <Image
            source={LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Logotipo EquusCronos"
          />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            EquusCronos
          </Text>
          <Text style={styles.brandSubtitle} numberOfLines={1}>
            Seguimiento de Competencias en Vivo
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={[styles.statusBadge, status.badge]}>
          <View style={[styles.dot, status.dot]} />
          <Text style={styles.statusText}>{status.label}</Text>
        </View>

        <TouchableOpacity
          style={styles.themeToggle}
          onPress={() => setPreference(isDark ? "light" : "dark")}
          accessibilityRole="switch"
          accessibilityState={{ checked: isDark }}
          accessibilityLabel={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          hitSlop={8}
        >
          <Text style={styles.themeToggleIcon}>{isDark ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDark ? colors.background : colors.surface,
      paddingTop: 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexShrink: 1,
    },
    // Tile claro en ambos modos: el isotipo es verde oscuro y perdería
    // contraste directamente sobre el fondo slate del modo oscuro.
    logoTile: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: isDark ? 0 : 1,
      borderColor: colors.border,
    },
    logo: {
      width: 34,
      height: 34 / LOGO_ASPECT,
    },
    brandText: {
      flexShrink: 1,
    },
    brandTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    brandSubtitle: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "500",
      marginTop: 1,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginLeft: 8,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 5,
      borderWidth: 1,
    },
    liveBadge: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
    },
    pollingBadge: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
    },
    closedBadge: {
      backgroundColor: colors.neutralSoft,
      borderColor: colors.neutralBorder,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    liveDot: { backgroundColor: colors.primary },
    pollingDot: { backgroundColor: colors.warning },
    closedDot: { backgroundColor: colors.textSecondary },
    statusText: {
      color: colors.text,
      fontSize: 9,
      fontWeight: "800",
    },
    themeToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    themeToggleIcon: {
      fontSize: 15,
    },
  });
