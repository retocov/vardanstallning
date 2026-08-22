const { db } = require('./_db');

const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedFrequencies=new Set(['instant','daily','weekly']);

async function sendVerification({email,token,query,location,category,host}){
  if(!process.env.RESEND_API_KEY) return {sent:false,reason:'email_provider_not_configured'};
  const verifyUrl=`https://${host}/api/alerts/verify?token=${encodeURIComponent(token)}`;
  const description=[query||category||'Alla vård- och omsorgsjobb',location||'Hela Sverige'].filter(Boolean).join(' · ');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:process.env.ALERT_FROM_EMAIL||'Vårdanställning <onboarding@resend.dev>',
      to:[email],
      subject:'Bekräfta din jobb-bevakning på Vårdanställning',
      html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17312d"><h2>Bekräfta din jobb-bevakning</h2><p>${description}</p><p><a href="${verifyUrl}" style="display:inline-block;background:#0f6b5b;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Bekräfta bevakning</a></p><p style="color:#667773;font-size:13px">Du får bara mejl när en ny annons matchar din bevakning. Du kan avsluta när som helst.</p></div>`
    })
  });
  if(!response.ok) throw new Error(`E-postleverantören svarade ${response.status}`);
  return {sent:true};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const sql=db();
  if(!sql) return res.status(503).json({error:'alerts_not_configured'});
  try{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const query=String(req.body?.query||'').trim().slice(0,180);
    const location=String(req.body?.location||'').trim().slice(0,120);
    const category=String(req.body?.category||'all').trim().slice(0,80);
    const frequency=allowedFrequencies.has(req.body?.frequency)?req.body.frequency:'instant';
    if(!emailRe.test(email)) return res.status(400).json({error:'invalid_email'});

    const rows=await sql`
      INSERT INTO alerts (email, query, location, category, frequency, verified, verification_token, updated_at)
      VALUES (${email}, ${query}, ${location}, ${category}, ${frequency}, false, gen_random_uuid(), now())
      ON CONFLICT (lower(email), query, location, category, frequency)
      DO UPDATE SET verified=false, verification_token=gen_random_uuid(), updated_at=now()
      RETURNING id, verification_token, unsubscribe_token
    `;
    const row=rows[0];
    const mail=await sendVerification({email,token:row.verification_token,query,location,category,host:req.headers.host});
    return res.status(mail.sent?201:202).json({ok:true,verificationSent:mail.sent,pendingEmailSetup:!mail.sent});
  }catch(err){
    console.error('alert create',err);
    return res.status(500).json({error:'could_not_create_alert'});
  }
};
