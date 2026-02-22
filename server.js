const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Romeu Core Template OK ✅"));
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
