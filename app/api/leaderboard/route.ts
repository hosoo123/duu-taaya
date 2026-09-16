import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MAX=50;
const MAX_NAME=16;
const MIN_SCORE=1;

function cleanName(raw:string){
  return raw.replace(/[^\p{L}\p{N} _.-]/gu,"").trim().slice(0,MAX_NAME);
}

function toEntry(row:{id:string;name:string;score:number;streak:number;mode:string;difficulty:string;updatedAt:Date}){
  return{
    id:row.id,
    name:row.name,
    score:row.score,
    streak:row.streak,
    mode:row.mode,
    difficulty:row.difficulty,
    at:row.updatedAt.getTime(),
  };
}

async function listScores(){
  const rows=await prisma.leaderboardScore.findMany({
    orderBy:[{score:"desc"},{streak:"desc"},{updatedAt:"asc"}],
    take:MAX,
  });
  return rows.map(toEntry);
}

export async function GET(){
  try{
    const scores=await listScores();
    return NextResponse.json({scores,persistent:true});
  }catch(err){
    console.error("leaderboard GET",err);
    return NextResponse.json({scores:[],persistent:false,error:"db"},{status:503});
  }
}

export async function POST(req:NextRequest){
  let body:unknown;
  try{body=await req.json()}catch{
    return NextResponse.json({error:"bad json"},{status:400});
  }
  const data=body as Record<string,unknown>;
  const name=cleanName(String(data?.name||""));
  const score=Math.floor(Number(data?.score));
  const streak=Math.max(0,Math.floor(Number(data?.streak)||0));
  const mode=String(data?.mode||"mongolian").slice(0,20);
  const difficulty=String(data?.difficulty||"medium").slice(0,20);
  if(!name||name.length<2)return NextResponse.json({error:"name"},{status:400});
  if(!Number.isFinite(score)||score<MIN_SCORE||score>1_000_000){
    return NextResponse.json({error:"score"},{status:400});
  }

  const nameKey=name.toLowerCase();
  try{
    const existing=await prisma.leaderboardScore.findUnique({where:{nameKey}});
    if(existing&&score<=existing.score){
      const scores=await listScores();
      return NextResponse.json({scores,updated:false,persistent:true});
    }

    await prisma.leaderboardScore.upsert({
      where:{nameKey},
      create:{
        name,
        nameKey,
        score,
        streak,
        mode,
        difficulty,
      },
      update:{
        name,
        score,
        streak:Math.max(streak,existing?.streak||0),
        mode,
        difficulty,
      },
    });

    const scores=await listScores();
    return NextResponse.json({scores,updated:true,persistent:true});
  }catch(err){
    console.error("leaderboard POST",err);
    return NextResponse.json({error:"db"},{status:503});
  }
}
