import './style.css';
import { createClient } from '@supabase/supabase-js';

const PLAYERS = ['Dave', 'Jaz', 'Brody', 'Bo', 'Sarah', 'Mike'];
const DRAFT_ORDER = ['Brody', 'Sarah', 'Dave', 'Mike', 'Jaz', 'Bo', 'Bo', 'Jaz', 'Mike', 'Dave', 'Sarah', 'Brody', 'Brody', 'Sarah', 'Dave', 'Mike', 'Jaz', 'Bo'];
const CONTESTANTS = [
  ['Abbey Benjamin','Nurse'],['Abby Lee','Astrophysicist'],['Arisa Thomas','Dog Groomer'],['Ben McDonnell','Barrel Racer'],
  ['Clyde Moser','Teacher'],['Jay Vinnedge','Physician'],['Joe Vanella','Funeral Director'],['Katie Fites','Marketing Manager'],
  ['Kim Daily','Lawyer'],['Kriste Lewis','Realtor'],['Logan Smith','Realtor'],['Madeline Kostopulos','Construction Manager'],
  ['Mark Zgoda','Personal Trainer'],['Michael Foote','Lawyer'],['Morgan Cook','Content Creator'],['Niyyah Bilal Hayes','Therapist'],
  ['Shane Beatty','Ironworker'],['Sherry Kuehl','Writer'],['Tomica Adams','Pilot'],['Victor Vollbrechthausen','Business Executive'],
  ['Wyatt Gillespie','Designer'],['Xavier Scruggs','MLB Analyst']
];

const SCORE_RULES = {
  survived_episode: ['Survived episode', 1],
  shield: ['Won a shield', 2],
  faithful_correct_vote: ['Faithful voted for a Traitor', 2],
  traitor_survived_roundtable: ['Traitor survived Round Table', 2],
  successful_murder: ['Traitor successful murder', 2],
  successful_recruit: ['Traitor successful recruit', 3],
  banished_traitor: ['Faithful helped banish a Traitor', 3],
  final5: ['Made Final 5', 5],
  final3: ['Made Final 3', 5],
  faithful_win: ['Won as a Faithful', 10],
  traitor_win: ['Won as a Traitor', 12]
};

const cfg = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY
};
const hasSupabase = Boolean(cfg.url && cfg.key);
const supabase = hasSupabase ? createClient(cfg.url, cfg.key) : null;

const state = {
  tab: 'draft', picks: [], events: [], selectedPlayer: localStorage.getItem('traitors-player') || 'Dave',
  scorecardEpisode: Number(localStorage.getItem('traitors-scorecard-episode') || 1),
  admin: localStorage.getItem('traitors-admin') === 'true', loading: true, notice: ''
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const pickMap = () => Object.fromEntries(state.picks.map(p => [p.contestant, p]));
const currentPick = () => DRAFT_ORDER[state.picks.length] || null;
const pointsFor = contestant => state.events.filter(e => e.contestant === contestant).reduce((a,e) => a + Number(e.points),0);
const rosterFor = player => state.picks.filter(p => p.owner === player);
const totalFor = player => rosterFor(player).reduce((a,p) => a + pointsFor(p.contestant),0);

function localLoad(){
  state.picks = JSON.parse(localStorage.getItem('traitors-picks') || '[]');
  state.events = JSON.parse(localStorage.getItem('traitors-events') || '[]');
}
function localSave(){
  localStorage.setItem('traitors-picks', JSON.stringify(state.picks));
  localStorage.setItem('traitors-events', JSON.stringify(state.events));
}

async function loadData(){
  if(!hasSupabase){ localLoad(); state.loading=false; render(); return; }
  const [{data:picks,error:pe},{data:events,error:ee}] = await Promise.all([
    supabase.from('draft_picks').select('*').order('pick_number'),
    supabase.from('score_events').select('*').order('created_at')
  ]);
  if(pe || ee){ state.notice='Database connection failed. Check your Supabase setup.'; console.error(pe,ee); }
  state.picks = picks || [];
  state.events = events || [];
  state.loading=false; render();
}

async function makePick(contestant){
  const owner = currentPick();
  if(!owner || state.selectedPlayer !== owner){ state.notice=`It is ${owner || 'nobody'}'s turn.`; render(); return; }
  if(pickMap()[contestant]) return;
  const row = { pick_number: state.picks.length + 1, owner, contestant };
  if(hasSupabase){
    const {error} = await supabase.from('draft_picks').insert(row);
    if(error){ state.notice=error.message; render(); return; }
    await loadData();
  } else { state.picks.push({...row,id:crypto.randomUUID()}); localSave(); render(); }
}

async function undoLast(){
  if(!state.admin || !state.picks.length) return;
  const last = state.picks[state.picks.length-1];
  if(hasSupabase){ await supabase.from('draft_picks').delete().eq('id',last.id); await loadData(); }
  else { state.picks.pop(); localSave(); render(); }
}

async function addScore(form){
  if(!state.admin) return;
  const contestant=form.contestant.value, type=form.type.value, episode=Number(form.episode.value || 1), quantity=Number(form.quantity.value || 1);
  const pts=(SCORE_RULES[type]?.[1] || 0)*quantity;
  const row={contestant,event_type:type,episode,quantity,points:pts,note:form.note.value.trim()};
  if(hasSupabase){ const {error}=await supabase.from('score_events').insert(row); if(error){state.notice=error.message;render();return;} await loadData(); }
  else { state.events.push({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); localSave(); render(); }
}

async function deleteEvent(id){
  if(!state.admin) return;
  if(hasSupabase){ await supabase.from('score_events').delete().eq('id',id); await loadData(); }
  else { state.events=state.events.filter(e=>e.id!==id); localSave(); render(); }
}

function eventKey(contestant,type,episode){ return `${contestant}::${type}::${episode}`; }
function scorecardSavedSet(episode=state.scorecardEpisode){
  return new Set(state.events.filter(e=>Number(e.episode)===Number(episode)).map(e=>eventKey(e.contestant,e.event_type,episode)));
}

async function saveScorecard(form){
  const episode=Number(form.episode.value || 1);
  const roster=rosterFor(state.selectedPlayer).map(r=>r.contestant);
  if(!roster.length){ state.notice='You need drafted contestants before you can score an episode.'; render(); return; }
  const wanted=new Set([...form.querySelectorAll('input[data-scorecheck]:checked')].map(i=>i.value));
  const existing=state.events.filter(e=>Number(e.episode)===episode && roster.includes(e.contestant));
  const existingKeys=new Set(existing.map(e=>eventKey(e.contestant,e.event_type,episode)));
  const addKeys=[...wanted].filter(k=>!existingKeys.has(k));
  const removeEvents=existing.filter(e=>!wanted.has(eventKey(e.contestant,e.event_type,episode)));

  const rows=addKeys.map(k=>{
    const [contestant,event_type]=k.split('::');
    return {contestant,event_type,episode,quantity:1,points:SCORE_RULES[event_type][1],note:`Self-scored by ${state.selectedPlayer}`};
  });

  if(hasSupabase){
    if(removeEvents.length){
      const ids=removeEvents.map(e=>e.id);
      const {error}=await supabase.from('score_events').delete().in('id',ids);
      if(error){ state.notice=error.message; render(); return; }
    }
    if(rows.length){
      const {error}=await supabase.from('score_events').insert(rows);
      if(error){ state.notice=error.message; render(); return; }
    }
    state.notice=`Episode ${episode} scorecard saved for ${state.selectedPlayer}.`;
    await loadData();
  } else {
    const removeIds=new Set(removeEvents.map(e=>e.id));
    state.events=state.events.filter(e=>!removeIds.has(e.id));
    state.events.push(...rows.map(row=>({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()})));
    localSave();
    state.notice=`Episode ${episode} scorecard saved for ${state.selectedPlayer}.`;
    render();
  }
}

function header(){
  const cp=currentPick();
  return `<header class="hero"><div class="eyebrow">THE TRAITORS: NEW BLOOD</div><h1>Castle Pool</h1><p>Six players. Eighteen drafted contestants. One leaderboard.</p>
  <div class="statusbar"><span class="pill ${hasSupabase?'live':'local'}">${hasSupabase?'● Shared database':'● Local demo mode'}</span><span>${state.picks.length}/18 picks made</span>${cp?`<span>On the clock: <strong>${esc(cp)}</strong></span>`:'<span><strong>Draft complete</strong></span>'}</div></header>`;
}

function nav(){ return `<nav>${[['draft','Draft Room'],['scorecard','My Scorecard'],['leaderboard','Leaderboard'],['scoring','Season Tracker']].map(([id,t])=>`<button class="navbtn ${state.tab===id?'active':''}" data-tab="${id}">${t}</button>`).join('')}</nav>`; }

function profileBar(){ return `<section class="profilebar"><label>You are <select id="player-select">${PLAYERS.map(p=>`<option ${p===state.selectedPlayer?'selected':''}>${p}</option>`).join('')}</select></label><label class="admin-toggle"><input id="admin-toggle" type="checkbox" ${state.admin?'checked':''}/> Admin controls</label></section>`; }

function draftView(){
  const pm=pickMap(), cp=currentPick();
  return `<section class="grid draft-layout"><div><div class="section-head"><div><span class="kicker">LIVE DRAFT</span><h2>${cp?`${esc(cp)} is on the clock`:'The draft is complete'}</h2></div>${state.admin&&state.picks.length?'<button id="undo" class="ghost">Undo last pick</button>':''}</div>
  <div class="contestants">${CONTESTANTS.map(([name,job])=>{ const picked=pm[name]; return `<article class="card ${picked?'picked':''}"><div class="avatar">${name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="cardbody"><h3>${esc(name)}</h3><p>${esc(job)}</p>${picked?`<span class="drafted">Drafted by ${esc(picked.owner)}</span>`:`<button class="pickbtn" data-pick="${esc(name)}" ${cp!==state.selectedPlayer?'disabled':''}>Draft</button>`}</div></article>`}).join('')}</div></div>
  <aside class="board"><span class="kicker">DRAFT BOARD</span><h2>Snake order</h2>${DRAFT_ORDER.map((owner,i)=>{const pick=state.picks.find(p=>Number(p.pick_number)===i+1);return `<div class="boardrow ${i===state.picks.length?'current':''}"><span class="pickno">${i+1}</span><span class="owner">${owner}</span><span class="choice">${pick?esc(pick.contestant):'—'}</span></div>`}).join('')}</aside></section>`;
}


function scorecardView(){
  const roster=rosterFor(state.selectedPlayer);
  const episode=state.scorecardEpisode;
  const saved=scorecardSavedSet(episode);
  const episodeTotal=state.events
    .filter(e=>Number(e.episode)===episode && roster.some(r=>r.contestant===e.contestant))
    .reduce((sum,e)=>sum+Number(e.points),0);
  return `<section class="scorecard-page"><div class="section-head"><div><span class="kicker">SELF SCORING</span><h2>${esc(state.selectedPlayer)}'s Episode ${episode} Scorecard</h2><p class="section-copy">Check everything each of your contestants earned in this episode, then save once.</p></div><div class="episode-total"><strong>${episodeTotal}</strong><span>saved pts</span></div></div>
  <form id="scorecard-form" class="scorecard-form"><div class="episode-picker"><label>Episode <input id="scorecard-episode" name="episode" type="number" min="1" value="${episode}"/></label><span>Changing the episode loads that episode's saved checklist.</span></div>
  ${roster.length?`<div class="scorecards">${roster.map(r=>`<article class="player-scorecard"><div class="scorecard-title"><div><span class="kicker">YOUR PICK</span><h3>${esc(r.contestant)}</h3></div><div class="contestant-points">${pointsFor(r.contestant)}<small>season pts</small></div></div><div class="checklist">${Object.entries(SCORE_RULES).map(([type,[label,pts]])=>{const key=eventKey(r.contestant,type,episode);return `<label class="checkrow"><input data-scorecheck type="checkbox" value="${esc(key)}" ${saved.has(key)?'checked':''}/><span class="checkmark"></span><span class="checklabel">${esc(label)}</span><b>+${pts}</b></label>`}).join('')}</div></article>`).join('')}</div><div class="scorecard-savebar"><div><strong>Episode ${episode} total currently saved: ${episodeTotal} points</strong><span>You can reopen this episode and change the boxes later.</span></div><button class="primary save-scorecard" type="submit">Save my episode points</button></div>`:`<div class="empty-state"><h3>No roster yet</h3><p>Once ${esc(state.selectedPlayer)} has drafted contestants, their episode checklist will appear here.</p></div>`}</form></section>`;
}

function leaderboardView(){
  const ranked=[...PLAYERS].sort((a,b)=>totalFor(b)-totalFor(a));
  return `<section><div class="section-head"><div><span class="kicker">STANDINGS</span><h2>Leaderboard</h2></div></div><div class="leaderboard">${ranked.map((p,i)=>`<article class="leader"><div class="rank">${i+1}</div><div class="leader-main"><h3>${p}</h3><div class="roster">${rosterFor(p).length?rosterFor(p).map(r=>`<span>${esc(r.contestant)} <b>+${pointsFor(r.contestant)}</b></span>`).join(''):'<span>No picks yet</span>'}</div></div><div class="score">${totalFor(p)}<small>PTS</small></div></article>`).join('')}</div></section>`;
}

function scoringView(){
  const drafted=state.picks.map(p=>p.contestant);
  return `<section class="grid scoring-layout"><div><div class="section-head"><div><span class="kicker">SEASON</span><h2>Scoring history</h2></div></div>
  <div class="tablewrap"><table><thead><tr><th>Episode</th><th>Contestant</th><th>Event</th><th>Pts</th>${state.admin?'<th></th>':''}</tr></thead><tbody>${state.events.length?state.events.slice().reverse().map(e=>`<tr><td>${e.episode}</td><td>${esc(e.contestant)}</td><td>${esc(SCORE_RULES[e.event_type]?.[0]||e.event_type)}${e.quantity>1?` ×${e.quantity}`:''}${e.note?`<small>${esc(e.note)}</small>`:''}</td><td class="pts">+${e.points}</td>${state.admin?`<td><button class="iconbtn delete-event" data-id="${e.id}">×</button></td>`:''}</tr>`).join(''):`<tr><td colspan="5" class="empty">No scoring events yet.</td></tr>`}</tbody></table></div></div>
  <aside>${state.admin?`<form id="score-form" class="scoreform"><span class="kicker">ADMIN</span><h2>Add episode result</h2><label>Contestant<select name="contestant" required>${drafted.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label><label>Scoring event<select name="type">${Object.entries(SCORE_RULES).map(([k,[label,pts]])=>`<option value="${k}">${label} (+${pts})</option>`).join('')}</select></label><div class="twocol"><label>Episode<input name="episode" type="number" min="1" value="1"/></label><label>Quantity<input name="quantity" type="number" min="1" value="1"/></label></div><label>Note (optional)<input name="note" placeholder="e.g. Episode 2 round table"/></label><button class="primary" ${!drafted.length?'disabled':''}>Add points</button><p class="help">Points are calculated automatically from the pool rules.</p></form>`:`<div class="scoreform"><span class="kicker">SCORING</span><h2>Automatic totals</h2><p>Once an admin records what happened in an episode, every drafted contestant's score and every owner's total update automatically.</p><p class="help">Turn on Admin controls above to enter episode results.</p></div>`}</aside></section>`;
}

function render(){
  document.querySelector('#app').innerHTML=`<main>${header()}${nav()}${profileBar()}${state.notice?`<div class="notice">${esc(state.notice)} <button id="dismiss">×</button></div>`:''}${state.loading?'<div class="loading">Entering the castle…</div>':state.tab==='draft'?draftView():state.tab==='scorecard'?scorecardView():state.tab==='leaderboard'?leaderboardView():scoringView()}<footer>Unofficial fan pool · Built for Dave, Jaz, Brody, Bo, Sarah & Mike</footer></main>`;
  bind();
}
function bind(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
  document.querySelector('#player-select').onchange=e=>{state.selectedPlayer=e.target.value;localStorage.setItem('traitors-player',state.selectedPlayer);render()};
  document.querySelector('#admin-toggle').onchange=e=>{state.admin=e.target.checked;localStorage.setItem('traitors-admin',state.admin);render()};
  document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>makePick(b.dataset.pick));
  document.querySelector('#undo')?.addEventListener('click',undoLast);
  document.querySelector('#dismiss')?.addEventListener('click',()=>{state.notice='';render()});
  document.querySelector('#score-form')?.addEventListener('submit',e=>{e.preventDefault();addScore(e.target)});
  document.querySelector('#scorecard-form')?.addEventListener('submit',e=>{e.preventDefault();saveScorecard(e.target)});
  document.querySelector('#scorecard-episode')?.addEventListener('change',e=>{state.scorecardEpisode=Math.max(1,Number(e.target.value||1));localStorage.setItem('traitors-scorecard-episode',state.scorecardEpisode);render()});
  document.querySelectorAll('.delete-event').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.id));
}

if(hasSupabase){
  supabase.channel('traitors-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'draft_picks'},()=>loadData())
    .on('postgres_changes',{event:'*',schema:'public',table:'score_events'},()=>loadData())
    .subscribe();
}
render(); loadData();
