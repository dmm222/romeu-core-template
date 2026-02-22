"use strict";

const express = require("express");
const { Pool } = require("pg");

/**
 * Construye DATABASE_URL si no existe, usando variables sueltas.
 * Recomendado en EasyPanel: DB_HOST=db (nombre del servicio), DB_PORT=5432, etc.
 */
function buildDatabaseUrlFromParts() {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const name = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;

  if (!host || !name || !user || !pass) return null;

  // encode para passwords con caracteres raros
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);
  const encHost = host; // host suele ser "db" (sin necesidad de encode)

  return `postgresql://${encUser}:${encPass}@${encHost}:${port}/${name}`;
}

const DATABASE_URL = process.env.DATABASE_URL || buildDatabaseUrlFromParts();

if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD."
  );
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      // Si en tu caso usas SSL externo, activa esto:
      // ssl: { rejectUnauthorized: false },
    })
  : null;

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Auth middleware (API Key) ---
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    return res.status(500).json({ ok: false, error: "API_KEY not set" });
  }

  const given = req.header("x-api-key");
  if (given !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return next();
}

// --- Routes ---
app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));

/**
 * IMPORTANTÍSIMO:
 * Healthcheck SIEMPRE 200 para que EasyPanel no te mate el contenedor por un
 * micro-fallo de DB. Te devolvemos dbOk como señal.
 */
app.get("/health", async (req, res) => {
  let dbOk = null;

  if (!pool) {
    dbOk = null; // no DB configured
  } else {
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }
  }

  return res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    dbOk,
  });
});

app.post("/webhook", requireApiKey, async (req, res) => {
  try {
    const type = req.body?.type || "unknown";
    const payload = req.body?.payload ?? req.body;

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DB not configured" });
    }

    await pool.query("INSERT INTO events(type, payload) VALUES($1, $2)", [
      type,
      payload,
    ]);

    return res.json({ ok: true, stored: true });
  } catch (e) {
    console.error("Webhook DB error:", e);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
});

// --- DB bootstrap (create table) ---
async function ensureTables() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// Start server
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

(async () => {
  try {
    await ensureTables();
    console.log("DB ready ✅");
  } catch (e) {
    console.error("DB init error:", e);
    // NO tiramos el proceso: seguimos vivos para que el healthcheck responda 200
  }

  app.listen(PORT, HOST, () => console.log(`Listening on ${PORT}`));
})();

// Graceful shutdown (EasyPanel manda SIGTERM)
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  try {
    if (pool) await pool.end();
  } catch {}
  process.exit(0);
});
