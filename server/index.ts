import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

type TeamName = "blue" | "red";
type Player = { id:string; socketId:string; team:TeamName|null; isCaptain:boolean; joinedAt:number; role:"player"|"spectator"; };
type Team = { players:string[]; adminId:string|null; answerCaptainId:string|null; score:number; viewers:Set<string>; };
type Question = { id:number; text:string; options:{A:string;B:string;C:string;D:string}; answer:"A"|"B"|"C"|"D"; };
type Game = { phase:"lobby"|"match"; questionIndex:number; deadline:number|null; questions:Question[]; teams:Record<TeamName,Team>; players:Map<string,Player>; queue:string[]; };

const questions:Question[] = [
 {id:1,text:"في أي مدينة ارتبطت بدايات ثقافة Hip-Hop؟",options:{A:"Miami",B:"Bronx",C:"Chicago",D:"Los Angeles"},answer:"B"},
 {id:2,text:"ما الاسم المرتبط بتأسيس Sugar Hill Records؟",options:{A:"Sylvia Robinson",B:"Dr. Dre",C:"Rick Rubin",D:"Quincy Jones"},answer:"A"},
 {id:3,text:"من أي منطقة أمريكية ارتبط Gangsta Rap بشكل قوي؟",options:{A:"West Coast",B:"Midwest",C:"North East",D:"South East"},answer:"A"},
 {id:4,text:"ما المقصود بـ BPM في الموسيقى؟",options:{A:"Bass Per Mix",B:"Beats Per Minute",C:"Beat Pitch Mode",D:"Bars Per Mic"},answer:"B"},
 {id:5,text:"ما العنصر الذي يرتبط مباشرة بالـDJ في ثقافة Hip-Hop؟",options:{A:"Turntablism",B:"Opera",C:"Sitar",D:"Classical Bow"},answer:"A"}
];

const app=express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

const game:Game={
 phase:"lobby",questionIndex:-1,deadline:null,questions,
 teams:{
  blue:{players:[],adminId:null,answerCaptainId:null,score:0,viewers:new Set()},
  red:{players:[],adminId:null,answerCaptainId:null,score:0,viewers:new Set()}
 },
 players:new Map(),queue:[]
};

let idCounter=55;

function publicState(){
 const p=[...game.players.values()].map(x=>({id:x.id,team:x.team,role:x.role,isCaptain:x.isCaptain}));
 return {
  phase:game.phase,
  players:p,
  teams:{
   blue:{players:game.teams.blue.players,adminId:game.teams.blue.adminId,answerCaptainId:game.teams.blue.answerCaptainId,score:game.teams.blue.score,viewers:game.teams.blue.viewers.size},
   red:{players:game.teams.red.players,adminId:game.teams.red.adminId,answerCaptainId:game.teams.red.answerCaptainId,score:game.teams.red.score,viewers:game.teams.red.viewers.size}
  },
  queue:game.queue.map((id,i)=>({id,position:i+1})),
  question:game.questionIndex>=0 ? game.questions[game.questionIndex] : null,
  deadline:game.deadline
 };
}
function emit(){io.emit("state",publicState());}

function resetMatch(){
 game.phase="lobby"; game.questionIndex=-1; game.deadline=null;
 for(const t of ["blue","red"] as TeamName[]){ game.teams[t].score=0; game.teams[t].answerCaptainId=null; }
}

function startMatch(){
 if(game.phase!=="lobby") return;
 if(game.teams.blue.players.length!==6 || game.teams.red.players.length!==6) return;
 game.phase="match"; game.questionIndex=0; startQuestion(); emit();
}
function startQuestion(){
 game.deadline=Date.now()+30000;
 emit();
 setTimeout(()=>{ if(game.phase==="match" && game.deadline && Date.now()>=game.deadline){ resolveQuestion(); }},30100);
}
function resolveQuestion(){
 if(game.phase!=="match") return;
 const q=game.questions[game.questionIndex];
 // Answers are collected per team through submittedAnswers.
 const submitted:(Record<TeamName, "A"|"B"|"C"|"D"|null>) = (game as any).submittedAnswers || {blue:null,red:null};
 for(const t of ["blue","red"] as TeamName[]){
   if(submitted[t]===null) game.teams[t].score-=1;
   else if(submitted[t]===q.answer) game.teams[t].score+=3;
   else game.teams[t].score-=2;
 }
 (game as any).submittedAnswers={blue:null,red:null};
 const winner=(["blue","red"] as TeamName[]).find(t=>game.teams[t].score>=55);
 if(winner){ finishMatch(winner); return; }
 game.questionIndex=(game.questionIndex+1)%game.questions.length;
 startQuestion();
}
function finishMatch(winner:TeamName){
 const loser=winner==="blue"?"red":"blue";
 for(const id of game.teams[loser].players){
   const p=game.players.get(id); if(p){p.team=null;p.role="spectator";p.isCaptain=false;}
   if(!game.queue.includes(id)) game.queue.push(id);
 }
 game.teams[loser].players=[];
 game.teams[loser].adminId=null;
 game.teams[loser].answerCaptainId=null;
 game.phase="lobby"; game.questionIndex=-1; game.deadline=null;
 emit();
}

io.on("connection",(socket)=>{
 const id=String(idCounter++);
 const player:Player={id,socketId:socket.id,team:null,isCaptain:false,joinedAt:Date.now(),role:"spectator"};
 game.players.set(id,player);
 socket.emit("identity",{id});
 emit();

 socket.on("joinTeam",(team:TeamName)=>{
  const p=game.players.get(id);
  if(!p || game.phase==="match" || game.teams[team].players.length>=6) return;
  if(p.team){ const old=game.teams[p.team]; old.players=old.players.filter(x=>x!==id); if(old.adminId===id) old.adminId=old.players[0]??null; }
  game.queue=game.queue.filter(x=>x!==id);
  p.team=team;p.role="player";
  const t=game.teams[team]; t.players.push(id);
  if(!t.adminId){t.adminId=id;p.isCaptain=true;}
  emit();
  if(game.teams.blue.players.length===6 && game.teams.red.players.length===6) startMatch();
 });
 socket.on("leaveTeam",()=>{
  const p=game.players.get(id); if(!p||game.phase==="match"||!p.team)return;
  const t=game.teams[p.team]; t.players=t.players.filter(x=>x!==id);
  if(t.adminId===id){t.adminId=t.players[0]??null;if(t.adminId){const np=game.players.get(t.adminId);if(np)np.isCaptain=true;}}
  p.team=null;p.role="spectator";p.isCaptain=false;emit();
 });
 socket.on("queue",()=>{
  const p=game.players.get(id); if(!p||p.team)return;
  if(!game.queue.includes(id)) game.queue.push(id); emit();
 });
 socket.on("chooseCaptain",(captainId:string)=>{
  const p=game.players.get(id); if(!p||game.phase==="match"||!p.team)return;
  const t=game.teams[p.team]; if(t.adminId!==id||!t.players.includes(captainId))return;
  t.answerCaptainId=captainId;emit();
 });
 socket.on("transferAdmin",(newId:string)=>{
  const p=game.players.get(id);if(!p||game.phase==="match"||!p.team)return;
  const t=game.teams[p.team];if(t.adminId!==id||!t.players.includes(newId))return;
  t.adminId=newId;for(const pid of t.players){const x=game.players.get(pid);if(x)x.isCaptain=pid===newId;}emit();
 });
 socket.on("submitAnswer",(answer:"A"|"B"|"C"|"D")=>{
  const p=game.players.get(id);if(!p||game.phase!=="match"||!p.team)return;
  const t=game.teams[p.team];if(t.answerCaptainId!==id)return;
  const answers=(game as any).submittedAnswers || {blue:null,red:null};
  if(answers[p.team]!==null)return;
  answers[p.team]=answer;(game as any).submittedAnswers=answers;
  if(answers.blue!==null && answers.red!==null) resolveQuestion(); else emit();
 });
 socket.on("spectate",(team:TeamName)=>{
  const p=game.players.get(id);if(!p)return;
  if(p.team)return;
  if(team==="blue"||team==="red"){game.teams[team].viewers.add(id);}
  emit();
 });
 socket.on("chat",(data:{team:TeamName;text:string})=>{
  const p=game.players.get(id);if(!p||!p.team||p.team!==data.team)return;
  const text=String(data.text||"").trim().slice(0,300);if(!text)return;
  io.emit("chat",{team:data.team,from:p.id,text});
 });
 socket.on("disconnect",()=>{
  const p=game.players.get(id); if(!p)return;
  if(p.team && game.phase==="lobby"){
   const t=game.teams[p.team];t.players=t.players.filter(x=>x!==id);
   if(t.adminId===id)t.adminId=t.players[0]??null;
  }
  game.queue=game.queue.filter(x=>x!==id);
  game.teams.blue.viewers.delete(id);game.teams.red.viewers.delete(id);
  game.players.delete(id);emit();
 });
});

app.get("/api/health",(_,res)=>res.json({ok:true,name:"55"}));
server.listen(Number(process.env.PORT)||3000,()=>console.log("55 running on http://localhost:3000"));
