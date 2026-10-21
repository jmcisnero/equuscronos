import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/useTheme";
import { getRaceTones } from "../../theme/raceTones";
import { getRaceStatusInfo } from "../../utils/raceFormat";

/** Badge de estado del binomio (equivalente a renderStatusBadge de la web). */
export const RaceStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { isDark } = useTheme();
  const info = getRaceStatusInfo(status);
  const tone = useMemo(() => getRaceTones(isDark).status[info.tone], [isDark, info.tone]);

  return (
    <View
      style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}
      accessibilityLabel={info.description || info.label}
    >
      {info.tone !== "out" && info.tone !== "neutral" && info.tone !== "finished" && (
        <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      )}
      <Text style={[styles.text, { color: tone.text }]} numberOfLines={1}>
        {info.icon ? `${info.icon} ` : ""}
        {info.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "800" },
});
