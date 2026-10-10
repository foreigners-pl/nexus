-- Migration 54: Add protocol extras column to services for optional/add-on data
ALTER TABLE services ADD COLUMN IF NOT EXISTS protocol_extras JSONB DEFAULT '{}';
