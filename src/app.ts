import express from "express";
import api from "./http/api";
import { errorHandler } from "./http/errors";

const app = express();

app.use(express.json());
app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api", api);
app.use((_request, response) => response.status(404).json({ error: "Route introuvable." }));
app.use(errorHandler);

export default app;
