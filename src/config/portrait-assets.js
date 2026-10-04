// These are portrait-only backdrops. Game-table scenes and approved actors
// remain untouched; Kyllian has no new asset or active profile here.
export const PORTRAIT_BACKGROUNDS = Object.freeze(Object.fromEntries([
  'khalil','thomas','eddy','alexis','cedric','christopher','jean-claude','emmanuelle','ryad'
].map(id => [id, `./assets/portraits-v54/${id}-background.png?v=20261004T170705413`])));

export const JEAN_CLAUDE_MEDALLION = Object.freeze({
  src: './assets/portraits-v54/jean-claude-medallion-reference.png?v=20261004T170705413',
  // Use the supplied pin itself, not a redrawn or generated interpretation.
  sourceWidth: 1774, sourceHeight: 887, crop: '961 371 33 65',
  seats: Object.freeze({
    top: {x:883,y:111,width:12,height:25,rotation:3},
    left: {x:294,y:195,width:18,height:37,rotation:-4},
    right: {x:1530,y:218,width:18,height:37,rotation:24}
  })
});
