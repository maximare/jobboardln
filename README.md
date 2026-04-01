# IT Job Board

LinkedIn IT oglasi grupisani po kategorijama, powered by Apify scraper.

## Deploy na Vercel (5 minuta)

### 1. Instaliraj Vercel CLI
```bash
npm install -g vercel
```

### 2. Raspakuj projekat i uđi u folder
```bash
cd it-job-board
npm install
```

### 3. Deploy
```bash
vercel
```
Prati instrukcije (prijavi se na Vercel ako nisi). Na kraju dobijaš URL oblika `https://it-job-board-xxx.vercel.app`.

### Alternativa: GitHub + Vercel (preporučeno)
1. Napravi GitHub repo i push-uj kod
2. Idi na vercel.com → "Add New Project" → poveži GitHub repo
3. Vercel automatski deploya pri svakom push-u

## Lokalno pokretanje
```bash
npm install
npm run dev
# Otvori http://localhost:3000
```

## Korišćenje
1. Apify token: apify.com → Settings → Integrations → API token
2. LinkedIn URL: linkedin.com/jobs/search → postavi filtere → kopiraj URL
3. Klikni "Pokreni scrape"
