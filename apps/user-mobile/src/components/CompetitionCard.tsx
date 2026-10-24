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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { label: "EN VIVO", bg: colors.primary };
      case "PLANNED":
        return { label: "PROGRAMADA", bg: colors.info };
      case "COMPLETED":
      case "OFFICIAL":
        // El estado interno "OFFICIAL" se presenta como finalizada:
        // la app no emite resultados oficiales de la federación.
        return { label: "FINALIZADA", bg: colors.textMuted };
      default:
        return { label: status, bg: colors.textSecondary };
    }
  };

  const status = getStatusColor(competition.status);

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

        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {competition.name}
      </Text>

      <View style={styles.footerRow}>
        <Text style={styles.dateText}>
          📅 {competition.competitionDate ? competition.competitionDate.split("T")[0] : "Fecha a confirmar"}
        </Text>
        {competition.isFederated && (
          <View style={styles.federatedBadge}>
            <Text style={styles.federatedText}>FEDERADA</Text>
          </View>
        )}
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
      fontSize: 12,
      fontWeight: "700",
    },
    locationText: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusText: {
      color: "#ffffff",
      fontSize: 9,
      fontWeight: "900",
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
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    dateText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
    },
    federatedBadge: {
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.warningBorder,
    },
    federatedText: {
      color: colors.warning,
      fontSize: 8,
      fontWeight: "900",
    },
  });
