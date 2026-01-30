# App: Admin Web (Gestión Centralizada)

Panel de control basado en **Next.js** para la administración estratégica de las competencias ecuestres.

## Propósito
Esta plataforma es utilizada por los administradores de los clubes y delegados para la configuración previa y el cierre oficial de los eventos.

## Funcionalidades Clave
- **Configuración de Calendario:** Creación de competencias y definición de etapas/checkpoints.
- **Gestión de Padrones:** Alta y validación de Jinetes (FEU/CI), Caballos (Chip) y Propietarios.
- **Reportes Oficiales:** Generación de planillas de resultados finales y exportación de datos para la federación.
- **Monitor de Auditoría:** Interfaz para revisar el historial de cambios (`audit_logs`) en caso de disputas.

## Seguridad
Acceso restringido a usuarios con roles `ADMIN` y `JUDGE`. Implementa autenticación robusta para proteger la integridad del ranking nacional.
