const CAST_URL = 'https://www.nbc.com/nbc-insider/the-traitors-new-blood-cast';

const CONTESTANTS = [
  'Abbey Benjamin','Abby Lee','Arisa Thomas','Ben McDonnell','Clyde Moser','Jay Vinnedge','Joe Vanella','Katie Fites',
  'Kim Daily','Kriste Lewis','Logan Smith','Madeline Kostopulos','Mark Zgoda','Michael Foote','Morgan Cook','Niyyah Bilal Hayes',
  'Shane Beatty','Sherry Kuehl','Tomica Adams','Victor Vollbrechthausen','Wyatt Gillespie','Xavier Scruggs'
];

const decode = s => String(s || '')
  .replaceAll('\\u002F','/')
  .replaceAll('\\/','/')
  .replaceAll('&amp;','&')
  .replaceAll('\\u0026','&')
  .replaceAll('\\u003A',':');

function normalizeUrl(raw){
  let url = decode(raw).replace(/^['\"]|['\"]$/g,'');
  if(url.startsWith('//')) url='https:'+url;
  if(url.startsWith('/')) url='https://www.nbc.com'+url;
  return url;
}

function imageUrlsFromContext(context){
  const urls=[];
  const regex=/(https?:\\?\/\\?\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?|\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi;
  let m;
  while((m=regex.exec(context))){
    const u=normalizeUrl(m[1]);
    if(/^https?:\/\//.test(u)) urls.push(u);
  }
  return urls;
}

function scoreUrl(url){
  let score=0;
  if(/nbc|nbcu|universal/i.test(url)) score+=6;
  if(/image|media|asset|cloudfront|akama/i.test(url)) score+=2;
  if(/\.jpg|\.jpeg/i.test(url)) score+=2;
  if(/1200|1600|1920|2000|3000/i.test(url)) score+=1;
  if(/logo|icon|sprite|placeholder|promo|banner/i.test(url)) score-=8;
  return score;
}

function findPhotos(html){
  const photos={};
  const lower=html.toLowerCase();

  for(const name of CONTESTANTS){
    const needle=name.toLowerCase();
    let idx=lower.indexOf(needle);
    let candidates=[];

    // Search around several occurrences of the contestant's name because NBC may
    // serialize article blocks and responsive image metadata separately.
    for(let n=0; n<5 && idx!==-1; n++){
      const start=Math.max(0,idx-7000);
      const end=Math.min(html.length,idx+7000);
      candidates.push(...imageUrlsFromContext(html.slice(start,end)));
      idx=lower.indexOf(needle,idx+needle.length);
    }

    candidates=[...new Set(candidates)]
      .filter(u=>/^https?:\/\//.test(u))
      .sort((a,b)=>scoreUrl(b)-scoreUrl(a));

    if(candidates[0]) photos[name]=candidates[0];
  }
  return photos;
}

export default async function handler(req,res){
  try{
    const response=await fetch(CAST_URL,{
      headers:{
        'user-agent':'Mozilla/5.0 (compatible; TraitorsPool/1.0)',
        'accept':'text/html,application/xhtml+xml'
      }
    });
    if(!response.ok){
      res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=86400');
      return res.status(200).json({photos:{},source:CAST_URL,warning:`NBC returned ${response.status}`});
    }
    const html=await response.text();
    const photos=findPhotos(html);
    res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({photos,source:CAST_URL,count:Object.keys(photos).length});
  }catch(error){
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=86400');
    return res.status(200).json({photos:{},source:CAST_URL,warning:error.message});
  }
}
