import {clubData,recalculatePhysical,physicalRanking} from '../game/club-state.js?v=20261001T003934265';
import {clubRankings} from './combined-ranking.js?v=20261001T003934265';
import {visibleHistory} from '../services/online-records.js?v=20261001T003934265';

export const physicalResultIdentity=record=>JSON.stringify([record.createdAt??null,record.dateIso??'',record.date??'',record.table??[]]);
const publicRow=row=>Object.fromEntries(['id','playerId','name','avatar','vic','coch','saved','totalGames','currentStreak','percent','score','physicalGames','onlineGames','played','won','pigs','streak'].filter(key=>row[key]!=null).map(key=>[key,row[key]]));
export const freezeRankings=rankings=>Object.fromEntries(Object.entries(rankings).map(([mode,rows])=>[mode,rows.map(publicRow)]));
export function periodLabel(id){const m=String(id).match(/^(\d{4})-T([1-4])$/);if(!m)throw new Error('Trimestre invalide.');return `T${m[2]} ${m[1]}`;}

// Only the ranking page uses this view. Histories and lifetime profile counters
// are never reset, rewritten or replaced by the quarterly projection.
export function currentPeriodRankings(players,physicalHistory,onlineHistory,period){
  if(!period)return clubRankings(players,physicalHistory,onlineHistory,{});
  const physicalBefore=new Set(period.baselinePhysical||[]),onlineBefore=new Set(period.baselineOnline||[]);
  const physical=physicalHistory.filter(m=>!physicalBefore.has(physicalResultIdentity(m)));
  const online=onlineHistory.filter(m=>!onlineBefore.has(String(m.matchId)));
  const quarterlyPlayers=recalculatePhysical(players,physical);
  const rows=clubRankings(quarterlyPlayers,physical,online,{});
  const included=new Set(rows.online.map(p=>String(p.id)));
  for(const p of quarterlyPlayers)if(!included.has(String(p.id)))rows.online.push({...p,playerId:p.id,totalGames:0,vic:0,coch:0,saved:0,currentStreak:0,percent:0,score:0});
  rows.online=physicalRanking(rows.online);
  return rows;
}

// Produce an archive and a new baseline together from one consistent snapshot.
// Save/verify the archive before activating the new quarter.
export function planRankingRollover(source,periods,closedId,nextId,at=Date.now()){
  periodLabel(closedId);periodLabel(nextId);
  const [year,quarter]=closedId.split('-T').map(Number);
  if(nextId!==`${quarter===4?year+1:year}-T${quarter===4?1:quarter+1}`)throw new Error('Le nouveau trimestre doit suivre le trimestre clôturé.');
  if(periods?.archives?.[closedId])throw new Error('Ce trimestre est déjà archivé : aucune archive ne sera écrasée.');
  if(periods?.active&&periods.active.id!==closedId)throw new Error('Le trimestre actif a changé.');
  const data=clubData(source),online=visibleHistory(source.online_domino_v1);
  const players=recalculatePhysical(data.players,data.history,true);
  const rankings=periods?.active
    ?currentPeriodRankings(players,data.history,online,periods.active)
    :clubRankings(players,data.history,online,source.online_domino_v1?.stats||{});
  return {
    archive:{id:closedId,label:periodLabel(closedId),closedAt:at,rankings:freezeRankings(rankings),sourceCounts:{physical:data.history.length,online:online.length}},
    active:{id:nextId,label:periodLabel(nextId),openedAt:at,baselinePhysical:data.history.map(physicalResultIdentity),baselineOnline:online.map(m=>String(m.matchId))}
  };
}
