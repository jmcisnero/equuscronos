# 🗄️ Librería de Base de Datos (Core Data)

Este módulo es la **Única Fuente de Verdad** para el esquema de datos utilizado en la gestión de competencias ecuestres de EquusCronos.

## 📁 Estructura Interna
- `/src/migrations`: Scripts SQL de estructura (v001).
- `/src/seeds`: Datos de prueba (Clubes, Jinetes, Caballos, etc).
- `/src/queries`: Consultas de validación de integridad y reportes.

## 🛡️ Seguridad
Implementa una **Caja Negra de Auditoría** (`audit_logs`) que registra de forma inmutable cada cambio en tiempos, pulsaciones o pesajes, garantizando la transparencia frente a fraudes.
