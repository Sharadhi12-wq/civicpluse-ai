import "dotenv/config";
import express from "express";
import cors from "cors";
import complaints from "./routes/complaints.js";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, submitMode: process.env.SUBMIT_MODE || "sandbox" })
);
app.use("/api/complaints", complaints);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`CivicPulse API on http://localhost:${port}`));
