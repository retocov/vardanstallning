const HEALTH_FIELD = 'NYW6_mP6_vwf';
const LINKS_API = 'https://links.api.jobtechdev.se/joblinks';
const SEARCH_API = 'https://jobsearch.api.jobtechdev.se/search';

const categoryQueries = {
  all: null,
  doctor: ['läkare'],
  'doctor-training': ['ST-läkare', 'BT-läkare', 'AT-läkare', 'underläkare', 'vikarierande underläkare'],
  nurse: ['sjuksköterska'],
  assistant: ['undersköterska'],
  elderly: ['äldreomsorg', 'hemtjänst', 'äldreboende', 'vårdboende', 'särskilt boende', 'hemsjukvård'],
  lss: ['LSS', 'funktionsstöd', 'boendestödjare', 'gruppboende', 'personlig assistent'],
  dental: ['tandläkare', 'tandsköterska', 'tandhygienist'],
  rehab: ['fysioterapeut', 'sjukgymnast', 'arbetsterapeut', 'logoped', 'dietist'],
  mental: ['psykolog', 'kurator', 'psykoterapeut']
};

const careContext = [
  'äldreomsorg', 'hemtjänst', 'äldreboende', 'vårdboende', 'särskilt boende', 'hemsjukvård',
  'lss', 'funktionsstöd', 'boendestöd', 'gruppboende', 'personlig assist', 'omsorgsboende',
  'demensboende', 'socialpsykiatri', 'korttidsboende', 'daglig verksamhet'
];

const healthContext = [
  'sjukhus', 'vårdcentral', 'hälsocentral', 'primärvård', 'slutenvård', 'öppenvård', 'akutmottagning',
  'mottagning', 'klinik', 'psykiatri', 'habilitering', 'rehabilitering', 'folktandvård', 'tandvård',
  'patient', 'hälso- och sjukvård', 'hälso och sjukvård', 'vårdgivare'
];

function value(obj, ...paths) {
  for (const path of paths) {
    let cur = obj;
    for (const part of path.split('.')) cur = cur?.[part];
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return '';
}

function cleanText(text = '') {
  return String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function asDate(v = '') {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sourceUrl(ad) {
  const candidates = Array.isArray(ad.source_links) ? ad.source_links : [];
  const preferred = candidates.find((x) => x?.url && !String(x.label || '').includes('arbetsformedlingen'))
    || candidates.find((x) => x?.url);
  return preferred?.url || ad.webpage_url || ad.application_details?.url || '';
}

function sourceLabel(ad) {
  const candidates = Array.isArray(ad.source_links) ? ad.source_links : [];
  const preferred = candidates.find((x) => x?.label && !String(x.label).includes('arbetsformedlingen')) || candidates[0];
  if (preferred?.label) return preferred.label;
  return ad.webpage_url?.includes('arbetsformedlingen') ? 'Platsbanken' : 'Originalannons';
}

function tagsFor(ad) {
  const hay = `${ad.headline || ''} ${value(ad, 'occupation.label', 'occupation_group.label')} ${ad.brief || ''}`.toLowerCase();
  const tags = [];
  const checks = [
    ['ST-läkare', /\bst[- ]?läkare\b|specialisttjänstgör/],
    ['BT-läkare', /\bbt[- ]?läkare\b|bastjänstgör/],
    ['AT-läkare', /\bat[- ]?läkare\b|allmäntjänstgör/],
    ['Underläkare', /underläk/],
    ['Vikariat', /vikari|\bvik\b/],
    ['Natt', /\bnatt/],
    ['Äldreomsorg', /äldreomsorg|äldreboende|vårdboende|särskilt boende/],
    ['Hemtjänst', /hemtjänst/],
    ['LSS', /\blss\b|funktionsstöd|gruppboende/]
  ];
  for (const [label, re] of checks) if (re.test(hay)) tags.push(label);
  return [...new Set(tags)].slice(0, 4);
}

function normalize(ad) {
  const location = value(ad, 'workplace_address.municipality', 'workplace_address.city', 'municipality', 'location');
  const region = value(ad, 'workplace_address.region', 'region');
  const occupation = value(ad, 'occupation.label', 'occupation_group.label');
  const publication = value(ad, 'publication_date', 'published_at', 'publication_date_time');
  const deadline = value(ad, 'application_deadline', 'last_publication_date');
  return {
    id: String(ad.id || ad.external_id || `${ad.headline}-${location}-${publication}`),
    title: cleanText(ad.headline || ad.title || 'Ledigt jobb'),
    employer: cleanText(value(ad, 'employer.name', 'employer.workplace') || 'Arbetsgivare ej angiven'),
    workplace: cleanText(value(ad, 'employer.workplace')),
    location: cleanText(location),
    region: cleanText(region),
    occupation: cleanText(occupation),
    occupationField: cleanText(value(ad, 'occupation_field.label')),
    brief: cleanText(ad.brief || value(ad, 'description.text') || '').slice(0, 520),
    publishedAt: publication,
    deadline,
    url: sourceUrl(ad),
    source: sourceLabel(ad),
    vacancies: Number(ad.number_of_vacancies || 0) || null,
    tags: tagsFor(ad)
  };
}

function dedupe(list) {
  const map = new Map();
  for (const ad of list) {
    const urlKey = ad.url ? ad.url.toLowerCase().replace(/[?#].*$/, '') : '';
    const textKey = `${ad.title}|${ad.employer}|${ad.location}`.toLowerCase().replace(/\s+/g, ' ');
    const key = urlKey || textKey;
    const prev = map.get(key);
    if (!prev || (asDate(ad.publishedAt)?.getTime() || 0) > (asDate(prev.publishedAt)?.getTime() || 0)) map.set(key, ad);
  }
  return [...map.values()];
}

function isSectorJob(job) {
  if (job.occupationField.toLowerCase() === 'hälso- och sjukvård') return true;
  const hay = `${job.title} ${job.occupation} ${job.employer} ${job.workplace} ${job.brief}`.toLowerCase();
  return careContext.some((term) => hay.includes(term)) || healthContext.some((term) => hay.includes(term));
}

async function callApi(baseUrl, params, sourceName) {
  const u = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });
  const response = await fetch(u, {
    headers: { accept: 'application/json', 'user-agent': 'Vardanstallning/2.0' },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(`${sourceName} svarade ${response.status}`);
  return response.json();
}

function callJobLinks(params) {
  return callApi(LINKS_API, { sort: 'pubdate-desc', ...params }, 'JobAd Links');
}

function callJobSearch(params) {
  return callApi(SEARCH_API, params, 'JobSearch');
}

function queryPair(params) {
  return [callJobLinks(params), callJobSearch(params)];
}

async function fetchJobs({ q = '', location = '', category = 'all', offset = 0, limit = 40 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const typed = cleanText(q);
  const where = cleanText(location);
  let calls = [];

  if (typed) {
    const query = [typed, where].filter(Boolean).join(' ');
    calls = queryPair({ q: query, limit: 100, offset: safeOffset });
  } else if (category === 'all') {
    const structured = { 'occupation-field': HEALTH_FIELD, limit: 100, offset: safeOffset };
    if (where) structured.q = where;
    calls = [
      ...queryPair(structured),
      ...['äldreomsorg', 'hemtjänst', 'LSS', 'funktionsstöd', 'personlig assistent']
        .flatMap((term) => queryPair({ q: [term, where].filter(Boolean).join(' '), limit: 100, offset: safeOffset }))
    ];
  } else {
    const terms = categoryQueries[category] || [];
    calls = terms.flatMap((term) => queryPair({ q: [term, where].filter(Boolean).join(' '), limit: 100, offset: safeOffset }));
  }

  const settled = await Promise.allSettled(calls);
  const ok = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  if (!ok.length) throw settled.find((x) => x.status === 'rejected')?.reason || new Error('Kunde inte hämta jobb');

  const raw = ok.flatMap((x) => (Array.isArray(x.hits) ? x.hits : []));
  let jobs = dedupe(raw.map(normalize).filter((x) => x.url)).filter(isSectorJob);

  if (where) {
    const needle = where.toLowerCase();
    jobs = jobs.filter((x) => `${x.location} ${x.region} ${x.brief}`.toLowerCase().includes(needle));
  }

  jobs.sort((a, b) => (asDate(b.publishedAt)?.getTime() || 0) - (asDate(a.publishedAt)?.getTime() || 0));

  // Totals from multiple overlapping sources cannot be safely added, so expose the
  // de-duplicated count we actually know rather than a misleading market total.
  return {
    jobs: jobs.slice(0, safeLimit),
    total: null,
    upstreamHits: raw.length,
    partial: settled.some((x) => x.status === 'rejected'),
    nextOffset: safeOffset + 100
  };
}

module.exports = { fetchJobs, categoryQueries };
