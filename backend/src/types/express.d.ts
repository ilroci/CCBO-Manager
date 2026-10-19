import type { PublicUser } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      /** Utente autenticato, valorizzato dal middleware `authenticate`. */
      user?: PublicUser;
    }
  }
}

export {};
