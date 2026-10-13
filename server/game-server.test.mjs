import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from './game-server.mjs';
const wait=(ms=80)=>new Promise(r=>setTimeout(r,ms));
function connect(url){return new Promise((resolve,reject)=>{const ws=new WebSocket(url);const c={ws,messages:[]};ws.addEventListener('message',e=>{try{c.messages.push(JSON.parse(e.data))}catch{}});ws.addEventListener('open',()=>resolve(c));ws.addEventListener('error',reject);});}
async function message(c,type,timeout=1800){const end=Date.now()+timeout;while(Date.now()<end){const i=c.messages.findIndex(x=>x.type===type);if(i>=0)return c.messages.splice(i,1)[0];await wait(12);}throw new Error('No '+type+'; got '+c.messages.map(x=>x.type).join(','));}
async function send(c,payload){c.ws.send(JSON.stringify(payload));await wait(40);}
test('two real WebSocket clients share a room, start and see authoritative enemies',async()=>{
const app=createGameServer({port:0,hostname:'127.0.0.1',origin:'http://localhost:3000'});const address=await app.listen();const endpoint=`ws://127.0.0.1:${address.port}/ws`;
try{
 const a=await connect(endpoint),b=await connect(endpoint);
 await send(a,{type:'create',name:'Piloto A'});const host=await message(a,'welcome');assert.match(host.code,/^[A-F0-9]{6}$/);
 await send(b,{type:'join',name:'Piloto B',code:host.code});const guest=await message(b,'welcome');assert.equal(guest.code,host.code);
 const lobby=await message(b,'lobby');assert.equal(lobby.players.length,2);
 await send(b,{type:'start'});const rejected=await message(b,'error');assert.match(rejected.message,/anfitrião/);
 await send(a,{type:'start'});await message(a,'started');await wait(2500);
 const state=b.messages.filter(m=>m.type==='state').at(-1);assert.ok(state);assert.equal(state.players.length,2);assert.equal(state.wave,1);assert.ok(state.enemies.length>0);
 await send(a,{type:'move',x:1.1,z:8.7,yaw:0});await send(a,{type:'fire'});const shot=await message(b,'fire');assert.equal(shot.id,host.id);
 a.ws.close();b.ws.close();await wait(150);
}finally{await app.close();}
});
test('malformed code, missing rooms and health check work',async()=>{
 const app=createGameServer({port:0,hostname:'127.0.0.1',origin:'http://localhost:3000'});const {port}=await app.listen();try{
 const health=await fetch(`http://127.0.0.1:${port}/health`).then(x=>x.json());assert.equal(health.ok,true);
 const c=await connect(`ws://127.0.0.1:${port}/ws`);await send(c,{type:'join',code:'ZZZZZZ'});const err=await message(c,'error');assert.match(err.message,/não encontrada/);c.ws.close();await wait(40);
 }finally{await app.close();}
});

test('4.4 coop synchronizes original 23-weapon arsenal, equipment and legitimate wave rewards', async () => {
 const { WEAPONS } = await import('./rift-core.mjs');
 assert.equal(WEAPONS.length,23);
 const app=createGameServer({port:0,hostname:'127.0.0.1',origin:'http://localhost:3000'});
 const {port}=await app.listen();
 try {
   const host=await connect(`ws://127.0.0.1:${port}/ws`),friend=await connect(`ws://127.0.0.1:${port}/ws`);
   await send(host,{type:'create',name:'Host'});const w=await message(host,'welcome');
   const l=await message(host,'loadout');assert.deepEqual(l.weapons,['pulse']);assert.equal(l.weapon,'pulse');
   await send(friend,{type:'join',code:w.code,name:'Friend'});await message(friend,'welcome');await message(friend,'loadout');
   const room=app.rooms.get(w.code),player=room.players.get(w.id);
   await send(host,{type:'equip',slot:2});assert.equal(player.run.weapon,'pulse','invalid slot does not equip');
   await send(host,{type:'choose',index:0,replaceSlot:0});assert.equal(player.run.weapons.length,1,'outside reward phase cannot grant weapon');
   await send(host,{type:'start'});await message(host,'started');await wait(2400);
   room.enemies=[];
   const offer=await message(host,'rewards',1000);
   assert.equal(offer.choices.length,3);assert.ok(offer.choices.every(c=>c.id&&c.name&&c.rarity));
   assert.ok(offer.choices.every(c=>c.rarity!=='secret'&&c.rarity!=='divine'));
   assert.equal(room.phase,'between');
   // Force a known legitimate weapon offer to test inventory and remote synchronization.
   player.offers=[{...WEAPONS.find(x=>x.id==='arc'),type:'weapon'}];
   await send(host,{type:'choose',index:9,replaceSlot:0});assert.deepEqual(player.run.weapons,['pulse']);
   await send(host,{type:'choose',index:0,replaceSlot:0});
   const selected=await message(host,'rewardApplied');assert.equal(selected.rewardId,'arc');
   assert.deepEqual(player.run.weapons,['pulse','arc']);
   const equipped=await message(friend,'equipped');assert.equal(equipped.weapon,'arc');
   host.messages=host.messages.filter(m=>m.type!=='loadout');await send(host,{type:'equip',slot:0});const switchAck=await message(host,'loadout');assert.equal(switchAck.weapon,'pulse');
   assert.equal(player.run.weapon,'pulse');
   await send(host,{type:'equip',slot:1});const switchBack=await message(host,'loadout');assert.equal(switchBack.weapon,'arc');
   assert.equal(player.run.weapon,'arc');
   room.phase='combat';room.enemies=[{id:888,type:'drone',x:player.x,z:player.z-5,hp:200,maxHp:200,attackAt:0}];
   await send(host,{type:'fire',weapon:'genesis',damage:99999});
   const shot=await message(friend,'fire');assert.equal(shot.weapon,'arc','client cannot forge another weapon');
   assert.ok(room.enemies[0].hp>100,'server-authoritative damage cannot be forged');
   friend.ws.close();host.ws.close();await wait(100);
 } finally {await app.close();}
});