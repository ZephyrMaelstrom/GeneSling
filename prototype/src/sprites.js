/* ================= Creature sprites: one body per species, evolution adornments per stage ================= */
const OL='#160f2c';
function spriteKit(g,C){
  const fs=()=>{g.fill();g.stroke()};
  const eye1=(x,y,r=2)=>{g.lineWidth=1.5;g.fillStyle='#fff';g.fillRect(x-r,y-r,r*2,r*2);g.strokeRect(x-r,y-r,r*2,r*2);g.fillStyle=OL;g.fillRect(x-.2,y-r+1,2,r*2-1.6);g.lineWidth=2.2};
  const eyes=(x,y,gap)=>{eye1(x,y);eye1(x-gap,y)};
  const tri=(a,b,c,d,e,f)=>{g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.lineTo(e,f);g.closePath();fs()};
  return{fs,eye1,eyes,tri};
}
const BODY={
  cindlet(g,C,t,s){const{fs,eyes,tri}=spriteKit(g,C),f=Math.sin(t*14+s)*2;
    g.fillStyle=C.acc;g.beginPath();g.moveTo(-6,-6);g.lineTo(-2,-17-f);g.lineTo(1,-10);g.lineTo(4,-18+f);g.lineTo(7,-6);g.closePath();fs();
    tri(-10,5,-19,-2+f,-15,8);
    g.fillStyle=C.col;g.beginPath();g.arc(0,3,11,0,7);fs();
    g.fillStyle='rgba(255,240,200,.5)';g.beginPath();g.ellipse(1,7,6,4,0,0,7);g.fill();eyes(5,0,6)},
  pyrrox(g,C,t,s){const{fs,eye1,tri}=spriteKit(g,C),w=Math.sin(t*6+s)*3;
    g.fillStyle=C.acc;g.beginPath();g.moveTo(-8,4);g.quadraticCurveTo(-25,-4+w,-20,-15+w);g.quadraticCurveTo(-13,-4,-5,-1);g.closePath();fs();
    g.fillStyle=C.sh;[[-8,8],[4,8]].forEach(([x,y])=>{g.fillRect(x,y,4,7);g.strokeRect(x,y,4,7)});
    g.fillStyle=C.col;g.beginPath();g.ellipse(-1,4,12,8,0,0,7);fs();
    g.beginPath();g.arc(8,-3,8,0,7);fs();
    g.fillStyle=C.sh;tri(3,-8,4,-18,8,-10);tri(8,-9,12,-17,13,-7);
    g.fillStyle='#f6eedb';tri(13,-5,21,-1,13,1);g.fillStyle=OL;g.fillRect(19,-2,2,2);eye1(10,-5)},
  magmaul(g,C,t,s){const{fs,eyes}=spriteKit(g,C);
    g.fillStyle=C.sh;[[-8,-12],[8,-12]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,4,0,7);fs()});
    g.fillStyle=C.col;g.beginPath();g.roundRect(-14,-11,28,26,8);fs();
    g.strokeStyle=C.acc;g.globalAlpha=.6+.4*Math.sin(t*3+s);g.lineWidth=2;g.beginPath();g.moveTo(-10,-4);g.lineTo(-5,2);g.lineTo(-8,8);g.moveTo(-2,10);g.lineTo(2,4);g.lineTo(-1,0);g.stroke();g.globalAlpha=1;g.strokeStyle=OL;g.lineWidth=2.2;
    g.fillStyle=C.sh;g.beginPath();g.ellipse(7,5,6,4,0,0,7);fs();g.fillStyle=OL;g.fillRect(10,4,2,2);eyes(8,-3,8)},
  puffcap(g,C,t,s){const{fs,eyes}=spriteKit(g,C);
    g.fillStyle='#f2e4c9';g.beginPath();g.rect(-7,-1,14,14);fs();
    g.fillStyle=C.col;g.beginPath();g.ellipse(0,-1,15,11,0,Math.PI,0);g.closePath();fs();
    g.fillStyle='#fff';[[-7,-6,2.5],[2,-8,3],[8,-4,2]].forEach(([a,b,r])=>{g.beginPath();g.arc(a,b,r,0,7);g.fill()});eyes(4,6,6)},
  shroomite(g,C,t,s){const{fs,eye1}=spriteKit(g,C),k=Math.sin(t*12+s)*1.5;
    g.strokeStyle=OL;g.lineWidth=2;[-8,-2,4].forEach((x,i)=>{g.beginPath();g.moveTo(x,8);g.lineTo(x-3,14+(i%2?k:-k));g.stroke()});g.lineWidth=2.2;
    g.fillStyle=C.col;g.beginPath();g.ellipse(-2,2,14,10,0,0,7);fs();
    g.fillStyle='#fff';[[-8,-1,2.5],[-1,-4,3],[5,1,2]].forEach(([a,b,r])=>{g.beginPath();g.arc(a,b,r,0,7);g.fill()});
    g.fillStyle=C.sh;g.beginPath();g.arc(12,5,6,0,7);fs();
    g.fillStyle='#f6eedb';g.beginPath();g.moveTo(11,0);g.quadraticCurveTo(19,-12,11,-17);g.lineTo(13,-8);g.lineTo(9,-1);g.closePath();fs();eye1(14,4)},
  mycelisk(g,C,t,s){const{fs,eyes}=spriteKit(g,C),w=Math.sin(t*4+s)*3;
    g.lineCap='round';g.beginPath();g.moveTo(-18,10);g.bezierCurveTo(-10,-2+w,-4,16-w,6,3);g.strokeStyle=OL;g.lineWidth=12;g.stroke();g.strokeStyle=C.col;g.lineWidth=7.5;g.stroke();
    g.strokeStyle=C.acc;g.lineWidth=2;g.setLineDash([2,4]);g.stroke();g.setLineDash([]);g.lineCap='butt';g.strokeStyle=OL;g.lineWidth=2.2;
    g.fillStyle='#f2e4c9';g.beginPath();g.arc(8,1,5,0,7);fs();
    g.fillStyle=C.col;g.beginPath();g.ellipse(8,-3,10,7,0,Math.PI,0);g.closePath();fs();
    g.fillStyle='#fff';g.beginPath();g.arc(5,-6,1.8,0,7);g.arc(11,-5,1.5,0,7);g.fill();eyes(11,1,5)},
  dewdrip(g,C,t,s){const{fs,eyes,tri}=spriteKit(g,C);
    g.fillStyle=C.sh;tri(-8,2,-16,-4,-12,8);
    g.fillStyle=C.col;g.beginPath();g.moveTo(0,-15);g.bezierCurveTo(10,-4,13,4,9,10);g.bezierCurveTo(5,15,-5,15,-9,10);g.bezierCurveTo(-13,4,-10,-4,0,-15);fs();
    g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(-3,-3,2.5,4,-.4,0,7);g.fill();eyes(5,3,6)},
  coralisk(g,C,t,s){const{fs}=spriteKit(g,C),k=Math.sin(t*10+s)*1.5;
    g.strokeStyle=OL;g.lineWidth=2;[-8,-3,3,8].forEach((x,i)=>{g.beginPath();g.moveTo(x,8);g.lineTo(x+(x<0?-3:3),14+(i%2?k:-k));g.stroke()});
    g.strokeStyle=C.acc;g.lineWidth=3;g.beginPath();g.moveTo(-3,-5);g.lineTo(-6,-14);g.moveTo(-5,-10);g.lineTo(-10,-14);g.moveTo(3,-5);g.lineTo(5,-15);g.moveTo(4,-10);g.lineTo(9,-13);g.stroke();
    g.strokeStyle=OL;g.lineWidth=2.2;g.fillStyle=C.sh;[-15,15].forEach(x=>{g.beginPath();g.arc(x,-1,6,0,7);fs();g.beginPath();g.moveTo(x,-1);g.lineTo(x+(x<0?-6:6),-3);g.stroke()});
    g.fillStyle=C.col;g.beginPath();g.ellipse(0,4,13,9,0,0,7);fs();
    [-4,4].forEach(x=>{g.beginPath();g.moveTo(x,-4);g.lineTo(x,-1);g.stroke();g.fillStyle='#fff';g.beginPath();g.arc(x,-6,2.6,0,7);fs();g.fillStyle=OL;g.fillRect(x,-7,1.6,2)})},
  tidewyrm(g,C,t,s){const{fs,eye1,tri}=spriteKit(g,C),w=Math.sin(t*4+s)*3;
    g.fillStyle=C.sh;tri(-12,-2+w*.5,-8,-10,-4,0);tri(-2,2-w*.5,2,-8,5,1);
    g.lineCap='round';g.beginPath();g.moveTo(-20,8);g.bezierCurveTo(-12,-6+w,-2,10-w,8,1);g.strokeStyle=OL;g.lineWidth=12;g.stroke();g.strokeStyle=C.col;g.lineWidth=8;g.stroke();g.lineCap='butt';g.strokeStyle=OL;g.lineWidth=2.2;
    g.fillStyle=C.col;g.beginPath();g.ellipse(12,-1,8,6,0,0,7);fs();
    g.fillStyle=C.acc;tri(8,-6,10,-13,14,-6);g.beginPath();g.moveTo(19,1);g.quadraticCurveTo(23,4,21,8);g.stroke();eye1(14,-3)},
  chirrup(g,C,t,s){const{fs,eyes}=spriteKit(g,C),w=Math.sin(t*12+s)*4;
    g.fillStyle=C.sh;g.beginPath();g.moveTo(-6,0);g.lineTo(-20,-8+w);g.lineTo(-16,4);g.lineTo(-20,8);g.lineTo(-6,8);g.closePath();fs();
    g.beginPath();g.moveTo(6,0);g.lineTo(20,-8+w);g.lineTo(16,4);g.lineTo(20,8);g.lineTo(6,8);g.closePath();fs();
    g.fillStyle=C.col;g.beginPath();g.arc(0,2,9,0,7);fs();eyes(4,1,7)},
  vesperbat(g,C,t,s){const{fs,eyes,tri}=spriteKit(g,C),w=Math.sin(t*10+s)*5;
    g.fillStyle=C.sh;[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*4,-1);g.lineTo(k*24,-14+w);g.lineTo(k*19,-2);g.lineTo(k*24,6);g.lineTo(k*14,4);g.lineTo(k*12,10);g.lineTo(k*5,7);g.closePath();fs();
      g.beginPath();g.moveTo(k*5,1);g.lineTo(k*19,-2);g.moveTo(k*6,4);g.lineTo(k*14,4);g.stroke()});
    g.fillStyle=C.col;tri(-6,-6,-9,-20,-1,-8);tri(6,-6,9,-20,1,-8);
    g.beginPath();g.ellipse(0,2,8,10,0,0,7);fs();
    g.fillStyle='#fff';g.fillRect(-3,8,2,3);g.fillRect(2,8,2,3);eyes(4,0,7)},
  umbrowl(g,C,t,s){const{fs,tri}=spriteKit(g,C);
    g.fillStyle=C.sh;[-1,1].forEach(k=>{g.beginPath();g.ellipse(k*11,5,5,10,k*.3,0,7);fs()});
    g.fillStyle=C.col;g.beginPath();g.ellipse(0,3,12,14,0,0,7);fs();
    tri(-10,-7,-12,-18,-4,-10);tri(10,-7,12,-18,4,-10);
    g.fillStyle='rgba(255,255,255,.2)';g.beginPath();g.ellipse(0,8,7,7,0,0,7);g.fill();
    [-5,5].forEach(x=>{g.fillStyle='#fff';g.beginPath();g.arc(x,-3,5,0,7);fs();g.fillStyle=C.acc;g.beginPath();g.arc(x+1,-3,2.8,0,7);g.fill();g.fillStyle=OL;g.beginPath();g.arc(x+1,-3,1.4,0,7);g.fill()});
    g.fillStyle='#ffb347';tri(-2,1,2,1,0,5)},
  zephling(g,C,t,s){const{fs,eyes,tri}=spriteKit(g,C);
    g.fillStyle=C.sh;g.beginPath();g.moveTo(-4,-6);g.lineTo(-10,-16);g.lineTo(-2,-9);g.lineTo(0,-17);g.lineTo(3,-7);g.closePath();fs();
    g.fillStyle=C.col;g.beginPath();g.ellipse(0,2,12,10,0,0,7);fs();
    g.fillStyle=C.sh;g.beginPath();g.moveTo(-10,0);g.quadraticCurveTo(-20,-4+Math.sin(t*10)*3,-18,8);g.quadraticCurveTo(-12,8,-6,6);g.closePath();fs();
    g.fillStyle='#ffb347';tri(10,0,18,3,10,6);eyes(6,-1,6)},
  kestrix(g,C,t,s){const{fs,eye1,tri}=spriteKit(g,C),w=Math.sin(t*8+s)*3;
    g.fillStyle=C.sh;tri(-10,2,-22,-2,-20,8);
    g.fillStyle=C.col;g.beginPath();g.ellipse(0,2,12,8,-.15,0,7);fs();
    g.fillStyle=C.sh;tri(-2,-2,-22,-14+w,-8,6);
    g.fillStyle=C.col;g.beginPath();g.arc(9,-4,6,0,7);fs();
    g.fillStyle=OL;g.fillRect(6,-8,8,2);g.fillStyle='#ffcf4a';tri(13,-6,20,-3,14,0);
    g.fillStyle='#ffcf4a';[[-4,9],[3,9]].forEach(([x,y])=>{g.fillRect(x,y,2,5)});eye1(10,-5)},
  stormwing(g,C,t,s){const{fs,eyes}=spriteKit(g,C),w=Math.sin(t*5+s)*4;
    g.strokeStyle=C.acc;g.lineWidth=2.5;g.beginPath();g.moveTo(-8,3);g.lineTo(-15,-1);g.lineTo(-19,6);g.lineTo(-26,1);g.stroke();g.strokeStyle=OL;g.lineWidth=2.2;
    g.fillStyle=C.col;g.beginPath();g.moveTo(14,2);g.quadraticCurveTo(2,-17+w,-9,-15+w);g.quadraticCurveTo(-4,1,-9,18-w);g.quadraticCurveTo(2,16-w,14,2);g.closePath();fs();
    g.fillStyle=C.sh;g.beginPath();g.ellipse(3,2,7,4,0,0,7);g.fill();
    g.fillStyle=C.acc;[[-3,-7],[-3,10]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,1.8,0,7);g.fill()});eyes(9,-1,5)},
  shardling(g,C,t,s){const{fs,eyes}=spriteKit(g,C);
    g.fillStyle=C.col;g.beginPath();g.moveTo(0,-16);g.lineTo(12,-2);g.lineTo(0,14);g.lineTo(-12,-2);g.closePath();fs();
    g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=1.2;g.beginPath();g.moveTo(-12,-2);g.lineTo(12,-2);g.moveTo(0,-16);g.lineTo(-4,-2);g.lineTo(0,14);g.stroke();
    g.strokeStyle=OL;g.lineWidth=2.2;eyes(5,3,6)},
  prismoth(g,C,t,s){const{fs,eyes}=spriteKit(g,C),w=Math.sin(t*9+s)*.2;
    [-1,1].forEach(k=>{g.save();g.scale(k,1);g.rotate(w);
      g.globalAlpha=.85;g.fillStyle=C.col;g.beginPath();g.moveTo(2,-2);g.lineTo(18,-16);g.lineTo(22,-4);g.lineTo(8,2);g.closePath();fs();
      g.fillStyle=C.acc;g.globalAlpha=.6;g.beginPath();g.moveTo(2,2);g.lineTo(16,6);g.lineTo(12,16);g.lineTo(3,8);g.closePath();fs();g.globalAlpha=1;g.restore()});
    g.strokeStyle=OL;g.lineWidth=1.5;g.beginPath();g.moveTo(-1,-10);g.quadraticCurveTo(-6,-18,-3,-20);g.moveTo(1,-10);g.quadraticCurveTo(6,-18,3,-20);g.stroke();g.lineWidth=2.2;
    g.fillStyle=C.sh;g.beginPath();g.ellipse(0,3,4,10,0,0,7);fs();g.beginPath();g.arc(0,-8,4.5,0,7);fs();eyes(3,-8,5)},
  geodon(g,C,t,s){const{fs,eye1,tri}=spriteKit(g,C);
    g.fillStyle='#8a7a5a';[[-11,9],[7,9]].forEach(([x,y])=>{g.fillRect(x,y,5,5);g.strokeRect(x,y,5,5)});
    g.beginPath();g.arc(15,4,5,0,7);fs();
    g.fillStyle=C.col;g.beginPath();g.moveTo(-15,9);g.quadraticCurveTo(-15,-13,1,-12);g.quadraticCurveTo(15,-11,13,9);g.closePath();fs();
    g.fillStyle=C.acc;tri(-8,-8,-5,-19,-2,-9);tri(-1,-11,3,-22,6,-10);tri(5,-8,10,-16,10,-5);
    g.strokeStyle='rgba(255,255,255,.25)';g.beginPath();g.moveTo(-12,3);g.lineTo(10,3);g.stroke();g.strokeStyle=OL;eye1(16,3)},
  pebblet(g,C,t,s){const{fs,eyes}=spriteKit(g,C),r=Math.sin(t*3+s)*.15;
    g.save();g.rotate(r);g.fillStyle=C.col;g.beginPath();g.arc(0,4,11,0,7);fs();
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1.5;g.beginPath();g.moveTo(-6,-2);g.lineTo(-2,4);g.lineTo(-6,9);g.stroke();
    g.fillStyle='#7fd860';g.beginPath();g.ellipse(-3,-5,5,2.5,-.3,0,7);g.fill();g.restore();g.strokeStyle=OL;g.lineWidth=2.2;eyes(6,3,6)},
  bastion(g,C,t,s){const{fs,eyes,tri}=spriteKit(g,C);
    g.fillStyle='#f6eedb';tri(-11,-8,-15,-17,-6,-10);tri(11,-8,15,-17,6,-10);
    g.fillStyle=C.col;g.beginPath();g.rect(-13,-10,26,24);fs();
    g.fillStyle=C.sh;g.fillRect(-13,-10,26,6);g.strokeRect(-13,-10,26,6);
    g.fillStyle='rgba(60,40,10,.6)';g.fillRect(-9,8,6,6);g.fillRect(3,8,6,6);eyes(6,1,8)},
  monolord(g,C,t,s){const{fs}=spriteKit(g,C),f=Math.sin(t*2+s)*2;
    g.fillStyle=C.sh;[[-17,-2+f],[12,-2-f]].forEach(([x,y])=>{g.fillRect(x,y,6,9);g.strokeRect(x,y,6,9)});
    g.fillStyle=C.col;g.beginPath();g.moveTo(-8,14);g.lineTo(-9,-12);g.lineTo(0,-18);g.lineTo(9,-12);g.lineTo(8,14);g.closePath();fs();
    g.strokeStyle=C.acc;g.globalAlpha=.6+.4*Math.sin(t*3+s);g.lineWidth=1.6;g.beginPath();g.moveTo(-5,4);g.lineTo(-2,8);g.lineTo(2,4);g.lineTo(5,8);g.moveTo(-4,11);g.lineTo(4,11);g.stroke();g.globalAlpha=1;g.strokeStyle=OL;g.lineWidth=2.2;
    g.fillStyle='#fff';g.beginPath();g.arc(1,-5,4,0,7);fs();g.fillStyle=C.acc;g.beginPath();g.arc(2,-5,2,0,7);g.fill();
    g.fillStyle='#ffcf4a';g.beginPath();g.moveTo(-6,-21+f);g.lineTo(-6,-27+f);g.lineTo(-3,-24+f);g.lineTo(0,-29+f);g.lineTo(3,-24+f);g.lineTo(6,-27+f);g.lineTo(6,-21+f);g.closePath();fs()},
};
const HYBRID_BODY={ember:'pyrrox',fungal:'shroomite',tide:'tidewyrm',echo:'vesperbat',gale:'kestrix',crystal:'prismoth',warden:'bastion'};
function drawMark(g,type2,t){
  g.lineWidth=2;g.strokeStyle=OL;const fs=()=>{g.fill();g.stroke()};
  if(type2==='ember'){const f=Math.sin(t*14)*2;g.fillStyle='#ffd23f';g.beginPath();g.moveTo(-4,-12);g.lineTo(-1,-22-f);g.lineTo(2,-15);g.lineTo(5,-21+f);g.lineTo(6,-12);g.closePath();fs()}
  if(type2==='gale'){g.fillStyle='#4fe0c8';g.beginPath();g.moveTo(-6,-2);g.quadraticCurveTo(-24,-14+Math.sin(t*10)*3,-22,4);g.quadraticCurveTo(-13,6,-6,6);g.closePath();fs()}
  if(type2==='tide'){g.fillStyle='#3fa9ff';g.beginPath();g.moveTo(-6,-8);g.lineTo(-12,-20);g.lineTo(0,-12);g.closePath();fs()}
  if(type2==='crystal'){g.fillStyle='#ff8fe0';[[-10,-6],[-5,-12]].forEach(([x,y])=>{g.beginPath();g.moveTo(x,y);g.lineTo(x-5,y-8);g.lineTo(x+3,y-3);g.closePath();fs()})}
  if(type2==='echo'){g.fillStyle='#9b7bff';[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*3,-11);g.lineTo(k*8,-22);g.lineTo(k*10,-9);g.closePath();fs()})}
  if(type2==='warden'){g.fillStyle='#c9b48a';[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*4,-12);g.lineTo(k*10,-21);g.lineTo(k*9,-11);g.closePath();fs()})}
  if(type2==='fungal'){g.fillStyle='#e0527a';g.beginPath();g.ellipse(-6,-12,7,4,0,Math.PI,0);g.closePath();fs();g.fillStyle='#fff';g.beginPath();g.arc(-6,-14,1.4,0,7);g.fill()}
}
function stageBack(g,type,st,C,t,fin){
  if(fin){g.globalAlpha=.25+.15*Math.sin(t*3);g.fillStyle=C.acc;g.beginPath();g.arc(0,0,25,0,7);g.fill();g.globalAlpha=1}
  if(st<1)return;
  g.strokeStyle=OL;g.lineWidth=2;const fs=()=>{g.fill();g.stroke()};
  if(type==='ember'){g.fillStyle=C.acc;g.globalAlpha=.9;[[-12,-6],[-6,-13],[3,-15]].forEach(([x,y],i)=>{const f=Math.sin(t*12+i)*2;g.beginPath();g.moveTo(x-4,y+6);g.lineTo(x,y-6-f);g.lineTo(x+4,y+6);g.closePath();fs()});g.globalAlpha=1}
  if(type==='fungal'){g.fillStyle=C.col;[[-12,-6,6],[-5,-12,5]].forEach(([x,y,r])=>{g.beginPath();g.ellipse(x,y,r,r*.7,0,Math.PI,0);g.closePath();fs()})}
  if(type==='tide'){g.fillStyle=C.sh;g.beginPath();g.moveTo(-8,-6);g.quadraticCurveTo(-4,-22,4,-18);g.lineTo(4,-8);g.closePath();fs()}
  if(type==='echo'){g.strokeStyle=C.acc;g.lineWidth=2;g.globalAlpha=.7;[10,16].forEach(r=>{g.beginPath();g.arc(-6,-2,r+Math.sin(t*6)*1.5,Math.PI*.8,Math.PI*1.3);g.stroke()});g.globalAlpha=1}
  if(type==='gale'){g.fillStyle=C.acc;[[-22,-12],[-24,-4],[-22,4]].forEach(([x,y])=>{g.beginPath();g.moveTo(-6,-2);g.quadraticCurveTo(x*.6,y-4,x,y);g.quadraticCurveTo(x*.6,y+4,-6,2);g.closePath();fs()})}
  if(type==='crystal'){g.fillStyle=C.acc;for(let i=0;i<3;i++){const a=t*1.5+i*2.09,x=Math.cos(a)*20,y=Math.sin(a)*12-4;g.beginPath();g.moveTo(x,y-5);g.lineTo(x+3,y);g.lineTo(x,y+5);g.lineTo(x-3,y);g.closePath();fs()}}
  if(type==='warden'){g.fillStyle=C.sh;[[-17,-10],[11,-10]].forEach(([x,y])=>{g.fillRect(x,y,7,7);g.strokeRect(x,y,7,7)})}
}
function stageFront(g,type,st,C,t,fin){
  if(st>=2){g.strokeStyle=C.acc;g.lineWidth=2;g.globalAlpha=.85;g.beginPath();g.moveTo(-9,6);g.lineTo(-5,10);g.moveTo(-5,4);g.lineTo(-1,8);g.stroke();g.globalAlpha=1}
  if(fin){g.strokeStyle=C.acc;g.lineWidth=2;g.beginPath();g.ellipse(2,-23,8,2.5,0,0,7);g.stroke();g.fillStyle=C.acc;g.beginPath();g.arc(2,-23,2,0,7);g.fill()}
  g.strokeStyle=OL;g.lineWidth=2.2;
}
function drawCreature(g,c,x,y,s,t,o={}){
  const sp=SPECIES[c.species],st=c.stage||0,flash=o.flash;
  const C={col:flash?'#fff':sp.col,sh:flash?'#fff':sp.shade,acc:flash?'#fff':TYPES[c.type].acc};
  const body=sp.hybrid?HYBRID_BODY[c.type]:c.species;
  const seed=o.seed||0,bob=Math.sin(t*6+seed)*1.5,sz=s*(sp.size||1)*(1+.1*st);
  g.save();g.translate(x,y);g.scale(sz,sz);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,15,11,3.5,0,0,7);g.fill();
  g.translate(0,bob);if(o.face<0)g.scale(-1,1);
  g.lineWidth=2.2;g.strokeStyle=OL;g.lineJoin='round';
  const fin=st>0&&st===LINES[c.species].length-1;
  stageBack(g,c.type,st,C,t,fin);
  if(c.type2)drawMark(g,c.type2,t);
  g.lineWidth=2.2;g.strokeStyle=OL;
  BODY[body](g,C,t,seed);
  stageFront(g,c.type,st,C,t,fin);
  if(o.sex){g.font='700 9px sans-serif';g.textAlign='center';g.fillStyle=o.sex==='F'?'#ff8fb1':'#7fc8ff';g.fillText(sexSym(o.sex),13,-12)}
  g.restore();
}
function drawEgg(g,x,y,s,cols,shiny){
  g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,14,10,3,0,0,7);g.fill();
  g.fillStyle=shiny?'#fff6c8':'#f6eedb';g.strokeStyle=shiny?'#ffcf4a':OL;g.lineWidth=2.2;g.beginPath();g.ellipse(0,0,11,14,0,0,7);g.fill();g.stroke();
  [[-4,-5,0],[5,2,1],[-3,7,0],[4,-8,1]].forEach(([a,b,i])=>{g.fillStyle=cols[i]||cols[0];g.beginPath();g.arc(a,b,2.6,0,7);g.fill()});
  g.restore();
}
function drawPerson(g,id,x,y,s,t){
  const n=NPCS[id];g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,15,9,3,0,0,7);g.fill();
  const bob=Math.sin(t*2+x)*1;g.translate(0,bob);
  g.strokeStyle=OL;g.lineWidth=2;const fs=()=>{g.fill();g.stroke()};
  g.fillStyle=id==='sorrel'?'#f6eedb':n.col;g.beginPath();g.moveTo(-9,14);g.lineTo(-7,-2);g.lineTo(7,-2);g.lineTo(9,14);g.closePath();fs();
  if(id==='brannoc'){g.fillStyle='#6b4a2a';g.fillRect(-5,2,10,12);g.strokeRect(-5,2,10,12);g.fillStyle='#9a9ab0';g.fillRect(9,-2,3,12);g.strokeRect(9,-2,3,12);g.fillRect(6,-5,9,5);g.strokeRect(6,-5,9,5)}
  if(id==='sorrel'){g.fillStyle=n.col;g.fillRect(-3,0,6,14);g.fillStyle='#7fd860';g.fillRect(8,2,4,7);g.strokeRect(8,2,4,7)}
  if(id==='pip'){g.fillStyle='#c9b48a';g.fillRect(8,-1,10,4);g.strokeRect(8,-1,10,4)}
  g.fillStyle=n.skin;g.beginPath();g.arc(0,-8,7,0,7);fs();
  if(id==='brannoc'){g.fillStyle='#6b4a2a';g.beginPath();g.moveTo(-6,-6);g.quadraticCurveTo(0,4,6,-6);g.lineTo(5,-3);g.quadraticCurveTo(0,6,-5,-3);g.closePath();g.fill();g.fillStyle='#3a2a1a';g.beginPath();g.arc(0,-11,7,Math.PI,0);g.fill()}
  if(id==='pip'){g.fillStyle=n.col;g.beginPath();g.moveTo(-8,-6);g.quadraticCurveTo(0,-22,8,-6);g.lineTo(6,-10);g.quadraticCurveTo(0,-14,-6,-10);g.closePath();fs()}
  if(id==='sorrel'){g.fillStyle='#2a2a3a';g.beginPath();g.arc(0,-11,7,Math.PI,0);g.fill();g.fillStyle='#9fe8ff';g.fillRect(-5,-10,4,3);g.fillRect(1,-10,4,3);g.strokeRect(-5,-10,4,3);g.strokeRect(1,-10,4,3)}
  g.fillStyle=OL;if(id!=='sorrel'){g.fillRect(-3,-9,2,2);g.fillRect(2,-9,2,2)}
  g.restore();
}
function paintSprites(root){
  const dpr=window.devicePixelRatio||1;
  root.querySelectorAll('canvas.spr').forEach(cv=>{
    const w=+cv.getAttribute('width'),h=+cv.getAttribute('height');
    if(!cv.dataset.sized){cv.style.width=w+'px';cv.style.height=h+'px';cv.width=w*dpr;cv.height=h*dpr;cv.dataset.sized='1'}
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    if(cv.dataset.egg){drawEgg(g,w/2,h/2,w/40,cv.dataset.egg.split(','),cv.dataset.shiny==='1');return}
    if(cv.dataset.boss){drawBossBody(g,BOSSES[cv.dataset.boss],w/2,h/2+2,w/110,0,false);if(cv.dataset.sil)silhouette(g,w,h);return}
    if(cv.dataset.foe){drawFoeBody(g,FOES[cv.dataset.foe],w/2,h/2+2,w/44,0,{});if(cv.dataset.sil)silhouette(g,w,h);return}
    if(cv.dataset.npc){drawPerson(g,cv.dataset.npc,w/2,h/2+4,w/40,0);return}
    let c=null;
    if(cv.dataset.sp){const sp=cv.dataset.sp,S0=SPECIES[sp];c={species:sp,type:S0.hybrid?S0.types[0]:S0.type,type2:S0.hybrid?S0.types[1]:null,stage:+cv.dataset.st||0}}
    else if(cv.dataset.cid)c=byId(+cv.dataset.cid)||(cv.dataset.mem?null:null);
    if(cv.dataset.mem){const m=S.memorial[+cv.dataset.mem];if(m)c={species:m.species,type:m.type,type2:m.type2,stage:m.stage}}
    if(!c)return;
    const sz=(SPECIES[c.species].size||1)*(1+.1*(c.stage||0));
    drawCreature(g,c,w/2,h/2+3,w/50/Math.max(1,sz*.92),0,{face:1,sex:cv.dataset.sp||cv.dataset.mem?null:c.sex});
    if(cv.dataset.sil)silhouette(g,w,h);
  });
}
function silhouette(g,w,h){g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-atop';g.fillStyle='#2d2457';g.fillRect(0,0,g.canvas.width,g.canvas.height);g.restore()}
const spr=(c,size=64)=>`<canvas class="spr" width="${size}" height="${size}" data-cid="${c.id}" aria-label="${esc(formName(c))} sprite"></canvas>`;
const sprSp=(sp,st,size=56,sil)=>`<canvas class="spr" width="${size}" height="${size}" data-sp="${sp}" data-st="${st}" ${sil?'data-sil="1"':''} aria-label="${sil?'Unknown creature':esc(LINES[sp][st].name)}"></canvas>`;
const typeChip=t=>`<span class="chip type" style="--c:${TYPES[t].color}">${TYPES[t].name}</span>`;
const typeChips=c=>typesOf(c).map(typeChip).join('')+(c.type2?'<span class="chip warn">Hybrid</span>':'');
const sexChip=c=>`<span class="chip sex ${c.sex==='F'?'f':'m'}" title="${c.sex==='F'?'Female: passes on her species':'Male: passes on most of his stats'}">${sexSym(c.sex)}</span>`;
const stars=n=>`<span class="stars" aria-label="${n} of 5 bond stars">${'★'.repeat(n)}<i>${'★'.repeat(5-n)}</i></span>`;
