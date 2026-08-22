const {fetchJobs}=require('./_jobs-core');
const esc=s=>String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
module.exports=async function handler(req,res){
  try{
    const q=req.query.q||'', location=req.query.location||'', category=req.query.category||'all';
    const {jobs}=await fetchJobs({q,location,category,limit:50,offset:0});
    const origin=`https://${req.headers.host}`;
    const title=['Vårdanställning',q||category,location].filter(Boolean).join(' – ');
    const entries=jobs.map(j=>`<entry><id>${esc(j.url||j.id)}</id><title>${esc(j.title)}</title><link href="${esc(j.url)}"/><updated>${new Date(j.publishedAt||Date.now()).toISOString()}</updated><summary>${esc(`${j.employer}${j.location?' · '+j.location:''}${j.brief?' — '+j.brief:''}`)}</summary></entry>`).join('');
    const xml=`<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${esc(title)}</title><id>${esc(origin+req.url)}</id><updated>${new Date().toISOString()}</updated><link href="${esc(origin+req.url)}" rel="self"/>${entries}</feed>`;
    res.setHeader('Content-Type','application/atom+xml; charset=utf-8'); res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600'); return res.status(200).send(xml);
  }catch(err){ return res.status(502).send('Feed unavailable'); }
};
