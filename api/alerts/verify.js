const { db } = require('../_db');
module.exports=async function handler(req,res){
  const sql=db();
  if(!sql) return res.status(503).send('Bevakningar är inte konfigurerade ännu.');
  const token=String(req.query?.token||'');
  if(!token) return res.status(400).send('Ogiltig länk.');
  try{
    const rows=await sql`UPDATE alerts SET verified=true, updated_at=now(), last_checked_at=now() WHERE verification_token::text=${token} RETURNING unsubscribe_token`;
    if(!rows.length) return res.status(404).send('Länken är ogiltig eller har gått ut.');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bevakning aktiverad</title><body style="font-family:Arial,sans-serif;background:#f5f7f6;color:#17312d;margin:0;padding:50px 20px"><main style="max-width:560px;margin:auto;background:white;border:1px solid #dfe7e4;border-radius:18px;padding:32px"><h1>Bevakningen är aktiverad ✓</h1><p>Vi håller nu koll på nya matchande jobb åt dig.</p><p><a href="/" style="color:#0f6b5b;font-weight:700">Till Vårdanställning</a></p></main></body></html>`);
  }catch(e){console.error(e);return res.status(500).send('Något gick fel.');}
};
