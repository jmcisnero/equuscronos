import React, { useEffect, useMemo } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../theme/useTheme";
import { getRaceTones } from "../../theme/raceTones";
import { getRaceStatusInfo } from "../../utils/raceFormat";

/**
 * Pulso "en vivo" compartido por todos los badges: un solo Animated.Value con
 * driver nativo (hilo de UI, sin re-renders de React). Ref-counting: el loop
 * corre solo mientras haya algún badge activo montado, por lo que filas
 * recicladas por FlatList no generan timers ni fugas.
 */
const livePulse = new Animated.Value(0);
let liveLoop: Animated.CompositeAnimation | null = null;
let liveSubscribers = 0;

function subscribeLivePulse(): () => void {
  liveSubscribers += 1;
  if (!liveLoop) {
    liveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    liveLoop.start();
  }
  return () => {
    liveSubscribers -= 1;
    if (liveSubscribers <= 0 && liveLoop) {
      liveLoop.stop();
      liveLoop = null;
      liveSubscribers = 0;
      livePulse.setValue(0);
    }
  };
}

const dotOpacity = livePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
const dotScale = livePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });

/** Badge de estado del binomio (equivalente a renderStatusBadge de la web). */
export const RaceStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { isDark } = useTheme();
  const info = getRaceStatusInfo(status);
  const tone = useMemo(() => getRaceTones(isDark).status[info.tone], [isDark, info.tone]);
  const isLive = info.tone !== "out" && info.tone !== "neutral" && info.tone !== "finished";

  useEffect(() => (isLive ? subscribeLivePulse() : undefined), [isLive]);

  return (
    <View
      style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}
      accessibilityLabel={info.description || info.label}
    >
      {isLive && (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: tone.dot, opacity: dotOpacity, transform: [{ scale: dotScale }] },
          ]}
        />
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
