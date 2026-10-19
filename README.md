# Canoa Club · Gestionale

Inventario, prenotazioni, noleggi e uscite di club.

```
canoa-club/
├── backend/            Node.js · Express 5 · TypeScript · Prisma 6 · PostgreSQL (Neon)
│   ├── prisma/         schema.prisma · migrations/ · seed.ts
│   ├── src/            server.ts · app.ts · config/ · lib/ · middleware/ · routes/
│   └── Dockerfile      target dev (hot reload) e prod
├── frontend/           React 19 · Vite 7 · TypeScript · Tailwind v4 · Shadcn UI · Lucide
│   ├── public/_redirects
│   ├── src/            auth/ · components/ · pages/ · lib/
│   ├── Dockerfile      target dev (Vite HMR) e prod (nginx)
│   └── nginx.conf
├── docker/certs/       CA extra per reti con ispezione HTTPS (opzionale)
├── docker-compose.yml  ambiente locale completo
└── render.yaml         Blueprint Render (opzionale)
```

## Avvio in locale con Docker (consigliato)

Serve solo Docker. Node non va installato sull'host.

```bash
docker compose up --build
```

| Servizio | URL |
|---|---|
| Frontend (Vite, hot reload) | http://localhost:5173 |
| API | http://localhost:3000 · `GET /health` |
| PostgreSQL | `localhost:5432` · utente/password/db `canoa` |

All'avvio il backend applica le migrazioni ed esegue il seed, che crea 21 pezzi di
attrezzatura di esempio e un utente per ruolo (password `canoa1234`):

| Email | Ruolo |
|---|---|
| admin@canoaclub.local | Amministratore |
| istruttore@canoaclub.local | Istruttore |
| socio@canoaclub.local | Socio |

`src/` di backend e frontend è montata nei container, quindi le modifiche si vedono subito.
Dopo aver cambiato un `package.json` serve `docker compose up --build`.

Comandi utili:

```bash
docker compose exec backend npx prisma migrate dev --name <nome>   # nuova migrazione dopo una modifica allo schema
docker compose exec backend npm run typecheck
docker compose down          # ferma tutto (i dati restano nel volume pgdata)
docker compose down -v       # ferma e cancella anche il database
```

Se la porta 5432 è già occupata: `POSTGRES_PORT=5433 docker compose up`.

**Reti aziendali.** Se la build fallisce con `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, la rete
ispeziona l'HTTPS: vedi [docker/certs/README.md](docker/certs/README.md).

### Immagini di produzione

I Dockerfile hanno anche un target `prod`, utile per il self-hosting:

```bash
docker build --target prod --build-context extra-certs=docker/certs -t canoa-club-backend backend
docker build --target prod --build-context extra-certs=docker/certs \
  --build-arg VITE_API_URL=https://api.example.com -t canoa-club-frontend frontend
```

Il backend applica le migrazioni all'avvio e richiede `DATABASE_URL`, `FRONTEND_URL` e
`JWT_SECRET`. Il frontend è servito da nginx sulla porta 80.

## Avvio in locale senza Docker

Richiede Node ≥ 20.19 (Vite 7) e un database PostgreSQL, locale o un branch Neon.

```bash
cd backend
cp .env.example .env          # DATABASE_URL, FRONTEND_URL=http://localhost:5173, JWT_SECRET
npm install                   # postinstall esegue prisma generate
npx prisma migrate deploy
npm run seed
npm run dev

cd ../frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

## Autenticazione e ruoli

- Login con email e password (`bcryptjs`), token JWT firmato con `JWT_SECRET` e inviato
  dal frontend nell'header `Authorization: Bearer`. Il token sta in `localStorage`: su
  Render frontend e backend hanno domini diversi e un cookie di sessione sarebbe di terze parti.
- A ogni richiesta il backend rilegge l'utente dal database, quindi un cambio di ruolo
  o una disattivazione valgono subito, anche con un token già emesso.
- Gli utenti non si cancellano: si disattivano, per conservare lo storico. Un amministratore
  non può togliersi il ruolo né disattivarsi da solo.

| Area | Admin | Istruttore | Socio |
|---|:-:|:-:|:-:|
| Dashboard, catalogo, i miei noleggi | ✓ | ✓ | ✓ |
| Uscite di club | ✓ | ✓ | |
| Elenco iscritti (`GET /api/users`, serve al wizard uscite) | ✓ | ✓ | |
| Gestione utenti (crea, modifica, ruolo, disattiva) | ✓ | | |
| Listino prezzi | ✓ | | |

I permessi del frontend sono definiti in `frontend/src/auth/permissions.ts` e servono solo
a nascondere menu e pagine. Il controllo vero è nel backend (`authorize(...)` in
`backend/src/middleware/auth.ts`).

### API

| Metodo | Rotta | Accesso |
|---|---|---|
| `POST` | `/api/auth/login` | pubblico → `{ token, user }` |
| `GET` | `/api/auth/me` | autenticato |
| `POST` | `/api/auth/change-password` | autenticato |
| `GET` | `/api/users?role=&active=&q=` | Admin, Istruttore |
| `GET` | `/api/users/:id` | Admin |
| `POST` | `/api/users` | Admin |
| `PATCH` | `/api/users/:id` | Admin |
| `GET` | `/api/equipment?category=&status=&q=&includeArchived=` | autenticato (archiviati solo Admin) |
| `GET` | `/api/equipment/:id` | autenticato |
| `GET` | `/api/equipment/:id/photo` | pubblico (serve ai tag `<img>`) |
| `POST` | `/api/equipment` | Admin (foto inclusa, campo `photo`) |
| `PATCH` | `/api/equipment/:id` | Admin (anche `isArchived`, `photo`) |
| `DELETE` | `/api/equipment/:id` | Admin, solo pezzi senza storico noleggi |
| `GET` | `/api/price-list` | autenticato |
| `POST` · `PATCH /:id` · `DELETE /:id` | `/api/price-list` | Admin |

Errori: `{ error, details? }` con 400 (validazione), 401, 403, 404, 409 (email o numero di
serie già in uso, eliminazione di un pezzo con storico).

Lo stato di un pezzo (Disponibile / In Noleggio) non si modifica a mano: lo aggiorneranno
prenotazioni e uscite. I pezzi dismessi si archiviano, così lo storico noleggi resta.

**Foto dell'attrezzatura.** L'amministratore le sceglie dal PC (clic o trascinamento). Il
browser le ridimensiona (lato lungo massimo 1600 px), le converte in WebP e le invia come
data URL nel campo `photo` (`null` = rimuovi). Il backend controlla il formato reale del file
(JPEG, PNG o WebP) e il limite di 2 MB, poi le salva in PostgreSQL nella tabella
`EquipmentPhoto`: Render free non ha un disco persistente e così non servono servizi esterni.
Le API restituiscono `photoUrl` (`/api/equipment/:id/photo?v=...`), un URL versionato che
il browser può tenere in cache.

## Deploy su Render + Neon

**Backend (Web Service)**, Root Directory `backend`
- Build: `npm ci --include=dev && npm run build && npx prisma migrate deploy`
- Start: `npm start`
- Env: `DATABASE_URL`, `FRONTEND_URL` (più origini separate da virgola), `JWT_SECRET`
  (almeno 32 caratteri casuali; il Blueprint lo genera da solo), `NODE_VERSION=22`

`--include=dev` serve perché `typescript`, `prisma` e i `@types/*` sono devDependencies
e Render potrebbe ometterle se `NODE_ENV=production`.

Primo amministratore: esegui il seed una volta contro Neon con una password tua, poi
disattiva o modifica gli utenti demo dall'app:

```bash
cd backend
DATABASE_URL="<url neon>" SEED_PASSWORD="<password robusta>" SEED_DEMO_DATA=false npm run seed
```

**Frontend (Static Site)**, Root Directory `frontend`
- Build: `npm ci && npm run build` · Publish directory: `dist`
- Env: `VITE_API_URL` (letta in fase di build: dopo una modifica serve un nuovo deploy)

## Note di progetto

- **Prisma fissato a v6**: dalla v7 `url = env(...)` nel `datasource` non è più supportato
  (si sposta in `prisma.config.ts`). Il requisito di configurazione impone la sintassi v6.
  `npm audit` segnala 3 vulnerabilità "high" in `deepmerge-ts`, usato dal CLI di Prisma:
  riguardano solo lo strumento di sviluppo, non il runtime dell'API, e si risolvono solo
  passando a Prisma 7.
- **Esclusività trasporto/furgone**: modellata col singolo campo `OutingParticipant.travelMode`
  (`VAN` | `TRANSPORT_ONLY` | `AUTONOMOUS`), quindi è impossibile per costruzione avere
  opzione (2) e (3) insieme. Il noleggio (1) è una relazione opzionale indipendente.
- **Listino noleggi**: voci `RentalOption` a prezzo **giornaliero**, uguale per tutti, ognuna
  con le categorie che comprende. Listino attuale (creato dal seed anche in produzione):
  Pacchetto Kayak 15 €/giorno (kayak, pagaia, paraspruzzi, salvagente, casco gratis),
  Giacca d'acqua 5 €, Muta 5 €; il kit completo è la somma (25 €). Un noleggio paga ogni voce
  di cui contiene almeno un pezzo, moltiplicata per i giorni. Una categoria sta in una sola
  voce, per non addebitare due volte lo stesso pezzo. Le voci addebitate vengono copiate in
  `RentalCharge` (nome, prezzo, giorni), così modificare il listino non altera lo storico.
- **Servizi furgone** (`ServiceFee`, trasporto e quota posto): modello presente ma non ancora
  gestito, rimandato.
- **Spese vive**: `Outing.fuelCost + tollCost` ripartite tra i partecipanti con `travelMode = VAN`.
- **Doppie prenotazioni**: Prisma non esprime vincoli di esclusione su intervalli; la verifica
  di sovrapposizione andrà fatta nel service di prenotazione dentro una transazione.
- **Login**: non c'è ancora un limite ai tentativi (rate limiting); da aggiungere prima
  della messa in produzione.
