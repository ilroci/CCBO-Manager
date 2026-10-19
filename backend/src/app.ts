import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";

// Messaggi di validazione in italiano
z.config(z.locales.it());

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // Richieste senza Origin (curl, healthcheck di Render) sono ammesse.
        // Per le altre origini non si inviano header CORS: è il browser a bloccare la risposta.
        callback(null, !origin || env.frontendUrls.includes(origin));
      },
    }),
  );
  app.use(express.json());

  // Healthcheck per Render
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  // Prossimi router: /api/equipment, /api/price-list, /api/rentals, /api/outings ...

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
