# App: Public Web (Resultados y Seguimiento en Vivo)

Portal web de acceso universal desarrollado en **Next.js**, diseñado para la visualización en tiempo real de **competencias ecuestres**.

## Propósito del MVP
Proporcionar una ventana de transparencia total al público, patrocinadores y familiares. Al ser una aplicación web, elimina la necesidad de descargar una app móvil, permitiendo el acceso mediante el escaneo de códigos QR distribuidos en el evento.

## Funcionalidades Críticas
- **Tablero de Posiciones (Leaderboard):** Clasificación en vivo actualizada por categorías y etapas.
- **Seguimiento por Binomio:** Ficha detallada de cada participante con sus tiempos de llegada, velocidades promedio y estatus clínico.
- **Relojes de Competencia:** Visualización de la cuenta regresiva para las próximas largadas (neutralizaciones).
- **Mapa del Evento:** Información sobre la ubicación de los checkpoints y zonas de inspección.

## Stack Tecnológico
- **Framework:** Next.js 14+ (App Router).
- **Comunicación:** WebSockets (Socket.io) para actualizaciones de tiempos sin refrescar la página.
- **Estilos:** Tailwind CSS (optimizado para visualización en dispositivos móviles).

## Valor Agregado
Este módulo es esencial para la difusión del deporte, permitiendo que los resultados sean compartidos fácilmente en redes sociales y aplicaciones de mensajería, aumentando la visibilidad de los clubes organizadores y sus patrocinadores.
