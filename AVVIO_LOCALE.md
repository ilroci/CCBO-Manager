# Avvio in locale

Guida rapida per usare il gestionale sul proprio PC con Docker.

## Utenze

### Applicazione

Le crea automaticamente il seed al primo avvio del backend, insieme a 21 pezzi di
attrezzatura di esempio.

| Ruolo | Email | Password |
|---|---|---|
| Amministratore | `admin@canoaclub.local` | `canoa1234` |
| Istruttore | `istruttore@canoaclub.local` | `canoa1234` |
| Socio | `socio@canoaclub.local` | `canoa1234` |
| Istruttore | `giacomo@canoaclub.local` | `canoa1234` |
| Istruttore | `francesco@canoaclub.local` | `canoa1234` |
| Istruttore | `eleonora@canoaclub.local` | `canoa1234` |
| Socio | `salvo@canoaclub.local` | `canoa1234` |
| Socio | `fra@canoaclub.local` | `canoa1234` |
| Socio | `bula@canoaclub.local` | `canoa1234` |
| Socio | `giovanni@canoaclub.local` | `canoa1234` |
| Socio | `andrea.cobi@canoaclub.local` | `canoa1234` |

I cognomi degli utenti del club (tranne Andrea Cobi) sono da completare: l'amministratore
può farlo da **Utenti → Modifica**.

- Il seed non sovrascrive utenti già esistenti: se cambi una password dall'app, resta cambiata anche dopo un riavvio.
- Per tornare alle password iniziali bisogna azzerare il database (`docker compose down -v`, vedi sotto).
- Sono utenze **solo per lo sviluppo locale**: in produzione il seed va lanciato con `SEED_PASSWORD` (vedi `README.md`).

### Database PostgreSQL

| Parametro | Valore |
|---|---|
| Host | `localhost` |
| Porta | `5432` (oppure il valore di `POSTGRES_PORT`) |
| Database | `canoa` |
| Utente | `canoa` |
| Password | `canoa` |

Stringa di connessione dall'host:
`postgresql://canoa:canoa@localhost:5432/canoa`

### Segreto JWT

In locale il backend usa `JWT_SECRET=solo-per-sviluppo-locale-non-usare-in-produzione`
(definito in `docker-compose.yml`). In produzione va sostituito con una stringa casuale
di almeno 32 caratteri.

### Email (sezione Consigli)

In locale le email non vengono inviate davvero: le raccoglie **Mailpit**, consultabile su
http://localhost:8025. I messaggi del form Consigli sono indirizzati a `giacomo.ceremeletti@gmail.com`
(valore di `SUGGESTIONS_TO` in `docker-compose.yml`), ma in locale restano in Mailpit.

## Avviare Docker

### Requisiti

- Docker con Docker Compose v2 (`docker compose version`)
- Porte libere sull'host: `5173` (frontend), `3000` (API), `5432` (database), `8025` (Mailpit)

Node.js sull'host **non** serve: gira tutto nei container.

### Primo avvio

Dalla cartella principale del progetto:

```bash
docker compose up --build
```

Al primo avvio vengono scaricate le immagini e installate le dipendenze, quindi ci vogliono alcuni minuti.
Il backend poi applica le migrazioni ed esegue il seed. È pronto quando nel log compare:

```
API Canoa Club in ascolto sulla porta 3000
```

Poi apri **http://localhost:5173** e accedi con una delle utenze sopra.

| Servizio | Indirizzo |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Healthcheck | http://localhost:3000/health → `{"status":"ok"}` |

### Avvii successivi

```bash
docker compose up -d        # avvia in background
docker compose logs -f      # segue i log (Ctrl+C per uscire dai log)
docker compose ps           # stato dei servizi
docker compose stop         # ferma senza rimuovere nulla
```

Le modifiche ai file in `backend/src`, `backend/prisma`, `frontend/src` e `frontend/public`
si vedono subito, senza riavviare.

Va ricostruito con `docker compose up --build` quando cambia un `package.json`
o un `Dockerfile`.

### Fermare e azzerare

```bash
docker compose down         # rimuove i container, i dati del database restano
docker compose down -v      # rimuove anche il volume del database (dati persi)
```

Dopo un `down -v`, al successivo `up` il database viene ricreato con migrazioni e utenti demo.

### Comandi utili

```bash
# Nuova migrazione dopo una modifica a backend/prisma/schema.prisma
docker compose exec backend npx prisma migrate dev --name <nome>

# Controllo dei tipi TypeScript
docker compose exec backend npm run typecheck
docker compose exec frontend npm run typecheck

# Shell psql sul database
docker compose exec db psql -U canoa -d canoa

# Rieseguire il seed
docker compose exec backend npm run seed
```

## Problemi frequenti

**Porta 5432 già occupata** (c'è già un PostgreSQL sul PC):

```bash
POSTGRES_PORT=5433 docker compose up
```

**`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` durante la build.** La rete ispeziona il traffico HTTPS
(proxy aziendale, Cisco Umbrella, Zscaler...). Metti il certificato radice del proxy in
`docker/certs/` come file `.crt` e rilancia `docker compose up --build`. I dettagli sono in
[docker/certs/README.md](docker/certs/README.md).

**Il frontend dice "Backend non raggiungibile".** Controlla `docker compose logs backend`:
di solito il backend sta ancora installando o migrando, oppure il database non è partito.

**Login non riuscito con le utenze demo.** Le password sono state cambiate dall'app.
Per ripristinarle: `docker compose down -v && docker compose up`.
