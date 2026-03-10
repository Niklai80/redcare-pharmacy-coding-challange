import express from "express";
import gitRoutes from "./routes/gitHubRoutes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { config } from "./config/config";

const app = express();

app.use(express.json());
const { port } = config.server;
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/", gitRoutes);

// Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
