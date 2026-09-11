-- ==========================================================
-- EQUUSCRONOS MIGRATION 002
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- Descripción: Agregar campos de descalificación a la tabla competition_entries
-- ==========================================================

ALTER TABLE competition_entries 
  ADD COLUMN IF NOT EXISTS disqualification_reason VARCHAR(50),
  ADD COLUMN IF NOT EXISTS disqualification_notes TEXT,
  ADD COLUMN IF NOT EXISTS disqualified_at_stage INT;
