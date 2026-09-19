-- PostgreSQL migration script for CitizenWater Guard
-- Run with: psql -U user -d citizenwater -f db_setup.sql

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (simple, phone number as identifier)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signalements (reports) table
CREATE TABLE IF NOT EXISTS signalements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,          -- 'fuite', 'qualite', 'orpaillage', 'autre'
    description TEXT,
    location GEOMETRY(Point, 4326) NOT NULL,   -- POINT(lon lat)
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'en_attente', -- en_attente, valide, resolu
    points INTEGER DEFAULT 0
);

-- Index for spatial query
CREATE INDEX IF NOT EXISTS signalements_location_idx ON signalements USING GIST (location);

-- Points / gamification table (optional)
CREATE TABLE IF NOT EXISTS points_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    gain INTEGER NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert a few reference types (optional)
INSERT INTO signalements (type, description, location, status) VALUES
    ('fuite', 'Fuite détectée sur un robinet ou une conduite', ST_SetSRID(ST_MakePoint(-4.0057, 5.3696), 4326), 'en_attente'),
    ('qualite', 'Anomalie de couleur ou d\'odeur', ST_SetSRID(ST_MakePoint(-4.01, 5.37), 4326), 'en_attente'),
    ('orpaillage', 'Activité d\'orpaillage suspecte', ST_SetSRID(ST_MakePoint(-4.02, 5.38), 4326), 'en_attente'),
    ('autre', 'Autre problème', ST_SetSRID(ST_MakePoint(-4.03, 5.39), 4326), 'en_attente')
ON CONFLICT DO NOTHING;
