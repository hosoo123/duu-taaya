import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const EMBED="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M";

type CacheEntry={spotify:string;youtube:string;at:number};
const cache=new Map<string,CacheEntry>();
const CACHE_MS=1000*60*60*6;

let spotifyToken:string|null=null;
let spotifyTokenAt=0;

const norm=(s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-яөүё0-9]/gi,"");

const searchFallback=(title:string,artist:string)=>{
  const q=encodeURIComponent([title,artist].filter(Boolean).join(" ").trim());
  return{
    spotify:`https://open.spotify.com/search/${q}`,
    youtube:`https://www.youtube.com/results?search_query=${q}`,
  };
};

async function getSpotifyToken(){
  if(spotifyToken&&Date.now()-spotifyTokenAt<1000*60*30)return spotifyToken;
  const res=await fetch(EMBED,{headers:{ "User-Agent":UA,"Accept-Language":"en-US,en;q=0.9" },next:{revalidate:0}});
  const html=await res.text();
  const m=html.match(/"accessToken":"([^"]+)"/);
  if(!m)return null;
  spotifyToken=m[1];
  spotifyTokenAt=Date.now();
  return spotifyToken;
}

async function resolveSpotify(title:string,artist:string,fallback:string){
  try{
    const token=await getSpotifyToken();
    if(!token)return fallback;
    const q=encodeURIComponent(`track:"${title}" artist:"${artist}"`);
    const res=await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=8`,{
      headers:{Authorization:`Bearer ${token}`,"User-Agent":UA,Accept:"application/json"},
      next:{revalidate:0},
    });
    if(!res.ok){
      // simpler query once
      const q2=encodeURIComponent(`${title} ${artist}`);
      const res2=await fetch(`https://api.spotify.com/v1/search?q=${q2}&type=track&limit=8`,{
        headers:{Authorization:`Bearer ${token}`,"User-Agent":UA,Accept:"application/json"},
        next:{revalidate:0},
      });
      if(!res2.ok)return fallback;
      return pickSpotify(await res2.json(),title,artist,fallback);
    }
    return pickSpotify(await res.json(),title,artist,fallback);
  }catch{
    return fallback;
  }
}

function pickSpotify(data:any,title:string,artist:string,fallback:string){
  const items:any[]=data?.tracks?.items||[];
  if(!items.length)return fallback;
  const nt=norm(title),na=norm(artist);
  const ranked=items.map(t=>{
    const tName=norm(t.name||"");
    const aName=norm(t.artists?.[0]?.name||"");
    let score=5;
    if(tName===nt&&aName===na)score=0;
    else if(tName===nt&&(aName.includes(na)||na.includes(aName)))score=1;
    else if(tName.startsWith(nt)&&aName.includes(na))score=2;
    else if(tName.includes(nt)&&aName.includes(na))score=3;
    else if(tName.includes(nt)||nt.includes(tName))score=4;
    return{t,score};
  }).sort((a,b)=>a.score-b.score);
  const best=ranked[0]?.t;
  if(best?.external_urls?.spotify)return best.external_urls.spotify as string;
  if(best?.id)return `https://open.spotify.com/track/${best.id}`;
  return fallback;
}

async function resolveYoutube(title:string,artist:string,fallback:string){
  try{
    const q=encodeURIComponent(`${artist} ${title} official audio`);
    const res=await fetch(`https://www.youtube.com/results?search_query=${q}&hl=en`,{
      headers:{ "User-Agent":UA,"Accept-Language":"en-US,en;q=0.9" },
      next:{revalidate:0},
    });
    if(!res.ok)return fallback;
    const html=await res.text();
    const ids=[...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map(m=>m[1]);
    const unique=[...new Set(ids)];
    const id=unique[0];
    return id?`https://www.youtube.com/watch?v=${id}`:fallback;
  }catch{
    return fallback;
  }
}

export async function GET(req:NextRequest){
  const title=(req.nextUrl.searchParams.get("title")||"").trim();
  const artist=(req.nextUrl.searchParams.get("artist")||"").trim();
  if(!title&&!artist){
    return NextResponse.json({error:"missing title/artist"},{status:400});
  }
  const key=`${norm(title)}|${norm(artist)}`;
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<CACHE_MS){
    return NextResponse.json({spotify:hit.spotify,youtube:hit.youtube,cached:true});
  }
  const fb=searchFallback(title,artist);
  const [spotify,youtube]=await Promise.all([
    resolveSpotify(title,artist,fb.spotify),
    resolveYoutube(title,artist,fb.youtube),
  ]);
  cache.set(key,{spotify,youtube,at:Date.now()});
  return NextResponse.json({spotify,youtube,cached:false});
}
