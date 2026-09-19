require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const csvStringify = require('csv-stringify/sync');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
});

// ---------------------------------------------------
// Middleware to verify JWT and attach role
// ---------------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret');
    req.user = payload; // { userId, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide' });
  }
}

// ---------------------------------------------------
// Health check
// ---------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------
// Auth: register or login with phone (simple)
// ---------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    // Assign role 'citizen' by default; admin phone can be added later
    const role = phone === 'admin@onep.ci' ? 'admin' : 'citizen';
    const result = await pool.query(
      `INSERT INTO users (phone, role) VALUES ($1, $2) ON CONFLICT (phone) DO NOTHING RETURNING id, phone, role, created_at`,
      [phone, role]
    );
    if (result.rows.length === 0) {
      const already = await pool.query(
        `SELECT id, phone, role, created_at FROM users WHERE phone = $1`,
        [phone]
      );
      return res.json({ user: already.rows[0], message: 'Utilisateur existant' });
    }
    res.json({ user: result.rows[0], message: 'Compte créé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur base de données' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { phone } = req.body;
  const user = await pool.query(`SELECT id, phone, role FROM users WHERE phone = $1`, [phone]);
  if (user.rows.length === 0) return res.status(404).json({ error: 'Utilisateur inconnu' });
  const token = jwt.sign(
    { userId: user.rows[0].id, role: user.rows[0].role },
    process.env.JWT_SECRET || 'super-secret',
    { expiresIn: '24h' }
  );
  res.json({ token, user: user.rows[0] });
});

// ---------------------------------------------------
// Roles helper (middleware)
// ---------------------------------------------------
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    next();
  };
}

// ---------------------------------------------------
// Signalements (reports) — CREATE
// ---------------------------------------------------
app.post('/api/signalements', authMiddleware, async (req, res) => {
  const { type, description, lat, lon, photo_url } = req.body;
  const userId = req.user.userId;
  if (!type || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'type, lat, lon are required' });
  }
  const geom = `SRID=4326 POINT(${lon} ${lat})`;
  try {
    const result = await pool.query(
      `INSERT INTO signalements (type, description, location, photo_url, user_id, status)
       VALUES ($1,$2,$3,$4,$5,'en_attente')
       RETURNING id, type, description, ST_AsGeoJSON(location) AS geojson, photo_url, created_at, status`,
      [type, description || null, geom, photo_url || null, userId]
    );
    // Award points for reporting (example 10 points)
    await pool.query(
      `INSERT INTO points_log (user_id, gain, reason) VALUES ($1, 10, 'signalement')`,
      [userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------
// Signalements — LIST (with optional filters)
// ---------------------------------------------------
app.get('/api/signalements', authMiddleware, async (req, res) => {
  const { type, start, end, status } = req.query;
  let query = `SELECT id, type, description, ST_AsGeoJSON(location) AS geojson, photo_url, created_at, status FROM signalements WHERE 1=1`;
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
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }
  // Optional: near search (if lat/lon provided) – use ST_DWithin
  if (req.user && req.user.role === 'inspector') {
    const { lat, lon, radius = 5000 } = req.query;
    if (lat && lon) {
      query += ` AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($${idx}, $${idx+1}), 4326)::geography, $${idx+2}::double precision)`;
      params.push(parseFloat(lon), parseFloat(lat), radius / 1000); // radius in km
      idx += 3;
    }
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

// ---------------------------------------------------
// Bulk update status (admin only)
// ---------------------------------------------------
app.patch('/api/signalements/bulk-status', authMiddleware, requireRole('admin'), async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    return res.status(400).json({ error: 'ids array and status required' });
  }
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  try {
    await pool.query(
      `UPDATE signalements SET status = $${ids.length + 1} WHERE id IN (${placeholders})`,
      [...ids, status]
    );
    res.json({ message: `${ids.length} signalements mis à jour vers "${status}"` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------
// Nearby search (inspectors)
// ---------------------------------------------------
app.get('/api/signalements/near', authMiddleware, requireRole('inspector'), async (req, res) => {
  const { lat, lon, radius = 5 } = req.query; // radius in km
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon required' });
  }
  try {
    const result = await pool.query(
      `SELECT id, type, description, ST_AsGeoJSON(location) AS geojson, photo_url, created_at, status
       FROM signalements
       WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3 * 1000
              )`,
      [parseFloat(lon), parseFloat(lat), parseFloat(radius)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------
// Dashboard stats (for admin)
// ---------------------------------------------------
app.get('/api/dashboard/stats', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*) AS cnt FROM signalements`);
    const byType = await pool.query(
      `SELECT type, COUNT(*) AS cnt FROM signalements GROUP BY type ORDER BY cnt DESC`
    );
    const recent = await pool.query(
      `SELECT created_at FROM signalements ORDER BY created_at DESC LIMIT 5`
    );
    res.json({
      total: total.rows[0].cnt,
      byType: byType.rows,
      recent: recent.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------
// Points summary for a user
// ---------------------------------------------------
app.get('/api/users/me/points', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(gain),0) AS total_gain FROM points_log WHERE user_id = $1`,
      [userId]
    );
    res.json({ totalPoints: result.rows[0].total_gain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------
// Export signalements as CSV (admin)
// ---------------------------------------------------
app.get('/api/signalements/export', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { type, start, end } = req.query;
    let query = `SELECT id, type, description, ST_AsText(location) AS location_wkt, photo_url, created_at, status FROM signalements WHERE 1=1`;
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
    const result = await pool.query(query, params);
    // Transform to CSV string
    const fields = ['id', 'type', 'description', 'location_wkt', 'photo_url', 'created_at', 'status'];
    const csv = csvStringify.stringify(result.rows, { header: true, fields });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=signalements.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
