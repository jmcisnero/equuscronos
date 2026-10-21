import React from "react";
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

/** Paleta sincronizada con public-web (HeartPulseBadge). */
export const PULSE_COLORS = {
  ok: "#1C4F38", // Verde institucional EquusCronos (≤ límite)
  high: "#E11D48", // Rojo carmín reglamentario (> límite, Art. 31/54)
  empty: "#94A3B8", // Gris neutro sin dato
} as const;

const RECHECK_LABEL: Record<"PENDING" | "PASSED" | "OBSERVED" | "FAILED", { text: string; a11y: string }> = {
  PENDING: { text: "(R)", a11y: "Rechequeo solicitado, pendiente (Art. 21/31)" },
  PASSED: { text: "(R) ✓", a11y: "Rechequeo aprobado (Art. 21/31)" },
  OBSERVED: { text: "(R) Obs.", a11y: "Larga observado con firma (Art. 21/31)" },
  FAILED: { text: "(R) ✕", a11y: "Descalificado en rechequeo (Art. 21/31)" },
};

/**
 * Corazón geométrico (cuadrado rotado + 2 círculos) dibujado con Views.
 * A diferencia del glifo ♥, no depende de métricas de fuente, por lo que
 * nunca se recorta en Android/iOS. El lienzo exterior incluye margen
 * perimetral para que los lóbulos no desborden.
 */
const Heart: React.FC<{ side: number; color: string }> = ({ side, color }) => {
  const half = side / 2;
  return (
    <View
      style={{
        width: side,
        height: side,
        transform: [{ rotate: "45deg" }],
        // Extensión rotada: arriba -0.854·side, abajo +0.707·side respecto al centro.
        // marginTop compensa ese desbalance (con justifyContent:center desplaza m/2).
        marginTop: half * 0.3,
      }}
    >
      <View style={{ position: "absolute", width: side, height: side, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          left: -half,
          top: 0,
          width: side,
          height: side,
          borderRadius: half,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          top: -half,
          width: side,
          height: side,
          borderRadius: half,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

/**
 * Frecuencia cardíaca en Vet Gate (equivalente a HeartPulseBadge web).
 * Verde ≤ límite, carmín > límite, dorado + 🏆 para el Trofeo al Menor Pulso (Art. 42).
 * El badge (R) se ubica debajo, separado de la base del corazón.
 */
export const HeartPulseBadge: React.FC<HeartPulseBadgeProps> = ({
  pulse,
  maxHeartRate,
  isTrophyWinner = false,
  isRecheck = false,
  recheckStatus,
  size = "md",
}) => {
  const { isDark } = useTheme();
  const tones = getRaceTones(isDark);
  const status = recheckStatus || (isRecheck ? "PENDING" : null);

  const side = size === "lg" ? 26 : 21;
  // Lienzo con holgura: ancho/alto del corazón rotado ≈ 1.75·side
  const canvasW = Math.round(side * 1.85);
  const canvasH = Math.round(side * 1.75);

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
      <View style={styles.wrap} accessibilityLabel="Sin registro de pulso">
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
          <Text style={[styles.empty, { color: PULSE_COLORS.empty }]}>--</Text>
        </View>
        {recheck}
      </View>
    );
  }

  const value = Number(pulse);
  const isHigh = value > maxHeartRate;
  const color = isTrophyWinner ? tones.trophy : isHigh ? PULSE_COLORS.high : PULSE_COLORS.ok;

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${value} pulsaciones por minuto, ${
        isHigh ? "excede" : "dentro de"
      } el límite de ${maxHeartRate}${isTrophyWinner ? ", Trofeo al Menor Pulso" : ""}`}
    >
      <View style={styles.row}>
        {isTrophyWinner && <Text style={styles.trophy}>🏆</Text>}
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
          <Heart side={side} color={color} />
          <Text
            style={[styles.value, { fontSize: size === "lg" ? 13 : 11 }]}
            allowFontScaling={false}
            numberOfLines={1}
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
  wrap: { alignItems: "center", justifyContent: "center", gap: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  canvas: { alignItems: "center", justifyContent: "center", padding: 2, overflow: "visible" },
  value: {
    position: "absolute",
    alignSelf: "center",
    color: "#FFFFFF",
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    includeFontPadding: false,
  },
  trophy: { fontSize: 16 },
  empty: { fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"], textAlign: "center" },
  recheck: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  recheckText: { fontSize: 9, fontWeight: "900" },
});
