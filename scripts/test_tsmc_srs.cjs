const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const words=JSON.parse(fs.readFileSync(path.join(__dirname,"../tsmc-vocabulary.json"),"utf8"));
const code=fs.readFileSync(path.join(__dirname,"../tsmc-review.js"),"utf8");
let date="2026-10-13";
class Clock extends Date{
 constructor(...args){super(...(args.length?args:[date+"T12:00:00"]));}
 static now(){return new Date(date+"T12:00:00").getTime();}
}
function boot(backing=new Map()){
 const c=vm.createContext({TSMC_WORDS:words,Date:Clock,
  localStorage:{getItem:k=>backing.get(k)||null,setItem:(k,v)=>backing.set(k,v)},
  document:{getElementById(){return null;}},console});
 vm.runInContext(code,c);
 return {run:s=>vm.runInContext(s,c),state:()=>JSON.parse(backing.get("tsmc-review-30-v1")||"null"),backing};
}
function grade(a,wrong=new Set()){
 const initial=a.state().currentRound;
 if(initial.mode==="drill" && initial.phase==="preview"){
   assert.equal(a.run("tsmcReviewSubmit()"),false,"cannot submit cards before test");
   assert.equal(a.run("tsmcReviewBeginDrillQuiz()"),initial.questions.length===1,
     "cannot jump into quiz before seeing all flashcards");
   if(initial.questions.length>1){
     assert.equal(a.state().currentRound.phase,"preview");
     for(let step=1;step<initial.questions.length;step++)a.run("tsmcReviewPreviewNavigate(1)");
     assert.equal(a.run("tsmcReviewBeginDrillQuiz()"),true);
   }
   assert.equal(a.state().currentRound.phase,"quiz");
 }
 const list=a.state().currentRound.questions;
 for(let i=0;i<list.length;i++){
  if(i)a.run("tsmcReviewNavigate(1)");
  const q=list[i],answer=wrong.has(q.id)?q.choices.find(id=>id!==q.id):q.id;
  a.run("tsmcReviewSelect("+answer+")");
 }
 assert.equal(a.run("tsmcReviewSubmit()"),true);
}
const store=new Map([["tsmc_stage_progress_v2","KEEP"],["initial-exam-wrong-question-ids","[3]"]]);
let app=boot(store);
assert.equal(app.run("tsmcReviewNewDrill('all')"),false);
assert.equal(app.run("tsmcReviewNewRound()"),true);
const wrongIds=new Set(app.state().currentRound.questions.slice(0,2).map(q=>q.id));
app.run("tsmcReviewNavigate(1)");
assert.equal(app.state().currentRound.position,0,"cannot skip unanswered");
grade(app,wrongIds);
assert.equal(app.state().seenIds.length,30);
assert.equal(app.state().completedRounds,1);
assert.equal(app.run("tsmcReviewDueWords().length"),0);
for(const id of wrongIds)assert.equal(app.state().srs[id].due,"2026-10-14");
assert.equal(app.run("tsmcReviewNewDrill('due')"),false);
assert.equal(app.run("tsmcReviewNewDrill('all')"),true);
assert.equal(app.state().currentRound.questions.length,2);
assert.equal(app.state().currentRound.phase,"preview");
app.run("tsmcReviewPreviewNavigate(1)");
app=boot(store);
assert.equal(app.state().currentRound.phase,"preview");
assert.equal(app.state().currentRound.previewIndex,1,"flashcard position resumes after reload");
assert.equal(app.state().currentRound.questions[0].chosen,null,"preview must not count as an answer");
grade(app);
assert.equal(app.state().completedRounds,1,"drill must not change coverage rounds");
assert.equal(app.state().completedDrills,1);
for(const id of wrongIds)assert.equal(app.state().srs[id].due,"2026-10-14","early drill not progression");
date="2026-10-14";app=boot(store);
assert.equal(app.run("tsmcReviewDueWords().length"),2);
assert.equal(app.run("tsmcReviewNewDrill('due')"),true);
const failed=app.state().currentRound.questions[0].id;
grade(app,new Set([failed]));
assert.equal(app.state().srs[failed].due,"2026-10-15","wrong resets to 1 day");
const other=[...wrongIds].find(id=>id!==failed);
assert.equal(app.state().srs[other].due,"2026-10-17","success schedules 3 days");
date="2026-10-15";app=boot(store);assert.equal(app.run("tsmcReviewNewDrill('due')"),true);grade(app);
assert.equal(app.state().srs[failed].due,"2026-10-18");
date="2026-10-17";app=boot(store);assert.equal(app.run("tsmcReviewNewDrill('due')"),true);grade(app);
assert.equal(app.state().srs[other].due,"2026-10-24","success schedules 7 days");
date="2026-10-18";app=boot(store);assert.equal(app.run("tsmcReviewNewDrill('due')"),true);grade(app);
assert.equal(app.state().srs[failed].due,"2026-10-25");
date="2026-10-24";app=boot(store);assert.equal(app.run("tsmcReviewNewDrill('due')"),true);grade(app);
assert.equal(app.state().srs[other].step,3);assert.equal(app.state().srs[other].due,null);
date="2026-10-25";app=boot(store);assert.equal(app.run("tsmcReviewNewDrill('due')"),true);grade(app);
assert.equal(app.state().srs[failed].step,3);
assert.equal(app.run("tsmcReviewDueWords().length"),0);
assert.equal(app.state().seenIds.length,30);
assert.equal(app.state().completedRounds,1);
assert.equal(store.get("tsmc_stage_progress_v2"),"KEEP");
assert.equal(store.get("initial-exam-wrong-question-ids"),"[3]");
date="2026-10-13";
const legacy={seenIds:[1,2],wrongCounts:{1:2},completedRounds:2,currentRound:null,lastResult:null};
const migrated=boot(new Map([["tsmc-review-30-v1",JSON.stringify(legacy)]]));
migrated.run("tsmcReviewState()"); // Triggers the v1-to-v2 migration before reading the persisted snapshot.
assert.equal(migrated.state().seenIds.length,2);
assert.equal(migrated.state().completedRounds,2);
assert.equal(migrated.state().wrongCounts[1],2);
assert.equal(migrated.state().srs[1].due,date);
assert.equal(migrated.run("tsmcReviewNewDrill('due')"),true);
assert.equal(migrated.state().currentRound.questions.length,1);
assert.equal(migrated.state().currentRound.phase,"preview");
const oldInProgress={...legacy,currentRound:{
 mode:"drill",scope:"due",questions:[{id:1,choices:[1,2,3,4],chosen:2}],newIds:[],position:0
}};
const resuming=boot(new Map([["tsmc-review-30-v1",JSON.stringify(oldInProgress)]]));
assert.equal(resuming.run("tsmcReviewIsPreview(tsmcReviewState().currentRound)"),false,
 "an old in-progress quiz must not be reset into study cards");
assert.equal(resuming.state().currentRound.questions[0].chosen,2);
console.log("PASS: v1 migration, 1/3/7 intervals, overdue review, early practice, wrong reset, draft resume, no data loss.");
