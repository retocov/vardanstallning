import requests
from bs4 import BeautifulSoup
import json


# ─── Region Stockholm config
# The Stockholm region lists all open healthcare positions on its public
# recruitment page. We need the base URL for building absolute links
# and the search URL endpoint used for filtering by category and skip
# values.  Each category code corresponds to a Swedish job category
# displayed on the site.  See the CATEGORIES dict below for mapping.
BASE_URL = "https://www.regionstockholm.se"
SEARCH_URL = BASE_URL + "/jobb/for-dig-som-letar-jobb/lediga-jobb/"

# Category codes used by the Stockholm search engine.  The keys are
# internal identifiers while the values are the human‐readable
# categories that appear on the site.  These have been verified as of
# August 2025 but may need updating if the site changes.
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


def get_jobs_from_page(skip: int, seen_urls: set[str], category: str) -> list[dict]:
    """Fetch a page of job listings from Region Stockholm.

    Args:
        skip: Offset for pagination.  The site uses `skip` in steps of
            20 to fetch the next page of results.
        seen_urls: Set of URLs already seen.  This prevents duplicates
            when iterating categories that may overlap in results.
        category: Human‑readable category label from the CATEGORIES
            mapping.

    Returns:
        List of dictionaries with "title" and "url" keys.
    """
    params = {"orderBy": "Published", "categories": category, "skip": skip}
    # Set a browser‑like user agent to avoid 403 responses.  Some
    # websites block default Python user agents.
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36"}
    try:
        res = requests.get(SEARCH_URL, params=params, headers=headers, timeout=30)
        res.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch Stockholm page (skip={skip}, category={category}): {e}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    jobs: list[dict] = []
    # The search results page lists job cards as anchor tags pointing to
    # subpages.  We match both relative and absolute URLs.
    selector = (
        "a[href^='/jobb/for-dig-som-letar-jobb/lediga-jobb/'],"
        "a[href^='https://www.regionstockholm.se/jobb/for-dig-som-letar-jobb/lediga-jobb/']",
    )
    # `soup.select` accepts a comma‑separated string of CSS selectors
    for a in soup.select(",".join(selector)):
        title = a.get_text(strip=True)
        href = a.get("href")
        if not href:
            continue
        link = href if href.startswith("http") else BASE_URL + href
        if not title or title.lower() == "lediga jobb":
            continue
        # Skip links that simply point back to the search page
        if link.rstrip("/") == SEARCH_URL.rstrip("/"):
            continue
        if link in seen_urls:
            continue
        seen_urls.add(link)
        jobs.append({"title": title, "url": link})
    return jobs


def get_job_details(url: str) -> dict:
    """Scrape individual job detail page for title and description.

    Args:
        url: Absolute URL to the job posting.

    Returns:
        Dictionary with keys: title, url, description, region, source.
    """
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36"}
    try:
        res = requests.get(url, headers=headers, timeout=30)
        res.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch Stockholm job details ({url}): {e}")
        return {
            "title": "(error fetching title)",
            "url": url,
            "description": "(error fetching description)",
            "region": "Stockholm",
            "source": "region-stockholm",
        }

    soup = BeautifulSoup(res.text, "html.parser")
    title_el = soup.select_one("h1")
    desc_el = soup.select_one(".rich-text")
    return {
        "title": title_el.text.strip() if title_el else "(no title)",
        "url": url,
        "description": desc_el.text.strip() if desc_el else "(no description)",
        "region": "Stockholm",
        "source": "region-stockholm",
    }


# ─── Region Uppsala config
UPPSALA_API = "https://regionuppsala.se/api/VacancyApi/GetVacancies/"
HEADERS = {"Content-Type": "application/json"}

INCLUDED_U_CATEGORY_NAMES = {
    "Anestesisjuksköterskor",
    "Apotekare",
    "Arbetsterapeuter",
    "Audionomer och logopeder",
    "Barnsjuksköterskor",
    "Biomedicinska analytiker m.fl.",
    "Chefer inom hälso- och sjukvård",
    "Distriktssköterskor",
    "Fysioterapeuter och sjukgymnaster",
    "Grundutbildade sjuksköterskor",
    "Informatörer, kommunikatörer och PR-specialister",
    "Intensivvårdssjuksköterskor",
    "Kuratorer",
    "Operationssjuksköterskor",
    "Planerare och utredare m.fl.",
    "Psykiatrisjuksköterskor",
    "Psykologer",
    "Röntgensjuksköterskor",
    "Skötare",
    "Specialistläkare",
    "ST-läkare",
    "Säkerhetsinspektörer m.fl.",
    "Tekniker, bilddiagnostik o medicintekn. utrustn.",
    "Undersköterskor, vård- o specialavd o motaggning",
    "Vårdbiträden",
    "Övriga läkare",
}


def fetch_uppsala_jobs(page_size: int = 100) -> list[dict]:
    """Fetch job listings from Region Uppsala’s vacancy API.

    The API returns JSON with different possible keys for the list of
    vacancies ("Vacancies", "JobVacancies", or "Items").  We loop
    through pages until no more items are returned.  Only vacancies
    whose CategoryName is in INCLUDED_U_CATEGORY_NAMES are included.

    Args:
        page_size: Number of results per page (max 100 observed).

    Returns:
        List of dictionaries with title, url, description, region, and
        source keys.
    """
    all_jobs: list[dict] = []
    page = 1
    while True:
        payload = {
            "RegionId": 0,
            "AdministrationId": 0,
            "SelectedAdministrations": None,
            "OccupationGroup": "0",
            "SummerJob": False,
            "SortBy": "enddate",
            "Page": page,
            "PageSize": page_size,
            "SearchQuery": "",
            "CurrentPageId": 18,
        }
        try:
            r = requests.post(UPPSALA_API, json=payload, headers=HEADERS, timeout=30)
            r.raise_for_status()
        except Exception as e:
            print(f"Failed to fetch Uppsala jobs (page={page}): {e}")
            break
        data = r.json()
        # Determine which key holds the list of vacancies
        batch = data.get("Vacancies") or data.get("JobVacancies") or data.get("Items") or []
        if not batch:
            break
        for job in batch:
            if job.get("CategoryName") in INCLUDED_U_CATEGORY_NAMES:
                all_jobs.append(
                    {
                        "title": job.get("Title", "").strip(),
                        "url": job.get("Url", ""),
                        "description": job.get("Description", "").strip(),
                        "region": "Uppsala",
                        "source": "region-uppsala",
                    }
                )
        page += 1
    return all_jobs


def main() -> None:
    """Scrape Stockholm and Uppsala job postings and save to JSON."""
    all_jobs: list[dict] = []
    seen: set[str] = set()
    # Scrape Stockholm across all categories, paginating via skip
    for cat_code in CATEGORIES.values():
        for skip in range(0, 200, 20):
            page_jobs = get_jobs_from_page(skip, seen, cat_code)
            if not page_jobs:
                # no more results for this category
                break
            for job_meta in page_jobs:
                all_jobs.append(get_job_details(job_meta["url"]))
    # Scrape Uppsala
    uppsala_jobs = fetch_uppsala_jobs()
    all_jobs.extend(uppsala_jobs)
    # Deduplicate by URL
    unique_jobs = list({job["url"]: job for job in all_jobs}.values())
    # Write to JSON file
    with open("vardanstallning.json", "w", encoding="utf-8") as f:
        json.dump(unique_jobs, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(unique_jobs)} jobs to vardanstallning.json")


if __name__ == "__main__":
    main()