-- ==========================================================
-- EQUUSCRONOS PRODUCTION LEAST-PRIVILEGE ROLE SETUP
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- Objetivo: Restringir privilegios del usuario de aplicación NestJS para evitar
--           comandos DDL destructivos (DROP, TRUNCATE) en la base de datos de Producción.
-- ==========================================================

-- 1. Crear usuario de aplicación con contraseña segura (Si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equus_app_user') THEN
        CREATE ROLE equus_app_user WITH LOGIN PASSWORD 'CHANGE_IN_PRODUCTION_SECURE_PASS';
    END IF;
END $$;

-- 2. Otorgar acceso de conexión a la base de datos y esquema public
GRANT CONNECT ON DATABASE equuscronos TO equus_app_user;
GRANT USAGE ON SCHEMA public TO equus_app_user;

-- 3. Otorgar permisos exclusivamente DML (SELECT, INSERT, UPDATE, DELETE) sobre tablas existentes y futuras
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO equus_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO equus_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO equus_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO equus_app_user;

-- 4. Revocar expresamente permisos DDL destructivos (TRUNCATE, DROP)
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM equus_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM equus_app_user;

-- El usuario equus_app_user NO es SUPERUSER ni posee permisos DDL.
-- Las migraciones de base de datos deben ejecutarse con un usuario DDL administrativo separado (ej. equus_migration_user).
