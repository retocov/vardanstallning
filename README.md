# vardanstallning
Vårdanställning

Vårdanställning är en öppen plattform som samlar lediga jobb inom vård
och omsorg i hela Sverige. Scraperna hämtar dagligen annonser från
alla 21 regioners officiella jobbsidor, Arbetsförmedlingens
platsbank (JobTech API) samt Läkartidningen. Data normaliseras,
dedupliceras och publiceras som en statisk JSON‑fil som används av
webbapplikationen.

Funktioner

Fullständig täckning: inkluderar sjuksköterskor, läkare,
undersköterskor, barnmorskor, psykologer, fysioterapeuter,
arbetsterapeuter, biomedicinska analytiker och andra relevanta
yrkesgrupper.

Daglig uppdatering: GitHub Actions kör scraping‑pipen varje
natt (kl. 04:00 CET) och uppdaterar datafilerna om något har
förändrats.

Modern webbapp: sök, filtrera och sortera bland tusentals
annonser. Responsiv design som fungerar på både dator och mobil.

Enkelt att utöka: varje datakälla ligger i sin egen modul i
scrapers/ och returnerar en lista med råa jobbposter. Nya
källor kan läggas till genom att skapa ytterligare en modul och
ansluta den i pipeline/run_all.py.

Projektstruktur
├── scrapers/             # en modul per datakälla
│   ├── base.py          # gemensamma fetch‑funktioner
│   ├── region_*.py      # region‑specifika scrapers (många är placeholders)
│   ├── arbetsformedlingen.py
│   └── lakartidningen.py
├── pipeline/
│   ├── __init__.py
│   ├── util.py          # hjälpfunktioner (skriv JSON, tidsstämplar, id‑hash)
│   ├── normalize.py     # normalisering, kategorimappning, statistik
│   ├── dedupe.py        # deduplicering av annonser
│   └── run_all.py       # samlar ihop allt
├── data/
│   ├── jobs.json        # genererad databas över annonser
│   └── stats.json       # sammanfattande statistik
├── web/
│   ├── index.html       # webbgränssnitt
│   ├── app.js           # klientlogik för sök/filter/sortering
│   └── styles.css       # stilark
├── .github/workflows/
│   └── scrape.yml       # GitHub‑action som kör scrapen dagligen
├── requirements.txt
└── README.md

Köra lokalt

Klona repo:

git clone https://github.com/retocov/vardanstallning.git
cd vardanstallning


Installera beroenden och kör pipen:

python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 -m pipeline.run_all


Starta en enkel HTTP‑server i projektroten för att testa webbappen:

python3 -m http.server 8000


Besök sedan http://localhost:8000/web/ i din webbläsare.

Lägga till en ny källa

Skapa en ny modul i scrapers/, till exempel region_example.py.
Modulen ska exponera en funktion get_region_example_jobs() som
returnerar en lista med jobbposter enligt rått schema:

def get_region_example_jobs():
    return [
        {
            "title": "Sjuksköterska till …",
            "description": "…",
            "employer": "Region Example",
            "location": "Stad",
            "municipality": "Exempelkommun",
            "region": "Example",
            "category": None,
            "employment_type": "Tillsvidare",
            "application_deadline": "2025-12-31",
            "published_at": "2025-08-15",
            "url": "https://…",
            "source": "region_example",
            "source_meta": {"origin": "region", "raw_category": "Sjuksköterskor"},
            "fetched_at": "2025-08-16T12:00:00Z",
        }
    ]


Lägg till funktionen i listan _collect_scrapers() i
pipeline/run_all.py så att den körs automatiskt.

Om källan använder nya kategorier behöver du uppdatera
RAW_CATEGORY_MAP i pipeline/normalize.py så att de mappar till
en av de befintliga kanoniska kategorierna.

Kör python3 -m pipeline.run_all lokalt för att verifiera att
jobben importeras korrekt.

Licens

Public domain (CC0). Använd och modifiera fritt.
