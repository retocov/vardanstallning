import requests
from bs4 import BeautifulSoup
import json

BASE_URL = "https://www.regionstockholm.se"
SEARCH_URL = BASE_URL + "/jobb/for-dig-som-letar-jobb/lediga-jobb/"

CATEGORIES = {
  "läkare": "Läkare",
  "sjuksköterska": "Sjuksköterskor",
  "specialistläkare": "Specialistläkare",
  "paramedicinsk personal": "Paramedicinsk personal",
  "specialistsjuksköterskor, barnmorskor": "Specialistsjuksköterskor, barnmorskor",
  "undersköterskor, ambulanssjukvårdare, steriltekniker": "Undersköterskor, ambulanssjukvårdare, steriltekniker",
  "Hälso- och sjukvård, övriga yrken": "Hälso- och sjukvård, övriga yrken",
  "Skötare, omsorgspersonal, barnskötare": "Skötare, omsorgspersonal, barnskötare",
  "Laboratoriepersonal, Biomedicinska analytiker": "Laboratoriepersonal, Biomedicinska analytiker",
  "Medicinteknik, ingenjörer och övriga inom teknik": "Medicinteknik, ingenjörer och övriga inom teknik"
}

def get_jobs_from_page(skip, seen_urls, category):
    params = {
        "orderBy": "Published",
        "categories": category,
        "skip": skip,
    }
    res = requests.get(SEARCH_URL, params=params)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")
    jobs = []
    selector = (
        "a[href^='/jobb/for-dig-som-letar-jobb/lediga-jobb/'],"
        "a[href^='https://www.regionstockholm.se/jobb/for-dig-som-letar-jobb/lediga-jobb/']"
    )
    for a in soup.select(selector):
        title = a.get_text(strip=True)
        href  = a["href"]
        link  = href if href.startswith("http") else BASE_URL + href

        # filters
        if not title or title.lower() == "lediga jobb":
            continue
        if link.rstrip("/") == SEARCH_URL.rstrip("/"):
            continue
        if link in seen_urls:
            continue

        seen_urls.add(link)
        jobs.append({"title": title, "url": link})
    return jobs

def get_job_details(url):
    res = requests.get(url)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")
    title_el = soup.select_one("h1")
    title = title_el.text.strip() if title_el else "(no title found)"
    desc_el = soup.select_one(".rich-text")
    description = desc_el.text.strip() if desc_el else "(no description found)"
    return {"title": title, "url": url, "description": description}

# Main scraping loop
all_jobs = []
seen = set()
for cat_name, cat_code in CATEGORIES.items():
    for skip in range(0, 200, 20):
        page = get_jobs_from_page(skip, seen, cat_code)
        if not page: break
        for job in page:
            all_jobs.append(get_job_details(job["url"]))

# Save to JSON
with open("vardanstallning.json", "w", encoding="utf-8") as f:
    json.dump(all_jobs, f, ensure_ascii=False, indent=2)

print(f"Saved {len(all_jobs)} jobs to vardanstallning.json")

