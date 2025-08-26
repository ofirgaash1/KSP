import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// פרוקסי ישן (אם תרצה עדיין להשתמש בו)
app.get("/api/products", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://ksp.co.il/m_action/api/category/38?sort=1&page=${page}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ✅ פרוקסי כללי ל־target
app.get("/api/proxy", async (req, res) => {
  try {
    const target = req.query.target;
    if (!target) {
      return res.status(400).json({ error: "Missing target URL" });
    }

    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
