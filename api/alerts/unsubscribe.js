const { db } = require('../_db');
module.exports=async function handler(req,res){
  const sql=db();
  if(!sql) return res.status(503).send('Bevakningar är inte konfigurerade ännu.');
  const token=String(req.query?.token||'');
  if(!token) return res.status(400).send('Ogiltig länk.');
  try{
    const rows=await sql`DELETE FROM alerts WHERE unsubscribe_token::text=${token} RETURNING id`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(rows.length?200:404).send(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bevakning avslutad</title><body style="font-family:Arial,sans-serif;background:#f5f7f6;color:#17312d;margin:0;padding:50px 20px"><main style="max-width:560px;margin:auto;background:white;border:1px solid #dfe7e4;border-radius:18px;padding:32px"><h1>${rows.length?'Bevakningen är avslutad':'Bevakningen hittades inte'}</h1><p><a href="/" style="color:#0f6b5b;font-weight:700">Till Vårdanställning</a></p></main></body></html>`);
  }catch(e){console.error(e);return res.status(500).send('Något gick fel.');}
};
