const { db } = require('../_db');
const { fetchJobs } = require('../_jobs-core');

function due(alert,now){
  if(!alert.last_checked_at)return true;
  const age=now-new Date(alert.last_checked_at).getTime();
  if(alert.frequency==='instant')return age>=30*60*1000;
  if(alert.frequency==='daily')return age>=20*60*60*1000;
  return age>=6*24*60*60*1000;
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function sendMail(alert,jobs,host){
  if(!process.env.RESEND_API_KEY)throw new Error('RESEND_API_KEY missing');
  const subject=jobs.length===1?`Nytt jobb: ${jobs[0].title}`:`${jobs.length} nya jobb matchar din Jobbradar`;
  const rows=jobs.slice(0,20).map(j=>`<div style="padding:14px 0;border-bottom:1px solid #e4ece9"><a href="${esc(j.url)}" style="font-size:16px;font-weight:700;color:#0f6b5b;text-decoration:none">${esc(j.title)}</a><div style="margin-top:4px;color:#50635f">${esc(j.employer)}${j.location?` · ${esc(j.location)}`:''}</div></div>`).join('');
  const unsub=`https://${host}/api/alerts/unsubscribe?token=${encodeURIComponent(alert.unsubscribe_token)}`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ALERT_FROM_EMAIL||'Vårdanställning <onboarding@resend.dev>',to:[alert.email],subject,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17312d"><h2>Din Jobbradar hittade nytt</h2>${rows}<p style="margin-top:22px;font-size:12px;color:#7b8986"><a href="${unsub}" style="color:#667773">Avsluta bevakningen</a></p></div>`})});
  if(!r.ok)throw new Error(`Resend ${r.status}`);
}

module.exports=async function handler(req,res){
  if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'unauthorized'});
  const sql=db();if(!sql)return res.status(503).json({error:'database_not_configured'});
  const now=Date.now();let checked=0,sent=0;
  try{
    const alerts=await sql`SELECT * FROM alerts WHERE verified=true ORDER BY COALESCE(last_checked_at, created_at) ASC LIMIT 100`;
    for(const alert of alerts){
      if(!due(alert,now))continue;checked++;
      try{
        const since=new Date(alert.last_checked_at||alert.created_at).getTime();
        const {jobs}=await fetchJobs({q:alert.query,location:alert.location,category:alert.category,limit:100,offset:0});
        const candidates=jobs.filter(j=>j.publishedAt&&new Date(j.publishedAt).getTime()>since);
        const unsent=[];
        for(const job of candidates){const key=job.url||job.id;const rows=await sql`SELECT 1 FROM alert_deliveries WHERE alert_id=${alert.id} AND job_key=${key} LIMIT 1`;if(!rows.length)unsent.push(job)}
        if(unsent.length){await sendMail(alert,unsent,req.headers.host);for(const job of unsent)await sql`INSERT INTO alert_deliveries(alert_id,job_key) VALUES(${alert.id},${job.url||job.id}) ON CONFLICT DO NOTHING`;await sql`UPDATE alerts SET last_sent_at=now(),last_checked_at=now(),updated_at=now() WHERE id=${alert.id}`;sent++}else await sql`UPDATE alerts SET last_checked_at=now(),updated_at=now() WHERE id=${alert.id}`;
      }catch(e){console.error('alert worker item',alert.id,e)}
    }
    return res.status(200).json({ok:true,checked,sent});
  }catch(e){console.error('alert worker',e);return res.status(500).json({error:'worker_failed'})}
};
