const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Importantísimo: escucha SIEMPRE en process.env.PORT
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
