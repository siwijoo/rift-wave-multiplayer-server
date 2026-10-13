import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { attachWebSocketServer } from './ws-lite.mjs';
const MAX_PLAYERS = 4, MAX_ROOMS = 120, TICK = 50;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rooms = new Map(); let nextPlayer = 1, nextEnemy = 1;
const types = ['drone', 'ranged', 'brute', 'stalker'];
function safeName(v) { return String(v ?? 'Piloto').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Piloto'; }
function safeCode(v) { return String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
function roomCode() { let c; do { c = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(c)); return c; }
function broadcast(room, msg) { for (const p of room.players.values()) p.client.send(msg); }
function summary(room) { return { type:'lobby', code:room.code, host:room.host, started:room.started, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,dead:p.hp<=0})),maxPlayers:MAX_PLAYERS }; }
function snapshot(room) { return { type:'state', code:room.code, wave:room.wave, phase:room.phase, countdown:Math.max(0, Math.ceil(room.nextWaveAt - Date.now()/1000)), score:room.score, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,x:+p.x.toFixed(2),z:+p.z.toFixed(2),yaw:+p.yaw.toFixed(3),hp:Math.round(p.hp),kills:p.kills,down:p.hp<=0})), enemies:room.enemies.map(e=>({id:e.id,type:e.type,x:+e.x.toFixed(2),z:+e.z.toFixed(2),hp:Math.ceil(e.hp),maxHp:e.maxHp})), ended:room.ended }; }
function spawnWave(room) {
  room.wave++; room.phase='combat'; room.enemies=[]; room.nextWaveAt=0;
  const count = Math.min(35,4 + room.wave * 2 + room.players.size * 2);
  for(let i=0;i<count;i++) {
    const type = room.wave%5===0 && i===0?'boss':room.wave>2?types[i%4]:'drone';
    const angle=(i/count)*Math.PI*2,dist=15+Math.random()*6;
    const hpBase=type==='boss'?530:type==='brute'?95:type==='ranged'?65:type==='stalker'?55:50;
    room.enemies.push({id:nextEnemy++,type,x:Math.cos(angle)*dist,z:Math.sin(angle)*dist,hp:Math.round(hpBase*(1+(room.wave-1)*.14)),maxHp:Math.round(hpBase*(1+(room.wave-1)*.14)),attackAt:0});
  }
  broadcast(room,{type:'wave',wave:room.wave});
}
function disconnect(player) {
  const room=player.room;
  if(!room)return;
  room.players.delete(player.id); player.room=null;
  if(!room.players.size) {rooms.delete(room.code); return;}
  if(room.host===player.id)room.host=room.players.keys().next().value;
  broadcast(room,summary(room));
}
function movePlayer(p,msg,now) {
  if(p.hp<=0)return;
  const x=Number(msg.x), z=Number(msg.z), yaw=Number(msg.yaw);
  if(![x,z,yaw].every(Number.isFinite))return;
  const dt=clamp((now-p.lastMove)/1000,0,0.18),limit=12*dt+0.5,dx=x-p.x,dz=z-p.z,distance=Math.hypot(dx,dz);
  const scale=distance>limit?limit/distance:1;
  p.x=clamp(p.x+dx*scale,-22,22);p.z=clamp(p.z+dz*scale,-22,22);p.yaw=clamp(yaw,-1e6,1e6);p.lastMove=now;
}
function fire(room,p,now) {
  if(p.hp<=0||room.phase!=='combat'||now-p.lastFire<180)return;
  p.lastFire=now;
  const ax=-Math.sin(p.yaw),az=-Math.cos(p.yaw);
  let target=null,near=55;
  for(const e of room.enemies) {
    const dx=e.x-p.x,dz=e.z-p.z,projection=dx*ax+dz*az;
    if(projection<0||projection>=near)continue;
    const off=Math.abs(dx*az-dz*ax);
    if(off<1.0+projection*.014){target=e;near=projection;}
  }
  if(target){target.hp-=34; if(target.hp<=0){room.score+=100 + room.wave*10;p.kills++;room.enemies=room.enemies.filter(e=>e.hp>0);}}
  broadcast(room,{type:'fire',id:p.id,hit:target?.id??null,x:p.x,z:p.z,yaw:p.yaw});
}
function tick(room) {
  if(!room.started||room.ended)return;
  const now=Date.now()/1000;
  if(room.phase==='between') {if(now>=room.nextWaveAt)spawnWave(room);return;}
  if(room.enemies.length===0){room.phase='between';room.nextWaveAt=now+6;for(const p of room.players.values())if(p.hp>0)p.hp=Math.min(100,p.hp+25);broadcast(room,{type:'waveComplete',wave:room.wave});return;}
  for(const e of room.enemies){
    const targets=[...room.players.values()].filter(p=>p.hp>0).sort((a,b)=>Math.hypot(e.x-a.x,e.z-a.z)-Math.hypot(e.x-b.x,e.z-b.z));const p=targets[0];if(!p)break;
    const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz);
    const speed=e.type==='boss'?1.35:e.type==='stalker'?3.6:e.type==='brute'?1.5:2.1;
    if(dist>1.45){e.x+=dx/dist*speed*(TICK/1000);e.z+=dz/dist*speed*(TICK/1000);}
    if(dist<1.55&&now>e.attackAt){p.hp=Math.max(0,p.hp-(e.type==='boss'?22:12));e.attackAt=now+1.1;broadcast(room,{type:'hurt',id:p.id,hp:p.hp});}
  }
  if([...room.players.values()].every(p=>p.hp<=0)){room.phase='ended';room.ended=true;broadcast(room,{type:'gameOver',wave:room.wave,score:room.score});}
}
export function createGameServer({port=Number(process.env.PORT)||3000,hostname='0.0.0.0',origin=process.env.ALLOWED_ORIGIN??'https://rift-wave-arena.vercel.app'}={}) {
  const allowedOrigins = new Set([origin,'http://localhost:3000','http://127.0.0.1:3000','http://localhost:5173','http://127.0.0.1:5173']);
  const server=createServer((req,res)=>{if(req.url==='/health'||req.url==='/'){res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify({ok:true,game:'Rift Wave Co-op',rooms:rooms.size,version:'4.3'}));return;}res.writeHead(404);res.end('Not Found');});
  const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  attachWebSocketServer(server,client=>{
    let p=null;let recent=0;
    const sendError=message=>client.send({type:'error',message});
    client.onmessage=msg=>{
      if(!msg||typeof msg!=='object'||typeof msg.type!=='string')return;
      const now=Date.now();if(now-recent<8)return;recent=now;
      if(msg.type==='create'||msg.type==='join') {
        if(p)return sendError('Você já está numa sala.');
        if(msg.type==='create'&&rooms.size>=MAX_ROOMS)return sendError('Servidor cheio, tente mais tarde.');
        let room;if(msg.type==='create'){const code=roomCode();room={code,players:new Map(),host:null,started:false,ended:false,phase:'lobby',wave:0,score:0,enemies:[],nextWaveAt:0};rooms.set(code,room);}else{room=rooms.get(safeCode(msg.code));if(!room)return sendError('Sala não encontrada. Confira o código.');if(room.players.size>=MAX_PLAYERS)return sendError('Sala cheia (4/4).');if(room.ended)return sendError('A partida terminou. Crie outra sala.');}
        const id=String(nextPlayer++);p={id,name:safeName(msg.name),room,client,x:(room.players.size%2?3:-3),z:9-Math.floor(room.players.size/2)*3,yaw:0,hp:100,kills:0,lastMove:now,lastFire:0,ready:true};room.players.set(id,p);room.host??=id;
        client.send({type:'welcome',id,code:room.code});broadcast(room,summary(room));if(room.started)client.send(snapshot(room));return;
      }
      if(!p)return sendError('Entre em uma sala primeiro.');const room=p.room;if(!room)return;
      if(msg.type==='start'){if(room.host!==p.id)return sendError('Só o anfitrião pode iniciar.');if(room.started)return;room.started=true;room.phase='between';room.nextWaveAt=Date.now()/1000+2;broadcast(room,{type:'started'});broadcast(room,summary(room));return;}
      if(msg.type==='move'&&room.started){movePlayer(p,msg,now);return;}
      if(msg.type==='fire'&&room.started){fire(room,p,now);return;}
      if(msg.type==='revive'&&room.started&&p.hp>0){const ally=room.players.get(String(msg.id));if(ally&&ally.hp<=0&&Math.hypot(ally.x-p.x,ally.z-p.z)<3.5){ally.hp=50;broadcast(room,{type:'revived',id:ally.id,by:p.id});}return;}
      if(msg.type==='leave'){disconnect(p);p=null;return;}
    };
    client.onclose=()=>{if(p)disconnect(p);};
  },headerOrigin=>!headerOrigin||allowedOrigins.has(headerOrigin));
  const interval=setInterval(()=>{for(const room of rooms.values()){tick(room);if(room.started){room.frame=(room.frame||0)+1;if(room.frame%2===0)broadcast(room,snapshot(room));}}},TICK);
  server.on('close',()=>clearInterval(interval));
  return {server,rooms,listen:()=>new Promise(resolve=>server.listen(port,hostname,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{for(const socket of sockets)socket.destroy();server.close(resolve);})};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href) { const app=createGameServer();app.listen().then(a=>console.log(`Rift Wave Co-op listening on ${a.port}`)); }