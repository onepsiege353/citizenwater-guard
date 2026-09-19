require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a new signalement (report)
app.post('/api/signalements', async (req, res) => {
  const { type, description, lat, lon, photo_url, user_id } = req.body;
  if (!type || !lat || !lon) {
    return res.status(400).json({ error: 'type, lat, lon are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO signalements (type, description, location, photo_url, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5, NOW())
       RETURNING id, type, created_at`,
      [type, description, `SRID=4326 POINT(${lon} ${lat})`, photo_url || null, user_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// List signalements (optionally filtered by type or date)
app.get('/api/signalements', async (req, res) => {
  const { type, start, end } = req.query;
  let query = `SELECT id, type, description, ST_AsGeoJSON(location) AS geojson, photo_url, created_at FROM signalements WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (type) {
    query += ` AND type = $${idx}`;
    params.push(type);
    idx++;
  }
  if (start) {
    query += ` AND created_at >= $${idx}`;
    params.push(start);
    idx++;
  }
  if (end) {
    query += ` AND created_at <= $${idx}`;
    params.push(end);
    idx++;
  }
  query += ` ORDER BY created_at DESC`;
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});