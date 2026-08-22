const {fetchJobs}=require('./_jobs-core');
module.exports=async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const data=await fetchJobs({q:req.query.q||'',location:req.query.location||'',category:req.query.category||'all',offset:req.query.offset||0,limit:req.query.limit||40});
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=1800');
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).json({...data,updatedAt:new Date().toISOString(),source:'JobAd Links / Arbetsförmedlingen JobTech'});
  }catch(err){
    console.error(err); return res.status(502).json({error:'Kunde inte hämta annonser just nu.',detail:err.message});
  }
};
