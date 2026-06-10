import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../services/AuthContext';

interface PermissionErrorScreenProps {
  expectedRoles: string[];
  currentRole: string;
  onBack: () => void;
}

export const PermissionErrorScreen: React.FC<PermissionErrorScreenProps> = ({
  expectedRoles,
  currentRole,
  onBack
}) => {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🛑</Text>
        </View>

        <Text style={styles.title}>Error de Permisos</Text>
        <Text style={styles.description}>
          Su cuenta no tiene los privilegios necesarios para acceder a esta sección del sistema.
        </Text>

        <View style={styles.detailsBox}>
          <Text style={styles.detailText}>
            <Text style={styles.bold}>Su Rol:</Text> {currentRole}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.bold}>Roles requeridos:</Text> {expectedRoles.join(', ')}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Volver al Panel Principal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.equusBg,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#991B1B',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  detailsBox: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 16,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailText: {
    fontSize: 13,
    color: colors.equusText,
    marginBottom: 6,
  },
  bold: {
    fontWeight: '800',
    color: colors.muted,
  },
  primaryButton: {
    backgroundColor: colors.equusGreen,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
  },
});
