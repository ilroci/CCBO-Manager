import "dotenv/config";

/** Legge una variabile obbligatoria e fallisce subito all'avvio se manca. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente mancante: ${name}`);
  }
  return value;
}

function jwtSecret(): string {
  const value = required("JWT_SECRET");
  if (value.length < 32) {
    throw new Error("JWT_SECRET deve essere lungo almeno 32 caratteri");
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  /** Una o più origini separate da virgola (es. produzione + http://localhost:5173). */
  frontendUrls: required("FRONTEND_URL")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean),
  jwtSecret: jwtSecret(),
  /** Durata del token di accesso (formato `ms`: "8h", "7d", ...). */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
} as const;
