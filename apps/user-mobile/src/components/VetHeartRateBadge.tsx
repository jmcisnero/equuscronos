import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Theme, useThemedStyles } from "../theme/useTheme";

interface VetHeartRateBadgeProps {
  heartRate?: number;
  maxHeartRate?: number;
  isRecheck?: boolean;
  recheckStatus?: "PENDING" | "PASSED" | "OBSERVED" | "FAILED" | null;
}

export const VetHeartRateBadge: React.FC<VetHeartRateBadgeProps> = ({
  heartRate,
  maxHeartRate = 64,
  isRecheck,
  recheckStatus,
}) => {
  const styles = useThemedStyles(createStyles);

  if (!heartRate && !isRecheck) {
    return (
      <View style={styles.emptyBadge}>
        <Text style={styles.emptyText}>-- bpm</Text>
      </View>
    );
  }

  const isApproved = heartRate ? heartRate <= maxHeartRate : true;

  if (isRecheck) {
    return (
      <View style={styles.recheckContainer}>
        <Text style={styles.recheckValue}>{heartRate ? `${heartRate} bpm` : "--"}</Text>
        <View style={styles.recheckBadge}>
          <Text style={styles.recheckText}>RECHEQUEO</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isApproved ? styles.passContainer : styles.failContainer,
      ]}
    >
      <Text style={[styles.valueText, isApproved ? styles.passText : styles.failText]}>
        {heartRate} bpm
      </Text>
      <Text style={[styles.subText, isApproved ? styles.passText : styles.failText]}>
        {isApproved ? "APTO" : "EXCEDIDO"}
      </Text>
    </View>
  );
};

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 62,
    },
    passContainer: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    failContainer: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    emptyBadge: {
      backgroundColor: colors.surfaceSunken,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      minWidth: 54,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "600",
    },
    valueText: {
      fontSize: 11,
      fontWeight: "800",
    },
    subText: {
      fontSize: 8,
      fontWeight: "700",
    },
    passText: {
      color: colors.primary,
    },
    failText: {
      color: colors.danger,
    },
    recheckContainer: {
      backgroundColor: colors.warningSoft,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignItems: "center",
    },
    recheckValue: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: "800",
    },
    recheckBadge: {
      backgroundColor: "#f59e0b",
      paddingHorizontal: 4,
      borderRadius: 4,
      marginTop: 2,
    },
    recheckText: {
      color: "#0f172a",
      fontSize: 7,
      fontWeight: "900",
    },
  });
