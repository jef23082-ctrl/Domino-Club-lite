import {FIREBASE_PATHS} from '../config/firebase.js?v=20261001T025219457';
export class RankingPeriodRepository{
  constructor(database){this.root=database.ref(FIREBASE_PATHS.rankingPeriods);}
  watch(onValue,onError){const listener=s=>onValue(s.val()||{});this.root.on('value',listener,onError);return()=>this.root.off('value',listener);}
}
