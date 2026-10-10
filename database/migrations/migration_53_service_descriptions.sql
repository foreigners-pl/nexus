-- Migration 53: Add description columns to services and service_steps
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE service_steps ADD COLUMN IF NOT EXISTS description TEXT;
