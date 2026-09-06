export function createWorkBeacon({ compact = false, active = true } = {}) {
  const beacon = document.createElement('span');
  beacon.className = `work-beacon${compact ? ' work-beacon--compact' : ''}${active ? ' is-lit' : ' is-idle'}`;
  beacon.setAttribute('aria-hidden', 'true');

  const glow = document.createElement('span');
  glow.className = 'work-beacon__glow';
  const beam = document.createElement('span');
  beam.className = 'work-beacon__beam';
  const dome = document.createElement('span');
  dome.className = 'work-beacon__dome';
  const rotor = document.createElement('span');
  rotor.className = 'work-beacon__rotor';
  const shine = document.createElement('span');
  shine.className = 'work-beacon__shine';
  const base = document.createElement('span');
  base.className = 'work-beacon__base';
  dome.append(rotor, shine);
  beacon.append(glow, beam, dome, base);
  return beacon;
}
