import axios, { isAxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

if (!baseURL) {
  console.warn("VITE_API_URL non impostata: le chiamate API falliranno.");
}

const TOKEN_KEY = "canoa-club.token";

/**
 * Il token JWT sta in localStorage e viaggia nell'header Authorization.
 * Su Render frontend e backend hanno domini diversi (onrender.com è un public suffix),
 * quindi un cookie di sessione sarebbe di terze parti e verrebbe bloccato da molti browser.
 */
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Client HTTP unico verso il backend Express. */
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 60_000, // Render free può impiegare ~30-60s al primo avvio a freddo
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | undefined;

/** Registrato da AuthProvider: un 401 su una chiamata autenticata chiude la sessione. */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

api.interceptors.response.use(undefined, (error: unknown) => {
  if (isAxiosError(error) && error.response?.status === 401 && error.config?.headers.Authorization) {
    onUnauthorized?.();
  }
  return Promise.reject(error);
});

/** Estrae il messaggio d'errore restituito dal backend (`{ error: "..." }`). */
export function getErrorMessage(error: unknown, fallback = "Si è verificato un errore"): string {
  if (isAxiosError<{ error?: string; details?: { message: string }[] }>(error)) {
    if (!error.response) return "Backend non raggiungibile";
    const data = error.response.data;
    const detail = data?.details?.[0]?.message;
    return detail ? `${data.error}: ${detail}` : (data?.error ?? fallback);
  }
  return fallback;
}

/** URL assoluto di una risorsa del backend (es. `photoUrl` delle foto, usato nei tag <img>). */
export function apiUrl(path: string): string {
  return `${baseURL ?? ""}${path}`;
}

export async function checkHealth(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>("/health");
  return data;
}
