const HEALTH_FIELD='NYW6_mP6_vwf';
const LINKS_API='https://links.api.jobtechdev.se/joblinks';
const SEARCH_API='https://jobsearch.api.jobtechdev.se/search';

const categoryQueries={
  all:null,
  doctor:['läkare'],st:['ST-läkare'],bt:['BT-läkare'],at:['AT-läkare'],underdoctor:['underläkare','vikarierande underläkare'],
  nurse:['sjuksköterska','distriktssköterska'],assistant:['undersköterska'],midwife:['barnmorska'],ambulance:['ambulanssjuksköterska','ambulanssjukvårdare'],
  elderly:['äldreomsorg','hemtjänst','äldreboende','särskilt boende','hemsjukvård'],lss:['LSS','funktionsstöd','stödassistent','boendestödjare','personlig assistent'],
  social:['socialsekreterare','socionom','behandlingsassistent','behandlingspedagog'],careworker:['vårdbiträde','skötare','personlig assistent','boendestödjare'],
  rehab:['fysioterapeut','sjukgymnast','arbetsterapeut','logoped','dietist'],mental:['psykolog','kurator','psykoterapeut'],
  dental:['tandläkare','tandsköterska','tandhygienist'],biomed:['biomedicinsk analytiker'],radiology:['röntgensjuksköterska','radiograf'],lab:['laboratorieingenjör medicin','biomedicinsk analytiker'],
  pharmacy:['apotekare','receptarie','farmaceut'],lifescience:['life science','clinical research','klinisk prövning','medical science liaison'],research:['forskningssjuksköterska','forskningsassistent medicin','doktorand medicin'],
  admin:['medicinsk sekreterare','vårdadministratör','läkarsekreterare'],leadership:['enhetschef vård','verksamhetschef vård','vårdenhetschef','områdeschef omsorg'],
  veterinary:['veterinär','djursjukskötare','djurvårdare klinik'],other:['steriltekniker','ortopedingenjör','audionom','optiker','kiropraktor','naprapat']
};

const allSupplementQueries=['äldreomsorg','LSS','socialsekreterare','personlig assistent','apotekare','veterinär','medicinsk sekreterare','life science'];

const sectorContext=[
  'sjukhus','vårdcentral','hälsocentral','primärvård','slutenvård','öppenvård','akutmottagning','mottagning','klinik','psykiatri','habilitering','rehabilitering','patient','hälso- och sjukvård','vårdgivare','folktandvård','tandvård',
  'äldreomsorg','hemtjänst','äldreboende','vårdboende','särskilt boende','hemsjukvård','lss','funktionsstöd','boendestöd','gruppboende','personlig assist','omsorg','socialtjänst','socialsekreterare','socionom',
  'apotek','farmaceut','apotekare','receptarie','life science','klinisk prövning','clinical research','medicinteknik','laboratorium','veterinär','djursjukvård','djursjukhus'
];

const specialtyPatterns=[
  ['Allmänmedicin',/allmänmedicin|vårdcentral|hälsocentral/],['Ortopedi',/ortoped/],['Kirurgi',/\bkirurg|kirurgi/],['Anestesi & IVA',/anestesi|intensivvård|\biva\b/],['Internmedicin',/internmedicin|medicinklinik/],['Akutsjukvård',/akutsjukvård|akutmedicin|akutmottagning/],['Psykiatri',/psykiatr/],['Barn & ungdom',/barnmedicin|pediatr|barn- och ungdom|barn och ungdom/],['Obstetrik & gynekologi',/obstetr|gynekolog|kvinnosjukvård/],['Radiologi',/radiolog|röntgen/],['Patologi',/patolog|cytolog/],['Kardiologi',/kardiolog/],['Neurologi',/neurolog/],['Onkologi',/onkolog/],['Geriatrik',/geriatr/],['Urologi',/urolog/],['ÖNH',/öron|näsa|hals|\bönh\b/],['Ögon',/ögon|oftalmolog/],['Hud',/hudklinik|dermatolog/],['Infektion',/infektion/],['Reumatologi',/reumatolog/],['Njurmedicin',/njurmedicin|nefrolog/],['Endokrinologi',/endokrinolog/]
];

function value(obj,...paths){for(const path of paths){let cur=obj;for(const part of path.split('.'))cur=cur?.[part];if(cur!==undefined&&cur!==null&&cur!=='')return cur}return''}
function cleanText(text=''){return String(text).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function canonical(text=''){return cleanText(text).toLowerCase().replace(/[^a-z0-9åäö]+/g,' ').trim()}
function asDate(v=''){const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function sourceUrl(ad){const xs=Array.isArray(ad.source_links)?ad.source_links:[];const preferred=xs.find(x=>x?.url&&!String(x.label||'').toLowerCase().includes('arbetsformedlingen'))||xs.find(x=>x?.url);return preferred?.url||ad.webpage_url||ad.application_details?.url||''}
function sourceLabel(ad){const xs=Array.isArray(ad.source_links)?ad.source_links:[];const preferred=xs.find(x=>x?.label&&!String(x.label).toLowerCase().includes('arbetsformedlingen'))||xs[0];if(preferred?.label)return preferred.label;return ad.webpage_url?.includes('arbetsformedlingen')?'Platsbanken':'Originalannons'}

function doctorStage(title='',occupation=''){
  const t=String(title).toLowerCase().trim(),o=String(occupation).toLowerCase().trim(),doctor=/läkare/.test(o);
  if((doctor&&/(?:^|[^a-zåäö])st[\s-]?läkare\b/.test(t))||(/^st(?:\b|[\s:-])/.test(t)&&/(?:st-?)?läkare/.test(o))||/^specialisttjänstgör/.test(t))return'st';
  if((doctor&&/(?:^|[^a-zåäö])bt[\s-]?läkare\b/.test(t))||(/^bt(?:\b|[\s:-])/.test(t)&&/(?:bt-?)?läkare/.test(o))||/^bastjänstgör/.test(t))return'bt';
  if((doctor&&/(?:^|[^a-zåäö])at[\s-]?läkare\b/.test(t))||(/^at(?:\b|[\s:-])/.test(t)&&/(?:at-?)?läkare/.test(o))||/^allmäntjänstgör/.test(t))return'at';
  if(/underläkare/.test(t)||(/underläkare/.test(o)&&/^(?:vikarierande |leg(?:itimerad)? )?underläk/.test(t)))return'underdoctor';
  return null;
}
function specialtyFor(title='',workplace=''){const hay=`${title} ${workplace}`.toLowerCase();return specialtyPatterns.find(([,re])=>re.test(hay))?.[0]||null}

function normalize(ad){
  const location=value(ad,'workplace_address.municipality','workplace_address.city','municipality','location');
  const region=value(ad,'workplace_address.region','region');
  const occupation=cleanText(value(ad,'occupation.label','occupation_group.label'));
  const title=cleanText(ad.headline||ad.title||'Ledigt jobb');
  const workplace=cleanText(value(ad,'employer.workplace'));
  const publication=value(ad,'publication_date','published_at','publication_date_time');
  const deadline=value(ad,'application_deadline','last_publication_date');
  const brief=cleanText(ad.brief||value(ad,'description.text')||'').slice(0,520);
  const stage=doctorStage(title,occupation);
  const specialty=(stage||/läkare/i.test(`${title} ${occupation}`))?specialtyFor(title,workplace):null;
  const tags=[];if(stage)tags.push({st:'ST-läkare',bt:'BT-läkare',at:'AT-läkare',underdoctor:'Underläkare'}[stage]);if(specialty)tags.push(specialty);
  const hay=`${title} ${occupation} ${brief}`.toLowerCase();
  if(/vikari|\bvik\b/.test(hay))tags.push('Vikariat');if(/\bnatt/.test(hay))tags.push('Natt');if(/äldreomsorg|äldreboende|särskilt boende/.test(hay))tags.push('Äldreomsorg');if(/hemtjänst/.test(hay))tags.push('Hemtjänst');if(/\blss\b|funktionsstöd|gruppboende|stödassistent/.test(hay))tags.push('LSS');
  return{id:String(ad.id||ad.external_id||`${title}-${location}-${publication}`),title,employer:cleanText(value(ad,'employer.name','employer.workplace')||'Arbetsgivare ej angiven'),workplace,location:cleanText(location),region:cleanText(region),occupation,occupationField:cleanText(value(ad,'occupation_field.label')),brief,publishedAt:publication,deadline,url:sourceUrl(ad),source:sourceLabel(ad),vacancies:Number(ad.number_of_vacancies||0)||null,stage,specialty,tags:[...new Set(tags)].slice(0,5)};
}

function employerRoot(s=''){return canonical(s.split(',')[0].replace(/\b(ab|aktiebolag|förvaltningen|förvaltning)\b/gi,''))}
function fingerprint(j){return`${canonical(j.title)}|${employerRoot(j.employer)}|${canonical(j.location)}`}
function quality(j){return Math.min((j.brief||'').length,500)/100+(j.source&&j.source!=='Platsbanken'?2:0)+(j.deadline?.length?0.3:0)+(j.specialty?0.5:0)}
function dedupe(list){const m=new Map();for(const j of list){const k=fingerprint(j),p=m.get(k);if(!p||quality(j)>quality(p))m.set(k,j)}return[...m.values()]}
function isSectorJob(j){if(j.occupationField.toLowerCase()==='hälso- och sjukvård')return true;const hay=`${j.title} ${j.occupation} ${j.employer} ${j.workplace} ${j.brief}`.toLowerCase();return sectorContext.some(x=>hay.includes(x))}

function matchesCategory(j,c){
  if(!c||c==='all')return true;const titleOcc=`${j.title} ${j.occupation}`.toLowerCase(),hay=`${titleOcc} ${j.workplace} ${j.brief}`.toLowerCase();
  if(c==='doctor')return/läkare/.test(titleOcc);if(['st','bt','at','underdoctor'].includes(c))return j.stage===c;
  const patterns={nurse:/sjuksköterska|distriktssköterska/,assistant:/undersköterska/,midwife:/barnmorska/,ambulance:/ambulanssjuk/,elderly:/äldreomsorg|hemtjänst|äldreboende|vårdboende|särskilt boende|hemsjukvård/,lss:/\blss\b|funktionsstöd|stödassistent|boendestöd|gruppboende|personlig assist/,social:/socialsekreterare|socionom|behandlingsassistent|behandlingspedagog|socialt arbete/,careworker:/vårdbiträde|skötare|personlig assistent|boendestödjare/,rehab:/fysioterapeut|sjukgymnast|arbetsterapeut|logoped|dietist|rehab/,mental:/psykolog|kurator|psykoterapeut/,dental:/tandläkare|tandsköterska|tandhygienist|tandvård/,biomed:/biomedicinsk analytiker/,radiology:/röntgensjuksköterska|radiograf/,lab:/laborator|biomedicinsk analytiker/,pharmacy:/apotekare|receptarie|farmaceut|apotek/,lifescience:/life science|clinical research|klinisk prövning|medical science liaison|läkemedelsindustri/,research:/forskningssjuksköterska|forskningsassistent|doktorand|klinisk forskning/,admin:/medicinsk sekreterare|vårdadministratör|läkarsekreterare/,leadership:/enhetschef|verksamhetschef|vårdenhetschef|områdeschef/,veterinary:/veterinär|djursjukskötare|djurvårdare|djursjukhus/,other:/steriltekniker|ortopedingenjör|audionom|optiker|kiropraktor|naprapat/};
  return patterns[c]?patterns[c].test(hay):true;
}

function inferredStageQuery(q=''){q=q.trim().toLowerCase();if(/(?:^|\s)st(?:[\s-]?läkare|\s|$)/.test(q))return'st';if(/(?:^|\s)bt(?:[\s-]?läkare|\s|$)/.test(q))return'bt';if(/(?:^|\s)at(?:[\s-]?läkare|\s|$)/.test(q))return'at';if(/underläkare/.test(q))return'underdoctor';return null}
async function callApi(base,params,name){const u=new URL(base);Object.entries(params).forEach(([k,v])=>{if(v!==''&&v!==undefined&&v!==null)u.searchParams.set(k,String(v))});const r=await fetch(u,{headers:{accept:'application/json','user-agent':'Vardanstallning/2.2'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`${name} svarade ${r.status}`);return r.json()}
const callLinks=p=>callApi(LINKS_API,{sort:'pubdate-desc',...p},'JobAd Links');
const callSearch=p=>callApi(SEARCH_API,p,'JobSearch');
const pair=p=>[callLinks(p),callSearch(p)];

async function fetchJobs({q='',location='',category='all',offset=0,limit=40}){
  const safeLimit=Math.min(Math.max(Number(limit)||40,1),100),safeOffset=Math.max(Number(offset)||0,0),typed=cleanText(q),where=cleanText(location);let calls=[];
  if(typed){const query=[typed,where].filter(Boolean).join(' ');calls=pair({q:query,limit:100,offset:safeOffset});}
  else if(category==='all'){
    const structured={'occupation-field':HEALTH_FIELD,limit:100,offset:safeOffset};if(where)structured.q=where;calls.push(...pair(structured));
    if(safeOffset===0)for(const term of allSupplementQueries)calls.push(...pair({q:[term,where].filter(Boolean).join(' '),limit:100,offset:0}));
  }else{
    const terms=categoryQueries[category]||[category];for(const term of terms)calls.push(...pair({q:[term,where].filter(Boolean).join(' '),limit:100,offset:safeOffset}));
  }
  const settled=await Promise.allSettled(calls),ok=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);if(!ok.length)throw settled.find(x=>x.status==='rejected')?.reason||new Error('Kunde inte hämta jobb');
  const raw=ok.flatMap(x=>Array.isArray(x.hits)?x.hits:[]);let jobs=dedupe(raw.map(normalize).filter(x=>x.url));
  const inferred=inferredStageQuery(typed);jobs=jobs.filter(j=>isSectorJob(j)||(category!=='all'&&matchesCategory(j,category))||Boolean(inferred&&j.stage===inferred));
  if(category!=='all')jobs=jobs.filter(j=>matchesCategory(j,category));if(inferred)jobs=jobs.filter(j=>j.stage===inferred);
  if(where){const n=where.toLowerCase();jobs=jobs.filter(j=>`${j.location} ${j.region} ${j.brief}`.toLowerCase().includes(n));}
  jobs.sort((a,b)=>(asDate(b.publishedAt)?.getTime()||0)-(asDate(a.publishedAt)?.getTime()||0));
  return{jobs:jobs.slice(0,safeLimit),total:null,upstreamHits:raw.length,deduplicatedHits:jobs.length,partial:settled.some(x=>x.status==='rejected'),sources:['JobSearch','JobAd Links'],nextOffset:safeOffset+100};
}
module.exports={fetchJobs,categoryQueries};
