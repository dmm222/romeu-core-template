const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Seguridad API KEY ---
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return res.status(500).json({ ok: false, error: "API_KEY not set" });

  const given = req.header("x-api-key");
  if (given !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });

  next();
}

// --- DB ---
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL not set (DB features disabled)");
}

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL })
  : null;

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
  console.log("DB ready ✅");
}

// --- Rutas ---
app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));

app.get("/health", async (req, res) => {
  try {
    // Health rápido, pero si hay DB, la pinguea
    if (pool) await pool.query("SELECT 1");
    return res.status(200).json({ ok: true, uptime: process.uptime() });
  } catch (e) {
    console.error("Health DB error:", e);
    return res.status(500).json({ ok: false, error: "DB not reachable" });
  }
});

app.post("/webhook", requireApiKey, async (req, res) => {
  try {
    const type = req.body?.type || "unknown";
    const payload = req.body?.payload ?? req.body;

    if (!pool) return res.status(500).json({ ok: false, error: "DB not configured" });

    await pool.query("INSERT INTO events(type, payload) VALUES($1, $2)", [type, payload]);
    return res.json({ ok: true, stored: true });
  } catch (e) {
    console.error("Webhook DB error:", e);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
});

// --- Arranque ---
const PORT = Number(process.env.PORT || 3000);

ensureTables()
  .catch((e) => console.error("DB init error:", e))
  .finally(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
  });

// --- Apagado limpio (evita logs feos en SIGTERM) ---
process.on("SIGTERM", async () => {
  try {
    if (pool) await pool.end();
  } catch {}
  process.exit(0);
});
