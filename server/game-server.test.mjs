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