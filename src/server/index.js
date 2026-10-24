import express from "express";
import multer from "multer";

const app = express();
const port = Number(process.env.PORT || 3001);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "qa-video-generator" });
});

app.post("/api/generate", upload.single("template"), (_req, res) => {
  res.status(501).json({
    error: "Video generation is not implemented yet. Complete the TTS and rendering steps next."
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Q&A video server running at http://127.0.0.1:${port}`);
});
