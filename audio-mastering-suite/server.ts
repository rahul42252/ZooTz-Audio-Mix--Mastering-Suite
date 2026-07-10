import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Audio Mastering Suite API is active",
      time: new Date().toISOString()
    });
  });

  // Simulated server-side processing statistics for the dashboard
  let processedTracksCount = 0;
  
  app.get("/api/stats", (req, res) => {
    res.json({ 
      processedTracksCount,
      pythonBackendAvailable: true,
      supportedFormats: ["wav", "mp3"]
    });
  });

  app.post("/api/stats/increment", (req, res) => {
    processedTracksCount++;
    res.json({ success: true, processedTracksCount });
  });

  // Serve static assets/downloads folder if exists
  const storageDir = path.join(process.cwd(), "storage");
  app.use("/storage", express.static(storageDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
