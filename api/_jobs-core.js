const HEALTH_FIELD = 'NYW6_mP6_vwf';
const LINKS_API = 'https://links.api.jobtechdev.se/joblinks';
const SEARCH_API = 'https://jobsearch.api.jobtechdev.se/search';

const categoryQueries = {
  all: null,
  doctor: ['läkare'],
  st: ['ST-läkare'],
  bt: ['BT-läkare'],
  at: ['AT-läkare'],
  underdoctor: ['underläkare', 'vikarierande underläkare', 'legitimerad läkare vikariat'],
  'doctor-training': ['ST-läkare', 'BT-läkare', 'AT-läkare', 'underläkare', 'vikarierande underläkare'],
  nurse: ['sjuksköterska'],
  assistant: ['undersköterska'],
  midwife: ['barnmorska'],
  biomed: ['biomedicinsk analytiker'],
  admin: ['medicinsk sekreterare', 'vårdadministratör'],
  elderly: ['äldreomsorg', 'hemtjänst', 'äldreboende', 'vårdboende', 'särskilt boende', 'hemsjukvård', 'vårdbiträde'],
  lss: ['LSS', 'funktionsstöd', 'stödassistent', 'boendestödjare', 'gruppboende', 'personlig assistent'],
  dental: ['tandläkare', 'tandsköterska', 'tandhygienist'],
  rehab: ['fysioterapeut', 'sjukgymnast', 'arbetsterapeut', 'logoped', 'dietist'],
  mental: ['psykolog', 'kurator', 'psykoterapeut', 'skötare psykiatri']
};

const allSupplementQueries = [
  'äldreomsorg', 'hemtjänst', 'LSS', 'funktionsstöd', 'personlig assistent',
  'stödassistent', 'boendestödjare', 'vårdbiträde', 'omsorgsassistent', 'äldreboende'
];

const careContext = [
  'äldreomsorg', 'hemtjänst', 'äldreboende', 'vårdboende', 'särskilt boende', 'hemsjukvård',
  'lss', 'funktionsstöd', 'boendestöd', 'boendestödjare', 'gruppboende', 'personlig assist',
  'omsorgsboende', 'omsorgsassistent', 'demensboende', 'socialpsykiatri', 'korttidsboende',
  'daglig verksamhet', 'stödassistent', 'vårdbiträde', 'behandlingsassistent'
];

const healthContext = [
  'sjukhus', 'vårdcentral', 'hälsocentral', 'primärvård', 'slutenvård', 'öppenvård', 'akutmottagning',
  'mottagning', 'klinik', 'psykiatri', 'habilitering', 'rehabilitering', 'folktandvård', 'tandvård',
  'patient', 'hälso- och sjukvård', 'hälso och sjukvård', 'vårdgivare'
];

const specialtyPatterns = [
  ['Allmänmedicin', /allmänmedicin|vårdcentral|hälsocentral/],
  ['Ortopedi', /ortoped/],
  ['Kirurgi', /\bkirurg|kirurgi/],
  ['Anestesi & IVA', /anestesi|intensivvård|\biva\b/],
  ['Internmedicin', /internmedicin|medicinklinik/],
  ['Akutsjukvård', /akutsjukvård|akutmedicin|akutmottagning/],
  ['Psykiatri', /psykiatr/],
  ['Barn & ungdom', /barnmedicin|pediatr|barn- och ungdom|barn och ungdom/],
  ['Obstetrik & gynekologi', /obstetr|gynekolog|kvinnosjukvård/],
  ['Radiologi', /radiolog|röntgen/],
  ['Patologi', /patolog|cytolog/],
  ['Kardiologi', /kardiolog/],
  ['Neurologi', /neurolog/],
  ['Onkologi', /onkolog/],
  ['Geriatrik', /geriatr/],
  ['Urologi', /urolog/],
  ['ÖNH', /öron|näsa|hals|\bönh\b/],
  ['Ögon', /ögon|oftalmolog/],
  ['Hud', /hudklinik|dermatolog/]
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

function canonical(text = '') {
  return cleanText(text).toLowerCase().replace(/[^a-z0-9åäö]+/g, ' ').trim();
}

function asDate(v = '') {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sourceUrl(ad) {
  const candidates = Array.isArray(ad.source_links) ? ad.source_links : [];
  const preferred = candidates.find((x) => x?.url && !String(x.label || '').toLowerCase().includes('arbetsformedlingen'))
    || candidates.find((x) => x?.url);
  return preferred?.url || ad.webpage_url || ad.application_details?.url || '';
}

function sourceLabel(ad) {
  const candidates = Array.isArray(ad.source_links) ? ad.source_links : [];
  const preferred = candidates.find((x) => x?.label && !String(x.label).toLowerCase().includes('arbetsformedlingen')) || candidates[0];
  if (preferred?.label) return preferred.label;
  return ad.webpage_url?.includes('arbetsformedlingen') ? 'Platsbanken' : 'Originalannons';
}

function doctorStage(title = '', occupation = '') {
  const t = String(title).toLowerCase().trim();
  const o = String(occupation).toLowerCase().trim();
  const doctorOccupation = /läkare/.test(o);

  // JobTech/provider occupation labels can occasionally be broader or simply wrong.
  // Stage classification is therefore title-first. The occupation is only used to
  // validate short, conventional titles such as "AT i Mora" or "BT Region X".
  if ((doctorOccupation && /(?:^|[^a-zåäö])st[\s-]?läkare\b/.test(t)) ||
      (/^st(?:\b|[\s:-])/.test(t) && /(?:st-?)?läkare/.test(o)) ||
      /^specialisttjänstgör/.test(t)) return 'st';

  if ((doctorOccupation && /(?:^|[^a-zåäö])bt[\s-]?läkare\b/.test(t)) ||
      (/^bt(?:\b|[\s:-])/.test(t) && /(?:bt-?)?läkare/.test(o)) ||
      /^bastjänstgör/.test(t)) return 'bt';

  if ((doctorOccupation && /(?:^|[^a-zåäö])at[\s-]?läkare\b/.test(t)) ||
      (/^at(?:\b|[\s:-])/.test(t) && /(?:at-?)?läkare/.test(o)) ||
      /^allmäntjänstgör/.test(t)) return 'at';

  if (/underläkare/.test(t) || (/underläkare/.test(o) && /^(?:vikarierande |leg(?:itimerad)? )?underläk/.test(t))) return 'underdoctor';
  return null;
}

function specialtyFor(title = '', workplace = '') {
  const hay = `${title} ${workplace}`.toLowerCase();
  return specialtyPatterns.find(([, re]) => re.test(hay))?.[0] || null;
}

function normalize(ad) {
  const location = value(ad, 'workplace_address.municipality', 'workplace_address.city', 'municipality', 'location');
  const region = value(ad, 'workplace_address.region', 'region');
  const occupation = cleanText(value(ad, 'occupation.label', 'occupation_group.label'));
  const publication = value(ad, 'publication_date', 'published_at', 'publication_date_time');
  const deadline = value(ad, 'application_deadline', 'last_publication_date');
  const title = cleanText(ad.headline || ad.title || 'Ledigt jobb');
  const workplace = cleanText(value(ad, 'employer.workplace'));
  const stage = doctorStage(title, occupation);
  const specialty = stage || /läkare/i.test(`${title} ${occupation}`) ? specialtyFor(title, workplace) : null;
  const brief = cleanText(ad.brief || value(ad, 'description.text') || '').slice(0, 520);
  const tags = [];
  const stageLabels = { st: 'ST-läkare', bt: 'BT-läkare', at: 'AT-läkare', underdoctor: 'Underläkare' };
  if (stage) tags.push(stageLabels[stage]);
  if (specialty) tags.push(specialty);
  const broadHay = `${title} ${occupation} ${brief}`.toLowerCase();
  if (/vikari|\bvik\b/.test(broadHay)) tags.push('Vikariat');
  if (/\bnatt/.test(broadHay)) tags.push('Natt');
  if (/äldreomsorg|äldreboende|vårdboende|särskilt boende/.test(broadHay)) tags.push('Äldreomsorg');
  if (/hemtjänst/.test(broadHay)) tags.push('Hemtjänst');
  if (/\blss\b|funktionsstöd|gruppboende|stödassistent/.test(broadHay)) tags.push('LSS');

  return {
    id: String(ad.id || ad.external_id || `${title}-${location}-${publication}`),
    title,
    employer: cleanText(value(ad, 'employer.name', 'employer.workplace') || 'Arbetsgivare ej angiven'),
    workplace,
    location: cleanText(location),
    region: cleanText(region),
    occupation,
    occupationField: cleanText(value(ad, 'occupation_field.label')),
    brief,
    publishedAt: publication,
    deadline,
    url: sourceUrl(ad),
    source: sourceLabel(ad),
    vacancies: Number(ad.number_of_vacancies || 0) || null,
    stage,
    specialty,
    tags: [...new Set(tags)].slice(0, 5)
  };
}

function employerRoot(employer = '') {
  return canonical(employer.split(',')[0]
    .replace(/\b(ab|aktiebolag|förvaltningen|förvaltning)\b/gi, ''));
}

function fingerprint(job) {
  const day = asDate(job.publishedAt)?.toISOString().slice(0, 10) || '';
  return `${canonical(job.title)}|${employerRoot(job.employer)}|${day}`;
}

function quality(job) {
  let score = Math.min((job.brief || '').length, 500) / 100;
  if (job.source && job.source !== 'Platsbanken') score += 2;
  if (job.specialty) score += 0.5;
  if (job.deadline) score += 0.3;
  return score;
}

function dedupe(list) {
  const map = new Map();
  for (const job of list) {
    const key = fingerprint(job);
    const prev = map.get(key);
    if (!prev || quality(job) > quality(prev)) map.set(key, job);
  }
  return [...map.values()];
}

function isSectorJob(job) {
  if (job.occupationField.toLowerCase() === 'hälso- och sjukvård') return true;
  const hay = `${job.title} ${job.occupation} ${job.employer} ${job.workplace} ${job.brief}`.toLowerCase();
  return careContext.some((term) => hay.includes(term)) || healthContext.some((term) => hay.includes(term));
}

function matchesCategory(job, category) {
  if (!category || category === 'all') return true;
  const hay = `${job.title} ${job.occupation} ${job.workplace} ${job.brief}`.toLowerCase();
  if (category === 'doctor') return /läkare/.test(`${job.title} ${job.occupation}`.toLowerCase());
  if (category === 'doctor-training') return Boolean(job.stage);
  if (['st', 'bt', 'at', 'underdoctor'].includes(category)) return job.stage === category;
  if (category === 'nurse') return /sjuksköterska|distriktssköterska/.test(`${job.title} ${job.occupation}`.toLowerCase());
  if (category === 'assistant') return /undersköterska/.test(`${job.title} ${job.occupation}`.toLowerCase());
  if (category === 'midwife') return /barnmorska/.test(`${job.title} ${job.occupation}`.toLowerCase());
  if (category === 'biomed') return /biomedicinsk analytiker/.test(`${job.title} ${job.occupation}`.toLowerCase());
  if (category === 'admin') return /medicinsk sekreterare|vårdadministratör/.test(hay);
  if (category === 'elderly') return /äldreomsorg|hemtjänst|äldreboende|vårdboende|särskilt boende|vårdbiträde|hemsjukvård/.test(hay);
  if (category === 'lss') return /\blss\b|funktionsstöd|stödassistent|boendestöd|gruppboende|personlig assist/.test(hay);
  if (category === 'dental') return /tandläkare|tandsköterska|tandhygienist|tandvård/.test(hay);
  if (category === 'rehab') return /fysioterapeut|sjukgymnast|arbetsterapeut|logoped|dietist|rehab/.test(hay);
  if (category === 'mental') return /psykolog|kurator|psykoterapeut|psykiatri|skötare/.test(hay);
  return true;
}

function inferredStageQuery(query = '') {
  const q = query.trim().toLowerCase();
  if (/(?:^|\s)st(?:[\s-]?läkare|\s|$)/.test(q)) return 'st';
  if (/(?:^|\s)bt(?:[\s-]?läkare|\s|$)/.test(q)) return 'bt';
  if (/(?:^|\s)at(?:[\s-]?läkare|\s|$)/.test(q)) return 'at';
  if (/underläkare/.test(q)) return 'underdoctor';
  return null;
}

async function callApi(baseUrl, params, sourceName) {
  const u = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });
  const response = await fetch(u, {
    headers: { accept: 'application/json', 'user-agent': 'Vardanstallning/2.1' },
    signal: AbortSignal.timeout(10000)
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
    calls = queryPair({ q: [typed, where].filter(Boolean).join(' '), limit: 100, offset: safeOffset });
  } else if (category === 'all') {
    const structured = { 'occupation-field': HEALTH_FIELD, limit: 100, offset: safeOffset };
    if (where) structured.q = where;
    calls = [
      ...queryPair(structured),
      ...allSupplementQueries.flatMap((term) => queryPair({ q: [term, where].filter(Boolean).join(' '), limit: 100, offset: safeOffset }))
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

  const stageWanted = inferredStageQuery(typed);
  if (stageWanted) jobs = jobs.filter((x) => x.stage === stageWanted);
  if (!typed && category !== 'all') jobs = jobs.filter((x) => matchesCategory(x, category));

  if (where) {
    const needle = canonical(where);
    jobs = jobs.filter((x) => canonical(`${x.location} ${x.region} ${x.brief}`).includes(needle));
  }

  jobs.sort((a, b) => (asDate(b.publishedAt)?.getTime() || 0) - (asDate(a.publishedAt)?.getTime() || 0));

  return {
    jobs: jobs.slice(0, safeLimit),
    total: null,
    upstreamHits: raw.length,
    deduplicatedHits: jobs.length,
    partial: settled.some((x) => x.status === 'rejected'),
    sources: ['JobSearch', 'JobAd Links'],
    nextOffset: safeOffset + 100
  };
}

module.exports = {
  fetchJobs,
  categoryQueries,
  _test: { doctorStage, dedupe, matchesCategory, inferredStageQuery, normalize }
};
