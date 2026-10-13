import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { attachWebSocketServer } from './ws-lite.mjs';
import { WEAPONS, createRun, chooseRewards, applyReward, grantWeapon, switchWeapon } from './rift-core.mjs';
const WEAPON_MAP = new Map(WEAPONS.map(weapon => [weapon.id, weapon]));
const COOP_POWERS = new Set(['vital','damage','speed','shield','haste','vampire','critical','overdrive','phoenix','prism','repair','armor','chain','reactor','adrenaline','hunter','fortune','omega-lens','omega-precision','omega-jammer','omega-capacitor','omega-hunter','omega-emp','omega-oracle']);
function coopChoices(run) {
 const picks=[];let tries=0;
 while(picks.length<3&&tries++<24)for(const item of chooseRewards(run)){
   if(!item||item.type==='power'&&!COOP_POWERS.has(item.id)||picks.some(x=>x.id===item.id))continue;
   picks.push(item);if(picks.length===3)break;
 }
 return picks;
}
const MAX_PLAYERS = 4, MAX_ROOMS = 120, TICK = 50;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rooms = new Map(); let nextPlayer = 1, nextEnemy = 1;
const types = ['drone', 'ranged', 'brute', 'stalker'];
function safeName(v) { return String(v ?? 'Piloto').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Piloto'; }
function safeCode(v) { return String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
function roomCode() { let c; do { c = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(c)); return c; }
function broadcast(room, msg) { for (const p of room.players.values()) p.client.send(msg); }
function summary(room) { return { type:'lobby', code:room.code, host:room.host, started:room.started, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,dead:p.hp<=0})),maxPlayers:MAX_PLAYERS }; }
function publicLoadout(player) {
  const run = player.run;
  return { type:'loadout', id:player.id, weapon:run.weapon, weapons:run.weapons, weaponSlot:run.weaponSlot,
    upgrades:run.upgrades, shield:Math.round(player.shield), maxShield:run.maxShield, maxHp:run.maxHp, moveSpeed:run.moveSpeed, visor:run.visor };
}
function snapshot(room) { return {
  type:'state',code:room.code,wave:room.wave,phase:room.phase,
  countdown:Math.max(0,Math.ceil(room.nextWaveAt-Date.now()/1000)),score:room.score,
  players:[...room.players.values()].map(p=>({id:p.id,name:p.name,x:+p.x.toFixed(2),z:+p.z.toFixed(2),yaw:+p.yaw.toFixed(3),
    hp:Math.round(p.hp),maxHp:p.run.maxHp,shield:Math.round(p.shield),maxShield:p.run.maxShield,
    weapon:p.run.weapon,weapons:p.run.weapons,weaponSlot:p.run.weaponSlot,moveSpeed:p.run.moveSpeed,kills:p.kills,down:p.hp<=0})),
  enemies:room.enemies.map(e=>({id:e.id,type:e.type,x:+e.x.toFixed(2),z:+e.z.toFixed(2),hp:Math.ceil(e.hp),maxHp:e.maxHp,marked:(e.markedUntil||0)>Date.now()/1000})),ended:room.ended};
}
function offerRewards(room) {
  for (const p of room.players.values()) {
    p.run.wave=room.wave;
    p.offers=coopChoices(p.run);
    p.client.send({type:'rewards',wave:room.wave,
      choices:p.offers.map(({id,type,name,rarity,description,subtitle,icon})=>({id,type,name,rarity,description,subtitle,icon}))});
  }
}
function selectReward(room,p,msg) {
  if(room.phase!=='between'||!Array.isArray(p.offers)) return;
  const index=Number(msg.index), replace=Number(msg.replaceSlot);
  if(!Number.isInteger(index)||index<0||index>=p.offers.length) return;
  const reward=p.offers[index];
  if(reward.type==='weapon'){
    if(p.run.weapons.length>=3){if(!Number.isInteger(replace)||replace<0||replace>2)return;}
    grantWeapon(p.run,reward.id,p.run.weapons.length>=3?replace:null);
  }else{applyReward(p.run,reward);if(reward.id==='vital')p.hp=Math.min(p.run.maxHp,p.hp+35);if(reward.id==='shield')p.shield=p.run.maxShield;}
  p.offers=null;
  p.client.send({type:'rewardApplied',rewardId:reward.id,rewardName:reward.name});
  p.client.send(publicLoadout(p));
  broadcast(room,{type:'equipped',id:p.id,weapon:p.run.weapon});
}
function equipWeapon(room,p,msg) {
  const slot=Number(msg.slot);
  if(!Number.isInteger(slot)||slot<0||slot>=p.run.weapons.length)return;
  switchWeapon(p.run,slot);
  p.client.send(publicLoadout(p));
  broadcast(room,{type:'equipped',id:p.id,weapon:p.run.weapon});
}

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
  if(p.hp<=0||room.phase!=='combat')return;
  const gun=WEAPON_MAP.get(p.run.weapon)??WEAPON_MAP.get('pulse');
  // O servidor, nunca o cliente, define cadência, arsenal e dano.
  const cooldown=Math.max(70,Math.round(gun.interval*1000/Math.max(1,p.run.fireRate)));
  if(now-p.lastFire<cooldown)return;
  p.lastFire=now;
  const ax=-Math.sin(p.yaw),az=-Math.cos(p.yaw);
  const range=gun.model==='shotgun'||gun.model==='double'?32:60;
  const spread=gun.pellets>1?Math.max(.65,gun.spread*range*2):0;
  let target=null,near=range;
  for(const e of room.enemies) {
    const dx=e.x-p.x,dz=e.z-p.z,projection=dx*ax+dz*az;
    if(projection<0||projection>=near)continue;
    const off=Math.abs(dx*az-dz*ax);
    if(off<1+projection*.014+spread){target=e;near=projection;}
  }
  let hit=null;
  if(target) {
    hit=target.id;
    const burst=gun.pellets>1 ? Math.max(2,gun.pellets*.55) : 1;
    const critical=Math.random()<p.run.critical?2:1;
    const bossBonus=target.type==='boss'?1+p.run.bossDamage:1;
    const rage=p.hp<p.run.maxHp*.4?1+p.run.adrenaline:1;const markBonus=(target.markedUntil||0)>now/1000?1+p.run.visor.damageBonus:1;const damage=gun.damage * burst * p.run.damage * critical * bossBonus*rage*markBonus;
    target.hp-=damage;
    if(target.hp<=0){room.score+=100+room.wave*10;p.kills++;p.hp=Math.min(p.run.maxHp,p.hp+p.run.lifeSteal);if(p.run.shockwave)for(const e of room.enemies)if(e!==target&&Math.hypot(e.x-target.x,e.z-target.z)<3.5)e.hp-=18*p.run.shockwave;}
    // Armas de arco, explosão e Divinas têm efeitos sincronizados com os colegas.
    const aoe=['nova','quasar','genesis','rocket','plasma','gravity'].some(k=>gun.kind?.includes(k)||gun.id?.includes(k));
    const chain=gun.kind==='arc'||gun.kind==='genesis'||p.run.extraChains>0;
    if(aoe||chain){const radius=aoe?4.2:3.1;let extra=0;for(const enemy of room.enemies){if(enemy===target||extra>=3)continue;
      if(Math.hypot(enemy.x-target.x,enemy.z-target.z)<radius){enemy.hp-=damage*(aoe?.45:.34);extra++;}}
    }
    room.enemies=room.enemies.filter(e=>e.hp>0);
  }
  broadcast(room,{type:'fire',id:p.id,hit,x:p.x,z:p.z,yaw:p.yaw,weapon:gun.id,color:gun.color});
}

function scanOmega(room,p,now) {
 if(p.hp<=0||room.phase!=='combat'||now-p.lastScan<(p.run.visor.recharge*1000))return;
 p.lastScan=now;
 const v=p.run.visor,range=v.range||24;
 const candidates=room.enemies.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<range)
   .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
 const targets=candidates.slice(0,v.oracle?candidates.length:v.targets);
 for(const e of targets){e.markedUntil=now/1000+4;
   if(v.slow)e.slowUntil=now/1000+3;
   if(v.emp){e.hp-=v.emp;if(e.hp<=0){p.kills++;room.score+=100+room.wave*10;}}
 }
 room.enemies=room.enemies.filter(e=>e.hp>0);
 p.shield=Math.min(p.run.maxShield,p.shield+v.shield);
 p.client.send({type:'scanReady',readyAt:now+v.recharge*1000});
 broadcast(room,{type:'scan',id:p.id,count:targets.length});
}
function tick(room) {
  if(!room.started||room.ended)return;
  const now=Date.now()/1000;
  if(room.phase==='between') {if(now>=room.nextWaveAt)spawnWave(room);return;}
  if(room.enemies.length===0){room.phase='between';room.nextWaveAt=now+13;for(const p of room.players.values())if(p.hp>0){p.hp=Math.min(p.run.maxHp,p.hp+25);p.shield=Math.min(p.run.maxShield,p.shield+15);}offerRewards(room);broadcast(room,{type:'waveComplete',wave:room.wave});return;}
  for(const e of room.enemies){
    const targets=[...room.players.values()].filter(p=>p.hp>0).sort((a,b)=>Math.hypot(e.x-a.x,e.z-a.z)-Math.hypot(e.x-b.x,e.z-b.z));const p=targets[0];if(!p)break;
    const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz);
    const speed=(e.type==='boss'?1.35:e.type==='stalker'?3.6:e.type==='brute'?1.5:2.1)*(e.slowUntil>now?.45:1);
    if(dist>1.45){e.x+=dx/dist*speed*(TICK/1000);e.z+=dz/dist*speed*(TICK/1000);}
    if(dist<1.55&&now>e.attackAt){let harm=(e.type==='boss'?22:12)*(1-p.run.armor);const blocked=Math.min(p.shield,harm);p.shield-=blocked;harm-=blocked;p.hp=Math.max(0,p.hp-harm);if(p.hp===0&&p.run.phoenix){p.run.phoenix=false;p.hp=p.run.maxHp;p.shield=p.run.maxShield;broadcast(room,{type:'phoenix',id:p.id});}e.attackAt=now+1.1;broadcast(room,{type:'hurt',id:p.id,hp:p.hp,shield:p.shield});}
  }
  if([...room.players.values()].every(p=>p.hp<=0)){room.phase='ended';room.ended=true;broadcast(room,{type:'gameOver',wave:room.wave,score:room.score});}
}
export function createGameServer({port=Number(process.env.PORT)||3000,hostname='0.0.0.0',origin=process.env.ALLOWED_ORIGIN??'https://rift-wave-arena.vercel.app'}={}) {
  const allowedOrigins = new Set([origin,'http://localhost:3000','http://127.0.0.1:3000','http://localhost:5173','http://127.0.0.1:5173']);
  const server=createServer((req,res)=>{if(req.url==='/health'||req.url==='/'){res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify({ok:true,game:'Rift Wave Co-op',rooms:rooms.size,version:'4.4-arsenal'}));return;}res.writeHead(404);res.end('Not Found');});
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
        const id=String(nextPlayer++);p={id,name:safeName(msg.name),room,client,x:(room.players.size%2?3:-3),z:9-Math.floor(room.players.size/2)*3,yaw:0,hp:100,shield:50,run:createRun(),offers:null,kills:0,lastMove:now,lastFire:0,lastScan:0,ready:true};room.players.set(id,p);room.host??=id;
        client.send({type:'welcome',id,code:room.code});client.send(publicLoadout(p));broadcast(room,summary(room));if(room.started){client.send(snapshot(room));if(room.phase==='between') {p.run.wave=room.wave;p.offers=coopChoices(p.run);client.send({type:'rewards',wave:room.wave,choices:p.offers.map(({id,type,name,rarity,description,subtitle,icon})=>({id,type,name,rarity,description,subtitle,icon}))});}}return;
      }
      if(!p)return sendError('Entre em uma sala primeiro.');const room=p.room;if(!room)return;
      if(msg.type==='start'){if(room.host!==p.id)return sendError('Só o anfitrião pode iniciar.');if(room.started)return;room.started=true;room.phase='between';room.nextWaveAt=Date.now()/1000+2;broadcast(room,{type:'started'});broadcast(room,summary(room));return;}
      if(msg.type==='move'&&room.started){movePlayer(p,msg,now);return;}
      if(msg.type==='fire'&&room.started){fire(room,p,now);return;}
      if(msg.type==='scan'&&room.started){scanOmega(room,p,now);return;}
      if(msg.type==='equip'){equipWeapon(room,p,msg);return;}
      if(msg.type==='choose'&&room.started){selectReward(room,p,msg);return;}
      if(msg.type==='revive'&&room.started&&p.hp>0){const ally=room.players.get(String(msg.id));if(ally&&ally.hp<=0&&Math.hypot(ally.x-p.x,ally.z-p.z)<3.5){ally.hp=Math.min(50,ally.run.maxHp);broadcast(room,{type:'revived',id:ally.id,by:p.id});}return;}
      if(msg.type==='leave'){disconnect(p);p=null;return;}
    };
    client.onclose=()=>{if(p)disconnect(p);};
  },headerOrigin=>!headerOrigin||allowedOrigins.has(headerOrigin));
  const interval=setInterval(()=>{for(const room of rooms.values()){tick(room);if(room.started){room.frame=(room.frame||0)+1;if(room.frame%2===0)broadcast(room,snapshot(room));}}},TICK);
  server.on('close',()=>clearInterval(interval));
  return {server,rooms,listen:()=>new Promise(resolve=>server.listen(port,hostname,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{for(const socket of sockets)socket.destroy();server.close(resolve);})};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href) { const app=createGameServer();app.listen().then(a=>console.log(`Rift Wave Co-op listening on ${a.port}`)); }