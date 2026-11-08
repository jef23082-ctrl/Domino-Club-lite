// Seasonal presentation only. The V57 scene and all game coordinates stay intact.
export const CHRISTMAS_THEME = true;
export const CHRISTMAS_TABLES = Object.freeze({
  morocco: {tree:[65,0,13,27], garlands:[[22,22,21,6,-9],[59,22,21,6,9],[17,88,23,9,15],[65,88,17,9,-18]]},
  corsica: {tree:[66,1,13,26], garlands:[[22,22,21,6,-9],[59,22,21,6,9],[17,89,23,9,15],[65,89,17,9,-18]]},
  'france-1': {tree:[31,0,12,27], garlands:[[23,22,20,6,-8],[59,22,20,6,8],[17,88,23,9,15],[65,88,17,9,-18]]},
  bulgaria: {tree:[67,0,13,27], garlands:[[22,22,21,6,-9],[59,22,21,6,9],[17,89,23,9,15],[65,89,17,9,-18]]},
  algeria: {tree:[35,0,12,27], garlands:[[23,22,20,6,-9],[59,22,20,6,9],[17,88,23,9,15],[65,88,17,9,-18]]},
  'martinique-1': {tree:[62,0,14,27], garlands:[[22,22,21,6,-9],[59,22,21,6,9],[17,89,23,9,15],[65,89,17,9,-18]]},
  guadeloupe: {tree:[35,0,12,27], garlands:[[23,22,20,6,-9],[59,22,20,6,9],[17,89,23,9,15],[65,89,17,9,-18]]}
});
export const isChristmasTable = id => CHRISTMAS_THEME && Object.hasOwn(CHRISTMAS_TABLES,id);
