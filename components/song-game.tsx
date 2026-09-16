"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {animeRomajiByCanon,animeRomajiDisplay,animeSources,animeSourcesByTitle,cuePoints,difficultyLimits,foreignFeatured,foreignPools,mongolianFeatured,mongolianPools,type Difficulty,type Genre,type Mode} from "@/data/catalog";
type Track={trackId:number;artistId:number;trackName:string;artistName:string;previewUrl:string;artworkUrl100?:string;releaseDate?:string;collectionName?:string;wrapperType:string};
const genres:Genre[]=["all","new","hiphop","pop","rock","traditional","anime","animeAlt"];
const instrumental=/\b(instrumental|karaoke|backing track|minus one|no vocals?|vocal off|off vocal|beat only)\b|зөвхөн ая|ая хувилбар/i;
const edition=/\b(remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit)\b/i;
const norm=(s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-яөүё0-9]/gi,"");
const canonicalTitle=(s:string)=>norm((s||"").replace(/\s*[\[(][^\])]*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size|from\s*[^\])]+)[^\])]*[\])]/gi,"").replace(/\s*[-–—]\s*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size).*$/i,""));
const distance=(a:string,b:string)=>{const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const row=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){let prev=row[0];row[0]=i;for(let j=1;j<=n;j++){const tmp=row[j];row[j]=a[i-1]===b[j-1]?prev:1+Math.min(prev,row[j],row[j-1]);prev=tmp}}return row[n]};
const sameSong=(a:Track,b:Track)=>canonicalTitle(a.trackName)===canonicalTitle(b.trackName)&&norm(a.artistName)===norm(b.artistName);
const titleHits=(guess:string,title:string)=>{const q=canonicalTitle(guess),t=canonicalTitle(title);if(!q||!t)return false;if(q===t)return true;const need=Math.max(5,Math.ceil(t.length*.85));if(q.length<need)return false;const maxDist=t.length<=5?0:t.length<=10?1:t.length<=18?2:3;return distance(q,t)<=maxDist};
const romajiHits=(guess:string,track:Track)=>{const key=canonicalTitle(track.trackName);const alts=animeRomajiByCanon[key]||[];return alts.some(alt=>titleHits(guess,alt))};
const guessCorrect=(guess:string,track:Track,picked:Track|null,selectedId:number|null)=>selectedId===track.trackId||(!!picked&&sameSong(picked,track))||titleHits(guess,track.trackName)||romajiHits(guess,track);
const animeOf=(t:Track)=>animeSources[t.trackId]||animeSourcesByTitle[canonicalTitle(t.trackName)]||null;
const romajiOf=(t:Track)=>animeRomajiDisplay[canonicalTitle(t.trackName)]||null;
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
const visibleGenres=(mode:Mode)=>genres.filter(g=>mode==="mongolian"?g!=="anime"&&g!=="animeAlt":g!=="traditional");
const diffLabel:Record<Difficulty,string>={easy:"Easy",medium:"Med",hard:"Hard",expert:"Pro"};
const genreLabel=(g:Genre)=>g==="all"?"Бүгд":g==="new"?"Шинэ":g==="traditional"?"Зохиол":g==="anime"?"J-pop OP":g==="animeAlt"?"J-pop биш":g==="hiphop"?"Hip-Hop":g==="pop"?"Pop":"Rock";
export default function SongGame(){
 const [mode,setMode]=useState<Mode>("mongolian"),[genre,setGenre]=useState<Genre>("all"),[difficulty,setDifficulty]=useState<Difficulty>("medium"),[tracks,setTracks]=useState<Track[]>([]),[current,setCurrent]=useState<Track|null>(null),[level,setLevel]=useState(0),[score,setScore]=useState(0),[streak,setStreak]=useState(0),[round,setRound]=useState(1),[loading,setLoading]=useState(true),[playing,setPlaying]=useState(false),[message,setMessage]=useState(""),[kind,setKind]=useState<""|"good"|"bad">(""),[guess,setGuess]=useState(""),[selected,setSelected]=useState<number|null>(null),[revealed,setRevealed]=useState(false),[volume,setVolume]=useState(.75),[volPulse,setVolPulse]=useState(false),[suggestionsOpen,setSuggestionsOpen]=useState(false),[shaking,setShaking]=useState(false);
 const audio=useRef<HTMLAudioElement>(null),wave=useRef<HTMLDivElement>(null),searchbox=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),animation=useRef<number|null>(null),audioContext=useRef<AudioContext|null>(null),analyser=useRef<AnalyserNode|null>(null),mediaSource=useRef<MediaElementAudioSourceNode|null>(null),remaining=useRef(0),started=useRef(0),paused=useRef(false),limits=difficultyLimits[difficulty];
 const romajiHitTrack=(t:Track,q:string)=>{const alts=animeRomajiByCanon[canonicalTitle(t.trackName)]||[];return alts.some(a=>canonicalTitle(a).includes(q)||q.includes(canonicalTitle(a)))};
 const suggestions=useMemo(()=>{const q=norm(guess);if(q.length<2)return [];const candidates=[...(current?[current]:[]),...tracks].filter(t=>norm(t.trackName).includes(q)||norm(t.artistName).includes(q)||canonicalTitle(t.trackName).includes(q)||animeHit(t,q)||romajiHitTrack(t,q)).sort((a,b)=>Number(edition.test(a.trackName))-Number(edition.test(b.trackName)));const unique=candidates.filter((t,i,a)=>a.findIndex(x=>`${canonicalTitle(x.trackName)}|${norm(x.artistName)}`===`${canonicalTitle(t.trackName)}|${norm(t.artistName)}`)===i);return unique.map(t=>{const artist=norm(t.artistName),title=canonicalTitle(t.trackName),anime=norm(animeOf(t)||"");const rank=artist===q?0:title.startsWith(q)?1:anime.includes(q)||animeHit(t,q)?2:artist.startsWith(q)?3:title.includes(q)?4:5;return{t,rank}}).sort((a,b)=>a.rank-b.rank||a.t.artistName.localeCompare(b.t.artistName)).slice(0,8).map(x=>x.t)},[guess,tracks,current]);
 const stopVisualizer=useCallback(()=>{if(animation.current)cancelAnimationFrame(animation.current);animation.current=null;wave.current?.querySelectorAll<HTMLElement>(".bar").forEach(bar=>{bar.style.removeProperty("height");bar.style.removeProperty("opacity")})},[]);
 const startVisualizer=useCallback(async()=>{const a=audio.current,w=wave.current;if(!a||!w)return;try{const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!audioContext.current)audioContext.current=new AudioContextClass();const ctx=audioContext.current;if(ctx.state==="suspended")await ctx.resume();if(!mediaSource.current){mediaSource.current=ctx.createMediaElementSource(a);analyser.current=ctx.createAnalyser();analyser.current.fftSize=128;analyser.current.smoothingTimeConstant=.78;mediaSource.current.connect(analyser.current);analyser.current.connect(ctx.destination)}w.classList.remove("fallback");const bars=[...w.querySelectorAll<HTMLElement>(".bar")],data=new Uint8Array(analyser.current!.frequencyBinCount);const tick=()=>{analyser.current!.getByteFrequencyData(data);bars.forEach((bar,i)=>{const mirrored=i<bars.length/2?bars.length/2-1-i:i-bars.length/2;const bin=Math.min(data.length-1,Math.floor(mirrored*data.length/(bars.length/2)));const power=data[bin]/255;bar.style.height=(10+power*108)+"px";bar.style.opacity=String(.28+power*.72)});animation.current=requestAnimationFrame(tick)};stopVisualizer();tick()}catch{w.classList.add("fallback")}},[stopVisualizer]);
 const finish=useCallback(()=>{if(timer.current)clearTimeout(timer.current);stopVisualizer();remaining.current=0;paused.current=false;audio.current?.pause();setPlaying(false)},[stopVisualizer]);
 const takeNext=useCallback((list:Track[])=>{const [item,...rest]=list;if(!item)return false;if(timer.current)clearTimeout(timer.current);audio.current?.pause();try{const old:number[]=JSON.parse(localStorage.getItem("duuTaayaRecent")||"[]");localStorage.setItem("duuTaayaRecent",JSON.stringify([item.trackId,...old.filter(x=>x!==item.trackId)].slice(0,40)))}catch{}setCurrent(item);setTracks(rest);setLevel(0);setGuess("");setSelected(null);setSuggestionsOpen(false);setRevealed(false);setMessage("");setKind("");remaining.current=0;paused.current=false;return true},[]);
 const load=useCallback(async()=>{setLoading(true);setMessage("");setKind("");const pools=mode==="mongolian"?mongolianPools:foreignPools,featured=mode==="mongolian"?mongolianFeatured:foreignFeatured;const ids=genre==="all"||genre==="new"?[...new Set(Object.values(pools).flat())]:(pools as Record<string,number[]>)[genre]||[],featuredIds=genre==="all"||genre==="new"?[...new Set(Object.values(featured).flat())]:(featured as Record<string,number[]>)[genre]||[],artists=new Set(ids),songs=new Set(featuredIds),country=mode==="foreign"?"us":"au";try{const calls=ids.map(id=>fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&limit=100&country=${country}`).then(r=>r.json()).catch(()=>({results:[]})));if(featuredIds.length)calls.push(fetch(`https://itunes.apple.com/lookup?id=${featuredIds.join(",")}&entity=song&country=${country}`).then(r=>r.json()).catch(()=>({results:[]})));const data=await Promise.all(calls);let list:Track[]=data.flatMap(x=>x.results||[]).filter((x:Track)=>x.wrapperType==="track"&&x.previewUrl&&x.trackName&&x.artistName&&(artists.has(Number(x.artistId))||songs.has(Number(x.trackId))));list=list.filter(x=>!instrumental.test(`${x.trackName} ${x.collectionName||""}`));list=[...new Map(list.map(x=>[x.trackId,x])).values()];if(genre==="new")list=list.filter(x=>x.releaseDate&&new Date(x.releaseDate)>=new Date("2025-01-01"));list=shuffle(list);let recent=new Set<number>();try{recent=new Set(JSON.parse(localStorage.getItem("duuTaayaRecent")||"[]"))}catch{}list.sort((a,b)=>Number(recent.has(a.trackId))-Number(recent.has(b.trackId)));if(!takeNext(list))throw Error()}catch{setMessage("Ачаалж чадсангүй");setKind("bad")}finally{setLoading(false)}},[mode,genre,takeNext]);
 useEffect(()=>{const id=setTimeout(()=>void load(),0);return()=>clearTimeout(id)},[load]);
 useEffect(()=>{if(audio.current)audio.current.volume=volume},[volume]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(searchbox.current&&!searchbox.current.contains(e.target as Node))setSuggestionsOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const play=(restart=false,requestedLevel=level)=>{const a=audio.current;if(!a||!current)return;if(!restart&&!paused.current&&remaining.current>0){remaining.current=Math.max(0,remaining.current-(performance.now()-started.current));paused.current=true;if(timer.current)clearTimeout(timer.current);stopVisualizer();a.pause();setPlaying(false);return}if(restart){if(timer.current)clearTimeout(timer.current);stopVisualizer();a.pause();paused.current=false;remaining.current=0}if(!paused.current||remaining.current<=0){a.currentTime=cuePoints[current.trackId]??2.5;remaining.current=limits[requestedLevel]*1000}void startVisualizer();a.play().then(()=>{started.current=performance.now();paused.current=false;setPlaying(true);timer.current=setTimeout(finish,remaining.current)}).catch(()=>{setMessage("Тоглож чадсангүй");setKind("bad")})};
 const reveal=(ok:boolean)=>{setRevealed(true);setSuggestionsOpen(false);setMessage("");setKind(ok?"good":"bad");setTimeout(()=>{setRound(r=>r>=10?1:r+1);if(!takeNext(tracks))load()},2600)};
 const submit=()=>{if(!current||revealed)return;const q=norm(guess);if(q.length<2){setMessage("Нэрээ бич");setKind("bad");setShaking(true);setTimeout(()=>setShaking(false),450);return}const picked=selected==null?null:[current,...tracks].find(t=>t.trackId===selected)??null;const ok=guessCorrect(guess,current,picked,selected);if(ok){setScore(s=>s+Math.max(20,100-level*20));setStreak(s=>s+1);reveal(true)}else{setStreak(0);setMessage("Буруу");setKind("bad");setShaking(true);setTimeout(()=>setShaking(false),450)}};
 const volTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const bumpVolRef=useRef<(d:number)=>void>(()=>{});
 const bumpVol=(delta:number)=>{setVolume(v=>Math.min(1,Math.max(0,Math.round((v+delta)*20)/20)));if(volTimer.current)clearTimeout(volTimer.current);setVolPulse(true);volTimer.current=setTimeout(()=>setVolPulse(false),280)};
 bumpVolRef.current=bumpVol;
 const scrubVol=(e:React.PointerEvent<HTMLDivElement>,vertical:boolean)=>{const rect=e.currentTarget.getBoundingClientRect();const raw=vertical?1-(e.clientY-rect.top)/Math.max(rect.height,1):(e.clientX-rect.left)/Math.max(rect.width,1);setVolume(Math.min(1,Math.max(0,Math.round(raw*20)/20)));if(volTimer.current)clearTimeout(volTimer.current);setVolPulse(true);volTimer.current=setTimeout(()=>setVolPulse(false),280)};
 useEffect(()=>{const onWheel=(e:WheelEvent)=>{const el=(e.target as Element|null)?.closest?.(".vol-ctrl");if(!el)return;e.preventDefault();bumpVolRef.current(e.deltaY<0||e.deltaX<0?.05:-.05)};document.addEventListener("wheel",onWheel,{passive:false,capture:true});return()=>document.removeEventListener("wheel",onWheel,true)},[]);
 const animeName=current?animeOf(current):null;
 const romajiName=current?romajiOf(current):null;
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

    {revealed&&current&&(
     <div className="reveal-overlay" role="dialog" aria-modal="true">
      <div className={`reveal ${kind}`}>
       <small>{kind==="good"?"ЗӨВ":"ХАРИУЛТ"}</small>
       {current.artworkUrl100&&<img src={current.artworkUrl100.replace("100x100","300x300")} alt=""/>}
       <strong>{current.trackName}</strong>
       {romajiName&&romajiName!==current.trackName&&<p className="reveal-romaji">{romajiName}</p>}
       <span>{current.artistName}</span>
       {animeName&&<p className={`reveal-anime ${kind!=="good"?"reveal-anime-top":""}`}><span className="reveal-anime-label">Ашигласан anime</span>{animeName}</p>}
      </div>
     </div>
    )}
   </section>
   <audio ref={audio} crossOrigin="anonymous" src={current?.previewUrl} preload="auto" onEnded={finish}/>
  </main>
 );
}
