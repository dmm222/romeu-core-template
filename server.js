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
  app.post("/webhook", requireApiKey, (req, res) => {
  // Por ahora solo “aceptamos y mostramos” el evento
  console.log("Webhook received:", JSON.stringify(req.body));
  res.json({ ok: true, received: true });
});
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Importantísimo: escucha SIEMPRE en process.env.PORT
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
