/* ============================================================================
   1. WEB AUDIO SYNTH & SMART HUNT TIMER (MICRO-HUNT vs BANISHMENT)
============================================================================ */
let audioEnabled = true, audioCtx = null, huntTimerInterval = null, huntSecondsRemaining = 0;

function playSound(type) {
  if (!audioEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    var now = audioCtx.currentTime;
    if (type === "step" || type === "tick") {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(type === "tick" ? 65 : 95, now);
      g.gain.setValueAtTime(0.14, now); g.gain.linearRampToValueAtTime(0.01, now + 0.07);
      o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + 0.08);
    } else if (type === "emf_low") {
      var o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
      o2.type = "square"; o2.frequency.setValueAtTime(440, now);
      g2.gain.setValueAtTime(0.06, now); g2.gain.linearRampToValueAtTime(0.01, now + 0.12);
      o2.connect(g2); g2.connect(audioCtx.destination); o2.start(now); o2.stop(now + 0.13);
    } else if (type === "emf5" || type === "clue") {
      [880, 1175, 1396].forEach(function(freq, idx) {
        var o3 = audioCtx.createOscillator(), g3 = audioCtx.createGain();
        o3.type = "triangle"; o3.frequency.setValueAtTime(freq, now + idx * 0.07);
        g3.gain.setValueAtTime(0.11, now + idx * 0.07); g3.gain.linearRampToValueAtTime(0.01, now + idx * 0.07 + 0.14);
        o3.connect(g3); g3.connect(audioCtx.destination); o3.start(now + idx * 0.07); o3.stop(now + idx * 0.07 + 0.15);
      });
    } else if (type === "breaker" || type === "hunt") {
      var o4 = audioCtx.createOscillator(), g4 = audioCtx.createGain();
      o4.type = "sawtooth"; o4.frequency.setValueAtTime(130, now); o4.frequency.linearRampToValueAtTime(48, now + 0.3);
      g4.gain.setValueAtTime(0.2, now); g4.gain.linearRampToValueAtTime(0.01, now + 0.3);
      o4.connect(g4); g4.connect(audioCtx.destination); o4.start(now); o4.stop(now + 0.31);
    }
  } catch (e) {}
}

function stopHuntTurnTimer() {
  if (huntTimerInterval) { clearInterval(huntTimerInterval); huntTimerInterval = null; }
  var el = document.getElementById("hud-hunt-timer");
  if (el) el.style.display = "none";
}

function getSmartHuntDurationSeconds() {
  var livingCount = G.players.filter(function(p) { return !p.spirit; }).length;
  var oneToOnePhones = (hostConnections.length >= livingCount && livingCount > 1);
  if (!G.banishmentMode) {
    return oneToOnePhones ? 12 : (8 + Math.max(1, livingCount) * 6);
  }
  return oneToOnePhones ? 20 : (10 + Math.max(1, livingCount) * 10);
}

function startHuntTurnTimer() {
  stopHuntTurnTimer();
  if (!G.huntActive || G.gameOver) return;
  huntSecondsRemaining = getSmartHuntDurationSeconds();
  G.huntSecondsRemaining = huntSecondsRemaining;

  var el = document.getElementById("hud-hunt-timer");
  if (el) { el.style.display = "inline-block"; el.textContent = "⏱️ HIDE: " + huntSecondsRemaining + "s"; }

  huntTimerInterval = setInterval(function() {
    if (!G.huntActive || G.gameOver || G.isAnimatingHunt) return;
    huntSecondsRemaining -= 1;
    G.huntSecondsRemaining = huntSecondsRemaining;
    if (el) el.textContent = "⏱️ HIDE: " + huntSecondsRemaining + "s";
    if (huntSecondsRemaining <= 6 && huntSecondsRemaining > 0) playSound("tick");
    broadcastStateToPhones();
    if (huntSecondsRemaining <= 0) {
      stopHuntTurnTimer();
      showDiceToast("⏰ HUNT TIMER EXPIRED! GHOST ATTACKS!", "var(--red)");
      logMsg("⏰ HUNT TIMER EXPIRED! Turn ended automatically!", "hunt");
      endRoundHauntPhase();
    }
  }, 1000);
}

/* ============================================================================
   2. SVG FLOORPLAN ART & v9.8 DATABASES (19 UNIQUE GHOSTS, 12 SPECIALISTS, TIERS)
============================================================================ */
function getRoomArtSVG(art) {
  var s = 'stroke="#94a3b8" stroke-width="2" fill="none"';
  if (art === "van") return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="8" y="16" width="48" height="32" rx="5" '+s+'/><circle cx="18" cy="48" r="5" '+s+'/><circle cx="46" cy="48" r="5" '+s+'/></svg>';
  if (art === "yard") return '<svg class="room-art-svg" viewBox="0 0 64 64"><circle cx="22" cy="24" r="12" '+s+'/><circle cx="44" cy="36" r="10" '+s+'/></svg>';
  if (art === "stairs") return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="10" y="10" width="44" height="44" '+s+'/><line x1="10" y1="22" x2="54" y2="22" '+s+'/><line x1="10" y1="34" x2="54" y2="34" '+s+'/><line x1="10" y1="46" x2="54" y2="46" '+s+'/></svg>';
  if (art === "bed") return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="12" y="10" width="40" height="44" rx="3" '+s+'/><line x1="12" y1="26" x2="52" y2="26" '+s+'/></svg>';
  if (art === "kitchen") return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="18" '+s+'/><circle cx="20" cy="17" r="4" '+s+'/><rect x="18" y="36" width="28" height="16" '+s+'/></svg>';
  if (art === "bath") return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="10" y="12" width="22" height="40" rx="8" '+s+'/><circle cx="46" cy="22" r="7" '+s+'/></svg>';
  return '<svg class="room-art-svg" viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="36" rx="4" '+s+'/><circle cx="32" cy="32" r="7" '+s+'/></svg>';
}

const EVIDENCE_TYPES = ["EMF Level 5", "Spirit Box", "Freezing Temps", "UV Fingerprints", "Ghost Writing", "Ghost Orbs", "D.O.T.S."];
const FORENSIC_TRAITS = ["UV: Blood/Wounds", "UV: Surface Marks", "UV: Residue/Stains", "EMF: Heavy Metal/Blade", "EMF: Grid/Wire Surge", "EMF: Faint/Organic", "Temp: Scorched/Warm", "Temp: Sub-Zero/Damp", "Temp: Ambient Air"];

function isBindRoomMatch(r) {
  if (r.id === G.ghostFavRoomId) return true;
  if (G.anchorType === "corpse" && r.id === G.anchorRoomId && G.ghostRoomId === r.id) return true;
  return false;
}

function roomHasWard(r) {
  if (!r) return false;
  if (r.ward) return true;
  return r.floorItems && r.floorItems.some(function(i) {
    return i.name.indexOf("Crucifix") !== -1 && (typeof i.charges !== "number" || i.charges > 0);
  });
}

const DEATH_DB = {
  Poisoned: { category:"Internal / Toxin", traits:["UV: Residue/Stains","EMF: Faint/Organic","Temp: Ambient Air"], desc:"Arsenic-laced drink.", purgeText:"In bound room with Salt, Ward, or Crucifix on floor.", checkPurge:function(r){return r.salt||roomHasWard(r);} },
  Burned: { category:"Thermal / Energy", traits:["UV: Residue/Stains","EMF: Grid/Wire Surge","Temp: Scorched/Warm"], desc:"Electrical fire.", purgeText:"In bound room with Room Lights OFF.", checkPurge:function(r){return !r.lit;} },
  Drowned: { category:"Cold / Hypothermia", traits:["UV: Residue/Stains","EMF: Faint/Organic","Temp: Sub-Zero/Damp"], desc:"Submerged in freezing water.", purgeText:"In bound room with Room Lights ON.", checkPurge:function(r){return r.lit;} },
  Murdered: { category:"Violent Trauma", traits:["UV: Blood/Wounds","EMF: Heavy Metal/Blade","Temp: Ambient Air"], desc:"Struck down by heavy blade.", purgeText:"In bound room with Salt laid.", checkPurge:function(r){return r.salt;} },
  Starved: { category:"Cold / Hypothermia", traits:["UV: Surface Marks","EMF: Faint/Organic","Temp: Sub-Zero/Damp"], desc:"Locked inside a room.", purgeText:"In bound room with 0 Floor Items.", checkPurge:function(r){return r.floorItems.length===0;} },
  Sacrificed: { category:"Violent Trauma", traits:["UV: Blood/Wounds","EMF: Heavy Metal/Blade","Temp: Sub-Zero/Damp"], desc:"Occult ritual killing.", purgeText:"In bound room with Ward or Crucifix.", checkPurge:function(r){return roomHasWard(r);} },
  Electrocuted: { category:"Thermal / Energy", traits:["UV: Surface Marks","EMF: Grid/Wire Surge","Temp: Scorched/Warm"], desc:"High-voltage shock.", purgeText:"In bound room while Master Breaker is OFF.", checkPurge:function(r){return !G.breakerOn;} },
  Frozen: { category:"Cold / Hypothermia", traits:["UV: Surface Marks","EMF: Grid/Wire Surge","Temp: Sub-Zero/Damp"], desc:"Severe exposure.", purgeText:"In bound room with Room Lights ON.", checkPurge:function(r){return r.lit;} },
  Asphyxiated: { category:"Internal / Toxin", traits:["UV: Surface Marks","EMF: Heavy Metal/Blade","Temp: Ambient Air"], desc:"Choked in sealed space.", purgeText:"In bound room with ALL handheld Electronics OFF.", checkPurge:function(r,p){return !p.hands.some(function(i){return i.elec&&i.on;});} },
  Crushed: { category:"Violent Trauma", traits:["UV: Blood/Wounds","EMF: Faint/Organic","Temp: Ambient Air"], desc:"Pinned beneath masonry.", purgeText:"In bound room with 0 Floor Gear.", checkPurge:function(r){return r.floorItems.length===0;} }
};

// All 19 Ghosts have 100% unique 3-evidence sets + distinct Haunt Preferences (pref)!
const GHOST_DB = {
  Poltergeist: { ev:["Spirit Box","UV Fingerprints","Ghost Writing"], huntSanity:50, perceptMod:2, speed:3, pref:"doorsOpen", behavior:"Throws multiple objects (2 Touch Tokens) & swings doors open.", evParamText:"Needs 2+ Touch Tokens in room before Writing.", ritualText:"In Ghost/Corpse Room with Salt laid.", checkValid:function(r){return isBindRoomMatch(r)&&r.salt;} },
  Banshee: { ev:["Ghost Orbs","UV Fingerprints","D.O.T.S."], huntSanity:50, perceptMod:3, speed:3, pref:"doorsClose", behavior:"Fixates on 1 Obsession target & shuts doors to isolate them.", evParamText:"Obsession must be inside house for Orbs/D.O.T.S.", ritualText:"In Ghost/Corpse Room OR [🪞 Mirror] Room with Salt.", checkValid:function(r){return (isBindRoomMatch(r)||r.tags.indexOf("Mirror")!==-1)&&r.salt;} },
  Revenant: { ev:["Ghost Orbs","Ghost Writing","Freezing Temps"], huntSanity:50, perceptMod:4, speed:4, patrolSpeed:1, pref:"lightsOff", behavior:"Sprinter: Fast when chasing Noise/LoS, 1 Tile/rnd patrolling! Switches room lights OFF.", evParamText:"Only reveals Freezing when Lights are OFF.", ritualText:"In Ghost/Corpse Room with Room Lights ON.", checkValid:function(r){return isBindRoomMatch(r)&&r.lit;} },
  Jinn: { ev:["EMF Level 5","Freezing Temps","UV Fingerprints"], huntSanity:50, perceptMod:3, speed:4, pref:"breakerOn", behavior:"Draws power from grid: Turns Master Breaker & room lights ON! Fast while Breaker is ON.", evParamText:"Only spikes EMF 5 while Master Breaker is ON.", ritualText:"In Ghost/Corpse Room while Breaker is OFF (or Floodlit).", checkValid:function(r){return (isBindRoomMatch(r)&&!G.breakerOn)||r.permLit;} },
  Shade: { ev:["EMF Level 5","Ghost Writing","Freezing Temps"], huntSanity:35, perceptMod:2, speed:3, pref:"lightsOff", behavior:"Shy entity: Hunts late (35% Sanity), turns room lights OFF, and shuts doors.", evParamText:"Refuses EMF 5/Writing if 2+ players are in room.", ritualText:"In Ghost/Corpse Room ALONE with Lights ON.", checkValid:function(r){return isBindRoomMatch(r)&&r.lit&&G.players.filter(function(p){return !p.spirit&&p.roomId===r.id;}).length===1;} },
  Demon: { ev:["Spirit Box","Ghost Writing","D.O.T.S."], huntSanity:70, perceptMod:4, speed:3, pref:"lightsBreak", behavior:"Hunts early at 70% Sanity (+4 Percept) & shatters room light bulbs when angry!", evParamText:"Silent on Spirit Box if room has Ward or Crucifix (Wipe Ward/Pick up Crucifix to scan!).", ritualText:"In any room with Ward or Crucifix.", checkValid:function(r){return roomHasWard(r);} },
  Phantom: { ev:["Spirit Box","UV Fingerprints","D.O.T.S."], huntSanity:50, perceptMod:3, speed:3, pref:"lightsOff", behavior:"Manifestations drain heavy Sanity (-4) & extinguishes room lights.", evParamText:"Only triggers D.O.T.S. when no living player is inside room!", ritualText:"In Ghost/Corpse Room with Lights OFF.", checkValid:function(r){return isBindRoomMatch(r)&&!r.lit;} },
  Wraith: { ev:["EMF Level 5","Spirit Box","D.O.T.S."], huntSanity:50, perceptMod:3, speed:3, pref:"doorsOpen", behavior:"Floats above ground—ignores Salt in Hunts & unlatches closed/unexplored doors!", evParamText:"Only gives EMF 5 inside its room.", ritualText:"In Ghost/Corpse Room with Salt AND Ward/Crucifix.", checkValid:function(r){return isBindRoomMatch(r)&&r.salt&&roomHasWard(r);} },
  Mare: { ev:["Spirit Box","Ghost Orbs","Ghost Writing"], huntSanity:60, perceptMod:3, speed:3, pref:"breakerOff", behavior:"Hates light: Hunts at 60% Sanity, trips Breaker OFF, and shatters bulbs!", evParamText:"Refuses Orbs/Writing if Room Lights are ON!", ritualText:"In Ghost/Corpse Room with Lights ON.", checkValid:function(r){return isBindRoomMatch(r)&&r.lit;} },
  Oni: { ev:["EMF Level 5","Freezing Temps","D.O.T.S."], huntSanity:50, perceptMod:4, speed:3, pref:"lightsBreak", behavior:"Brutal physical entity: Slams/breaks doors & shatters room lights when angry!", evParamText:"Only reveals EMF 5/Freezing when 2+ players in room (or Solo).", ritualText:"In Ghost/Corpse Room with 2+ Investigators (1 if Solo).", checkValid:function(r){return isBindRoomMatch(r)&&G.players.filter(function(p){return p.roomId===r.id;}).length>=(G.players.length===1?1:2);} },
  Yokai: { ev:["Spirit Box","Ghost Orbs","D.O.T.S."], huntSanity:65, perceptMod:2, speed:3, pref:"breakerOn", behavior:"Drawn to electronics: Turns Breaker, lights & TV/PCs ON! Hunts at 65% Sanity.", evParamText:"Spirit Box requires a 2nd ON Electronic in hand.", ritualText:"In Ghost/Corpse Room with ALL Electronics OFF.", checkValid:function(r,p){return isBindRoomMatch(r)&&!p.hands.some(function(i){return i.elec&&i.on;});} },
  Mimic: { ev:["Spirit Box","UV Fingerprints","Freezing Temps"], huntSanity:50, perceptMod:3, speed:3, pref:"random", behavior:"Imitator: Spawns false-positive Ghost Orbs & randomly mimics other haunt habits!", evParamText:"Shows fake [Ghost Orbs] alongside its 3 real clues!", ritualText:"In [🪞 Mirror] OR Ghost/Corpse Room with Salt.", checkValid:function(r){return (isBindRoomMatch(r)||r.tags.indexOf("Mirror")!==-1)&&r.salt;} },
  Hantu: { ev:["UV Fingerprints","Ghost Orbs","Freezing Temps"], huntSanity:50, perceptMod:3, speed:4, pref:"breakerOff", behavior:"Thermal Speed: Obsessively trips Master Breaker OFF to freeze the house!", evParamText:"Only reveals Freezing Temps when Master Breaker is OFF (or on B1).", ritualText:"In Ghost/Corpse Room with Lights ON (or Floodlit).", checkValid:function(r){return isBindRoomMatch(r)&&(r.lit||r.permLit);} },
  Goryo: { ev:["EMF Level 5","UV Fingerprints","D.O.T.S."], huntSanity:50, perceptMod:3, speed:3, pref:"doorsClose", behavior:"Homebody: Never roams in Investigation & shuts its room doors for privacy.", evParamText:"D.O.T.S. only visible via Van or adjacent Cam when room is empty!", ritualText:"In Ghost/Corpse Room with Doors Shut and Salt laid.", checkValid:function(r){return isBindRoomMatch(r)&&r.salt&&r.closedDoors.length>0;} },
  Myling: { ev:["EMF Level 5","UV Fingerprints","Ghost Writing"], huntSanity:50, perceptMod:2, speed:3, pref:"doorsClose", behavior:"Silent Stalker: Footsteps only audible within 1 tile; shuts doors to muffle sound.", evParamText:"Refuses EMF 5/Writing if player has 2 ON Electronics.", ritualText:"In Ghost/Corpse Room with Doors Shut and Lights OFF.", checkValid:function(r){return isBindRoomMatch(r)&&!r.lit&&r.closedDoors.length>0;} },
  Onryo: { ev:["Spirit Box","Ghost Orbs","Freezing Temps"], huntSanity:60, perceptMod:3, speed:3, pref:"lightsOff", behavior:"Flame Fear: Extinguishes room lights; Smudge blinds Onryo for 2 rounds.", evParamText:"Refuses Spirit Box if Room Lights ON or Ward/Crucifix present.", ritualText:"In Ghost/Corpse Room while Smudge/Incense is active.", checkValid:function(r){return isBindRoomMatch(r)&&G.smudgeSafe>0;} },
  Deogen: { ev:["Spirit Box","Freezing Temps","D.O.T.S."], huntSanity:40, perceptMod:6, speed:4, pref:"doorsOpen", behavior:"The Seer (+6 Percept!): Swings doors wide open so you can't hide, but slows to Speed 1 when adjacent!", evParamText:"Only answers Spirit Box in its exact room.", ritualText:"In Ghost/Corpse Room while EXPOSED (Not Hidden) with Lights ON.", checkValid:function(r,p){return isBindRoomMatch(r)&&r.lit&&!p.isHidden;} },
  Moroi: { ev:["Spirit Box","Ghost Writing","Freezing Temps"], huntSanity:50, perceptMod:3, speed:3, pref:"lightsOff", behavior:"Blood Curse: Spirit Box curses user (-1 extra San/rnd until Pills)! Turns room lights OFF.", evParamText:"Only writes in Ghost Book when Room Lights are OFF.", ritualText:"In Ghost/Corpse Room with Salt AND Ward/Crucifix.", checkValid:function(r){return isBindRoomMatch(r)&&r.salt&&roomHasWard(r);} },
  Phantasm: { ev:["UV Fingerprints","Ghost Orbs","D.O.T.S."], huntSanity:55, perceptMod:3, speed:3, pref:"breakerOn", behavior:"Mind Mirage: Projects indistinguishable false readings (including Spirit Box voices) below 65% Sanity & surges lights/TVs!", evParamText:"Refuses Orbs/D.O.T.S. if user Sanity < 50% unless Room Lights are ON or Ward/Crucifix is laid.", ritualText:"In Ghost/Corpse or [🪞 Mirror] Room with Lights ON (Sanity < 50% risks binding an illusion without Ward/Crucifix!).", checkValid:function(r){return (isBindRoomMatch(r)||r.tags.indexOf("Mirror")!==-1)&&(r.lit||r.permLit);} }
};

const PROTOTYPE_REWARDS = [
  { name:"Soul Defibrillator", desc:"1 AP: Revives 1 Helper Spirit at 50% Sanity!", elec:false, charges:1, proto:"defib" },
  { name:"Motion Sensor Pack", desc:"1 AP: Alerts log & reveals Ghost on map when entered!", elec:true, on:true, charges:2, proto:"sensor" },
  { name:"Stun Flare", desc:"1 AP: Blinds & halts Ghost for 1 Round!", elec:false, charges:1, proto:"flare" },
  { name:"Ectoplasm Analyzer", desc:"1 AP (In Ghost Room): 100% Clue discovery!", elec:true, on:true, charges:1, proto:"analyzer" }
];

const SIDE_OBJECTIVE_POOL = [
  { id:"obj_smudge", text:"Cleanse a room with Smudge or Thurible" },
  { id:"obj_salt", text:"Lay a Salt barrier inside the house" },
  { id:"obj_ward", text:"Place a Crucifix, Ward, or Floodlight in a room" },
  { id:"obj_trace", text:"Uncover at least 1 hidden Forensic Trace" },
  { id:"obj_verify", text:"Uncover the Anchor (Heirloom or Corpse)" }
];

const DIFFICULTIES = {
  Normal: { name:"Normal (Standard)", houseDrain:1, darkDrain:1, eventDrainMult:1, startBreaker:true, perceptBonus:0, baseHuntRounds:4, apScanSanity:false, evSuccessRate:0.75, decoyRelic:false, reserveLives:2, desc:"• Survival Hunts use fast Micro-Turns (2 AP, 12s timer, -1 Sanity).<br>• Banishment Mode uses Full Turns (2 MP + 3 AP)." },
  Hard: { name:"Hard (Nightmare)", houseDrain:1, darkDrain:2, eventDrainMult:1.5, startBreaker:false, perceptBonus:2, baseHuntRounds:5, apScanSanity:true, evSuccessRate:0.58, decoyRelic:true, reserveLives:1, desc:"• Heavy Drain: -1/rnd (+2 Dark). 1 AP Van Sanity Scan.<br>• +2 Ghost Perception & 1.5x Cash Payout!" }
};

const HOUSE_SIZES = {
  Small: { label:"Small House", baseRooms:10, baseLights:3, backDoors:1, desc:"9–11 Interior Rooms (+ Free Van & Yards). Base Payout: $150." },
  Medium: { label:"Medium House", baseRooms:15, baseLights:4, backDoors:2, desc:"14–16 Interior Rooms (+ Free Van & Yards). Base Payout: $250." },
  Large: { label:"Large Manor", baseRooms:20, baseLights:5, backDoors:2, desc:"19–21 Interior Rooms (+ Free Van & Yards). Base Payout: $400." }
};

const SPECIALIST_TEMPLATES = [
  { name:"Technician", icon:"🔧", sanity:28, maxSanity:28, ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:0, roleDesc:"0 AP switches & sees Breaker Load. Ignores Electronic Noise.", startHand:{name:"Overclocked EMF",desc:"1 AP: Scan EMF 5 + 🩸 EMF Trace.",elec:true,on:true}, startBelt:{name:"Insulated Gloves",desc:"0 AP switches.",uses:99} },
  { name:"Medium", icon:"🔮", sanity:24, maxSanity:24, ap:3, maxAp:3, mp:2, maxMp:2, stealth:1, resolve:2, roleDesc:"+2 Resolve. Hears room names within 2 tiles! Group Spirit Box.", startHand:{name:"Tuned Spirit Box",desc:"1 AP (Dark): Hear Ghost voice.",elec:true,on:true}, startBelt:{name:"Sanity Pills",desc:"1 AP: +8 Sanity & cures Moroi Curse.",uses:1} },
  { name:"Occultist", icon:"🕯️", sanity:34, maxSanity:34, ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:2, roleDesc:"34 Sanity. Verify Heirlooms anywhere! Wards/Crucifix block Dark/Event drain.", startHand:{name:"Warded Crucifix",desc:"Drop/Hold: Counts as Ward & blocks Hunts.",elec:false,charges:1}, startBelt:{name:"Ritual Chalk",desc:"1 AP: Arcane Ward.",uses:3} },
  { name:"Vlogger", icon:"📹", sanity:28, maxSanity:28, ap:3, maxAp:3, mp:3, maxMp:3, stealth:1, resolve:0, roleDesc:"3 Free Walk MP (1 MP + 2 AP in Hunts) & +1 Stealth. Cam stops Dark drain.", startHand:{name:"Night-Vision Cam",desc:"1 AP: Scan Orbs & stops Dark drain.",elec:true,on:true}, startBelt:{name:"Salt Shaker",desc:"1 AP: Lay Salt (3x).",uses:3} },
  { name:"Exorcist", icon:"✝️", sanity:30, maxSanity:30, ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:3, roleDesc:"+3 Resolve! Refunds +1 AP whenever Act I or Act II is completed in room!", startHand:{name:"Holy Thurible",desc:"1 AP: Smudge room (3x).",elec:false,charges:3}, startBelt:{name:"Blessed Water",desc:"1 AP: Spawn Ward (2x).",uses:2} },
  { name:"Electrician", icon:"⚡", sanity:28, maxSanity:28, ap:3, maxAp:3, mp:2, maxMp:2, stealth:1, resolve:0, roleDesc:"Rewire Breaker (1 AP) for +2 Safe Lights! Floodlights ignore Load & broken bulbs.", startHand:{name:"High-Beam UV",desc:"1 AP: Scan Prints + 🩸 UV Trace.",elec:true,on:true}, startBelt:{name:"Work Floodlight",desc:"1 AP: Permanent light (2x).",uses:2} },
  { name:"Parapsychologist", icon:"🧠", sanity:26, maxSanity:26, ap:3, maxAp:3, mp:2, maxMp:2, stealth:1, resolve:1, roleDesc:"Reduces nearby Sanity shock by -1! Passive/Field Sanity Scanner.", startHand:{name:"Digital Thermometer",desc:"1 AP: Scan Freezing + 🩸 Temp Trace.",elec:true,on:true}, startBelt:{name:"Calm Sedative",desc:"1 AP: +8 Sanity & cures Curse.",uses:1} },
  { name:"Survivalist", icon:"🎒", sanity:32, maxSanity:32, ap:3, maxAp:3, mp:2, maxMp:2, stealth:3, resolve:0, roleDesc:"+3 Stealth when hiding! Heavy Salt Pouch (4 uses).", startHand:{name:"D.O.T.S. Emitter",desc:"Drop on floor: Laser grid.",elec:true,on:true,deploy:true}, startBelt:{name:"Heavy Salt Pouch",desc:"1 AP: Lay Salt (4x).",uses:4} },
  { name:"Detective", icon:"🕵️", sanity:28, maxSanity:28, ap:3, maxAp:3, mp:2, maxMp:2, stealth:1, resolve:1, roleDesc:"Auto-uncovers hidden Traces & Spare Key on room entry (0 AP)! Unlocks Back Doors free.", startHand:{name:"Forensic UV Lamp",desc:"1 AP: Scans UV Prints + ANY 🩸 Trace type!",elec:true,on:true}, startBelt:{name:"Master Lockpick",desc:"Passive: Unlatches Back Doors free.",uses:99} },
  { name:"Houndmaster", icon:"🐕", sanity:30, maxSanity:30, ap:3, maxAp:3, mp:2, maxMp:2, stealth:2, resolve:0, roleDesc:"Loyal K9 blocks the 1st Ghost Claim attack! Buzzer lures Ghost.", startHand:{name:"Thermal Scent Tracker",desc:"1 AP: Thermo + senses adjacent Ghost!",elec:true,on:true}, startBelt:{name:"Acoustic Decoy Buzzer",desc:"1 AP: Drop Lure Beacon in room (2x).",uses:2} },
  { name:"Archivist", icon:"📜", sanity:26, maxSanity:26, ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:3, roleDesc:"+3 Resolve! Starts contract with 1 Forensic Death Trait already revealed!", startHand:{name:"Ghost Writing Tome",desc:"Drop on floor: +25% Writing rate.",elec:false,deploy:true,written:false}, startBelt:{name:"Smudge Bundle",desc:"1 AP: Smudge & blind Ghost (2x).",uses:2} },
  { name:"Locksmith", icon:"🔨", sanity:32, maxSanity:32, ap:3, maxAp:3, mp:2, maxMp:2, stealth:2, resolve:1, roleDesc:"Opening doors in Hunts makes 0 Noise! Door Wedges slow Ghost by -2 Speed & prevent door breaking.", startHand:{name:"Overclocked EMF",desc:"1 AP: Scan EMF 5 + 🩸 EMF Trace.",elec:true,on:true}, startBelt:{name:"Heavy Door Wedge",desc:"1 AP: Reinforce Shut Doors (3x).",uses:3} }
];

const INTERN_TEMPLATE = {
  name:"Intern", icon:"🧑", sanity:26, maxSanity:26, ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:0,
  roleDesc:"Uninsured volunteer. Starts empty-handed—pick up Van equipment from the truck floor!"
};

const SPECIALIST_CHALLENGES = [
  { id:"lights_20", target:20, desc:"Flip Light Switches or Breaker 20 times" },
  { id:"spirit_box_5", target:5, desc:"Confirm Spirit Box in 5 contracts" },
  { id:"wards_5", target:5, desc:"Place Wards/Crucifixes or survive Hunts 5 times" },
  { id:"orbs_dots_5", target:5, desc:"Confirm Ghost Orbs or D.O.T.S. 5 times" },
  { id:"banish_3", target:3, desc:"Successfully Banish 3 Ghosts" },
  { id:"overload_3", target:3, desc:"Trigger or fix 3 Breaker events" },
  { id:"freezing_5", target:5, desc:"Confirm Freezing Temps 5 times" },
  { id:"hide_10", target:10, desc:"Hide in cover 10 times" },
  { id:"search_10", target:10, desc:"Uncover 10 Traces or Keys via Search" },
  { id:"chase_5", target:5, desc:"Survive 5 Hunt rounds inside the house" },
  { id:"writing_5", target:5, desc:"Confirm Ghost Writing 5 times" },
  { id:"doors_15", target:15, desc:"Shut or unlock 15 Doors" }
];

const VAN_SHOP_CATALOG = [
  { key:"thermo", name:"Thermometer", baseDesc:"1 AP: Scan Freezing + 🩸 Temp Trace.", elec:true, on:true, extraCost:65, t2Cost:100, t3Cost:225, t2Desc:"+20% Clue Rate", t3Desc:"100% Clue Rate & Silent in Hunts" },
  { key:"uv", name:"UV Flashlight", baseDesc:"1 AP: Scan Prints + 🩸 UV Trace. Stops Dark drain.", elec:true, on:true, extraCost:65, t2Cost:100, t3Cost:225, t2Desc:"+20% Clue Rate", t3Desc:"Scans ANY 🩸 Trace Type & Silent!" },
  { key:"emf", name:"EMF Reader", baseDesc:"1 AP: Scan EMF 5 + 🩸 EMF Trace.", elec:true, on:true, extraCost:65, t2Cost:100, t3Cost:225, t2Desc:"+20% Clue Rate", t3Desc:"100% Clue Rate & Silent in Hunts" },
  { key:"box", name:"Spirit Box", baseDesc:"1 AP (Dark): Hear Ghost voice.", elec:true, on:true, extraCost:65, t2Cost:100, t3Cost:225, t2Desc:"+20% Clue Rate", t3Desc:"100% Clue Rate & Silent in Hunts" },
  { key:"cam", name:"Night-Vision Cam", baseDesc:"1 AP: Scan Ghost Orbs & stops Dark drain.", elec:true, on:true, extraCost:65, t2Cost:100, t3Cost:225, t2Desc:"+20% Clue Rate", t3Desc:"100% Clue Rate & Silent in Hunts" },
  { key:"book", name:"Ghost Writing Book", baseDesc:"Drop on floor: Ghost writes silently.", elec:false, deploy:true, written:false, extraCost:65, t2Cost:100, t3Cost:200, t2Desc:"+20% Write Rate", t3Desc:"100% Write Rate in Ghost Room" },
  { key:"dots", name:"D.O.T.S. Projector", baseDesc:"Drop on floor: Laser silhouette.", elec:true, on:true, deploy:true, triggered:false, extraCost:65, t2Cost:100, t3Cost:200, t2Desc:"+20% Trigger Rate", t3Desc:"100% Trigger Rate" },
  { key:"supp", name:"Crucifix, Smudge & Salt", baseDesc:"Van Protective Consumable Pack.", elec:false, extraCost:75, t2Cost:125, t3Cost:250, t2Desc:"+1 Charge (Crux 2x, Smudge 3x, Salt 4x)", t3Desc:"+2 Charges (Crux 3x, Smudge 4x, Salt 5x)" }
];

let selectedMode = "OneShot", selectedClasses = [false,false,false,false,false,false,false,false,false,false,false,false], selectedInternCount = 4, selectedDifficulty = "Normal", selectedHouseSize = "Medium";
let CAMP = { active:false, missionNum:1, reserveLives:2, usedClassIndices:[], pendingSquad:null, bossPrimary:null, bossMutationGhost:null, bossExtraEv:null, bossDeath:null, cluesUnlocked:[] };
let G = {}, undoSnapshots = {};

function getDefaultMetaSave() {
  var prog = {}, unlocked = {}, levels = {}, vanTiers = {}, vanExtras = {};
  SPECIALIST_CHALLENGES.forEach(function(c, i) { prog[c.id] = 0; unlocked[i] = false; levels[i] = 1; });
  VAN_SHOP_CATALOG.forEach(function(v) { vanTiers[v.key] = 1; vanExtras[v.key] = 0; });
  return { cash: 0, extraPills: 0, progress: prog, unlocked: unlocked, specLevels: levels, vanTiers: vanTiers, vanExtras: vanExtras };
}

let META = getDefaultMetaSave();
function loadMetaSave() {
  try {
    var raw = localStorage.getItem("SPECTRAL_META_SAVE_V95");
    if (raw) {
      var parsed = JSON.parse(raw);
      META = Object.assign(getDefaultMetaSave(), parsed);
      META.progress = Object.assign(getDefaultMetaSave().progress, parsed.progress || {});
      META.unlocked = Object.assign(getDefaultMetaSave().unlocked, parsed.unlocked || {});
      META.specLevels = Object.assign(getDefaultMetaSave().specLevels, parsed.specLevels || {});
      META.vanTiers = Object.assign(getDefaultMetaSave().vanTiers, parsed.vanTiers || {});
      META.vanExtras = Object.assign(getDefaultMetaSave().vanExtras, parsed.vanExtras || {});
    }
  } catch (e) {}
}
function saveMetaSave() {
  try { localStorage.setItem("SPECTRAL_META_SAVE_V95", JSON.stringify(META)); } catch (e) {}
}
loadMetaSave();

function recordChallengeProgress(chalId, amount) {
  if (!META.progress) return;
  META.progress[chalId] = (META.progress[chalId] || 0) + (amount || 1);
  SPECIALIST_CHALLENGES.forEach(function(c, idx) {
    if (c.id === chalId && !META.unlocked[idx] && META.progress[chalId] >= c.target) {
      META.unlocked[idx] = true;
      META.specLevels[idx] = 1;
      playSound("emf5");
      var tpl = SPECIALIST_TEMPLATES[idx];
      showDiceToast("🔓 SPECIALIST UNLOCKED: " + tpl.icon + " " + tpl.name.toUpperCase() + " (LVL 1)!", "var(--green)");
      if (G && G.logs) logMsg("🔓 CHALLENGE COMPLETE! Unlocked Specialist [" + tpl.icon + " " + tpl.name + "] permanently!", "clue");
    }
  });
  saveMetaSave();
}

function buildTieredItem(baseItem, tier) {
  var it = Object.assign({}, baseItem);
  it.tier = tier || 1;
  var tTag = " [T" + it.tier + "]";
  if (it.name.indexOf("[T") === -1) it.name = it.name + tTag;
  if (typeof it.charges === "number") it.charges += (it.tier - 1);
  if (typeof it.uses === "number" && it.uses < 50) it.uses += (it.tier - 1);
  if (it.tier === 2) it.desc += " (T2: +20% Clue Rate / +1 Use)";
  if (it.tier === 3) {
    it.silentElec = true;
    it.desc += " (T3: 100% Clue Rate & Silent in Hunts!)";
  }
  return it;
}

function loseVanUpgradesOnDefeat() {
  var lostAny = (META.extraPills > 0);
  META.extraPills = 0;
  Object.keys(META.vanTiers).forEach(function(k) {
    if (META.vanTiers[k] > 1) { META.vanTiers[k] = 1; lostAny = true; }
  });
  if (META.vanExtras) {
    Object.keys(META.vanExtras).forEach(function(k) {
      if (META.vanExtras[k] > 0) { META.vanExtras[k] = 0; lostAny = true; }
    });
  }
  saveMetaSave();
  return lostAny;
}

/* ============================================================================
   3. MULTI-FLOOR HOUSE GENERATOR
============================================================================ */
function generateMultiFloorHouse(sizeKey, numBackDoors) {
  var baseInteriorCount = HOUSE_SIZES[sizeKey].baseRooms;
  var targetInteriorCount = baseInteriorCount + (Math.floor(Math.random() * 3) - 1);
  var floorsPresent = [1], archLabel = "1-Story Ranch (1F)";
  if (sizeKey === "Small") {
    if (Math.random() < 0.65) { floorsPresent = [-1, 1]; archLabel = "Split-Level Cellar Home (B1 + 1F)"; }
  } else {
    var roll = Math.random();
    if (roll < 0.22) { floorsPresent = [1]; archLabel = "Sprawling 1-Story Estate (1F)"; }
    else if (roll < 0.48) { floorsPresent = [-1, 1]; archLabel = "Cellar Estate (B1 + 1F)"; }
    else if (roll < 0.74) { floorsPresent = [1, 2]; archLabel = "Classic 2-Story Manor (1F + 2F)"; }
    else { floorsPresent = [-1, 1, 2]; archLabel = "3-Floor Grand Estate (B1 + 1F + 2F)"; }
  }
  var hasB1 = floorsPresent.indexOf(-1) !== -1, has2F = floorsPresent.indexOf(2) !== -1;

  var blueprint = [
    { id:"r0", floor:1, x:3, y:4, name:"The Van (Base)", zone:"van", art:"van", hideMod:99, hideSpot:"Locked Truck", tags:["Van","Exterior"], discovered:true, neighbors:["r1","y_front","y_back"] },
    { id:"y_front", floor:1, x:2, y:4, name:"Front Yard", zone:"yard", art:"yard", hideMod:99, hideSpot:"Hedge Row", tags:["Yard","Exterior"], discovered:true, neighbors:["r0","y_back"] },
    { id:"y_back", floor:1, x:0, y:1, name:"Back Yard", zone:"yard", art:"yard", hideMod:99, hideSpot:"Garden Shed", tags:["Yard","Exterior"], discovered:true, neighbors:["r0","y_front"] }
  ];

  var interiorNodes = [
    { id:"r1", floor:1, x:3, y:3, name:"The Foyer", zone:"zone-hall", art:"foyer", hideMod:2, hideSpot:"Coat Rack", tags:["Mirror"], discovered:true, neighbors:["r0","r2"] },
    { id:"r2", floor:1, x:3, y:2, name:"Main Hallway", zone:"zone-hall", art:"hall", hideMod:0, hideSpot:"Exposed Hall", tags:["Corridor"], discovered:false, neighbors:["r1","r3"] },
    { id:"r3", floor:1, x:3, y:1, name:(hasB1||has2F)?"Central Stairwell (1F)":"North Hallway", zone:"zone-hall", art:(hasB1||has2F)?"stairs":"hall", hideMod:2, hideSpot:"Under Stairs", tags:(hasB1||has2F)?["Stairs","Corridor"]:["Corridor"], discovered:false, neighbors:["r2"] }
  ];

  if (hasB1) {
    interiorNodes.push({ id:"r_b1_hub", floor:-1, x:3, y:2, name:"Cellar Stairs (B1)", zone:"zone-hall", art:"stairs", hideMod:2, hideSpot:"Under Steps", tags:["Stairs","Corridor","Cold"], discovered:false, neighbors:["r3"] });
    interiorNodes[2].neighbors.push("r_b1_hub");
  }
  if (has2F) {
    interiorNodes.push({ id:"r_2f_hub", floor:2, x:3, y:2, name:"Upper Landing (2F)", zone:"zone-hall", art:"stairs", hideMod:0, hideSpot:"Banister", tags:["Stairs","Corridor"], discovered:false, neighbors:["r3"] });
    interiorNodes[2].neighbors.push("r_2f_hub");
  }

  var f1Pool = [
    { x:2, y:2, from:"r2", name:"Living Room", zone:"zone-living", art:"living", hideMod:2, hideSpot:"Behind Sofa", tags:["TV"] },
    { x:4, y:2, from:"r2", name:"Dining Room", zone:"zone-living", art:"dining", hideMod:2, hideSpot:"Under Table", tags:["Clutter"] },
    { x:2, y:1, from:"r3", name:"Kitchen", zone:"zone-service", art:"kitchen", hideMod:2, hideSpot:"Island Counter", tags:["Clutter"], backDoorCandidate:true },
    { x:4, y:3, from:"r1", name:"Home Office", zone:"zone-living", art:"office", hideMod:2, hideSpot:"Under Desk", tags:["PC"] },
    { x:1, y:2, fromCoord:[2,2], name:"West Corridor", zone:"zone-hall", art:"hall", hideMod:0, hideSpot:"Exposed Hall", tags:["Corridor"] },
    { x:1, y:1, fromCoord:[2,1], name:"Garage", zone:"zone-utility", art:"garage", hideMod:4, hideSpot:"Behind Car", tags:["Closet","FuseCandidate"], backDoorCandidate:true },
    { x:4, y:1, from:"r3", name:"Sunroom", zone:"zone-living", art:"sunroom", hideMod:2, hideSpot:"Wicker Chairs", tags:["Mirror"], backDoorCandidate:true },
    { x:5, y:2, fromCoord:[4,2], name:"East Corridor", zone:"zone-hall", art:"hall", hideMod:0, hideSpot:"Exposed Hall", tags:["Corridor"] },
    { x:5, y:1, fromCoord:[4,1], name:"Conservatory", zone:"zone-living", art:"sunroom", hideMod:2, hideSpot:"Planter Boxes", tags:["Clutter"], backDoorCandidate:true },
    { x:2, y:3, fromCoord:[2,2], name:"Guest Parlor", zone:"zone-living", art:"living", hideMod:2, hideSpot:"Armchairs", tags:["Mirror"] },
    { x:5, y:3, fromCoord:[5,2], name:"Downstairs Bath", zone:"zone-service", art:"bath", hideMod:2, hideSpot:"Shower Curtain", tags:["Mirror"] },
    { x:1, y:3, fromCoord:[1,2], name:"Mudroom", zone:"zone-utility", art:"utility", hideMod:4, hideSpot:"Coat Locker", tags:["Closet","FuseCandidate"], backDoorCandidate:true },
    { x:6, y:2, fromCoord:[5,2], name:"Master Suite (1F)", zone:"zone-bed", art:"bed", hideMod:4, hideSpot:"Walk-in Closet", tags:["Closet","Mirror"] },
    { x:6, y:1, fromCoord:[6,2], name:"Nursery Wing", zone:"zone-bed", art:"bed", hideMod:2, hideSpot:"Behind Crib", tags:["Clutter"] },
    { x:6, y:3, fromCoord:[5,3], name:"Utility Pantry", zone:"zone-utility", art:"utility", hideMod:4, hideSpot:"Metal Locker", tags:["Closet","FuseCandidate"] }
  ];
  var b1Pool = [
    { x:2, y:2, from:"r_b1_hub", name:"Basement Storage", zone:"zone-utility", art:"utility", hideMod:2, hideSpot:"Storage Racks", tags:["Cold","FuseCandidate"] },
    { x:4, y:2, from:"r_b1_hub", name:"Boiler Room", zone:"zone-utility", art:"utility", hideMod:4, hideSpot:"Steel Ducts", tags:["FuseCandidate"] },
    { x:3, y:1, from:"r_b1_hub", name:"Cellar Tunnel", zone:"zone-hall", art:"hall", hideMod:0, hideSpot:"Stone Passage", tags:["Corridor","Cold"] },
    { x:2, y:1, fromCoord:[3,1], name:"Wine Cellar", zone:"zone-utility", art:"utility", hideMod:2, hideSpot:"Oak Barrels", tags:["Cold"] },
    { x:4, y:1, fromCoord:[3,1], name:"Root Cellar", zone:"zone-utility", art:"utility", hideMod:4, hideSpot:"Wooden Crates", tags:["Cold","Closet"] },
    { x:3, y:3, from:"r_b1_hub", name:"Laundry Vault", zone:"zone-service", art:"bath", hideMod:2, hideSpot:"Washer Units", tags:["Mirror"] }
  ];
  var f2Pool = [
    { x:2, y:2, from:"r_2f_hub", name:"Master Bedroom", zone:"zone-bed", art:"bed", hideMod:4, hideSpot:"Walk-in Closet", tags:["Closet","Mirror"] },
    { x:4, y:2, from:"r_2f_hub", name:"Nursery", zone:"zone-bed", art:"bed", hideMod:2, hideSpot:"Behind Crib", tags:["Clutter"] },
    { x:3, y:1, from:"r_2f_hub", name:"Upstairs Hallway", zone:"zone-hall", art:"hall", hideMod:0, hideSpot:"Exposed Hall", tags:["Corridor"] },
    { x:3, y:3, from:"r_2f_hub", name:"Upstairs Bathroom", zone:"zone-service", art:"bath", hideMod:2, hideSpot:"Shower Curtain", tags:["Mirror"] },
    { x:2, y:1, fromCoord:[3,1], name:"Guest Bedroom", zone:"zone-bed", art:"bed", hideMod:4, hideSpot:"Linen Closet", tags:["Closet","Mirror"] },
    { x:4, y:1, fromCoord:[3,1], name:"Attic Storage", zone:"zone-utility", art:"utility", hideMod:4, hideSpot:"Old Wardrobe", tags:["Closet","FuseCandidate"] },
    { x:2, y:3, fromCoord:[2,2], name:"Grand Library", zone:"zone-living", art:"office", hideMod:2, hideSpot:"Tall Bookshelves", tags:["Clutter"] }
  ];

  var nextId = 10;
  function tryAddFromPool(pool, flNum) {
    if (pool.length === 0) return false;
    var s = pool.shift(), newId = "r" + (nextId++), parentId = s.from;
    if (!parentId && s.fromCoord) {
      var fp = interiorNodes.find(function(n) { return n.floor === flNum && n.x === s.fromCoord[0] && n.y === s.fromCoord[1]; });
      parentId = fp ? fp.id : (flNum === 1 ? "r2" : (flNum === -1 ? "r_b1_hub" : "r_2f_hub"));
    }
    var rmObj = { id:newId, floor:flNum, x:s.x, y:s.y, name:s.name, zone:s.zone, art:s.art, hideMod:s.hideMod, hideSpot:s.hideSpot, tags:s.tags.slice(), backDoorCandidate:s.backDoorCandidate||false, discovered:false, neighbors:[parentId] };
    var pNode = interiorNodes.find(function(n) { return n.id === parentId; });
    if (pNode && pNode.neighbors.indexOf(newId) === -1) pNode.neighbors.push(newId);
    interiorNodes.forEach(function(other) {
      if (other.floor !== flNum || other.id === parentId) return;
      if (Math.abs(other.x - rmObj.x) + Math.abs(other.y - rmObj.y) === 1) {
        if (other.zone === "zone-hall" || rmObj.zone === "zone-hall" || Math.random() < 0.45) {
          rmObj.neighbors.push(other.id); other.neighbors.push(newId);
        }
      }
    });
    interiorNodes.push(rmObj);
    return true;
  }

  var cycle = 0;
  while (interiorNodes.length < targetInteriorCount && cycle < 50) {
    cycle++;
    if (hasB1 && b1Pool.length > 0 && (interiorNodes.filter(function(n){return n.floor===-1;}).length < Math.ceil(targetInteriorCount * 0.3))) tryAddFromPool(b1Pool, -1);
    else if (has2F && f2Pool.length > 0 && (interiorNodes.filter(function(n){return n.floor===2;}).length < Math.ceil(targetInteriorCount * 0.35))) tryAddFromPool(f2Pool, 2);
    else if (f1Pool.length > 0) tryAddFromPool(f1Pool, 1);
    else if (hasB1 && b1Pool.length > 0) tryAddFromPool(b1Pool, -1);
    else if (has2F && f2Pool.length > 0) tryAddFromPool(f2Pool, 2);
  }

  var allRooms = blueprint.concat(interiorNodes);
  var backCandidates = allRooms.filter(function(b) { return b.floor === 1 && b.backDoorCandidate; });
  var backYard = allRooms.find(function(b) { return b.id === "y_back"; });
  for (var b = 0; b < Math.min(numBackDoors, backCandidates.length); b++) {
    var bRoom = backCandidates[b];
    bRoom.hasBackDoor = true; bRoom.backDoorUnlocked = false;
    if (bRoom.neighbors.indexOf("y_back") === -1) bRoom.neighbors.push("y_back");
    if (backYard.neighbors.indexOf(bRoom.id) === -1) backYard.neighbors.push(bRoom.id);
  }
  return { rooms:allRooms, floorsPresent:floorsPresent, archLabel:archLabel, interiorCount:interiorNodes.length };
}

/* ============================================================================
   4. LOBBY, INITIALIZATION & MULTIPLAYER PEERJS ENGINE (GITHUB PAGES + TURN)
============================================================================ */
let hostPeer = null, hostRoomCode = "", hostConnections = [];
let clientPeer = null, clientConn = null, isMobileClient = false, mobileCharIdx = 0;
let syncRetryInterval = null, hasReceivedHostSync = false;

// Includes both Google STUN and free OpenRelay TURN servers so mobile/Wi-Fi NAT never blocks GitHub Pages
const PEER_CONFIG = {
  debug: 2,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  }
};

function sanitizeGameStateForSync() {
  try {
    return JSON.parse(JSON.stringify(G));
  } catch (e) {
    return G;
  }
}

function initHostPeer() {
  if (hostPeer && !hostPeer.destroyed) return;
  if (!hostRoomCode) {
    hostRoomCode = "SP" + Math.floor(1000 + Math.random() * 9000);
  }
  try {
    hostPeer = new Peer("spectral-host-" + hostRoomCode, PEER_CONFIG);

    hostPeer.on("open", function(id) {
      console.log("🎮 Host TV Peer Open:", id);
      var codeEl = document.getElementById("host-room-code-display");
      if (codeEl) codeEl.textContent = hostRoomCode;
      updateQRDisplay();
    });

    hostPeer.on("connection", function(conn) {
      console.log("📱 Incoming Phone Connection:", conn.peer);
      if (hostConnections.indexOf(conn) === -1) hostConnections.push(conn);
      updatePhoneCountUI();
      showDiceToast("📱 PHONE P.D.A. LINKED!", "var(--green)");

      function pushSyncToPhone() {
        if (conn && conn.open) {
          try {
            conn.send({ type: "STATE_SYNC", G: sanitizeGameStateForSync() });
          } catch (err) {
            console.error("Failed to send STATE_SYNC:", err);
          }
        }
      }

      conn.on("open", function() {
        updatePhoneCountUI();
        pushSyncToPhone();
        setTimeout(pushSyncToPhone, 350);
      });

      if (conn.open) pushSyncToPhone();

      conn.on("data", function(data) {
        if (!data) return;
        if (data.type === "REQUEST_SYNC") {
          pushSyncToPhone();
          return;
        }
        handleRemotePhoneCommand(data);
      });

      conn.on("close", function() {
        hostConnections = hostConnections.filter(function(c) { return c !== conn; });
        updatePhoneCountUI();
      });

      conn.on("error", function(err) {
        console.warn("Host conn error:", err);
        hostConnections = hostConnections.filter(function(c) { return c !== conn; });
        updatePhoneCountUI();
      });
    });

    hostPeer.on("disconnected", function() {
      if (hostPeer && !hostPeer.destroyed) {
        try { hostPeer.reconnect(); } catch (e) {}
      }
    });

    hostPeer.on("error", function(err) {
      console.warn("Host Peer Error:", err.type, err);
      if (err && err.type === "unavailable-id") {
        hostPeer = null;
        hostRoomCode = "SP" + Math.floor(1000 + Math.random() * 9000);
        setTimeout(initHostPeer, 400);
      }
    });
  } catch (e) {
    console.error("initHostPeer exception:", e);
  }
}

function updatePhoneCountUI() {
  var el = document.getElementById("connected-phones-count");
  if (el) el.textContent = hostConnections.length + " Phone(s) Connected";
}

function updateQRDisplay() {
  var qrBox = document.getElementById("qr-container");
  if (!qrBox) return;
  var code = hostRoomCode || "LOCAL";
  var joinUrl = window.location.href.split("?")[0] + "?room=" + code;
  qrBox.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=' + encodeURIComponent(joinUrl) + '" alt="QR Code" style="display:block;"/>';
}

function broadcastStateToPhones() {
  if (isMobileClient) return;
  var cleanG = sanitizeGameStateForSync();
  hostConnections.forEach(function(conn) {
    if (conn && conn.open) {
      try { conn.send({ type: "STATE_SYNC", G: cleanG }); } catch (e) {}
    }
  });
  try { localStorage.setItem("SPECTRAL_LIVE_STATE", JSON.stringify(cleanG)); } catch (e) {}
}

function cycleTriState(obj, key) {
  var v = obj[key];
  var cur = (v === true || v === 1) ? 1 : (v === -1 ? -1 : 0);
  obj[key] = (cur === 0) ? 1 : (cur === 1 ? -1 : 0);
}

function getTriStateVal(obj, key) {
  var v = obj[key];
  if (v === true || v === 1) return 1;
  if (v === -1) return -1;
  return 0;
}

function handleRemotePhoneCommand(cmd) {
  if (!G.players || G.gameOver || G.isAnimatingHunt) return;
  if (typeof cmd.charIdx === "number" && cmd.charIdx >= 0 && cmd.charIdx < G.players.length) {
    G.selectedChar = cmd.charIdx;
    G.currentFloorView = getRoom(G.players[G.selectedChar].roomId).floor;
  }
  var act = cmd.action;
  if (act === "select-char") { renderAll(); return; }
  else if (act === "move-room") clickRoomTile(cmd.room);
  else if (act === "open-door") openDoorWithoutMoving(cmd.room);
  else if (act === "use-stairs") traverseStairsTo(cmd.target);
  else if (act === "search-room") searchCurrentRoom();
  else if (act === "verify-relic") verifyHeirloomResonance();
  else if (act === "disturb-corpse") disturbCorpseAction();
  else if (act === "close-door") toggleCloseDoor();
  else if (act === "enter-hide") enterHidingSpot();
  else if (act === "hold-breath") holdBreathAction();
  else if (act === "leave-hide") leaveHidingAction();
  else if (act === "scan-sanity") scanBiometricsAction();
  else if (act === "use-hand") useHandItem(cmd.slot);
  else if (act === "toggle-power") togglePowerAction(cmd.slot);
  else if (act === "drop-item") dropItemAction(cmd.slot);
  else if (act === "pick-floor") pickFloorAction(cmd.idx);
  else if (act === "use-belt") useBeltAction();
  else if (act === "flip-light") flipRoomLight();
  else if (act === "flip-breaker") flipBreakerAction();
  else if (act === "upgrade-breaker") upgradeBreakerAction();
  else if (act === "wipe-ward") wipeWardAction();
  else if (act === "kill-env-elec") shutOffRoomElectronics();
  else if (act === "photo-water") snapDirtyWaterPhoto();
  else if (act === "gaze-mirror") gazeIntoMirrorAction();
  else if (act === "ritual-chant") executeExorcismAct();
  else if (act === "begin-ritual") triggerBanishmentHunt();
  else if (act === "spirit-sense") spiritSenseAction();
  else if (act === "toggle-ev") { cycleTriState(G.foundEv, cmd.ev); renderAll(); }
  else if (act === "toggle-forensic") { cycleTriState(G.foundForensics, cmd.ft); renderAll(); }
  else if (act === "inspect-ghost") { G.inspectedGhost = cmd.ghost; if (!G.banishmentMode) G.lockedGhost = cmd.ghost; renderAll(); }
  else if (act === "inspect-death") { G.inspectedDeath = cmd.death; if (!G.banishmentMode) G.lockedDeath = cmd.death; renderAll(); }
  else if (act === "undo") performUndoForChar(G.selectedChar);
  else if (act === "toggle-end-turn") togglePlayerEndTurnReady(G.selectedChar);
}

function sendPhoneCmd(payload) {
  payload.charIdx = isMobileClient ? mobileCharIdx : (G.selectedChar || 0);
  if (clientConn && clientConn.open) {
    try { clientConn.send(payload); } catch (e) {}
  } else {
    try { localStorage.setItem("SPECTRAL_PHONE_CMD", JSON.stringify(Object.assign({ ts:Date.now() }, payload))); } catch (e) {}
    handleRemotePhoneCommand(payload);
  }
}

window.addEventListener("storage", function(e) {
  if (e.key === "SPECTRAL_PHONE_CMD" && !isMobileClient && e.newValue) {
    try { handleRemotePhoneCommand(JSON.parse(e.newValue)); } catch (err) {}
  } else if (e.key === "SPECTRAL_LIVE_STATE" && isMobileClient && e.newValue) {
    try {
      G = JSON.parse(e.newValue);
      G.selectedChar = mobileCharIdx;
      renderMobileController();
    } catch (err) {}
  }
});

/* ============================================================================
   5. GAME SETUP, PROGRESSION SHOP & TURN READY SYSTEM
============================================================================ */
function ensureLobbyDomUpgraded() {
  var gridEl = document.getElementById("lobby-char-grid");
  if (!gridEl) return;
  if (!document.getElementById("lobby-intern-controls")) {
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin:6px 0;";
    bar.innerHTML =
      '<div style="display:flex; gap:8px; align-items:center;"><span id="lobby-cash-badge" class="hud-pill" style="border-color:var(--green); color:var(--green); font-size:12px;">💵 $0</span><button type="button" class="btn-amber" id="btn-reset-meta">🔄 Reset Save</button></div>' +
      '<div id="lobby-intern-controls" style="display:flex; align-items:center; gap:6px;"></div>';
    gridEl.parentNode.insertBefore(bar, gridEl);
    document.getElementById("btn-reset-meta").addEventListener("click", function() {
      META = getDefaultMetaSave();
      selectedClasses = [false,false,false,false,false,false,false,false,false,false,false,false];
      selectedInternCount = 4;
      saveMetaSave();
      renderLobbyModal();
    });
  }
  if (!document.getElementById("lobby-van-shop")) {
    var shopWrap = document.createElement("div");
    shopWrap.innerHTML =
      '<div style="font-weight:700; font-size:11px; color:var(--amber); margin-top:8px;">5. VAN EQUIPMENT TIER SHOP &amp; EXTRA TOOLS (⚠️ T2/T3 UPGRADES &amp; EXTRAS LOST ON DEFEAT!):</div>' +
      '<div id="lobby-van-shop" class="van-shop-grid"></div>';
    gridEl.parentNode.insertBefore(shopWrap, gridEl.nextSibling);
  }
  var jBtn = document.getElementById("tab-btn-journal");
  if (jBtn) jBtn.textContent = "3. GHOSTS (19)";
}

function openLobbyModal() {
  stopHuntTurnTimer();
  renderLobbyModal();
  document.getElementById("lobby-modal").style.display = "flex";
}

function renderLobbyModal() {
  ensureLobbyDomUpgraded();
  loadMetaSave();
  var cashEl = document.getElementById("lobby-cash-badge");
  if (cashEl) cashEl.textContent = "💵 $" + META.cash;

  document.getElementById("lobby-mode-row").innerHTML = [
    { key:"OneShot", title:"Single Contract (One-Shot)", desc:"Standalone investigation on any house size. Earn 💵 Cash & unlock Specialist Challenges." },
    { key:"Campaign", title:"3-Mission Campaign: The Cursed Heirloom Trail", desc:"Chain 3 escalating houses (Small -> Medium -> Large Boss Manor)." }
  ].map(function(m) {
    var sel = (selectedMode === m.key);
    return '<div class="mode-card '+(sel?'selected':'')+'" data-action="select-mode" data-mode="'+m.key+'"><div style="font-weight:800; font-size:12px; color:var(--purple);">'+m.title+'</div><div style="font-size:10px; color:var(--dim);">'+m.desc+'</div></div>';
  }).join("");

  document.getElementById("lobby-diff-row").innerHTML = Object.keys(DIFFICULTIES).map(function(dKey) {
    var d = DIFFICULTIES[dKey], sel = (selectedDifficulty === dKey);
    return '<div class="diff-card '+(sel?'selected':'')+'" data-action="select-diff" data-diff="'+dKey+'"><div style="font-weight:800; font-size:12px; color:'+(dKey==='Hard'?'var(--red)':'var(--amber)')+';">'+d.name+'</div><div style="font-size:10px; color:var(--dim);">'+d.desc+'</div></div>';
  }).join("");

  document.getElementById("lobby-size-section").style.display = (selectedMode === "OneShot") ? "block" : "none";
  document.getElementById("lobby-size-row").innerHTML = Object.keys(HOUSE_SIZES).map(function(sKey) {
    var s = HOUSE_SIZES[sKey], sel = (selectedHouseSize === sKey);
    return '<div class="size-card '+(sel?'selected':'')+'" data-action="select-size" data-size="'+sKey+'"><div style="font-weight:800; font-size:12px; color:var(--cyan);">'+s.label+'</div><div style="font-size:10px; color:var(--dim);">'+s.desc+'</div></div>';
  }).join("");

  selectedClasses = selectedClasses.map(function(sel, idx) { return META.unlocked[idx] ? sel : false; });
  var specCount = selectedClasses.filter(Boolean).length;
  if (specCount + selectedInternCount > 4) selectedInternCount = Math.max(0, 4 - specCount);
  if (specCount + selectedInternCount < 1) selectedInternCount = 1;
  var totalCount = specCount + selectedInternCount;

  if ((META.extraPills || 0) > totalCount) {
    META.extraPills = totalCount;
    saveMetaSave();
  }

  var internBox = document.getElementById("lobby-intern-controls");
  if (internBox) {
    internBox.innerHTML =
      '<span style="font-size:11px; color:var(--cyan); font-weight:700;">🧑 Interns (Empty-Handed): ' + selectedInternCount + '</span>' +
      '<button type="button" data-action="adj-intern" data-delta="-1" '+(selectedInternCount<=0?'disabled':'')+'>-1 Intern</button>' +
      '<button type="button" class="btn-green" data-action="adj-intern" data-delta="1" '+(totalCount>=4?'disabled':'')+'>+1 Intern</button>';
  }

  var lbl = document.getElementById("lobby-count-label");
  lbl.textContent = totalCount + " / 4 Investigators (" + selectedInternCount + " Interns + " + specCount + " Specialists)";
  document.getElementById("btn-launch-contract").disabled = (totalCount < 1 || totalCount > 4);

  document.getElementById("lobby-char-grid").innerHTML = SPECIALIST_TEMPLATES.map(function(tpl, idx) {
    var isUnlocked = META.unlocked[idx];
    var sel = selectedClasses[idx] && isUnlocked;
    var chal = SPECIALIST_CHALLENGES[idx];
    var curProg = Math.min(chal.target, META.progress[chal.id] || 0);
    var pct = Math.round((curProg / chal.target) * 100);
    var sLvl = META.specLevels[idx] || 1;
    var upgCost = sLvl === 1 ? 200 : 350;

    if (!isUnlocked) {
      return '<div class="lobby-char locked-spec"><div style="display:flex; justify-content:space-between; font-weight:700; font-size:11px;"><span>🔒 '+tpl.icon+' '+tpl.name+'</span><span style="color:var(--amber); font-size:9px;">'+curProg+'/'+chal.target+'</span></div><div style="font-size:9px; color:var(--amber); margin-top:2px;">🏆 '+chal.desc+'</div><div class="challenge-bar-wrap"><div class="challenge-bar-fill" style="width:'+pct+'%;"></div></div><div style="font-size:8px; color:var(--dim); margin-top:3px;">'+tpl.roleDesc+'</div></div>';
    }
    return '<div class="lobby-char '+(sel?'selected':'')+'" data-action="toggle-lobby-char" data-idx="'+idx+'"><div style="display:flex; justify-content:space-between; font-weight:700; font-size:11px;"><span>'+tpl.icon+' '+tpl.name+' <span class="tier-badge t'+sLvl+'">Lvl '+sLvl+' (T'+sLvl+')</span></span><span style="color:'+(sel?'var(--green)':'var(--dim)')+'; font-size:9px;">'+(sel?'✓ READY':'BENCH')+'</span></div><div style="font-size:9px; color:var(--cyan);">San: '+tpl.sanity+' | Walk: '+tpl.mp+' MP | Gear: T'+sLvl+' '+tpl.startHand.name+'</div><div style="font-size:8.5px; color:var(--dim);">'+tpl.roleDesc+'</div>'+(sLvl<3?'<div style="margin-top:4px; pointer-events:auto;"><button type="button" class="btn-purple" style="width:100%; padding:2px 4px; font-size:9px;" data-action="level-up-spec" data-idx="'+idx+'" '+(META.cash<upgCost?'disabled':'')+'>⬆️ Promote to Lvl '+(sLvl+1)+' (T'+(sLvl+1)+' Gear) — $'+upgCost+'</button></div>':'<div style="font-size:8.5px; color:var(--purple); font-weight:700; margin-top:3px;">★ MAX LEVEL 3 (T3 SIGNATURE GEAR)</div>')+'</div>';
  }).join("");

  var shopEl = document.getElementById("lobby-van-shop");
  if (shopEl) {
    var curPills = META.extraPills || 0;
    var pillsCapped = (curPills >= totalCount);
    var pillsCard = '<div class="van-shop-card" style="border-color:var(--green);"><div style="display:flex; justify-content:space-between; align-items:center;"><strong style="font-size:10.5px; color:var(--green);">💊 Sanity Pills (Cap: 1/Spec)</strong><span class="tier-badge t2">'+curPills+' / '+totalCount+' Packed</span></div><div style="font-size:8.5px; color:var(--dim);">1 AP: Restores +8 Sanity &amp; cures Moroi Curse (1 use/bottle, max 1 per investigator).</div><button type="button" class="btn-green" style="padding:3px 6px; font-size:9.5px;" data-action="buy-extra-pills" '+(META.cash<50||pillsCapped?'disabled':'')+'>'+(pillsCapped?'✓ Max Pills Packed ('+totalCount+'/'+totalCount+')':'+ Buy 1 Pill Bottle ($50)')+'</button></div>';

    shopEl.innerHTML = VAN_SHOP_CATALOG.map(function(v) {
      var curT = META.vanTiers[v.key] || 1;
      var curExt = (META.vanExtras && META.vanExtras[v.key]) ? META.vanExtras[v.key] : 0;
      var nextCost = curT === 1 ? v.t2Cost : v.t3Cost;
      var extCost = v.extraCost || 65;
      return '<div class="van-shop-card"><div style="display:flex; justify-content:space-between; align-items:center;"><strong style="font-size:10.5px;">'+v.name+'</strong><span class="tier-badge t'+curT+'">T'+curT+' ('+(1+curExt)+'x)</span></div><div style="font-size:8.5px; color:var(--dim);">'+(curT===1?'Standard Free Loaner':(curT===2?v.t2Desc:v.t3Desc))+'</div><div style="display:flex; gap:4px; margin-top:2px;">'+(curT<3?'<button type="button" class="btn-cyan" style="flex:1.4; padding:3px 5px; font-size:9px;" data-action="buy-van-tier" data-key="'+v.key+'" '+(META.cash<nextCost?'disabled':'')+'>⬆️ T'+(curT+1)+' ($'+nextCost+')</button>':'<span style="flex:1.4; font-size:8.5px; color:var(--purple); font-weight:700; align-self:center;">★ MAX T3</span>')+'<button type="button" class="btn-amber" style="flex:1; padding:3px 5px; font-size:9px;" data-action="buy-extra-tool" data-key="'+v.key+'" '+(META.cash<extCost||curExt>=3?'disabled':'')+'>'+(curExt>=3?'Max +3':'+1 Copy ($'+extCost+')')+'</button></div></div>';
    }).join("") + pillsCard;
  }
}

function launchFromLobby() {
  var specCount = selectedClasses.filter(function(s, i) { return s && META.unlocked[i]; }).length;
  var totalCount = specCount + selectedInternCount;
  if (totalCount < 1 || totalCount > 4) return;
  document.getElementById("lobby-modal").style.display = "none";
  var diffCfg = DIFFICULTIES[selectedDifficulty];

  if (selectedMode === "Campaign") {
    var gKeys = Object.keys(GHOST_DB), pGhost = gKeys[Math.floor(Math.random() * gKeys.length)];
    var mutCandidates = gKeys.filter(function(k) { return k !== pGhost; });
    var mGhost = mutCandidates[Math.floor(Math.random() * mutCandidates.length)];
    var extraEvs = GHOST_DB[mGhost].ev.filter(function(e) { return GHOST_DB[pGhost].ev.indexOf(e) === -1; });
    var dKeys = Object.keys(DEATH_DB);
    CAMP = {
      active:true, missionNum:1, reserveLives:diffCfg.reserveLives,
      usedClassIndices:selectedClasses.map(function(v,i){return v?i:-1;}).filter(function(i){return i!==-1;}),
      pendingSquad:null, bossPrimary:pGhost, bossMutationGhost:mGhost,
      bossExtraEv:extraEvs.length>0?extraEvs[0]:"Ghost Orbs",
      bossDeath:dKeys[Math.floor(Math.random()*dKeys.length)], cluesUnlocked:[]
    };
    startMission(null);
  } else {
    CAMP.active = false;
    startMission(null);
  }
}

function getRoomCompassSector(r) {
  var ns = r.y <= 1 ? "North" : (r.y >= 3 ? "South" : "Central");
  var ew = r.x <= 2 ? "West" : (r.x >= 4 ? "East" : "Hall");
  return ns + "-" + ew;
}

function startMission(carryoverPlayers) {
  stopHuntTurnTimer();
  undoSnapshots = {};
  var diffCfg = DIFFICULTIES[selectedDifficulty];
  var sizeKey = CAMP.active ? (CAMP.missionNum === 1 ? "Small" : (CAMP.missionNum === 2 ? "Medium" : "Large")) : selectedHouseSize;
  var sizeCfg = HOUSE_SIZES[sizeKey];
  var ghostList = Object.keys(GHOST_DB), deathList = Object.keys(DEATH_DB);
  var isBossMission = (CAMP.active && CAMP.missionNum === 3);
  var pickedGhost = isBossMission ? CAMP.bossPrimary : ghostList[Math.floor(Math.random() * ghostList.length)];
  var pickedDeath = isBossMission ? CAMP.bossDeath : deathList[Math.floor(Math.random() * deathList.length)];

  var activePlayers = [];
  if (carryoverPlayers) {
    activePlayers = carryoverPlayers;
    activePlayers.forEach(function(pl) {
      pl.isHidden = false; pl.stealthScore = 0;
      pl.holdingBreath = false; pl.breathStreak = 0; pl.breathBonusApplied = 0;
      pl.gaspNextTurn = false; pl.madeNoise = false; pl.turnEnded = false;
      pl.moroiCursed = false; pl.dogShield = (pl.baseClass === "Houndmaster");
    });
  } else {
    SPECIALIST_TEMPLATES.forEach(function(tpl, idx) {
      if (selectedClasses[idx] && META.unlocked[idx]) {
        var sLvl = META.specLevels[idx] || 1;
        var beltItem = buildTieredItem(tpl.startBelt, sLvl);
        if (beltItem.name.indexOf("Pills") !== -1 || beltItem.name.indexOf("Sedative") !== -1) beltItem.uses = 1;
        activePlayers.push({
          tplIdx:idx, baseClass:tpl.name, specLevel:sLvl, name:tpl.name, icon:tpl.icon,
          sanity:tpl.sanity, maxSanity:tpl.maxSanity,
          ap:tpl.ap, maxAp:tpl.maxAp, mp:tpl.mp, maxMp:tpl.maxMp, stealth:tpl.stealth, resolve:tpl.resolve,
          upgradeTokens:0, roomId:"r0", spirit:false, isHidden:false, stealthScore:0,
          holdingBreath:false, breathStreak:0, breathBonusApplied:0,
          gaspNextTurn:false, madeNoise:false, turnEnded:false,
          moroiCursed:false, dogShield:(tpl.name === "Houndmaster"),
          hands:[buildTieredItem(tpl.startHand, sLvl)], belt:beltItem
        });
      }
    });
    for (var i = 0; i < selectedInternCount && activePlayers.length < 4; i++) {
      var iName = selectedInternCount > 1 ? ("Intern #" + (i + 1)) : "Intern";
      activePlayers.push({
        tplIdx:-1, baseClass:"Intern", specLevel:1, name:iName, icon:INTERN_TEMPLATE.icon,
        sanity:INTERN_TEMPLATE.sanity, maxSanity:INTERN_TEMPLATE.maxSanity,
        ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:0,
        upgradeTokens:0, roomId:"r0", spirit:false, isHidden:false, stealthScore:0,
        holdingBreath:false, breathStreak:0, breathBonusApplied:0,
        gaspNextTurn:false, madeNoise:false, turnEnded:false,
        moroiCursed:false, dogShield:false,
        hands:[], belt:null
      });
    }
  }

  var suppT = META.vanTiers.supp || 1;
  var vanItems = [];
  function addVanToolCopies(key, baseObj) {
    var count = 1 + ((META.vanExtras && META.vanExtras[key]) ? META.vanExtras[key] : 0);
    for (var c = 0; c < count; c++) {
      vanItems.push(buildTieredItem(baseObj, META.vanTiers[key] || 1));
    }
  }
  addVanToolCopies("thermo", { name:"Thermometer", desc:"1 AP: Scan Freezing + 🩸 Temp Trace.", elec:true, on:true });
  addVanToolCopies("uv", { name:"UV Flashlight", desc:"1 AP: Scan Prints + 🩸 UV Trace. Stops Dark drain.", elec:true, on:true });
  addVanToolCopies("emf", { name:"EMF Reader", desc:"1 AP: Scan EMF 5 + 🩸 EMF Trace.", elec:true, on:true });
  addVanToolCopies("box", { name:"Spirit Box", desc:"1 AP (Dark): Hear Ghost voice.", elec:true, on:true });
  addVanToolCopies("cam", { name:"Night-Vision Cam", desc:"1 AP: Scan Orbs & stops Dark drain.", elec:true, on:true });
  addVanToolCopies("book", { name:"Ghost Writing Book", desc:"Drop on floor: Ghost writes silently.", elec:false, deploy:true, written:false });
  addVanToolCopies("dots", { name:"D.O.T.S. Projector", desc:"Drop on floor: Lasers reveal silhouette.", elec:true, on:true, deploy:true, triggered:false });

  var suppCount = 1 + ((META.vanExtras && META.vanExtras.supp) ? META.vanExtras.supp : 0);
  for (var sc = 0; sc < suppCount; sc++) {
    vanItems.push(buildTieredItem({ name:"Smudge Sticks", desc:"1 AP: Blinds Ghost & blocks Hunts.", elec:false, charges:2 }, suppT));
    vanItems.push(buildTieredItem({ name:"Crucifix", desc:"Drop on floor: Counts as Ward & blocks Hunts.", elec:false, charges:1 }, suppT));
    vanItems.push(buildTieredItem({ name:"Salt Pack", desc:"1 AP: Pour Salt barrier.", elec:false, charges:3 }, suppT));
  }

  var maxPillsAllowed = activePlayers.length;
  var pillsToSpawn = Math.min(maxPillsAllowed, META.extraPills || 0);
  for (var ep = 0; ep < pillsToSpawn; ep++) {
    vanItems.push({ name:"Sanity Pills", desc:"1 AP: +8 Sanity & cures Moroi Curse (1 use).", elec:false, charges:1 });
  }

  var gen = generateMultiFloorHouse(sizeKey, sizeCfg.backDoors);
  var rooms = gen.rooms.map(function(bp) {
    return {
      id:bp.id, floor:bp.floor, name:bp.name, x:bp.x, y:bp.y, zone:bp.zone, art:bp.art,
      hideMod:bp.hideMod, hideSpot:bp.hideSpot, tags:bp.tags, discovered:bp.discovered,
      openedByGhost:false,
      lit:(bp.tags.indexOf("Exterior")!==-1)?true:(bp.id==="r1"&&diffCfg.startBreaker),
      permLit:false, lightBroken:false,
      hasBackDoor:bp.hasBackDoor||false, backDoorUnlocked:bp.backDoorUnlocked||false,
      hiddenTouch:0, visibleTouch:0, salt:false, ward:false, motionSensor:false,
      lureBeacon:false, wedged:false, searched:false,
      envElecOn:false, dirtyWater:false, mirrorUsed:false,
      forensicTrace:false, traceTool:null, traceRevealed:false, traceScanned:false,
      hasHiddenAnchor:false, anchorUncovered:false,
      hasSpareKey:false, closedDoors:[], brokenDoors:[],
      neighbors:bp.neighbors, floorItems:(bp.id==="r0")?vanItems:[]
    };
  });

  var unexploredRooms = rooms.filter(function(r) { return r.tags.indexOf("Exterior") === -1 && r.id !== "r1"; });
  var fuseCandidates = unexploredRooms.filter(function(r) { return r.tags.indexOf("FuseCandidate") !== -1; });
  var fuseRoom = fuseCandidates.length > 0 ? fuseCandidates[Math.floor(Math.random() * fuseCandidates.length)] : unexploredRooms[0];
  var chosenFavRoom = unexploredRooms[Math.floor(Math.random() * unexploredRooms.length)];

  var shuffledUnexp = unexploredRooms.slice().sort(function() { return Math.random() - 0.5; });
  var toolTypes = ["UV", "EMF", "Temp"];
  for (var f = 0; f < Math.min(3, shuffledUnexp.length); f++) {
    shuffledUnexp[f].forensicTrace = true;
    shuffledUnexp[f].traceTool = toolTypes[f];
  }

  var anchorRoom = shuffledUnexp[Math.min(3, shuffledUnexp.length - 1)];
  anchorRoom.hasHiddenAnchor = true;
  var anchorType = (Math.random() < 0.50) ? "heirloom" : "corpse";

  if (Math.random() < 0.50) {
    (Math.random() < 0.5 ? rooms[1] : rooms[2]).hasSpareKey = true;
  } else {
    shuffledUnexp[0].hasSpareKey = true;
  }

  var shuffledObjs = SIDE_OBJECTIVE_POOL.slice().sort(function() { return Math.random() - 0.5; });
  var sideObjs = [
    { id:shuffledObjs[0].id, text:shuffledObjs[0].text, done:false, rewardType:"gear" },
    { id:shuffledObjs[1].id, text:shuffledObjs[1].text, done:false, rewardType:"leverage" }
  ];

  var startForensics = {};
  if (activePlayers.some(function(p) { return p.baseClass === "Archivist"; })) {
    var dTraits = DEATH_DB[pickedDeath].traits;
    startForensics[dTraits[0]] = 1;
  }

  G = {
    difficulty:selectedDifficulty, diffCfg:diffCfg, houseSize:sizeKey, sizeCfg:sizeCfg,
    archLabel:gen.archLabel, floorsPresent:gen.floorsPresent, interiorCount:gen.interiorCount,
    isBossMission:isBossMission, currentFloorView:1, round:1,
    breakerOn:diffCfg.startBreaker, breakerUpgraded:false,
    maxSafeLights:Math.max(2, sizeCfg.baseLights + (Math.floor(Math.random()*3)-1)),
    fuseRoomId:fuseRoom.id, hasBackDoorKey:false, sanityScannedThisRound:false,
    anchorType:anchorType, anchorRoomId:anchorRoom.id, tracesScannedCount:0, corpseLureActive:false,
    huntActive:false, huntTurns:0, huntSecondsRemaining:0, spiritualLeverage:false, sideObjectives:sideObjs,
    banishmentMode:false, ghostBoundRoomId:null, chainIntegrity:0,
    inspectedGhost:"Poltergeist", inspectedDeath:"Poisoned",
    lockedGhost:"Poltergeist", lockedDeath:"Poisoned", ritualStage:0, smudgeSafe:0, gameOver:false,
    secretGhost:pickedGhost, secretDeath:pickedDeath, ghostFavRoomId:chosenFavRoom.id, ghostRoomId:chosenFavRoom.id,
    ghostTrail:[], isAnimatingHunt:false, activeStepRoomId:null,
    obsessionIdx:Math.floor(Math.random() * activePlayers.length),
    foundEv:{}, foundForensics:startForensics, selectedChar:0, rooms:rooms, players:activePlayers, briefingHtml:"", logs:[]
  };

  G.briefingHtml = generateMissionBriefingHtml();
  logMsg("CONTRACT LIVE [" + G.archLabel + " — v9.8]: Unexplored doors opened by the Ghost stay hidden until you step inside! Phone Journal now includes full Ghost & Death Dossiers!", "clue");
  renderAll();
  if (!isMobileClient) showBriefingModal();
}

function formatFloorName(fl) { return fl === -1 ? "B1 Basement" : (fl === 2 ? "2F Upper" : "1F Ground"); }

function generateMissionBriefingHtml() {
  var gObj = GHOST_DB[G.secretGhost], dObj = DEATH_DB[G.secretDeath], favR = getRoom(G.ghostFavRoomId);
  var huntRumor = gObj.huntSanity >= 60 ? "Aggressive entity—hunts early at 60%–70% Sanity!" : (gObj.huntSanity <= 40 ? "Docile entity—hunts late at 35%–40% Sanity." : "Standard hunt threshold (~50%–55% Sanity).");
  var html = "";
  if (CAMP.active) {
    html += '<div style="background:rgba(213,0,249,0.12); border:1px solid var(--purple); padding:8px; border-radius:5px; margin-bottom:8px;"><strong style="color:var(--purple);">🏆 CAMPAIGN MISSION '+CAMP.missionNum+' OF 3 // LIVES: '+CAMP.reserveLives+'</strong><br>'+(CAMP.cluesUnlocked.length>0?CAMP.cluesUnlocked.join("<br>"):'Banish this spirit to earn ⭐ Upgrade Tokens and Boss Clues!')+'</div>';
  }
  html += '<div style="background:#0b0f18; border:1px solid var(--border); padding:9px; border-radius:5px;"><p>• <strong>Architecture:</strong> '+G.archLabel+' ('+G.interiorCount+' interior rooms).</p><p>• <strong>Activity Report:</strong> '+huntRumor+'</p><p>• <strong>Coroner Lead:</strong> Victim suffered <strong>['+dObj.category+']</strong> trauma. Search rooms (1 MP or 1 AP) or scan with matching tools to uncover the 3 Forensic Traces!</p><p>• <strong>Floor Lead:</strong> Sensors spiked on <strong>'+formatFloorName(favR.floor)+'</strong>.</p></div>';
  return html;
}

function showBriefingModal() {
  document.getElementById("briefing-title").textContent = "PRE-MISSION DOSSIER // " + G.archLabel.toUpperCase();
  document.getElementById("briefing-body").innerHTML = G.briefingHtml;
  document.getElementById("tab-brief-content").innerHTML = G.briefingHtml;
  document.getElementById("briefing-modal").style.display = "flex";
}

function showPostMortemModal(title) {
  stopHuntTurnTimer();
  G.gameOver = true;
  var lostGear = loseVanUpgradesOnDefeat();
  var favR = getRoom(G.ghostFavRoomId), ancR = getRoom(G.anchorRoomId);
  document.getElementById("gameover-title").textContent = title || "💀 CONTRACT POST-MORTEM REPORT";
  document.getElementById("gameover-body").innerHTML =
    '<div style="background:#0a0d14; border:1px solid var(--border); padding:12px; border-radius:6px;">' +
      (lostGear ? '<p style="color:var(--red); font-weight:800; margin-bottom:8px;">⚠️ MISSION FAILED: All brought Tier 2/Tier 3 Van Upgrades, Extra Tools &amp; Pills were lost in the house and reset to Tier 1 Loaners!</p>' : '') +
      '<p style="font-size:14px; margin-bottom:6px;"><strong>👹 True Ghost Identity:</strong> <span style="color:var(--red); font-weight:800;">'+G.secretGhost.toUpperCase()+'</span></p>' +
      '<p style="margin-bottom:6px;"><strong>📋 True Evidence:</strong> '+GHOST_DB[G.secretGhost].ev.join(", ")+'</p>' +
      '<p style="font-size:14px; margin-bottom:6px;"><strong>🩸 True Cause of Death:</strong> <span style="color:var(--amber); font-weight:800;">'+G.secretDeath.toUpperCase()+'</span></p>' +
      '<p style="margin-bottom:6px;"><strong>📍 Ghost Favorite Room:</strong> '+favR.name+' ('+formatFloorName(favR.floor)+')</p>' +
      '<p><strong>'+(G.anchorType==="corpse"?"💀 Hidden Corpse":"🏺 Hidden Heirloom")+' Location:</strong> '+ancR.name+' ('+formatFloorName(ancR.floor)+')</p>' +
    '</div>';
  document.getElementById("gameover-modal").style.display = "flex";
  renderAll();
}

/* ============================================================================
   6. PER-CHARACTER FAIR-PLAY UNDO & SIMULTANEOUS "END TURN"
============================================================================ */
function saveUndoState() {
  var cIdx = G.selectedChar || 0;
  undoSnapshots[cIdx] = JSON.stringify(G);
  var btn = document.getElementById("btn-undo");
  if (btn) btn.disabled = false;
}

function clearUndoState() {
  undoSnapshots = {};
  var btn = document.getElementById("btn-undo");
  if (btn) btn.disabled = true;
}

function performUndoForChar(cIdx) {
  var snap = undoSnapshots[cIdx];
  if (!snap) return;
  G = JSON.parse(snap);
  delete undoSnapshots[cIdx];
  logMsg("↩️ UNDO: Reverted last action and refunded MP/AP.");
  renderAll();
}

function togglePlayerEndTurnReady(cIdx) {
  var p = G.players[cIdx];
  if (!p) return;
  p.turnEnded = !p.turnEnded;
  logMsg(p.icon + " " + p.name + (p.turnEnded ? " ended their turn (✓ Ready)." : " resumed their turn."));
  var allLivingReady = G.players.filter(function(pl) { return !pl.spirit; }).every(function(pl) { return pl.turnEnded; });
  if (allLivingReady) endRoundHauntPhase();
  else renderAll();
}

/* ============================================================================
   7. CORE GAMEPLAY HELPERS, LOS FOG OF WAR & ACTIONS
============================================================================ */
function getRoom(id) { return G.rooms.find(function(r) { return r.id === id; }) || G.rooms[0]; }
function getRoomAt(fl, x, y) { return G.rooms.find(function(r) { return r.floor === fl && r.x === x && r.y === y; }) || null; }
function curPlayer() { return G.players[G.selectedChar] || G.players[0]; }

function areConnected(rA, rB) {
  if (!rA || !rB || rA.neighbors.indexOf(rB.id) === -1) return false;
  if ((rA.id === "y_back" && rB.hasBackDoor && !rB.backDoorUnlocked) || (rB.id === "y_back" && rA.hasBackDoor && !rA.backDoorUnlocked)) return false;
  return true;
}

function isDoorBrokenBetween(rA, rB) {
  return rA && rB && ((rA.brokenDoors && rA.brokenDoors.indexOf(rB.id) !== -1) || (rB.brokenDoors && rB.brokenDoors.indexOf(rA.id) !== -1));
}

function isDoorClosedBetween(rA, rB) {
  if (isDoorBrokenBetween(rA, rB)) return false;
  return rA && rB && ((rA.closedDoors && rA.closedDoors.indexOf(rB.id) !== -1) || (rB.closedDoors && rB.closedDoors.indexOf(rA.id) !== -1));
}

function canSeeExactSanity() {
  if (G.diffCfg && G.diffCfg.apScanSanity) return G.sanityScannedThisRound;
  return G.players.some(function(p) { return !p.spirit && (p.roomId === "r0" || p.baseClass === "Parapsychologist"); });
}

function getSanityStatusText(p) {
  if (canSeeExactSanity()) return p.sanity + "/" + p.maxSanity + (p.moroiCursed ? " 🩸" : "");
  var r = p.sanity / p.maxSanity;
  return r > 0.75 ? "??? (Calm)" : (r > 0.50 ? "??? (Uneasy)" : (r > 0.25 ? "??? (Rattled)" : "??? (CRITICAL)"));
}

function getTeamSanity() {
  var alive = G.players.filter(function(p) { return !p.spirit; });
  if (alive.length === 0) return 0;
  if (G.secretGhost === "Banshee") {
    var obs = G.players[G.obsessionIdx];
    if (obs && !obs.spirit) return Math.round((obs.sanity / obs.maxSanity) * 100);
  }
  return Math.round((alive.reduce(function(a, p) { return a + (p.sanity / p.maxSanity); }, 0) / alive.length) * 100);
}

function breakHidingOnAction(p) {
  if (p.isHidden) { p.isHidden = false; p.stealthScore = 0; p.holdingBreath = false; p.breathStreak = 0; p.breathBonusApplied = 0; }
}

function hasLineOfSight(rA, rB) {
  if (!rA || !rB || rA.floor !== rB.floor) return false;
  if (rA.id === rB.id) return true;
  if (rA.x !== rB.x && rA.y !== rB.y) return false;
  var dx = Math.sign(rB.x - rA.x), dy = Math.sign(rB.y - rA.y), cx = rA.x, cy = rA.y, prev = rA;
  while (cx !== rB.x || cy !== rB.y) {
    cx += dx; cy += dy;
    var next = getRoomAt(rA.floor, cx, cy);
    if (!next || !next.discovered || !areConnected(prev, next) || isDoorClosedBetween(prev, next)) return false;
    prev = next;
  }
  return true;
}

function canSquadSeeGhostInRoom(targetRoom) {
  if (!targetRoom || !G.huntActive) return false;
  if (G.ghostBoundRoomId === targetRoom.id) return true;
  if (targetRoom.motionSensor) return true;
  if (G.players.some(function(pl) { return !pl.spirit && hasLineOfSight(getRoom(pl.roomId), targetRoom); })) return true;
  var hasDots = targetRoom.floorItems.some(function(i) { return i.name.indexOf("D.O.T.S.") !== -1 && i.on; });
  if (hasDots && G.players.some(function(pl) { return pl.roomId === "r0" || (areConnected(getRoom(pl.roomId), targetRoom) && pl.hands.some(function(h){return h.name.indexOf("Cam")!==-1&&h.on;})); })) return true;
  return false;
}

function showDiceToast(text, col) {
  var el = document.getElementById("dice-toast");
  el.style.borderColor = col || "var(--cyan)"; el.innerHTML = text; el.style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(function() { el.style.display = "none"; }, 3000);
}

function logMsg(text, type) { G.logs.unshift({ text:"[R"+G.round+"] "+text, type:type||"" }); }

function completeSideObjective(objId) {
  var obj = G.sideObjectives.find(function(o) { return o.id === objId && !o.done; });
  if (!obj) return;
  obj.done = true; playSound("clue");
  if (obj.rewardType === "gear") {
    var pick = PROTOTYPE_REWARDS[Math.floor(Math.random() * PROTOTYPE_REWARDS.length)];
    getRoom("r0").floorItems.push(Object.assign({}, pick));
    showDiceToast("🎁 OBJECTIVE #1 COMPLETE! [" + pick.name + "] IN VAN!", "var(--green)");
    logMsg("🎁 OBJECTIVE #1 COMPLETE! Unlocked [" + pick.name + "] in The Van!", "clue");
  } else {
    G.spiritualLeverage = true;
    showDiceToast("⚡ OBJECTIVE #2 COMPLETE! SPIRITUAL LEVERAGE ACTIVE!", "var(--cyan)");
    logMsg("⚡ OBJECTIVE #2 COMPLETE! Spiritual Leverage (-1 Ghost Perception & +2 Severance)!", "ritual");
  }
}

function uncoverAnchorInRoom(room) {
  if (!room.hasHiddenAnchor || room.anchorUncovered) return;
  room.anchorUncovered = true;
  completeSideObjective("obj_verify");
  playSound("emf5");
  if (G.anchorType === "heirloom") {
    room.floorItems.push({
      name:"True Heirloom (Verified)", desc:"Spectral Anchor! Hold in bound room for Act II Purge.", elec:false, isRelic:true, trueRelic:true, verified:true
    });
    showDiceToast("🏺 UNCOVERED THE TARNISHED HEIRLOOM IN " + room.name.toUpperCase() + "!", "var(--green)");
    logMsg("🏺 ANCHOR UNCOVERED: Found the [True Heirloom] hidden in [" + room.name + "]! Pick it up for Act II!", "ritual");
  } else {
    showDiceToast("💀 DISCOVERED THE HIDDEN CORPSE IN " + room.name.toUpperCase() + "!", "var(--purple)");
    logMsg("💀 CORPSE UNCOVERED: Found the Victim's Remains hidden in [" + room.name + "]! Stage this room and use [🔔 Disturb Remains] during Exorcism to lure and bind the Ghost here!", "ritual");
  }
}

function inspectRoomOnEntry(room, player) {
  var rev = false;
  if (room.hiddenTouch > 0) {
    room.visibleTouch += room.hiddenTouch; room.hiddenTouch = 0; rev = true;
    logMsg("👀 Spotted disturbed objects in [" + room.name + "] (" + room.visibleTouch + " Touch Tokens)!", "haunt");
  }
  var book = room.floorItems.find(function(i) { return (i.name.indexOf("Writing") !== -1 || i.name.indexOf("Tome") !== -1) && i.written; });
  if (book && getTriStateVal(G.foundEv, "Ghost Writing") !== 1) {
    recordChallengeProgress("writing_5", 1);
    G.foundEv["Ghost Writing"] = 1; rev = true; playSound("clue");
    logMsg("📖 PHYSICAL INSPECTION: Frantic writing confirmed in [" + room.name + "]!", "clue");
  }
  var dots = room.floorItems.find(function(i) { return i.name.indexOf("D.O.T.S.") !== -1 && i.triggered; });
  if (dots && getTriStateVal(G.foundEv, "D.O.T.S.") !== 1) {
    recordChallengeProgress("orbs_dots_5", 1);
    G.foundEv["D.O.T.S."] = 1; rev = true; playSound("clue");
    logMsg("🟢 PHYSICAL INSPECTION: D.O.T.S. silhouette confirmed in [" + room.name + "]!", "clue");
  }
  if (player && !player.spirit && player.baseClass === "Detective") {
    if (room.tags.indexOf("Exterior") === -1) room.searched = true;
    if (room.hasSpareKey) {
      room.hasSpareKey = false; G.hasBackDoorKey = true; rev = true; playSound("clue");
      recordChallengeProgress("search_10", 1);
      logMsg("🕵️ DETECTIVE EYE: Automatically spotted the [🗝️ Spare Key] in [" + room.name + "]!", "clue");
    }
    if (room.forensicTrace && !room.traceRevealed) {
      room.traceRevealed = true; rev = true; playSound("clue"); completeSideObjective("obj_trace");
      recordChallengeProgress("search_10", 1);
      logMsg("🕵️ DETECTIVE EYE: Spotted a [🩸 " + room.traceTool + " Trace] in [" + room.name + "]!", "ritual");
    }
  }
  return rev;
}

function clickRoomTile(roomId) {
  if (G.gameOver || G.isAnimatingHunt) return;
  var p = curPlayer(), curR = getRoom(p.roomId), targetR = getRoom(roomId);
  if (!targetR || (!targetR.discovered && !targetR.openedByGhost) || curR.id === targetR.id) return;

  if ((curR.id === "y_back" && targetR.hasBackDoor && !targetR.backDoorUnlocked) || (targetR.id === "y_back" && curR.hasBackDoor && !curR.backDoorUnlocked)) {
    if (G.hasBackDoorKey || p.baseClass === "Detective" || p.baseClass === "Locksmith") {
      saveUndoState();
      var bR = curR.hasBackDoor ? curR : targetR;
      bR.backDoorUnlocked = true;
      recordChallengeProgress("doors_15", 1);
      logMsg("🗝️ " + p.name + " unlocked the Back Door to [" + bR.name + "]!", "clue");
      renderAll(); return;
    } else {
      logMsg("🔒 Back Door is latched! Find the 🗝️ Spare Key or bring Detective/Locksmith!");
      renderAll(); return;
    }
  }

  var bothExt = (curR.tags.indexOf("Exterior") !== -1 && targetR.tags.indexOf("Exterior") !== -1);
  var sameFlAdj = (curR.floor === targetR.floor) && (Math.abs(curR.x - targetR.x) + Math.abs(curR.y - targetR.y) === 1);
  var canMove = p.spirit ? (sameFlAdj || bothExt || areConnected(curR, targetR)) : areConnected(curR, targetR);
  if (!canMove) { logMsg("No doorway connects " + curR.name + " and " + targetR.name + "!"); renderAll(); return; }
  if (G.huntActive && (targetR.tags.indexOf("Exterior") !== -1 || curR.tags.indexOf("Exterior") !== -1) && !bothExt) {
    logMsg("⚠️ Exterior doors are LOCKED during a Hunt!", "hunt"); renderAll(); return;
  }
  if (!bothExt && p.mp < 1 && p.ap < 1) { logMsg(p.name + " has 0 Walk MP and 0 AP left!"); renderAll(); return; }

  var wasUnexplored = !targetR.discovered;
  if (wasUnexplored) {
    clearUndoState();
    targetR.discovered = true;
    targetR.openedByGhost = false;
    if (targetR.hasBackDoor) targetR.backDoorUnlocked = true;
  } else {
    saveUndoState();
  }

  var used = bothExt ? "0 AP Yard" : (p.mp >= 1 ? (p.mp -= 1, "1 Walk MP") : (p.ap -= 1, "1 AP"));
  if (!p.spirit && isDoorClosedBetween(curR, targetR)) {
    curR.closedDoors = curR.closedDoors.filter(function(id) { return id !== targetR.id; });
    targetR.closedDoors = targetR.closedDoors.filter(function(id) { return id !== curR.id; });
  }

  breakHidingOnAction(p);
  p.roomId = targetR.id; G.currentFloorView = targetR.floor;
  playSound("step");
  logMsg(p.icon + " " + p.name + (wasUnexplored ? " stepped through the creaked-open door and discovered [" : " moved to [") + targetR.name + "] (" + used + ").");

  var rev = inspectRoomOnEntry(targetR, p);
  var heldThermo = p.hands.find(function(i) { return (i.name.indexOf("Thermometer") !== -1 || i.name.indexOf("Tracker") !== -1) && i.on; });
  if (!p.spirit && heldThermo) {
    if (targetR.id === G.ghostFavRoomId) rev = true;
    runThermometerCheck(targetR, false, heldThermo);
  }
  if (rev) clearUndoState();
  renderAll();
}

function openDoorWithoutMoving(targetId) {
  if (G.gameOver || G.isAnimatingHunt) return;
  var p = curPlayer(), fromR = getRoom(p.roomId), targetR = getRoom(targetId);
  if (targetR.openedByGhost && !targetR.discovered) {
    clickRoomTile(targetId);
    return;
  }
  if (G.huntActive && fromR.tags.indexOf("Exterior") !== -1) { logMsg("⚠️ Exterior doors are LOCKED during a Hunt!"); renderAll(); return; }
  if (fromR.id === "y_back" && targetR.hasBackDoor && !targetR.backDoorUnlocked) {
    if (G.hasBackDoorKey || p.baseClass === "Detective" || p.baseClass === "Locksmith") { targetR.backDoorUnlocked = true; recordChallengeProgress("doors_15", 1); logMsg("🗝️ Unlatched Back Door!", "clue"); }
    else { logMsg("🔒 Back Door is latched! Needs 🗝️ Spare Key!"); renderAll(); return; }
  }
  if (p.ap < 1) { logMsg("⚠️ Opening a door requires 1 AP!"); renderAll(); return; }

  clearUndoState();
  p.ap -= 1;
  var mpCap = (G.huntActive && !G.banishmentMode) ? (p.baseClass === "Vlogger" ? 2 : 1) : p.maxMp;
  p.mp = Math.min(mpCap, p.mp + 1);
  breakHidingOnAction(p);
  targetR.discovered = true;
  targetR.openedByGhost = false;
  if (targetR.hasBackDoor) targetR.backDoorUnlocked = true;
  playSound("step");

  var noiseNote = "";
  if (G.huntActive && p.baseClass !== "Locksmith") { p.madeNoise = true; noiseNote = " ⚠️ MADE NOISE (🔊)!"; }
  logMsg("🚪 " + p.name + " opened [" + targetR.name + " (" + formatFloorName(targetR.floor) + ")] (+1 Free Walk MP refunded)!" + noiseNote, G.huntActive ? "hunt" : "haunt");
  renderAll();
}

function traverseStairsTo(targetId) {
  var tR = getRoom(targetId);
  if (!tR.discovered && !tR.openedByGhost) openDoorWithoutMoving(targetId);
  else clickRoomTile(targetId);
}

function searchCurrentRoom() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (p.spirit || r.id === "r0" || (p.mp < 1 && p.ap < 1)) return;
  clearUndoState(); breakHidingOnAction(p);
  var cost = p.mp >= 1 ? (p.mp -= 1, "1 Walk MP") : (p.ap -= 1, "1 AP");
  r.searched = true;
  var found = false;
  if (r.hasSpareKey) {
    r.hasSpareKey = false; G.hasBackDoorKey = true; found = true; playSound("clue");
    recordChallengeProgress("search_10", 1);
    showDiceToast("🗝️ FOUND SPARE BACK DOOR KEY!", "var(--green)");
    logMsg("🗝️ " + p.name + " found the [Spare Key] in [" + r.name + "] (" + cost + ")!", "clue");
  }
  if (r.forensicTrace && !r.traceRevealed) {
    r.traceRevealed = true; found = true; playSound("clue"); completeSideObjective("obj_trace");
    recordChallengeProgress("search_10", 1);
    logMsg("🩸 " + p.name + " uncovered a [🩸 " + r.traceTool + " Trace] in [" + r.name + "] (" + cost + ")! Scan it with a " + r.traceTool + " tool!", "ritual");
  }
  if (r.hasHiddenAnchor && !r.anchorUncovered && G.tracesScannedCount >= 2) {
    found = true;
    uncoverAnchorInRoom(r);
  }
  if (!found) logMsg("🔍 " + p.name + " searched [" + r.name + "] (" + cost + ")—nothing hidden here.");
  renderAll();
}

function verifyHeirloomResonance() {
  var p = curPlayer(), r = getRoom(p.roomId);
  var relic = p.hands.find(function(i) { return i.isRelic; }) || r.floorItems.find(function(i) { return i.isRelic; });
  if (!relic || p.ap < 1) return;
  clearUndoState(); p.ap -= 1; breakHidingOnAction(p); relic.verified = true;
  completeSideObjective("obj_verify");
  relic.name = "True Heirloom (Verified)";
  playSound("clue"); showDiceToast("🏺 TRUE ANCHOR HEIRLOOM!", "var(--green)");
  logMsg("🏺 VERIFIED: True spectral anchor!", "ritual");
  renderAll();
}

function disturbCorpseAction() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (p.spirit || p.ap < 1 || r.id !== G.anchorRoomId || !r.anchorUncovered || G.anchorType !== "corpse") return;
  clearUndoState();
  p.ap -= 1;
  breakHidingOnAction(p);
  G.corpseLureActive = true;
  if (!G.huntActive) {
    G.banishmentMode = true;
    G.huntActive = true;
    startHuntTurnTimer();
  }
  playSound("hunt");
  var path = findShortestRoomPath(G.ghostRoomId, r.id);
  var lungeSteps = Math.min(2, path.length);
  for (var s = 0; s < lungeSteps; s++) {
    G.ghostRoomId = path[s];
  }
  var gNow = getRoom(G.ghostRoomId);
  showDiceToast("🔔 REMAINS DISTURBED! THE GHOST LUNGES 2 TILES TOWARD THE CORPSE!", "var(--purple)");
  if (G.ghostRoomId === r.id) {
    logMsg("🔔💀 CORPSE LURE TRIGGERED! The Ghost lunged straight into [" + r.name + "] to guard its remains! Execute Act I (Bind) NOW!", "ritual");
  } else {
    logMsg("🔔💀 CORPSE LURE TRIGGERED! The Ghost shrieked and lunged 2 tiles closer toward [" + r.name + "] (Now on " + formatFloorName(gNow.floor) + ")!", "hunt");
  }
  renderAll();
}

function toggleCloseDoor() {
  var p = curPlayer(), r = getRoom(p.roomId);
  var cost = (p.baseClass === "Locksmith" && !p.usedFreeDoor) ? 0 : 1;
  if (p.spirit || p.ap < cost || r.tags.indexOf("Exterior") !== -1) return;
  var shutAny = false;
  r.neighbors.forEach(function(nId) {
    var nR = getRoom(nId);
    if (nR && (nR.discovered || nR.openedByGhost) && nR.tags.indexOf("Exterior") === -1 && !isDoorBrokenBetween(r, nR)) {
      if (r.closedDoors.indexOf(nId) === -1) { r.closedDoors.push(nId); shutAny = true; }
      if (nR.closedDoors.indexOf(r.id) === -1) { nR.closedDoors.push(r.id); shutAny = true; }
    }
  });
  if (!shutAny) {
    logMsg("⚠️ All doors in [" + r.name + "] are already shut or shattered off their hinges!", "haunt");
    renderAll(); return;
  }
  saveUndoState();
  p.ap -= cost;
  if (cost === 0) p.usedFreeDoor = true;
  recordChallengeProgress("doors_15", 1);
  playSound("step"); logMsg("🚪 " + p.name + " shut the intact doors to [" + r.name + "] (" + cost + " AP)!");
  renderAll();
}

function scanBiometricsAction() {
  clearUndoState();
  var p = curPlayer();
  if (!p.spirit && p.ap >= 1) {
    p.ap -= 1; G.sanityScannedThisRound = true; playSound("emf_low");
    logMsg("🖥️ BIOMETRIC SCAN: Team Sanity is at " + getTeamSanity() + "%!", "clue");
    renderAll();
  }
}

function togglePowerAction(slot) {
  saveUndoState();
  var it = curPlayer().hands[slot];
  if (it && it.elec) { it.on = !it.on; logMsg(curPlayer().name + " switched [" + it.name + "] " + (it.on ? "ON" : "OFF") + "."); renderAll(); }
}

function dropItemAction(slot) {
  saveUndoState();
  var p = curPlayer(), r = getRoom(p.roomId), dropped = p.hands.splice(slot, 1)[0];
  if (dropped) {
    r.floorItems.push(dropped);
    if (dropped.name.indexOf("Crucifix") !== -1 && r.tags.indexOf("Exterior") === -1) {
      completeSideObjective("obj_ward");
      recordChallengeProgress("wards_5", 1);
      logMsg("✝️ " + p.name + " placed [" + dropped.name + "] in [" + r.name + "] (Acts as Ward & blocks Hunts)!", "clue");
    } else {
      logMsg(p.name + " dropped [" + dropped.name + "] in " + r.name + ".");
    }
    renderAll();
  }
}

function pickFloorAction(idx) {
  saveUndoState();
  var pl = curPlayer(), rm = getRoom(pl.roomId);
  if (!pl.spirit && pl.hands.length < 2) {
    var picked = rm.floorItems.splice(idx, 1)[0];
    if (picked) { pl.hands.push(picked); logMsg(pl.name + " picked up [" + picked.name + "]."); renderAll(); }
  }
}

function useBeltAction() {
  var uP = curPlayer(), uR = getRoom(uP.roomId);
  if (!uP.belt || uP.belt.uses <= 0 || uP.ap < 1) return;
  if (uP.belt.name.indexOf("Insulated Gloves") !== -1 || uP.belt.name.indexOf("Master Lockpick") !== -1) { logMsg(uP.belt.name + " is a passive ability!"); renderAll(); return; }
  saveUndoState(); uP.ap -= 1; uP.belt.uses -= 1; breakHidingOnAction(uP);
  if (uP.belt.name.indexOf("Sanity Pills") !== -1 || uP.belt.name.indexOf("Calm Sedative") !== -1) {
    uP.sanity = Math.min(uP.maxSanity, uP.sanity + 8); uP.moroiCursed = false;
    logMsg("💊 " + uP.name + " restored +8 Sanity (and cured any Moroi curse).", "clue");
  }
  else if (uP.belt.name.indexOf("Ritual Chalk") !== -1 || uP.belt.name.indexOf("Blessed Water") !== -1) {
    uR.ward = true; completeSideObjective("obj_ward"); recordChallengeProgress("wards_5", 1);
    logMsg("✡️ Consecrated Arcane Ward in " + uR.name + "!", "ritual");
  }
  else if (uP.belt.name.indexOf("Salt") !== -1) { uR.salt = true; completeSideObjective("obj_salt"); logMsg("🧂 Poured Salt barrier in " + uR.name + "!", "clue"); }
  else if (uP.belt.name.indexOf("Work Floodlight") !== -1) { uR.lit = true; uR.permLit = true; uR.lightBroken = false; completeSideObjective("obj_ward"); logMsg("🔦 Deployed Work Floodlight in " + uR.name + " (overrides broken bulbs & breaker)!", "clue"); }
  else if (uP.belt.name.indexOf("Acoustic Decoy Buzzer") !== -1) { uR.lureBeacon = true; logMsg("🔊 Deployed Acoustic Decoy Buzzer in [" + uR.name + "]! It will lure the Ghost during Hunts!", "clue"); }
  else if (uP.belt.name.indexOf("Smudge Bundle") !== -1) { G.smudgeSafe = (G.secretGhost === "Onryo") ? 2 : 1; completeSideObjective("obj_smudge"); logMsg("🌿 Burned Smudge Bundle in [" + uR.name + "]!", "clue"); }
  else if (uP.belt.name.indexOf("Heavy Door Wedge") !== -1) {
    uR.wedged = true; toggleCloseDoor();
    logMsg("🔨 Locksmith wedged the doors to [" + uR.name + "] (-2 Ghost Speed & protects doors from shattering)!", "clue");
  }
  renderAll();
}

function flipBreakerAction() {
  var bP = curPlayer(), bR = getRoom(bP.roomId);
  if (bR.id !== G.fuseRoomId) return;
  var bCost = (bP.baseClass === "Technician") ? 0 : 1;
  if (bP.ap < bCost) return;
  saveUndoState(); bP.ap -= bCost; G.breakerOn = !G.breakerOn; breakHidingOnAction(bP);
  if (!G.breakerOn) G.rooms.forEach(function(rm) { if (rm.tags.indexOf("Exterior") === -1 && !rm.permLit) rm.lit = false; });
  recordChallengeProgress("lights_20", 1);
  recordChallengeProgress("overload_3", 1);
  playSound("breaker"); logMsg("⚡ Switched Master Breaker " + (G.breakerOn ? "ON" : "OFF") + "!", "haunt");
  renderAll();
}

function upgradeBreakerAction() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (p.baseClass !== "Electrician" || r.id !== G.fuseRoomId || G.breakerUpgraded || p.ap < 1) return;
  saveUndoState(); p.ap -= 1; G.breakerUpgraded = true; G.maxSafeLights += 2;
  recordChallengeProgress("overload_3", 1);
  playSound("clue"); showDiceToast("⚡ BREAKER REWIRED! +2 SAFE LIGHT CAPACITY!", "var(--green)");
  logMsg("⚡ ELECTRICIAN PERK: Rewired Master Breaker (+2 Max Safe Lights -> " + G.maxSafeLights + ")!", "clue");
  renderAll();
}

function wipeWardAction() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (!r.ward || p.spirit) return;
  saveUndoState(); r.ward = false;
  logMsg("🧹 " + p.name + " wiped away the Arcane Ward in [" + r.name + "] (0 AP).");
  renderAll();
}

function shutOffRoomElectronics() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (!r.envElecOn || p.spirit) return;
  saveUndoState();
  r.envElecOn = false;
  var devName = r.tags.indexOf("TV") !== -1 ? "Static TV" : "Haunted PC";
  playSound("step");
  logMsg("📺 " + p.name + " switched OFF the blaring " + devName + " in [" + r.name + "] (0 AP — Room is quiet again!).", "clue");
  renderAll();
}

function snapDirtyWaterPhoto() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (!r.dirtyWater || p.spirit) return;
  clearUndoState();
  r.dirtyWater = false;
  META.cash += 35;
  saveMetaSave();
  playSound("clue");
  showDiceToast("📸 PHOTO EVIDENCE: DIRTY WATER (+$35 CASH)!", "var(--green)");
  logMsg("📸🚰 " + p.name + " photographed the foul black sink water in [" + r.name + "] (+$35 Bonus Payout — Total: $" + META.cash + ")!", "clue");
  renderAll();
}

function gazeIntoMirrorAction() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (p.spirit || p.ap < 1 || r.tags.indexOf("Mirror") === -1 || r.mirrorUsed) return;
  clearUndoState();
  p.ap -= 1;
  r.mirrorUsed = true;
  breakHidingOnAction(p);
  p.sanity = Math.max(0, p.sanity - 6);
  var favR = getRoom(G.ghostFavRoomId);
  playSound("hunt");

  if (p.sanity <= 0 && !G.huntActive) {
    G.huntActive = true;
    G.huntTurns = G.diffCfg.baseHuntRounds;
    favR.discovered = true;
    G.ghostRoomId = favR.id;
    G.ghostTrail = [favR.id];
    startHuntTurnTimer();
    showDiceToast("🪞💥 THE MIRROR SHATTERED! CURSED HUNT INITIATED!", "var(--red)");
    logMsg("🪞💥 MIRROR SHATTERED! " + p.name + "'s Sanity hit 0 while gazing into the mirror—the Ghost manifested in [" + favR.name + "] and started a Hunt!", "hunt");
  } else {
    showDiceToast("🪞 MIRROR VISION: " + getRoomCompassSector(favR).toUpperCase() + " (" + formatFloorName(favR.floor).toUpperCase() + ")!", "var(--purple)");
    logMsg("🪞 HAUNTED MIRROR (-6 Sanity): " + p.name + " saw a chilling reflection of the [" + getRoomCompassSector(favR) + " Wing] on [" + formatFloorName(favR.floor) + "]!", "ritual");
  }
  renderAll();
}

function spiritSenseAction() {
  clearUndoState();
  var spP = curPlayer(), spR = getRoom(spP.roomId);
  if (spP.ap >= 2) {
    spP.ap -= 2;
    if (spR.forensicTrace) {
      spR.traceRevealed = true;
      checkForensicScan(spR.traceTool, spR, spP);
    } else if (spR.id === G.ghostFavRoomId || spR.id === G.ghostRoomId) {
      spR.visibleTouch += 1; playSound("clue"); logMsg("👻 SPIRIT PING: Ghost is inside " + spR.name + "!", "ritual");
    } else logMsg("👻 Spirit senses " + spR.name + " is empty.");
    renderAll();
  }
}

function checkForensicScan(toolPrefix, room, player) {
  if (!room.forensicTrace) return false;

  var isDetectiveLamp = player && player.hands.some(function(h) { return h.name.indexOf("Forensic UV Lamp") !== -1 || (h.name.indexOf("UV") !== -1 && h.tier === 3); }) && toolPrefix === "UV";
  if (room.traceTool !== toolPrefix && !isDetectiveLamp) {
    if (room.traceRevealed) {
      logMsg("🩸 TRACE MISMATCH: The uncovered trace in [" + room.name + "] requires a [" + room.traceTool + "] tool to analyze!", "haunt");
      return true;
    }
    return false;
  }

  if (!room.traceRevealed) {
    room.traceRevealed = true;
    completeSideObjective("obj_trace");
  }

  var actualPrefix = isDetectiveLamp ? room.traceTool : toolPrefix;
  var matched = DEATH_DB[G.secretDeath].traits.find(function(t) { return t.indexOf(actualPrefix + ":") === 0; });
  if (matched) G.foundForensics[matched] = 1;

  if (!room.traceScanned) {
    room.traceScanned = true;
    G.tracesScannedCount += 1;
    playSound("clue");
    var ancR = getRoom(G.anchorRoomId);
    var aTypeLbl = (G.anchorType === "corpse") ? "💀 Hidden Corpse" : "🏺 Tarnished Heirloom";

    if (G.tracesScannedCount === 1) {
      showDiceToast("🩸 TRACE 1/3: [" + matched + "] — ANCHOR ON " + formatFloorName(ancR.floor).toUpperCase() + "!", "var(--purple)");
      logMsg("🩸 FORENSIC LEAD (1/3): Confirmed [" + matched + "]! Trail indicates a [" + aTypeLbl + "] is hidden on [" + formatFloorName(ancR.floor) + "]!", "ritual");
    } else if (G.tracesScannedCount === 2) {
      var sector = getRoomCompassSector(ancR);
      showDiceToast("🩸 TRACE 2/3: [" + matched + "] — " + sector.toUpperCase() + " SECTOR!", "var(--purple)");
      logMsg("🩸 FORENSIC LEAD (2/3): Confirmed [" + matched + "]! Drag marks point to the [" + sector + " Wing] on " + formatFloorName(ancR.floor) + " (Search there or scan 3rd Trace)!", "ritual");
    } else {
      ancR.discovered = true;
      uncoverAnchorInRoom(ancR);
      logMsg("🩸 FORENSIC LEAD (3/3): Confirmed [" + matched + "] and pinpointed the [" + aTypeLbl + "] in [" + ancR.name + "]!", "ritual");
    }
  } else {
    logMsg("🩸 Trace in [" + room.name + "] already analyzed ([" + matched + "]).", "clue");
  }
  return true;
}

function getEffectiveGhostEvList() {
  var list = GHOST_DB[G.secretGhost].ev.slice();
  if (G.isBossMission && CAMP.bossExtraEv && list.indexOf(CAMP.bossExtraEv) === -1) list.push(CAMP.bossExtraEv);
  return list;
}

function canGhostGiveEvidence(evType, room, player) {
  var g = G.secretGhost, aliveInRoom = G.players.filter(function(pl) { return !pl.spirit && pl.roomId === room.id; }).length;
  if (g === "Poltergeist" && evType === "Ghost Writing" && (room.visibleTouch + room.hiddenTouch) < 2) return { ok:false, hint:"Needs 2+ Touch Tokens before Writing." };
  if (g === "Banshee" && (evType === "Ghost Orbs" || evType === "D.O.T.S.") && getRoom(G.players[G.obsessionIdx].roomId).tags.indexOf("Exterior") !== -1) return { ok:false, hint:"Obsession must be inside house." };
  if (g === "Revenant" && evType === "Freezing Temps" && room.lit) return { ok:false, hint:"Turn Lights OFF for Revenant Freezing." };
  if (g === "Jinn" && evType === "EMF Level 5" && !G.breakerOn) return { ok:false, hint:"Needs Master Breaker ON for Jinn EMF 5." };
  if (g === "Shade" && (evType === "EMF Level 5" || evType === "Ghost Writing") && aliveInRoom >= 2) return { ok:false, hint:"Shade requires being ALONE in room." };
  if (g === "Demon" && evType === "Spirit Box" && roomHasWard(room)) return { ok:false, hint:"White noise only (Ward/Crucifix present)." };
  if ((g === "Phantom" || g === "Goryo") && evType === "D.O.T.S." && aliveInRoom > 0) return { ok:false, hint:"Only triggers D.O.T.S. when room is empty!" };
  if (g === "Mare" && (evType === "Ghost Orbs" || evType === "Ghost Writing") && room.lit) return { ok:false, hint:"Mare requires Room Lights OFF." };
  if (g === "Oni" && (evType === "EMF Level 5" || evType === "Freezing Temps") && G.players.length > 1 && aliveInRoom < 2) return { ok:false, hint:"Oni requires 2+ investigators in room." };
  if (g === "Yokai" && evType === "Spirit Box" && (!player || player.hands.filter(function(i){return i.elec&&i.on;}).length < 2) && !room.permLit) return { ok:false, hint:"Yokai requires a 2nd ON electronic item!" };
  if (g === "Hantu" && evType === "Freezing Temps" && G.breakerOn && room.floor !== -1) return { ok:false, hint:"Hantu needs Breaker OFF (or B1) for Freezing." };
  if (g === "Myling" && (evType === "EMF Level 5" || evType === "Ghost Writing") && player && player.hands.filter(function(i){return i.elec&&i.on;}).length >= 2) return { ok:false, hint:"Myling requires quiet electronics (max 1 ON)!" };
  if (g === "Onryo" && evType === "Spirit Box" && (room.lit || roomHasWard(room))) return { ok:false, hint:"Onryo refuses Spirit Box near Lights, Wards, or Crucifix." };
  if (g === "Moroi" && evType === "Ghost Writing" && room.lit) return { ok:false, hint:"Moroi only writes in the dark (Lights OFF)." };
  if (g === "Phantasm" && (evType === "Ghost Orbs" || evType === "D.O.T.S.") && player && (player.sanity / player.maxSanity) < 0.50 && !room.lit && !roomHasWard(room)) return { ok:false, hint:"Static interference... Turn Room Lights ON, place Ward/Crucifix, or restore Sanity." };
  return { ok:true, hint:"" };
}

function getToolSuccessRate(item) {
  var t = (item && item.tier) ? item.tier : 1;
  if (t >= 3) return 1.0;
  return Math.min(0.98, G.diffCfg.evSuccessRate + (t === 2 ? 0.20 : 0));
}

function runThermometerCheck(room, isActiveScan, usedItem) {
  var p = curPlayer(), rate = getToolSuccessRate(usedItem);
  var traceHandled = false;
  if (isActiveScan) { clearUndoState(); traceHandled = checkForensicScan("Temp", room, p); }
  var evs = getEffectiveGhostEvList();
  if (room.id === G.ghostFavRoomId && room.discovered) {
    if (evs.indexOf("Freezing Temps") !== -1) {
      var cond = canGhostGiveEvidence("Freezing Temps", room, p);
      if (!cond.ok) logMsg("🌡️ THERMO [2°C - Ghost Room!]: " + cond.hint, "haunt");
      else if (Math.random() < (isActiveScan ? Math.max(0.9, rate) : rate)) {
        if (getTriStateVal(G.foundEv, "Freezing Temps") !== 1) recordChallengeProgress("freezing_5", 1);
        G.foundEv["Freezing Temps"] = 1; playSound("clue");
        logMsg("🌡️ THERMO [-8°C]: [Freezing Temps Confirmed] in [" + room.name + "]!", "clue");
      } else logMsg("🌡️ THERMO [2°C]: [" + room.name + "] is the Ghost Room! Scan again for Freezing.", "haunt");
    } else logMsg("🌡️ THERMO [3°C]: [" + room.name + "] is the Ghost's Favorite Room!", "clue");
  } else if (isActiveScan) {
    if (p.baseClass === "Houndmaster" && areConnected(room, getRoom(G.ghostRoomId))) {
      logMsg("🐕 SCENT TRACKER: K9 growls—the Ghost is in an ADJACENT room!", "haunt");
    } else if (!traceHandled) logMsg("🌡️ THERMO [19°C]: Normal temp in " + room.name + ".");
  }
}

function useHandItem(slotIdx) {
  var p = curPlayer(), r = getRoom(p.roomId), item = p.hands[slotIdx];
  if (!item || p.ap < 1 || G.gameOver || G.isAnimatingHunt) return;
  var evs = getEffectiveGhostEvList(), ghostHere = (r.id === G.ghostRoomId || r.id === G.ghostFavRoomId), rate = getToolSuccessRate(item);
  var isDet = (item.name.indexOf("Smudge") !== -1 || item.name.indexOf("Thurible") !== -1 || item.name.indexOf("Salt") !== -1 || item.name.indexOf("Pills") !== -1 || item.proto === "sensor" || item.proto === "flare");
  if (isDet) saveUndoState(); else clearUndoState();
  p.ap -= 1; breakHidingOnAction(p);

  if (item.proto === "defib") {
    var deadP = G.players.find(function(pl) { return pl.spirit; });
    if (!deadP) { p.ap += 1; return; }
    deadP.spirit = false; deadP.sanity = Math.round(deadP.maxSanity * 0.5); deadP.roomId = r.id; p.hands.splice(slotIdx, 1);
    playSound("clue"); logMsg("⚡ Revived " + deadP.name + " at 50% Sanity!", "clue"); renderAll(); return;
  }
  if (item.proto === "sensor") { r.motionSensor = true; if (--item.charges <= 0) p.hands.splice(slotIdx, 1); logMsg("📡 Motion Sensor deployed in [" + r.name + "]!", "clue"); renderAll(); return; }
  if (item.proto === "flare") { G.smudgeSafe = 1; p.hands.splice(slotIdx, 1); logMsg("🧨 Stun Flare blinded Ghost for 1 Round!", "clue"); renderAll(); return; }
  if (item.proto === "analyzer") {
    if (ghostHere) { var uf = evs.filter(function(e){return getTriStateVal(G.foundEv, e)!==1;}); var rev = uf.length>0?uf[0]:evs[0]; G.foundEv[rev] = 1; p.hands.splice(slotIdx,1); playSound("emf5"); logMsg("🔬 Analyzer confirmed [" + rev + "]!", "clue"); }
    renderAll(); return;
  }

  if (item.name.indexOf("Thermometer") !== -1 || item.name.indexOf("Tracker") !== -1) runThermometerCheck(r, true, item);
  else if (item.name.indexOf("EMF") !== -1) {
    var emfTraceHandled = checkForensicScan("EMF", r, p);
    var pSanRatio = p.sanity / p.maxSanity;
    if (ghostHere) {
      if (evs.indexOf("EMF Level 5") !== -1) {
        var c = canGhostGiveEvidence("EMF Level 5", r, p);
        if (!c.ok) logMsg("📟 EMF (Lvl 3): " + c.hint, "haunt");
        else if (Math.random() < rate) { G.foundEv["EMF Level 5"] = 1; playSound("emf5"); logMsg("📟 EMF LEVEL 5 confirmed in " + r.name + "!", "clue"); }
        else { playSound("emf_low"); logMsg("📟 EMF Level 3–4 in " + r.name + "! Scan again.", "haunt"); }
      } else { playSound("emf_low"); logMsg("📟 EMF Level 3 in " + r.name + "!", "haunt"); }
    } else if (G.secretGhost === "Phantasm" && pSanRatio < 0.65 && !r.lit && !roomHasWard(r) && Math.random() < 0.35) {
      playSound("emf_low"); logMsg("📟 EMF Level 3 in " + r.name + "!", "haunt");
    } else if (!emfTraceHandled) logMsg("📟 EMF 1 in " + r.name + ".");
  }
  else if (item.name.indexOf("Spirit Box") !== -1) {
    var aliveHere = G.players.filter(function(pl) { return !pl.spirit && pl.roomId === r.id; }).length;
    var boxSanRatio = p.sanity / p.maxSanity;
    var phantasmFakeVoice = (G.secretGhost === "Phantasm" && boxSanRatio < 0.65 && !roomHasWard(r));
    if (r.lit) logMsg("📻 Turn Room Lights OFF for Spirit Box!");
    else if (aliveHere > 1 && p.baseClass !== "Medium") logMsg("📻 Spirit Box requires being ALONE!");
    else if (ghostHere && (evs.indexOf("Spirit Box") !== -1 || phantasmFakeVoice)) {
      var sc = canGhostGiveEvidence("Spirit Box", r, p);
      if (!sc.ok) logMsg("📻 SPIRIT BOX: " + sc.hint);
      else if (Math.random() < rate) {
        if (getTriStateVal(G.foundEv, "Spirit Box") !== 1) recordChallengeProgress("spirit_box_5", 1);
        G.foundEv["Spirit Box"] = 1; playSound("clue");
        if (G.secretGhost === "Moroi") { p.moroiCursed = true; logMsg("📻🩸 SPIRIT BOX: '...CURSED...' [Confirmed]! (Moroi cursed " + p.name + " with extra Sanity drain until Pills!)", "hunt"); }
        else logMsg("📻 SPIRIT BOX: '...BEHIND YOU...' [Confirmed]!", "clue");
      }
      else logMsg("📻 Garbled static in " + r.name + "... Scan again!", "haunt");
    } else logMsg("📻 White noise in " + r.name + ".");
  }
  else if (item.name.indexOf("UV") !== -1) {
    var uvTraceHandled = checkForensicScan("UV", r, p);
    var tot = r.visibleTouch + r.hiddenTouch;
    if (tot > 0) {
      r.visibleTouch = tot; r.hiddenTouch = 0;
      if (evs.indexOf("UV Fingerprints") !== -1 && Math.random() < Math.min(1.0, rate + 0.15)) {
        G.foundEv["UV Fingerprints"] = 1; playSound("clue"); logMsg("🔦 UV Fingerprints confirmed in " + r.name + "!", "clue");
      } else logMsg("🔦 Checked surface in " + r.name + "—no prints yet.");
    } else if (!uvTraceHandled) logMsg("🔦 No Touch Tokens in " + r.name + ".");
  }
  else if (item.name.indexOf("Cam") !== -1) {
    var hasOrbs = (evs.indexOf("Ghost Orbs") !== -1) || (G.secretGhost === "Mimic");
    if (ghostHere && hasOrbs) {
      var oc = canGhostGiveEvidence("Ghost Orbs", r, p);
      if (!oc.ok) logMsg("📹 CAM: " + oc.hint, "haunt");
      else if (Math.random() < rate) {
        if (getTriStateVal(G.foundEv, "Ghost Orbs") !== 1) recordChallengeProgress("orbs_dots_5", 1);
        G.foundEv["Ghost Orbs"] = 1; playSound("clue"); logMsg("📹 Ghost Orbs confirmed in " + r.name + "!", "clue");
      }
      else logMsg("📹 Dust motes in " + r.name + "... Scan again.", "haunt");
    } else logMsg("📹 Clear camera feed in " + r.name + ".");
  }
  else if (item.name.indexOf("Smudge") !== -1 || item.name.indexOf("Thurible") !== -1) {
    G.smudgeSafe = (G.secretGhost === "Onryo") ? 2 : 1;
    if (--item.charges <= 0) p.hands.splice(slotIdx, 1);
    completeSideObjective("obj_smudge"); logMsg("🌿 Burned Incense in " + r.name + "! Ghost blinded (" + G.smudgeSafe + " rnd).", "clue");
  }
  else if (item.name.indexOf("Salt") !== -1) {
    r.salt = true; if (--item.charges <= 0) p.hands.splice(slotIdx, 1);
    completeSideObjective("obj_salt"); logMsg("🧂 Poured Salt barrier in " + r.name + "!", "clue");
  }
  else if (item.name.indexOf("Pills") !== -1 || item.name.indexOf("Sedative") !== -1) {
    p.sanity = Math.min(p.maxSanity, p.sanity + 8);
    p.moroiCursed = false;
    if (--item.charges <= 0) p.hands.splice(slotIdx, 1);
    playSound("clue");
    logMsg("💊 " + p.name + " took Sanity Pills (+8 Sanity & cured any Moroi curse)!", "clue");
  }
  else if (item.name.indexOf("Crucifix") !== -1) {
    p.ap += 1;
    dropItemAction(slotIdx);
    return;
  }
  renderAll();
}

function flipRoomLight() {
  var lP = curPlayer(), lR = getRoom(lP.roomId), lCost = (lP.baseClass === "Technician") ? 0 : 1;
  if (lP.ap < lCost) return;
  if (lR.lightBroken && !lR.permLit) {
    logMsg("💥💡 The light bulb in [" + lR.name + "] was shattered by the Ghost! (Requires Electrician's Work Floodlight or handheld light!)", "hunt");
    renderAll(); return;
  }
  if (!G.breakerOn && !lR.permLit) { logMsg("Click... Master Breaker is OFF!", "haunt"); renderAll(); return; }
  saveUndoState(); lP.ap -= lCost; breakHidingOnAction(lP); lR.lit = !lR.lit;
  recordChallengeProgress("lights_20", 1);
  var litCount = G.rooms.filter(function(rm) { return rm.tags.indexOf("Exterior") === -1 && rm.lit && !rm.permLit; }).length;
  if (lR.lit && litCount > G.maxSafeLights) {
    clearUndoState(); G.breakerOn = false;
    G.rooms.forEach(function(rm) { if (rm.tags.indexOf("Exterior") === -1 && !rm.permLit) rm.lit = false; });
    if (lP.baseClass !== "Electrician") lP.sanity = Math.max(0, lP.sanity - 1);
    recordChallengeProgress("overload_3", 1);
    playSound("breaker");
    showDiceToast("⚡ CIRCUIT OVERLOAD! BREAKER TRIPPED!", "var(--amber)");
    logMsg("⚡ CIRCUIT OVERLOAD! Exceeded safe load (" + G.maxSafeLights + " lights)! Breaker tripped OFF!", "hunt");
  } else logMsg("💡 Flipped [" + lR.name + "] lights " + (lR.lit ? "ON" : "OFF") + ".");
  renderAll();
}
/* ============================================================================
   8. 3-ACT EXORCISM, BINDING BACKLASH, CHAIN INTEGRITY & HUNT ANIMATOR
============================================================================ */
function triggerBanishmentHunt() {
  if (!getRoom(G.ghostFavRoomId).discovered) { logMsg("⚠️ Discover the Ghost's Favorite Room first!", "haunt"); renderAll(); return; }
  clearUndoState();
  G.lockedGhost = G.inspectedGhost; G.lockedDeath = G.inspectedDeath;
  G.banishmentMode = true; G.huntActive = true; G.ritualStage = 0; G.ghostBoundRoomId = null;
  G.players.forEach(function(pl) { pl.ap = pl.maxAp; pl.mp = pl.maxMp; });
  playSound("hunt");
  logMsg("🔥 3-ACT EXORCISM INITIATED! [" + G.lockedGhost + " // " + G.lockedDeath + "]! Full AP/MP restored!", "ritual");
  startHuntTurnTimer();
  renderAll();
}

function triggerBindingBacklash(r, p) {
  var dKey = G.lockedDeath;
  if (dKey === "Drowned" || dKey === "Frozen") {
    r.lit = false;
    logMsg("⚡💥 BINDING BACKLASH: The chained Ghost shattered the room lights OFF! Flip them back ON for Act II!", "hunt");
  } else if (dKey === "Burned") {
    if (G.breakerOn && !r.lightBroken) { r.lit = true; logMsg("💡💥 BINDING BACKLASH: Poltergeist surge flipped the room lights ON! Turn them OFF for Act II!", "hunt"); }
  } else if (dKey === "Starved" || dKey === "Crushed") {
    r.floorItems.push({ name:"Ectoplasmic Debris", desc:"Pick up to clear floor for Act II!", elec:false });
    logMsg("📦💥 BINDING BACKLASH: The thrashing Ghost hurled [Ectoplasmic Debris] onto the floor! Pick it up so the floor has 0 items for Act II!", "hunt");
  } else if (dKey === "Murdered" || dKey === "Poisoned" || dKey === "Sacrificed") {
    if (r.salt) { r.salt = false; logMsg("🧂💥 BINDING BACKLASH: The Ghost's chains burned away the Salt on the floor! Re-apply Salt/Ward for Act II!", "hunt"); }
    else if (r.ward) { r.ward = false; logMsg("✡️💥 BINDING BACKLASH: The Ghost cracked the Arcane Ward on the floor! Redraw Ward/Crucifix for Act II!", "hunt"); }
    else {
      var crux = r.floorItems.find(function(i) { return i.name.indexOf("Crucifix") !== -1; });
      if (crux) {
        crux.charges = (crux.charges || 1) - 1;
        if (crux.charges <= 0) r.floorItems = r.floorItems.filter(function(i) { return i !== crux; });
        logMsg("✝️💥 BINDING BACKLASH: The Ghost scorched a charge off the Crucifix on the floor!", "hunt");
      }
    }
  } else {
    p.sanity = Math.max(0, p.sanity - 2);
    logMsg("😱💥 BINDING BACKLASH: Psychic shockwave drained -2 Sanity from " + p.name + "!", "hunt");
  }
}

function executeExorcismAct() {
  var p = curPlayer(), r = getRoom(p.roomId);
  if (p.spirit || p.ap < 1 || !G.banishmentMode) return;
  clearUndoState(); breakHidingOnAction(p);

  if (G.ritualStage === 0) {
    if (G.anchorType === "corpse" && r.id === G.anchorRoomId && G.ghostRoomId !== r.id) {
      showDiceToast("🔔 LURE GHOST TO CORPSE ROOM FIRST!", "var(--amber)");
      logMsg("⚠️ On a Corpse contract, use [🔔 Disturb Remains] to lure the Ghost into [" + r.name + "] before binding it!", "haunt");
      renderAll(); return;
    }
    if (!GHOST_DB[G.lockedGhost].checkValid(r, p)) { showDiceToast("❌ ACT I CONDITIONS NOT MET!", "var(--red)"); renderAll(); return; }
    p.ap -= 1;
    if (G.lockedGhost !== G.secretGhost) {
      playSound("hunt"); p.sanity = Math.max(0, p.sanity - 3);
      showDiceToast("💀 WRONG GHOST TYPE!", "var(--red)"); logMsg("❌ ACT I BACKFIRED! Not a [" + G.lockedGhost + "]!", "hunt"); renderAll(); return;
    }
    if (G.secretGhost === "Phantasm" && (p.sanity / p.maxSanity) < 0.50 && !roomHasWard(r)) {
      var illRoll = Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1 + p.resolve;
      if (illRoll < 7) {
        playSound("hunt"); p.sanity = Math.max(0, p.sanity - 2);
        showDiceToast("🌀 BOUND A MIRROR ILLUSION (" + illRoll + " vs 7)!", "var(--amber)");
        logMsg("🌀 PHANTASM MIRAGE! Because " + p.name + "'s Sanity is below 50% (and no Ward/Crucifix is laid), they grabbed a laughing illusion (Rolled " + illRoll + " vs 7)! Try again, place a Ward/Crucifix, or take Sanity Pills!", "hunt");
        renderAll(); return;
      }
    }
    G.ritualStage = 1; G.ghostBoundRoomId = r.id; G.ghostRoomId = r.id;
    G.chainIntegrity = 2;
    playSound("clue");
    if (G.players.some(function(pl) { return !pl.spirit && pl.baseClass === "Exorcist" && pl.roomId === r.id; })) {
      p.ap = Math.min(p.maxAp, p.ap + 1);
      logMsg("✝️ CONSECRATED GROUND: Exorcist presence refunded +1 AP!", "clue");
    }
    showDiceToast("⛓️ ACT I COMPLETE: GHOST CHAINED (2 ROUNDS INTEGRITY)!", "var(--purple)");
    logMsg("⛓️ ACT I COMPLETE! Ghost chained in [" + r.name + "] (⛓️ 2 Rounds before chains snap)! Beware its 1-tile chain reach!", "ritual");
    triggerBindingBacklash(r, p);
    renderAll(); return;
  }

  if (G.ritualStage === 1) {
    if (r.id !== G.ghostBoundRoomId) { showDiceToast("⚠️ GO TO BOUND ROOM!", "var(--amber)"); return; }
    if (G.anchorType === "heirloom") {
      var relic = p.hands.find(function(i) { return i.isRelic; });
      if (!relic) { showDiceToast("🏺 HOLD HEIRLOOM IN HAND!", "var(--amber)"); return; }
    } else {
      if (r.id !== G.anchorRoomId || !r.anchorUncovered) { showDiceToast("💀 MUST BE IN UNCOVERED CORPSE ROOM!", "var(--amber)"); return; }
    }
    if (!DEATH_DB[G.lockedDeath].checkPurge(r, p)) { showDiceToast("❌ ACT II CONDITIONS NOT MET!", "var(--red)"); renderAll(); return; }
    p.ap -= 1;
    if (G.lockedDeath !== G.secretDeath) {
      playSound("hunt"); p.sanity = Math.max(0, p.sanity - 4);
      showDiceToast("💀 WRONG CAUSE OF DEATH!", "var(--red)"); renderAll(); return;
    }
    G.ritualStage = 2; G.chainIntegrity = 2; playSound("clue");
    if (G.players.some(function(pl) { return !pl.spirit && pl.baseClass === "Exorcist" && pl.roomId === r.id; })) {
      p.ap = Math.min(p.maxAp, p.ap + 1);
      logMsg("✝️ CONSECRATED GROUND: Exorcist presence refunded +1 AP!", "clue");
    }
    showDiceToast("🏺 ACT II COMPLETE: TRAUMA PURGED!", "var(--cyan)");
    logMsg("🏺 ACT II COMPLETE! Chains reinforced! Proceed to Act III (Final Severance)!", "ritual");
    renderAll(); return;
  }

  if (G.ritualStage === 2) {
    if (r.id !== G.ghostBoundRoomId) return;
    p.ap -= 1;
    var total = Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1 + p.resolve + (roomHasWard(r)?2:0) + (G.spiritualLeverage?2:0);
    if (total >= 7) {
      G.ritualStage = 3; G.huntActive = false; stopHuntTurnTimer(); playSound("emf5");
      handleMissionVictory();
    } else {
      showDiceToast("🎲 SEVERANCE FALTERED (" + total + " vs 7)!", "var(--amber)");
      logMsg("Act III rolled " + total + " vs 7. Try again!", "haunt");
    }
    renderAll();
  }
}

function handleMissionVictory() {
  stopHuntTurnTimer();
  recordChallengeProgress("banish_3", 1);

  var basePay = G.houseSize === "Small" ? 150 : (G.houseSize === "Medium" ? 250 : 400);
  var objBonus = G.sideObjectives.filter(function(o) { return o.done; }).length * 50;
  var totalPay = Math.round((basePay + objBonus) * (G.difficulty === "Hard" ? 1.5 : 1.0));
  META.cash += totalPay;
  saveMetaSave();

  if (!CAMP.active || CAMP.missionNum === 3) {
    G.gameOver = true;
    var msg = "🏆 VICTORY! [" + G.secretGhost.toUpperCase() + "] BANISHED! EARNED +$" + totalPay + " (TOTAL: $" + META.cash + ")!";
    showDiceToast(msg, "var(--green)"); logMsg(msg, "clue"); renderAll(); return;
  }
  if (CAMP.missionNum === 1) CAMP.cluesUnlocked.push("• <strong>M1 Clue:</strong> Boss has <strong>[" + CAMP.bossMutationGhost + " Mutation]</strong> (+<strong>[" + CAMP.bossExtraEv + "]</strong> decoy clue)!");
  else if (CAMP.missionNum === 2) CAMP.cluesUnlocked.push("• <strong>M2 Clue:</strong> Boss died from <strong>[" + DEATH_DB[CAMP.bossDeath].category + "]</strong> trauma!");

  var nextSquad = [];
  G.players.forEach(function(pl) {
    if (!pl.spirit) {
      pl.sanity = Math.min(pl.maxSanity, pl.sanity + Math.round(pl.maxSanity * 0.5));
      pl.ap = pl.maxAp; pl.mp = pl.maxMp; pl.roomId = "r0"; pl.upgradeTokens = (pl.upgradeTokens || 0) + 1;
      if (pl.tplIdx >= 0) {
        var tpl = SPECIALIST_TEMPLATES[pl.tplIdx], sLvl = META.specLevels[pl.tplIdx] || 1;
        var bIt = buildTieredItem(tpl.startBelt, sLvl);
        if (bIt.name.indexOf("Pills") !== -1 || bIt.name.indexOf("Sedative") !== -1) bIt.uses = 1;
        pl.hands = [buildTieredItem(tpl.startHand, sLvl)]; pl.belt = bIt;
      } else {
        pl.hands = []; pl.belt = null;
      }
      nextSquad.push(pl);
    } else if (CAMP.reserveLives > 0) {
      CAMP.reserveLives -= 1;
      nextSquad.push({
        tplIdx:-1, baseClass:"Intern", specLevel:1, name:"Reserve Intern", icon:INTERN_TEMPLATE.icon,
        sanity:INTERN_TEMPLATE.sanity, maxSanity:INTERN_TEMPLATE.maxSanity,
        ap:3, maxAp:3, mp:2, maxMp:2, stealth:0, resolve:0,
        upgradeTokens:0, roomId:"r0", spirit:false, isHidden:false, stealthScore:0,
        holdingBreath:false, breathStreak:0, breathBonusApplied:0,
        gaspNextTurn:false, madeNoise:false, turnEnded:false,
        hands:[], belt:null
      });
    }
  });
  CAMP.pendingSquad = nextSquad;
  renderUpgradeShop();
  document.getElementById("upgrade-modal").style.display = "flex";
}

function renderUpgradeShop() {
  document.getElementById("upgrade-list-container").innerHTML = CAMP.pendingSquad.map(function(pl, idx) {
    var hasTok = pl.upgradeTokens > 0;
    return '<div style="background:#0b0e15; border:1px solid var(--border); border-radius:6px; padding:9px; display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:var(--cyan);">'+pl.icon+' '+pl.name+' ('+pl.upgradeTokens+' ⭐)</strong><div style="font-size:10px; color:var(--dim);">San: '+pl.sanity+'/'+pl.maxSanity+' | Walk: '+pl.maxMp+' | Stealth: +'+pl.stealth+' | Resolve: +'+pl.resolve+'</div></div><div style="display:flex; gap:5px;"><button type="button" class="btn-green" data-action="buy-upg" data-idx="'+idx+'" data-upg="sanity" '+(!hasTok?'disabled':'')+'>+6 San</button><button type="button" class="btn-cyan" data-action="buy-upg" data-idx="'+idx+'" data-upg="mp" '+(!hasTok?'disabled':'')+'>+1 MP</button><button type="button" class="btn-amber" data-action="buy-upg" data-idx="'+idx+'" data-upg="stealth" '+(!hasTok?'disabled':'')+'>+2 Stealth</button><button type="button" class="btn-purple" data-action="buy-upg" data-idx="'+idx+'" data-upg="resolve" '+(!hasTok?'disabled':'')+'>+2 Resolve</button></div></div>';
  }).join("");
}

function enterHidingSpot() {
  var p = curPlayer(), r = getRoom(p.roomId), gRoom = getRoom(G.ghostRoomId);
  if (p.ap < 1 || p.spirit) return;
  clearUndoState(); p.ap -= 1;
  recordChallengeProgress("hide_10", 1);
  var d1 = Math.floor(Math.random() * 6) + 1;
  var inLoS = G.huntActive && hasLineOfSight(r, gRoom);
  var elecOn = r.envElecOn || ((p.baseClass !== "Technician") && p.hands.some(function(i) { return i.elec && i.on && !i.silentElec; }));
  p.isHidden = true; p.stealthScore = 8 + r.hideMod + p.stealth + d1;
  p.breathStreak = 0; p.breathBonusApplied = 0;
  if (d1 === 1 || inLoS || elecOn) {
    p.madeNoise = true; playSound("step");
    showDiceToast("🛡️ HIDDEN (Stealth " + p.stealthScore + ") — ⚠️ MADE NOISE (🔊)!", "var(--amber)");
    logMsg("🛡️ " + p.name + " hid in " + r.hideSpot + " (Stealth " + p.stealthScore + "), but made NOISE (🔊)!", "hunt");
  } else {
    playSound("step");
    showDiceToast("🛡️ SILENTLY HIDDEN (Stealth " + p.stealthScore + ")!", "var(--green)");
    logMsg("🛡️ " + p.name + " hid silently in " + r.hideSpot + " (Stealth " + p.stealthScore + ").", "clue");
  }
  renderAll();
}

function getNextBreathBonus(p) {
  return Math.max(0, 3 - (p.breathStreak || 0));
}

function holdBreathAction() {
  var p = curPlayer();
  var bonus = getNextBreathBonus(p);
  if (!p.isHidden || p.holdingBreath || p.ap < 1 || p.spirit || bonus <= 0) return;
  saveUndoState();
  p.ap -= 1;
  p.holdingBreath = true;
  p.gaspNextTurn = true;
  p.breathBonusApplied = bonus;
  p.stealthScore += bonus;
  p.breathStreak = (p.breathStreak || 0) + 1;
  showDiceToast("🫁 HOLDING BREATH (+" + bonus + " STEALTH -> " + p.stealthScore + ")!", "var(--cyan)");
  logMsg("🫁 " + p.name + " holds breath (+" + bonus + " Stealth -> " + p.stealthScore + "; next consecutive turn: +" + getNextBreathBonus(p) + ")!", "ritual");
  renderAll();
}

function leaveHidingAction() {
  var p = curPlayer();
  if (!p.isHidden) return;
  saveUndoState(); p.isHidden = false; p.stealthScore = 0; p.breathStreak = 0; p.breathBonusApplied = 0;
  if (p.holdingBreath) { p.holdingBreath = false; p.madeNoise = true; logMsg("🔊 " + p.name + " released braced door, making noise!", "haunt"); }
  else logMsg(p.name + " left hiding.");
  renderAll();
}

function applyProximityEventDrain(gRoom, sameRoomLoss, adjRoomLoss, eventLabel) {
  var mult = G.diffCfg.eventDrainMult;
  var sLoss = Math.round(sameRoomLoss * mult), aLoss = Math.round(adjRoomLoss * mult);
  var affectedNames = [];

  G.players.forEach(function(p) {
    if (p.spirit || getRoom(p.roomId).tags.indexOf("Exterior") !== -1) return;
    var pRoom = getRoom(p.roomId);
    var hasWardCrux = roomHasWard(pRoom) || p.hands.some(function(i) { return i.name.indexOf("Crucifix") !== -1 && (typeof i.charges !== "number" || i.charges > 0); });
    var nearPara = G.players.some(function(pl) {
      return !pl.spirit && pl.baseClass === "Parapsychologist" && (pl.roomId === p.roomId || areConnected(getRoom(pl.roomId), pRoom));
    });

    if (p.roomId === gRoom.id) {
      if (hasWardCrux) logMsg("🛡️ " + p.name + "'s Ward/Crucifix absorbed the Sanity shock in " + gRoom.name + "!");
      else {
        var finalS = Math.max(0, sLoss - (nearPara ? 1 : 0));
        if (finalS > 0) { p.sanity = Math.max(0, p.sanity - finalS); affectedNames.push(p.name + " (-" + finalS + " San)"); }
      }
    } else if (areConnected(pRoom, gRoom)) {
      var finalA = Math.max(0, aLoss - (nearPara ? 1 : 0));
      if (finalA > 0) { p.sanity = Math.max(0, p.sanity - finalA); affectedNames.push(p.name + " (-" + finalA + " San nearby)"); }
    }
  });
  if (affectedNames.length > 0) logMsg("😱 PROXIMITY SHOCK (" + eventLabel + "): " + affectedNames.join(", ") + "!", "hunt");
}

function checkGhostSearchInRoom(room, ghostData) {
  var victims = G.players.filter(function(p) { return !p.spirit && p.roomId === room.id; });
  for (var i = 0; i < victims.length; i++) {
    var v = victims[i];
    if (!v.isHidden) {
      if (room.salt && G.secretGhost !== "Wraith") { room.salt = false; logMsg("🧂 SALT saved exposed " + v.name + " in [" + room.name + "]!", "clue"); return true; }
      if (v.dogShield) { v.dogShield = false; logMsg("🐕 GUARD DOG INSTINCT: Houndmaster's K9 barked and blocked the Ghost's Claim attack in [" + room.name + "]!", "clue"); return true; }
      claimPlayer(v, room); return true;
    } else {
      var gp = Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1 + ghostData.perceptMod + G.diffCfg.perceptBonus - (G.spiritualLeverage?1:0);
      if (gp > v.stealthScore) {
        if (room.salt && G.secretGhost !== "Wraith") { room.salt = false; logMsg("🧂 Ghost spotted " + v.name + ", but SALT saved them!", "clue"); return true; }
        if (v.dogShield) { v.dogShield = false; logMsg("🐕 GUARD DOG saved " + v.name + " from being dragged out of hiding!", "clue"); return true; }
        logMsg("💀 FOUND IN HIDING! Ghost Perception (" + gp + ") > " + v.name + "'s Stealth (" + v.stealthScore + ")!", "hunt");
        claimPlayer(v, room); return true;
      } else {
        playSound("step"); logMsg("🛡️ CLOSE CALL in [" + room.name + "]! " + v.name + "'s Stealth (" + v.stealthScore + ") beat Ghost Perception (" + gp + ")!", "clue");
      }
    }
  }
  return false;
}

function findShortestRoomPath(startId, targetId) {
  if (startId === targetId) return [];
  var queue = [[startId]], visited = {};
  visited[startId] = true;
  while (queue.length > 0) {
    var path = queue.shift(), currId = path[path.length - 1], currR = getRoom(currId);
    for (var i = 0; i < currR.neighbors.length; i++) {
      var nId = currR.neighbors[i], nR = getRoom(nId);
      if (!nR || !nR.discovered || nR.tags.indexOf("Exterior") !== -1 || visited[nId]) continue;
      var newPath = path.concat([nId]);
      if (nId === targetId) return newPath.slice(1);
      visited[nId] = true;
      queue.push(newPath);
    }
  }
  return [];
}

function getEffectiveGhostHuntSteps(ghostData, isChasing, targetDist) {
  var isMicroHunt = (G.huntActive && !G.banishmentMode);
  var gRoom = getRoom(G.ghostRoomId);
  var base = ghostData.speed || 3;

  if (G.secretGhost === "Jinn" && !G.breakerOn) base = 2;
  if (G.secretGhost === "Hantu") base = (!gRoom.lit || gRoom.floor === -1) ? 4 : 2;
  if (G.secretGhost === "Moroi" && getTeamSanity() <= 30) base = 4;
  if (G.secretGhost === "Deogen" && targetDist <= 1) return 1;

  if (!isChasing && G.secretGhost !== "Deogen") {
    base = ghostData.patrolSpeed || 2;
  }
  if (isMicroHunt) {
    if (G.secretGhost === "Revenant" && !isChasing) return 1;
    return base >= 4 ? 2 : (G.round % 2 === 0 ? 2 : 1);
  }
  return base;
}

function executeGhostPreferences(gRoom, ghostData) {
  var pref = ghostData.pref || "random";
  if (pref === "random") {
    var pPool = ["breakerOff", "breakerOn", "lightsOff", "lightsBreak", "doorsClose", "doorsOpen"];
    pref = pPool[Math.floor(Math.random() * pPool.length)];
  }
  var isAngry = (getTeamSanity() <= 65);
  var mylingMuted = (G.secretGhost === "Myling") && !G.players.some(function(pl) { return pl.roomId === gRoom.id || areConnected(getRoom(pl.roomId), gRoom); });

  if (pref === "breakerOff") {
    if (G.breakerOn && Math.random() < 0.45) {
      G.breakerOn = false;
      G.rooms.forEach(function(rm) { if (rm.tags.indexOf("Exterior") === -1 && !rm.permLit) rm.lit = false; });
      playSound("breaker");
      logMsg("⚡ HAUNT HABIT: The Master Breaker was forcefully tripped OFF!", "haunt");
      applyProximityEventDrain(gRoom, 2, 1, "Breaker Cut");
      return true;
    } else if (gRoom.lit && !gRoom.permLit) {
      gRoom.lit = false;
      if (isAngry && G.secretGhost === "Mare" && Math.random() < 0.35) {
        gRoom.lightBroken = true;
        playSound("hunt");
        logMsg("💥💡 SHATTERED BULB! The entity violently shattered the light bulb in [" + gRoom.name + "]!", "hunt");
      } else {
        playSound("step");
        logMsg("💡 Click... The room light in [" + gRoom.name + "] was switched OFF!", "haunt");
      }
      applyProximityEventDrain(gRoom, 2, 0, "Darkness Surge");
      return true;
    }
  } else if (pref === "breakerOn") {
    if (!G.breakerOn && Math.random() < 0.60) {
      G.breakerOn = true;
      playSound("breaker");
      logMsg("⚡ HAUNT HABIT: The Master Breaker was mysteriously switched ON by a power surge!", "haunt");
      applyProximityEventDrain(gRoom, 2, 1, "Grid Surge");
      return true;
    } else if (G.breakerOn && !gRoom.lit && !gRoom.lightBroken && Math.random() < 0.55) {
      gRoom.lit = true;
      playSound("emf_low");
      logMsg("💡 HAUNT HABIT: The room light in [" + gRoom.name + "] flickered ON by itself!", "haunt");
      var litCount = G.rooms.filter(function(rm) { return rm.tags.indexOf("Exterior") === -1 && rm.lit && !rm.permLit; }).length;
      if (litCount > G.maxSafeLights && G.secretGhost !== "Jinn") {
        G.breakerOn = false;
        G.rooms.forEach(function(rm) { if (rm.tags.indexOf("Exterior") === -1 && !rm.permLit) rm.lit = false; });
        playSound("breaker");
        logMsg("⚡ CIRCUIT OVERLOAD! The ghost turned on too many lights and tripped the Breaker OFF!", "hunt");
      }
      return true;
    }
  } else if (pref === "lightsOff") {
    if (gRoom.lit && !gRoom.permLit && Math.random() < 0.65) {
      gRoom.lit = false;
      playSound("step");
      logMsg("💡 HAUNT HABIT: The lights in [" + gRoom.name + "] were switched OFF into darkness!", "haunt");
      applyProximityEventDrain(gRoom, 2, 0, "Lights Extinguished");
      return true;
    }
  } else if (pref === "lightsBreak") {
    if (gRoom.lit && !gRoom.permLit && isAngry && Math.random() < 0.50) {
      gRoom.lit = false;
      gRoom.lightBroken = true;
      playSound("hunt");
      logMsg("💥💡 SHATTERED BULB! The furious entity exploded the light fixture in [" + gRoom.name + "] (Switch permanently broken)!", "hunt");
      applyProximityEventDrain(gRoom, 3, 1, "Bulb Explosion");
      return true;
    } else if (gRoom.lit && !gRoom.permLit && Math.random() < 0.55) {
      gRoom.lit = false;
      playSound("step");
      logMsg("💡 HAUNT HABIT: The light switch in [" + gRoom.name + "] was slammed OFF!", "haunt");
      applyProximityEventDrain(gRoom, 2, 1, "Light Slam");
      return true;
    }
  }

  var intNeighbors = gRoom.neighbors.map(function(id) { return getRoom(id); }).filter(function(nr) { return nr && nr.tags.indexOf("Exterior") === -1; });
  if (intNeighbors.length > 0 && Math.random() < 0.55) {
    var unexpN = intNeighbors.filter(function(nr) { return !nr.discovered && !nr.openedByGhost; });
    if (unexpN.length > 0 && (pref === "doorsOpen" || Math.random() < 0.45)) {
      var openedR = unexpN[Math.floor(Math.random() * unexpN.length)];
      openedR.openedByGhost = true;
      if (openedR.hasBackDoor) openedR.backDoorUnlocked = true;
      if (!mylingMuted) playSound("step");
      logMsg("🚪👻 HAUNTED DOOR: An unexplored door on " + formatFloorName(openedR.floor) + " creaked open by itself (Room remains hidden until entered)!", "haunt");
      return true;
    }
    if (pref === "doorsClose") {
      var openN = intNeighbors.filter(function(nr) { return (nr.discovered || nr.openedByGhost) && !isDoorClosedBetween(gRoom, nr) && !isDoorBrokenBetween(gRoom, nr); });
      if (openN.length > 0) {
        var shutTarget = openN[Math.floor(Math.random() * openN.length)];
        gRoom.closedDoors.push(shutTarget.id);
        shutTarget.closedDoors.push(gRoom.id);
        if (!mylingMuted) playSound("step");
        var sName = shutTarget.discovered ? shutTarget.name : "an unexplored room";
        logMsg("🚪 HAUNT HABIT: A door connected to [" + (gRoom.discovered ? gRoom.name : formatFloorName(gRoom.floor)) + "] and [" + sName + "] slammed SHUT!", "haunt");
        applyProximityEventDrain(gRoom, 2, 1, "Door Slam");
        return true;
      }
    } else if (pref === "doorsOpen") {
      var closedN = intNeighbors.filter(function(nr) { return isDoorClosedBetween(gRoom, nr); });
      if (closedN.length > 0) {
        closedN.forEach(function(nr) {
          gRoom.closedDoors = gRoom.closedDoors.filter(function(id) { return id !== nr.id; });
          nr.closedDoors = nr.closedDoors.filter(function(id) { return id !== gRoom.id; });
        });
        playSound("step");
        logMsg("🚪 HAUNT HABIT: Closed doors on " + formatFloorName(gRoom.floor) + " were flung wide OPEN!", "haunt");
        applyProximityEventDrain(gRoom, 2, 1, "Doors Flung Open");
        return true;
      }
    }
  }
  return false;
}

function endRoundHauntPhase() {
  if (G.gameOver || G.isAnimatingHunt) return;
  stopHuntTurnTimer();
  clearUndoState();
  G.ghostTrail = [];
  G.activeStepRoomId = null;

  var isMicroHunt = (G.huntActive && !G.banishmentMode);
  G.players.forEach(function(p) {
    var r = getRoom(p.roomId);
    if (p.spirit || r.tags.indexOf("Exterior") !== -1) return;
    if (isMicroHunt) {
      p.sanity = Math.max(0, p.sanity - 1);
    } else {
      var drain = G.diffCfg.houseDrain + (p.moroiCursed ? 1 : 0);
      var hasLight = p.hands.some(function(i) { return (i.name.indexOf("UV") !== -1 || i.name.indexOf("Cam") !== -1) && i.on; });
      var holdingCrux = p.hands.some(function(i) { return i.name.indexOf("Crucifix") !== -1 && (typeof i.charges !== "number" || i.charges > 0); });
      if (!r.lit && !roomHasWard(r) && !holdingCrux && !hasLight) drain += G.diffCfg.darkDrain;
      p.sanity = Math.max(0, p.sanity - drain);
    }
    if (G.huntActive) {
      recordChallengeProgress("chase_5", 1);
      recordChallengeProgress("wards_5", 1);
      if (r.envElecOn || (p.baseClass !== "Technician" && p.hands.some(function(i) { return i.elec && i.on && !i.silentElec; }))) p.madeNoise = true;
    }
  });

  var ghostData = GHOST_DB[G.secretGhost], evs = getEffectiveGhostEvList(), favRoom = getRoom(G.ghostFavRoomId);

  if (!G.huntActive) {
    var validNeighbors = favRoom.neighbors.filter(function(id) { return getRoom(id).tags.indexOf("Exterior") === -1; });
    if (G.secretGhost === "Goryo" || Math.random() < 0.70 || validNeighbors.length === 0) G.ghostRoomId = G.ghostFavRoomId;
    else G.ghostRoomId = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];

    var gRoom = getRoom(G.ghostRoomId), rate = G.diffCfg.evSuccessRate;
    if (gRoom.motionSensor) { playSound("emf_low"); logMsg("📡 MOTION SENSOR: Ghost in [" + gRoom.name + "]!", "clue"); }
    gRoom.hiddenTouch += (G.secretGhost === "Poltergeist") ? 2 : 1;

    var book = gRoom.floorItems.find(function(i) { return i.name.indexOf("Writing") !== -1 || i.name.indexOf("Tome") !== -1; });
    var bookRate = book ? getToolSuccessRate(book) + (book.name.indexOf("Tome") !== -1 ? 0.25 : 0) : rate;
    if (book && evs.indexOf("Ghost Writing") !== -1 && canGhostGiveEvidence("Ghost Writing", gRoom, null).ok && Math.random() < bookRate) {
      book.written = true;
      if (G.players.some(function(pl) { return pl.roomId === gRoom.id; })) {
        if (getTriStateVal(G.foundEv, "Ghost Writing") !== 1) recordChallengeProgress("writing_5", 1);
        G.foundEv["Ghost Writing"] = 1; playSound("clue"); logMsg("📖 Ghost wrote in the Book in [" + gRoom.name + "]!", "clue");
      }
    }
    var dots = gRoom.floorItems.find(function(i) { return i.name.indexOf("D.O.T.S.") !== -1 && i.on; });
    var dotsRate = dots ? getToolSuccessRate(dots) : rate;
    if (dots && evs.indexOf("D.O.T.S.") !== -1 && canGhostGiveEvidence("D.O.T.S.", gRoom, null).ok && Math.random() < dotsRate) {
      dots.triggered = true;
      var someoneWatching = G.players.some(function(pl) {
        if (G.secretGhost === "Goryo") return pl.roomId === "r0" || (areConnected(getRoom(pl.roomId), gRoom) && pl.hands.some(function(h){ return h.name.indexOf("Cam") !== -1 && h.on; }));
        return pl.roomId === "r0" || hasLineOfSight(getRoom(pl.roomId), gRoom) || (areConnected(getRoom(pl.roomId), gRoom) && pl.hands.some(function(h){ return h.name.indexOf("Cam") !== -1 && h.on; }));
      });
      if (someoneWatching) {
        if (getTriStateVal(G.foundEv, "D.O.T.S.") !== 1) recordChallengeProgress("orbs_dots_5", 1);
        G.foundEv["D.O.T.S."] = 1; playSound("clue"); logMsg("🟢 D.O.T.S. silhouette spotted in [" + gRoom.name + "]!", "clue");
      }
    }

    var tvChance = (ghostData.pref === "breakerOn") ? 0.65 : 0.40;
    if ((gRoom.tags.indexOf("TV") !== -1 || gRoom.tags.indexOf("PC") !== -1) && !gRoom.envElecOn && G.breakerOn && Math.random() < tvChance) {
      gRoom.envElecOn = true;
      playSound("emf_low");
      var dLbl = gRoom.tags.indexOf("TV") !== -1 ? "TV" : "PC Monitor";
      logMsg("📺⚡ POLTERGEIST SURGE: The " + dLbl + " in [" + (gRoom.discovered ? gRoom.name : formatFloorName(gRoom.floor)) + "] turned ON by itself with loud static (🔊 Noise hazard until switched off)!", "haunt");
    }
    if ((gRoom.art === "bath" || gRoom.art === "kitchen") && !gRoom.dirtyWater && Math.random() < 0.40) {
      gRoom.dirtyWater = true;
      gRoom.visibleTouch += 1;
      playSound("step");
      logMsg("🚰 HAUNTED PLUMBING: A sink on [" + formatFloorName(gRoom.floor) + "] gurgled and filled with black, foul water! (Snap a photo for +$35!)", "haunt");
    }

    var didPrefEvent = executeGhostPreferences(gRoom, ghostData);

    if (!didPrefEvent) {
      var mylingMuted = (G.secretGhost === "Myling") && !G.players.some(function(pl) { return pl.roomId === gRoom.id || areConnected(getRoom(pl.roomId), gRoom); });
      var evRoll = Math.random();
      if (evRoll < 0.40) {
        if (!mylingMuted) { playSound("step"); logMsg("👣 HAUNT AUDIO: Cold whispers echo on " + formatFloorName(gRoom.floor) + "...", "haunt"); }
        applyProximityEventDrain(gRoom, 1, 0, "Cold Whispers");
      } else if (evRoll < 0.80) {
        if (!mylingMuted) { playSound("step"); logMsg("🔊 HAUNT AUDIO: Objects crash on " + formatFloorName(gRoom.floor) + "!", "haunt"); }
        applyProximityEventDrain(gRoom, (G.secretGhost === "Poltergeist" || G.secretGhost === "Oni") ? 3 : 2, 1, "Violent Throw");
      } else {
        playSound("hunt"); logMsg("👻 HAUNT AUDIO: Terrifying groan on " + formatFloorName(gRoom.floor) + "!", "hunt");
        applyProximityEventDrain(gRoom, 4, 2, "Full Apparition");
      }
    }

    var anyLivingInside = G.players.some(function(pl) {
      return !pl.spirit && getRoom(pl.roomId).tags.indexOf("Exterior") === -1;
    });

    if (anyLivingInside && getTeamSanity() <= ghostData.huntSanity && G.smudgeSafe <= 0) {
      var crux = gRoom.floorItems.find(function(i) { return i.name.indexOf("Crucifix") !== -1 && i.charges > 0; });
      if (crux) {
        crux.charges -= 1;
        if (crux.charges <= 0) gRoom.floorItems = gRoom.floorItems.filter(function(i) { return i !== crux; });
        playSound("clue"); logMsg("✝️ CRUCIFIX burned a charge and blocked a Hunt!", "clue");
      } else {
        G.huntActive = true; G.huntTurns = G.diffCfg.baseHuntRounds + (Math.random() < 0.5 ? 1 : 0);
        if (!gRoom.discovered) {
          var disc = G.rooms.filter(function(rm) { return rm.discovered && rm.tags.indexOf("Exterior") === -1; });
          G.ghostRoomId = disc[Math.floor(Math.random() * disc.length)].id;
        }
        G.ghostTrail = [G.ghostRoomId];
        playSound("hunt");
        logMsg("🚨 SURVIVAL HUNT INITIATED (2 AP PER TURN)! Exterior doors LOCKED! Hide or break Line of Sight!", "hunt");
      }
    }
    finalizeNextRoundStart();
    return;
  }

  if (G.ghostBoundRoomId) {
    G.ghostRoomId = G.ghostBoundRoomId;
    G.ghostTrail = [G.ghostBoundRoomId];
    var boundR = getRoom(G.ghostBoundRoomId);
    if (G.smudgeSafe <= 0) {
      checkGhostSearchInRoom(boundR, ghostData);
      boundR.neighbors.forEach(function(nId) {
        var adjR = getRoom(nId);
        if (!adjR || adjR.tags.indexOf("Exterior") !== -1 || isDoorClosedBetween(boundR, adjR)) return;
        G.players.forEach(function(pl) {
          if (!pl.spirit && pl.roomId === adjR.id && !pl.isHidden) {
            pl.roomId = boundR.id;
            pl.sanity = Math.max(0, pl.sanity - 3);
            playSound("hunt");
            logMsg("⛓️💥 CHAIN LASH! Spectral chains reached through the open doorway from [" + boundR.name + "] and dragged " + pl.name + " inside (-3 Sanity)!", "hunt");
          }
        });
      });
    }
    if (!G.huntActive) { finalizeNextRoundStart(); return; }
    G.chainIntegrity -= 1;
    if (G.chainIntegrity <= 0) {
      G.ghostBoundRoomId = null;
      G.ritualStage = 0;
      playSound("breaker");
      showDiceToast("⛓️💥 CHAINS SNAPPED! THE GHOST BROKE FREE!", "var(--red)");
      logMsg("⛓️💥 CHAIN INTEGRITY FAILED! The Ghost shattered its Act I chains and is roaming free again!", "hunt");
    } else {
      logMsg("⛓️ BOUND THRASHING: Chain Integrity at " + G.chainIntegrity + " Round(s) remaining! Hurry with Act " + (G.ritualStage + 1) + "!", "ritual");
    }
    if (G.players.every(function(p) { return p.spirit; })) { showPostMortemModal("💀 SQUAD WIPED // POST-MORTEM REPORT"); return; }
    finalizeNextRoundStart();
    return;
  }

  if (G.smudgeSafe > 0) {
    logMsg("🌿 HUNT BLINDED: Incense smoke prevents the Ghost from moving this round!", "clue");
    if (!G.banishmentMode && --G.huntTurns <= 0) {
      G.huntActive = false; stopHuntTurnTimer(); logMsg("🔓 Hunt subsided—doors unlocked.", "clue");
    }
    finalizeNextRoundStart();
    return;
  }

  var insideLiving = G.players.filter(function(p) { return !p.spirit && getRoom(p.roomId).tags.indexOf("Exterior") === -1; });
  var priority = (G.secretGhost === "Deogen") ? insideLiving.slice() : insideLiving.filter(function(p) { return !p.isHidden || p.madeNoise; });
  var lureRoom = G.rooms.find(function(rm) { return rm.lureBeacon; }) || (G.corpseLureActive ? getRoom(G.anchorRoomId) : null);

  var plannedRoomIds = [];
  var isChasing = (lureRoom !== null || priority.length > 0);
  var targetDist = 99;

  if (lureRoom) {
    var lPath = findShortestRoomPath(G.ghostRoomId, lureRoom.id);
    targetDist = lPath.length;
    var lSteps = getEffectiveGhostHuntSteps(ghostData, true, targetDist);
    plannedRoomIds = lPath.slice(0, lSteps);
  } else if (priority.length > 0) {
    priority.sort(function(a, b) {
      return findShortestRoomPath(G.ghostRoomId, a.roomId).length - findShortestRoomPath(G.ghostRoomId, b.roomId).length;
    });
    var tP = priority[0], rawPath = findShortestRoomPath(G.ghostRoomId, tP.roomId);
    targetDist = rawPath.length;
    var cSteps = getEffectiveGhostHuntSteps(ghostData, true, targetDist);
    plannedRoomIds = rawPath.slice(0, cSteps);
  } else {
    var patSteps = getEffectiveGhostHuntSteps(ghostData, false, 99);
    var simCurrId = G.ghostRoomId;
    for (var pStep = 0; pStep < patSteps; pStep++) {
      var cG = getRoom(simCurrId);
      var pat = cG.neighbors.filter(function(nId) { var nr = getRoom(nId); return nr && nr.discovered && nr.tags.indexOf("Exterior") === -1; });
      if (pat.length > 0) {
        simCurrId = pat[Math.floor(Math.random() * pat.length)];
        plannedRoomIds.push(simCurrId);
      }
    }
  }

  G.isAnimatingHunt = true;
  G.ghostTrail = [G.ghostRoomId];
  var remainingSteps = getEffectiveGhostHuntSteps(ghostData, isChasing, targetDist);
  var stepIdx = 0;

  function runNextGhostStep() {
    if (!G.huntActive || stepIdx >= plannedRoomIds.length || remainingSteps <= 0) {
      G.isAnimatingHunt = false;
      G.activeStepRoomId = null;
      if (G.huntActive && !G.banishmentMode && --G.huntTurns <= 0) {
        G.huntActive = false; stopHuntTurnTimer(); logMsg("🔓 Hunt subsided—doors unlocked.", "clue");
      }
      if (G.players.every(function(p) { return p.spirit; })) {
        showPostMortemModal("💀 SQUAD WIPED // POST-MORTEM REPORT");
        return;
      }
      finalizeNextRoundStart();
      return;
    }

    var fromR = getRoom(G.ghostRoomId);
    var nextR = getRoom(plannedRoomIds[stepIdx]);
    stepIdx++;

    if (isDoorClosedBetween(fromR, nextR)) {
      fromR.closedDoors = fromR.closedDoors.filter(function(id) { return id !== nextR.id; });
      nextR.closedDoors = nextR.closedDoors.filter(function(id) { return id !== fromR.id; });
      var wasWedged = (fromR.wedged || nextR.wedged);
      var smashCost = wasWedged ? 2 : 1;
      fromR.wedged = false; nextR.wedged = false;
      remainingSteps -= smashCost;
      playSound("breaker");

      var breakChance = (G.secretGhost === "Oni" || G.secretGhost === "Demon") ? 0.75 : 0.40;
      if (!wasWedged && Math.random() < breakChance) {
        if (!fromR.brokenDoors) fromR.brokenDoors = [];
        if (!nextR.brokenDoors) nextR.brokenDoors = [];
        if (fromR.brokenDoors.indexOf(nextR.id) === -1) fromR.brokenDoors.push(nextR.id);
        if (nextR.brokenDoors.indexOf(fromR.id) === -1) nextR.brokenDoors.push(fromR.id);
        showDiceToast("🚪💥 DOOR SPLINTERED OFF ITS HINGES!", "var(--red)");
        logMsg("🚪💥 The Hunting Ghost shattered the door between [" + fromR.name + "] and [" + nextR.name + "] off its hinges (-" + smashCost + " Speed — Door permanently broken)!", "hunt");
      } else {
        logMsg("🚪💥 The Hunting Ghost smashed open the closed door (-" + smashCost + " Ghost Speed)!", "hunt");
      }
      renderAll();
      if (remainingSteps <= 0) {
        setTimeout(runNextGhostStep, 420);
        return;
      }
    }

    G.ghostRoomId = nextR.id;
    G.activeStepRoomId = nextR.id;
    if (G.ghostTrail.indexOf(nextR.id) === -1) G.ghostTrail.push(nextR.id);
    remainingSteps -= 1;

    if (nextR.lureBeacon) {
      nextR.lureBeacon = false;
      logMsg("🐕🔊 ACOUSTIC DECOY CRUSHED! The Ghost was lured into [" + nextR.name + "] and smashed the decoy buzzer!", "clue");
    }
    if (G.corpseLureActive && nextR.id === G.anchorRoomId) {
      G.corpseLureActive = false;
      logMsg("💀🔔 CORPSE LURE COMPLETE: The Ghost has arrived at its remains in [" + nextR.name + "]!", "ritual");
    }

    playSound("step");
    var visibleNow = canSquadSeeGhostInRoom(nextR);
    var mediumNear = G.players.some(function(pl) { return pl.baseClass === "Medium" && (pl.roomId === nextR.id || areConnected(getRoom(pl.roomId), nextR)); });
    if (visibleNow) {
      G.currentFloorView = nextR.floor;
      logMsg("🚨 SPOTTED (STEP " + G.ghostTrail.length + "): The Ghost is visible in [" + nextR.name + "]!", "hunt");
    } else if (mediumNear) {
      logMsg("🔮 MEDIUM SENSE (STEP " + G.ghostTrail.length + "): Footsteps stalk into [" + nextR.name + "]!", "haunt");
    } else if (G.secretGhost !== "Myling") {
      logMsg("👣 AUDIO CUE (STEP " + G.ghostTrail.length + "): Heavy footsteps echo on " + formatFloorName(nextR.floor) + " (" + getRoomCompassSector(nextR) + ")...", "haunt");
    }

    renderAll();
    var attackedSomeone = checkGhostSearchInRoom(nextR, ghostData);
    renderAll();

    if (attackedSomeone) {
      G.isAnimatingHunt = false;
      G.activeStepRoomId = null;
      if (G.huntActive && !G.banishmentMode && --G.huntTurns <= 0) {
        G.huntActive = false; stopHuntTurnTimer(); logMsg("🔓 Hunt subsided—doors unlocked.", "clue");
      }
      if (G.players.every(function(p) { return p.spirit; })) {
        showPostMortemModal("💀 SQUAD WIPED // POST-MORTEM REPORT");
        return;
      }
      finalizeNextRoundStart();
      return;
    }

    setTimeout(runNextGhostStep, 420);
  }

  if (plannedRoomIds.length === 0) {
    checkGhostSearchInRoom(getRoom(G.ghostRoomId), ghostData);
    G.isAnimatingHunt = false;
    if (G.players.every(function(p) { return p.spirit; })) {
      showPostMortemModal("💀 SQUAD WIPED // POST-MORTEM REPORT");
      return;
    }
    finalizeNextRoundStart();
  } else {
    setTimeout(runNextGhostStep, 300);
  }
}

function finalizeNextRoundStart() {
  if (G.smudgeSafe > 0) G.smudgeSafe -= 1;
  G.sanityScannedThisRound = false;
  G.round += 1;

  var isMicroHunt = (G.huntActive && !G.banishmentMode);
  G.players.forEach(function(p) {
    p.ap = isMicroHunt ? 2 : p.maxAp;
    p.mp = isMicroHunt ? (p.baseClass === "Vlogger" ? 1 : 0) : p.maxMp;
    p.madeNoise = false; p.turnEnded = false; p.usedFreeDoor = false;
    if (p.holdingBreath) {
      p.holdingBreath = false;
      p.stealthScore = Math.max(8, p.stealthScore - (p.breathBonusApplied || 3));
      p.breathBonusApplied = 0;
    } else {
      p.breathStreak = 0;
    }
    if (p.gaspNextTurn) {
      p.gaspNextTurn = false;
      if (p.isHidden && G.huntActive) { p.madeNoise = true; logMsg("😮‍💨 GASP FOR AIR! " + p.name + " gasped loudly (🔊 Noise)!", "hunt"); }
    }
  });

  if (G.huntActive && !G.gameOver) startHuntTurnTimer();
  else stopHuntTurnTimer();
  renderAll();
}

function claimPlayer(victim, room) {
  victim.spirit = true; victim.isHidden = false; victim.stealthScore = 0; victim.breathStreak = 0;
  victim.hands.forEach(function(it) { room.floorItems.push(it); }); victim.hands = [];
  playSound("hunt"); showDiceToast("💀 " + victim.name.toUpperCase() + " CLAIMED!", "var(--red)");
  logMsg("💀 " + victim.name + " was CLAIMED in [" + room.name + "]!", "hunt");

  var anyLivingInside = G.players.some(function(pl) {
    return !pl.spirit && getRoom(pl.roomId).tags.indexOf("Exterior") === -1;
  });
  var anyLivingTotal = G.players.some(function(pl) { return !pl.spirit; });

  if (!anyLivingInside && anyLivingTotal && G.huntActive) {
    G.huntActive = false;
    G.banishmentMode = false;
    G.ritualStage = 0;
    G.ghostBoundRoomId = null;
    G.chainIntegrity = 0;
    G.huntTurns = 0;
    stopHuntTurnTimer();
    showDiceToast("🩸 HOUSE WIPED! HUNT ENDED & RITUAL RESET TO STAGE 0!", "var(--amber)");
    logMsg("🩸 HOUSE CLEARED: All investigators inside the house were claimed! The Ghost's hunt subsides, exterior doors UNLOCK, and Exorcism resets to Stage 0!", "hunt");
  }
}

/* ============================================================================
   9. RENDERING: BIG SCREEN TV HOST + MOBILE P.D.A. CONTROLLER
============================================================================ */
function getFloorItemShortBadge(item) {
  var n = item.name;
  if (n.indexOf("Thermometer") !== -1 || n.indexOf("Tracker") !== -1) return "🌡️ Thermo";
  if (n.indexOf("EMF") !== -1) return "📟 EMF";
  if (n.indexOf("UV") !== -1) return "🔦 UV";
  if (n.indexOf("Spirit Box") !== -1) return "📻 Box";
  if (n.indexOf("Cam") !== -1) return "📹 Cam";
  if (n.indexOf("Writing") !== -1 || n.indexOf("Tome") !== -1) return "📖 Book" + (item.written ? "✍️" : "");
  if (n.indexOf("D.O.T.S.") !== -1) return "🟢 DOTS";
  if (n.indexOf("Crucifix") !== -1) return "✝️ Crux(" + (item.charges || 0) + ")";
  if (n.indexOf("Smudge") !== -1 || n.indexOf("Thurible") !== -1) return "🌿 Smudge";
  if (n.indexOf("Salt") !== -1) return "🧂 Salt";
  if (n.indexOf("Pills") !== -1 || n.indexOf("Sedative") !== -1) return "💊 Pills";
  if (item.isRelic) return "🏺 Heirloom";
  return "📦 " + n.split(" ")[0];
}

function buildRoomBadgesHtml(room, isExt, trailIdx) {
  var badges = "";
  if (trailIdx !== -1) badges += '<span class="r-badge trail-badge">👣 Step ' + (trailIdx + 1) + '</span>';
  if (room.searched && !isExt) badges += '<span class="r-badge" style="color:var(--green); border-color:var(--green);">🔍✓</span>';
  if (room.lightBroken && !room.permLit) badges += '<span class="r-badge" style="color:var(--red); border-color:var(--red);">💥💡</span>';
  if (room.tags.indexOf("Stairs") !== -1) badges += '<span class="r-badge" style="color:var(--cyan);">🪜 Stairs</span>';
  if (room.tags.indexOf("Mirror") !== -1) badges += '<span class="r-badge">'+(room.mirrorUsed?'🪞💥':'🪞 Mirror')+'</span>';
  if (room.envElecOn) badges += '<span class="r-badge" style="color:var(--red); border-color:var(--red);">📺 ON🔊</span>';
  if (room.dirtyWater) badges += '<span class="r-badge" style="color:var(--amber); border-color:var(--amber);">🚰 Water</span>';
  if (room.hasBackDoor) badges += '<span class="r-badge" style="color:var(--purple);">'+(room.backDoorUnlocked?'🚪 Back':'🔒 Latch')+'</span>';
  if (room.id === G.fuseRoomId) badges += '<span class="r-badge" style="color:var(--amber);">⚡ Breaker</span>';
  if (room.forensicTrace && room.traceRevealed) badges += '<span class="r-badge" style="color:var(--red);">'+(room.traceScanned?'✓ ':'🩸 ')+room.traceTool+'</span>';
  if (room.anchorUncovered && G.anchorType === "corpse") badges += '<span class="r-badge" style="color:var(--purple);">💀 Corpse</span>';
  if (room.lureBeacon) badges += '<span class="r-badge" style="color:var(--amber);">🔊 Lure</span>';
  if (room.visibleTouch > 0) badges += '<span class="r-badge" style="color:var(--green);">🖐️ '+room.visibleTouch+'</span>';
  if (room.salt) badges += '<span class="r-badge">🧂</span>';
  if (room.ward) badges += '<span class="r-badge">✡️</span>';
  if (room.id === "r0" && room.floorItems.length > 0) {
    badges += '<span class="r-badge">📦 ' + room.floorItems.length + ' Gear</span>';
  } else if (room.floorItems.length > 0) {
    room.floorItems.forEach(function(fi) {
      var col = fi.isRelic ? "var(--purple)" : (fi.name.indexOf("Crucifix") !== -1 ? "var(--amber)" : "var(--cyan)");
      badges += '<span class="r-badge" style="color:' + col + ';">' + getFloorItemShortBadge(fi) + '</span>';
    });
  }
  return badges;
}

function getDoorNotchClass(room, adj) {
  if (!adj || room.neighbors.indexOf(adj.id) === -1) return "";
  if (isDoorBrokenBetween(room, adj)) return "broken-door";
  if (isDoorClosedBetween(room, adj)) return "closed-door";
  if (!adj.discovered && adj.openedByGhost) return "conn";
  return !adj.discovered ? "unexp" : "conn";
}

function renderAll() {
  if (!G.players || G.players.length === 0) return;
  ensureLobbyDomUpgraded();
  if (isMobileClient) { renderMobileController(); return; }
  broadcastStateToPhones();

  var p = curPlayer(), curR = getRoom(p.roomId), exactSan = canSeeExactSanity();
  document.getElementById("campaign-badge").textContent = CAMP.active ? ("CAMPAIGN M" + CAMP.missionNum + "/3 (LIVES: " + CAMP.reserveLives + ")") : ("💵 $" + META.cash);
  document.getElementById("hud-diff").textContent = G.difficulty.toUpperCase() + " (" + G.interiorCount + "R)";
  document.getElementById("hud-round").textContent = "ROUND " + G.round;
  document.getElementById("hud-sanity").textContent = exactSan ? ("SANITY: " + getTeamSanity() + "%") : "SANITY: ??? (VAN)";
  var litCount = G.rooms.filter(function(rm) { return rm.tags.indexOf("Exterior") === -1 && rm.lit && !rm.permLit; }).length;
  var techKnowsLoad = G.players.some(function(pl) { return (pl.baseClass === "Technician" || pl.baseClass === "Electrician") && pl.roomId === G.fuseRoomId; }) || G.breakerUpgraded;
  document.getElementById("hud-breaker").textContent = "BREAKER: " + (G.breakerOn ? "ON (" + litCount + "/" + (techKnowsLoad ? G.maxSafeLights : "~" + G.sizeCfg.baseLights) + "💡)" : "OFF");
  document.getElementById("hud-key").textContent = "KEY: " + (G.hasBackDoorKey ? "🗝️ FOUND" : "🔒 NONE");
  document.getElementById("deck-count-label").textContent = G.rooms.filter(function(r) { return !r.discovered; }).length + " Unexplored";

  var phaseEl = document.getElementById("hud-phase");
  phaseEl.textContent = G.huntActive ? (G.banishmentMode ? "🔥 EXORCISM ACT " + (G.ritualStage + 1) + "/3" + (G.ghostBoundRoomId ? " (⛓️" + G.chainIntegrity + "R)" : "") : "🚨 HUNT (2 AP)") : "INVESTIGATION";
  phaseEl.className = G.huntActive ? "hud-pill hunt" : "hud-pill";

  document.getElementById("floor-tabs-container").innerHTML = G.floorsPresent.map(function(fl) {
    var inv = G.players.filter(function(pl) { return getRoom(pl.roomId).floor === fl; }).length;
    return '<button type="button" class="floor-btn '+(G.currentFloorView===fl?'active':'')+'" data-action="switch-floor" data-floor="'+fl+'">'+formatFloorName(fl)+' ('+inv+')</button>';
  }).join("");

  document.getElementById("squad-list").innerHTML = G.players.map(function(pl, idx) {
    var r = getRoom(pl.roomId), pct = exactSan ? Math.round((pl.sanity / pl.maxSanity) * 100) : 100;
    var apPips = "", mpPips = "";
    for (var i = 0; i < pl.maxAp; i++) apPips += '<span class="ap-pip '+(i<pl.ap?'full':'')+'"></span>';
    for (var m = 0; m < pl.maxMp; m++) mpPips += '<span class="mp-pip '+(m<pl.mp?'full':'')+'"></span>';
    var tags = pl.hands.map(function(h) { return '<span class="mini-tag '+(h.on?'on':'')+'">'+h.name+'</span>'; }).join("");
    if (pl.isHidden) tags += '<span class="mini-tag on">🛡️ Hidden ('+pl.stealthScore+')</span>';
    if (pl.madeNoise) tags += '<span class="mini-tag noise">🔊 Noise!</span>';
    if (pl.dogShield) tags += '<span class="mini-tag on">🐕 K9 Guard</span>';
    if (pl.turnEnded) tags += '<span class="mini-tag on">✓ Ready</span>';
    return '<div class="hero-card '+(idx===G.selectedChar?'active':'')+' '+(pl.spirit?'spirit':'')+'" data-action="select-char" data-idx="'+idx+'"><div class="hero-top"><span class="hero-name">['+(idx+1)+'] '+pl.icon+' '+pl.name+'</span><span style="font-size:10px; color:var(--amber);">'+(r.floor===-1?'B1':r.floor+'F')+'</span></div><div class="pips-row"><span>Walk: '+mpPips+'</span><span>AP: '+apPips+'</span></div><div class="bar-wrap"><div class="bar-fill" style="width:'+pct+'%;"></div></div><div class="hero-meta"><span>San: '+getSanityStatusText(pl)+'</span><span>📍 '+r.name+'</span></div><div class="hero-gear-mini">'+tags+'</div></div>';
  }).join("");

  document.getElementById("side-obj-box").innerHTML = '<div style="font-weight:700; color:var(--cyan);">📋 SIDE OBJECTIVES (' + G.tracesScannedCount + '/3 Traces):</div>' +
    G.sideObjectives.map(function(so, i) { return '<div class="obj-item '+(so.done?'done':'')+'">'+(so.done?'✓ ':'☐ ')+'#'+(i+1)+': '+so.text+'</div>'; }).join("");

  var cellsHtml = "", fView = G.currentFloorView;
  for (var y = 0; y < 5; y++) {
    for (var x = 0; x < 7; x++) {
      var room = getRoomAt(fView, x, y);
      if (room && room.discovered) {
        var isCur = (room.id === curR.id), isExt = (room.tags.indexOf("Exterior") !== -1);
        var roomVisibleToSquad = canSquadSeeGhostInRoom(room);
        var showGhost = (G.huntActive && G.ghostRoomId === room.id && roomVisibleToSquad);
        var isBound = (G.ghostBoundRoomId === room.id);
        var trailIdx = roomVisibleToSquad ? (G.ghostTrail || []).indexOf(room.id) : -1;
        var isSteppingNow = (G.activeStepRoomId === room.id && roomVisibleToSquad);
        var pawns = G.players.filter(function(pl) { return pl.roomId === room.id; });
        var nR = getRoomAt(fView, x, y-1), sR = getRoomAt(fView, x, y+1), eR = getRoomAt(fView, x+1, y), wR = getRoomAt(fView, x-1, y);
        var badges = buildRoomBadgesHtml(room, isExt, trailIdx);
        var floorTooltip = room.floorItems.length > 0 ? ("Floor Items: " + room.floorItems.map(function(i){return i.name;}).join(", ")) : (room.searched ? "Searched (Empty floor)" : "Unsearched");
        var pawnsHtml = pawns.map(function(pw) { return '<span class="pawn '+(pw.name===p.name?'active-pawn ':'')+(pw.isHidden?'hidden-pawn ':'')+(pw.spirit?'spirit-pawn':'')+'">'+pw.icon+'</span>'; }).join("");
        if (showGhost) pawnsHtml += '<span class="pawn ghost-pawn">'+(isBound?'⛓️':'👹')+'</span>';

        var huntVisualCls = isBound ? 'ghost-bound' : (isSteppingNow ? 'ghost-stepping-now' : (showGhost ? 'ghost-room-hunt' : (trailIdx !== -1 ? 'ghost-trail-tile' : '')));
        cellsHtml += '<div class="grid-cell"><div class="room-node '+room.zone+' '+(!room.lit&&!isExt?'dark ':'')+(isCur?'active-room ':'')+huntVisualCls+'" title="'+floorTooltip+'" data-action="move-room" data-room="'+room.id+'">'+getRoomArtSVG(room.art)+(getDoorNotchClass(room,nR)?'<div class="door-notch door-N '+getDoorNotchClass(room,nR)+'"></div>':'')+(getDoorNotchClass(room,sR)?'<div class="door-notch door-S '+getDoorNotchClass(room,sR)+'"></div>':'')+(getDoorNotchClass(room,eR)?'<div class="door-notch door-E '+getDoorNotchClass(room,eR)+'"></div>':'')+(getDoorNotchClass(room,wR)?'<div class="door-notch door-W '+getDoorNotchClass(room,wR)+'"></div>':'')+'<div><div class="r-title"><span>'+room.name+'</span><span>'+(isExt?'🌲':(room.lightBroken&&!room.permLit?'💥':(room.lit?'💡':'🌑')))+'</span></div><div class="r-sub">'+(isExt?'0 AP Safe':room.hideSpot+' (+'+room.hideMod+')')+'</div><div class="r-badges">'+badges+'</div></div><div class="r-tokens">'+pawnsHtml+'</div></div></div>';
      } else if (room && !room.discovered && curR.neighbors.indexOf(room.id) !== -1 && !p.spirit) {
        if (room.openedByGhost) {
          cellsHtml += '<div class="grid-cell explore-slot" style="border-color:var(--green); color:var(--green);" data-action="move-room" data-room="'+room.id+'"><span>🚪👻 CREAKED OPEN!</span><span style="font-size:9px; color:#fff;">??? (Unexplored)</span><span style="font-size:8px;">Walk In ('+(p.mp>=1?'1 MP':'1 AP')+')</span></div>';
        } else {
          cellsHtml += '<div class="grid-cell explore-slot" data-action="open-door" data-room="'+room.id+'"><span>🚪 + OPEN DOOR</span><span style="font-size:9px; color:#fff;">'+room.name+'</span><span style="font-size:8px;">1 AP (+1 Walk MP!)</span></div>';
        }
      } else cellsHtml += '<div class="grid-cell empty"></div>';
    }
  }
  document.getElementById("board-grid").innerHTML = cellsHtml;
  renderBottomDock(p, curR);
  renderRightTabs();
}

function renderBottomDock(p, r) {
  var handEl = document.getElementById("hand-area"), ctxEl = document.getElementById("room-context-area"), isExt = (r.tags.indexOf("Exterior") !== -1);
  if (p.spirit) {
    handEl.innerHTML = '<div class="gear-card" style="width:240px; border-color:var(--purple);"><div class="gc-title" style="color:var(--purple);">👻 HELPER SPIRIT</div><button type="button" class="btn-purple" data-action="spirit-sense" '+(p.ap<2?'disabled':'')+'>Sense Aura / Forensics (2 AP)</button></div>';
  } else {
    var html = "";
    for (var i = 0; i < 2; i++) {
      var it = p.hands[i];
      if (it) {
        html += '<div class="gear-card '+(it.isRelic?'relic-card ':'')+(it.elec&&it.on?'active-elec':'')+'"><div><div class="gc-title">'+it.name+(typeof it.charges==="number"?' ('+it.charges+')':'')+'</div><div class="gc-desc">'+it.desc+'</div></div><div class="gc-btns">'+(!it.deploy&&!it.isRelic?'<button type="button" class="btn-cyan" data-action="use-hand" data-slot="'+i+'" '+(p.ap<1?'disabled':'')+'>Scan / Use (1 AP)</button>':'')+'<div style="display:flex; gap:4px;">'+(it.elec?'<button type="button" style="flex:1;" data-action="toggle-power" data-slot="'+i+'">'+(it.on?'🟢 ON':'⚫ OFF')+'</button>':'')+'<button type="button" style="flex:1;" data-action="drop-item" data-slot="'+i+'">⬇️ Drop</button></div></div></div>';
      } else html += '<div class="gear-card empty-slot">Empty Hand Slot '+(i+1)+'</div>';
    }
    if (p.belt) html += '<div class="gear-card belt-card"><div><div class="gc-title" style="color:var(--amber);">Belt: '+p.belt.name+'</div><div class="gc-desc">'+p.belt.desc+'</div></div><button type="button" data-action="use-belt" '+(p.ap<1||p.belt.uses<=0?'disabled':'')+'>Use ('+p.belt.uses+')</button></div>';
    handEl.innerHTML = html;
  }

  var floorBtns = r.floorItems.map(function(fi, idx) { return '<button type="button" data-action="pick-floor" data-idx="'+idx+'" '+(p.hands.length>=2||p.spirit?'disabled':'')+'>⬆️ '+fi.name+(typeof fi.charges==="number"?' ('+fi.charges+')':'')+'</button>'; }).join("") || '<span style="font-size:10px; color:var(--dim);">Empty floor</span>';
  var stairBtns = "";
  r.neighbors.forEach(function(nId) {
    var nR = getRoom(nId);
    if (nR && nR.floor !== r.floor) stairBtns += '<button type="button" class="btn-cyan" data-action="use-stairs" data-target="'+nR.id+'">🪜 '+(nR.discovered?nR.name:(nR.openedByGhost?'Step into '+formatFloorName(nR.floor):'Open '+formatFloorName(nR.floor)+' (1 AP)'))+'</button>';
  });

  var hideBtns = "";
  if (!isExt && !p.spirit) {
    if (!p.isHidden) hideBtns += '<button type="button" class="btn-red" data-action="enter-hide" '+(p.ap<1?'disabled':'')+'>🎲 Hide: '+r.hideSpot+' (+'+r.hideMod+')</button>';
    else {
      var nb = getNextBreathBonus(p);
      hideBtns += '<button type="button" class="btn-cyan" data-action="hold-breath" '+(p.ap<1||p.holdingBreath||nb<=0?'disabled':'')+'>🫁 Hold Breath (+'+nb+')</button><button type="button" data-action="leave-hide">🚶 Leave Hide</button>';
    }
  }

  var envBtns = "";
  if (!p.spirit && r.envElecOn) envBtns += '<button type="button" class="btn-amber" data-action="kill-env-elec">📺 Kill TV/PC (0 AP)</button>';
  if (!p.spirit && r.dirtyWater) envBtns += '<button type="button" class="btn-green" data-action="photo-water">📸 Photo Water (+$35, 0 AP)</button>';
  if (!p.spirit && r.tags.indexOf("Mirror") !== -1 && !r.mirrorUsed && !G.huntActive) {
    envBtns += '<button type="button" class="btn-purple" data-action="gaze-mirror" '+(p.ap<1?'disabled':'')+'>🪞 Gaze Mirror (1 AP, -6 San)</button>';
  }

  var canDisturbCorpse = !p.spirit && G.anchorType === "corpse" && r.id === G.anchorRoomId && r.anchorUncovered && !G.ghostBoundRoomId;
  var canSearch = !p.spirit && r.id !== "r0" && (p.mp >= 1 || p.ap >= 1);
  var searchLbl = (r.searched ? "🔍 Searched ✓ (" : "🔍 Search (") + (p.mp >= 1 ? "1 MP)" : "1 AP)");
  var actLbl = G.ritualStage === 0 ? "⛓️ Act I: Bind" : (G.ritualStage === 1 ? "🏺 Act II: Purge" : "✨ Act III: Sever");

  ctxEl.innerHTML = '<div><div style="font-weight:700; font-size:11px; color:var(--cyan); margin-bottom:4px;">📍 '+r.name+' ('+formatFloorName(r.floor)+')'+(roomHasWard(r)?' <span style="color:var(--amber);">[✡️ Warded]</span>':'')+'</div><div style="display:flex; flex-wrap:wrap; gap:4px;">'+stairBtns+(!p.spirit&&r.id!=="r0"?'<button type="button" class="'+(r.searched?'':'btn-green')+'" data-action="search-room" '+(!canSearch?'disabled':'')+'>'+searchLbl+'</button>':'')+envBtns+(canDisturbCorpse?'<button type="button" class="btn-purple" data-action="disturb-corpse" '+(p.ap<1?'disabled':'')+'>🔔 Disturb Remains (Lure 2 Tiles)</button>':'')+(!isExt?'<button type="button" data-action="flip-light">'+(r.lightBroken&&!r.permLit?'💥 Bulb Broken':'💡 Light')+'</button><button type="button" data-action="close-door">🚪 Shut Doors</button>':'')+(r.id===G.fuseRoomId?'<button type="button" data-action="flip-breaker">⚡ Breaker</button>':'')+(r.id===G.fuseRoomId&&p.baseClass==="Electrician"&&!G.breakerUpgraded?'<button type="button" class="btn-green" data-action="upgrade-breaker" '+(p.ap<1?'disabled':'')+'>🔧 Rewire (+2💡)</button>':'')+(r.ward&&!p.spirit?'<button type="button" data-action="wipe-ward">🧹 Wipe Ward</button>':'')+hideBtns+(G.banishmentMode&&!p.spirit&&G.ritualStage<3?'<button type="button" class="btn-purple" data-action="ritual-chant" '+(p.ap<1?'disabled':'')+'>'+actLbl+'</button>':'')+'</div></div><div style="border-top:1px solid var(--border); padding-top:4px;"><div style="display:flex; flex-wrap:wrap; gap:4px;">'+floorBtns+'</div></div>';
}

function renderRightTabs() {
  document.getElementById("ev-grid").innerHTML = EVIDENCE_TYPES.map(function(ev) {
    var st = getTriStateVal(G.foundEv, ev);
    var cls = st === 1 ? "found" : (st === -1 ? "ruled-out" : "");
    var icon = st === 1 ? "☑ " : (st === -1 ? "❌ " : "☐ ");
    return '<button type="button" class="ev-toggle '+cls+'" data-action="toggle-ev" data-ev="'+ev+'">'+icon+ev+'</button>';
  }).join("");

  var posEvs = EVIDENCE_TYPES.filter(function(e) { return getTriStateVal(G.foundEv, e) === 1; });
  var negEvs = EVIDENCE_TYPES.filter(function(e) { return getTriStateVal(G.foundEv, e) === -1; });

  document.getElementById("suspect-list").innerHTML = Object.keys(GHOST_DB).map(function(g) {
    var gEvs = GHOST_DB[g].ev;
    var hasAllPos = posEvs.every(function(e) { return gEvs.indexOf(e) !== -1 || (g === "Mimic" && e === "Ghost Orbs") || (g === "Phantasm" && e === "Spirit Box"); });
    var hasNoNeg = negEvs.every(function(e) { return gEvs.indexOf(e) === -1; });
    var m = hasAllPos && hasNoNeg;
    return '<div class="suspect '+(m?'':'ruled-out ')+(G.inspectedGhost===g?'inspected':'')+'" data-action="inspect-ghost" data-ghost="'+g+'">'+g+'</div>';
  }).join("");

  var gObj = GHOST_DB[G.inspectedGhost || "Poltergeist"];
  document.getElementById("ghost-dossier").innerHTML = '<strong>📖 '+G.inspectedGhost.toUpperCase()+'</strong> (Hunts &le;'+gObj.huntSanity+'% | Percept +'+gObj.perceptMod+' | Speed '+gObj.speed+')<br>'+gObj.ev.map(function(e){
    var st = getTriStateVal(G.foundEv, e);
    var pCls = st === 1 ? "matched" : (st === -1 ? "ruled-out" : "");
    return '<span class="dossier-ev-pill '+pCls+'">'+e+'</span>';
  }).join("")+'<br><strong>Behavior:</strong> '+gObj.behavior+'<br><strong>Clue Rule:</strong> '+gObj.evParamText+'<br><strong style="color:var(--purple);">Act I Bind:</strong> '+gObj.ritualText;

  document.getElementById("forensic-ev-grid").innerHTML = FORENSIC_TRAITS.map(function(ft) {
    var st = getTriStateVal(G.foundForensics, ft);
    var cls = st === 1 ? "found" : (st === -1 ? "ruled-out" : "");
    var icon = st === 1 ? "☑ " : (st === -1 ? "❌ " : "☐ ");
    return '<button type="button" class="ev-toggle '+cls+'" data-action="toggle-forensic" data-ft="'+ft+'">'+icon+ft+'</button>';
  }).join("");

  var posFt = FORENSIC_TRAITS.filter(function(t) { return getTriStateVal(G.foundForensics, t) === 1; });
  var negFt = FORENSIC_TRAITS.filter(function(t) { return getTriStateVal(G.foundForensics, t) === -1; });

  document.getElementById("death-suspect-list").innerHTML = Object.keys(DEATH_DB).map(function(d) {
    var dTr = DEATH_DB[d].traits;
    var m = posFt.every(function(t) { return dTr.indexOf(t) !== -1; }) && negFt.every(function(t) { return dTr.indexOf(t) === -1; });
    return '<div class="suspect '+(m?'':'ruled-out ')+(G.inspectedDeath===d?'inspected':'')+'" data-action="inspect-death" data-death="'+d+'">'+d+'</div>';
  }).join("");

  var dObj = DEATH_DB[G.inspectedDeath || "Poisoned"];
  var ancHint = G.tracesScannedCount === 0 ? "Scan 🩸 Traces to identify Anchor (Heirloom vs Corpse)" : (G.anchorType === "corpse" ? "💀 Corpse (Lure Ghost to Body Room!)" : "🏺 Heirloom (Carry to Bound Room!)");
  document.getElementById("death-dossier").innerHTML = '<strong>🩸 '+G.inspectedDeath.toUpperCase()+'</strong> ('+ancHint+')<br>'+dObj.traits.map(function(t){
    var st = getTriStateVal(G.foundForensics, t);
    var pCls = st === 1 ? "matched" : (st === -1 ? "ruled-out" : "");
    return '<span class="dossier-ev-pill '+pCls+'">'+t+'</span>';
  }).join("")+'<br><strong style="color:var(--cyan);">Act II Purge:</strong> '+dObj.purgeText;

  var gT = G.banishmentMode ? G.lockedGhost : G.inspectedGhost, dT = G.banishmentMode ? G.lockedDeath : G.inspectedDeath;
  document.getElementById("exorcism-acts-container").innerHTML =
    '<div class="act-box '+(G.ritualStage>=1?'done':'')+'"><strong>1️⃣ ACT I (BIND '+gT.toUpperCase()+'):</strong> '+GHOST_DB[gT].ritualText+'</div>' +
    '<div class="act-box '+(G.ritualStage>=2?'done':'')+'"><strong>2️⃣ ACT II (PURGE '+dT.toUpperCase()+'):</strong> '+DEATH_DB[dT].purgeText+'</div>' +
    '<div class="act-box '+(G.ritualStage>=3?'done':'')+'"><strong>3️⃣ ACT III (SEVERANCE):</strong> Roll 2d6 + Resolve &ge; 7 in bound room!</div>';

  document.getElementById("log-feed").innerHTML = G.logs.slice(0, 35).map(function(l) { return '<div class="log-item '+l.type+'">'+l.text+'</div>'; }).join("");
}

/* ============================================================================
   10. MOBILE PHONE P.D.A. CONTROLLER RENDERER (3x3 RADAR + FULL DOSSIERS)
============================================================================ */
function renderMobileRoomTileHtml(room, curR, p) {
  if (!room) return '<div class="m-map-cell empty"></div>';
  var isCur = (room.id === curR.id);
  var isConnectedToCur = (curR.neighbors.indexOf(room.id) !== -1);

  if (!isCur && !isConnectedToCur) {
    return '<div class="m-map-cell empty"></div>';
  }

  if (!room.discovered) {
    if (room.openedByGhost) {
      return '<div class="m-map-cell grid-cell explore-slot" style="width:100%; height:98px; border-color:var(--green); color:var(--green);" data-m-cmd="move-room" data-room="'+room.id+'"><span>🚪👻 CREAKED OPEN!</span><span style="font-size:9px; color:#fff;">??? (Unexplored)</span><span style="font-size:8px;">Walk In ('+(p.mp>=1?'1 MP':'1 AP')+')</span></div>';
    }
    return '<div class="m-map-cell grid-cell explore-slot" style="width:100%; height:98px;" data-m-cmd="open-door" data-room="'+room.id+'"><span>🚪 + OPEN DOOR</span><span style="font-size:9px; color:#fff;">'+room.name+'</span><span style="font-size:8px;">1 AP (+1 MP!)</span></div>';
  }

  var isExt = (room.tags.indexOf("Exterior") !== -1);
  var roomVisibleToSquad = canSquadSeeGhostInRoom(room);
  var showGhost = (G.huntActive && G.ghostRoomId === room.id && roomVisibleToSquad);
  var isBound = (G.ghostBoundRoomId === room.id);
  var trailIdx = roomVisibleToSquad ? (G.ghostTrail || []).indexOf(room.id) : -1;
  var pawns = G.players.filter(function(pl) { return pl.roomId === room.id; });
  var badges = buildRoomBadgesHtml(room, isExt, trailIdx);
  var pawnsHtml = pawns.map(function(pw) { return '<span class="pawn '+(pw.name===p.name?'active-pawn ':'')+(pw.isHidden?'hidden-pawn ':'')+(pw.spirit?'spirit-pawn':'')+'">'+pw.icon+'</span>'; }).join("");
  if (showGhost) pawnsHtml += '<span class="pawn ghost-pawn">'+(isBound?'⛓️':'👹')+'</span>';

  var nR = getRoomAt(room.floor, room.x, room.y-1), sR = getRoomAt(room.floor, room.x, room.y+1), eR = getRoomAt(room.floor, room.x+1, room.y), wR = getRoomAt(room.floor, room.x-1, room.y);
  var huntVisualCls = isBound ? 'ghost-bound' : (showGhost ? 'ghost-room-hunt' : (trailIdx !== -1 ? 'ghost-trail-tile' : ''));
  var cmdAttr = isCur ? '' : 'data-m-cmd="move-room" data-room="'+room.id+'"';
  var moveHint = isCur ? '<span style="color:var(--cyan); font-weight:800;">[YOU]</span> ' : '🏃 ';

  return '<div class="m-map-cell"><div class="room-node '+room.zone+' '+(!room.lit&&!isExt?'dark ':'')+(isCur?'active-room ':'')+huntVisualCls+'" '+cmdAttr+'>'+getRoomArtSVG(room.art)+(getDoorNotchClass(room,nR)?'<div class="door-notch door-N '+getDoorNotchClass(room,nR)+'"></div>':'')+(getDoorNotchClass(room,sR)?'<div class="door-notch door-S '+getDoorNotchClass(room,sR)+'"></div>':'')+(getDoorNotchClass(room,eR)?'<div class="door-notch door-E '+getDoorNotchClass(room,eR)+'"></div>':'')+(getDoorNotchClass(room,wR)?'<div class="door-notch door-W '+getDoorNotchClass(room,wR)+'"></div>':'')+'<div><div class="r-title"><span>'+moveHint+room.name+'</span><span>'+(isExt?'🌲':(room.lightBroken&&!room.permLit?'💥':(room.lit?'💡':'🌑')))+'</span></div><div class="r-sub">'+(isExt?'0 AP Safe':room.hideSpot+' (+'+room.hideMod+')')+'</div><div class="r-badges">'+badges+'</div></div><div class="r-tokens">'+pawnsHtml+'</div></div></div>';
}

function renderMobileController() {
  if (!G || !G.players || G.players.length === 0) return;
  if (mobileCharIdx >= G.players.length) mobileCharIdx = 0;
  G.selectedChar = mobileCharIdx;
  var p = curPlayer(), r = getRoom(p.roomId), isExt = (r.tags.indexOf("Exterior") !== -1);

  document.getElementById("m-char-bar").innerHTML = G.players.map(function(pl, idx) {
    return '<button type="button" class="m-char-pill '+(idx===mobileCharIdx?'active':'')+'" data-m-action="m-select-char" data-idx="'+idx+'">'+pl.icon+' '+pl.name+' ('+pl.mp+'MP/'+pl.ap+'AP)'+(pl.turnEnded?' ✓':'')+'</button>';
  }).join("");

  document.getElementById("m-loc-label").textContent = "📍 " + r.name + " (" + formatFloorName(r.floor) + ") " + (r.lit ? "💡" : "🌑");
  document.getElementById("m-san-label").textContent = "San: " + getSanityStatusText(p);
  var tBadge = document.getElementById("m-timer-badge");
  if (G.huntActive) { tBadge.style.display = "inline"; tBadge.textContent = "🚨 HUNT: " + (G.huntSecondsRemaining || 12) + "s"; }
  else tBadge.style.display = "none";

  var mpHtml = "", apHtml = "";
  for (var m = 0; m < p.maxMp; m++) mpHtml += '<span class="mp-pip '+(m<p.mp?'full':'')+'"></span>';
  for (var a = 0; a < p.maxAp; a++) apHtml += '<span class="ap-pip '+(a<p.ap?'full':'')+'"></span>';
  document.getElementById("m-mp-pips").innerHTML = mpHtml + " (" + p.mp + "/" + p.maxMp + ")";
  document.getElementById("m-ap-pips").innerHTML = apHtml + " (" + p.ap + "/" + p.maxAp + ")";

  var endBtn = document.getElementById("btn-m-end-turn");
  endBtn.textContent = p.turnEnded ? "⏳ WAITING (TAP TO UNREADY)" : "✓ END TURN";
  endBtn.className = p.turnEnded ? "btn-amber" : "btn-green";

  var rmN = getRoomAt(r.floor, r.x, r.y - 1);
  var rmS = getRoomAt(r.floor, r.x, r.y + 1);
  var rmW = getRoomAt(r.floor, r.x - 1, r.y);
  var rmE = getRoomAt(r.floor, r.x + 1, r.y);

  var cardIds = [r.id, rmN?rmN.id:"", rmS?rmS.id:"", rmW?rmW.id:"", rmE?rmE.id:""];
  var extraNeighbors = r.neighbors.map(function(id){ return getRoom(id); }).filter(function(nr){ return nr && cardIds.indexOf(nr.id) === -1; });
  var cornerTL = extraNeighbors[0] || null;
  var cornerTR = extraNeighbors[1] || null;

  var localGridHtml =
    '<div class="m-local-map-grid">' +
      renderMobileRoomTileHtml(cornerTL, r, p) +
      renderMobileRoomTileHtml(rmN, r, p) +
      renderMobileRoomTileHtml(cornerTR, r, p) +
      renderMobileRoomTileHtml(rmW, r, p) +
      renderMobileRoomTileHtml(r, r, p) +
      renderMobileRoomTileHtml(rmE, r, p) +
      '<div class="m-map-cell empty"></div>' +
      renderMobileRoomTileHtml(rmS, r, p) +
      '<div class="m-map-cell empty"></div>' +
    '</div>';

  var roomActBtns = "";
  if (!p.spirit && r.id !== "r0") {
    var canS = (p.mp >= 1 || p.ap >= 1);
    roomActBtns += '<button type="button" class="'+(r.searched?'':'btn-green')+'" data-m-cmd="search-room" '+(!canS?'disabled':'')+'>'+(r.searched?'🔍 Searched ✓':'🔍 Search')+' ('+(p.mp>=1?'1 Walk MP':'1 AP')+')</button>';
  }
  if (!p.spirit && r.envElecOn) roomActBtns += '<button type="button" class="btn-amber" data-m-cmd="kill-env-elec">📺 Kill TV/PC (0 AP)</button>';
  if (!p.spirit && r.dirtyWater) roomActBtns += '<button type="button" class="btn-green" data-m-cmd="photo-water">📸 Photo Water (+$35, 0 AP)</button>';
  if (!p.spirit && r.tags.indexOf("Mirror") !== -1 && !r.mirrorUsed && !G.huntActive) {
    roomActBtns += '<button type="button" class="btn-purple" data-m-cmd="gaze-mirror" '+(p.ap<1?'disabled':'')+'>🪞 Gaze Mirror (1 AP, -6 San)</button>';
  }
  if (!p.spirit && G.anchorType === "corpse" && r.id === G.anchorRoomId && r.anchorUncovered && !G.ghostBoundRoomId) {
    roomActBtns += '<button type="button" class="btn-purple" data-m-cmd="disturb-corpse" '+(p.ap<1?'disabled':'')+'>🔔 Disturb Remains (Lure 2 Tiles)</button>';
  }
  if (!isExt) {
    roomActBtns += '<button type="button" data-m-cmd="flip-light">'+(r.lightBroken&&!r.permLit?'💥 Bulb Broken':'💡 Light Switch')+'</button>';
    roomActBtns += '<button type="button" data-m-cmd="close-door">🚪 Shut Doors</button>';
    if (!p.isHidden) roomActBtns += '<button type="button" class="btn-red" data-m-cmd="enter-hide" '+(p.ap<1?'disabled':'')+'>🎲 Hide: '+r.hideSpot+' (+'+r.hideMod+')</button>';
    else {
      var mNb = getNextBreathBonus(p);
      roomActBtns += '<button type="button" class="btn-cyan" data-m-cmd="hold-breath" '+(p.ap<1||p.holdingBreath||mNb<=0?'disabled':'')+'>🫁 Hold Breath (+'+mNb+')</button><button type="button" data-m-cmd="leave-hide">🚶 Leave Hiding</button>';
    }
  }
  if (r.id === G.fuseRoomId) {
    roomActBtns += '<button type="button" class="btn-amber" data-m-cmd="flip-breaker">⚡ Master Breaker</button>';
    if (p.baseClass === "Electrician" && !G.breakerUpgraded) roomActBtns += '<button type="button" class="btn-green" data-m-cmd="upgrade-breaker" '+(p.ap<1?'disabled':'')+'>🔧 Rewire Breaker (+2💡)</button>';
  }
  if (r.ward && !p.spirit) roomActBtns += '<button type="button" data-m-cmd="wipe-ward">🧹 Wipe Ward (0 AP)</button>';
  if (G.banishmentMode && !p.spirit && G.ritualStage < 3) {
    roomActBtns += '<button type="button" class="btn-purple" data-m-cmd="ritual-chant" '+(p.ap<1?'disabled':'')+'>✨ Execute Exorcism Act '+(G.ritualStage+1)+'/3 (1 AP)</button>';
  }

  var gearHtml = p.hands.map(function(it, sIdx) {
    return '<div style="background:#0b0f18; border:1px solid var(--border); padding:8px; border-radius:6px; margin-bottom:6px;"><div style="display:flex; justify-content:space-between; font-weight:700;"><span>'+it.name+(typeof it.charges==="number"?' ('+it.charges+')':'')+'</span><span style="color:var(--dim); font-size:10px;">'+(it.elec?(it.on?'🟢 ON':'⚫ OFF'):'')+'</span></div><div style="font-size:10px; color:var(--dim); margin:3px 0;">'+it.desc+'</div><div style="display:flex; gap:5px; margin-top:5px;">'+(!it.deploy&&!it.isRelic?'<button type="button" class="btn-cyan" style="flex:1;" data-m-cmd="use-hand" data-slot="'+sIdx+'" '+(p.ap<1?'disabled':'')+'>Scan / Use (1 AP)</button>':'')+(it.elec?'<button type="button" data-m-cmd="toggle-power" data-slot="'+sIdx+'">'+(it.on?'Turn OFF':'Turn ON')+'</button>':'')+'<button type="button" data-m-cmd="drop-item" data-slot="'+sIdx+'">⬇️ Drop</button></div></div>';
  }).join("") || '<div style="color:var(--dim); font-size:11px; margin-bottom:6px;">No items in hands.</div>';

  if (p.belt) {
    gearHtml += '<button type="button" class="btn-amber" style="width:100%; padding:8px;" data-m-cmd="use-belt" '+(p.ap<1||p.belt.uses<=0?'disabled':'')+'>Belt: '+p.belt.name+' ('+p.belt.uses+' uses left) [1 AP]</button>';
  }

  var floorHtml = r.floorItems.map(function(fi, fIdx) {
    return '<button type="button" data-m-cmd="pick-floor" data-idx="'+fIdx+'" '+(p.hands.length>=2?'disabled':'')+'>⬆️ Pick Up '+fi.name+(typeof fi.charges==="number"?' ('+fi.charges+')':'')+' (0 AP)</button>';
  }).join(" ");

  document.getElementById("m-tab-actions").innerHTML =
    '<div class="m-section"><div class="m-sec-title">1. LOCAL ROOM RADAR (TAP ADJACENT TILE TO MOVE / OPEN)</div>'+localGridHtml+'</div>' +
    '<div class="m-section"><div class="m-sec-title">2. ROOM & STEALTH ACTIONS</div><div class="m-btn-grid">'+roomActBtns+'</div></div>' +
    '<div class="m-section"><div class="m-sec-title">3. HANDHELD GEAR & FLOOR ITEMS</div>'+gearHtml+'<div style="margin-top:6px; display:flex; gap:5px; flex-wrap:wrap;">'+floorHtml+'</div></div>';

  var posEvs = EVIDENCE_TYPES.filter(function(e) { return getTriStateVal(G.foundEv, e) === 1; });
  var negEvs = EVIDENCE_TYPES.filter(function(e) { return getTriStateVal(G.foundEv, e) === -1; });
  var gObj = GHOST_DB[G.inspectedGhost || "Poltergeist"];
  var mGhostDossierHtml =
    '<div class="dossier-box" style="margin-top:8px;">' +
      '<strong>📖 '+G.inspectedGhost.toUpperCase()+'</strong> (Hunts &le;'+gObj.huntSanity+'% | Percept +'+gObj.perceptMod+' | Speed '+gObj.speed+')<br>' +
      gObj.ev.map(function(e){
        var st = getTriStateVal(G.foundEv, e);
        var pCls = st === 1 ? "matched" : (st === -1 ? "ruled-out" : "");
        return '<span class="dossier-ev-pill '+pCls+'">'+e+'</span>';
      }).join("") +
      '<br><strong>Behavior:</strong> '+gObj.behavior +
      '<br><strong>Clue Rule:</strong> '+gObj.evParamText +
      '<br><strong style="color:var(--purple);">Act I Bind:</strong> '+gObj.ritualText +
    '</div>';

  var posFt = FORENSIC_TRAITS.filter(function(t) { return getTriStateVal(G.foundForensics, t) === 1; });
  var negFt = FORENSIC_TRAITS.filter(function(t) { return getTriStateVal(G.foundForensics, t) === -1; });
  var dObj = DEATH_DB[G.inspectedDeath || "Poisoned"];
  var ancHint = G.tracesScannedCount === 0 ? "Scan 🩸 Traces to identify Anchor (Heirloom vs Corpse)" : (G.anchorType === "corpse" ? "💀 Corpse (Lure Ghost to Body Room!)" : "🏺 Heirloom (Carry to Bound Room!)");
  var mDeathDossierHtml =
    '<div class="dossier-box" style="border-left-color:var(--amber); margin-top:8px;">' +
      '<strong>🩸 '+G.inspectedDeath.toUpperCase()+'</strong> ('+ancHint+')<br>' +
      dObj.traits.map(function(t){
        var st = getTriStateVal(G.foundForensics, t);
        var pCls = st === 1 ? "matched" : (st === -1 ? "ruled-out" : "");
        return '<span class="dossier-ev-pill '+pCls+'">'+t+'</span>';
      }).join("") +
      '<br><strong style="color:var(--cyan);">Act II Purge:</strong> '+dObj.purgeText +
    '</div>';

  var gT = G.banishmentMode ? G.lockedGhost : G.inspectedGhost, dT = G.banishmentMode ? G.lockedDeath : G.inspectedDeath;

  document.getElementById("m-tab-journal").innerHTML =
    '<div class="m-section"><div class="m-sec-title">1. PARANORMAL EVIDENCE (TAP TO CYCLE ☑ / ❌ / ☐)</div><div class="m-btn-grid">' +
      EVIDENCE_TYPES.map(function(ev) {
        var st = getTriStateVal(G.foundEv, ev);
        var cls = st === 1 ? "btn-green" : (st === -1 ? "btn-red" : "");
        var ic = st === 1 ? "☑ " : (st === -1 ? "❌ " : "☐ ");
        return '<button type="button" class="'+cls+'" data-m-cmd="toggle-ev" data-ev="'+ev+'">'+ic+ev+'</button>';
      }).join("") +
    '</div></div>' +
    '<div class="m-section"><div class="m-sec-title">2. GHOST SUSPECT &amp; DOSSIER (ACT I TARGET)</div><div style="display:grid; grid-template-columns:repeat(3,1fr); gap:5px;">' +
      Object.keys(GHOST_DB).map(function(g) {
        var gEvs = GHOST_DB[g].ev;
        var hasAllPos = posEvs.every(function(e) { return gEvs.indexOf(e) !== -1 || (g === "Mimic" && e === "Ghost Orbs") || (g === "Phantasm" && e === "Spirit Box"); });
        var hasNoNeg = negEvs.every(function(e) { return gEvs.indexOf(e) === -1; });
        var validSus = hasAllPos && hasNoNeg;
        return '<button type="button" class="'+(G.inspectedGhost===g?'btn-cyan':'')+'" style="'+(validSus?'':'opacity:0.28; text-decoration:line-through;')+'" data-m-cmd="inspect-ghost" data-ghost="'+g+'">'+g+'</button>';
      }).join("") +
    '</div>' + mGhostDossierHtml + '</div>' +
    '<div class="m-section"><div class="m-sec-title">3. FORENSIC TRACES &amp; CAUSE OF DEATH (ACT II TARGET)</div><div class="m-btn-grid" style="margin-bottom:8px;">' +
      FORENSIC_TRAITS.map(function(ft) {
        var st = getTriStateVal(G.foundForensics, ft);
        var cls = st === 1 ? "btn-green" : (st === -1 ? "btn-red" : "");
        var ic = st === 1 ? "☑ " : (st === -1 ? "❌ " : "☐ ");
        return '<button type="button" class="'+cls+'" style="font-size:10px; padding:4px 6px; text-align:left;" data-m-cmd="toggle-forensic" data-ft="'+ft+'">'+ic+ft+'</button>';
      }).join("") +
    '</div><div style="display:grid; grid-template-columns:repeat(3,1fr); gap:5px;">' +
      Object.keys(DEATH_DB).map(function(d) {
        var dTr = DEATH_DB[d].traits;
        var validD = posFt.every(function(t) { return dTr.indexOf(t) !== -1; }) && negFt.every(function(t) { return dTr.indexOf(t) === -1; });
        return '<button type="button" class="'+(G.inspectedDeath===d?'btn-amber':'')+'" style="'+(validD?'':'opacity:0.28; text-decoration:line-through;')+'" data-m-cmd="inspect-death" data-death="'+d+'">'+d+'</button>';
      }).join("") +
    '</div>' + mDeathDossierHtml +
    '<div style="margin-top:8px;">' +
      '<div class="act-box '+(G.ritualStage>=1?'done':'')+'"><strong>1️⃣ ACT I (BIND '+gT.toUpperCase()+'):</strong> '+GHOST_DB[gT].ritualText+'</div>' +
      '<div class="act-box '+(G.ritualStage>=2?'done':'')+'"><strong>2️⃣ ACT II (PURGE '+dT.toUpperCase()+'):</strong> '+DEATH_DB[dT].purgeText+'</div>' +
      '<div class="act-box '+(G.ritualStage>=3?'done':'')+'"><strong>3️⃣ ACT III (SEVERANCE):</strong> Roll 2d6 + Resolve &ge; 7 in bound room!</div>' +
    '</div>' +
    '<button type="button" class="btn-purple" style="width:100%; margin-top:8px; padding:10px;" data-m-cmd="begin-ritual">🔥 START 3-ACT EXORCISM</button></div>';

  document.getElementById("m-tab-log").innerHTML =
    '<div class="m-section"><div class="m-sec-title">LIVE SHARED SENSOR & AUDIO LOG</div><div class="log-feed">' +
      G.logs.slice(0, 25).map(function(l) { return '<div class="log-item '+l.type+'">'+l.text+'</div>'; }).join("") +
    '</div></div>';
}

/* ============================================================================
   11. EVENT LISTENERS & GITHUB PAGES + TURN MOBILE P.D.A. HANDSHAKE
============================================================================ */
document.addEventListener("click", function(e) {
  var mBtn = e.target.closest("[data-m-cmd]");
  if (mBtn) {
    var cmd = mBtn.getAttribute("data-m-cmd");
    sendPhoneCmd({
      action: cmd,
      room: mBtn.getAttribute("data-room"),
      target: mBtn.getAttribute("data-target"),
      slot: parseInt(mBtn.getAttribute("data-slot") || "0", 10),
      idx: parseInt(mBtn.getAttribute("data-idx") || "0", 10),
      ev: mBtn.getAttribute("data-ev"),
      ft: mBtn.getAttribute("data-ft"),
      ghost: mBtn.getAttribute("data-ghost"),
      death: mBtn.getAttribute("data-death")
    });
    return;
  }
  var mChar = e.target.closest("[data-m-action='m-select-char']");
  if (mChar) {
    mobileCharIdx = parseInt(mChar.getAttribute("data-idx"), 10);
    G.selectedChar = mobileCharIdx;
    renderMobileController();
    sendPhoneCmd({ action: "select-char" });
    return;
  }

  var btn = e.target.closest("[data-action]");
  if (!btn) return;
  var act = btn.getAttribute("data-action");
  if (act === "select-mode") { selectedMode = btn.getAttribute("data-mode"); renderLobbyModal(); }
  else if (act === "select-diff") { selectedDifficulty = btn.getAttribute("data-diff"); renderLobbyModal(); }
  else if (act === "select-size") { selectedHouseSize = btn.getAttribute("data-size"); renderLobbyModal(); }
  else if (act === "toggle-lobby-char") {
    var lIdx = parseInt(btn.getAttribute("data-idx"), 10);
    if (!META.unlocked[lIdx]) return;
    selectedClasses[lIdx] = !selectedClasses[lIdx];
    renderLobbyModal();
  }
  else if (act === "adj-intern") {
    var delta = parseInt(btn.getAttribute("data-delta"), 10);
    var specC = selectedClasses.filter(function(s, i) { return s && META.unlocked[i]; }).length;
    selectedInternCount = Math.max(0, Math.min(4 - specC, selectedInternCount + delta));
    renderLobbyModal();
  }
  else if (act === "level-up-spec") {
    var sIdx = parseInt(btn.getAttribute("data-idx"), 10);
    var curL = META.specLevels[sIdx] || 1;
    var cost = curL === 1 ? 200 : 350;
    if (curL < 3 && META.cash >= cost) {
      META.cash -= cost;
      META.specLevels[sIdx] = curL + 1;
      saveMetaSave(); playSound("clue"); renderLobbyModal();
    }
  }
  else if (act === "buy-van-tier") {
    var vKey = btn.getAttribute("data-key");
    var vObj = VAN_SHOP_CATALOG.find(function(v) { return v.key === vKey; });
    var curT = META.vanTiers[vKey] || 1;
    var vCost = curT === 1 ? vObj.t2Cost : vObj.t3Cost;
    if (curT < 3 && META.cash >= vCost) {
      META.cash -= vCost;
      META.vanTiers[vKey] = curT + 1;
      saveMetaSave(); playSound("clue"); renderLobbyModal();
    }
  }
  else if (act === "buy-extra-tool") {
    var eKey = btn.getAttribute("data-key");
    var eObj = VAN_SHOP_CATALOG.find(function(v) { return v.key === eKey; });
    var eCost = (eObj && eObj.extraCost) ? eObj.extraCost : 65;
    if (!META.vanExtras) META.vanExtras = {};
    var curE = META.vanExtras[eKey] || 0;
    if (curE < 3 && META.cash >= eCost) {
      META.cash -= eCost;
      META.vanExtras[eKey] = curE + 1;
      saveMetaSave(); playSound("clue"); renderLobbyModal();
    }
  }
  else if (act === "buy-extra-pills") {
    var specCnt = selectedClasses.filter(function(s, i) { return s && META.unlocked[i]; }).length;
    var totCnt = Math.max(1, Math.min(4, specCnt + selectedInternCount));
    if (META.cash >= 50 && (META.extraPills || 0) < totCnt) {
      META.cash -= 50;
      META.extraPills = (META.extraPills || 0) + 1;
      saveMetaSave(); playSound("clue"); renderLobbyModal();
    }
  }
  else if (act === "buy-upg") {
    var uIdx = parseInt(btn.getAttribute("data-idx"), 10), uType = btn.getAttribute("data-upg"), sPl = CAMP.pendingSquad[uIdx];
    if (sPl && sPl.upgradeTokens > 0) {
      sPl.upgradeTokens -= 1;
      if (uType === "sanity") { sPl.maxSanity += 6; sPl.sanity = sPl.maxSanity; }
      else if (uType === "mp") { sPl.maxMp += 1; sPl.mp = sPl.maxMp; }
      else if (uType === "stealth") sPl.stealth += 2;
      else if (uType === "resolve") sPl.resolve += 2;
      playSound("clue"); renderUpgradeShop();
    }
  }
  else if (act === "switch-floor") { G.currentFloorView = parseInt(btn.getAttribute("data-floor"), 10); renderAll(); }
  else if (act === "select-char") { G.selectedChar = parseInt(btn.getAttribute("data-idx"), 10); G.currentFloorView = getRoom(curPlayer().roomId).floor; renderAll(); }
  else handleRemotePhoneCommand({
    action: act,
    charIdx: G.selectedChar,
    room: btn.getAttribute("data-room"),
    target: btn.getAttribute("data-target"),
    slot: parseInt(btn.getAttribute("data-slot") || "0", 10),
    idx: parseInt(btn.getAttribute("data-idx") || "0", 10),
    ev: btn.getAttribute("data-ev"),
    ft: btn.getAttribute("data-ft"),
    ghost: btn.getAttribute("data-ghost"),
    death: btn.getAttribute("data-death")
  });
});

document.getElementById("btn-launch-contract").addEventListener("click", launchFromLobby);
var resetMetaBtn = document.getElementById("btn-reset-meta");
if (resetMetaBtn) {
  resetMetaBtn.addEventListener("click", function() {
    META = getDefaultMetaSave();
    selectedClasses = [false,false,false,false,false,false,false,false,false,false,false,false];
    selectedInternCount = 4;
    saveMetaSave();
    renderLobbyModal();
  });
}

document.getElementById("btn-open-phone-modal").addEventListener("click", function() {
  initHostPeer(); updateQRDisplay();
  document.getElementById("phone-modal").style.display = "flex";
});
document.getElementById("btn-close-phone-modal").addEventListener("click", function() { document.getElementById("phone-modal").style.display = "none"; });
document.getElementById("btn-open-sim-phone").addEventListener("click", function() {
  var simUrl = window.location.href.split("?")[0] + "?mobile=1&room=" + (hostRoomCode || "LOCAL");
  window.open(simUrl, "_blank", "width=410,height=780");
});
document.getElementById("btn-switch-to-mobile-mode").addEventListener("click", function() { enableMobileMode(""); });
document.getElementById("btn-m-back-pc").addEventListener("click", function() {
  isMobileClient = false;
  document.getElementById("mobile-app").style.display = "none";
  document.getElementById("host-app").style.display = "flex";
  renderAll();
});
document.getElementById("btn-m-connect").addEventListener("click", function() {
  var code = document.getElementById("m-room-input").value.trim().toUpperCase();
  connectPhoneToHost(code);
});
document.getElementById("btn-m-undo").addEventListener("click", function() { sendPhoneCmd({ action:"undo" }); });
document.getElementById("btn-m-end-turn").addEventListener("click", function() { sendPhoneCmd({ action:"toggle-end-turn" }); });

function setMobileTab(tab) {
  document.getElementById("m-tab-actions").style.display = tab === "actions" ? "flex" : "none";
  document.getElementById("m-tab-journal").style.display = tab === "journal" ? "flex" : "none";
  document.getElementById("m-tab-log").style.display = tab === "log" ? "flex" : "none";
  document.getElementById("m-nav-actions").className = "tab-btn " + (tab === "actions" ? "active" : "");
  document.getElementById("m-nav-journal").className = "tab-btn " + (tab === "journal" ? "active" : "");
  document.getElementById("m-nav-log").className = "tab-btn " + (tab === "log" ? "active" : "");
}
document.getElementById("m-nav-actions").addEventListener("click", function() { setMobileTab("actions"); });
document.getElementById("m-nav-journal").addEventListener("click", function() { setMobileTab("journal"); });
document.getElementById("m-nav-log").addEventListener("click", function() { setMobileTab("log"); });

document.getElementById("btn-proceed-next-mission").addEventListener("click", function() {
  document.getElementById("upgrade-modal").style.display = "none";
  CAMP.missionNum += 1; startMission(CAMP.pendingSquad);
});
document.getElementById("btn-close-briefing").addEventListener("click", function() { document.getElementById("briefing-modal").style.display = "none"; });
document.getElementById("btn-close-gameover").addEventListener("click", function() { document.getElementById("gameover-modal").style.display = "none"; });
document.getElementById("btn-restart-from-gameover").addEventListener("click", function() { document.getElementById("gameover-modal").style.display = "none"; openLobbyModal(); });
document.getElementById("btn-give-up").addEventListener("click", function() { showPostMortemModal("🏳️ CONTRACT ABORTED // POST-MORTEM REVEAL"); });
document.getElementById("btn-undo").addEventListener("click", function() { performUndoForChar(G.selectedChar); });
document.getElementById("btn-audio-toggle").addEventListener("click", function() {
  audioEnabled = !audioEnabled; this.textContent = audioEnabled ? "🔊 Audio: ON" : "🔇 Audio: OFF";
});
document.getElementById("btn-end-round").addEventListener("click", endRoundHauntPhase);
document.getElementById("btn-new-contract").addEventListener("click", openLobbyModal);
document.getElementById("btn-begin-ritual").addEventListener("click", triggerBanishmentHunt);

function setRightTab(which) {
  ["log","brief","journal","forensics"].forEach(function(t) {
    document.getElementById("tab-" + t).style.display = (which === t) ? "block" : "none";
    document.getElementById("tab-btn-" + t).className = "tab-btn " + (which === t ? "active" : "");
  });
}
document.getElementById("tab-btn-log").addEventListener("click", function() { setRightTab("log"); });
document.getElementById("tab-btn-brief").addEventListener("click", function() { setRightTab("brief"); });
document.getElementById("tab-btn-journal").addEventListener("click", function() { setRightTab("journal"); });
document.getElementById("tab-btn-forensics").addEventListener("click", function() { setRightTab("forensics"); });

function showActiveMobileScreen() {
  document.getElementById("m-join-screen").style.display = "none";
  document.getElementById("m-controller-screen").style.display = "flex";
  setMobileTab("actions");
  if (!G || !G.players || G.players.length === 0) {
    startMission(null);
  }
  if (mobileCharIdx >= G.players.length) mobileCharIdx = 0;
  G.selectedChar = mobileCharIdx;
  renderMobileController();
}

function enableMobileMode(prefillCode) {
  isMobileClient = true;
  document.getElementById("host-app").style.display = "none";
  document.getElementById("mobile-app").style.display = "flex";
  if (prefillCode) {
    document.getElementById("m-room-input").value = prefillCode;
    connectPhoneToHost(prefillCode);
  }
}

function connectPhoneToHost(code) {
  var st = document.getElementById("m-conn-status");
  var cleanCode = (code || "").trim().toUpperCase();

  if (!cleanCode) {
    if (st) st.textContent = "⚠️ Enter the 4-Letter Room Code shown on the TV (e.g. SP4829).";
    return;
  }

  var saved = localStorage.getItem("SPECTRAL_LIVE_STATE");
  if (cleanCode === "LOCAL" || !window.Peer) {
    if (saved) { try { G = JSON.parse(saved); } catch (e) {} }
    showActiveMobileScreen();
    return;
  }

  if (st) st.textContent = "📡 Linking to Big Screen TV [" + cleanCode + "]...";
  hasReceivedHostSync = false;
  if (syncRetryInterval) { clearInterval(syncRetryInterval); syncRetryInterval = null; }

  try {
    if (clientPeer && !clientPeer.destroyed) clientPeer.destroy();
    clientPeer = new Peer(PEER_CONFIG);

    clientPeer.on("open", function(myId) {
      console.log("📱 Phone Peer Open:", myId, "-> Connecting to spectral-host-" + cleanCode);
      if (st) st.textContent = "🔄 Handshaking with Room [" + cleanCode + "]...";

      clientConn = clientPeer.connect("spectral-host-" + cleanCode, {
        serialization: "json"
      });

      clientConn.on("open", function() {
        console.log("✅ DataChannel Open with Host TV!");
        if (st) st.textContent = "✅ Connected! Syncing HUD...";
        // Immediately render UI so the phone NEVER shows an empty frame!
        showActiveMobileScreen();

        // Ping TV for live state immediately, and retry every 1.2s until first STATE_SYNC arrives
        try { clientConn.send({ type: "REQUEST_SYNC" }); } catch (e) {}
        syncRetryInterval = setInterval(function() {
          if (hasReceivedHostSync || !clientConn || !clientConn.open) {
            clearInterval(syncRetryInterval);
            syncRetryInterval = null;
            return;
          }
          try { clientConn.send({ type: "REQUEST_SYNC" }); } catch (e) {}
        }, 1200);
      });

      clientConn.on("data", function(data) {
        if (data && data.type === "STATE_SYNC" && data.G) {
          hasReceivedHostSync = true;
          if (syncRetryInterval) { clearInterval(syncRetryInterval); syncRetryInterval = null; }
          G = data.G;
          if (mobileCharIdx >= G.players.length) mobileCharIdx = 0;
          G.selectedChar = mobileCharIdx;
          showActiveMobileScreen();
        }
      });

      clientConn.on("close", function() {
        if (st) st.textContent = "⚠️ Disconnected from Big Screen TV.";
      });

      clientConn.on("error", function(err) {
        console.error("Phone Conn Error:", err);
        if (st) st.textContent = "❌ Link Error: " + err;
      });
    });

    clientPeer.on("error", function(err) {
      console.error("Phone Peer Error:", err.type, err);
      if (err.type === "peer-unavailable") {
        if (st) st.textContent = "❌ Room [" + cleanCode + "] not found! Make sure the PC/TV has the game open and shows code " + cleanCode + ".";
      } else {
        if (st) st.textContent = "❌ Network Error (" + err.type + "). Tap Connect again.";
      }
    });
  } catch (e) {
    if (st) st.textContent = "❌ Exception: " + e.message;
  }
}

/* ============================================================================
   12. DEVELOPER SANDBOX / PLAYTESTING TOOLBAR & AUTO-BOOT
============================================================================ */
(function initDevSandbox() {
  var bar = document.createElement("div");
  bar.id = "dev-sandbox-bar";
  bar.style.cssText = "display:none; background:#140a24; border-bottom:2px solid var(--purple); padding:6px 14px; gap:8px; align-items:center; flex-wrap:wrap; font-size:11px; z-index:900;";
  bar.innerHTML =
    '<strong style="color:var(--purple);">🛠️ DEV SANDBOX:</strong>' +
    '<label>Ghost: <select id="dev-sel-ghost" style="background:#090d14; color:#fff; border:1px solid var(--border); padding:2px 4px; border-radius:3px;"></select></label>' +
    '<label>Death: <select id="dev-sel-death" style="background:#090d14; color:#fff; border:1px solid var(--border); padding:2px 4px; border-radius:3px;"></select></label>' +
    '<label>Anchor: <select id="dev-sel-anchor" style="background:#090d14; color:#fff; border:1px solid var(--border); padding:2px 4px; border-radius:3px;"><option value="corpse">💀 Corpse</option><option value="heirloom">🏺 Heirloom</option></select></label>' +
    '<button type="button" class="btn-cyan" data-dev="reveal-map">🗺️ Reveal All & Anchor</button>' +
    '<button type="button" class="btn-green" data-dev="max-ap">⚡ +10 AP / MP & Full San</button>' +
    '<button type="button" class="btn-red" data-dev="toggle-hunt">🚨 Toggle Hunt (2 AP)</button>' +
    '<button type="button" class="btn-purple" data-dev="spawn-items">🏺 Give Heirloom & Key</button>' +
    '<button type="button" class="btn-cyan" data-dev="auto-clues">🔍 Auto-Confirm Clues</button>' +
    '<button type="button" class="btn-green" data-dev="tp-ghost">📍 TP to Ghost/Corpse</button>' +
    '<button type="button" class="btn-amber" data-dev="meta-max">🔓 +$1,000 & Unlock All Lvl 3</button>';

  var hostApp = document.getElementById("host-app");
  var headerEl = hostApp.querySelector("header");
  hostApp.insertBefore(bar, headerEl.nextSibling);

  function syncDevDropdowns() {
    if (!G || !G.secretGhost) return;
    var gSel = document.getElementById("dev-sel-ghost"), dSel = document.getElementById("dev-sel-death"), aSel = document.getElementById("dev-sel-anchor");
    if (gSel.options.length === 0) {
      gSel.innerHTML = Object.keys(GHOST_DB).map(function(k){ return '<option value="'+k+'">'+k+'</option>'; }).join("");
      dSel.innerHTML = Object.keys(DEATH_DB).map(function(k){ return '<option value="'+k+'">'+k+'</option>'; }).join("");
    }
    gSel.value = G.secretGhost; dSel.value = G.secretDeath; aSel.value = G.anchorType;
  }

  document.getElementById("btn-toggle-dev").addEventListener("click", function() {
    bar.style.display = (bar.style.display === "none") ? "flex" : "none";
    syncDevDropdowns();
  });

  document.getElementById("dev-sel-ghost").addEventListener("change", function() {
    G.secretGhost = this.value; G.briefingHtml = generateMissionBriefingHtml();
    logMsg("🛠️ DEV: Force-switched secret Ghost to [" + G.secretGhost + "].", "ritual"); renderAll();
  });

  document.getElementById("dev-sel-death").addEventListener("change", function() {
    G.secretDeath = this.value; G.briefingHtml = generateMissionBriefingHtml();
    logMsg("🛠️ DEV: Force-switched secret Cause of Death to [" + G.secretDeath + "].", "ritual"); renderAll();
  });

  document.getElementById("dev-sel-anchor").addEventListener("change", function() {
    G.anchorType = this.value;
    logMsg("🛠️ DEV: Force-switched Anchor Type to [" + G.anchorType.toUpperCase() + "].", "ritual"); renderAll();
  });

  bar.addEventListener("click", function(e) {
    var btn = e.target.closest("[data-dev]");
    if (!btn) return;
    var act = btn.getAttribute("data-dev"), p = curPlayer();
    if (act === "reveal-map") {
      G.rooms.forEach(function(r) {
        r.discovered = true;
        if (r.hasBackDoor) r.backDoorUnlocked = true;
        if (r.forensicTrace) r.traceRevealed = true;
        if (r.hasHiddenAnchor) uncoverAnchorInRoom(r);
      });
      G.tracesScannedCount = 3;
      logMsg("🛠️ DEV: Revealed all rooms, traces, and the hidden Anchor!", "clue");
    } else if (act === "max-ap") {
      G.players.forEach(function(pl) { pl.ap = 10; pl.mp = 10; pl.sanity = pl.maxSanity; pl.spirit = false; });
      logMsg("🛠️ DEV: Granted 10 AP, 10 Walk MP, and 100% Sanity.", "clue");
    } else if (act === "toggle-hunt") {
      G.huntActive = !G.huntActive;
      if (G.huntActive) {
        G.huntTurns = 4; var fav = getRoom(G.ghostFavRoomId); fav.discovered = true; G.ghostRoomId = fav.id; G.ghostTrail = [fav.id];
        G.players.forEach(function(pl) { pl.ap = 2; pl.mp = (pl.baseClass === "Vlogger" ? 1 : 0); });
        startHuntTurnTimer(); logMsg("🛠️ DEV: Forced Hunt START (0 MP + 2 AP)!", "hunt");
      } else {
        G.ghostTrail = []; stopHuntTurnTimer();
        G.players.forEach(function(pl) { pl.ap = pl.maxAp; pl.mp = pl.maxMp; });
        logMsg("🛠️ DEV: Forced Hunt STOP.", "clue");
      }
    } else if (act === "spawn-items") {
      G.hasBackDoorKey = true;
      p.hands = [{ name:"True Heirloom (Verified)", desc:"Verified spectral anchor ready for Act II.", elec:false, isRelic:true, trueRelic:true, verified:true }];
      logMsg("🛠️ DEV: Equipped Verified True Heirloom and Spare Key!", "ritual");
    } else if (act === "auto-clues") {
      G.foundEv = {}; GHOST_DB[G.secretGhost].ev.forEach(function(ev) { G.foundEv[ev] = 1; });
      G.foundForensics = {}; DEATH_DB[G.secretDeath].traits.forEach(function(ft) { G.foundForensics[ft] = 1; });
      G.inspectedGhost = G.secretGhost; G.lockedGhost = G.secretGhost; G.inspectedDeath = G.secretDeath; G.lockedDeath = G.secretDeath;
      logMsg("🛠️ DEV: Auto-confirmed all Clues & Death Traits!", "clue");
    } else if (act === "tp-ghost") {
      var targetId = (G.anchorType === "corpse") ? G.anchorRoomId : G.ghostFavRoomId;
      var gR = getRoom(targetId); gR.discovered = true;
      if (gR.hasHiddenAnchor) uncoverAnchorInRoom(gR);
      p.roomId = gR.id; G.currentFloorView = gR.floor;
      logMsg("🛠️ DEV: Teleported " + p.name + " to [" + gR.name + "]!", "ritual");
    } else if (act === "meta-max") {
      META.cash += 1000;
      SPECIALIST_CHALLENGES.forEach(function(c, idx) {
        META.progress[c.id] = c.target;
        META.unlocked[idx] = true;
        META.specLevels[idx] = 3;
      });
      VAN_SHOP_CATALOG.forEach(function(v) { META.vanTiers[v.key] = 3; });
      saveMetaSave();
      renderLobbyModal();
      logMsg("🛠️ DEV: Added +$1,000 Cash, unlocked all 12 Specialists at Level 3, and maxed Van Gear to Tier 3!", "clue");
    }
    syncDevDropdowns(); renderAll();
  });
})();

// Boot Game (Auto-Initializes Host Peer on PC so Room Code is live immediately)
var urlParams = new URLSearchParams(window.location.search);
var roomParam = urlParams.get("room");
var mobileParam = urlParams.get("mobile");

if (roomParam || mobileParam) {
  isMobileClient = true;
  launchFromLobby();
  document.getElementById("briefing-modal").style.display = "none";
  enableMobileMode(roomParam || "LOCAL");
} else {
  initHostPeer();
  launchFromLobby();
  document.getElementById("briefing-modal").style.display = "none";
  openLobbyModal();
}