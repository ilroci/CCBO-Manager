import "dotenv/config";

/** Legge una variabile obbligatoria e fallisce subito all'avvio se manca. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente mancante: ${name}`);
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
} as const;
