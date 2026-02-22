"use strict";

const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Config ---
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY;

// Opción 1: DATABASE_URL (recomendado en EasyPanel)
const DATABASE_URL = process.env.DATABASE_URL;

// Opción 2: DB_* (fallback si prefieres no usar URL)
const DB_HOST = process.env.DB_HOST || "db";
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

// --- DB pool ---
const pool = new Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
      }
);

// --- Middleware API key ---
function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return res.status(500).json({ ok: false, error: "API_KEY not set" });
  }
  const given = req.header("x-api-key");
  if (given !== API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// --- DB init ---
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// --- Routes ---
app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: true, uptime: process.uptime() });
  } catch (e) {
    console.error("Health DB error:", e.message || e);
    res.status(200).json({ ok: true, db: false, uptime: process.uptime() });
  }
});

app.post("/webhook", requireApiKey, async (req, res) => {
  try {
    const type = req.body?.type || "unknown";
    const payload = req.body?.payload ?? req.body;

    // Asegura JSONB estable
    await pool.query(
      "INSERT INTO events(type, payload) VALUES($1, $2::jsonb)",
      [type, JSON.stringify(payload)]
    );

    res.json({ ok: true, stored: true });
  } catch (e) {
    console.error("Webhook DB error:", e);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

// --- Boot ---
async function boot() {
  try {
    await ensureTables();
    console.log("DB ready ✅");
  } catch (e) {
    console.error("DB init error:", e);
    // No tiramos el proceso: el /health mostrará db:false y puedes ver logs
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
}

boot();

// --- Graceful shutdown ---
process.on("SIGTERM", async () => {
  try {
    await pool.end();
  } catch {}
  process.exit(0);
});
process.on("SIGINT", async () => {
  try {
    await pool.end();
  } catch {}
  process.exit(0);
});
