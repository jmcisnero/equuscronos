import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import ApiService from "../services/ApiService";

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrl, setApiUrl] = useState(ApiService.getBaseUrl());
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Datos requeridos",
        "Por favor complete su correo y contraseña.",
      );
      return;
    }
    setLoading(true);
    try {
      // Guardar URL actual de la API en el servicio antes de autenticar
      ApiService.setBaseUrl(apiUrl);
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert(
        "Error de Inicio de Sesión",
        error.message || "Credenciales inválidas o servidor inalcanzable.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo / Brand Header */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo_leyenda.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>
              SISTEMA DE CRONOMETRAJE ECUESTRE
            </Text>
            <Text style={styles.badgeText}>FIELD APP</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Servidor API (Local o Cloud)</Text>
            <TextInput
              style={styles.input}
              placeholder="http://192.168.1.12:3000"
              placeholderTextColor="#94A3B8"
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>INICIAR SESIÓN</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              EquusCronos v1.0.0 • Offline-First Engine
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1E14", // Dark green background for ultimate premium contrast
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#132F23", // Lighter container
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#24523C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoImage: {
    width: 220,
    height: 120,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.equusTanLight,
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    backgroundColor: "#C2410C",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 10,
    letterSpacing: 1,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 6,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    backgroundColor: "#1C3E2E",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2D664C",
  },
  loginButton: {
    height: 54,
    backgroundColor: colors.equusTanLight,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonText: {
    color: "#0B1E14",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#1E4632",
    paddingTop: 16,
  },
  footerText: {
    color: "#5C826F",
    fontSize: 11,
    fontWeight: "600",
  },
});
