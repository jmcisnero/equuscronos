import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/useTheme";
import { getRaceTones } from "../../theme/raceTones";

type RecheckStatus = "PENDING" | "PASSED" | "OBSERVED" | "FAILED" | null | undefined;

interface HeartPulseBadgeProps {
  pulse?: number | null;
  maxHeartRate: number;
  isTrophyWinner?: boolean;
  isRecheck?: boolean;
  recheckStatus?: RecheckStatus;
  size?: "md" | "lg";
}

const RECHECK_LABEL: Record<"PENDING" | "PASSED" | "OBSERVED" | "FAILED", { text: string; a11y: string }> = {
  PENDING: { text: "(R)", a11y: "Rechequeo solicitado, pendiente (Art. 21/31)" },
  PASSED: { text: "(R) ✓", a11y: "Rechequeo aprobado (Art. 21/31)" },
  OBSERVED: { text: "(R) Obs.", a11y: "Larga observado con firma (Art. 21/31)" },
  FAILED: { text: "(R) ✕", a11y: "Descalificado en rechequeo (Art. 21/31)" },
};

/**
 * Corazón con la frecuencia cardíaca dentro (equivalente a HeartPulseBadge web).
 * Verde ≤ límite, rojo > límite, dorado + 🏆 para el Trofeo al Menor Pulso (Art. 42).
 * Se usa el glifo ♥ en lugar de SVG para no añadir react-native-svg al bundle.
 */
export const HeartPulseBadge: React.FC<HeartPulseBadgeProps> = ({
  pulse,
  maxHeartRate,
  isTrophyWinner = false,
  isRecheck = false,
  recheckStatus,
  size = "md",
}) => {
  const { isDark, colors } = useTheme();
  const tones = useMemo(() => getRaceTones(isDark), [isDark]);
  const status = recheckStatus || (isRecheck ? "PENDING" : null);
  const dim = size === "lg" ? 44 : 36;

  const recheck = status ? (
    <View
      style={[
        styles.recheck,
        { backgroundColor: tones.recheck[status].bg, borderColor: tones.recheck[status].border },
      ]}
      accessibilityLabel={RECHECK_LABEL[status].a11y}
    >
      <Text style={[styles.recheckText, { color: tones.recheck[status].text }]}>
        {RECHECK_LABEL[status].text}
      </Text>
    </View>
  ) : null;

  if (pulse === undefined || pulse === null || isNaN(Number(pulse))) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>--</Text>
        {recheck}
      </View>
    );
  }

  const value = Number(pulse);
  const isHigh = value > maxHeartRate;
  const color = isTrophyWinner ? tones.trophy : isHigh ? tones.heartHigh : tones.heartOk;

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${value} pulsaciones por minuto, ${
        isHigh ? "excede" : "dentro de"
      } el límite de ${maxHeartRate}${isTrophyWinner ? ", Trofeo al Menor Pulso" : ""}`}
    >
      <View style={styles.row}>
        {isTrophyWinner && <Text style={styles.trophy}>🏆</Text>}
        <View style={{ width: dim, height: dim, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={[styles.heart, { color, fontSize: dim * 1.05, lineHeight: dim * 1.15 }]}
            allowFontScaling={false}
          >
            ♥
          </Text>
          <Text
            style={[styles.value, { fontSize: size === "lg" ? 13 : 11 }]}
            allowFontScaling={false}
          >
            {value}
          </Text>
        </View>
      </View>
      {recheck}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  heart: { position: "absolute", textAlign: "center", includeFontPadding: false },
  value: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: -2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 1,
  },
  trophy: { fontSize: 16 },
  empty: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  recheck: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  recheckText: { fontSize: 9, fontWeight: "900" },
});
