import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // Richieste senza Origin (curl, healthcheck di Render) sono ammesse.
        if (!origin || env.frontendUrls.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origine non consentita dal CORS: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  // Healthcheck per Render
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Qui verranno montati i router: /api/auth, /api/users, /api/equipment,
  // /api/price-list, /api/rentals, /api/outings ...

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Risorsa non trovata" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Errore interno del server" });
  });

  return app;
}
