import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/prisma";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MAX=80;
const MAX_NAME=16;
const MAX_BODY=240;

function cleanName(raw:string){
  return raw.replace(/[^\p{L}\p{N} _.-]/gu,"").trim().slice(0,MAX_NAME);
}
function cleanBody(raw:string){
  return raw.replace(/\s+/g," ").trim().slice(0,MAX_BODY);
}

type CommentRow={id:string;name:string;body:string;createdAt:Date};
const mapComment=(r:CommentRow)=>({id:r.id,name:r.name,body:r.body,at:r.createdAt.getTime()});

export async function GET(){
  try{
    const rows=await db(client=>client.comment.findMany({
      orderBy:{createdAt:"desc"},
      take:MAX,
    }));
    return NextResponse.json({comments:rows.map(mapComment)});
  }catch(err){
    console.error("comments GET",err);
    return NextResponse.json({comments:[],error:"db"},{status:503});
  }
}

export async function POST(req:NextRequest){
  let body:unknown;
  try{body=await req.json()}catch{
    return NextResponse.json({error:"bad json"},{status:400});
  }
  const data=body as Record<string,unknown>;
  const name=cleanName(String(data?.name||""));
  const text=cleanBody(String(data?.body||""));
  if(!name||name.length<2)return NextResponse.json({error:"name"},{status:400});
  if(!text||text.length<2)return NextResponse.json({error:"body"},{status:400});

  try{
    const {row,rows}=await db(async client=>{
      const row=await client.comment.create({data:{name,body:text}});
      const rows=await client.comment.findMany({orderBy:{createdAt:"desc"},take:MAX});
      return{row,rows};
    });
    return NextResponse.json({
      ok:true,
      comment:mapComment(row),
      comments:rows.map(mapComment),
    });
  }catch(err){
    console.error("comments POST",err);
    return NextResponse.json({error:"db"},{status:503});
  }
}
