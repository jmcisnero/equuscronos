export enum RegulationType {
  FEU = "FEU", // Reglas Fed. Ecuestre Uruguaya
  FEI = "FEI", // Reglas Fed. Ecuestre Internacional
  INDEPENDENT = "INDEPENDENT", // Pruebas locales o de entrenamiento
}

//CONTROLLED_SPEED (Velocidad Controlada): Es la base del Raid Hípico Uruguayo (FEU). Se rige por promedios de tiempo y penalizaciones por exceso de velocidad.
//FREE_SPEED (Velocidad Libre): Es el estándar de Endurance FEI y de las pruebas de largo aliento de la FEU. Aquí el binomio gestiona su ritmo, pero el cronómetro no se detiene hasta que el pulso baja del límite (ej. 64 bpm).
//FLAT_RACING (Carrera Plana): Es el estándar del Turf / Hipódromos. No hay etapas ni Vet Gates.
export enum CompetitionModality {
  CONTROLLED_SPEED = "CONTROLLED_SPEED", // Raid: Promedio objetivo (FEU)
  FREE_SPEED = "FREE_SPEED", // Endurance: Tiempo + Recuperación
  FLAT_RACING = "FLAT_RACING", // Carrera común: Tiempo de pista
}

export enum CompetitionStatus {
  PLANNED = "PLANNED", // Organización, pesaje, seteo de reglas (Pulsaciones)
  ACTIVE = "ACTIVE", // Carrera en curso y cronómetros activos
  PAUSED = "PAUSED", // Suspensión temporal por fuerza mayor (Ej. clima)
  COMPLETED = "COMPLETED", // Último caballo cruzó la meta (Resultados preliminares)
  OFFICIAL = "OFFICIAL", // Resultados firmados e inmutables (Auditoría cerrada)
  CANCELLED = "CANCELLED", // Evento anulado definitivamente
}

//Estado dinámico del binomio durante la carrera
export enum ParticipantStatus {
  IN_RACE = "IN_RACE", // Compitiendo en etapa
  VET_CHECK = "VET_CHECK", // En inspección veterinaria
  RESTING = "RESTING", // Cumpliendo tiempo de neutralización
  FINISHED = "FINISHED", // Carrera completada con éxito
  DQ = "DQ", // Descalificado (Pulso, Cojera, etc.)
  DNF = "DNF", // No terminó (Retiro voluntario)
  WD = "WD", // Retiro antes de iniciar
  NO_COMPLETED = "NO_COMPLETED", // No Completó / No Placed (NC)
  ELIMINATED_TR = "ELIMINATED_TR", // Eliminado por Tiempo de Recuperación
  ELIMINATED_PP = "ELIMINATED_PP", // Eliminado por Pulso / Parámetros
  ELIMINATED_GAIT = "ELIMINATED_GAIT", // Eliminado por Aire Irregular
  FAIL_WEIGHT = "FAIL_WEIGHT", // Falta de Peso (Art. 20)
  FINISHED_PROVISIONAL = "FINISHED_PROVISIONAL", // Finalizado provisional (última etapa, pendiente firma de actas)
  DQ_ROUTE = "DQ_ROUTE", // Desvío de Itinerario (Art. 25)
  DQ_ASSISTANCE = "DQ_ASSISTANCE", // Ayuda en los últimos 500m (Art. 26 lit. a)
  DQ_DISMOUNTED = "DQ_DISMOUNTED", // Avanzar desmontado hacia la meta (Art. 26 lit. d)
  DQ_VET_ROUTE = "DQ_VET_ROUTE", // Ética / Extenuación en Ruta (Art. 34)
  DQ_OVERTIME = "DQ_OVERTIME", // Fuera de Tiempo (Art. 32, 55)
  DQ_OLYMPIC = "DQ_OLYMPIC", // Eliminado en Presentación Olímpica (Art. 38, 39, 56)
}

//Tipos de eventos cronometrados
export enum TimeRecordType {
  START = "START", // Largada de etapa
  ARRIVAL = "ARRIVAL", // Cruce de meta (Llegada)
  VET_IN = "VET_IN", // Entrada a inspección (Cierra tiempo de recuperación)
  VET_OUT = "VET_OUT", // Salida de inspección / Re-inspección
}
