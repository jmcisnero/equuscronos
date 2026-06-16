import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from "react-native";
import { colors } from "../theme/colors";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "success" | "danger" | "outline";
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  ...rest
}) => {
  const getVariantStyles = (): { button: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case "secondary":
        return {
          button: { backgroundColor: colors.equusTanLight },
          text: { color: colors.equusText },
        };
      case "success":
        return {
          button: { backgroundColor: colors.success },
          text: { color: colors.white },
        };
      case "danger":
        return {
          button: { backgroundColor: colors.danger },
          text: { color: colors.white },
        };
      case "outline":
        return {
          button: {
            backgroundColor: "transparent",
            borderWidth: 2,
            borderColor: colors.equusGreen,
          },
          text: { color: colors.equusGreen },
        };
      case "primary":
      default:
        return {
          button: { backgroundColor: colors.equusGreen },
          text: { color: colors.white },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const isInteractionDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isInteractionDisabled}
      style={[
        styles.button,
        variantStyles.button,
        isInteractionDisabled && styles.disabledButton,
        style,
      ]}
      accessibilityRole="button"
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" ? colors.equusGreen : colors.white}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variantStyles.text,
            isInteractionDisabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56, // Large tactile height for rural field use
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginVertical: 6,
    width: "100%",
  },
  disabledButton: {
    backgroundColor: "#E2E8F0",
    borderColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: "800", // Highly legible heavy font weight
    letterSpacing: 1.2,
  },
  disabledText: {
    color: "#94A3B8",
  },
});
