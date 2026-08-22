# Vårdanställning.se — V2

Vårdanställning är en snabb, svensk söktjänst för aktuella jobb inom **hälso- och sjukvård, äldreomsorg, hemtjänst, LSS och kommunal omsorg** i hela Sverige.

Målet är enkelt: man ska inte behöva veta på vilken arbetsgivares eller jobbsajts sida en kortlivad ST-, vikarie-, underläkar-, sjuksköterske- eller omsorgstjänst råkar publiceras.

## Datakällor

V2 hämtar jobb server-side från Arbetsförmedlingens öppna JobTech-tjänster:

- **JobSearch** — aktuella annonser i Platsbanken. Detta ger snabb tillgång till nya Platsbanken-annonser.
- **JobAd Links** — metadata och länkar till annonser från Arbetsförmedlingen och externa jobbsajter. Datamängden uppdateras dagligen och innehåller enligt JobTech cirka 30 % fler annonser än Platsbanken.

Alla resultat länkar vidare till originalannonsen. Vi återpublicerar inte hela annonsinnehållet.

## Täckning

Grundsökningen kombinerar JobTech-fältet **Hälso- och sjukvård** (`NYW6_mP6_vwf`) med kompletterande sökningar för bland annat:

- äldreomsorg
- hemtjänst
- äldreboende / vårdboende / särskilt boende
- hemsjukvård
- LSS och funktionsstöd
- boendestöd, gruppboende och personlig assistans

Därtill finns snabba kategorier för läkare, ST/BT/AT/underläkare, sjuksköterskor, undersköterskor, tandvård, rehab samt psykolog/kurator.

Resultat från flera källor normaliseras och dedupliceras innan de visas.

## Automatisk uppdatering

Det behövs ingen nattlig scraper för webbplatsens huvudflöde. Varje sökning går via Vercel Functions till JobTech och cachas kort på CDN-nivå (`s-maxage=300`, `stale-while-revalidate=1800`). Därmed följer webbplatsen JobSearch löpande och JobAd Links dagliga uppdateringar automatiskt.

## Bevakningar

- **Spara/bevaka en sökning** lagras lokalt i webbläsaren — inget konto krävs.
- Varje sökning har en **Atom/RSS-feed** (`/api/feed`) som kan följas i valfri RSS-läsare.
- E-postnotiser är ett naturligt nästa steg, men kräver persistent lagring och en e-postleverantör och är därför medvetet inte fejkimplementerade i denna första skarpa version.

## Teknik

Statisk frontend + Vercel Functions. Inga npm-beroenden krävs.

```bash
npm run check
npx vercel dev
```

## API

`GET /api/jobs?q=&location=&category=&offset=0&limit=40`

Kategorier: `all`, `doctor`, `doctor-training`, `nurse`, `assistant`, `elderly`, `lss`, `dental`, `rehab`, `mental`.

`GET /api/feed?...` ger samma sökning som Atom-feed.

## Integritet

Vårdanställning lagrar inga konton i V2. Sparade bevakningar ligger endast i användarens `localStorage`. Jobblänkar går till respektive originalkälla.
