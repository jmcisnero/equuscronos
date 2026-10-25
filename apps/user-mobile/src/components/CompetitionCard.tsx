import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Competition } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

interface CompetitionCardProps {
  competition: Competition;
  isSelected?: boolean;
  onPress: (competition: Competition) => void;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  isSelected,
  onPress,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { label: "EN VIVO", bg: colors.primarySoft, border: colors.primaryBorder, fg: colors.primary };
      case "PLANNED":
        return { label: "PLANIFICADA", bg: colors.surfaceMuted, border: colors.border, fg: colors.info };
      case "COMPLETED":
      case "OFFICIAL":
        // El estado interno "OFFICIAL" se presenta como finalizada:
        // la app no emite resultados oficiales de la federación.
        return { label: "FINALIZADA", bg: colors.neutralSoft, border: colors.neutralBorder, fg: colors.textSecondary };
      default:
        return { label: status, bg: colors.neutralSoft, border: colors.neutralBorder, fg: colors.textSecondary };
    }
  };

  const status = getStatusStyle(competition.status);
  const isFederated = competition.isFederated === true;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={() => onPress(competition)}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={styles.tenantContainer}>
          {competition.tenant?.jerseyImageUrl ? (
            <Image
              source={{ uri: competition.tenant.jerseyImageUrl }}
              style={styles.logo}
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>
                {competition.tenant?.name ? competition.tenant.name.substring(0, 2).toUpperCase() : "EC"}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.tenantName} numberOfLines={1}>
              {competition.tenant?.name || "Organización Ecuestre"}
            </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {competition.location || "Uruguay"}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {competition.name}
      </Text>

      {/* Fila inferior: fecha | tipo (FEDERADA/SOCIAL) | estado */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          <Text style={styles.dateText} numberOfLines={1}>
            📅 {competition.competitionDate ? competition.competitionDate.split("T")[0] : "A confirmar"}
          </Text>
        </View>
        <View style={styles.footerCenter}>
          <View style={[styles.pill, isFederated ? styles.federatedPill : styles.socialPill]}>
            <Text style={[styles.pillText, { color: isFederated ? colors.warning : colors.textSecondary }]}>
              {isFederated ? "FEDERADA" : "SOCIAL"}
            </Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <View style={[styles.pill, { backgroundColor: status.bg, borderColor: status.border }]}>
            {competition.status === "ACTIVE" && <View style={[styles.liveDot, { backgroundColor: status.fg }]} />}
            <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = ({ colors, cardShadow }: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    selectedCard: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: colors.surfaceSelected,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    tenantContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    logoFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    logoFallbackText: {
      color: colors.textStrong,
      fontWeight: "800",
      fontSize: 11,
    },
    tenantName: {
      color: colors.textStrong,
      fontSize: 13,
      fontWeight: "700",
    },
    locationText: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 1,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 10,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    footerLeft: { flex: 1, alignItems: "flex-start" },
    footerCenter: { flex: 1, alignItems: "center" },
    footerRight: { flex: 1, alignItems: "flex-end" },
    dateText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    federatedPill: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
    },
    socialPill: {
      backgroundColor: colors.neutralSoft,
      borderColor: colors.neutralBorder,
    },
    pillText: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
  });
