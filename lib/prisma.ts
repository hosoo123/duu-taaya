import {PrismaClient} from "@/generated/prisma";

const globalForPrisma=globalThis as unknown as{prisma?:PrismaClient};

function createPrisma(){
  return new PrismaClient({
    log:process.env.NODE_ENV==="development"?["error","warn"]:["error"],
  });
}

export const prisma=globalForPrisma.prisma??createPrisma();

if(process.env.NODE_ENV!=="production")globalForPrisma.prisma=prisma;

/** Neon idle timeout үед нэг удаа дахин холбоод retry хийнэ */
export async function db<T>(fn:(client:PrismaClient)=>Promise<T>):Promise<T>{
  const client=globalForPrisma.prisma??prisma;
  // Hot-reload / schema шинэчлэгдсэний дараа хуучин client үлдэхээс сэргийлнэ
  if(!(client as {partyRoom?:unknown}).partyRoom){
    try{await client.$disconnect()}catch{}
    const fresh=createPrisma();
    globalForPrisma.prisma=fresh;
    return await fn(fresh);
  }
  try{
    return await fn(client);
  }catch(err){
    const msg=String((err as {message?:string})?.message||err);
    if(!/closed|connection|timed out|can't reach|p1001|p1017/i.test(msg))throw err;
    try{await client.$disconnect()}catch{}
    const fresh=createPrisma();
    globalForPrisma.prisma=fresh;
    return await fn(fresh);
  }
}
