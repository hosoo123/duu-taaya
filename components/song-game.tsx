"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {animeRomajiByCanon,animeRomajiDisplay,animeSources,animeSourcesByTitle,cuePoints,difficultyLimits,foreignFeatured,foreignPools,mongolianFeatured,mongolianPools,type Difficulty,type Genre,type Mode} from "@/data/catalog";
type Track={trackId:number;artistId:number;trackName:string;artistName:string;previewUrl:string;artworkUrl100?:string;releaseDate?:string;collectionName?:string;wrapperType:string};
const genres:Genre[]=["all","new","hiphop","pop","rock","traditional","anime","jpop"];
const instrumental=/\b(instrumental|karaoke|backing track|minus one|no vocals?|vocal off|off vocal|beat only)\b|зөвхөн ая|ая хувилбар/i;
const edition=/\b(remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit)\b/i;
const norm=(s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-яөүё0-9]/gi,"");
const canonicalTitle=(s:string)=>norm((s||"").replace(/\s*[\[(][^\])]*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size|from\s*[^\])]+)[^\])]*[\])]/gi,"").replace(/\s*[-–—]\s*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size).*$/i,""));
const distance=(a:string,b:string)=>{const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const row=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){let prev=row[0];row[0]=i;for(let j=1;j<=n;j++){const tmp=row[j];row[j]=a[i-1]===b[j-1]?prev:1+Math.min(prev,row[j],row[j-1]);prev=tmp}}return row[n]};
const sameSong=(a:Track,b:Track)=>canonicalTitle(a.trackName)===canonicalTitle(b.trackName)&&norm(a.artistName)===norm(b.artistName);
const titleHits=(guess:string,title:string)=>{const q=canonicalTitle(guess),t=canonicalTitle(title);if(!q||!t)return false;if(q===t)return true;const need=Math.max(5,Math.ceil(t.length*.85));if(q.length<need)return false;const maxDist=t.length<=5?0:t.length<=10?1:t.length<=18?2:3;return distance(q,t)<=maxDist};
const romajiHits=(guess:string,track:Track)=>{const key=canonicalTitle(track.trackName);const alts=animeRomajiByCanon[key]||[];return alts.some(alt=>titleHits(guess,alt))};
const guessCorrect=(guess:string,track:Track,picked:Track|null,selectedId:number|null)=>selectedId===track.trackId||(!!picked&&sameSong(picked,track))||titleHits(guess,track.trackName)||romajiHits(guess,track);
const animeOf=(t:Track)=>{if(animeSources[t.trackId])return animeSources[t.trackId];const c=canonicalTitle(t.trackName);if(animeSourcesByTitle[c])return animeSourcesByTitle[c];const hit=Object.entries(animeSourcesByTitle).find(([k])=>c.length>=4&&(c.includes(k)||k.includes(c)));return hit?hit[1]:null};
const romajiOf=(t:Track)=>{const c=canonicalTitle(t.trackName);if(animeRomajiDisplay[c])return animeRomajiDisplay[c];const hit=Object.entries(animeRomajiDisplay).find(([k])=>c.length>=4&&(c.includes(k)||k.includes(c)));return hit?hit[1]:null};
const listenQuery=(t:Track)=>{const r=romajiOf(t),a=animeOf(t);return encodeURIComponent([r||t.trackName,t.artistName,a?`anime ${a}`:""].filter(Boolean).join(" "))};
const spotifyUrl=(t:Track)=>`https://open.spotify.com/search/${listenQuery(t)}`;
const youtubeUrl=(t:Track)=>`https://www.youtube.com/results?search_query=${listenQuery(t)}`;
type SkippedInfo={trackName:string;artistName:string;romaji:string|null;anime:string|null;spotify:string;youtube:string};
const animeAliases:Record<string,string[]>={
 "demonslayerkimetsunoyaiba":["demonslayer","kimetsu","kny"],
 "demonslayermugentrain":["demonslayer","mugentrain","kimetsu"],
 "tokyoghoul":["tokyoghoul","ghoul"],
 "swordartonline":["sao","swordart"],
 "neongenesisevangelion":["evangelion","eva","nge"],
 "narutoshippuden":["naruto","shippuden"],
 naruto:["naruto"],
 attackontitan:["aot","snk","shingeki","titan"],
 "attackontitanthefinalseason":["aot","snk","finalseason","titan"],
 "attackontitanseason2":["aot","snk","titan"],
 "attackontitanseason3":["aot","snk","titan"],
 jujutsukaisen:["jjk","jujutsu"],
 "jujutsukaisenseason2":["jjk","jujutsu"],
 oshinoko:["oshinoko","onk"],
 chainsawman:["chainsaw","csm"],
 "mashlemagicandmuscles":["mashle"],
 dandadan:["dandadan","ddd"],
 myheroacademia:["mha","boku","heroacademia"],
 "myheroacademiaseason3":["mha","boku","heroacademia"],
 fireforce:["fireforce"],
 onepiece:["onepiece","op"],
 "onepiecefilmred":["onepiece","filmred"],
 "fullmetalalchemistbrotherhood":["fma","fmab","fullmetal"],
 cowboybebop:["bebop","cowboy"],
 bluelock:["bluelock"],
 codegeass:["codegeass","geass"],
 haikyuu:["haikyuu","haikyu"],
 yourname:["yourname","kiminonawa"],
 cyberpunkedgerunners:["cyberpunk","edgerunners"],
 initiald:["initiald","initial d","eurobeat"],
 samuraichamploo:["champloo","samurai"],
 parasytethemaxim:["parasyte"],
 ghostintheshellstandalonecomplex:["ghostintheshell","gits"],
 cityhunter:["cityhunter"],
 onepunchman:["onepunchman","opm"],
 steinsgate:["steinsgate","steins gate"],
};
const animeHit=(t:Track,q:string)=>{const a=animeOf(t);if(!a||q.length<2)return false;const na=norm(a);if(na.includes(q))return true;const aliases=animeAliases[na]||[];return aliases.some(x=>x.includes(q)||q.includes(x))};
const shuffle=<T,>(x:T[])=>{const a=[...x];for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const visibleGenres=(mode:Mode)=>genres.filter(g=>mode==="mongolian"?g!=="anime"&&g!=="jpop":g!=="traditional");
const diffLabel:Record<Difficulty,string>={easy:"Easy",medium:"Med",hard:"Hard",expert:"Pro"};
const genreLabel=(g:Genre)=>g==="all"?"Бүгд":g==="new"?"Шинэ":g==="traditional"?"Зохиол":g==="anime"?"Anime OP":g==="jpop"?"J-pop":g==="hiphop"?"Hip-Hop":g==="pop"?"Pop":"Rock";
export default function SongGame(){
 const [mode,setMode]=useState<Mode>("mongolian"),[genre,setGenre]=useState<Genre>("all"),[difficulty,setDifficulty]=useState<Difficulty>("medium"),[tracks,setTracks]=useState<Track[]>([]),[current,setCurrent]=useState<Track|null>(null),[level,setLevel]=useState(0),[score,setScore]=useState(0),[streak,setStreak]=useState(0),[round,setRound]=useState(1),[loading,setLoading]=useState(true),[playing,setPlaying]=useState(false),[message,setMessage]=useState(""),[kind,setKind]=useState<""|"good"|"bad">(""),[guess,setGuess]=useState(""),[selected,setSelected]=useState<number|null>(null),[revealed,setRevealed]=useState(false),[revealInfo,setRevealInfo]=useState<(SkippedInfo&{artwork?:string;ok:boolean})|null>(null),[lastSkipped,setLastSkipped]=useState<SkippedInfo|null>(null),[volume,setVolume]=useState(.75),[volPulse,setVolPulse]=useState(false),[suggestionsOpen,setSuggestionsOpen]=useState(false),[shaking,setShaking]=useState(false);
 const audio=useRef<HTMLAudioElement>(null),wave=useRef<HTMLDivElement>(null),searchbox=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),animation=useRef<number|null>(null),audioContext=useRef<AudioContext|null>(null),sfxContext=useRef<AudioContext|null>(null),analyser=useRef<AnalyserNode|null>(null),mediaSource=useRef<MediaElementAudioSourceNode|null>(null),remaining=useRef(0),started=useRef(0),paused=useRef(false),limits=difficultyLimits[difficulty];
 const playSfx=useCallback(async(kind:"good"|"bad")=>{try{
  const AC=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  if(!sfxContext.current)sfxContext.current=new AC();
  const ctx=sfxContext.current;
  if(ctx.state==="suspended")await ctx.resume();
  const t0=ctx.currentTime;
  const master=ctx.createGain();
  master.gain.value=.85;
  const filter=ctx.createBiquadFilter();
  filter.type="lowpass";
  filter.Q.value=.7;
  const delay=ctx.createDelay(0.5);
  delay.delayTime.value=.12;
  const feedback=ctx.createGain();
  feedback.gain.value=.22;
  const wet=ctx.createGain();
  wet.gain.value=.28;
  const dry=ctx.createGain();
  dry.gain.value=.72;
  filter.connect(dry);dry.connect(master);
  filter.connect(delay);delay.connect(wet);wet.connect(master);
  delay.connect(feedback);feedback.connect(delay);
  master.connect(ctx.destination);
  const note=(freq:number,at:number,dur:number,vol:number,type:OscillatorType="sine",slideTo?:number)=>{
   const o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createGain();
   o.type=type;
   o.frequency.setValueAtTime(freq,t0+at);
   if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,t0+at+dur*.85);
   g.gain.setValueAtTime(.0001,t0+at);
   g.gain.exponentialRampToValueAtTime(vol,t0+at+.04);
   g.gain.setValueAtTime(vol*.92,t0+at+dur*.35);
   g.gain.exponentialRampToValueAtTime(.0001,t0+at+dur);
   p.gain.value=.55;
   o.connect(g);g.connect(p);p.connect(filter);
   // soft harmonic shimmer
   const h=ctx.createOscillator(),hg=ctx.createGain();
   h.type="triangle";
   h.frequency.setValueAtTime(freq*2,t0+at);
   if(slideTo)h.frequency.exponentialRampToValueAtTime(slideTo*2,t0+at+dur*.85);
   hg.gain.setValueAtTime(.0001,t0+at);
   hg.gain.exponentialRampToValueAtTime(vol*.18,t0+at+.05);
   hg.gain.exponentialRampToValueAtTime(.0001,t0+at+dur*.9);
   h.connect(hg);hg.connect(filter);
   o.start(t0+at);o.stop(t0+at+dur+.05);
   h.start(t0+at);h.stop(t0+at+dur+.05);
  };
  if(kind==="good"){
   filter.frequency.setValueAtTime(4200,t0);
   filter.frequency.exponentialRampToValueAtTime(2800,t0+.7);
   // warm major sparkle: C5 E5 G5 B5 + soft chord swell
   [[523.25,.0,.38,.1],[659.25,.09,.4,.095],[783.99,.18,.42,.09],[987.77,.28,.48,.08]].forEach(([f,at,dur,vol])=>note(f,at,dur,vol,"sine"));
   // soft pad underneath
   note(261.63,.02,.55,.045,"sine");
   note(392,.05,.5,.035,"sine");
  }else{
   filter.frequency.setValueAtTime(1800,t0);
   filter.frequency.exponentialRampToValueAtTime(700,t0+.45);
   feedback.gain.value=.12;
   wet.gain.value=.18;
   // soft regret: gentle minor fall, not harsh
   note(311.13,0,.32,.07,"sine",246.94);
   note(246.94,.12,.38,.055,"sine",196);
   note(196,.22,.42,.04,"triangle");
  }
 }catch{}},[]);
 const romajiHitTrack=(t:Track,q:string)=>{const alts=animeRomajiByCanon[canonicalTitle(t.trackName)]||[];return alts.some(a=>canonicalTitle(a).includes(q)||q.includes(canonicalTitle(a)))};
 const stopVisualizer=useCallback(()=>{if(animation.current)cancelAnimationFrame(animation.current);animation.current=null;wave.current?.querySelectorAll<HTMLElement>(".bar").forEach(bar=>{bar.style.removeProperty("height");bar.style.removeProperty("opacity")})},[]);
 const suggestions=useMemo(()=>{const q=norm(guess);if(q.length<2)return [];const candidates=[...(current?[current]:[]),...tracks].filter(t=>norm(t.trackName).includes(q)||norm(t.artistName).includes(q)||canonicalTitle(t.trackName).includes(q)||animeHit(t,q)||romajiHitTrack(t,q)).sort((a,b)=>Number(edition.test(a.trackName))-Number(edition.test(b.trackName)));const unique=candidates.filter((t,i,a)=>a.findIndex(x=>`${canonicalTitle(x.trackName)}|${norm(x.artistName)}`===`${canonicalTitle(t.trackName)}|${norm(t.artistName)}`)===i);return unique.map(t=>{const artist=norm(t.artistName),title=canonicalTitle(t.trackName),anime=norm(animeOf(t)||"");const rank=artist===q?0:title.startsWith(q)?1:anime.includes(q)||animeHit(t,q)?2:artist.startsWith(q)?3:title.includes(q)?4:5;return{t,rank}}).sort((a,b)=>a.rank-b.rank||a.t.artistName.localeCompare(b.t.artistName)).slice(0,8).map(x=>x.t)},[guess,tracks,current]);
 const startVisualizer=useCallback(async()=>{const a=audio.current,w=wave.current;if(!a||!w)return;try{const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!audioContext.current)audioContext.current=new AudioContextClass();const ctx=audioContext.current;if(ctx.state==="suspended")await ctx.resume();if(!mediaSource.current){mediaSource.current=ctx.createMediaElementSource(a);analyser.current=ctx.createAnalyser();analyser.current.fftSize=128;analyser.current.smoothingTimeConstant=.78;mediaSource.current.connect(analyser.current);analyser.current.connect(ctx.destination)}w.classList.remove("fallback");const bars=[...w.querySelectorAll<HTMLElement>(".bar")],data=new Uint8Array(analyser.current!.frequencyBinCount);const tick=()=>{analyser.current!.getByteFrequencyData(data);bars.forEach((bar,i)=>{const mirrored=i<bars.length/2?bars.length/2-1-i:i-bars.length/2;const bin=Math.min(data.length-1,Math.floor(mirrored*data.length/(bars.length/2)));const power=data[bin]/255;bar.style.height=(10+power*108)+"px";bar.style.opacity=String(.28+power*.72)});animation.current=requestAnimationFrame(tick)};stopVisualizer();tick()}catch{w.classList.add("fallback")}},[stopVisualizer]);
 const finish=useCallback(()=>{if(timer.current)clearTimeout(timer.current);stopVisualizer();remaining.current=0;paused.current=false;audio.current?.pause();setPlaying(false)},[stopVisualizer]);
 const takeNext=useCallback((list:Track[])=>{const [item,...rest]=list;if(!item)return false;if(timer.current)clearTimeout(timer.current);audio.current?.pause();try{const old:number[]=JSON.parse(localStorage.getItem("duuTaayaRecent")||"[]");localStorage.setItem("duuTaayaRecent",JSON.stringify([item.trackId,...old.filter(x=>x!==item.trackId)].slice(0,40)))}catch{}setCurrent(item);setTracks(rest);setLevel(0);setGuess("");setSelected(null);setSuggestionsOpen(false);setRevealed(false);setRevealInfo(null);setMessage("");setKind("");remaining.current=0;paused.current=false;return true},[]);
 const load=useCallback(async()=>{setLoading(true);setMessage("");setKind("");setLastSkipped(null);const pools=mode==="mongolian"?mongolianPools:foreignPools,featured=mode==="mongolian"?mongolianFeatured:foreignFeatured;const ids=genre==="all"||genre==="new"?[...new Set(Object.values(pools).flat())]:(pools as Record<string,number[]>)[genre]||[],featuredIds=genre==="all"||genre==="new"?[...new Set(Object.values(featured).flat())]:(featured as Record<string,number[]>)[genre]||[],artists=new Set(ids),songs=new Set(featuredIds),country=mode==="foreign"?"us":"au";try{const calls=ids.map(id=>fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&limit=100&country=${country}`).then(r=>r.json()).catch(()=>({results:[]})));if(featuredIds.length)calls.push(fetch(`https://itunes.apple.com/lookup?id=${featuredIds.join(",")}&entity=song&country=${country}`).then(r=>r.json()).catch(()=>({results:[]})));const data=await Promise.all(calls);let list:Track[]=data.flatMap(x=>x.results||[]).filter((x:Track)=>x.wrapperType==="track"&&x.previewUrl&&x.trackName&&x.artistName&&(artists.has(Number(x.artistId))||songs.has(Number(x.trackId))));list=list.filter(x=>!instrumental.test(`${x.trackName} ${x.collectionName||""}`));list=[...new Map(list.map(x=>[x.trackId,x])).values()];if(genre==="new")list=list.filter(x=>x.releaseDate&&new Date(x.releaseDate)>=new Date("2025-01-01"));list=shuffle(list);let recent=new Set<number>();try{recent=new Set(JSON.parse(localStorage.getItem("duuTaayaRecent")||"[]"))}catch{}list.sort((a,b)=>Number(recent.has(a.trackId))-Number(recent.has(b.trackId)));if(!takeNext(list))throw Error()}catch{setMessage("Ачаалж чадсангүй");setKind("bad")}finally{setLoading(false)}},[mode,genre,takeNext]);
 useEffect(()=>{const id=setTimeout(()=>void load(),0);return()=>clearTimeout(id)},[load]);
 useEffect(()=>{if(audio.current)audio.current.volume=volume},[volume]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(searchbox.current&&!searchbox.current.contains(e.target as Node))setSuggestionsOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const play=(restart=false,requestedLevel=level)=>{const a=audio.current;if(!a||!current)return;if(!restart&&!paused.current&&remaining.current>0){remaining.current=Math.max(0,remaining.current-(performance.now()-started.current));paused.current=true;if(timer.current)clearTimeout(timer.current);stopVisualizer();a.pause();setPlaying(false);return}if(restart){if(timer.current)clearTimeout(timer.current);stopVisualizer();a.pause();paused.current=false;remaining.current=0}if(!paused.current||remaining.current<=0){a.currentTime=cuePoints[current.trackId]??2.5;remaining.current=limits[requestedLevel]*1000}void startVisualizer();a.play().then(()=>{started.current=performance.now();paused.current=false;setPlaying(true);timer.current=setTimeout(finish,remaining.current)}).catch(()=>{setMessage("Тоглож чадсангүй");setKind("bad")})};
 const snapshot=(t:Track,ok:boolean)=>{const anime=animeOf(t),romaji=romajiOf(t);return{trackName:t.trackName,artistName:t.artistName,romaji,anime,spotify:spotifyUrl(t),youtube:youtubeUrl(t),artwork:t.artworkUrl100,ok}};
 const reveal=(ok:boolean)=>{if(!current)return;finish();void playSfx(ok?"good":"bad");const info=snapshot(current,ok);setRevealInfo(info);if(!ok)setLastSkipped(info);setRevealed(true);setSuggestionsOpen(false);setMessage("");setKind(ok?"good":"bad");setTimeout(()=>{setRound(r=>r>=10?1:r+1);if(!takeNext(tracks))load()},3200)};
 const submit=()=>{if(!current||revealed)return;const q=norm(guess);if(q.length<2){void playSfx("bad");setMessage("Нэрээ бич");setKind("bad");setShaking(true);setTimeout(()=>setShaking(false),450);return}const picked=selected==null?null:[current,...tracks].find(t=>t.trackId===selected)??null;const ok=guessCorrect(guess,current,picked,selected);if(ok){setScore(s=>s+Math.max(20,100-level*20));setStreak(s=>s+1);reveal(true)}else{void playSfx("bad");setStreak(0);setMessage("Буруу");setKind("bad");setShaking(true);setTimeout(()=>setShaking(false),450)}};
 const volTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const bumpVolRef=useRef<(d:number)=>void>(()=>{});
 const bumpVol=(delta:number)=>{setVolume(v=>Math.min(1,Math.max(0,Math.round((v+delta)*20)/20)));if(volTimer.current)clearTimeout(volTimer.current);setVolPulse(true);volTimer.current=setTimeout(()=>setVolPulse(false),280)};
 bumpVolRef.current=bumpVol;
 const scrubVol=(e:React.PointerEvent<HTMLDivElement>,vertical:boolean)=>{const rect=e.currentTarget.getBoundingClientRect();const raw=vertical?1-(e.clientY-rect.top)/Math.max(rect.height,1):(e.clientX-rect.left)/Math.max(rect.width,1);setVolume(Math.min(1,Math.max(0,Math.round(raw*20)/20)));if(volTimer.current)clearTimeout(volTimer.current);setVolPulse(true);volTimer.current=setTimeout(()=>setVolPulse(false),280)};
 useEffect(()=>{const onWheel=(e:WheelEvent)=>{const el=(e.target as Element|null)?.closest?.(".vol-ctrl");if(!el)return;e.preventDefault();bumpVolRef.current(e.deltaY<0||e.deltaX<0?.05:-.05)};document.addEventListener("wheel",onWheel,{passive:false,capture:true});return()=>document.removeEventListener("wheel",onWheel,true)},[]);
 const volCtrl=(vertical:boolean)=>(
  <div className={`vol-ctrl ${vertical?"vert":"horiz"} ${volPulse?"pulse":""}`}>
   <button type="button" className="vol-btn" aria-label="Багасгах" onClick={()=>bumpVol(-.05)}>−</button>
   <div
    className="vol-meter"
    role="slider"
    tabIndex={0}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(volume*100)}
    aria-label="Дууны чанга"
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);scrubVol(e,vertical)}}
    onPointerMove={e=>{if(e.buttons)scrubVol(e,vertical)}}
    onKeyDown={e=>{if(e.key==="ArrowUp"||e.key==="ArrowRight"){e.preventDefault();bumpVol(.05)}if(e.key==="ArrowDown"||e.key==="ArrowLeft"){e.preventDefault();bumpVol(-.05)}}}
   ><i style={{"--p":`${Math.round(volume*100)}%`} as React.CSSProperties}/></div>
   <button type="button" className="vol-btn" aria-label="Нэмэх" onClick={()=>bumpVol(.05)}>+</button>
   <span className="vol-pct">{Math.round(volume*100)}</span>
  </div>
 );
 return (
  <main className="shell">
   <aside className="rail">
    <div className="brand"><span className="mark">♫</span><span>Дуугаа Таа</span></div>
    <div className="rail-block">
     <div className="difficulty">{(["easy","medium","hard","expert"] as Difficulty[]).map(d=>(
      <button key={d} className={`diff ${difficulty===d?"active":""}`} onClick={()=>{setDifficulty(d);setLevel(0)}}>{diffLabel[d]}</button>
     ))}</div>
    </div>
    <button className="reset" onClick={()=>{setScore(0);setStreak(0);setRound(1);load()}} title="Шинээр">↻</button>
    <div className="vol-rail">{volCtrl(true)}</div>
   </aside>

   <section className="stage">
    <header className="hud">
     <div className="pills">
      <button className={`pill ${mode==="mongolian"?"on":""}`} onClick={()=>{setMode("mongolian");setGenre("all");setScore(0);setStreak(0);setRound(1)}}>Монгол</button>
      <button className={`pill ${mode==="foreign"?"on":""}`} onClick={()=>{setMode("foreign");setGenre("all");setScore(0);setStreak(0);setRound(1)}}>Гадаад</button>
     </div>
     <div className="stats"><b>{score}</b><span>оноо</span><i/><b>{streak}</b><span>streak</span><i/><b>{round}/10</b></div>
    </header>

    <div className="vol-mobile">{volCtrl(false)}</div>

    <nav className="genres">{visibleGenres(mode).map(g=>(
     <button key={g} className={`chip ${genre===g?"active":""}`} onClick={()=>{setGenre(g);setRound(1)}}>{genreLabel(g)}</button>
    ))}</nav>

    <h1 className="logo">Дуугаа Таа</h1>

    <div className={`wave ${playing?"playing":""}`} ref={wave}>
     {Array.from({length:40},(_,i)=><i className="bar" key={i} style={{"--i":i,"--h":`${14+((i*41)%82)}px`} as React.CSSProperties}/>)}
    </div>

    <button className={`play ${playing?"on":""}`} disabled={loading} onClick={()=>play()}>{playing?"Ⅱ":"▶"}</button>
    <div className="secs"><b>{limits[level]}</b>s</div>
    <div className="steps">{limits.map((_,i)=><i key={i} className={`step ${i<=level?"on":""}`}/>)}</div>

    <div className={`answer-wrap ${shaking?"shake":""}`}>
     <div className={`answer ${suggestionsOpen&&suggestions.length>0?"open":""}`}>
      <div className="searchbox" ref={searchbox}>
       {suggestionsOpen&&suggestions.length>0&&(
        <ul className="suggestions" role="listbox">
         {suggestions.map(t=>{const anime=animeOf(t),romaji=romajiOf(t);return(
          <li key={t.trackId}>
           <button type="button" className="suggestion" role="option" onClick={()=>{setSelected(t.trackId);setGuess(romaji||t.trackName);setSuggestionsOpen(false)}}>
            <b>{romaji||t.trackName}</b>
            {romaji&&t.trackName!==romaji&&<em>{t.trackName}</em>}
            <span>{t.artistName}{anime?` · ${anime}`:""}</span>
           </button>
          </li>
         )})}
        </ul>
       )}
       <input value={guess} onFocus={()=>setSuggestionsOpen(true)} onChange={e=>{setGuess(e.target.value);setSelected(null);setSuggestionsOpen(true)}} onKeyDown={e=>{if(e.key==="Enter")submit();if(e.key==="Escape")setSuggestionsOpen(false)}} autoComplete="off" spellCheck={false} placeholder="Romaji / дууны нэр…"/>
      </div>
      <button className="go" type="button" onClick={submit}>Таах</button>
     </div>
    </div>

    <div className="actions">
     <button className="ghost" onClick={()=>{if(level<limits.length-1){const n=level+1;setLevel(n);play(true,n)}else setMessage("Max")}}>+ Сонсох</button>
     <button className="ghost" onClick={()=>{setStreak(0);finish();reveal(false)}}>Skip</button>
    </div>

    {message&&<p className={`message ${kind}`}>{message}</p>}

    {!revealed&&lastSkipped&&(
     <div className="prev-skip">
      <span className="prev-skip-label">Өмнөх skip</span>
      <p className="prev-skip-title">{lastSkipped.romaji||lastSkipped.trackName}</p>
      <p className="prev-skip-meta">{lastSkipped.artistName}{lastSkipped.anime?` · ${lastSkipped.anime}`:""}</p>
      <div className="listen-row compact">
       <a className="listen spotify" href={lastSkipped.spotify} target="_blank" rel="noopener noreferrer" title="Spotify" aria-label="Spotify">
        <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
       </a>
       <a className="listen youtube" href={lastSkipped.youtube} target="_blank" rel="noopener noreferrer" title="YouTube" aria-label="YouTube">
        <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z"/></svg>
       </a>
      </div>
     </div>
    )}

    {revealed&&revealInfo&&(
     <div className="reveal-overlay" role="dialog" aria-modal="true">
      <div className={`reveal ${kind}`}>
       <small>{revealInfo.ok?"ЗӨВ":"ХАРИУЛТ"}</small>
       {revealInfo.anime&&<p className="reveal-anime reveal-anime-top"><span className="reveal-anime-label">Anime</span>{revealInfo.anime}</p>}
       {revealInfo.artwork&&<img src={revealInfo.artwork.replace("100x100","300x300")} alt=""/>}
       <strong>{revealInfo.trackName}</strong>
       {revealInfo.romaji&&revealInfo.romaji!==revealInfo.trackName&&<p className="reveal-romaji">{revealInfo.romaji}</p>}
       <span>{revealInfo.artistName}</span>
       <div className="listen-row">
        <a className="listen spotify" href={revealInfo.spotify} target="_blank" rel="noopener noreferrer">
         <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
         Spotify
        </a>
        <a className="listen youtube" href={revealInfo.youtube} target="_blank" rel="noopener noreferrer">
         <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z"/></svg>
         YouTube
        </a>
       </div>
       <em>Бүтнээр нь сонсох бол дээр дар</em>
      </div>
     </div>
    )}
   </section>
   <audio ref={audio} crossOrigin="anonymous" src={current?.previewUrl} preload="auto" onEnded={finish}/>
  </main>
 );
}
