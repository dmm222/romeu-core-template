const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return res.status(500).json({ ok: false, error: "API_KEY not set" });

  const given = req.header("x-api-key");
  if (given !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });

  next();
}
app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));

app.get("/health", (req, res) => {
 app.post("/webhook", requireApiKey, async (req, res) => {
  try {
    const type = req.body?.type || "unknown";
    const payload = req.body?.payload ?? req.body;

    await pool.query(
      "INSERT INTO events(type, payload) VALUES($1, $2)",
      [type, payload]
    );

    res.json({ ok: true, stored: true });
  } catch (e) {
    console.error("Webhook DB error:", e);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Importantísimo: escucha SIEMPRE en process.env.PORT
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
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

ensureTables()
  .then(() => console.log("DB ready ✅"))
  .catch((e) => console.error("DB init error:", e));
