# EquusCronos - Monorepo Principal

Sistema integral de misión crítica para la **gestión de competencias ecuestres**, cronometraje de precisión y auditoría veterinaria.

## Arquitectura
Este repositorio utiliza una estructura de **Monorepo** para garantizar la consistencia entre la lógica de negocio y las aplicaciones cliente.

- **/apps**: Aplicaciones finales (API, Web Administrativa, Apps Móviles).
- **/libs**: Librerías compartidas (Base de Datos, DTOs, Lógica de cálculo).
- **/docs**: Documentación técnica, MER y reglamentos.
- **/infra**: Configuración de Docker, Redis y scripts de despliegue.

## Stack Tecnológico
- **Backend:** NestJS (Node.js + TypeScript).
- **Base de Datos:** PostgreSQL 15 + Redis (Live Timers).
- **Mobile:** React Native + Expo.
- **Web:** Next.js.
