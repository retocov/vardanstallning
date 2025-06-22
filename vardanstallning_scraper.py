import requests
from bs4 import BeautifulSoup
import json

# ─── Region Stockholm config ────────────────────────────────────────────────
BASE_URL    = "https://www.regionstockholm.se"
SEARCH_URL  = BASE_URL + "/jobb/for-dig-som-letar-jobb/lediga-jobb/"

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
    "Medicinteknik, ingenjörer och övriga inom teknik": "Medicinteknik, ingenjörer och övriga inom teknik",
}

def get_jobs_from_page(skip, seen_urls, category):
    params = {"orderBy": "Published", "categories": category, "skip": skip}
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
    desc_el  = soup.select_one(".rich-text")
    return {
        "title":       title_el.text.strip()       if title_el else "(no title)",
        "url":         url,
        "description": desc_el.text.strip()        if desc_el else "(no description)",
        "region":      "Stockholm",
        "source":      "region-stockholm",
    }

# ─── Region Uppsala config ─────────────────────────────────────────────────
UPPSALA_API = "https://regionuppsala.se/api/VacancyApi/GetVacancies"
HEADERS     = {"Content-Type": "application/json"}

INCLUDED_U_CATEGORY_NAMES = {
    "Anestesisjuksköterskor","Apotekare","Arbetsterapeuter",
    "Audionomer och logopeder","Barnsjuksköterskor","Biomedicinska analytiker m.fl.",
    "Chefer inom hälso- och sjukvård","Distriktssköterskor",
    "Fysioterapeuter och sjukgymnaster","Grundutbildade sjuksköterskor",
    "Informatörer, kommunikatörer och PR-specialister","Intensivvårdssjuksköterskor",
    "Kuratorer","Operationssjuksköterskor","Planerare och utredare m.fl.",
    "Psykiatrisjuksköterskor","Psykologer","Röntgensjuksköterskor","Skötare",
    "Specialistläkare","ST-läkare","Säkerhetsinspektörer m.fl.",
    "Tekniker, bilddiagnostik o medicintekn. utrustn.","Undersköterskor, vård- o specialavd o motaggning",
    "Vårdbiträden","Övriga läkare"
}

UPPSALA_API = "https://regionuppsala.se/api/VacancyApi/GetVacancies"
HEADERS     = {"Content-Type": "application/json"}

def fetch_uppsala_jobs(limit=100):
    all_jobs = []
    offset   = 0

    while True:
        payload = {
            "SelectedLocations":   [],
            "SelectedCategories":  [],
            "SelectedEmployers":   [],
            "SearchText":          "",
            "Offset":              offset,
            "Limit":               limit
        }

        # POST only—no params
        r = requests.post(UPPSALA_API, json=payload)
        # debug: what did we actually send?
        print("→ REQUEST:", r.request.method, r.request.url)
        print("  BODY:", r.request.body[:100], "…")
        r.raise_for_status()

        batch = r.json().get("JobVacancies", [])
        if not batch:
            break

        for job in batch:
            if job.get("CategoryName") in INCLUDED_U_CATEGORY_NAMES:
                all_jobs.append({
                    "title":       job["Title"].strip(),
                    "url":         job["Url"],
                    "description": job["Description"].strip(),
                    "region":      "Uppsala",
                    "source":      "region-uppsala",
                })

        offset += len(batch)

    return all_jobs


# ─── Main: combine both regions ──────────────────────────────────────────────
def main():
    all_jobs = []
    seen = set()

    # scrape Stockholm for each category
    for cat_name, cat_code in CATEGORIES.items():
        for skip in range(0, 200, 20):
            page_jobs = get_jobs_from_page(skip, seen, cat_code)
            if not page_jobs:
                break
            for job_meta in page_jobs:
                all_jobs.append(get_job_details(job_meta["url"]))

    # scrape Uppsala
    uppsala = fetch_uppsala_jobs()
    all_jobs.extend(uppsala)

    # optional: dedupe by URL
    unique = {job["url"]: job for job in all_jobs}.values()

    with open("vardanstallning.json", "w", encoding="utf-8") as f:
        json.dump(list(unique), f, ensure_ascii=False, indent=2)

    print(f"Saved {len(unique)} jobs to vardanstallning.json")

if __name__ == "__main__":
    main()


