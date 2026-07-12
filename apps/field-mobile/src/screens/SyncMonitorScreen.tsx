import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { getDatabase } from "../database/db";
import SyncService from "../services/SyncService";

interface SyncMonitorScreenProps {
  onBack: () => void;
}

interface ProcessedQueueItem {
  id: number;
  action_type: string;
  table_name: string;
  payload: string;
  created_at: string;
  attempts: number;
  error_message?: string | null;
  bib: string;
}

export const SyncMonitorScreen: React.FC<SyncMonitorScreenProps> = ({
  onBack,
}) => {
  const [queueItems, setQueueItems] = useState<ProcessedQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(SyncService.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const translateActionType = (type: string): string => {
    switch (type) {
      case "CREATE_TIMING":
        return "Registro de Tiempo";
      case "CREATE_VET_INSPECTION":
        return "Control Veterinario";
      case "UPDATE_ENTRY_STATUS":
        return "Actualización de Estado";
      case "UPDATE_TIMING":
        return "Edición de Tiempo";
      case "VOID_TIMING":
        return "Anulación de Tiempo";
      default:
        return type;
    }
  };

  const translateErrorMessage = (
    errorStr: string | null | undefined,
  ): string => {
    if (!errorStr) return "Sin mensaje de error.";

    const errUpper = errorStr.toUpperCase();

    if (errUpper.includes("409") || errUpper.includes("CONFLICT")) {
      return "Código 409: Conflicto - El Dorsal o registro ya fue procesado para esta etapa en el servidor.";
    }
    if (errUpper.includes("403") || errUpper.includes("FORBIDDEN")) {
      return "Código 403: Acceso denegado - El rol del dispositivo no tiene permisos para esta operación.";
    }
    if (errUpper.includes("401") || errUpper.includes("UNAUTHORIZED")) {
      return "Código 401: Sesión expirada - Por favor inicie sesión nuevamente.";
    }
    if (errUpper.includes("404") || errUpper.includes("NOT FOUND")) {
      return "Código 404: No encontrado - El competidor o etapa no existe en el servidor.";
    }
    if (errUpper.includes("400") || errUpper.includes("BAD REQUEST")) {
      return "Código 400: Validación fallida - Los datos no cumplen con las reglas del reglamento FEU.";
    }
    if (
      errUpper.includes("500") ||
      errUpper.includes("INTERNAL") ||
      errUpper.includes("TIMEOUT")
    ) {
      return "Error 500: Tiempo de espera agotado o error interno del servidor.";
    }

    return errorStr;
  };

  const loadQueue = async () => {
    try {
      const db = await getDatabase();
      const raw = await db.getAllAsync<any>(
        "SELECT * FROM sync_queue ORDER BY id DESC;",
      );

      const processed: ProcessedQueueItem[] = [];
      for (const item of raw) {
        let bib = "N/A";
        try {
          const payload = JSON.parse(item.payload);
          if (item.action_type === "CREATE_TIMING") {
            const entry = await db.getFirstAsync<{ bib_number: number }>(
              "SELECT bib_number FROM competition_entries WHERE id = ?;",
              [payload.entry_id],
            );
            if (entry) bib = `Dorsal ${entry.bib_number}`;
          } else if (item.action_type === "UPDATE_ENTRY_STATUS") {
            const entry = await db.getFirstAsync<{ bib_number: number }>(
              "SELECT bib_number FROM competition_entries WHERE id = ?;",
              [payload.id],
            );
            if (entry) bib = `Dorsal ${entry.bib_number}`;
          } else if (
            item.action_type === "UPDATE_TIMING" ||
            item.action_type === "VOID_TIMING"
          ) {
            const entry = await db.getFirstAsync<{ bib_number: number }>(
              "SELECT ce.bib_number FROM timing_records tr JOIN competition_entries ce ON tr.entry_id = ce.id WHERE tr.id = ?;",
              [payload.id],
            );
            if (entry) bib = `Dorsal ${entry.bib_number}`;
          } else if (item.action_type === "CREATE_VET_INSPECTION") {
            const entry = await db.getFirstAsync<{ bib_number: number }>(
              "SELECT ce.bib_number FROM timing_records tr JOIN competition_entries ce ON tr.entry_id = ce.id WHERE tr.id = ?;",
              [payload.timing_record_id],
            );
            if (entry) bib = `Dorsal ${entry.bib_number}`;
          }
        } catch (e) {
          console.warn(
            "[SyncMonitor] Error parsing payload for item:",
            item.id,
            e,
          );
        }

        processed.push({
          ...item,
          bib,
        });
      }

      setQueueItems(processed);
    } catch (err) {
      console.error("[SyncMonitor] Failed to query sync queue:", err);
      Alert.alert("Error", "No se pudo consultar la cola local.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();

    // Listen to queue changes
    const unsubscribeQueue = SyncService.registerQueueListener(() => {
      loadQueue();
    });

    // Listen to connectivity changes
    const unsubscribeStatus = SyncService.registerStatusListener(
      (connected) => {
        setIsOnline(connected);
      },
    );

    return () => {
      // Clean listeners
      unsubscribeQueue();
      unsubscribeStatus();
    };
  }, []);

  const handleForceSync = async () => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "Se requiere conexión a Internet para sincronizar.",
      );
      return;
    }
    setIsSyncing(true);
    try {
      await SyncService.forceSync();
      await loadQueue();
    } catch (e) {
      Alert.alert("Error", "Ocurrió un fallo en la sincronización.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetry = async (id: number) => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "Conéctese a Internet para reintentar la sincronización.",
      );
      return;
    }
    setLoading(true);
    try {
      await SyncService.resetItemAndSync(id);
      Alert.alert("Procesado", "Intento de reenvío completado.");
      await loadQueue();
    } catch (err: any) {
      Alert.alert("Fallo", `Reintento fallido: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = (id: number) => {
    Alert.alert(
      "Descartar Acción",
      "¿Está seguro de que desea descartar este cambio? El servidor no recibirá esta actualización y podría haber inconsistencia de datos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await SyncService.discardItem(id);
              await loadQueue();
            } catch (err) {
              Alert.alert("Error", "No se pudo descartar el registro.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleCopyReport = async (item: ProcessedQueueItem) => {
    try {
      const report = `[REPORTE DE ERROR - EQUUSCRONOS FIELD APP]
ID Registro: ${item.id}
Acción: ${translateActionType(item.action_type)} (Tabla: ${item.table_name})
Dorsal/Binomio: ${item.bib}
Fecha Intento: ${new Date(item.created_at).toLocaleString()}
Intentos de Envío: ${item.attempts}
Mensaje de Error del Servidor: ${item.error_message || "Sin mensaje de error."}
Mensaje de Error Traducido: ${translateErrorMessage(item.error_message)}
Payload (JSON Bruto):
${item.payload}`;

      await Clipboard.setStringAsync(report);
      Alert.alert(
        "Reporte Copiado",
        "El reporte del error y su payload se han copiado al portapapeles para su envío manual.",
      );
    } catch (err: any) {
      Alert.alert(
        "Error",
        `No se pudo copiar el reporte: ${err?.message || err}`,
      );
    }
  };

  const renderItem = ({ item }: { item: ProcessedQueueItem }) => {
    const isFailed = item.attempts > 0;
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isFailed) {
              setExpandedId(isExpanded ? null : item.id);
            }
          }}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.actionText}>
              {translateActionType(item.action_type)}
            </Text>
            <Text style={styles.bibText}>{item.bib}</Text>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleTimeString()} (ID: {item.id})
            </Text>
          </View>

          <View style={styles.cardHeaderRight}>
            <View
              style={[
                styles.statusBadge,
                isFailed ? styles.badgeFailed : styles.badgePending,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isFailed ? "FALLADO" : "PENDIENTE"}
              </Text>
            </View>
            <Text style={styles.attemptsText}>Intentos: {item.attempts}</Text>
          </View>
        </TouchableOpacity>

        {isFailed && isExpanded && (
          <View style={styles.errorDetailsContainer}>
            <Text style={styles.errorLabel}>Detalle del Error:</Text>
            <Text style={styles.errorMessage}>
              {translateErrorMessage(item.error_message)}
            </Text>

            <Text style={styles.payloadLabel}>Carga útil (JSON):</Text>
            <Text style={styles.payloadText}>{item.payload}</Text>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.retryBtn]}
                onPress={() => handleRetry(item.id)}
              >
                <Text style={styles.actionBtnText}>🔄 Reintentar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.discardBtn]}
                onPress={() => handleDiscard(item.id)}
              >
                <Text style={styles.actionBtnText}>🗑️ Descartar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, styles.copyBtn, { marginTop: 10 }]}
              onPress={() => handleCopyReport(item)}
            >
              <Text style={styles.actionBtnText}>
                📋 Copiar Reporte de Error
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>⬅️ Volver</Text>
        </TouchableOpacity>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.title}>DIAGNÓSTICO</Text>
          <View style={styles.connectionIndicator}>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: isOnline ? "#10B981" : "#EF4444" },
              ]}
            />
            <Text style={styles.connectionText}>
              {isOnline ? "CONECTADO" : "DESCONECTADO"}
            </Text>
          </View>
        </View>
      </View>

      {/* Sync Status Banner */}
      <View style={styles.statusBanner}>
        <View>
          <Text style={styles.bannerTitle}>Cola de Sincronización</Text>
          <Text style={styles.bannerSubtitle}>
            {queueItems.length} elementos pendientes en cola local
          </Text>
        </View>

        {queueItems.length > 0 && (
          <TouchableOpacity
            style={[styles.syncButton, !isOnline && styles.syncButtonDisabled]}
            disabled={isSyncing || !isOnline}
            onPress={handleForceSync}
          >
            {isSyncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Forzar Sync</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Cargando registros SQLite...</Text>
        </View>
      ) : (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                🎉 Todo sincronizado correctamente.
              </Text>
              <Text style={styles.emptySubtext}>
                No hay registros pendientes en SQLite.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // Dark Slate for high solar contrast
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#334155",
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#334155",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#475569",
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  connectionText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "900",
  },
  statusBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 16,
    margin: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#334155",
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  bannerSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#059669",
  },
  syncButtonDisabled: {
    backgroundColor: "#475569",
    borderColor: "#334155",
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
    fontSize: 15,
    fontWeight: "700",
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#334155",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  bibText: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  dateText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  cardHeaderRight: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
  },
  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "#F59E0B",
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  attemptsText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
  },
  errorDetailsContainer: {
    backgroundColor: "#0F172A",
    borderTopWidth: 2,
    borderTopColor: "#334155",
    padding: 14,
  },
  errorLabel: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  errorMessage: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    marginBottom: 12,
  },
  payloadLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  payloadText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontFamily: "monospace",
    backgroundColor: "#1E293B",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  retryBtn: {
    backgroundColor: "#10B981",
    borderColor: "#059669",
  },
  discardBtn: {
    backgroundColor: "#EF4444",
    borderColor: "#DC2626",
  },
  copyBtn: {
    backgroundColor: "#334155",
    borderColor: "#475569",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySubtext: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
});
