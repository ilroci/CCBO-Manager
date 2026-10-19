import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

if (!baseURL) {
  console.warn("VITE_API_URL non impostata: le chiamate API falliranno.");
}

/** Client HTTP unico verso il backend Express. */
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000, // Render free può impiegare ~30-60s al primo avvio a freddo
});

export async function checkHealth(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>("/health");
  return data;
}
