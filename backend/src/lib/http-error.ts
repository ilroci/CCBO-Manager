/** Errore applicativo con status HTTP: il gestore centrale lo trasforma in risposta JSON. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = "Autenticazione richiesta") => new HttpError(401, message);
export const forbidden = (message = "Permessi insufficienti") => new HttpError(403, message);
export const notFound = (message = "Risorsa non trovata") => new HttpError(404, message);
