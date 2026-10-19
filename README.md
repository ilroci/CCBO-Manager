# Canoa Club · Gestionale

Inventario, prenotazioni, noleggi e uscite di club.

```
canoa-club/
├── backend/            Node.js · Express 5 · TypeScript · Prisma 6 · PostgreSQL (Neon)
│   ├── prisma/schema.prisma
│   └── src/            server.ts · app.ts · config/env.ts · lib/prisma.ts
├── frontend/           React 19 · Vite 7 · TypeScript · Tailwind v4 · Shadcn UI · Lucide
│   ├── public/_redirects
│   └── src/            main.tsx · App.tsx · lib/api.ts · lib/utils.ts
└── render.yaml         Blueprint Render (opzionale)
```

## Avvio in locale

```bash
# Backend
cd backend
cp .env.example .env          # inserisci DATABASE_URL di Neon e FRONTEND_URL=http://localhost:5173
npm install                   # postinstall esegue prisma generate
npx prisma migrate dev --name init
npm run dev                   # http://localhost:3000/health → { "status": "ok" }

# Frontend (altro terminale)
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm install
npm run dev                   # http://localhost:5173
```

Aggiungere componenti Shadcn (già configurato via `components.json`):

```bash
cd frontend
npx shadcn@latest add button card table dialog form select radio-group
```

## Deploy su Render + Neon

**Backend (Web Service)** — Root Directory `backend`
- Build: `npm ci --include=dev && npm run build && npx prisma migrate deploy`
- Start: `npm start`
- Env: `DATABASE_URL`, `FRONTEND_URL` (più origini separate da virgola), `NODE_VERSION=22`

`--include=dev` serve perché `typescript`, `prisma` e i `@types/*` sono devDependencies
e Render potrebbe ometterle se `NODE_ENV=production`.

**Frontend (Static Site)** — Root Directory `frontend`
- Build: `npm ci && npm run build` · Publish directory: `dist`
- Env: `VITE_API_URL` (letta in fase di build: dopo una modifica serve un nuovo deploy)

## Note di progetto

- **Prisma fissato a v6**: dalla v7 `url = env(...)` nel `datasource` non è più supportato
  (si sposta in `prisma.config.ts`). Il requisito di configurazione impone la sintassi v6.
- **Esclusività trasporto/furgone**: modellata col singolo campo `OutingParticipant.travelMode`
  (`VAN` | `TRANSPORT_ONLY` | `AUTONOMOUS`), quindi è impossibile per costruzione avere
  opzione (2) e (3) insieme. Il noleggio (1) è una relazione opzionale indipendente.
- **Prezzi**: le tariffe vivono in `PriceListEntry` (attrezzatura) e `ServiceFee` (furgone);
  ogni noleggio/partecipazione salva uno snapshot degli importi applicati, così modificare
  il listino non altera lo storico.
- **Spese vive**: `Outing.fuelCost + tollCost` ripartite tra i partecipanti con `travelMode = VAN`.
- **Doppie prenotazioni**: Prisma non esprime vincoli di esclusione su intervalli; la verifica
  di sovrapposizione andrà fatta nel service di prenotazione dentro una transazione.
