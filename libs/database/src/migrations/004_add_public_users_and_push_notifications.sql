-- ==========================================================
-- EQUUSCRONOS MIGRATION 004
-- Public Users, Push Notification Tokens & Competition Subscriptions
-- ==========================================================

-- 1. Actualizar la tabla users para soporte de usuarios públicos y opt-in marketing
ALTER TABLE users ADD COLUMN IF NOT EXISTS opt_in_marketing BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- 2. Tabla de Tokens de Dispositivos Móviles (Expo / FCM)
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500) UNIQUE NOT NULL,
    platform VARCHAR(20) NOT NULL DEFAULT 'android', -- 'ios', 'android', 'web'
    push_provider VARCHAR(20) NOT NULL DEFAULT 'expo', -- 'expo', 'fcm', 'apns'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Suscripciones por Competencia y Canales de Notificación
CREATE TABLE IF NOT EXISTS user_competition_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_token_id UUID REFERENCES user_device_tokens(id) ON DELETE CASCADE,
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    notify_status_change BOOLEAN DEFAULT TRUE,
    notify_stage_start BOOLEAN DEFAULT TRUE,
    notify_vet_gate BOOLEAN DEFAULT TRUE,
    notify_official_results BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_token_competition UNIQUE (device_token_id, competition_id)
);

-- Índices de aceleración de consultas para el motor de notificaciones
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_device_token ON user_device_tokens(device_token);
CREATE INDEX IF NOT EXISTS idx_user_comp_subs_comp_id ON user_competition_subscriptions(competition_id);
CREATE INDEX IF NOT EXISTS idx_user_comp_subs_device_token ON user_competition_subscriptions(device_token_id);
