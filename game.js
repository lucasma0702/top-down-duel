(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const MAX_TEAM_FIGHTERS = 6;
  /** Teams mode supports up to this many sides; Siege stays fixed at 2
   *  (it has exactly two bases). */
  const TEAM_IDS = ["a", "b", "c", "d"];
  const TEAM_LABELS = { a: "A", b: "B", c: "C", d: "D" };
  const TEAM_COLORS = { a: "#3dd6ff", b: "#ff6b9d", c: "#c084fc", d: "#f59e0b" };
  const hudRoot = document.getElementById("hud");
  const hpEls = [];
  const heroHudWraps = [];
  for (let hi = 0; hi < MAX_TEAM_FIGHTERS; hi++) {
    hpEls.push(document.getElementById("hp" + (hi + 1)));
    heroHudWraps.push(document.getElementById("hud-hero-" + hi));
  }
  const overlay = document.getElementById("overlay");
  const overlayInner = document.getElementById("overlay-inner");
  const modeScreen = document.getElementById("mode-screen");
  const btnVersus = document.getElementById("btn-mode-versus");
  const btnTeams = document.getElementById("btn-mode-teams");
  const btnBoss = document.getElementById("btn-mode-boss");
  const btnHorde = document.getElementById("btn-mode-horde");
  const btnSiege = document.getElementById("btn-mode-siege");
  const helpEl = document.getElementById("help");
  const humanCountSelect = document.getElementById("human-count");
  const aiCountSelect = document.getElementById("ai-count");
  const livesCountSelect = document.getElementById("lives-count");
  const livesCountRow = document.getElementById("lives-count-row");
  const charScreen = document.getElementById("char-screen");
  const charTeamHintEl = document.getElementById("char-team-hint");
  const charSlotsEl = document.getElementById("char-slots");
  const btnCharContinue = document.getElementById("btn-char-continue");
  const btnCharBack = document.getElementById("btn-char-back");
  const mapScreen = document.getElementById("map-screen");
  const mapModifiersEl = document.getElementById("map-modifiers");
  const btnMapContinue = document.getElementById("btn-map-continue");
  const btnMapBack = document.getElementById("btn-map-back");
  const bossScreen = document.getElementById("boss-screen");
  const bossChoicesEl = document.getElementById("boss-choices");
  const btnBossContinue = document.getElementById("btn-boss-continue");
  const btnBossBack = document.getElementById("btn-boss-back");

  const hpBossEl = document.getElementById("hpBoss");
  const hudBossWrap = document.getElementById("hud-boss");
  const hpBaseAEl = document.getElementById("hpBaseA");
  const hudBaseAWrap = document.getElementById("hud-base-a");
  const hpBaseBEl = document.getElementById("hpBaseB");
  const hudBaseBWrap = document.getElementById("hud-base-b");

  const W = canvas.width;
  const H = canvas.height;
  const MARGIN = 28;
  /** Colosseum (circle bounds) playable radius vs the default fit. */
  const COLOSSEUM_RADIUS_MUL = 1.18;
  /** Horde playfield size vs duel (camera zooms out to fit). */
  const HORDE_ARENA_SCALE = 1.55;
  const PLAYER_R = 22;
  const MOVE_SPEED = 320;
  const FRICTION = 0.88;
  const MAX_HP = 100;
  /** ~15% bump to HP pools and healing. */
  const COMBAT_STAT_MUL = 1.15;
  /** Global damage scale (fighters, bosses, hazards that use scaleDmg). */
  const COMBAT_DMG_MUL = 0.9;
  function scaleHp(n) {
    return Math.max(1, Math.round(n * COMBAT_STAT_MUL));
  }
  function scaleDmg(n) {
    return n > 0 ? n * COMBAT_DMG_MUL : n;
  }
  function scaleHeal(n) {
    return n > 0 ? n * COMBAT_STAT_MUL : n;
  }
  const DAMAGE_MIN = 8;
  const DAMAGE_MAX = 34;
  const MAX_CHARGE = 0.78;
  /** Bots can stay at full charge this long before auto-swinging. */
  const MAX_CHARGE_HOLD = 0.36;
  /** Extra damage when Brawler hits a stunned target. */
  const BRAWLER_VS_STUNNED_DMG_MUL = 1.28;
  const BRAWLER_RANGE_MIN_MUL = 0.44;
  const BRAWLER_RANGE_MAX_MUL = 1;
  /** Seismic Slam ultimate AoE + VFX. */
  const BRAWLER_ULT_RADIUS = 128;
  const BRAWLER_ULT_VFX = 0.55;
  const ATTACK_COOLDOWN = 0.36;
  const ATTACK_ACTIVE = 0.12;
  const ATTACK_RANGE = 62;
  /** Boss body radius vs fighters (visual + collision). */
  const BOSS_RADIUS_MUL = 1.2;
  /** Boss melee reach vs players (1 = same arc length as humans). */
  const BOSS_ATTACK_RANGE_MUL = 1;
  /** Boss move speed vs players (acceleration + top speed). */
  const BOSS_MOVE_SPEED_MUL = 0.92;
  /** Ally AI (P3) move speed — deliberately slower than human players. */
  const ALLY_AI_SPEED_MUL = 0.82;
  const AI_DIFFICULTY_IDS = ["easy", "normal", "hard", "elite"];
  const AI_DIFFICULTY_DEFAULT = "normal";
  const AI_DIFFICULTY_LABELS = {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    elite: "Elite",
  };
  /** Below this HP fraction, self-preservation starts pulling a fighter's
   *  retreat range outward, scaling to full effect at 0 HP. */
  const AI_SELF_PRESERVE_HP_FRAC = 0.45;
  /** Max extra multiplier added to the retreat ("close") range at full hurt
   *  and full selfPreserveMul. */
  const AI_SELF_PRESERVE_CLOSE_MUL = 1.6;
  /** A target at or below this HP fraction is "finishable" — worth chasing
   *  down instead of the merely-nearest enemy. */
  const AI_KILL_PRIORITY_HP_FRAC = 0.32;
  /** How much farther away a finishable target can be and still get picked
   *  over the nearest enemy. */
  const AI_KILL_PRIORITY_EXTRA_DIST = 130;
  /** Stock lives (Versus / Teams / Boss) — respawn delay and spawn protection. */
  const RESPAWN_DELAY = 1.85;
  const RESPAWN_INVULN = 2.1;
  const MARKSMAN_AI_AIM_SPREAD = 0.11;
  const MARKSMAN_AI_CHARGE_JITTER = 0.08;
  /** Ally Marksman kites and fires from this fraction of max bolt range. */
  const MARKSMAN_AI_RANGE_MIN_MUL = 0.4;
  const MARKSMAN_AI_RANGE_MAX_MUL = 0.96;
  const MARKSMAN_AI_KITE_MIN_MUL = 0.46;
  const MARKSMAN_AI_KITE_MAX_MUL = 0.76;
  /** Lead shots by this fraction of target velocity × travel time. */
  const MARKSMAN_AI_LEAD = 0.92;
  const STRIKER_AI_DIST_MARGIN = 20;
  const ATTACK_ARC = Math.PI * 0.85;
  const KNOCKBACK = 585;
  /** Pike — charged long, narrow spear corridor (area along facing). */
  const LANCE_RANGE_MIN = 118;
  const LANCE_RANGE_MAX = 268;
  /** Half-width of the spear hit corridor at its tip (pixels) — the corridor
   *  tapers narrower near the attacker, widening to this out at max range. */
  const LANCE_HALF_WIDTH = 22;
  /** Half-width near the attacker, as a fraction of LANCE_HALF_WIDTH. */
  const LANCE_NEAR_WIDTH_MUL = 0.4;
  const LANCE_ATTACK_ACTIVE = 0.22;
  const LANCE_ATTACK_COOLDOWN = 0.52;
  const LANCE_DAMAGE_MIN = 10;
  const LANCE_DAMAGE_MAX = 28;
  /** Pike thrust — weaker near, stronger at tip. */
  const LANCE_CLOSE_DMG_MUL = 0.52;
  const LANCE_FAR_DMG_MUL = 1.48;
  /** Pike ult — homing spear projectile with its own HP. */
  const LANCE_SPEAR_SPEED = 205;
  const LANCE_SPEAR_TURN = 5.2;
  const LANCE_SPEAR_R = 15;
  const LANCE_SPEAR_HP = 18;
  const LANCE_SPEAR_DAMAGE = 52;
  const LANCE_SPEAR_LIFE = 9;
  const LANCE_SPEAR_KNOCK_MUL = 2.6;
  const LANCE_SPEAR_SLOW_MUL = 0.4;
  const LANCE_SPEAR_SLOW_DURATION = 2.2;
  /** Grappler bolts — stronger near, suck foes in (reverse knock). */
  const GRAPPLE_CLOSE_DMG_MUL = 1.48;
  const GRAPPLE_FAR_DMG_MUL = 0.52;
  const GRAPPLE_REVERSE_KNOCK_MUL = 1.55;
  const GRAPPLE_HIT_R = 18;
  /** Grappler ult — line hook that yanks a hit target in. */
  const GRAPPLER_HOOK_RANGE = 385;
  const GRAPPLER_HOOK_SPEED = 720;
  const GRAPPLER_HOOK_HALF_WIDTH = 22;
  const GRAPPLER_HOOK_DAMAGE = 18;
  const GRAPPLER_HOOK_PULL_TIME = 0.4;
  const GRAPPLER_HOOK_PULL_STOP = 42;
  const GRAPPLER_HOOK_MISS_RETRACT = 0.2;
  const GRAPPLER_HOOK_CHARGE_BOOST_DUR = 6.5;
  const GRAPPLER_HOOK_CHARGE_BOOST_MUL = 3.0;
  /** Siphon — snappy charge; every 3rd shot takes a 5s reload. */
  const SIPHON_FAST_CHARGE_MUL = 1.15;
  const SIPHON_ATTACK_COOLDOWN = 5;
  const SIPHON_RELOAD_EVERY = 3;
  const SIPHON_ULT_PULL_DURATION = 0.55;
  const SIPHON_ULT_PULL_RADIUS = 160;
  const SIPHON_ULT_PULL_SPEED = 480;
  const SIPHON_ULT_SHOCK_RADIUS = 148;
  const SIPHON_ULT_SHOCK_DAMAGE = 30;
  const SIPHON_ULT_SHOCK_VFX = 0.48;
  const SIPHON_ULT_SHOCK_KNOCK_MUL = 0.82;
  const SIPHON_ULT_SHOCK_SHOVE = 36;
  const SIPHON_ULT_CHARGE_SLOW_MUL = 0.25;
  const SIPHON_ULT_CHARGE_SLOW_DUR = 2;
  const SIPHON_ULT_INVULN_PAD = 0.2;
  /** Siphon bolts grow and accelerate with charge. */
  const SIPHON_BOLT_HIT_R_MIN = 10;
  const SIPHON_BOLT_HIT_R_MAX = 22;
  const SIPHON_BOLT_SPEED_MIN_MUL = 0.72;
  const SIPHON_BOLT_SPEED_MAX_MUL = 1.55;
  /** Marionette — fast piercing needle main attack. */
  const MARIONETTE_NEEDLE_SPEED = 620;
  const MARIONETTE_NEEDLE_HIT_R = 6;
  /** Marionette ult — brief windup, then a big weakly-homing spike; on a
   *  fighter hit it binds an effigy that mirrors damage onto the real target. */
  const MARIONETTE_ULT_WINDUP = 0.6;
  const MARIONETTE_ULT_BOLT_SPEED = 300;
  const MARIONETTE_ULT_BOLT_TURN = 1.4;
  const MARIONETTE_ULT_BOLT_R = 16;
  const MARIONETTE_ULT_BOLT_DAMAGE = 34;
  const MARIONETTE_ULT_BOLT_LIFE = 3.5;
  const MARIONETTE_EFFIGY_SPAWN_DIST = 66;
  const MARIONETTE_EFFIGY_R = 20;
  const MARIONETTE_EFFIGY_DURATION = 14;
  const RANGED_SPEED = 395;
  const RANGED_MAX_DIST = 210;
  /** Echo summons — short cone copies that mirror the summoner's moves. */
  const ECHO_SUMMON_COUNT = 6;
  const ECHO_SUMMON_HP = 14;
  const ECHO_SUMMON_DAMAGE = 5;
  const ECHO_SUMMON_R = 18;
  const ECHO_SUMMON_ORBIT = 62;
  const ECHO_SUMMON_KNOCK_MUL = 0.1;
  /** Cone reach at tap vs full charge (copies the summoner's charge). */
  const ECHO_SUMMON_RANGE_MIN = 34;
  const ECHO_SUMMON_RANGE_MAX = 78;
  const ECHO_SUMMON_ARC = Math.PI * 0.72;
  const ECHO_SUMMON_ATTACK_ACTIVE = 0.15;
  /** Mirror Pack clones expire after this many seconds (even if not slain). */
  const ECHO_SUMMON_DURATION = 20;
  /** Siege mode — long two-base map, oriented top-to-bottom (taller than
   *  the canvas, not wider). Wide enough that the zoomed-out camera's view
   *  width never exceeds it — narrower and the camera would show permanent
   *  void down both sides, which reads as a pair of walls hemming the
   *  arena in even though nothing there actually blocks movement. */
  const SIEGE_WORLD_W = 1000;
  const SIEGE_WORLD_H = 2600;
  const SIEGE_BASE_INSET = 160;
  const SIEGE_BASE_R = 70;
  const SIEGE_BASE_HP = 600;
  const SIEGE_TEAM_A_COLOR = "#3dd6ff";
  const SIEGE_TEAM_B_COLOR = "#ff6b9d";
  /** Per-pane follow camera: zoom-in factor, tracking speed, and how close
   *  to the true world edge the camera is allowed to center (a small fixed
   *  pad rather than half the pane's own view width — the previous
   *  half-view-width pad left the bases permanently outside the camera's
   *  reachable range, so the pane could never actually show them). */
  const SIEGE_CAMERA_ZOOM = 0.95;
  const SIEGE_CAMERA_LERP_RATE = 6;
  const SIEGE_CAMERA_EDGE_PAD = 60;
  /** AI will push the enemy base instead of chasing a fighter whenever the
   *  base is this much farther away or closer — with infinite respawns
   *  there's always a fighter to chase, so without this AI never advances
   *  on the base at all; this gives it a real reason to sometimes. */
  const SIEGE_AI_BASE_PREFERENCE_MUL = 1.35;
  /** Kill-triggered helper — independent hunter/healer, temporary + capped. */
  const SHADOW_DURATION = 15;
  const SHADOW_HP = 30;
  const SHADOW_DAMAGE = 9;
  const SHADOW_HEAL_PER_SEC = 14;
  const SHADOW_HEAL_HP_THRESHOLD = 0.4;
  const SHADOW_SPEED_MUL = 1.05;
  const SHADOW_R = 16;
  const SHADOW_ATTACK_RANGE = 46;
  const SHADOW_ATTACK_COOLDOWN = 0.5;
  const SHADOW_MAX_PER_TEAM = 3;
  const RANGED_HIT_R = 12;
  const DASH_DIST_MIN = 58;
  const DASH_DIST_MAX = 132;
  const DASH_SPEED_MIN = 440;
  const DASH_SPEED_MAX = 640;
  const DASH_HIT_PAD = 10;
  /** Striker reload after dash ends (miss / graze / perfect on marker). */
  const DASH_COOLDOWN_MISS = 1.02;
  const DASH_COOLDOWN_HIT = 0.4;
  const DASH_COOLDOWN_PERFECT = 0.18;
  const DASH_PERFECT_RADIUS = 20;
  const DASH_DAMAGE_PERFECT_MUL = 1.32;
  const DASH_DAMAGE_IMPERFECT_MUL = 0.64;
  /** Phantom Rush — heal this fraction of max HP on each ult dash hit. */
  const STRIKER_ULT_HIT_HEAL_FRAC = 0.1;
  /** Phoenix — quick forward hop; twin bolts launch from behind toward facing. */
  const PHOENIX_DASH_DIST_MIN = 22;
  const PHOENIX_DASH_DIST_MAX = 36;
  const PHOENIX_DASH_SPEED_MIN = 420;
  const PHOENIX_DASH_SPEED_MAX = 580;
  const PHOENIX_ATTACK_COOLDOWN = 0.8;
  const PHOENIX_SHOT_SPEED = 380;
  const PHOENIX_SHOT_RANGE = 195;
  const PHOENIX_SHOT_SPREAD = 0.11;
  /** Twin-bolt half-angle while Rebirth ult damage buff is active (forward volley). */
  const PHOENIX_SHOT_SPREAD_ULT = 0.032;
  const PHOENIX_SHOT_DAMAGE_MIN = 7;
  const PHOENIX_SHOT_DAMAGE_MAX = 11;
  const PHOENIX_REVIVE_DURATION = 2.15;
  const PHOENIX_REVIVE_HP_MUL_INTERRUPTED = 0.5;
  const PHOENIX_REVIVE_DAMAGE_BONUS_PER = 0.18;
  /** Permanent, stacking (per Rebirth revive, same counter as the damage
   *  buff): attack charges faster and its cooldown shrinks, for the rest of
   *  the match — not just right after reviving. */
  const PHOENIX_REVIVE_CHARGE_SPEED_BONUS_PER = 0.18;
  const PHOENIX_REVIVE_COOLDOWN_REDUCTION_PER = 0.12;
  const PHOENIX_REVIVE_COOLDOWN_MIN_MUL = 0.35;
  /** Temporary burst right after rising from the Rebirth ultimate (not
   *  granted by the passive revive-channel): faster movement and reduced
   *  damage taken, for a short window only. */
  const PHOENIX_REVIVE_SPEED_BOOST_MUL = 1.6;
  const PHOENIX_REVIVE_SHIELD_DMG_MUL = 0.6;
  const PHOENIX_REVIVE_BUFF_DURATION = 2.5;
  /** After Rebirth ult, dying within this window triggers a free revive. */
  const PHOENIX_ULT_REBIRTH_WINDOW = 8;
  /** Small consolation heal (fraction of maxHp) if the Rebirth window runs
   *  out without Phoenix needing to use it — i.e. they survived the whole
   *  ultimate on their own. */
  const PHOENIX_ULT_REBIRTH_EXPIRE_HEAL_MUL = 0.15;
  /** HP restored when Rebirth triggers = maxHp * this, raised to the power of
   *  the (post-increment) revive-stack count — compounds every revive:
   *  75% after the 1st, 56.25% (75% of 75%) after the 2nd, and so on. */
  const PHOENIX_REVIVE_HP_STACK_MUL = 0.75;
  /** Extra attack damage multiplier from an armed Rebirth revive. */
  const PHOENIX_ULT_REBIRTH_DMG_BONUS = 0.25;
  /** Temporary damage mul while Rebirth ult buff is active. */
  const PHOENIX_ULT_DMG_MUL = 1.65;
  const PHOENIX_ULT_DMG_DURATION = 7;
  /** Ally AI — keep foes in the back-bolt band (fraction of PHOENIX_SHOT_RANGE). */
  const PHOENIX_AI_KITE_MIN_MUL = 0.46;
  const PHOENIX_AI_KITE_MAX_MUL = 0.82;
  const PHOENIX_AI_TOO_CLOSE = PHOENIX_DASH_DIST_MAX + 52;
  /** Ult forward bolts — stand farther and face the target. */
  const PHOENIX_AI_ULT_KITE_MIN_MUL = 0.34;
  const PHOENIX_AI_ULT_KITE_MAX_MUL = 0.9;
  const PHOENIX_AI_ULT_TOO_CLOSE = PHOENIX_DASH_DIST_MAX + 22;
  const PHOENIX_AI_ULT_LEAD = 0.95;
  /** Marksman bolt damage at point-blank vs max range (also scales with charge). */
  const RANGED_DIST_DMG_MIN_MUL = 0.88;
  const RANGED_DIST_DMG_MAX_MUL = 1.14;
  const SPREAD_PELLET_COUNT = 3;
  const SPREAD_CONE_HALF_ANGLE = 0.21;
  const SPREAD_MAX_DIST = 172;
  const SPREAD_SPEED = 430;
  const SPREAD_HIT_R = 10;
  const SPREAD_ATTACK_COOLDOWN = 0.54;
  const SPREAD_DAMAGE_BASE = 8;
  const SPREAD_DAMAGE_MAX = 13;
  /** Pellet damage at point-blank vs at max travel (inverse of Marksman). */
  const SPREAD_CLOSE_DMG_MUL = 1.3;
  const SPREAD_FAR_DMG_MUL = 0.46;
  const NOVA_PELLET_COUNT = 9;
  const NOVA_MAX_DIST = 158;
  const NOVA_SPEED = 400;
  const NOVA_HIT_R = 9;
  const NOVA_ATTACK_COOLDOWN = 0.54;
  const NOVA_DAMAGE_BASE = 8;
  const NOVA_DAMAGE_MAX = 14;
  /** Damage mul by angular tier from facing (0 = front, 4 = rear). */
  const NOVA_ANGLE_DMG_MUL = [1, 0.74, 0.55, 0.38, 0.24];
  /** Speed mul by the same tier — front bolts outrun side/rear shots. */
  const NOVA_ANGLE_SPEED_MUL = [1.18, 0.86, 0.72, 0.58, 0.46];
  /** Supernova instantly curses Nova herself with Chaos Field for this many
   *  seconds: while it's active, any knockback SHE takes (from anyone) is
   *  inverted into a pull (and amplified) if it would've pushed her, or
   *  simply amplified if it was already pulling her in. */
  const NOVA_ULT_CHAOS_DURATION = 10;
  const NOVA_ULT_CHAOS_FLIP_MUL = -10;
  const NOVA_ULT_CHAOS_PULL_MUL = 10;
  /** Chaos Field also cuts all damage Nova takes by this much while active. */
  const NOVA_ULT_CHAOS_DMG_RESIST_MUL = 0.85;
  const AURA_RADIUS_MIN = 32;
  const AURA_RADIUS_MAX = 72;
  const AURA_ATTACK_ACTIVE = 0.16;
  const BULWARK_AURA_DAMAGE_MIN = 5;
  /** Aura damage at charge ratio 1.0 (scales linearly beyond with no hard cap). */
  const BULWARK_AURA_DAMAGE_MAX = 10;
  const BULWARK_AURA_PULSE_CD = 0.16;
  /** Bulwark fills the standard charge bar this many times slower than default. */
  const BULWARK_CHARGE_SPEED_MUL = 0.7;
  /** Quick taps below this raw charge ratio do not fire a barrage at all. */
  const BULWARK_TAP_IGNORE_RAW = 0.12;
  /** Sub-full charge is damped by this exponent (higher = weaker taps). */
  const BULWARK_EFFECTIVE_RATIO_POWER = 2.45;
  /** Charge bar lost when Bulwark is hit while charging (fraction of MAX_CHARGE). */
  const BULWARK_HIT_CHARGE_LOSS = 0.17;
  const BULWARK_HIT_CHARGE_LOSS_PER_HP = 0.4;
  const BULWARK_HIT_CHARGE_LOSS_MIN = 0.1;
  const BULWARK_HIT_CHARGE_LOSS_MAX = 0.3;
  /** Passive HP recovery while alive (very slow). */
  const BULWARK_REGEN_PER_SEC = 1.05;
  /** Every roster character (not bosses) passively heals this fraction of
   *  their max HP per second while alive. */
  const UNIVERSAL_REGEN_PCT_PER_SEC = 0.01;
  /** Ult charge gained per damage taken (vs ULTIMATE_CD_PER_DAMAGE when dealing). */
  const BULWARK_HIT_ULT_CHARGE_MUL = 1.2;
  /** Unbreakable ult — move speed multiplier on top of Bulwark's base. */
  const BULWARK_ULT_MOVE_SPEED_MUL = 1.55;
  /** Unbreakable fortify duration — while active, attack becomes the old charged aura. */
  const BULWARK_ULT_RESIST_DURATION = 10;
  /** Unbreakable damage taken while active — 0.8 = 20% shield. */
  const BULWARK_ULT_RESIST_DMG_MUL = 0.8;
  /** Aura charge rate during Unbreakable (circle pulse). */
  const BULWARK_AURA_CHARGE_SPEED_MUL = 2.6;
  /** Unbreakable's charge cap, as a multiple of the standard MAX_CHARGE ceiling. */
  const BULWARK_UNBREAKABLE_CHARGE_CAP_MUL = 5;
  /** Bulwark main attack — chaotic low-damage pellet barrages. */
  const BULWARK_BARRAGE_COUNT_MIN = 10;
  const BULWARK_BARRAGE_COUNT_MAX = 20;
  /** Full cone width (radians) for random spray. */
  const BULWARK_BARRAGE_CONE = 1.05;
  const BULWARK_BARRAGE_SPEED = 375;
  const BULWARK_BARRAGE_SPEED_JITTER = 0.32;
  const BULWARK_BARRAGE_MAX_DIST = 152;
  const BULWARK_BARRAGE_HIT_R = 5.5;
  const BULWARK_BARRAGE_COOLDOWN = 0.5;
  /** How long the barrage keeps randomly spitting pellets after release. */
  const BULWARK_BARRAGE_DURATION = 1.05;
  /** Per-pellet damage (intentionally low — volume does the work). */
  const BULWARK_BARRAGE_DAMAGE = 2.35;
  const BULWARK_BARRAGE_KNOCK = 0.022;
  const RICOCHET_SHOT_SPEED = 480;
  const RICOCHET_MAX_DIST = 1280;
  const RICOCHET_MAX_BOUNCES = 12;
  const RICOCHET_HIT_R = 11;
  const RICOCHET_ATTACK_COOLDOWN = 0.22;
  const RICOCHET_SHOT_LIFE = 7;
  /** Prism Cascade ult bolt lifetime (before hit resets). */
  const RICOCHET_ULT_SHOT_LIFE = 14;
  /** Each enemy hit resets the bolt's lifetime, and the reset target itself
   *  grows by this much every hit — a small step each time, capped so a
   *  long hit streak stretches it past the base 14s without going wild. */
  const RICOCHET_ULT_LIFE_GROWTH_PER_HIT = 2;
  const RICOCHET_ULT_LIFE_CAP = 24;
  const RICOCHET_ULT_SHOT_COUNT = 5;
  /** Full fan width (radians) for the five ult bolts. */
  const RICOCHET_ULT_SPREAD = 0.58;
  /** Prism Cascade — each wall bounce nudges the bolt's new direction this
   *  many radians toward the nearest valid enemy, instead of a pure
   *  physics reflection. Small per bounce; compounds over a bolt's many
   *  bounces into a real (but not overwhelming) homing tendency. */
  const RICOCHET_ULT_BOUNCE_HOMING_TURN = 0.35;
  /** Ricochet bolts accelerate while airborne (px/s²), capped by mul of launch speed. */
  const RICOCHET_SPEED_ACCEL = 120;
  const RICOCHET_SPEED_MAX_MUL = 2.4;
  /** Other bolts (Marksman / Spread / Nova / Phoenix) accelerate more gently. */
  const BOLT_SPEED_ACCEL = 85;
  const BOLT_SPEED_MAX_MUL = 1.9;
  /** Extra time added to the bolt each time it hits a fighter. */
  const RICOCHET_LIFE_BONUS_ON_HIT = 3;
  const RICOCHET_SHOT_LIFE_CAP = 25;
  /** A fully-charged shot's hit-refresh life cap can climb this much higher
   *  than a tap-fired shot's (interpolated by charge ratio). */
  const RICOCHET_SHOT_LIFE_CAP_CHARGE_BONUS = 12;
  /** Flat initial bolt damage at 0 wall bounces; walls scale this exponentially. */
  const RICOCHET_DAMAGE_INITIAL = 1;
  /** A bare-tap shot deals only this fraction of a fully-charged shot's
   *  damage (interpolated by charge ratio) at every bounce, not just the
   *  first hit — a weakly-charged bolt should stay weaker throughout. */
  const RICOCHET_CHARGE_DAMAGE_MIN_MUL = 0.5;
  /** Damage multiplies by this each wall bounce (at bounceDmgMul = 1). */
  const RICOCHET_WALL_DMG_EXP = 1.88;
  /** A fully-charged shot's per-bounce damage growth is boosted by up to this
   *  much (interpolated by charge ratio) over a tap-fired shot's. */
  const RICOCHET_CHARGE_BOUNCE_DMG_MUL_MAX = 1.6;
  /** AI bank-shot aim offset from the direct line to the target — a 0-bounce
   *  direct hit deals minimal damage, so the AI aims off to one side to
   *  clip a wall first instead of firing straight at its target. */
  const RICOCHET_AI_BANK_ANGLE_MIN = Math.PI / 7;
  const RICOCHET_AI_BANK_ANGLE_MAX = Math.PI / 4;
  /** After a player hit, ignore further player collisions briefly. */
  const RICOCHET_HIT_LOCK = 0.16;
  /** Extra separation so the bolt does not re-enter the same frame. */
  const RICOCHET_EXIT_PAD = 20;
  /** Fraction of damage dealt that heals Reaver (Grasp, Ruin, Hook). */
  const REAVER_LIFESTEAL_MUL = 0.48;
  /** Multiplier on dash/melee recovery (slower between strikes). */
  const REAVER_ATTACK_CD_MUL = 1.78;
  /** Ruin Burst — telegraphed AoE slam (second ability). */
  const REAVER_RUIN_WINDUP = 1.05;
  const REAVER_RUIN_COOLDOWN = 9.5;
  const REAVER_RUIN_RADIUS = 136;
  const REAVER_RUIN_DAMAGE = 14;
  const REAVER_RUIN_ROOT_DURATION = 1.35;
  const REAVER_RUIN_KNOCK_MUL = 0.08;
  const REAVER_RUIN_TRIGGER_DIST = 120;
  const REAVER_RUIN_VFX = 0.45;
  /** Soul Hook — mid-range pull (third ability). */
  const REAVER_HOOK_WINDUP = 0.5;
  const REAVER_HOOK_COOLDOWN = 8.5;
  const REAVER_HOOK_RANGE = 310;
  const REAVER_HOOK_SPEED = 540;
  const REAVER_HOOK_HALF_WIDTH = 16;
  const REAVER_HOOK_DAMAGE = 10;
  const REAVER_HOOK_KNOCK_MUL = 0.04;
  const REAVER_HOOK_PULL_TIME = 0.42;
  const REAVER_HOOK_PULL_STOP = 44;
  const REAVER_HOOK_TRIGGER_MIN = 150;
  const REAVER_HOOK_TRIGGER_MAX = 330;
  const REAVER_HOOK_MISS_RETRACT = 0.22;
  /** After Soul Hook pull ends — can move, cannot attack. */
  const REAVER_HOOK_DISARM_DURATION = 1.4;
  /** Soul Grasp — heavy strike while overlapping a hero (replaces dash). */
  const REAVER_GRASP_WINDUP = 0.38;
  const REAVER_GRASP_DAMAGE = 34;
  const REAVER_GRASP_TOUCH_PAD = 6;
  const REAVER_GRASP_KNOCK_MUL = 0.14;
  const REAVER_GRASP_VFX = 0.28;
  /** Hexwright — toxic bottles & summoned thralls. */
  const HEX_BOTTLE_WINDUP = 0.45;
  const HEX_BOTTLE_COOLDOWN = 3.4;
  const HEX_BOTTLE_SPEED = 360;
  const HEX_BOTTLE_RANGE = 740;
  const HEX_BOTTLE_TRIGGER_MIN = 70;
  const HEX_BOTTLE_TRIGGER_MAX = 760;
  const HEX_PUDDLE_RADIUS = 54;
  const HEX_PUDDLE_DURATION = 8.5;
  const HEX_PUDDLE_DPS = 8.5;
  const HEX_PUDDLE_SLOW_MUL = 0.46;
  const HEX_SUMMON_WINDUP = 0.75;
  const HEX_SUMMON_COOLDOWN = 10.5;
  const HEX_MINION_CAP = 3;
  const HEX_MINION_HP = 24;
  const HEX_MINION_RADIUS = 11;
  const HEX_MINION_SPEED = 52;
  const HEX_MINION_TOUCH = 3.8;
  const HEX_TELEPORT_WINDUP = 0.55;
  const HEX_TELEPORT_COOLDOWN = 4.5;
  const HEX_TELEPORT_DIST_MIN = 135;
  const HEX_TELEPORT_DIST_MAX = 200;
  const HEX_TELEPORT_TRIGGER_DIST = 100;
  const HEX_TELEPORT_VFX = 0.3;
  /** Hexwright tries to stay near this distance from heroes (not rush in). */
  const HEX_KITE_DIST_IDEAL = 230;
  const HEX_KITE_DIST_MIN = 155;
  const HEX_KITE_DIST_MAX = 310;
  const CREATURE_RADIUS = 12;
  const CREATURE_MAX_HP = 1;
  const CREATURE_SPEED = 118;
  const CREATURE_TOUCH_DAMAGE = 3.5;
  const CREATURE_TOUCH_COOLDOWN = 0.52;
  const CREATURE_SPAWN_INTERVAL = 3.1;
  const CREATURE_SPAWN_JITTER = 1.35;
  const CREATURE_MAX_ALIVE = 10;
  const CREATURE_SPAWN_CLEAR = 20;

  const HORDE_WAVE_INTERMISSION = 3.2;
  /** Extra breath after a horde boss falls (waves 25, 50, …). */
  const HORDE_BOSS_WAVE_INTERMISSION = 5.2;
  const HORDE_BOSS_WAVE_INTERVAL = 25;
  const HORDE_DOWN_BLEED = 14;
  const HORDE_SUPPORT_RANGE = 54;
  const HORDE_HEAL_PER_SEC = 26;
  const HORDE_REVIVE_TIME = 2.6;
  const HORDE_REVIVE_HP_MUL = 0.42;
  /** Bleed bar refill per second while an ally is channeling revive (full bar in revive time). */
  const HORDE_REVIVE_BLEED_RESTORE_PER_SEC =
    HORDE_DOWN_BLEED / HORDE_REVIVE_TIME;
  /** Attack charge multiplier while actively healing or reviving an ally. */
  const HORDE_SUPPORT_CHARGE_MUL = 0.42;
  const HORDE_HOSTILE_SHOT_SPEED = 240;
  /** Global horde foe walk/charge speed scale (lower = much slower). */
  const HORDE_ENEMY_SPEED_MUL = 0.35;
  const WAVE_ENEMY_KINDS = {
    swarmling: {
      r: 13,
      hp: 6,
      speed: 118,
      touchDamage: 1.5,
      color: "#88dd66",
      attack: "melee",
    },
    grunt: {
      r: 15,
      hp: 10,
      speed: 96,
      touchDamage: 2.1,
      color: "#e85d6a",
      attack: "melee",
    },
    skitter: {
      r: 12,
      hp: 7,
      speed: 128,
      touchDamage: 1.7,
      color: "#c4f542",
      attack: "melee",
    },
    spitter: {
      r: 14,
      hp: 8,
      speed: 86,
      touchDamage: 1.2,
      color: "#5cc8ff",
      attack: "spit",
    },
    charger: {
      r: 16,
      hp: 11,
      speed: 100,
      touchDamage: 2.4,
      color: "#ffb347",
      attack: "charge",
    },
    bruiser: {
      r: 20,
      hp: 17,
      speed: 66,
      touchDamage: 2.8,
      color: "#9a6bff",
      attack: "slam",
    },
  };
  const POUND_WINDUP = 0.55;
  const POUND_COOLDOWN = 6;
  const POUND_RADIUS = 102;
  const POUND_DAMAGE = 32;
  const POUND_TRIGGER_DIST = 90;
  const POUND_BLAST_VFX = 0.4;
  const POUND_KNOCK_MUL = 1.35;
  /** Boss scorch beam — long wind-up, then a slow sweep toward nearby heroes. */
  const BOSS_BEAM_WINDUP = 1.18;
  const BOSS_BEAM_DURATION = 0.88;
  const BOSS_BEAM_SWEEP_SPEED = 0.52;
  const BOSS_BEAM_COOLDOWN = 7;
  const BOSS_BEAM_RANGE = 340;
  const BOSS_BEAM_HALF_WIDTH = 30;
  const BOSS_BEAM_DPS = 19;
  const BOSS_BEAM_TRIGGER_MIN = 100;
  const BOSS_BEAM_TRIGGER_MAX = 330;
  const LASER_RANGE = 285;
  const LASER_BEAM_HALF_WIDTH = 36;
  const LASER_DPS = 19;
  /** Hold attack this long before the beam deals damage. */
  const LASER_WINDUP = 0.62;
  /** Time in beam to reach max ramp multiplier. */
  const LASER_DWELL_RAMP_SEC = 1.12;
  /** Max damage multiplier while a target stays continuously in the beam. */
  const LASER_DWELL_MAX_MUL = 2.4;
  /** Damage multiplier at the outer edge of the beam (center = 1×). */
  const LASER_EDGE_DMG_MUL = 0.26;
  const LASER_MISS_DRAIN_PER_SEC = 11;
  /** Ultimate beam re-aim turn speed (rad/sec) — the beam rotates toward
   *  the target angle at this rate instead of snapping straight to it.
   *  Mouse aim gets its own, slower rate than gamepad aim/keyboard direction
   *  since a mouse can whip the target angle around far more abruptly. */
  const LASER_ULT_TURN_SPEED = 9;
  const LASER_ULT_MOUSE_TURN_SPEED = 4.5;
  /** Self-drain while hitting off-center (scales with how far from beam core). */
  const LASER_OFF_CENTER_DRAIN_PER_SEC = 4.2;
  const LASER_MOVE_MUL = 0.72;
  /** Ally AI: how long to hold the beam per burst. */
  const LASER_AI_BURST_MIN_HIT = 0.42;
  const LASER_AI_BURST_MAX_MISS = 0.55;
  const LASER_AI_BURST_MAX = 1.05;
  const LASER_AI_RELEASE_HP = 0.28;
  const LASER_AI_COOLDOWN = 0.62;
  /** Grace period after spawn before ally Laser may open fire. */
  const LASER_AI_START_DELAY = 1.4;

  const keys = Object.create(null);
  const projectiles = [];
  /** Lightweight VFX particles (hits, deaths, spawns, dashes). */
  const animFx = [];
  const ANIM_FX_CAP = 220;

  const CHARACTERS = {
    brawler: {
      id: "brawler",
      name: "Brawler",
      attackStyle: "melee",
      // Brawler is the roster's only pure short-range melee fighter with no
      // built-in mobility tool (no dash/hook/phase like everyone else has),
      // so it gets extra HP and base move speed to compensate for having to
      // walk into range under fire instead of poking or blinking in.
      maxHp: Math.round(MAX_HP * 1.15),
      moveSpeedMul: 1.3,
      chargeSpeedMul: 1.12,
      attackDamageMul: 1,
      desc: "132 HP — charge melee. <strong>Ult (C)</strong>: Seismic Slam — AoE stun (damage lowers cooldown).",
      tint: "#ef4444",
    },
    marksman: {
      id: "marksman",
      name: "Marksman",
      attackStyle: "ranged",
      maxHp: 82,
      moveSpeedMul: 0.98,
      rangedRangeMul: 1.86,
      attackDamageMul: 0.94,
      desc: "94 HP — long-range bolts. <strong>Ult</strong>: Deadeye Barrage — rapid volley.",
      tint: "#a78bfa",
    },
    striker: {
      id: "striker",
      name: "Striker",
      attackStyle: "dash",
      maxHp: 84,
      moveSpeedMul: 1.08,
      attackDamageMul: 1,
      desc: "97 HP — dash assassin. <strong>Ult</strong>: Phantom Rush — triple blink strike; hits heal you.",
      tint: "#fbbf24",
    },
    bulwark: {
      id: "bulwark",
      name: "Bulwark",
      attackStyle: "barrage",
      maxHp: 158,
      moveSpeedMul: 0.74,
      hitRadiusMul: 1.32,
      chargeSpeedMul: BULWARK_CHARGE_SPEED_MUL,
      knockbackResistMul: 0.4,
      desc: "182 HP tank — charged pellet barrages. <strong>Ult</strong>: Unbreakable — fortify and charge the old aura (fast charge); auto-fires the aura when it ends; faster move while active.",
      tint: "#6ee7b7",
    },
    ricochet: {
      id: "ricochet",
      name: "Ricochet",
      attackStyle: "bounce",
      maxHp: 86,
      moveSpeedMul: 0.98,
      attackDamageMul: 0.94,
      desc: "99 HP — hold to charge wall-bounce bolts. <strong>Ult</strong>: Prism Cascade — bolt volley.",
      tint: "#38bdf8",
    },
    laser: {
      id: "laser",
      name: "Laser",
      attackStyle: "beam",
      maxHp: 104,
      moveSpeedMul: 0.96,
      attackDamageMul: 0.94,
      desc: "120 HP — ramping beam. <strong>Ult</strong>: Meltdown — heavily overcharged beam, no self-drain.",
      tint: "#f472b6",
    },
    scatter: {
      id: "scatter",
      name: "Scatter",
      attackStyle: "spread",
      maxHp: 88,
      moveSpeedMul: 1,
      attackDamageMul: 0.92,
      spreadRangeMul: 1.02,
      desc: "101 HP — 3-shot cone. <strong>Ult</strong>: Shrapnel Storm — dense shotgun burst.",
      tint: "#fb923c",
    },
    nova: {
      id: "nova",
      name: "Nova",
      attackStyle: "nova",
      maxHp: 90,
      moveSpeedMul: 0.98,
      attackDamageMul: 1,
      novaRangeMul: 1,
      desc: "104 HP — directional burst; phases through fighters. <strong>Ult</strong>: Supernova — no damage; curses herself with Chaos Field for 10s, turning any knockback she takes into a powerful pull and cutting all damage she takes by 15%.",
      tint: "#e879f9",
    },
    phoenix: {
      id: "phoenix",
      name: "Phoenix",
      attackStyle: "phoenix",
      maxHp: 50,
      moveSpeedMul: 1.02,
      attackDamageMul: 0.9,
      desc: "58 HP — hop & rear flame bolts. <strong>Ult</strong>: Rebirth — big damage buff + forward narrow bolts; rise once if slain soon after.",
      tint: "#f97316",
    },
    echo: {
      id: "echo",
      name: "Echo",
      attackStyle: "ranged",
      maxHp: 54,
      moveSpeedMul: 1,
      rangedRangeMul: 1.2,
      attackDamageMul: 0.8,
      desc: "62 HP — medium bolts. <strong>Ult</strong>: Mirror Pack — six frail cone clones that copy your moves for a short time.",
      tint: "#818cf8",
    },
    pike: {
      id: "pike",
      name: "Pike",
      attackStyle: "lance",
      maxHp: 88,
      moveSpeedMul: 0.96,
      chargeSpeedMul: 1.05,
      attackDamageMul: 0.98,
      desc: "101 HP — charged long, narrow spear corridor (weaker up close, stronger at range). <strong>Ult</strong>: Hunting Spear — launch a homing spear that deals massive damage on impact; enemies can destroy it by attacking it.",
      tint: "#38bdf8",
    },
    grappler: {
      id: "grappler",
      name: "Grappler",
      attackStyle: "ranged",
      maxHp: 90,
      moveSpeedMul: 1.01,
      rangedRangeMul: 1.32,
      attackDamageMul: 0.95,
      chargeSpeedMul: 1.02,
      desc: "104 HP — pull bolts (more damage up close, reverse knockback). <strong>Ult</strong>: Chain Hook — snag a foe and reel them in; landing it boosts your charge speed.",
      tint: "#14b8a6",
    },
    siphon: {
      id: "siphon",
      name: "Siphon",
      attackStyle: "ranged",
      maxHp: 84,
      moveSpeedMul: 1.02,
      rangedRangeMul: 1.2,
      attackDamageMul: 0.94,
      chargeSpeedMul: SIPHON_FAST_CHARGE_MUL,
      desc: "97 HP — bolts that grow and speed up with charge; every 3rd shot has a 5s reload. <strong>Ult</strong>: Vacuum Rift — phase out (no hitbox), pull foes in, then a shockwave that blasts them out; hit fighters charge 75% slower for 2s.",
      tint: "#f43f5e",
    },
    marionette: {
      id: "marionette",
      name: "Marionette",
      attackStyle: "ranged",
      maxHp: 78,
      moveSpeedMul: 1,
      rangedRangeMul: 1.4,
      attackDamageMul: 0.6,
      desc: "90 HP — fast piercing needles that skewer everyone in their path. <strong>Ult</strong>: Effigy — brief windup, then a big, slightly-seeking spike; on a fighter hit, binds an effigy in front of you. Enemies can pop it freely, but only your own hits on it also wound the bound target.",
      tint: "#7c3aed",
    },
  };

  const CHARACTER_IDS = Object.keys(CHARACTERS);
  const RANDOM_CHAR_ID = "random";
  const CHARACTER_SELECT_IDS = [RANDOM_CHAR_ID].concat(CHARACTER_IDS);
  const RANDOM_CHAR_META = {
    id: RANDOM_CHAR_ID,
    name: "Random",
    desc: "Roll a random fighter when the match starts.",
    tint: "#c4f542",
  };

  const ARENA_SHAPE_OPTIONS = [
    {
      key: "circle",
      name: "Colosseum",
      desc: "Circular floor — classic open duel.",
    },
    {
      key: "rect",
      name: "Classic box",
      desc: "Rectangular hall with sharp corners.",
    },
  ];

  const MAP_MODIFIER_TOGGLES = [
    {
      key: "pillars",
      name: "Pillars",
      desc: "Scattered columns for cover.",
    },
    {
      key: "lattice",
      name: "Lattice",
      desc: "Grid of pillars that splits lanes.",
    },
    {
      key: "ring",
      name: "Center island",
      desc: "Large obstacle in the middle.",
    },
    {
      key: "maze",
      name: "Labyrinth",
      desc: "Winding wall corridors.",
    },
    {
      key: "movers",
      name: "Crush blocks",
      desc: "Heavy blocks slide back and forth.",
    },
    {
      key: "portals",
      name: "Warp gates",
      desc: "Teleporters around the arena.",
    },
    {
      key: "creatures",
      name: "Critters",
      desc: "Weak spawns that nip everyone.",
    },
  ];

  function defaultMapModifiers() {
    return {
      bounds: "circle",
      pillars: false,
      lattice: false,
      ring: false,
      maze: false,
      movers: false,
      portals: false,
      creatures: false,
    };
  }

  /** Keyboard humans — remainder of the team can be AI. */
  const ULTIMATE_CD_PER_DAMAGE = 0.11;
  /** Extra ult charge (seconds of CD wiped) when you KO a fighter. */
  const ULTIMATE_CD_ON_KILL = 0;
  /** Ult charge granted to you when you die (helps rebound after a KO). */
  const ULTIMATE_CD_ON_DEATH = 18;
  /** Ult charge from thralls / Echo clones / critters (vs full fighter rate). */
  const ULTIMATE_CD_PER_DAMAGE_MINION = 0.028;
  const ULTIMATE_BASE_CD = {
    brawler: 48,
    marksman: 50,
    striker: 46,
    bulwark: 52,
    ricochet: 48,
    laser: 50,
    scatter: 47,
    nova: 48,
    phoenix: 48,
    echo: 48,
    pike: 50,
    grappler: 52,
    siphon: 50,
    marionette: 54,
  };

  const HUMAN_PRESETS = [
    {
      color: "#3dd6ff",
      controls: {
        up: "KeyW",
        down: "KeyS",
        left: "KeyA",
        right: "KeyD",
        attack: "Space",
        support: "KeyB",
        ultimate: "KeyC",
      },
    },
    {
      color: "#ff6b9d",
      controls: {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
        attack: "Enter",
        support: "Slash",
        ultimate: "ShiftRight",
      },
    },
    {
      color: "#c8f94d",
      controls: {
        up: "KeyI",
        down: "KeyK",
        left: "KeyJ",
        right: "KeyL",
        attack: "KeyO",
        support: "KeyP",
        ultimate: "BracketLeft",
      },
    },
    {
      color: "#f59e0b",
      controls: {
        up: "Numpad8",
        down: "Numpad5",
        left: "Numpad4",
        right: "Numpad6",
        attack: "Numpad0",
        support: "NumpadDecimal",
        ultimate: "Numpad1",
      },
    },
    {
      color: "#22d3ee",
      controls: {
        up: "KeyT",
        down: "KeyG",
        left: "KeyF",
        right: "KeyH",
        attack: "KeyY",
        support: "KeyU",
        ultimate: "KeyH",
      },
    },
    {
      color: "#a3e635",
      controls: {
        up: "Numpad7",
        down: "Numpad1",
        left: "Numpad9",
        right: "Numpad3",
        attack: "NumpadEnter",
        support: "NumpadAdd",
        ultimate: "Numpad3",
      },
    },
  ];

  const ALLY_AI_COLORS = [
    "#c8f94d",
    "#c084fc",
    "#fb923c",
    "#f472b6",
    "#38bdf8",
    "#e879f9",
  ];

  function readHumanCount() {
    const raw = humanCountSelect
      ? parseInt(humanCountSelect.value, 10)
      : 2;
    return clamp(
      Number.isFinite(raw) ? raw : 2,
      0,
      HUMAN_PRESETS.length
    );
  }

  function maxAiSlots(humanCount) {
    return MAX_TEAM_FIGHTERS - humanCount;
  }

  function readAiCount() {
    const h = readHumanCount();
    const cap = maxAiSlots(h);
    const raw = aiCountSelect ? parseInt(aiCountSelect.value, 10) : 0;
    return clamp(Number.isFinite(raw) ? raw : 0, 0, cap);
  }

  function readRoster() {
    const humans = readHumanCount();
    const ai = readAiCount();
    const total = humans + ai;
    return { humans, ai, total };
  }

  function readLivesPerPlayer() {
    const raw = livesCountSelect ? parseInt(livesCountSelect.value, 10) : 1;
    return clamp(Number.isFinite(raw) ? raw : 1, 1, 10);
  }

  function matchUsesLives() {
    if (gameMode === "siege") return true;
    return (
      readLivesPerPlayer() > 1 &&
      (gameMode === "versus" || gameMode === "teams" || gameMode === "boss")
    );
  }

  function updateLivesSelectVisibility() {
    if (!livesCountRow) return;
    const show =
      characterPickerOpen &&
      (gameMode === "versus" || gameMode === "teams" || gameMode === "boss");
    livesCountRow.hidden = !show;
  }

  function fighterStillInMatch(p) {
    if (!p) return false;
    if (p.isBot) return p.hp > 0;
    if (p.eliminated) return false;
    if (gameMode === "siege") return true;
    if (matchUsesLives()) {
      // Mid-respawn fighters still have lives and count as in the match.
      return (p.lives || 0) > 0;
    }
    return p.hp > 0;
  }

  function fighterIsVulnerable(p) {
    if (p.eliminated) return false;
    if ((p.respawnT || 0) > 0) return false;
    if ((p.respawnInvulnT || 0) > 0) return false;
    if (isSiphonPhasing(p)) return false;
    if (p.hp <= 0) return false;
    return true;
  }

  function clearFighterCombatState(p) {
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.attackT = 0;
    p.cooldown = 0;
    p.stunT = 0;
    p.dashT = 0;
    p.dashTraveled = 0;
    p.chargeHoldT = 0;
    p.needsRelease = false;
    p.botMustRelease = false;
    p.attackHoldT = 0;
    p.beamWindupT = 0;
    p.beamFiring = false;
    setLaserBeamActive(p, false);
  }

  function beginFighterRespawn(p) {
    p.respawnT = RESPAWN_DELAY;
    // Stay at the KO spot so double-kills don't empty the arena instantly.
    // Teleport home when the respawn timer finishes.
    p.vx = 0;
    p.vy = 0;
    clearFighterCombatState(p);
  }

  function completeFighterRespawn(p) {
    const home = clampPointToArena(
      p.spawnHomeX != null ? p.spawnHomeX : p.x,
      p.spawnHomeY != null ? p.spawnHomeY : p.y,
      getPlayerRadius(p) + 4
    );
    p.x = home.x;
    p.y = home.y;
    p.vx = 0;
    p.vy = 0;
    p.hp = p.maxHp;
    p.respawnT = 0;
    p.respawnInvulnT = RESPAWN_INVULN;
    cancelPhoenixReviveState(p);
    spawnPopBurst(p.x, p.y, p.color);
    p.squashX = 0.7;
    p.squashY = 1.35;
    refreshHudLabels();
  }

  function tickFighterRespawn(p, dt) {
    if (!matchUsesLives() || p.isBot) return;
    if ((p.respawnInvulnT || 0) > 0) {
      p.respawnInvulnT = Math.max(0, p.respawnInvulnT - dt);
    }
    if ((p.respawnT || 0) <= 0) return;
    p.respawnT = Math.max(0, p.respawnT - dt);
    if (p.respawnT <= 0) {
      completeFighterRespawn(p);
    }
  }

  function handleFighterDeath(p, killer) {
    if (p.hp > 0) return;
    if (tryPhoenixUltRebirth(p)) return;
    // Died without Rebirth saving them (real death this life) — all of
    // Phoenix's permanent revive-stack buffs/bonuses reset, so the next
    // Rebirth revive (in a future life) starts fresh at 75% HP instead of
    // compounding stacks carried over from a previous life.
    if (isPhoenix(p)) {
      p.phoenixReviveStacks = 0;
      p.phoenixRebirthDmgBonus = 0;
      p.phoenixReviveBuffT = 0;
      p.ultDmgMulT = 0;
    }
    if (gameMode === "horde" && isHordeHero(p)) {
      hordeEnterDowned(p);
      grantUltimateKillCharge(killer, p);
      grantUltimateDeathCharge(p);
      return;
    }
    grantUltimateKillCharge(killer, p);
    grantUltimateDeathCharge(p);
    if (gameMode === "siege") {
      const myBase = mapRuntime.bases.find((b) => b.team === p.fightTeam);
      if (myBase && !myBase.destroyed) {
        beginFighterRespawn(p);
      } else {
        p.eliminated = true;
        p.respawnT = 0;
      }
      refreshHudLabels();
      queueWinCheck();
      return;
    }
    if (!matchUsesLives() || p.isBot) {
      queueWinCheck();
      return;
    }
    p.lives = Math.max(0, (p.lives || 1) - 1);
    if (p.lives > 0) {
      beginFighterRespawn(p);
    } else {
      p.eliminated = true;
      p.respawnT = 0;
    }
    refreshHudLabels();
    queueWinCheck();
  }

  function syncRosterSelectOptions() {
    const maxHumans = Math.min(HUMAN_PRESETS.length, MAX_TEAM_FIGHTERS);
    if (humanCountSelect) {
      const cur = parseInt(humanCountSelect.value, 10);
      humanCountSelect.innerHTML = "";
      for (let n = 0; n <= maxHumans; n++) {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = String(n);
        humanCountSelect.appendChild(opt);
      }
      humanCountSelect.value = String(
        clamp(Number.isFinite(cur) ? cur : 2, 0, maxHumans)
      );
    }
    if (aiCountSelect) {
      const cur = parseInt(aiCountSelect.value, 10);
      aiCountSelect.innerHTML = "";
      for (let n = 0; n <= MAX_TEAM_FIGHTERS; n++) {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = String(n);
        aiCountSelect.appendChild(opt);
      }
      aiCountSelect.value = String(
        clamp(Number.isFinite(cur) ? cur : 1, 0, MAX_TEAM_FIGHTERS)
      );
    }
  }

  function syncAiSelectCap() {
    if (!aiCountSelect || !humanCountSelect) return;
    const h = readHumanCount();
    const cap = maxAiSlots(h);
    let cur = parseInt(aiCountSelect.value, 10);
    Array.from(aiCountSelect.options).forEach((opt) => {
      const v = parseInt(opt.value, 10);
      opt.disabled = v > cap;
    });
    if (!Number.isFinite(cur) || cur > cap) {
      aiCountSelect.value = String(cap);
    }
  }

  function updateVersusButtonState() {
    if (btnVersus) {
      btnVersus.disabled = false;
      btnVersus.title = "";
    }
    if (btnTeams) {
      btnTeams.disabled = false;
      btnTeams.title = "2-4 teams. Assign teams on character select.";
    }
    if (btnHorde) {
      btnHorde.disabled = false;
      btnHorde.title = "";
    }
  }

  function updateBossModeHint() {
    if (!btnBoss) return;
    btnBoss.disabled = false;
    btnBoss.title =
      "Co-op vs boss — pick Colossus or Reaver. Set squad size on character select.";
  }

  function updateCharContinueState() {
    if (!btnCharContinue) return;
    const roster = readRoster();
    let disabled = roster.total < 1;
    if (
      (gameMode === "versus" || gameMode === "teams") &&
      roster.total < 2
    ) {
      disabled = true;
    }
    if (gameMode === "teams" && !teamsRosterValid()) {
      disabled = true;
    }
    btnCharContinue.disabled = disabled;
  }

  function onRosterControlsChanged() {
    syncRosterSelectOptions();
    syncAiSelectCap();
    const roster = readRoster();
    if (roster.humans === 0 && roster.ai === 0 && aiCountSelect) {
      aiCountSelect.value = "1";
    }
    if (characterPickerOpen) {
      buildCharSelectUI();
      updateCharContinueState();
      refreshHudLabels();
    } else {
      updateVersusButtonState();
      updateBossModeHint();
    }
    updateHudLayout();
    updateLivesSelectVisibility();
    setHelpText();
    refreshBossHudLabel();
  }

  function mazeGridCenter(gx, gy) {
    // Must match buildMazeWallsFromGrid's own bounds exactly (pad 0) — any
    // extra padding here shifts cell centers out of alignment with the
    // actual wall rects, letting them drift into walls for cells away from
    // the arena center.
    const b = rectArenaBounds(0);
    const cols = MAZE_GRID[0].length;
    const rows = MAZE_GRID.length;
    const cellW = (b.maxX - b.minX) / cols;
    const cellH = (b.maxY - b.minY) / rows;
    return {
      x: b.minX + (gx + 0.5) * cellW,
      y: b.minY + (gy + 0.5) * cellH,
    };
  }

  function mazeCellSize() {
    const b = rectArenaBounds(0);
    return {
      w: (b.maxX - b.minX) / MAZE_GRID_BASE[0].length,
      h: (b.maxY - b.minY) / MAZE_GRID_BASE.length,
    };
  }

  function mazeNavRows() {
    return mapRuntime.mazeNavRows || null;
  }

  function mazeCellMetrics() {
    const rows = mazeNavRows();
    if (!rows) return null;
    const b = rectArenaBounds(PLAYER_R + 6);
    const cols = rows[0].length;
    const gridRows = rows.length;
    return {
      rows: rows,
      cols: cols,
      gridRows: gridRows,
      cellW: (b.maxX - b.minX) / cols,
      cellH: (b.maxY - b.minY) / gridRows,
      bounds: b,
    };
  }

  function mazeCellIsFloor(gx, gy, rows) {
    if (!rows || gy < 0 || gy >= rows.length || gx < 0 || gx >= rows[0].length) {
      return false;
    }
    return rows[gy][gx] === ".";
  }

  function mazeWorldToCell(x, y) {
    const m = mazeCellMetrics();
    if (!m) return null;
    const gx = Math.floor((x - m.bounds.minX) / m.cellW);
    const gy = Math.floor((y - m.bounds.minY) / m.cellH);
    if (gx < 0 || gy < 0 || gx >= m.cols || gy >= m.gridRows) return null;
    return { gx: gx, gy: gy, metrics: m };
  }

  function mazeNearestFloorCell(x, y) {
    const hit = mazeWorldToCell(x, y);
    if (!hit) return null;
    const rows = hit.metrics.rows;
    if (mazeCellIsFloor(hit.gx, hit.gy, rows)) {
      return { gx: hit.gx, gy: hit.gy, metrics: hit.metrics };
    }
    for (let ring = 1; ring <= 4; ring++) {
      for (let gx = hit.gx - ring; gx <= hit.gx + ring; gx++) {
        for (let gy = hit.gy - ring; gy <= hit.gy + ring; gy++) {
          if (mazeCellIsFloor(gx, gy, rows)) {
            return { gx: gx, gy: gy, metrics: hit.metrics };
          }
        }
      }
    }
    return null;
  }

  function mazeCellKey(gx, gy, cols) {
    return gy * cols + gx;
  }

  function mazeBfsPath(sx, sy, ex, ey, rows) {
    if (!mazeCellIsFloor(sx, sy, rows) || !mazeCellIsFloor(ex, ey, rows)) {
      return null;
    }
    if (sx === ex && sy === ey) {
      return [{ gx: sx, gy: sy }];
    }
    const cols = rows[0].length;
    const gridRows = rows.length;
    const total = cols * gridRows;
    const visited = new Uint8Array(total);
    const prev = new Int32Array(total);
    for (let i = 0; i < total; i++) prev[i] = -1;
    const qx = [sx];
    const qy = [sy];
    visited[mazeCellKey(sx, sy, cols)] = 1;
    let qi = 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (qi < qx.length) {
      const cx = qx[qi];
      const cy = qy[qi];
      qi++;
      if (cx === ex && cy === ey) {
        const path = [];
        let k = mazeCellKey(ex, ey, cols);
        while (k >= 0) {
          path.push({ gx: k % cols, gy: Math.floor(k / cols) });
          k = prev[k];
        }
        path.reverse();
        return path;
      }
      for (let d = 0; d < dirs.length; d++) {
        const nx = cx + dirs[d][0];
        const ny = cy + dirs[d][1];
        if (!mazeCellIsFloor(nx, ny, rows)) continue;
        const nk = mazeCellKey(nx, ny, cols);
        if (visited[nk]) continue;
        visited[nk] = 1;
        prev[nk] = mazeCellKey(cx, cy, cols);
        qx.push(nx);
        qy.push(ny);
      }
    }
    return null;
  }

  function mazeBfsStepCount(sx, sy, ex, ey, rows) {
    const path = mazeBfsPath(sx, sy, ex, ey, rows);
    if (!path) return Infinity;
    return Math.max(0, path.length - 1);
  }

  function mazeHasClearPath(x0, y0, x1, y1, pad) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = len(dx, dy);
    if (dist < 1e-3) return true;
    const clear = rayDistToArenaWall(x0, y0, dx / dist, dy / dist, pad);
    return clear >= dist * 0.9;
  }

  function mazeNavWaypoint(x0, y0, x1, y1, bodyR) {
    const rows = mazeNavRows();
    if (!rows) return null;
    const pad = (bodyR != null ? bodyR : PLAYER_R) + 10;
    if (mazeHasClearPath(x0, y0, x1, y1, pad)) return null;
    const start = mazeNearestFloorCell(x0, y0);
    const end = mazeNearestFloorCell(x1, y1);
    if (!start || !end) return null;
    const path = mazeBfsPath(start.gx, start.gy, end.gx, end.gy, rows);
    if (!path || path.length < 2) return null;
    const step = path[Math.min(2, path.length - 1)];
    return mazeGridCenter(step.gx, step.gy);
  }

  function mazeAdjustMoveIntent(p, ix, iy, goalX, goalY) {
    if (goalX == null || goalY == null || !mazeNavRows()) {
      return { ix: ix, iy: iy };
    }
    const mag = len(ix, iy);
    if (mag < 1e-3) return { ix: ix, iy: iy };
    const toGoalX = goalX - p.x;
    const toGoalY = goalY - p.y;
    const goalMag = len(toGoalX, toGoalY);
    if (goalMag < 1e-3) return { ix: ix, iy: iy };
    if (ix * toGoalX + iy * toGoalY < 0.12 * mag * goalMag) {
      return { ix: ix, iy: iy };
    }
    const wp = mazeNavWaypoint(p.x, p.y, goalX, goalY, getPlayerRadius(p));
    if (!wp) return { ix: ix, iy: iy };
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const wd = len(dx, dy);
    if (wd < 22) return { ix: ix, iy: iy };
    return { ix: (dx / wd) * mag, iy: (dy / wd) * mag };
  }

  function aiSteerNav(p, ix, iy, goalX, goalY) {
    const intent = mazeAdjustMoveIntent(p, ix, iy, goalX, goalY);
    return steerAroundObstacles(p, intent.ix, intent.iy);
  }

  function tickAiStuck(p, dt, wantsMove) {
    if (!wantsMove) {
      p.aiStuckT = 0;
      p.aiLastX = p.x;
      p.aiLastY = p.y;
      return;
    }
    const lx = p.aiLastX != null ? p.aiLastX : p.x;
    const ly = p.aiLastY != null ? p.aiLastY : p.y;
    if (len(p.x - lx, p.y - ly) < 3.2) {
      p.aiStuckT = (p.aiStuckT || 0) + dt;
    } else {
      p.aiStuckT = 0;
      p.aiLastX = p.x;
      p.aiLastY = p.y;
    }
  }

  function mazePickEscapeHeading(p, pad) {
    let best = null;
    let bestClear = 0;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const clear = rayDistToArenaWall(p.x, p.y, dx, dy, pad);
      if (clear > bestClear) {
        bestClear = clear;
        best = { x: dx, y: dy };
      }
    }
    return best;
  }

  function mazeSpawnGridSlots(count) {
    const slots = [
      [1, 1],
      [13, 11],
      [1, 11],
      [13, 1],
      [3, 5],
      [11, 5],
    ];
    const out = [];
    for (let i = 0; i < count; i++) {
      const s = slots[i % slots.length];
      out.push(mazeGridCenterT(s[0], s[1]));
    }
    return out;
  }

  function heroSpawnPositions(count) {
    if (mapModifiers.maze) {
      return mazeSpawnGridSlots(count).map((pt) => [pt.x, pt.y]);
    }
    const ac = arenaCenter();
    const ringR = arenaRadius() * 0.48;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const pt = clampPointToArena(
        ac.cx + Math.cos(a) * ringR,
        ac.cy + Math.sin(a) * ringR,
        PLAYER_R * 1.55
      );
      positions.push([pt.x, pt.y]);
    }
    return positions;
  }

  /** Siege has exactly two bases, so it stays locked to A/B; Teams mode
   *  opens up to the full roster of sides. */
  function teamIdsForMode() {
    return gameMode === "siege" ? ["a", "b"] : TEAM_IDS;
  }

  function slotFightTeam(index) {
    if (gameMode !== "teams" && gameMode !== "siege") return "a";
    const ids = teamIdsForMode();
    return ids.indexOf(slotTeams[index]) >= 0 ? slotTeams[index] : "a";
  }

  function assignBossHeroSpawns(cfgs) {
    const pad = PLAYER_R * 1.55;
    if (mapModifiers.maze) {
      const west = [
        mazeGridCenterT(1, 1),
        mazeGridCenterT(1, 11),
        mazeGridCenterT(3, 5),
      ];
      for (let i = 0; i < cfgs.length; i++) {
        const pt = west[i % west.length];
        cfgs[i].spawn = [pt.x, pt.y];
        cfgs[i].fightTeam = "a";
      }
      return;
    }
    const ac = arenaCenter();
    const heroCx = ac.cx - arenaRadius() * 0.4;
    const ringR = arenaRadius() * 0.32;
    for (let i = 0; i < cfgs.length; i++) {
      const a =
        cfgs.length === 1
          ? -Math.PI / 2
          : -Math.PI / 2 + (2 * Math.PI * i) / cfgs.length;
      const pt = clampPointToArena(
        heroCx + Math.cos(a) * ringR * 0.55,
        ac.cy + Math.sin(a) * ringR,
        pad
      );
      cfgs[i].spawn = [pt.x, pt.y];
      cfgs[i].fightTeam = "a";
    }
  }

  function bossSpawnPoint() {
    const pad = PLAYER_R * BOSS_RADIUS_MUL * 1.25;
    if (mapModifiers.maze) {
      const pt = mazeGridCenterT(13, 5);
      return clampPointToArena(pt.x, pt.y, pad);
    }
    const ac = arenaCenter();
    return clampPointToArena(
      ac.cx + arenaRadius() * 0.4,
      ac.cy,
      pad
    );
  }

  /** The 6 known-open maze cells used for team clustering, grouped into
   *  west/east halves (same coordinates the old fixed A/B layout used). */
  const MAZE_TEAM_SPAWN_SLOTS = [
    [1, 1],
    [1, 11],
    [3, 5],
    [13, 1],
    [13, 11],
    [11, 5],
  ];
  /** Known-open maze cells (in base-layout coordinates) used to pick a
   *  random pair of warp gate locations each match. */
  const MAZE_PORTAL_CELL_POOL = [
    [5, 1],
    [12, 10],
    [2, 4],
    [9, 6],
    [1, 1],
    [13, 11],
    [1, 11],
    [13, 1],
    [3, 5],
    [11, 5],
    [13, 5],
  ];
  /** Which of the 6 slots above go to each team, by how many teams are in
   *  play — kept inside the pre-verified-open set no matter the split. */
  const MAZE_TEAM_SLOT_GROUPS = {
    2: [[0, 1, 2], [3, 4, 5]],
    3: [[0, 1], [3, 4], [2, 5]],
    4: [[0], [3], [1, 2], [4, 5]],
  };

  function assignTeamSpawns(cfgs) {
    if (gameMode !== "teams") return;
    const teams = teamIdsForMode().filter((t) =>
      cfgs.some((c) => c.fightTeam === t)
    );
    if (mapModifiers.maze) {
      const groups =
        MAZE_TEAM_SLOT_GROUPS[clamp(teams.length, 2, 4)] ||
        MAZE_TEAM_SLOT_GROUPS[2];
      teams.forEach((t, ti) => {
        const group = cfgs.filter((c) => c.fightTeam === t);
        const slotIdxs = groups[ti] || groups[groups.length - 1];
        for (let i = 0; i < group.length; i++) {
          const cell = MAZE_TEAM_SPAWN_SLOTS[slotIdxs[i % slotIdxs.length]];
          const pt = mazeGridCenterT(cell[0], cell[1]);
          group[i].spawn = [pt.x, pt.y];
        }
      });
      return;
    }
    const ac = arenaCenter();
    function placeGroup(group, cx, cy, ringR) {
      for (let i = 0; i < group.length; i++) {
        const a =
          group.length === 1
            ? -Math.PI / 2
            : -Math.PI / 2 + (2 * Math.PI * i) / group.length;
        const pt = clampPointToArena(
          cx + Math.cos(a) * ringR,
          cy + Math.sin(a) * ringR,
          PLAYER_R * 1.55
        );
        group[i].spawn = [pt.x, pt.y];
      }
    }
    if (teams.length <= 2) {
      // Unchanged classic layout: left/right split along the horizontal axis.
      const cxA = ac.cx - arenaRadius() * 0.34;
      const cxB = ac.cx + arenaRadius() * 0.34;
      const ringR = arenaRadius() * 0.4;
      placeGroup(cfgs.filter((c) => c.fightTeam === teams[0]), cxA, ac.cy, ringR);
      if (teams[1]) {
        placeGroup(cfgs.filter((c) => c.fightTeam === teams[1]), cxB, ac.cy, ringR);
      }
      return;
    }
    // 3-4 teams: each side gets its own cluster spread evenly around the arena.
    const outerR = arenaRadius() * 0.5;
    const ringR = arenaRadius() * 0.26;
    teams.forEach((t, ti) => {
      const group = cfgs.filter((c) => c.fightTeam === t);
      const teamAngle = -Math.PI / 2 + (2 * Math.PI * ti) / teams.length;
      const cx = ac.cx + Math.cos(teamAngle) * outerR;
      const cy = ac.cy + Math.sin(teamAngle) * outerR;
      placeGroup(group, cx, cy, ringR);
    });
  }

  function assignSiegeSpawns(cfgs) {
    if (gameMode !== "siege") return;
    const ac = arenaCenter();
    const baseA = mapRuntime.bases.find((b) => b.team === "a");
    const baseB = mapRuntime.bases.find((b) => b.team === "b");
    const yA = baseA ? baseA.y + 140 : ac.cy - SIEGE_WORLD_H / 2 + SIEGE_BASE_INSET + 140;
    const yB = baseB ? baseB.y - 140 : ac.cy + SIEGE_WORLD_H / 2 - SIEGE_BASE_INSET - 140;
    const groupA = cfgs.filter((c) => c.fightTeam === "a");
    const groupB = cfgs.filter((c) => c.fightTeam === "b");
    function placeGroup(group, y) {
      const spread = 60;
      for (let i = 0; i < group.length; i++) {
        const x = ac.cx + (i - (group.length - 1) / 2) * spread;
        const pt = clampPointToArena(x, y, PLAYER_R * 1.55);
        group[i].spawn = [pt.x, pt.y];
      }
    }
    placeGroup(groupA, yA);
    placeGroup(groupB, yB);
  }

  function buildHeroConfigs(humanCount, aiCount) {
    const total = humanCount + aiCount;
    const positions = heroSpawnPositions(total);
    const cfgs = [];
    for (let i = 0; i < humanCount; i++) {
      const charId = resolveSlotCharacterId(i);
      const def = getCharDef(charId);
      cfgs.push({
        team: "human",
        fightTeam: slotFightTeam(i),
        spawn: positions[i],
        color: def.tint ? def.tint : HUMAN_PRESETS[i].color,
        controls: HUMAN_PRESETS[i].controls,
        characterId: charId,
      });
    }
    for (let j = 0; j < aiCount; j++) {
      const idx = humanCount + j;
      const charId = resolveSlotCharacterId(idx);
      const def = getCharDef(charId);
      cfgs.push({
        team: "human",
        fightTeam: slotFightTeam(idx),
        isAi: true,
        aiDifficulty: resolveSlotAiDifficulty(idx),
        spawn: positions[idx],
        color: def.tint
          ? def.tint
          : ALLY_AI_COLORS[j % ALLY_AI_COLORS.length],
        characterId: charId,
      });
    }
    if (gameMode === "horde") {
      const ac = arenaCenter();
      const ringR = arenaRadius() * 0.38;
      for (let i = 0; i < cfgs.length; i++) {
        cfgs[i].fightTeam = "a";
        const a = -Math.PI / 2 + (2 * Math.PI * i) / cfgs.length;
        const pt = clampPointToArena(
          ac.cx + Math.cos(a) * ringR,
          ac.cy + Math.sin(a) * ringR,
          PLAYER_R * 1.55
        );
        cfgs[i].spawn = [pt.x, pt.y];
      }
    } else if (gameMode === "boss") {
      assignBossHeroSpawns(cfgs);
    } else if (gameMode === "siege") {
      assignSiegeSpawns(cfgs);
    } else {
      assignTeamSpawns(cfgs);
    }
    return cfgs;
  }

  const BOSS_TEMPLATE = {
    team: "bot",
    isBot: true,
    spawn: [W * 0.5, H * 0.78],
    color: "#e85d4c",
  };

  const BOSSES = {
    colossus: {
      id: "colossus",
      name: "Colossus",
      desc: "Tank boss — huge HP, ground pound up close, scorch beam at range.",
      color: "#e85d4c",
      attackStyle: "melee",
    },
    reaver: {
      id: "reaver",
      name: "Reaver",
      desc: "Striker boss — heals on hit, Soul Grasp, Ruin Burst, Soul Hook pull.",
      color: "#c084fc",
      attackStyle: "melee",
    },
    hexwright: {
      id: "hexwright",
      name: "Hexwright",
      desc: "Alchemist boss — toxic bottles & puddles, short teleport leaving slime, summons thralls.",
      color: "#6ee7b7",
      attackStyle: "hexwright",
    },
  };

  const BOSS_IDS = Object.keys(BOSSES);

  function getBossDef(bossId) {
    return BOSSES[bossId] || BOSSES.colossus;
  }

  /** Boss power scales with heroes facing him (humans + AI) and stock lives. */
  function getBossLivesScale() {
    // Horde has no lives stock — keep wave/party scaling only.
    const lives = gameMode === "horde" ? 1 : readLivesPerPlayer();
    return {
      lives,
      // Extra lives ≈ more total HP the team can bring; boss HP tracks that.
      hpMul: 0.55 + 0.45 * lives,
      // Milder damage bump so longer matches stay threatening, not oppressive.
      dmgMul: 0.88 + 0.12 * lives,
    };
  }

  /** Player-count scale — applied last, after lives. Steeper than the old blend. */
  function getBossPartyScale(partySize) {
    const n = clamp(partySize, 1, MAX_TEAM_FIGHTERS);
    const k = Math.max(0, n - 1);
    return {
      n,
      // n=1: 1 → n=2: ~2.0 → n=3: ~3.3 → n=4: ~4.9
      hpMul: 1 + 0.85 * k + 0.15 * k * k,
      // n=1: 1 → n=2: ~1.78 → n=3: ~2.76 → n=4: ~3.94
      dmgMul: 1 + 0.68 * k + 0.1 * k * k,
    };
  }

  function getBossScaling(bossId, partySize) {
    const party = getBossPartyScale(partySize);
    const n = party.n;
    const life = getBossLivesScale();
    let scale;
    // 1-fighter baseline HP/damage; lives then party multipliers apply after.
    if (bossId === "reaver") {
      scale = {
        partySize: n,
        maxHp: scaleHp(Math.round(MAX_HP * 1.05)),
        damageMultiplier: 0.72,
        bossMoveSpeedMul: (1.38 + 0.06 * (n - 1)) * 1.5,
        chargeSpeedMul: 1.85,
        bossPoundCooldown: 999,
        bossPoundInitialCd: 999,
        bossBeamCooldown: 999,
        bossBeamInitialCd: 999,
      };
    } else if (bossId === "hexwright") {
      scale = {
        partySize: n,
        maxHp: scaleHp(Math.round(MAX_HP * 1.2)),
        damageMultiplier: 1.1,
        bossMoveSpeedMul: 0.7 + 0.03 * (n - 1),
        chargeSpeedMul: 1,
        bossPoundCooldown: 999,
        bossPoundInitialCd: 999,
        bossBeamCooldown: 999,
        bossBeamInitialCd: 999,
        hexBottleInitialCd: 0.7 + 0.15 * (n - 1),
        hexSummonInitialCd: 3.5 + 0.35 * (n - 1),
        hexTeleportInitialCd: 3 + 0.25 * (n - 1),
      };
    } else {
      scale = {
        partySize: n,
        maxHp: scaleHp(Math.round(MAX_HP * 1.48)),
        damageMultiplier: 1.34,
        bossMoveSpeedMul: BOSS_MOVE_SPEED_MUL * (1 + 0.04 * (n - 1)),
        chargeSpeedMul: 1,
        bossPoundCooldown: POUND_COOLDOWN * (1.12 - 0.07 * n),
        bossPoundInitialCd: 2 + 0.25 * (n - 1),
        bossBeamCooldown: BOSS_BEAM_COOLDOWN * (1.08 - 0.06 * n),
        bossBeamInitialCd: 3.5 + 0.4 * (n - 1),
      };
    }
    scale.lives = life.lives;
    // Lives first (stock lives per player).
    scale.maxHp = Math.max(1, Math.round(scale.maxHp * life.hpMul));
    scale.damageMultiplier *= life.dmgMul;
    // Party count last — hardest lever as the roster grows.
    scale.maxHp = Math.max(1, Math.round(scale.maxHp * party.hpMul));
    scale.damageMultiplier *= party.dmgMul;
    scale.partyHpMul = party.hpMul;
    scale.partyDmgMul = party.dmgMul;
    return scale;
  }

  function buildBossConfig(partySize) {
    const bossId = selectedBossId || "colossus";
    const def = getBossDef(bossId);
    const scale = getBossScaling(bossId, partySize);
    const bossPt = bossSpawnPoint();
    return {
      ...BOSS_TEMPLATE,
      bossId: def.id,
      attackStyle: def.attackStyle,
      color: def.color,
      spawn: [bossPt.x, bossPt.y],
      ...scale,
    };
  }

  function pickRandomBossId() {
    return BOSS_IDS[Math.floor(Math.random() * BOSS_IDS.length)];
  }

  /** Wave tier 1 @ 25, 2 @ 50, … — scales boss HP/damage with wave and party. */
  function hordeBossWaveTier(wave) {
    return Math.max(1, Math.floor(Math.max(1, wave) / HORDE_BOSS_WAVE_INTERVAL));
  }

  function getHordeBossScaling(bossId, wave, partySize) {
    const base = getBossScaling(bossId, partySize);
    const tier = hordeBossWaveTier(wave);
    const intoTier = Math.max(0, wave - tier * HORDE_BOSS_WAVE_INTERVAL);
    const mul =
      (1 + (tier - 1) * 0.34 + intoTier * 0.009) * hordePartyStrengthMul();
    return {
      ...base,
      partySize: partySize,
      maxHp: scaleHp(Math.round(base.maxHp * mul)),
      damageMultiplier: base.damageMultiplier * mul,
      bossMoveSpeedMul:
        (base.bossMoveSpeedMul != null ? base.bossMoveSpeedMul : 1) *
        (1 + (mul - 1) * 0.1),
      chargeSpeedMul:
        (base.chargeSpeedMul != null ? base.chargeSpeedMul : 1) *
        (1 + (mul - 1) * 0.08),
    };
  }

  function buildHordeBossConfig(bossId, wave) {
    const def = getBossDef(bossId);
    const party = hordePartySize();
    const scale = getHordeBossScaling(bossId, wave, party);
    const bossPt = bossSpawnPoint();
    return {
      ...BOSS_TEMPLATE,
      bossId: def.id,
      attackStyle: def.attackStyle,
      color: def.color,
      spawn: [bossPt.x, bossPt.y],
      isHordeBoss: true,
      ...scale,
    };
  }

  function isHordeBoss(p) {
    return !!p && !!p.isHordeBoss;
  }

  function hordeIsBossWaveNumber(wave) {
    return wave > 0 && wave % HORDE_BOSS_WAVE_INTERVAL === 0;
  }

  function getHordeBossPlayer() {
    for (let i = 0; i < players.length; i++) {
      if (isHordeBoss(players[i])) return players[i];
    }
    return null;
  }

  function hordeBossWaveActive() {
    return gameMode === "horde" && !!(hordeState && hordeState.bossWave);
  }

  function clearHordeBossMapExtras() {
    mapRuntime.bossBottles = [];
    mapRuntime.bossMinions = [];
    mapRuntime.toxicPuddles = [];
  }

  function removeHordeBossPlayer() {
    players = players.filter((p) => !isHordeBoss(p));
    if (hordeState) {
      hordeState.bossWave = false;
      hordeState.bossWaveId = null;
    }
    clearHordeBossMapExtras();
    if (hpBossEl) hpBossEl.style.width = "0%";
    updateHudLayout();
    refreshBossHudLabel();
  }

  function spawnHordeBossPlayer(wave) {
    removeHordeBossPlayer();
    mapRuntime.waveEnemies = [];
    const bossId = pickRandomBossId();
    hordeState.bossWave = true;
    hordeState.bossWaveId = bossId;
    const boss = createPlayer(buildHordeBossConfig(bossId, wave), hordePartySize() + 1);
    boss.isHordeBoss = true;
    boss.hordeBossWave = wave;
    players.push(boss);
    updateHudLayout();
    refreshBossHudLabel();
  }

  /** @type {"boss" | "versus" | "teams" | "horde" | null} */
  let gameMode = null;
  let hordeState = { wave: 0, phase: "intermission", intermissionT: 2.2 };
  const SETTING_SHOW_INSTRUCTIONS_KEY = "topDownDuel_showInstructions";
  const SETTING_CHARACTER_SHINE_KEY = "topDownDuel_characterShine";
  const SETTING_FIGHTER_HANDS_KEY = "topDownDuel_fighterHands";
  const SETTING_NAME_TAGS_KEY = "topDownDuel_nameTags";
  const SETTING_OVERHEAD_HP_KEY = "topDownDuel_overheadHp";
  const SETTING_UNIQUE_SHAPES_KEY = "topDownDuel_uniqueShapes";
  const SETTING_FACING_ARROW_KEY = "topDownDuel_facingArrow";
  const SETTING_MOUSE_AIM_KEY = "topDownDuel_mouseAimP1";
  const SETTING_NAME_TAG_CHAR_NAME_KEY = "topDownDuel_nameTagCharName";
  const SETTING_NAME_TAG_TEAM_KEY = "topDownDuel_nameTagTeam";
  const SETTING_NAME_TAG_HUMAN_AI_KEY = "topDownDuel_nameTagHumanAi";
  const SETTING_NAME_TAG_AI_DIFFICULTY_KEY = "topDownDuel_nameTagAiDifficulty";
  const SETTING_NAME_TAG_PLAYER_NUM_KEY = "topDownDuel_nameTagPlayerNum";
  let showInstructions = true;
  let showCharacterShine = false;
  let showFighterHands = true;
  let showNameTags = true;
  let showOverheadHpBars = false;
  let showUniqueShapes = true;
  let showFacingArrow = true;
  let useMouseAimP1 = true;
  /** Name tag content sub-toggles — what the badge above each fighter shows. */
  let showNameTagCharName = true;
  let showNameTagTeam = true;
  let showNameTagHumanAi = false;
  let showNameTagAiDifficulty = false;
  let showNameTagPlayerNum = false;
  /** Name tag per-segment colors. */
  const NAME_TAG_PLAYER_NUM_COLOR = "rgba(232, 236, 244, 0.85)";
  const NAME_TAG_SEPARATOR_COLOR = "rgba(232, 236, 244, 0.4)";
  const NAME_TAG_HUMAN_COLOR = "#7ee787";
  const NAME_TAG_AI_COLOR = "#fb923c";
  const NAME_TAG_AI_DIFFICULTY_COLORS = {
    easy: "#7ee787",
    normal: "#3dd6ff",
    hard: "#f59e0b",
    elite: "#f43f5e",
  };

  // Gamepad support: left stick moves, right stick aims, R2 attacks,
  // L2 ults, Square supports. Purely additive — arrow-key/WASD-style
  // controls for a pad's slot keep working whether or not a pad is
  // connected. Every connected pad is supported, not just one — the Nth
  // connected pad (in raw navigator.getGamepads() order) drives preset
  // slot N (P2, P3, P4, ...); P1 is reserved for keyboard+mouse. If a
  // controller disconnects, the remaining ones shift down to fill the gap.
  const GAMEPAD_MOVE_DEADZONE = 0.25;
  const GAMEPAD_AIM_DEADZONE = 0.35;
  const GAMEPAD_BTN_ATTACK = 7; // R2 / RT
  const GAMEPAD_BTN_ULTIMATE = 6; // L2 / LT
  const GAMEPAD_BTN_SUPPORT = 2; // Square / X
  function makeEmptyGamepadState() {
    return { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, buttons: [] };
  }
  /** Index 0 (P1) is never populated — pads fill slots 1..N (P2..). */
  let gamepadStates = HUMAN_PRESETS.map(() => makeEmptyGamepadState());
  const gamepadStatusEl = document.getElementById("gamepad-status");
  const gamepadStatusTextEl = document.getElementById("gamepad-status-text");
  let lastGamepadStatusShown = null; // force the first update through
  // Mirrors real keyboard state only, separate from `keys` so the gamepad
  // sync below can recompute effective P2 keys each frame without the
  // gamepad's own previous contribution leaking back into itself.
  const physKeys = Object.create(null);
  let mouseCanvasPos = null;
  // Mouse-aim (P1) buttons: left click = attack, right click = ultimate.
  let mouseButtonState = { left: false, right: false };

  let modePickerOpen = true;
  let mapPickerOpen = false;
  let bossPickerOpen = false;
  let characterPickerOpen = false;
  /** @type {string} */
  let selectedBossId = "colossus";
  /** @type {string} */
  let mapModifiers = defaultMapModifiers();
  let mapRuntime = {
    obstacles: [],
    walls: [],
    movers: [],
    portals: [],
    portalCd: Object.create(null),
    creatures: [],
    creatureSpawnCd: 0,
    creatureNextId: 0,
    waveEnemies: [],
    waveEnemyNextId: 0,
    hostileShots: [],
    toxicPuddles: [],
    bossBottles: [],
    bossMinions: [],
    bossMinionNextId: 0,
    echoSummons: [],
    echoSummonNextId: 0,
    pikeSpears: [],
    pikeSpearNextId: 0,
    bases: [],
    shadows: [],
    shadowNextId: 0,
    marionetteBolts: [],
    marionetteBoltNextId: 0,
    marionetteEffigies: [],
    marionetteEffigyNextId: 0,
  };

  /** # = wall, . = floor (15×13). Baked at load: solid # cells, unreachable . → #.
   *  This is the one hand-authored layout — every match instead uses one of
   *  its 4 reflections/rotations (see mazeVariant below) so the Labyrinth
   *  doesn't look identical every time, without needing a full procedural
   *  generator or risking a broken/disconnected layout. */
  const MAZE_GRID_BASE = [
    "###############",
    "#.#.....#.....#",
    "#..#..#.#..#..#",
    "#...#...#...#.#",
    "##..#.#.##..#.#",
    "#...#.#.....#.#",
    "#..#..###...#.#",
    "#...#.....#...#",
    "##..###.#.#..##",
    "#.......#...#.#",
    "#..#####..#..##",
    "#.....#.......#",
    "###############",
  ];
  /** 0 = identity, 1 = horizontal mirror, 2 = vertical mirror, 3 = 180°
   *  rotation — re-rolled once per match by randomizeMazeVariant(). */
  let mazeVariant = 0;
  let MAZE_GRID = MAZE_GRID_BASE;

  function mazeGridRowsForVariant(variant) {
    let rows = MAZE_GRID_BASE.slice();
    if (variant === 1 || variant === 3) {
      rows = rows.map((r) => r.split("").reverse().join(""));
    }
    if (variant === 2 || variant === 3) {
      rows = rows.slice().reverse();
    }
    return rows;
  }

  /** Maps a (gx,gy) cell that's known-open in the BASE layout to its
   *  matching cell in the CURRENT variant, so every hardcoded spawn/portal
   *  cell below stays valid no matter which of the 4 variants is active. */
  function transformMazeCell(gx, gy) {
    const cols = MAZE_GRID_BASE[0].length;
    const rows = MAZE_GRID_BASE.length;
    let x = gx;
    let y = gy;
    if (mazeVariant === 1 || mazeVariant === 3) x = cols - 1 - x;
    if (mazeVariant === 2 || mazeVariant === 3) y = rows - 1 - y;
    return { x, y };
  }

  function randomizeMazeVariant() {
    mazeVariant = Math.floor(Math.random() * 4);
    MAZE_GRID = mazeGridRowsForVariant(mazeVariant);
  }

  /** mazeGridCenter, but for a (gx,gy) known open in the BASE layout —
   *  transforms it to the current variant first. */
  function mazeGridCenterT(gx, gy) {
    const t = transformMazeCell(gx, gy);
    return mazeGridCenter(t.x, t.y);
  }
  /** @type {string[]} character id per fighter slot */
  let slotCharacters = [];
  /** @type {("a"|"b")[]} team per fighter slot (teams mode) */
  let slotTeams = [];
  /** @type {string[]} AI difficulty per fighter slot (AI slots only) */
  let slotAiDifficulty = [];
  let players = [];
  /** Siege split-screen — one camera per pane (index 0/1), world-space. */
  let paneCameras = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

  function normalizeAiDifficulty(id) {
    return AI_DIFFICULTY_IDS.indexOf(id) >= 0 ? id : AI_DIFFICULTY_DEFAULT;
  }

  function resolveSlotAiDifficulty(slotIndex) {
    return normalizeAiDifficulty(slotAiDifficulty[slotIndex]);
  }

  /** Skill multipliers for ally AI — higher difficulty = tighter aim, faster play. */
  function aiSkillProfile(diff) {
    const d = normalizeAiDifficulty(diff);
    if (d === "easy") {
      return {
        aimSpreadMul: 2.55,
        leadMul: 0.22,
        moveMul: 0.76,
        chargeRateMul: 0.7,
        chargeGoalMin: 0.38,
        chargeGoalMax: 0.72,
        fireNoise: 0.42,
        ultWillingness: 0.38,
        kiteMul: 0.72,
        aimWobbleMul: 1.85,
        selfPreserveMul: 0,
        killPriority: 0.05,
      };
    }
    if (d === "hard") {
      return {
        aimSpreadMul: 0.38,
        leadMul: 1.18,
        moveMul: 1.08,
        chargeRateMul: 1.12,
        chargeGoalMin: 0.68,
        chargeGoalMax: 0.98,
        fireNoise: 0.08,
        ultWillingness: 0.95,
        kiteMul: 1.14,
        aimWobbleMul: 0.45,
        selfPreserveMul: 0.9,
        killPriority: 0.7,
      };
    }
    if (d === "elite") {
      return {
        aimSpreadMul: 0.16,
        leadMul: 1.38,
        moveMul: 1.16,
        chargeRateMul: 1.24,
        chargeGoalMin: 0.76,
        chargeGoalMax: 0.99,
        fireNoise: 0.03,
        ultWillingness: 1,
        kiteMul: 1.28,
        aimWobbleMul: 0.2,
        selfPreserveMul: 1.2,
        killPriority: 0.92,
      };
    }
    return {
      aimSpreadMul: 1,
      leadMul: 1,
      moveMul: 1,
      chargeRateMul: 1,
      chargeGoalMin: 0.58,
      chargeGoalMax: 0.96,
      fireNoise: 0.16,
      ultWillingness: 0.78,
      kiteMul: 1,
      aimWobbleMul: 1,
      selfPreserveMul: 0.5,
      killPriority: 0.35,
    };
  }

  function getAiSkill(p) {
    return aiSkillProfile(p && p.aiDifficulty);
  }

  function allyAiMoveSpeedMul(p) {
    return ALLY_AI_SPEED_MUL * getAiSkill(p).moveMul;
  }

  function fightersCanDamage(attacker, defender) {
    if (attacker.playerNum === defender.playerNum) return false;
    if ((attacker.respawnT || 0) > 0 || attacker.hp <= 0) return false;
    if (!fighterIsVulnerable(defender)) return false;
    if (gameMode === "horde") {
      if (hordeBossWaveActive()) {
        if (isHordeBoss(attacker) && isHordeHero(defender)) return true;
        if (isHordeBoss(defender) && isHordeHero(attacker)) return true;
      }
      return false;
    }
    if (gameMode === "boss") {
      if (attacker.isBot) return !defender.isBot;
      if (defender.isBot) return !attacker.isBot;
      return false;
    }
    if (gameMode === "teams" || gameMode === "siege") {
      return attacker.fightTeam !== defender.fightTeam;
    }
    return true;
  }

  /** Counts fighters per team id (teamIdsForMode()'s set) across the
   *  current roster. */
  function countSlotTeams() {
    const { total } = readRoster();
    const ids = teamIdsForMode();
    const counts = {};
    ids.forEach((t) => {
      counts[t] = 0;
    });
    for (let i = 0; i < total; i++) {
      const t = slotFightTeam(i);
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }

  function teamsRosterValid() {
    if (gameMode !== "teams" && gameMode !== "siege") return true;
    const counts = countSlotTeams();
    const usedTeams = Object.keys(counts).filter((t) => counts[t] > 0).length;
    return usedTeams >= 2;
  }

  function getCharDef(id) {
    return CHARACTERS[id] || CHARACTERS.brawler;
  }

  function isRandomCharId(id) {
    return id === RANDOM_CHAR_ID;
  }

  function getCharSelectDef(id) {
    if (isRandomCharId(id)) return RANDOM_CHAR_META;
    return getCharDef(id);
  }

  function pickRandomCharacterId() {
    return CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)];
  }

  function resolveSlotCharacterId(slotIndex) {
    const pick = slotCharacters[slotIndex] || RANDOM_CHAR_ID;
    if (isRandomCharId(pick)) return pickRandomCharacterId();
    return pick;
  }

  function charTintForId(id) {
    if (isRandomCharId(id)) return RANDOM_CHAR_META.tint;
    const def = getCharDef(id);
    return def.tint || "#8b95a8";
  }

  function playerCharName(p) {
    return getCharDef(p && p.characterId).name;
  }

  function playerTeamTag(p) {
    if (gameMode !== "teams" || !p || p.isBot) return "";
    return TEAM_LABELS[p.fightTeam] || "A";
  }

  function formatSlotHudLabel(slotIndex, player) {
    const { humans } = readRoster();
    let slotTag;
    const isAiSlot = player
      ? !!player.isAi
      : slotIndex >= humans;
    if (player) {
      slotTag = player.isAi
        ? "AI " + (player.playerNum - humans)
        : "P" + player.playerNum;
    } else {
      slotTag = isAiSlot
        ? "AI " + (slotIndex - humans + 1)
        : "P" + (slotIndex + 1);
    }
    const charId =
      (player && player.characterId) ||
      slotCharacters[slotIndex] ||
      RANDOM_CHAR_ID;
    const charName = getCharSelectDef(charId).name;
    const team =
      player != null
        ? playerTeamTag(player)
        : gameMode === "teams"
          ? TEAM_LABELS[slotFightTeam(slotIndex)] || "A"
          : "";
    const teamPart = team ? " · Team " + team : "";
    const diffId = player
      ? player.aiDifficulty
      : isAiSlot
        ? resolveSlotAiDifficulty(slotIndex)
        : null;
    const diffPart =
      isAiSlot && diffId
        ? " · " + (AI_DIFFICULTY_LABELS[normalizeAiDifficulty(diffId)] || "Normal")
        : "";
    const livesPart =
      player && matchUsesLives() && !player.isBot && gameMode !== "siege"
        ? " · ×" + (player.lives || 0)
        : "";
    return slotTag + teamPart + diffPart + " · " + charName + livesPart;
  }

  function getPlayerRadius(p) {
    return p.hitRadius != null ? p.hitRadius : PLAYER_R;
  }

  function isBulwark(p) {
    return (
      p.attackStyle === "barrage" ||
      p.attackStyle === "aura" ||
      p.characterId === "bulwark"
    );
  }

  function isBulwarkUnbreakable(p) {
    return isBulwark(p) && (p.ultDamageResistT || 0) > 0;
  }

  /** True while Bulwark's old aura pulse is active (ult only now). */
  function isBulwarkAuraSwing(p) {
    return (
      !!p &&
      isBulwark(p) &&
      (p.attackStyle === "aura" || !!p.bulwarkAuraUlt) &&
      (p.attackT || 0) > 0
    );
  }

  function isRicochet(p) {
    return p.attackStyle === "bounce" || p.characterId === "ricochet";
  }

  function isLaser(p) {
    return p.attackStyle === "beam" || p.characterId === "laser";
  }

  function isScatter(p) {
    return p.attackStyle === "spread" || p.characterId === "scatter";
  }

  function isNova(p) {
    return p.attackStyle === "nova" || p.characterId === "nova";
  }

  function isPhoenix(p) {
    return p.attackStyle === "phoenix" || p.characterId === "phoenix";
  }

  function isPike(p) {
    return p.attackStyle === "lance" || p.characterId === "pike";
  }

  function isGrappler(p) {
    return p && p.characterId === "grappler";
  }

  function isSiphon(p) {
    return p && p.characterId === "siphon";
  }

  function isMarionette(p) {
    return p && p.characterId === "marionette";
  }

  /** Vacuum Rift — Siphon phases out (no body / hitbox) while the ult runs. */
  function isSiphonPhasing(p) {
    return isSiphon(p) && (p.siphonPhaseT || 0) > 0;
  }

  function grapplerHookBusy(p) {
    return (
      isGrappler(p) &&
      !!(
        p.grapplerHookActive ||
        (p.grapplerHookPullT || 0) > 0 ||
        (p.grapplerHookMissT || 0) > 0
      )
    );
  }

  function attackSectorRange(attacker, ratio) {
    if (attacker.attackStyle === "lance") {
      const r = clamp(ratio != null ? ratio : 0, 0, 1);
      return LANCE_RANGE_MIN + (LANCE_RANGE_MAX - LANCE_RANGE_MIN) * r;
    }
    return ATTACK_RANGE * meleeRangeScale(attacker, ratio);
  }

  function attackSectorArc(attacker, ratio) {
    if (attacker.attackStyle === "lance") {
      // Approx arc for AI / legacy callers; hits use lanceCorridorHit.
      const range = Math.max(80, attackSectorRange(attacker, ratio));
      return (2 * Math.atan2(LANCE_HALF_WIDTH, range));
    }
    return ATTACK_ARC * meleeArcScale(attacker, ratio);
  }

  function lanceAimFacing(p) {
    if (
      isPike(p) &&
      (p.attackT || 0) > 0 &&
      p.lanceSwingFacing != null
    ) {
      return p.lanceSwingFacing;
    }
    return p.facing;
  }

  /** Corridor half-width at a given point along the thrust — narrow near
   *  the attacker, widening out to the full LANCE_HALF_WIDTH at the tip. */
  function lanceHalfWidthAt(along, range) {
    const t = clamp(range > 1e-3 ? along / range : 0, 0, 1);
    return LANCE_HALF_WIDTH * (LANCE_NEAR_WIDTH_MUL + (1 - LANCE_NEAR_WIDTH_MUL) * t);
  }

  /**
   * Capsule/corridor test: target body overlaps the spear shaft.
   * Uses locked swing facing so turning mid-thrust doesn't miss aimed foes.
   */
  function lanceCorridorHit(attacker, tx, ty, targetR) {
    if (!attacker || attacker.attackStyle !== "lance") return false;
    const ratio = attacker.lastSwingChargeRatio || 0;
    const range = attackSectorRange(attacker, ratio);
    const ang = lanceAimFacing(attacker);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const dx = tx - attacker.x;
    const dy = ty - attacker.y;
    const along = dx * cos + dy * sin;
    const tipPad = targetR != null ? targetR : 0;
    if (along < -Math.min(14, tipPad + 4) || along > range + tipPad) {
      return false;
    }
    const halfWidthHere = lanceHalfWidthAt(along, range);
    const perp = Math.abs(-sin * dx + cos * dy);
    return perp <= halfWidthHere + tipPad;
  }

  function lanceDamageMulAt(attacker, tx, ty) {
    const range = Math.max(
      1,
      attackSectorRange(attacker, attacker.lastSwingChargeRatio || 0)
    );
    const dist = len(tx - attacker.x, ty - attacker.y);
    const t = clamp(dist / range, 0, 1);
    return LANCE_CLOSE_DMG_MUL + (LANCE_FAR_DMG_MUL - LANCE_CLOSE_DMG_MUL) * t;
  }

  function meleeSwingDamageForTarget(attacker, tx, ty) {
    let dmg = attacker.swingDamage;
    if (attacker.attackStyle === "lance") {
      dmg *= lanceDamageMulAt(attacker, tx, ty);
    }
    return dmg;
  }

  function ultimateBaseCdFor(p) {
    const id = p.characterId || "brawler";
    return ULTIMATE_BASE_CD[id] != null ? ULTIMATE_BASE_CD[id] : 48;
  }

  function initUltimateState(p) {
    p.ultCd = ultimateBaseCdFor(p);
    p.ultActiveT = 0;
    p.ultLaserT = 0;
    p.ultDamageResistT = 0;
    p.ultDmgMulT = 0;
    p.ultDashChain = 0;
    p.ultKeyWasDown = false;
    p.ultFlashT = 0;
    p.bulwarkAuraUlt = false;
    p.grapplerChargeBoostT = 0;
  }

  function ultimateReady(p) {
    if (!p || p.isBot) return false;
    if (p.eliminated) return false;
    if (isHordeHeroDowned(p)) {
      if (!isPhoenix(p)) return false;
    } else if (p.hp <= 0) {
      return false;
    }
    if ((p.ultActiveT || 0) > 0) return false;
    if ((p.ultCd || 0) > 0) return false;
    if (grapplerHookBusy(p)) return false;
    if (!canPlayerUseAttacks(p)) return false;
    if (isPhoenix(p) && p.phoenixReviving) return false;
    if (isHordeHeroDowned(p)) return false;
    return true;
  }

  function grantUltimateCdReduction(fighter, dealt) {
    if (!fighter || fighter.isBot || dealt <= 0) return;
    if (fighter.ultCd == null) initUltimateState(fighter);
    // Charge only drops when the ultimate is used (fireUltimate). Damage may
    // fill the meter all the way to ready — never raises cooldown.
    fighter.ultCd = Math.max(
      0,
      (fighter.ultCd || 0) - dealt * ULTIMATE_CD_PER_DAMAGE
    );
  }

  /** Reduced ult charge for thralls, Echo clones, and map critters. */
  function grantUltimateMinionCharge(fighter, dealt) {
    if (!fighter || fighter.isBot || dealt <= 0) return;
    if (fighter.ultCd == null) initUltimateState(fighter);
    fighter.ultCd = Math.max(
      0,
      (fighter.ultCd || 0) - dealt * ULTIMATE_CD_PER_DAMAGE_MINION
    );
  }

  /** Kill ult charge disabled — KOs no longer fill the ultimate meter. */
  function grantUltimateKillCharge(killer, victim) {
    return;
  }

  /** Large ult charge when you die — come back swinging. */
  function grantUltimateDeathCharge(fighter) {
    if (!fighter || fighter.isBot) return;
    if (fighter.ultCd == null) initUltimateState(fighter);
    fighter.ultCd = Math.max(0, (fighter.ultCd || 0) - ULTIMATE_CD_ON_DEATH);
  }

  /** Bulwark ult charge from tanking damage disabled — ult now only charges from damage dealt, like everyone else. */
  function grantBulwarkUltFromDamageTaken(defender, dealt) {
    return;
  }

  function ultimateDamageMul(p) {
    let mul = 1;
    if ((p.ultDmgMulT || 0) > 0) mul *= 1.38;
    if (isPhoenix(p)) mul *= phoenixReviveDamageMul(p);
    return mul;
  }

  function forEachUltimateVictims(attacker, radius, fn) {
    if (gameMode === "horde" && !attacker.isBot) {
      const list = mapRuntime.waveEnemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.hp <= 0) continue;
        if (len(attacker.x - e.x, attacker.y - e.y) > radius + e.r) continue;
        fn(e, false);
      }
      const boss =
        typeof getHordeBossPlayer === "function" ? getHordeBossPlayer() : null;
      if (boss && boss.hp > 0 && fightersCanDamage(attacker, boss)) {
        if (len(attacker.x - boss.x, attacker.y - boss.y) <= radius + getPlayerRadius(boss)) {
          fn(boss, true);
        }
      }
      if (mapHasCreatures()) {
        const clist = mapRuntime.creatures;
        for (let ci = 0; ci < clist.length; ci++) {
          const c = clist[ci];
          if (c.hp <= 0) continue;
          if (len(attacker.x - c.x, attacker.y - c.y) > radius + c.r) continue;
          fn(c, false);
        }
        removeDeadCreatures();
      }
      return;
    }
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (t === attacker || t.hp <= 0) continue;
      if (!fightersCanDamage(attacker, t)) continue;
      if (len(attacker.x - t.x, attacker.y - t.y) > radius + getPlayerRadius(t)) {
        continue;
      }
      fn(t, true);
    }
    if (mapHasCreatures()) {
      const clist = mapRuntime.creatures;
      for (let ci = 0; ci < clist.length; ci++) {
        const c = clist[ci];
        if (c.hp <= 0) continue;
        if (len(attacker.x - c.x, attacker.y - c.y) > radius + c.r) continue;
        fn(c, false);
      }
      removeDeadCreatures();
    }
  }

  function dealUltimateHit(attacker, target, dmg, opts) {
    opts = opts || {};
    const mul = ultimateDamageMul(attacker);
    const finalDmg =
      dmg *
      mul *
      (attacker.attackDamageMul != null ? attacker.attackDamageMul : 1);
    if (isMapCreature(target)) {
      damageCreature(target, finalDmg, attacker);
      return;
    }
    if (target.playerNum != null && fightersCanDamage(attacker, target)) {
      applyDamageTo(target, attacker, finalDmg, {
        hitFlash: opts.hitFlash != null ? opts.hitFlash : 0.22,
        knockFrom: attacker,
        knockMul: opts.knockMul != null ? opts.knockMul : 0.1,
        stunT: opts.stunT,
      });
      return;
    }
    if (target.hp != null && target.r != null && gameMode === "horde") {
      damageWaveEnemy(target, finalDmg, attacker);
    }
  }

  function fireUltimateBrawler(p) {
    const base = (DAMAGE_MIN + DAMAGE_MAX) * 0.5 * p.damageMultiplier;
    const radius = BRAWLER_ULT_RADIUS;
    p.seismicSlamT = BRAWLER_ULT_VFX;
    p.seismicSlamX = p.x;
    p.seismicSlamY = p.y;
    spawnRingBurst(p.x, p.y, p.color, radius * 0.42);
    spawnHitSparks(p.x, p.y, p.color, 14);
    forEachUltimateVictims(p, radius, (t) => {
      dealUltimateHit(p, t, base * 2.35, { knockMul: 0.14, stunT: 0.85 });
    });
    p.ultFlashT = 0.5;
  }

  function fireUltimateMarksman(p) {
    const ratio = 1;
    p.swingId += 1;
    p.swingDamage =
      (DAMAGE_MIN + (DAMAGE_MAX - DAMAGE_MIN) * ratio) *
      p.damageMultiplier *
      (p.attackDamageMul || 1) *
      1.15;
    const count = 7;
    const spread = 0.38;
    const ox = p.x + Math.cos(p.facing) * (getPlayerRadius(p) + 8);
    const oy = p.y + Math.sin(p.facing) * (getPlayerRadius(p) + 8);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const ang = p.facing + t * spread;
      const speed = RANGED_SPEED * 1.05;
      projectiles.push({
        kind: "ranged",
        pelletIdx: i,
        x: ox,
        y: oy,
        px: ox,
        py: oy,
        spawnX: ox,
        spawnY: oy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        baseSpeed: speed,
        age: 0,
        ownerNum: p.playerNum,
        swingId: p.swingId,
        baseDamage: p.swingDamage,
        knockMul: p.swingKnockMul,
        maxDist: RANGED_MAX_DIST * (p.rangedRangeMul || 1) * 1.1,
        traveled: 0,
        r: RANGED_HIT_R,
        color: p.color,
        ultShot: true,
      });
    }
    p.ultFlashT = 0.35;
  }

  function fireUltimateStriker(p) {
    p.swingId += 1;
    const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
    p.swingDamage = (DAMAGE_MIN + (DAMAGE_MAX - DAMAGE_MIN)) * p.damageMultiplier * charDmg;
    p.swingKnockMul = 1;
    p.ultDashChain = 3;
    p.dashDamageMul = 1.65;
    startDash(p, 1);
    p.ultFlashT = 0.4;
  }

  function fireUltimateBulwark(p) {
    p.ultDamageResistT = BULWARK_ULT_RESIST_DURATION;
    p.barrage = null;
    p.bulwarkAuraUlt = false;
    p.attackT = 0;
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.cooldown = 0;
    p.needsRelease = false;
    p.ultFlashT = 0.45;
  }

  function beginBulwarkAuraSwing(p, ratio) {
    const swingRatio = bulwarkEffectiveRatio(ratio);
    p.barrage = null;
    p.swingId += 1;
    p.lastSwingChargeRatio = swingRatio;
    p.swingDamage = bulwarkAuraDamageForRatio(swingRatio) * p.damageMultiplier;
    p.swingKnockMul = 0.5 + 0.12 * Math.sqrt(Math.max(1, swingRatio));
    p.attackT = bulwarkAuraActiveTime(swingRatio);
    p.bulwarkAuraUlt = true;
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.cooldown = BULWARK_AURA_PULSE_CD;
    p.needsRelease = true;
  }

  function fireUltimateRicochet(p) {
    p.swingId += 1;
    p.lastSwingChargeRatio = 1;
    p.swingDamage = RICOCHET_DAMAGE_INITIAL;
    p.swingKnockMul = 1;
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.cooldown = RICOCHET_ATTACK_COOLDOWN * ricochetMapTuning().cooldownMul;
    const count = RICOCHET_ULT_SHOT_COUNT;
    for (let n = 0; n < count; n++) {
      const t = count === 1 ? 0 : n / (count - 1) - 0.5;
      const ang = p.facing + t * RICOCHET_ULT_SPREAD;
      spawnBounceShot(p, 1, { ultShot: true, angle: ang, pelletIdx: n });
    }
    p.attackT = 0.12;
    p.ultFlashT = 0.35;
  }

  function fireUltimateLaser(p) {
    p.ultLaserT = 4.8;
    setLaserBeamActive(p, true);
    p.beamWindupT = LASER_WINDUP;
    p.beamFiring = true;
    p.ultFlashT = 0.5;
  }

  function fireUltimateScatter(p) {
    const ratio = 1;
    p.swingId += 1;
    const pelletBase =
      (SPREAD_DAMAGE_BASE + (SPREAD_DAMAGE_MAX - SPREAD_DAMAGE_BASE) * ratio) *
      (p.attackDamageMul || 1) *
      1.2;
    p.swingDamage = pelletBase * p.damageMultiplier;
    const ang = p.facing;
    const speed = SPREAD_SPEED * 1.05;
    const maxDist = spreadDistForPlayer(p, 1);
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 6);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 6);
    const count = 14;
    const cone = 0.82;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const pelletAng = ang + t * cone;
      projectiles.push({
        kind: "spread",
        pelletIdx: i,
        x: ox,
        y: oy,
        px: ox,
        py: oy,
        spawnX: ox,
        spawnY: oy,
        vx: Math.cos(pelletAng) * speed,
        vy: Math.sin(pelletAng) * speed,
        baseSpeed: speed,
        age: 0,
        ownerNum: p.playerNum,
        swingId: p.swingId,
        baseDamage: p.swingDamage,
        knockMul: p.swingKnockMul,
        maxDist: maxDist,
        traveled: 0,
        r: SPREAD_HIT_R,
        color: p.color,
        ultShot: true,
      });
    }
    p.ultFlashT = 0.35;
  }

  function fireUltimateNova(p) {
    p.swingId += 1;
    // Supernova is a self-curse: no damage, no targeting enemies — Nova
    // herself gets Chaos Field, so any knockback SHE takes gets inverted
    // into (or, if already a pull, strengthened as) a pull toward whoever
    // hit her.
    p.novaChaosKnockT = NOVA_ULT_CHAOS_DURATION;
    spawnRingBurst(p.x, p.y, p.color, novaDistForPlayer(p, 1) * 1.08);
    p.ultFlashT = 0.4;
  }

  function fireUltimatePhoenix(p) {
    if (p.hp <= 0 || isHordeHeroDowned(p)) {
      if (gameMode === "horde" && isHordeHeroDowned(p)) {
        hordeReviveHero(p);
      } else {
        p.hp = Math.max(1, Math.round(p.maxHp * 0.65));
      }
      cancelPhoenixReviveState(p);
      p.phoenixRebirthArmedT = 0;
      // Using the ultimate to come back from downed/dead IS an actual
      // revive, so it earns a permanent stack just like tryPhoenixUltRebirth
      // does.
      p.phoenixReviveStacks = (p.phoenixReviveStacks || 0) + 1;
    } else {
      // Just arming the Rebirth window is NOT a revive by itself — the
      // stack (and its permanent buffs, and the compounding HP-on-revive
      // penalty) is only earned if Rebirth actually saves them later, in
      // tryPhoenixUltRebirth. Casting the ultimate and never needing it
      // should not silently cost future revives HP.
      p.phoenixRebirthArmedT = PHOENIX_ULT_REBIRTH_WINDOW;
    }
    p.ultDmgMulT = PHOENIX_ULT_DMG_DURATION;
    const radius = 100;
    forEachUltimateVictims(p, radius, (t) => {
      dealUltimateHit(p, t, 14, { knockMul: 0.08 });
    });
    p.ultFlashT = 0.55;
  }

  function clearEchoSummonsForOwner(ownerNum) {
    const list = mapRuntime.echoSummons;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].ownerNum === ownerNum) list.splice(i, 1);
    }
  }

  function fireUltimateEcho(p) {
    clearEchoSummonsForOwner(p.playerNum);
    const list = mapRuntime.echoSummons;
    const hp = scaleHp(ECHO_SUMMON_HP);
    for (let i = 0; i < ECHO_SUMMON_COUNT; i++) {
      const ang = -Math.PI / 2 + (Math.PI * 2 * i) / ECHO_SUMMON_COUNT;
      const x = p.x + Math.cos(ang) * ECHO_SUMMON_ORBIT;
      const y = p.y + Math.sin(ang) * ECHO_SUMMON_ORBIT;
      const pt = clampPointToArena(x, y, ECHO_SUMMON_R + 4);
      list.push({
        id: ++mapRuntime.echoSummonNextId,
        ownerNum: p.playerNum,
        orbitAng: ang,
        x: pt.x,
        y: pt.y,
        vx: 0,
        vy: 0,
        facing: p.facing,
        r: ECHO_SUMMON_R,
        hp: hp,
        maxHp: hp,
        life: ECHO_SUMMON_DURATION,
        maxLife: ECHO_SUMMON_DURATION,
        attackT: 0,
        swingId: 0,
        chargeT: 0,
        lastSwingChargeRatio: 0,
        lastCopiedSwingId: p.swingId || 0,
        hitFlash: 0,
        spawnFlash: 0.4,
        color: p.color,
      });
    }
    spawnRingBurst(p.x, p.y, p.color, ECHO_SUMMON_ORBIT + 10);
    spawnHitSparks(p.x, p.y, p.color, 10);
    p.ultFlashT = 0.55;
  }

  function clearPikeSpearsForOwner(ownerNum) {
    const list = mapRuntime.pikeSpears;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].ownerNum === ownerNum) list.splice(i, 1);
    }
  }

  function getPikeSpearOwner(spear) {
    return players.find((pl) => pl.playerNum === spear.ownerNum);
  }

  function canHurtPikeSpear(attacker, spear) {
    if (!attacker || !spear || spear.hp <= 0) return false;
    if (attacker.playerNum != null && attacker.playerNum === spear.ownerNum) {
      return false;
    }
    const owner = getPikeSpearOwner(spear);
    if (!owner) return true;
    if (attacker.playerNum != null) {
      return fightersCanDamage(attacker, owner);
    }
    return gameMode === "horde" || !!attacker.isBot;
  }

  function damagePikeSpear(spear, dmg, source) {
    if (!spear || spear.hp <= 0 || dmg <= 0) return;
    dmg = scaleDmg(dmg);
    spear.hp = Math.max(0, spear.hp - dmg);
    spear.hitFlash = Math.max(spear.hitFlash || 0, 0.16);
    if (spear.hp <= 0) {
      spawnPopBurst(spear.x, spear.y, spear.color || "#38bdf8");
      spawnHitSparks(spear.x, spear.y, spear.color || "#38bdf8", 8);
    }
  }

  function pikeSpearPickTarget(spear, owner) {
    if (!owner) return null;
    let best = null;
    let bestD = Infinity;
    const consider = (x, y, entity) => {
      const d = len(x - spear.x, y - spear.y);
      if (d < bestD) {
        bestD = d;
        best = entity;
      }
    };
    if (gameMode === "horde") {
      if (hordeBossWaveActive()) {
        const boss = getHordeBossPlayer();
        if (boss && boss.hp > 0) consider(boss.x, boss.y, boss);
      } else {
        const list = mapRuntime.waveEnemies;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e.hp <= 0) continue;
          consider(e.x, e.y, e);
        }
      }
      return best;
    }
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (t === owner || t.hp <= 0) continue;
      if (!fightersCanDamage(owner, t)) continue;
      consider(t.x, t.y, t);
    }
    return best;
  }

  function pikeSpearDetonateOn(spear, owner, target) {
    if (!spear || !target || spear.hp <= 0) return;
    const dmg =
      LANCE_SPEAR_DAMAGE *
      (owner && owner.damageMultiplier != null ? owner.damageMultiplier : 1) *
      (owner && owner.attackDamageMul != null ? owner.attackDamageMul : 1);
    if (target.playerNum != null) {
      dealUltimateHit(owner || spear, target, dmg, {
        knockMul: LANCE_SPEAR_KNOCK_MUL,
        hitFlash: 0.28,
      });
      applySlowDebuff(target, LANCE_SPEAR_SLOW_DURATION, LANCE_SPEAR_SLOW_MUL);
    } else if (target.r != null && target.hp != null) {
      if (gameMode === "horde" && mapRuntime.waveEnemies.indexOf(target) >= 0) {
        damageWaveEnemy(target, dmg, spear);
      } else {
        target.hp = Math.max(0, target.hp - scaleDmg(dmg));
        target.hitFlash = Math.max(target.hitFlash || 0, 0.14);
      }
      applySlowDebuff(target, LANCE_SPEAR_SLOW_DURATION, LANCE_SPEAR_SLOW_MUL);
    }
    spawnHitSparks(spear.x, spear.y, spear.color || "#38bdf8", 14);
    spawnRingBurst(spear.x, spear.y, spear.color || "#38bdf8", 28);
    spear.hp = 0;
  }

  function fireUltimatePike(p) {
    clearPikeSpearsForOwner(p.playerNum);
    const ang = p.facing;
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 10);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 10);
    const hp = scaleHp(LANCE_SPEAR_HP);
    mapRuntime.pikeSpears.push({
      id: ++mapRuntime.pikeSpearNextId,
      ownerNum: p.playerNum,
      x: ox,
      y: oy,
      px: ox,
      py: oy,
      vx: Math.cos(ang) * LANCE_SPEAR_SPEED,
      vy: Math.sin(ang) * LANCE_SPEAR_SPEED,
      facing: ang,
      r: LANCE_SPEAR_R,
      hp: hp,
      maxHp: hp,
      life: LANCE_SPEAR_LIFE,
      maxLife: LANCE_SPEAR_LIFE,
      hitFlash: 0,
      spawnFlash: 0.35,
      color: p.color,
      lastHitSwingKey: "",
    });
    spawnHitSparks(ox, oy, p.color, 10);
    p.ultFlashT = 0.5;
  }

  function resolvePikeSpearWall(s) {
    let res = resolveArenaBoundary(s.x, s.y, s.vx, s.vy, s.r);
    s.x = res.x;
    s.y = res.y;
    s.vx = res.vx;
    s.vy = res.vy;
    res = resolveObstacleCollision(s.x, s.y, s.vx, s.vy, s.r);
    s.x = res.x;
    s.y = res.y;
    s.vx = res.vx;
    s.vy = res.vy;
  }

  function updatePikeSpears(dt) {
    const list = mapRuntime.pikeSpears;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const owner = getPikeSpearOwner(s);
      if (!owner || owner.hp <= 0 || owner.eliminated || s.hp <= 0) {
        if (s.hp > 0) spawnPopBurst(s.x, s.y, s.color || "#38bdf8");
        list.splice(i, 1);
        continue;
      }
      s.life = Math.max(0, (s.life || 0) - dt);
      if (s.life <= 0) {
        spawnPopBurst(s.x, s.y, s.color || "#38bdf8");
        list.splice(i, 1);
        continue;
      }
      s.hitFlash = Math.max(0, (s.hitFlash || 0) - dt);
      s.spawnFlash = Math.max(0, (s.spawnFlash || 0) - dt);

      const target = pikeSpearPickTarget(s, owner);
      if (target) {
        const desired = Math.atan2(target.y - s.y, target.x - s.x);
        let cur = Math.atan2(s.vy, s.vx);
        if (!(Math.abs(s.vx) + Math.abs(s.vy) > 1e-3)) cur = s.facing || desired;
        let diff = angleDiff(desired, cur);
        const maxTurn = LANCE_SPEAR_TURN * dt;
        if (diff > maxTurn) diff = maxTurn;
        if (diff < -maxTurn) diff = -maxTurn;
        cur += diff;
        s.vx = Math.cos(cur) * LANCE_SPEAR_SPEED;
        s.vy = Math.sin(cur) * LANCE_SPEAR_SPEED;
        s.facing = cur;
      } else {
        const spd = len(s.vx, s.vy);
        if (spd > 1e-3) {
          s.vx = (s.vx / spd) * LANCE_SPEAR_SPEED;
          s.vy = (s.vy / spd) * LANCE_SPEAR_SPEED;
          s.facing = Math.atan2(s.vy, s.vx);
        }
      }

      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      resolvePikeSpearWall(s);

      let detonated = false;
      if (gameMode === "horde") {
        if (hordeBossWaveActive()) {
          const boss = getHordeBossPlayer();
          if (
            boss &&
            boss.hp > 0 &&
            len(boss.x - s.x, boss.y - s.y) <= s.r + getPlayerRadius(boss)
          ) {
            pikeSpearDetonateOn(s, owner, boss);
            detonated = true;
          }
        } else {
          const wlist = mapRuntime.waveEnemies;
          for (let wi = 0; wi < wlist.length; wi++) {
            const e = wlist[wi];
            if (e.hp <= 0) continue;
            if (len(e.x - s.x, e.y - s.y) > s.r + e.r) continue;
            pikeSpearDetonateOn(s, owner, e);
            detonated = true;
            break;
          }
        }
      } else {
        for (let pi = 0; pi < players.length; pi++) {
          const t = players[pi];
          if (t === owner || t.hp <= 0) continue;
          if (!fightersCanDamage(owner, t)) continue;
          if (len(t.x - s.x, t.y - s.y) > s.r + getPlayerRadius(t)) continue;
          pikeSpearDetonateOn(s, owner, t);
          detonated = true;
          break;
        }
      }
      if (detonated || s.hp <= 0) {
        list.splice(i, 1);
        continue;
      }
    }
  }

  function tryHitPikeSpears(attacker) {
    if (attacker.hp <= 0 || attacker.attackT <= 0) return;
    if (
      !isBulwarkAuraSwing(attacker) &&
      (attacker.attackStyle === "ranged" ||
        attacker.attackStyle === "spread" ||
        attacker.attackStyle === "nova" ||
        attacker.attackStyle === "barrage" ||
        attacker.attackStyle === "dash" ||
        attacker.attackStyle === "phoenix" ||
        attacker.attackStyle === "bounce" ||
        attacker.attackStyle === "beam")
    ) {
      return;
    }
    const list = mapRuntime.pikeSpears;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      if (!canHurtPikeSpear(attacker, s)) continue;
      let hit = false;
      if (isBulwarkAuraSwing(attacker)) {
        const ratio = attacker.lastSwingChargeRatio;
        const radius = auraRadiusForPlayer(attacker, ratio);
        hit = len(s.x - attacker.x, s.y - attacker.y) <= radius + s.r;
      } else if (attacker.attackStyle === "lance") {
        hit = lanceCorridorHit(attacker, s.x, s.y, s.r);
      } else {
        const dx = s.x - attacker.x;
        const dy = s.y - attacker.y;
        const d = len(dx, dy);
        const ratio = attacker.lastSwingChargeRatio;
        const range = attackSectorRange(attacker, ratio);
        const arc = attackSectorArc(attacker, ratio);
        if (d <= range + s.r) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), attacker.facing));
          hit = ad <= arc * 0.5 || d < 8;
        }
      }
      if (!hit) continue;
      const swingKey =
        attacker.playerNum + ":ps:" + attacker.swingId + ":" + s.id;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      damagePikeSpear(
        s,
        meleeSwingDamageForTarget(attacker, s.x, s.y),
        attacker
      );
      if (s.hp <= 0) list.splice(i, 1);
    }
  }

  function tryProjectileHitPikeSpears(pr, owner, consumeOnHit) {
    if (!owner) return false;
    const list = mapRuntime.pikeSpears;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      if (!canHurtPikeSpear(owner, s)) continue;
      if (len(s.x - pr.x, s.y - pr.y) > pr.r + s.r) continue;
      const swingKey =
        pr.ownerNum +
        ":pps:" +
        pr.swingId +
        ":" +
        (pr.pelletIdx != null ? pr.pelletIdx : 0) +
        ":" +
        s.id;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: s.x, y: s.y });
      damagePikeSpear(s, Math.max(3, boltDmg * 0.85), owner);
      if (s.hp <= 0) list.splice(i, 1);
      if (consumeOnHit !== false) return true;
    }
    return false;
  }

  function tryDashHitPikeSpears(attacker) {
    if (!isDashing(attacker) || attacker.hp <= 0) return;
    const list = mapRuntime.pikeSpears;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      if (!canHurtPikeSpear(attacker, s)) continue;
      if (
        len(s.x - attacker.x, s.y - attacker.y) >
        getPlayerRadius(attacker) + s.r + DASH_HIT_PAD
      ) {
        continue;
      }
      const swingKey =
        attacker.playerNum + ":dsp:" + attacker.swingId + ":" + s.id;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      damagePikeSpear(
        s,
        attacker.swingDamage * DASH_DAMAGE_IMPERFECT_MUL * dashMul,
        attacker
      );
      attacker.dashHitLanded = true;
      if (s.hp <= 0) list.splice(i, 1);
    }
  }

  function drawPikeSpears() {
    const list = mapRuntime.pikeSpears;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.hp <= 0) continue;
      const flash = (s.hitFlash || 0) > 0;
      const lifeFrac = s.maxLife > 1e-3 ? clamp(s.life / s.maxLife, 0, 1) : 1;
      const hpFrac = s.maxHp > 0 ? clamp(s.hp / s.maxHp, 0, 1) : 0;
      const ang = s.facing || Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ang);
      ctx.globalAlpha =
        (0.75 + 0.25 * lifeFrac) *
        ((s.spawnFlash || 0) > 0 ? 0.7 + 0.3 * (s.spawnFlash / 0.35) : 1);

      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(18, 0);
      ctx.strokeStyle = flash ? "#fff" : "#2a3140";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(14, 0);
      ctx.strokeStyle = flash ? "#fff" : s.color || "#38bdf8";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(26, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fillStyle = flash ? "#fff" : s.color || "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.rotate(-ang);
      const barW = 26;
      const barH = 3;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(6,10,18,0.75)";
      ctx.fillRect(-barW * 0.5, -22, barW, barH);
      ctx.fillStyle = hpFrac > 0.35 ? "#7ee787" : "#f07178";
      ctx.fillRect(-barW * 0.5, -22, barW * hpFrac, barH);
      ctx.restore();
    }
  }

  function grapplerHookAim(p) {
    const facing =
      p.grapplerHookFacing != null ? p.grapplerHookFacing : p.facing;
    const cx = Math.cos(facing);
    const cy = Math.sin(facing);
    const r = getPlayerRadius(p);
    return {
      facing: facing,
      cx: cx,
      cy: cy,
      x0: p.x + cx * (r + 10),
      y0: p.y + cy * (r + 10),
    };
  }

  function grapplerHookTip(p) {
    const aim = grapplerHookAim(p);
    const hookLen = p.grapplerHookLen || 0;
    return {
      x0: aim.x0,
      y0: aim.y0,
      x1: aim.x0 + aim.cx * hookLen,
      y1: aim.y0 + aim.cy * hookLen,
      cx: aim.cx,
      cy: aim.cy,
    };
  }

  function grapplerHookMaxLen(p) {
    const aim = grapplerHookAim(p);
    const wall = rayDistToArenaWall(aim.x0, aim.y0, aim.cx, aim.cy, 10);
    if (wall <= 0 || !Number.isFinite(wall)) return GRAPPLER_HOOK_RANGE;
    return Math.min(GRAPPLER_HOOK_RANGE, wall);
  }

  function grapplerHookTargetRadius(target) {
    if (!target) return PLAYER_R;
    if (target.playerNum != null) return getPlayerRadius(target);
    return target.r != null ? target.r : 14;
  }

  function grapplerHookFindVictim(p) {
    const line = grapplerHookTip(p);
    let best = null;
    let bestAlong = Infinity;
    let bestKind = null;
    let bestId = null;

    function consider(target, kind, id, hitPad) {
      if (!target || target.hp <= 0) return;
      const hitR = grapplerHookTargetRadius(target) + hitPad;
      if (
        distPointToSegment(
          target.x,
          target.y,
          line.x0,
          line.y0,
          line.x1,
          line.y1
        ) > hitR
      ) {
        return;
      }
      const along =
        (target.x - line.x0) * line.cx + (target.y - line.y0) * line.cy;
      if (along < 12 || along > (p.grapplerHookLen || 0) + 8) return;
      if (along < bestAlong) {
        bestAlong = along;
        best = target;
        bestKind = kind;
        bestId = id;
      }
    }

    if (gameMode === "horde") {
      const wlist = mapRuntime.waveEnemies;
      for (let i = 0; i < wlist.length; i++) {
        consider(wlist[i], "wave", wlist[i].id, GRAPPLER_HOOK_HALF_WIDTH);
      }
      if (hordeBossWaveActive()) {
        const boss = getHordeBossPlayer();
        if (boss && fightersCanDamage(p, boss)) {
          consider(boss, "boss", boss.playerNum, GRAPPLER_HOOK_HALF_WIDTH);
        }
      }
    } else {
      for (let i = 0; i < players.length; i++) {
        const t = players[i];
        if (t === p || t.hp <= 0) continue;
        if (!fightersCanDamage(p, t)) continue;
        consider(t, "player", t.playerNum, GRAPPLER_HOOK_HALF_WIDTH);
      }
    }
    return best
      ? { target: best, along: bestAlong, kind: bestKind, id: bestId }
      : null;
  }

  function grapplerHookResolveTarget(p) {
    const kind = p.grapplerHookTargetKind;
    const id = p.grapplerHookTargetId;
    if (kind == null || id == null) return null;
    if (kind === "player" || kind === "boss") {
      for (let i = 0; i < players.length; i++) {
        if (players[i].playerNum === id) return players[i];
      }
      return null;
    }
    if (kind === "wave") {
      const list = mapRuntime.waveEnemies;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
    }
    return null;
  }

  function beginGrapplerHookPull(p, hit) {
    const target = hit.target;
    p.grapplerHookActive = false;
    p.grapplerHookLen = Math.max(18, hit.along);
    p.grapplerHookPullT = GRAPPLER_HOOK_PULL_TIME;
    p.grapplerHookTargetKind = hit.kind;
    p.grapplerHookTargetId = hit.id;
    p.grapplerHookMissT = 0;
    p.grapplerHookSwingId = (p.grapplerHookSwingId || 0) + 1;
    dealUltimateHit(p, target, GRAPPLER_HOOK_DAMAGE, {
      knockMul: 0.02,
      hitFlash: 0.22,
    });
    p.grapplerChargeBoostT = GRAPPLER_HOOK_CHARGE_BOOST_DUR;
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.cooldown = Math.max(p.cooldown, 0.12);
    p.vx *= 0.2;
    p.vy *= 0.2;
    spawnHitSparks(target.x, target.y, p.color, 12);
  }

  function endGrapplerHook(p) {
    p.grapplerHookActive = false;
    p.grapplerHookLen = 0;
    p.grapplerHookPullT = 0;
    p.grapplerHookTargetKind = null;
    p.grapplerHookTargetId = null;
    p.grapplerHookMissT = 0;
  }

  function fireUltimateGrappler(p) {
    p.grapplerHookFacing = p.facing;
    p.grapplerHookActive = true;
    p.grapplerHookLen = 0;
    p.grapplerHookMissT = 0;
    p.grapplerHookPullT = 0;
    p.grapplerHookTargetKind = null;
    p.grapplerHookTargetId = null;
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.vx *= 0.15;
    p.vy *= 0.15;
    p.ultFlashT = 0.45;
    p.ultActiveT = Math.max(p.ultActiveT || 0, 0.85);
  }

  function tickGrapplerHookExtend(p, dt) {
    const maxLen = grapplerHookMaxLen(p);
    p.grapplerHookLen = (p.grapplerHookLen || 0) + GRAPPLER_HOOK_SPEED * dt;
    const hit = grapplerHookFindVictim(p);
    if (hit) {
      beginGrapplerHookPull(p, hit);
      return;
    }
    if (p.grapplerHookLen >= maxLen) {
      p.grapplerHookLen = maxLen;
      p.grapplerHookActive = false;
      p.grapplerHookMissT = GRAPPLER_HOOK_MISS_RETRACT;
    }
  }

  function tickGrapplerHookPull(p, dt) {
    const target = grapplerHookResolveTarget(p);
    if (!target || target.hp <= 0) {
      endGrapplerHook(p);
      return;
    }
    const aim = grapplerHookAim(p);
    const stopD =
      getPlayerRadius(p) +
      grapplerHookTargetRadius(target) +
      GRAPPLER_HOOK_PULL_STOP;
    const dx = p.x - target.x;
    const dy = p.y - target.y;
    let d = len(dx, dy);
    p.grapplerHookPullT = Math.max(0, (p.grapplerHookPullT || 0) - dt);

    if (d > 1e-3) {
      const pull = Math.min(
        Math.max(0, d - stopD),
        (GRAPPLER_HOOK_RANGE / GRAPPLER_HOOK_PULL_TIME) * 1.2 * dt
      );
      if (pull > 0) {
        target.x += (dx / d) * pull;
        target.y += (dy / d) * pull;
        if (target.playerNum != null) {
          resolvePlayerWall(target);
        } else {
          resolveWaveEnemyWall(target);
        }
      }
    }
    d = len(p.x - target.x, p.y - target.y);
    const along =
      (target.x - aim.x0) * aim.cx + (target.y - aim.y0) * aim.cy;
    p.grapplerHookLen = clamp(along, 12, grapplerHookMaxLen(p));

    if (d <= stopD || p.grapplerHookPullT <= 0) {
      endGrapplerHook(p);
      p.cooldown = Math.max(p.cooldown, 0.14);
    }
  }

  function tickGrapplerHook(p, dt) {
    if (!isGrappler(p) || p.hp <= 0) {
      if (isGrappler(p)) endGrapplerHook(p);
      return;
    }
    if ((p.grapplerHookMissT || 0) > 0) {
      p.grapplerHookMissT = Math.max(0, p.grapplerHookMissT - dt);
      const maxLen = grapplerHookMaxLen(p);
      const t =
        GRAPPLER_HOOK_MISS_RETRACT > 1e-3
          ? p.grapplerHookMissT / GRAPPLER_HOOK_MISS_RETRACT
          : 0;
      p.grapplerHookLen = maxLen * t;
      if (p.grapplerHookMissT <= 0) p.grapplerHookLen = 0;
    }
    if ((p.grapplerHookPullT || 0) > 0) {
      tickGrapplerHookPull(p, dt);
      return;
    }
    if (p.grapplerHookActive) {
      tickGrapplerHookExtend(p, dt);
    }
  }

  function drawGrapplerHook(p) {
    if (!isGrappler(p) || p.hp <= 0) return;
    const active =
      p.grapplerHookActive ||
      (p.grapplerHookPullT || 0) > 0 ||
      (p.grapplerHookMissT || 0) > 0;
    if (!active) return;

    const aim = grapplerHookAim(p);
    const hookLen = p.grapplerHookLen || 0;
    if (hookLen < 4) return;
    const x1 = aim.x0 + aim.cx * hookLen;
    const y1 = aim.y0 + aim.cy * hookLen;

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20, 184, 166, 0.9)";
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(aim.x0, aim.y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = 2.1;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(aim.x0, aim.y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(x1, y1);
    ctx.rotate(aim.facing);
    ctx.fillStyle = "rgba(45, 212, 191, 0.95)";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-6, 9);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 80, 70, 0.9)";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  function applySiphonChargeSlow(target) {
    if (!target || target.isBot || target.playerNum == null) return;
    target.chargeSlowT = Math.max(
      target.chargeSlowT || 0,
      SIPHON_ULT_CHARGE_SLOW_DUR
    );
    target.chargeSlowMul = SIPHON_ULT_CHARGE_SLOW_MUL;
  }

  function siphonPullTargets(p, dt) {
    const radius = SIPHON_ULT_PULL_RADIUS;
    const pull = SIPHON_ULT_PULL_SPEED * dt;
    function yank(t, tr) {
      if (!t || t.hp <= 0) return;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const d = len(dx, dy);
      if (d > radius + tr || d < 1e-3) return;
      const stop = 6;
      const step = Math.min(pull, Math.max(0, d - stop));
      if (step <= 0) return;
      t.x += (dx / d) * step;
      t.y += (dy / d) * step;
      if (t.playerNum != null) resolvePlayerWall(t);
      else if (typeof resolveWaveEnemyWall === "function") resolveWaveEnemyWall(t);
    }

    if (gameMode === "horde") {
      const list = mapRuntime.waveEnemies;
      for (let i = 0; i < list.length; i++) {
        yank(list[i], list[i].r || 14);
      }
      if (hordeBossWaveActive()) {
        const boss = getHordeBossPlayer();
        if (boss && fightersCanDamage(p, boss)) {
          yank(boss, getPlayerRadius(boss));
        }
      }
      return;
    }
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (t === p || t.hp <= 0) continue;
      if (!fightersCanDamage(p, t)) continue;
      yank(t, getPlayerRadius(t));
    }
  }

  function fireSiphonShockwave(p) {
    p.siphonShockVfxT = SIPHON_ULT_SHOCK_VFX;
    p.siphonShockX = p.x;
    p.siphonShockY = p.y;
    spawnRingBurst(p.x, p.y, p.color, SIPHON_ULT_SHOCK_RADIUS * 0.4);
    spawnHitSparks(p.x, p.y, p.color, 16);
    forEachUltimateVictims(p, SIPHON_ULT_SHOCK_RADIUS, (t) => {
      dealUltimateHit(p, t, SIPHON_ULT_SHOCK_DAMAGE, {
        knockMul: SIPHON_ULT_SHOCK_KNOCK_MUL,
      });
      applySiphonChargeSlow(t);
      siphonShockPushOutward(p, t);
    });
  }

  function siphonShockPushOutward(from, target) {
    if (!target || target.hp <= 0) return;
    let dx = target.x - from.x;
    let dy = target.y - from.y;
    let d = len(dx, dy);
    let nx;
    let ny;
    if (d < 1e-3) {
      const a = Math.random() * Math.PI * 2;
      nx = Math.cos(a);
      ny = Math.sin(a);
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    const shove = SIPHON_ULT_SHOCK_SHOVE;
    target.x += nx * shove;
    target.y += ny * shove;
    if (target.playerNum != null) {
      const resist =
        target.knockbackResistMul != null ? target.knockbackResistMul : 1;
      const impulse = KNOCKBACK * SIPHON_ULT_SHOCK_KNOCK_MUL * 0.55 * resist;
      target.vx += nx * impulse;
      target.vy += ny * impulse;
      resolvePlayerWall(target);
    } else if (typeof resolveWaveEnemyWall === "function") {
      if (target.vx != null) {
        target.vx += nx * KNOCKBACK * 0.12;
        target.vy += ny * KNOCKBACK * 0.12;
      }
      resolveWaveEnemyWall(target);
    } else if (typeof resolveCreatureWall === "function") {
      resolveCreatureWall(target);
    }
  }

  function fireUltimateSiphon(p) {
    p.siphonUltPullT = SIPHON_ULT_PULL_DURATION;
    p.siphonUltShockPending = true;
    p.siphonPhaseT =
      SIPHON_ULT_PULL_DURATION + SIPHON_ULT_INVULN_PAD;
    p.ultActiveT = Math.max(
      p.ultActiveT || 0,
      SIPHON_ULT_PULL_DURATION + SIPHON_ULT_SHOCK_VFX
    );
    p.ultFlashT = 0.55;
    p.vx *= 0.2;
    p.vy *= 0.2;
    spawnRingBurst(p.x, p.y, p.color, 28);
  }

  /** Marionette ult — brief windup (ticked in tickUltimateState), then the
   *  actual spike fires via fireMarionetteNeedleBolt. */
  function fireUltimateMarionette(p) {
    p.marionetteUltWindupT = MARIONETTE_ULT_WINDUP;
    p.ultFlashT = MARIONETTE_ULT_WINDUP + 0.25;
    spawnRingBurst(p.x, p.y, p.color, 20);
  }

  function fireMarionetteNeedleBolt(p) {
    const ang = p.facing;
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 10);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 10);
    mapRuntime.marionetteBolts.push({
      id: ++mapRuntime.marionetteBoltNextId,
      ownerNum: p.playerNum,
      x: ox,
      y: oy,
      px: ox,
      py: oy,
      vx: Math.cos(ang) * MARIONETTE_ULT_BOLT_SPEED,
      vy: Math.sin(ang) * MARIONETTE_ULT_BOLT_SPEED,
      facing: ang,
      r: MARIONETTE_ULT_BOLT_R,
      life: MARIONETTE_ULT_BOLT_LIFE,
      maxLife: MARIONETTE_ULT_BOLT_LIFE,
      spawnFlash: 0.35,
      color: p.color,
    });
    spawnHitSparks(ox, oy, p.color, 10);
  }

  function clearMarionetteEffigyForOwner(ownerNum) {
    const list = mapRuntime.marionetteEffigies;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].ownerNum === ownerNum) list.splice(i, 1);
    }
  }

  function getMarionetteEffigyOwner(d) {
    return players.find((pl) => pl.playerNum === d.ownerNum);
  }

  function getMarionetteEffigyTarget(d) {
    return players.find((pl) => pl.playerNum === d.targetNum);
  }

  /** Only one effigy per caster — a fresh ult hit replaces the old one. */
  function spawnMarionetteEffigy(owner, target) {
    clearMarionetteEffigyForOwner(owner.playerNum);
    const ang = owner.facing;
    const dist = getPlayerRadius(owner) + MARIONETTE_EFFIGY_SPAWN_DIST;
    const ox = owner.x + Math.cos(ang) * dist;
    const oy = owner.y + Math.sin(ang) * dist;
    const pt = clampPointToArena(ox, oy, MARIONETTE_EFFIGY_R + 4);
    const hp = Math.max(1, Math.round(target.hp));
    mapRuntime.marionetteEffigies.push({
      id: ++mapRuntime.marionetteEffigyNextId,
      ownerNum: owner.playerNum,
      targetNum: target.playerNum,
      x: pt.x,
      y: pt.y,
      r: MARIONETTE_EFFIGY_R,
      hp: hp,
      maxHp: hp,
      life: MARIONETTE_EFFIGY_DURATION,
      maxLife: MARIONETTE_EFFIGY_DURATION,
      hitFlash: 0,
      spawnFlash: 0.4,
      color: target.color,
    });
    spawnRingBurst(pt.x, pt.y, target.color, MARIONETTE_EFFIGY_R + 8);
  }

  function marionetteBoltDetonateOn(bolt, owner, target) {
    if (!bolt || !target) return;
    dealUltimateHit(owner, target, MARIONETTE_ULT_BOLT_DAMAGE, {
      knockMul: 0.35,
      hitFlash: 0.26,
    });
    spawnHitSparks(bolt.x, bolt.y, bolt.color || "#7c3aed", 14);
    spawnRingBurst(bolt.x, bolt.y, bolt.color || "#7c3aed", 26);
    if (target.playerNum != null && target.hp > 0) {
      spawnMarionetteEffigy(owner, target);
    }
  }

  function resolveMarionetteBoltWall(s) {
    let res = resolveArenaBoundary(s.x, s.y, s.vx, s.vy, s.r);
    s.x = res.x;
    s.y = res.y;
    s.vx = res.vx;
    s.vy = res.vy;
    res = resolveObstacleCollision(s.x, s.y, s.vx, s.vy, s.r);
    s.x = res.x;
    s.y = res.y;
    s.vx = res.vx;
    s.vy = res.vy;
  }

  function updateMarionetteBolts(dt) {
    const list = mapRuntime.marionetteBolts;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const owner = players.find((pl) => pl.playerNum === s.ownerNum);
      if (!owner || owner.hp <= 0 || owner.eliminated) {
        list.splice(i, 1);
        continue;
      }
      s.life = Math.max(0, (s.life || 0) - dt);
      if (s.life <= 0) {
        spawnPopBurst(s.x, s.y, s.color || "#7c3aed");
        list.splice(i, 1);
        continue;
      }
      s.spawnFlash = Math.max(0, (s.spawnFlash || 0) - dt);

      const target = pikeSpearPickTarget(s, owner);
      if (target) {
        const desired = Math.atan2(target.y - s.y, target.x - s.x);
        let cur = Math.atan2(s.vy, s.vx);
        if (!(Math.abs(s.vx) + Math.abs(s.vy) > 1e-3)) cur = s.facing || desired;
        let diff = angleDiff(desired, cur);
        const maxTurn = MARIONETTE_ULT_BOLT_TURN * dt;
        if (diff > maxTurn) diff = maxTurn;
        if (diff < -maxTurn) diff = -maxTurn;
        cur += diff;
        s.vx = Math.cos(cur) * MARIONETTE_ULT_BOLT_SPEED;
        s.vy = Math.sin(cur) * MARIONETTE_ULT_BOLT_SPEED;
        s.facing = cur;
      }

      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      resolveMarionetteBoltWall(s);

      let detonated = false;
      if (gameMode === "horde") {
        if (hordeBossWaveActive()) {
          const boss = getHordeBossPlayer();
          if (
            boss &&
            boss.hp > 0 &&
            len(boss.x - s.x, boss.y - s.y) <= s.r + getPlayerRadius(boss)
          ) {
            marionetteBoltDetonateOn(s, owner, boss);
            detonated = true;
          }
        } else {
          const wlist = mapRuntime.waveEnemies;
          for (let wi = 0; wi < wlist.length; wi++) {
            const e = wlist[wi];
            if (e.hp <= 0) continue;
            if (len(e.x - s.x, e.y - s.y) > s.r + e.r) continue;
            marionetteBoltDetonateOn(s, owner, e);
            detonated = true;
            break;
          }
        }
      } else {
        for (let pi = 0; pi < players.length; pi++) {
          const t = players[pi];
          if (t === owner || t.hp <= 0) continue;
          if (!fightersCanDamage(owner, t)) continue;
          if (len(t.x - s.x, t.y - s.y) > s.r + getPlayerRadius(t)) continue;
          marionetteBoltDetonateOn(s, owner, t);
          detonated = true;
          break;
        }
        if (!detonated && gameMode === "siege") {
          const blist = mapRuntime.bases;
          for (let bi = 0; bi < blist.length; bi++) {
            const base = blist[bi];
            if (base.destroyed || base.team === owner.fightTeam) continue;
            if (len(base.x - s.x, base.y - s.y) > s.r + base.r) continue;
            damageBase(base, MARIONETTE_ULT_BOLT_DAMAGE, owner);
            spawnHitSparks(s.x, s.y, s.color || "#7c3aed", 14);
            spawnRingBurst(s.x, s.y, s.color || "#7c3aed", 26);
            detonated = true;
            break;
          }
        }
      }
      if (detonated) {
        list.splice(i, 1);
        continue;
      }
      if (!isInsideArena(s.x, s.y, -20)) {
        list.splice(i, 1);
        continue;
      }
    }
  }

  function updateMarionetteEffigies(dt) {
    const list = mapRuntime.marionetteEffigies;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const owner = getMarionetteEffigyOwner(d);
      if (!owner || owner.hp <= 0 || owner.eliminated || d.hp <= 0) {
        if (d.hp > 0) spawnPopBurst(d.x, d.y, d.color || "#7c3aed");
        list.splice(i, 1);
        continue;
      }
      d.life = Math.max(0, (d.life || 0) - dt);
      if (d.life <= 0) {
        spawnPopBurst(d.x, d.y, d.color || "#7c3aed");
        list.splice(i, 1);
        continue;
      }
      d.hitFlash = Math.max(0, (d.hitFlash || 0) - dt);
      d.spawnFlash = Math.max(0, (d.spawnFlash || 0) - dt);
    }
  }

  /** Life-link: only the caster striking their own effigy transfers damage
   *  onward to the real target it was cast from (can kill them by proxy) —
   *  an enemy popping the doll just pops the doll. The effigy's own HP
   *  loss is scaled once here — pass the un-scaled dealt amount back
   *  through applyDamageTo so it isn't scaled a second time. */
  function damageMarionetteEffigy(d, dmg, attacker) {
    if (!d || d.hp <= 0 || dmg <= 0) return 0;
    const scaled = scaleDmg(dmg);
    const hpBefore = d.hp;
    d.hp = Math.max(0, d.hp - scaled);
    const dealt = hpBefore - d.hp;
    d.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(d.x, d.y, d.color || "#7c3aed", 5);
      if (attacker && attacker.playerNum === d.ownerNum) {
        const target = getMarionetteEffigyTarget(d);
        if (target && target.hp > 0 && fighterIsVulnerable(target)) {
          applyDamageTo(target, attacker, dealt / COMBAT_DMG_MUL, {
            hitFlash: 0.18,
          });
        }
      }
    }
    if (d.hp <= 0) {
      spawnPopBurst(d.x, d.y, d.color || "#7c3aed");
    }
    return dealt;
  }

  function tryHitMarionetteEffigies(attacker) {
    if (attacker.hp <= 0 || attacker.attackT <= 0) return;
    if (
      !isBulwarkAuraSwing(attacker) &&
      (attacker.attackStyle === "ranged" ||
        attacker.attackStyle === "spread" ||
        attacker.attackStyle === "nova" ||
        attacker.attackStyle === "barrage" ||
        attacker.attackStyle === "dash" ||
        attacker.attackStyle === "phoenix" ||
        attacker.attackStyle === "bounce" ||
        attacker.attackStyle === "beam")
    ) {
      return;
    }
    const list = mapRuntime.marionetteEffigies;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.hp <= 0) continue;
      const isOwnerAttacking = attacker.playerNum === d.ownerNum;
      const owner = getMarionetteEffigyOwner(d);
      if (!isOwnerAttacking && owner && !fightersCanDamage(attacker, owner)) continue;
      let hit = false;
      if (isBulwarkAuraSwing(attacker)) {
        const ratio = attacker.lastSwingChargeRatio;
        const radius = auraRadiusForPlayer(attacker, ratio);
        hit = len(d.x - attacker.x, d.y - attacker.y) <= radius + d.r;
      } else if (attacker.attackStyle === "lance") {
        hit = lanceCorridorHit(attacker, d.x, d.y, d.r);
      } else {
        const dx = d.x - attacker.x;
        const dy = d.y - attacker.y;
        const dd = len(dx, dy);
        const ratio = attacker.lastSwingChargeRatio;
        const range = attackSectorRange(attacker, ratio);
        const arc = attackSectorArc(attacker, ratio);
        if (dd <= range + d.r) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), attacker.facing));
          hit = ad <= arc * 0.5 || dd < 8;
        }
      }
      if (!hit) continue;
      const swingKey = attacker.playerNum + ":mfx:" + attacker.swingId;
      if (d.lastHitSwingKey === swingKey) continue;
      d.lastHitSwingKey = swingKey;
      damageMarionetteEffigy(
        d,
        meleeSwingDamageForTarget(attacker, d.x, d.y),
        attacker
      );
    }
  }

  function tryProjectileHitMarionetteEffigies(pr, owner, consumeOnHit) {
    if (!owner) return false;
    const list = mapRuntime.marionetteEffigies;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.hp <= 0) continue;
      const isOwnerAttacking = d.ownerNum === pr.ownerNum;
      const dollOwner = getMarionetteEffigyOwner(d);
      if (!isOwnerAttacking && dollOwner && !fightersCanDamage(owner, dollOwner)) continue;
      if (len(d.x - pr.x, d.y - pr.y) > pr.r + d.r) continue;
      const swingKey =
        pr.ownerNum +
        ":pmfx:" +
        pr.swingId +
        ":" +
        (pr.pelletIdx != null ? pr.pelletIdx : 0) +
        ":" +
        d.id;
      if (d.lastHitSwingKey === swingKey) continue;
      d.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: d.x, y: d.y });
      damageMarionetteEffigy(d, boltDmg, owner);
      if (consumeOnHit !== false) return true;
    }
    return false;
  }

  function tryDashHitMarionetteEffigies(attacker) {
    if (!isDashing(attacker) || attacker.hp <= 0) return;
    const list = mapRuntime.marionetteEffigies;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.hp <= 0) continue;
      const isOwnerAttacking = d.ownerNum === attacker.playerNum;
      const dollOwner = getMarionetteEffigyOwner(d);
      if (!isOwnerAttacking && dollOwner && !fightersCanDamage(attacker, dollOwner)) continue;
      if (
        len(d.x - attacker.x, d.y - attacker.y) >
        getPlayerRadius(attacker) + d.r + DASH_HIT_PAD
      ) {
        continue;
      }
      const swingKey = attacker.playerNum + ":dmfx:" + attacker.swingId;
      if (d.lastHitSwingKey === swingKey) continue;
      d.lastHitSwingKey = swingKey;
      damageMarionetteEffigy(
        d,
        attacker.swingDamage * DASH_DAMAGE_IMPERFECT_MUL * dashMul,
        attacker
      );
      attacker.dashHitLanded = true;
    }
  }

  function drawMarionetteBolts() {
    const list = mapRuntime.marionetteBolts;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const spawn = (s.spawnFlash || 0) > 0;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.facing || 0);
      ctx.globalAlpha = spawn ? 0.6 + 0.4 * (s.spawnFlash / 0.35) : 1;
      ctx.beginPath();
      ctx.moveTo(s.r * 1.6, 0);
      ctx.lineTo(-s.r, s.r * 0.55);
      ctx.lineTo(-s.r * 0.5, 0);
      ctx.lineTo(-s.r, -s.r * 0.55);
      ctx.closePath();
      ctx.fillStyle = s.color || "#7c3aed";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMarionetteEffigies() {
    const list = mapRuntime.marionetteEffigies;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const flash = (d.hitFlash || 0) > 0;
      const spawn = (d.spawnFlash || 0) > 0;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalAlpha = spawn ? 0.55 + 0.45 * (d.spawnFlash / 0.4) : 0.92;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#ffffff" : d.color || "#7c3aed";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Cross-stitching, to read as a bound effigy rather than a plain blob.
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.5, -d.r * 0.5);
      ctx.lineTo(d.r * 0.5, d.r * 0.5);
      ctx.moveTo(d.r * 0.5, -d.r * 0.5);
      ctx.lineTo(-d.r * 0.5, d.r * 0.5);
      ctx.stroke();
      ctx.restore();
      const hpFrac = d.maxHp > 0 ? clamp(d.hp / d.maxHp, 0, 1) : 0;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(d.x - d.r, d.y + d.r + 3, d.r * 2, 3);
      ctx.fillStyle = "rgba(196, 245, 66, 0.85)";
      ctx.fillRect(d.x - d.r, d.y + d.r + 3, d.r * 2 * hpFrac, 3);
      ctx.restore();
    }
  }

  function tickSiphonUltimate(p, dt) {
    if (!isSiphon(p)) return;
    if ((p.siphonUltPullT || 0) > 0) {
      siphonPullTargets(p, dt);
      p.siphonUltPullT = Math.max(0, p.siphonUltPullT - dt);
      if (p.siphonUltPullT <= 0 && p.siphonUltShockPending) {
        p.siphonUltShockPending = false;
        fireSiphonShockwave(p);
      }
    }
  }

  function drawSiphonUltimate(p) {
    if (!isSiphon(p) || p.hp <= 0) return;
    if ((p.siphonUltPullT || 0) > 0) {
      const life = p.siphonUltPullT;
      const t = 1 - life / SIPHON_ULT_PULL_DURATION;
      const fade = clamp(life / (SIPHON_ULT_PULL_DURATION * 0.45), 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, SIPHON_ULT_PULL_RADIUS * (0.55 + 0.45 * (1 - t)), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244, 63, 94, " + (0.55 * fade) + ")";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, SIPHON_ULT_PULL_RADIUS * (0.2 + 0.8 * t), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 180, 190, " + (0.4 * fade) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if ((p.siphonShockVfxT || 0) > 0) {
      const life = p.siphonShockVfxT;
      const t = 1 - life / SIPHON_ULT_SHOCK_VFX;
      const fade = clamp(life / (SIPHON_ULT_SHOCK_VFX * 0.5), 0, 1);
      const cx = p.siphonShockX != null ? p.siphonShockX : p.x;
      const cy = p.siphonShockY != null ? p.siphonShockY : p.y;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, SIPHON_ULT_SHOCK_RADIUS * (0.2 + 0.9 * t), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(244, 63, 94, " + (0.18 * fade) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 210, " + (0.75 * fade) + ")";
      ctx.lineWidth = 4 + 5 * (1 - t);
      ctx.stroke();
      ctx.restore();
    }
  }

  function fireUltimate(p) {
    const id = p.characterId || "brawler";
    p.ultCd = ultimateBaseCdFor(p);
    p.ultActiveT = 0.55;
    setLaserBeamActive(p, false);
    if (id === "brawler") fireUltimateBrawler(p);
    else if (id === "marksman") fireUltimateMarksman(p);
    else if (id === "striker") fireUltimateStriker(p);
    else if (id === "bulwark") fireUltimateBulwark(p);
    else if (id === "ricochet") fireUltimateRicochet(p);
    else if (id === "laser") fireUltimateLaser(p);
    else if (id === "scatter") fireUltimateScatter(p);
    else if (id === "nova") fireUltimateNova(p);
    else if (id === "phoenix") fireUltimatePhoenix(p);
    else if (id === "echo") fireUltimateEcho(p);
    else if (id === "pike") fireUltimatePike(p);
    else if (id === "grappler") fireUltimateGrappler(p);
    else if (id === "siphon") fireUltimateSiphon(p);
    else if (id === "marionette") fireUltimateMarionette(p);
    else fireUltimateBrawler(p);
  }

  function tryUseUltimate(p) {
    if (!ultimateReady(p)) return false;
    const ultKey = p.controls && p.controls.ultimate;
    fireUltimate(p);
    return true;
  }

  function tickUltimateState(p, dt) {
    if (p.isBot || p.eliminated) return;
    if (p.ultCd == null) initUltimateState(p);
    if ((p.ultCd || 0) > 0) p.ultCd = Math.max(0, p.ultCd - dt);
    if ((p.ultActiveT || 0) > 0) p.ultActiveT = Math.max(0, p.ultActiveT - dt);
    if ((p.ultLaserT || 0) > 0) {
      p.ultLaserT = Math.max(0, p.ultLaserT - dt);
      if (p.ultLaserT <= 0 && isLaser(p)) setLaserBeamActive(p, false);
    }
    if ((p.ultDamageResistT || 0) > 0) {
      p.ultDamageResistT = Math.max(0, p.ultDamageResistT - dt);
      if (
        (p.ultDamageResistT || 0) <= 0 &&
        isBulwark(p) &&
        p.hp > 0 &&
        !gameOver
      ) {
        // Ending Unbreakable auto-fires the circle aura (at least full charge).
        const raw = Math.max((p.chargeT || 0) / MAX_CHARGE, 1);
        beginBulwarkAuraSwing(p, raw);
      }
    }
    if ((p.ultDmgMulT || 0) > 0) p.ultDmgMulT = Math.max(0, p.ultDmgMulT - dt);
    if ((p.grapplerChargeBoostT || 0) > 0) {
      p.grapplerChargeBoostT = Math.max(0, p.grapplerChargeBoostT - dt);
    }
    if ((p.chargeSlowT || 0) > 0) {
      p.chargeSlowT = Math.max(0, p.chargeSlowT - dt);
      if (p.chargeSlowT <= 0) p.chargeSlowMul = 1;
    }
    if ((p.siphonPhaseT || 0) > 0) {
      p.siphonPhaseT = Math.max(0, p.siphonPhaseT - dt);
    }
    if ((p.siphonShockVfxT || 0) > 0) {
      p.siphonShockVfxT = Math.max(0, p.siphonShockVfxT - dt);
    }
    tickSiphonUltimate(p, dt);
    if ((p.marionetteUltWindupT || 0) > 0) {
      p.marionetteUltWindupT = Math.max(0, p.marionetteUltWindupT - dt);
      if (p.marionetteUltWindupT <= 0 && p.hp > 0 && !gameOver) {
        fireMarionetteNeedleBolt(p);
      }
    }
    if ((p.ultFlashT || 0) > 0) p.ultFlashT = Math.max(0, p.ultFlashT - dt);
    if ((p.seismicSlamT || 0) > 0) {
      p.seismicSlamT = Math.max(0, p.seismicSlamT - dt);
    }
    if ((p.phoenixRebirthArmedT || 0) > 0) {
      p.phoenixRebirthArmedT = Math.max(0, p.phoenixRebirthArmedT - dt);
      if (p.phoenixRebirthArmedT <= 0 && p.hp > 0) {
        // Window ran out without needing to revive -- small consolation heal.
        p.hp = Math.min(
          p.maxHp,
          p.hp + p.maxHp * PHOENIX_ULT_REBIRTH_EXPIRE_HEAL_MUL
        );
      }
    }
  }

  function drawUltimateRing(p) {
    if (p.isBot) return;
    if (p.eliminated) return;
    if (p.hp <= 0 && !isHordeHeroDowned(p)) return;
    const pr = getPlayerRadius(p);
    const ready = ultimateReady(p);
    const cd = p.ultCd || 0;
    const base = ultimateBaseCdFor(p);
    const frac = ready ? 1 : clamp(1 - cd / base, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, pr + 9, 0, Math.PI * 2);
    ctx.strokeStyle = ready
      ? "rgba(196, 245, 66, 0.85)"
      : "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = ready ? 2.5 : 1.5;
    ctx.stroke();
    if (!ready && frac > 0) {
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        pr + 9,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * frac
      );
      ctx.strokeStyle = "rgba(196, 245, 66, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if ((p.ultFlashT || 0) > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 14 + pulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 220, 120, " + (0.35 * p.ultFlashT) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if ((p.grapplerChargeBoostT || 0) > 0) {
      const boostFrac =
        GRAPPLER_HOOK_CHARGE_BOOST_DUR > 0
          ? clamp(p.grapplerChargeBoostT / GRAPPLER_HOOK_CHARGE_BOOST_DUR, 0, 1)
          : 0;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.018);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 11, 0, Math.PI * 2);
      ctx.strokeStyle =
        "rgba(45, 212, 191, " + (0.28 + 0.4 * pulse * boostFrac) + ")";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (isSiphonPhasing(p)) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.028);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 15, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, " + (0.2 + 0.35 * pulse) + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if ((p.phoenixRebirthArmedT || 0) > 0) {
      const armedFrac =
        PHOENIX_ULT_REBIRTH_WINDOW > 0
          ? clamp(p.phoenixRebirthArmedT / PHOENIX_ULT_REBIRTH_WINDOW, 0, 1)
          : 0;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.016);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 12, 0, Math.PI * 2);
      ctx.strokeStyle =
        "rgba(249, 115, 22, " + (0.25 + 0.35 * pulse * armedFrac) + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if ((p.novaChaosKnockT || 0) > 0) {
      const chaosFrac =
        NOVA_ULT_CHAOS_DURATION > 0
          ? clamp(p.novaChaosKnockT / NOVA_ULT_CHAOS_DURATION, 0, 1)
          : 0;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 13, 0, Math.PI * 2);
      ctx.strokeStyle =
        "rgba(232, 121, 249, " + (0.3 + 0.4 * pulse * chaosFrac) + ")";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function phoenixReviveDamageMul(p) {
    if (!isPhoenix(p)) return 1;
    const stacks = p.phoenixReviveStacks || 0;
    let mul = 1 + stacks * PHOENIX_REVIVE_DAMAGE_BONUS_PER;
    if ((p.phoenixRebirthDmgBonus || 0) > 0) {
      mul *= 1 + p.phoenixRebirthDmgBonus;
    }
    if ((p.ultDmgMulT || 0) > 0) mul *= PHOENIX_ULT_DMG_MUL;
    return mul;
  }

  /** Same stack counter as phoenixReviveDamageMul — permanent, grows with every Rebirth revive. */
  function phoenixReviveChargeSpeedMul(p) {
    if (!isPhoenix(p)) return 1;
    const stacks = p.phoenixReviveStacks || 0;
    return 1 + stacks * PHOENIX_REVIVE_CHARGE_SPEED_BONUS_PER;
  }

  /** Same stack counter as phoenixReviveDamageMul — permanent, grows with every Rebirth revive. */
  function phoenixReviveCooldownMul(p) {
    if (!isPhoenix(p)) return 1;
    const stacks = p.phoenixReviveStacks || 0;
    return Math.max(
      PHOENIX_REVIVE_COOLDOWN_MIN_MUL,
      1 - stacks * PHOENIX_REVIVE_COOLDOWN_REDUCTION_PER
    );
  }

  function trackPhoenixDamageDealt(attacker, dealt) {
    if (!attacker || dealt <= 0 || attacker.isBot) return;
    grantUltimateCdReduction(attacker, dealt);
  }

  function cancelPhoenixReviveState(p) {
    if (!isPhoenix(p)) return;
    p.phoenixReviving = false;
    p.phoenixReviveT = 0;
    p.phoenixReviveInterrupted = false;
  }

  /** If Rebirth is still armed, revive instead of dying. Returns true when handled. */
  function tryPhoenixUltRebirth(p) {
    if (!isPhoenix(p)) return false;
    if ((p.phoenixRebirthArmedT || 0) <= 0) return false;
    p.phoenixRebirthArmedT = 0;
    // If they died mid-ultimate, don't carry the leftover forward-narrow-bolt
    // attack mode / damage buff into the new life — attack comes back normal.
    p.ultDmgMulT = 0;
    cancelPhoenixReviveState(p);
    clearFighterCombatState(p);
    p.downed = false;
    p.eliminated = false;
    p.respawnT = 0;
    p.phoenixRebirthDmgBonus =
      (p.phoenixRebirthDmgBonus || 0) + PHOENIX_ULT_REBIRTH_DMG_BONUS;
    p.phoenixReviveStacks = (p.phoenixReviveStacks || 0) + 1;
    // Compounds: 75% of maxHp after stack 1, 75% of that (56.25%) after
    // stack 2, etc. — each revive comes back frailer but permanently
    // stronger (see phoenixReviveDamageMul / phoenixReviveChargeSpeedMul /
    // phoenixReviveCooldownMul, which all key off the same stack count).
    p.hp = Math.max(
      1,
      Math.round(
        p.maxHp * Math.pow(PHOENIX_REVIVE_HP_STACK_MUL, p.phoenixReviveStacks)
      )
    );
    p.phoenixReviveBuffT = PHOENIX_REVIVE_BUFF_DURATION;
    p.hitFlash = 0.35;
    p.ultFlashT = Math.max(p.ultFlashT || 0, 0.55);
    p.respawnInvulnT = Math.max(p.respawnInvulnT || 0, 1.2);
    p.vx = 0;
    p.vy = 0;
    refreshHudLabels();
    return true;
  }

  function tickPhoenixRevive(p, dt) {
    if (!p.phoenixReviving) return;
    p.vx = 0;
    p.vy = 0;
    p.phoenixReviveT = Math.max(0, p.phoenixReviveT - dt);
    if (p.phoenixReviveT <= 0) {
      const mul = p.phoenixReviveInterrupted
        ? PHOENIX_REVIVE_HP_MUL_INTERRUPTED
        : 1;
      p.hp = Math.max(1, Math.round(p.maxHp * mul));
      p.phoenixReviving = false;
      p.phoenixReviveInterrupted = false;
      p.phoenixReviveStacks = (p.phoenixReviveStacks || 0) + 1;
      // Speed boost is Rebirth-ultimate-only (see tryPhoenixUltRebirth) — the
      // passive revive channel does not grant it.
      p.hitFlash = 0.28;
    }
  }

  function isPelletShooter(p) {
    return isScatter(p) || isNova(p);
  }

  function distPointToSegment(px, py, x0, y0, x1, y1) {
    const sdx = x1 - x0;
    const sdy = y1 - y0;
    const len2 = sdx * sdx + sdy * sdy;
    if (len2 < 1e-8) {
      return len(px - x0, py - y0);
    }
    let t = ((px - x0) * sdx + (py - y0) * sdy) / len2;
    t = clamp(t, 0, 1);
    return len(px - (x0 + sdx * t), py - (y0 + sdy * t));
  }

  function getLaserFacing(p) {
    if (p.beamActive && p.beamFacing != null) {
      return p.beamFacing;
    }
    return p.facing;
  }

  function laserBeamEndpoints(p) {
    const ang = getLaserFacing(p);
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const r = getPlayerRadius(p);
    const x0 = p.x + cx * (r + 8);
    const y0 = p.y + cy * (r + 8);
    let dist = LASER_RANGE;
    const wallDist = rayDistToArenaWall(x0, y0, cx, cy, 4);
    if (wallDist > 0) {
      dist = Math.min(dist, wallDist);
    }
    dist = Math.max(0, dist);
    return {
      x0: x0,
      y0: y0,
      x1: x0 + cx * dist,
      y1: y0 + cy * dist,
    };
  }

  function laserBeamCenterOffset(target, beam) {
    return distPointToSegment(
      target.x,
      target.y,
      beam.x0,
      beam.y0,
      beam.x1,
      beam.y1
    );
  }

  function laserDamageMulForCenterOffset(offset) {
    const t = clamp(offset / LASER_BEAM_HALF_WIDTH, 0, 1);
    const core = 1 - t;
    return (
      LASER_EDGE_DMG_MUL + (1 - LASER_EDGE_DMG_MUL) * core * core
    );
  }

  function laserWindupProgress(p) {
    return clamp((p.beamWindupT || 0) / LASER_WINDUP, 0, 1);
  }

  function laserDwellDamageMul(dwellT) {
    const t = clamp(dwellT / LASER_DWELL_RAMP_SEC, 0, 1);
    return 1 + (LASER_DWELL_MAX_MUL - 1) * t * t;
  }

  function updateLaserDwell(entity, inBeam, dt) {
    if (!inBeam) {
      entity.laserDwellT = 0;
      return 1;
    }
    entity.laserDwellT = (entity.laserDwellT || 0) + dt;
    return laserDwellDamageMul(entity.laserDwellT);
  }

  function laserBeamHitsTarget(attacker, target, beam) {
    if (target.hp <= 0) return false;
    if (!fightersCanDamage(attacker, target)) return false;
    const offset = laserBeamCenterOffset(target, beam);
    return offset <= getPlayerRadius(target) + LASER_BEAM_HALF_WIDTH;
  }

  function applyLaserDamage(target, attacker, dmg, opts) {
    opts = opts || {};
    dmg = scaleDmg(dmg);
    if (target.hp <= 0) return;
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    const dealt = hpBefore - target.hp;
    target.hitFlash = Math.max(target.hitFlash, 0.07);
    if (attacker) grantUltimateCdReduction(attacker, dealt);
    grantBulwarkUltFromDamageTaken(target, dealt);
    if (target.hp <= 0) handleFighterDeath(target, attacker);
  }

  function setLaserBeamActive(p, active) {
    if (active && !p.beamActive) {
      p.beamSessionId = (p.beamSessionId || 0) + 1;
      p.beamFacing = p.facing;
      p.beamWindupT = 0;
      p.vx = 0;
      p.vy = 0;
    }
    p.beamActive = active;
    if (!active) {
      p.beamHitAny = false;
      p.beamFiring = false;
      p.beamWindupT = 0;
      p.beamFacing = null;
    }
  }

  function tickLaserBeam(p, dt) {
    if (!p.beamActive || p.hp <= 0 || gameOver) return;
    const beam = laserBeamEndpoints(p);
    p.beamX0 = beam.x0;
    p.beamY0 = beam.y0;
    p.beamX1 = beam.x1;
    p.beamY1 = beam.y1;
    p.beamWindupT = (p.beamWindupT || 0) + dt;
    p.beamFiring = p.beamWindupT >= LASER_WINDUP;
    if (!p.beamFiring) {
      p.beamHitAny = false;
      p.beamMaxDwellMul = 1;
      return;
    }

    const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
    const meltdown = (p.ultLaserT || 0) > 0;
    let baseTick = LASER_DPS * charDmg * p.damageMultiplier * dt;
    if (meltdown) baseTick *= 2.35;
    let hitAny = false;
    let alignSum = 0;
    let hitCount = 0;
    let maxDwellMul = 1;

    for (let i = 0; i < players.length; i++) {
      const target = players[i];
      if (target.playerNum === p.playerNum) continue;
      const inBeam = laserBeamHitsTarget(p, target, beam);
      const dwellMul = updateLaserDwell(target, inBeam, dt);
      if (!inBeam) continue;
      hitAny = true;
      maxDwellMul = Math.max(maxDwellMul, dwellMul);
      const offset = laserBeamCenterOffset(target, beam);
      const centerMul = laserDamageMulForCenterOffset(offset);
      alignSum += centerMul;
      hitCount += 1;
      const tickDmg = baseTick * centerMul * dwellMul;
      if (tickDmg > 1e-6) {
        applyLaserDamage(target, p, tickDmg);
      }
    }

    if (gameMode === "horde") {
      const wlist = mapRuntime.waveEnemies;
      for (let wi = 0; wi < wlist.length; wi++) {
        const e = wlist[wi];
        if (e.hp <= 0) continue;
        const inBeam = laserBeamHitsWaveEnemy(beam, e);
        const dwellMul = updateLaserDwell(e, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const offset = laserBeamCenterOffset({ x: e.x, y: e.y }, beam);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageWaveEnemy(e, tickDmg, p);
      }
      removeDeadWaveEnemies();
    }

    if (mapHasCreatures()) {
      const clist = mapRuntime.creatures;
      for (let ci = clist.length - 1; ci >= 0; ci--) {
        const c = clist[ci];
        if (c.hp <= 0) continue;
        const offset = laserBeamCenterOffset({ x: c.x, y: c.y }, beam);
        const inBeam = offset <= c.r + LASER_BEAM_HALF_WIDTH;
        const dwellMul = updateLaserDwell(c, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageCreature(c, tickDmg, p);
      }
      removeDeadCreatures();
    }

    if (gameMode === "boss" && mapRuntime.bossMinions.length > 0) {
      const mlist = mapRuntime.bossMinions;
      for (let mi = mlist.length - 1; mi >= 0; mi--) {
        const m = mlist[mi];
        if (m.hp <= 0) continue;
        const inBeam = laserBeamHitsBossMinion(beam, m);
        const dwellMul = updateLaserDwell(m, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const offset = laserBeamCenterOffset({ x: m.x, y: m.y }, beam);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageBossMinion(m, tickDmg, p);
      }
    }

    if (mapRuntime.echoSummons.length > 0) {
      const elist = mapRuntime.echoSummons;
      for (let ei = elist.length - 1; ei >= 0; ei--) {
        const s = elist[ei];
        if (s.hp <= 0) continue;
        if (s.ownerNum === p.playerNum) continue;
        const summonOwner = getEchoSummonOwner(s);
        if (summonOwner && !fightersCanDamage(p, summonOwner)) continue;
        const offset = laserBeamCenterOffset({ x: s.x, y: s.y }, beam);
        const inBeam = offset <= s.r + LASER_BEAM_HALF_WIDTH;
        const dwellMul = updateLaserDwell(s, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageEchoSummon(s, tickDmg, p);
      }
    }

    if (mapRuntime.pikeSpears.length > 0) {
      const plist = mapRuntime.pikeSpears;
      for (let pi = plist.length - 1; pi >= 0; pi--) {
        const spear = plist[pi];
        if (spear.hp <= 0) continue;
        if (!canHurtPikeSpear(p, spear)) continue;
        const offset = laserBeamCenterOffset({ x: spear.x, y: spear.y }, beam);
        const inBeam = offset <= spear.r + LASER_BEAM_HALF_WIDTH;
        const dwellMul = updateLaserDwell(spear, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damagePikeSpear(spear, tickDmg, p);
        if (spear.hp <= 0) plist.splice(pi, 1);
      }
    }

    if (gameMode === "siege" && mapRuntime.bases.length > 0) {
      const blist = mapRuntime.bases;
      for (let bi = 0; bi < blist.length; bi++) {
        const base = blist[bi];
        if (base.destroyed || base.team === p.fightTeam) continue;
        const offset = laserBeamCenterOffset({ x: base.x, y: base.y }, beam);
        const inBeam = offset <= base.r + LASER_BEAM_HALF_WIDTH;
        const dwellMul = updateLaserDwell(base, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageBase(base, tickDmg, p);
      }
    }

    if (mapRuntime.marionetteEffigies.length > 0) {
      const dlist = mapRuntime.marionetteEffigies;
      for (let di = dlist.length - 1; di >= 0; di--) {
        const dEff = dlist[di];
        if (dEff.hp <= 0) continue;
        if (dEff.ownerNum === p.playerNum) continue;
        const effigyOwner = getMarionetteEffigyOwner(dEff);
        if (effigyOwner && !fightersCanDamage(p, effigyOwner)) continue;
        const offset = laserBeamCenterOffset({ x: dEff.x, y: dEff.y }, beam);
        const inBeam = offset <= dEff.r + LASER_BEAM_HALF_WIDTH;
        const dwellMul = updateLaserDwell(dEff, inBeam, dt);
        if (!inBeam) continue;
        hitAny = true;
        maxDwellMul = Math.max(maxDwellMul, dwellMul);
        const centerMul = laserDamageMulForCenterOffset(offset);
        alignSum += centerMul;
        hitCount += 1;
        const tickDmg = baseTick * centerMul * dwellMul;
        if (tickDmg > 1e-6) damageMarionetteEffigy(dEff, tickDmg, p);
      }
    }

    p.beamMaxDwellMul = maxDwellMul;
    p.beamHitAny = hitAny;
    if (meltdown) return;
    if (!hitAny) {
      const drain = scaleDmg(LASER_MISS_DRAIN_PER_SEC * dt);
      p.hp = Math.max(0, p.hp - drain);
      if (p.hp <= 0) handleFighterDeath(p);
    } else {
      const avgAlign = alignSum / hitCount;
      if (avgAlign < 0.995) {
        const drain = scaleDmg(LASER_OFF_CENTER_DRAIN_PER_SEC * (1 - avgAlign) * dt);
        p.hp = Math.max(0, p.hp - drain);
        if (p.hp <= 0) handleFighterDeath(p);
      }
    }
  }

  function tickBulwarkRegen(p, dt) {
    if (!isBulwark(p) || p.hp <= 0 || gameOver || p.stunT > 0) return;
    p.hp = Math.min(p.maxHp, p.hp + scaleHeal(BULWARK_REGEN_PER_SEC * dt));
  }

  function tickUniversalRegen(p, dt) {
    if (p.isBot || p.hp <= 0 || p.eliminated || gameOver) return;
    p.hp = Math.min(
      p.maxHp,
      p.hp + scaleHeal(p.maxHp * UNIVERSAL_REGEN_PCT_PER_SEC * dt)
    );
  }

  function moveSpeedMultiplier(p, extra) {
    const ex = extra == null ? 1 : extra;
    let mul =
      (p.moveSpeedMul != null ? p.moveSpeedMul : 1) *
      ex *
      playerPuddleSlowMul(p);
    if ((p.slowT || 0) > 0) {
      mul *= p.slowMul != null ? p.slowMul : 0.5;
    }
    if (isBulwarkUnbreakable(p)) mul *= BULWARK_ULT_MOVE_SPEED_MUL;
    if (isPhoenix(p) && (p.phoenixReviveBuffT || 0) > 0) {
      mul *= PHOENIX_REVIVE_SPEED_BOOST_MUL;
    }
    return mul;
  }

  function applySlowDebuff(target, duration, mul) {
    if (!target || duration <= 0 || !(mul < 1)) return;
    const nextMul = mul != null ? mul : 0.5;
    if ((target.slowT || 0) > 0) {
      target.slowMul = Math.min(
        target.slowMul != null ? target.slowMul : 1,
        nextMul
      );
    } else {
      target.slowMul = nextMul;
    }
    target.slowT = Math.max(target.slowT || 0, duration);
  }

  function tickSlowDebuff(target, dt) {
    if (!target || (target.slowT || 0) <= 0) return;
    target.slowT = Math.max(0, target.slowT - dt);
    if (target.slowT <= 0) target.slowMul = 1;
  }

  function tickPhoenixReviveBuff(target, dt) {
    if (!target || (target.phoenixReviveBuffT || 0) <= 0) return;
    target.phoenixReviveBuffT = Math.max(
      0,
      target.phoenixReviveBuffT - dt
    );
  }

  function playerPuddleSlowMul(p) {
    if (p.isBot || p.hp <= 0) return 1;
    const list = mapRuntime.toxicPuddles;
    if (!list.length) return 1;
    let mul = 1;
    const pr = getPlayerRadius(p);
    for (let i = 0; i < list.length; i++) {
      const pool = list[i];
      if (len(p.x - pool.x, p.y - pool.y) <= pool.r + pr * 0.88) {
        mul = Math.min(mul, pool.slowMul != null ? pool.slowMul : HEX_PUDDLE_SLOW_MUL);
      }
    }
    return mul;
  }

  function bulwarkChargeRatio(p) {
    return Math.max(0, p.chargeT / MAX_CHARGE);
  }

  /** Maps raw hold time → barrage strength; quick taps stay tiny, big holds stay huge. */
  function bulwarkEffectiveRatio(raw) {
    const r = Math.max(0, raw);
    if (r <= 1) {
      return Math.pow(r, BULWARK_EFFECTIVE_RATIO_POWER);
    }
    return 1 + (r - 1);
  }

  function chargeRatioFor(p) {
    if (isBulwark(p)) {
      return bulwarkEffectiveRatio(bulwarkChargeRatio(p));
    }
    return meleeChargeRatio(p);
  }

  function auraRadiusForPlayer(p, ratio) {
    const r = Math.max(0, ratio);
    return AURA_RADIUS_MIN + (AURA_RADIUS_MAX - AURA_RADIUS_MIN) * r;
  }

  function bulwarkAuraDamageForRatio(ratio) {
    const r = Math.max(0, ratio);
    return (
      BULWARK_AURA_DAMAGE_MIN +
      (BULWARK_AURA_DAMAGE_MAX - BULWARK_AURA_DAMAGE_MIN) * r
    );
  }

  function bulwarkAuraActiveTime(ratio) {
    return AURA_ATTACK_ACTIVE * (0.65 + 0.35 * Math.sqrt(Math.max(1, ratio)));
  }

  function isBrawlerMelee(p) {
    return (
      !p.isBot &&
      p.attackStyle === "melee" &&
      (p.characterId === "brawler" || !p.characterId)
    );
  }

  function meleeChargeRatio(p) {
    if (p.chargeT >= MAX_CHARGE) return 1;
    return clamp(p.chargeT / MAX_CHARGE, 0, 1);
  }

  function meleeRangeScale(p, ratio) {
    if (p.isBot) {
      return (0.75 + 0.25 * ratio) * BOSS_ATTACK_RANGE_MUL;
    }
    if (isBrawlerMelee(p)) {
      return (
        BRAWLER_RANGE_MIN_MUL +
        (BRAWLER_RANGE_MAX_MUL - BRAWLER_RANGE_MIN_MUL) * ratio
      );
    }
    return 0.75 + 0.25 * ratio;
  }

  function meleeArcScale(p, ratio) {
    if (isBrawlerMelee(p)) {
      return 0.7 + 0.3 * ratio;
    }
    return 0.82 + 0.18 * ratio;
  }

  /**
   * While attack is held and charging. Returns { fire, ratio }.
   * fire=true → release a full-charge swing.
   */
  function chargeRateFor(p) {
    let rate = p.chargeSpeedMul != null ? p.chargeSpeedMul : 1;
    if (hordeIsActivelySupporting(p)) {
      rate *= HORDE_SUPPORT_CHARGE_MUL;
    }
    if (isBulwark(p) && isBulwarkUnbreakable(p)) {
      // While fortified, charge the old aura at its original rate.
      rate = BULWARK_AURA_CHARGE_SPEED_MUL;
    }
    if ((p.grapplerChargeBoostT || 0) > 0) {
      rate *= GRAPPLER_HOOK_CHARGE_BOOST_MUL;
    }
    if ((p.chargeSlowT || 0) > 0) {
      rate *= p.chargeSlowMul != null ? p.chargeSlowMul : SIPHON_ULT_CHARGE_SLOW_MUL;
    }
    if (isPhoenix(p)) {
      rate *= phoenixReviveChargeSpeedMul(p);
    }
    if (p.isAi) {
      rate *= getAiSkill(p).chargeRateMul;
    }
    return rate;
  }

  function tickChargeWhileHeld(p, dt) {
    if (isBulwark(p)) {
      if (isBulwarkUnbreakable(p)) {
        // Unbreakable charges much faster (and reduces incoming damage
        // while charging), so cap it — at 5x the standard MAX_CHARGE ceiling —
        // instead of letting the aura pulse scale fully unbounded.
        p.chargeT = Math.min(
          p.chargeT + dt * chargeRateFor(p),
          MAX_CHARGE * BULWARK_UNBREAKABLE_CHARGE_CAP_MUL
        );
      } else {
        p.chargeT += dt * chargeRateFor(p);
      }
      p.chargeHoldT = 0;
      return { fire: false, ratio: bulwarkChargeRatio(p) };
    }

    if (p.chargeT < MAX_CHARGE) {
      p.chargeT = Math.min(p.chargeT + dt * chargeRateFor(p), MAX_CHARGE);
      p.chargeHoldT = 0;
      return { fire: false, ratio: meleeChargeRatio(p) };
    }

    if (p.isBot && p.attackStyle === "melee") {
      p.chargeHoldT += dt;
      if (p.chargeHoldT >= MAX_CHARGE_HOLD) {
        return { fire: true, ratio: 1 };
      }
      return { fire: false, ratio: 1 };
    }

    return { fire: true, ratio: 1 };
  }

  function clearInputKeys() {
    const codes = Object.keys(keys);
    for (let i = 0; i < codes.length; i++) {
      keys[codes[i]] = false;
    }
    const physCodes = Object.keys(physKeys);
    for (let i = 0; i < physCodes.length; i++) {
      physKeys[physCodes[i]] = false;
    }
  }

  /** Poll every connected gamepad into gamepadStates[1..] (call once/frame).
   *  Slot 0 (P1) is always left at its empty default — pads only ever
   *  drive P2 and beyond. */
  function pollGamepad() {
    let pads = [];
    try {
      pads = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch (e) {
      pads = [];
    }
    const connectedPads = [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) connectedPads.push(pads[i]);
    }
    const dz = (v, d) => (Math.abs(v) < d ? 0 : v);
    for (let slot = 1; slot < gamepadStates.length; slot++) {
      const gp = connectedPads[slot - 1];
      const state = gamepadStates[slot];
      if (!gp) {
        state.connected = false;
        continue;
      }
      const ax = gp.axes || [];
      state.connected = true;
      state.lx = dz(ax[0] || 0, GAMEPAD_MOVE_DEADZONE);
      state.ly = dz(ax[1] || 0, GAMEPAD_MOVE_DEADZONE);
      // Aim stick uses a RADIAL deadzone (based on combined magnitude)
      // instead of clamping each axis independently. A per-axis deadzone
      // zeroes out whichever axis is weaker whenever it dips below the
      // threshold, which snaps the aim angle to a pure up/down/left/right
      // whenever the stick is held near — but not exactly on — one of
      // those directions. Radial deadzone only blanks the stick when it's
      // near dead-center, and always preserves the true angle otherwise.
      const rawRx = ax[2] || 0;
      const rawRy = ax[3] || 0;
      const rMag = Math.sqrt(rawRx * rawRx + rawRy * rawRy);
      if (rMag < GAMEPAD_AIM_DEADZONE) {
        state.rx = 0;
        state.ry = 0;
      } else {
        state.rx = rawRx;
        state.ry = rawRy;
      }
      const btns = gp.buttons || [];
      state.buttons = new Array(btns.length);
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        state.buttons[i] = !!(b && (b.pressed || b.value > 0.5));
      }
    }
  }

  /**
   * Live "is a controller detected at all" badge (top-right corner, visible
   * on every screen). Only touches the DOM when the connected/disconnected
   * state actually flips, so it's cheap to call every frame.
   */
  function connectedGamepadSlots() {
    const slots = [];
    for (let slot = 1; slot < gamepadStates.length; slot++) {
      if (gamepadStates[slot].connected) slots.push(slot);
    }
    return slots;
  }

  function updateGamepadStatusUI() {
    if (!gamepadStatusEl) return;
    const slots = connectedGamepadSlots();
    const signature = slots.join(",");
    if (signature === lastGamepadStatusShown) return;
    lastGamepadStatusShown = signature;
    gamepadStatusEl.classList.toggle("connected", slots.length > 0);
    if (gamepadStatusTextEl) {
      if (slots.length === 0) {
        gamepadStatusTextEl.textContent = "No controller detected";
      } else {
        const names = slots.map((slot) => "P" + (slot + 1)).join(", ");
        gamepadStatusTextEl.textContent =
          slots.length === 1
            ? "Controller connected — " + names
            : slots.length + " controllers connected — " + names;
      }
    }
  }

  /**
   * Feed gamepad state into each connected pad's preset key codes so all
   * the existing keys[...] control-reading code (movement, attack charge,
   * ultimate, support) works unchanged for every gamepad-driven slot.
   * Always rebuilt from physKeys (real keyboard truth) first so a released
   * stick/button can't get stuck true from a previous frame's contribution.
   */
  function syncGamepadKeys() {
    for (let slot = 1; slot < gamepadStates.length; slot++) {
      const c = HUMAN_PRESETS[slot].controls;
      const codes = [c.up, c.down, c.left, c.right, c.attack, c.support, c.ultimate];
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        if (code) keys[code] = !!physKeys[code];
      }
      const state = gamepadStates[slot];
      if (!state.connected) continue;
      if (state.ly < 0) keys[c.up] = true;
      if (state.ly > 0) keys[c.down] = true;
      if (state.lx < 0) keys[c.left] = true;
      if (state.lx > 0) keys[c.right] = true;
      if (state.buttons[GAMEPAD_BTN_ATTACK]) keys[c.attack] = true;
      if (c.ultimate && state.buttons[GAMEPAD_BTN_ULTIMATE]) {
        keys[c.ultimate] = true;
      }
      if (c.support && state.buttons[GAMEPAD_BTN_SUPPORT]) {
        keys[c.support] = true;
      }
    }
  }

  /**
   * Feed left/right mouse buttons into P1's attack/ultimate key codes while
   * mouse aim is on, same OR-with-physical approach as syncGamepadKeys so a
   * released mouse button can't get stuck true.
   */
  function syncMouseButtonKeys() {
    const c = HUMAN_PRESETS[0].controls;
    const codes = [c.attack, c.ultimate].filter(Boolean);
    for (let i = 0; i < codes.length; i++) {
      keys[codes[i]] = !!physKeys[codes[i]];
    }
    if (!useMouseAimP1) return;
    if (mouseButtonState.left) keys[c.attack] = true;
    if (c.ultimate && mouseButtonState.right) keys[c.ultimate] = true;
  }

  /** Mouse position in world/arena space, or null if the mouse hasn't moved over the canvas yet. */
  function mouseWorldPos() {
    if (!mouseCanvasPos) return null;
    const s = playfieldScale();
    if (s <= 1) return { x: mouseCanvasPos.x, y: mouseCanvasPos.y };
    return {
      x: (mouseCanvasPos.x - W * 0.5) * s + W * 0.5,
      y: (mouseCanvasPos.y - H * 0.5) * s + H * 0.5,
    };
  }

  /**
   * Recompute each human player's aim-override angle (mouse for P1, right
   * stick for any gamepad-driven slot) once per frame, before steerPlayer
   * runs. Bots/AI and any player without an active aim device fall back to
   * the pre-existing movement-direction facing inside applyMovementFromAxes.
   */
  function updateAimOverrides() {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isBot || p.isAi) continue;
      if (
        p.controls === HUMAN_PRESETS[0].controls &&
        useMouseAimP1 &&
        gameMode !== "siege"
      ) {
        const m = mouseWorldPos();
        if (m) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          if (dx * dx + dy * dy > 4) p.aimOverrideAngle = Math.atan2(dy, dx);
        }
        continue;
      }
      let handledByGamepad = false;
      for (let slot = 1; slot < HUMAN_PRESETS.length; slot++) {
        if (p.controls !== HUMAN_PRESETS[slot].controls) continue;
        const state = gamepadStates[slot];
        if (!state.connected) break;
        handledByGamepad = true;
        const rx = state.rx;
        const ry = state.ry;
        if (rx * rx + ry * ry > 1e-4) {
          p.aimOverrideAngle = Math.atan2(ry, rx);
        }
        break;
      }
      if (handledByGamepad) continue;
      p.aimOverrideAngle = null;
    }
  }

  function quitToMenu() {
    if (gameMode == null) return;
    if (
      modePickerOpen ||
      mapPickerOpen ||
      bossPickerOpen ||
      characterPickerOpen
    ) {
      return;
    }
    clearInputKeys();
    openModeScreen();
    setHelpText();
  }

  /** <kbd>M</kbd> — one screen back (not full menu). */
  function goBackOneScreen() {
    if (characterPickerOpen) {
      closeCharScreen();
      if (gameMode === "siege") {
        gameMode = null;
        modePickerOpen = true;
        if (modeScreen) modeScreen.classList.add("visible");
        onRosterControlsChanged();
        setHelpText();
      } else {
        openMapScreen();
      }
      return;
    }
    if (mapPickerOpen) {
      closeMapScreen();
      if (gameMode === "boss") {
        openBossScreen();
      } else {
        gameMode = null;
        modePickerOpen = true;
        if (modeScreen) modeScreen.classList.add("visible");
        onRosterControlsChanged();
      }
      setHelpText();
      return;
    }
    if (bossPickerOpen) {
      closeBossScreen();
      gameMode = null;
      modePickerOpen = true;
      if (modeScreen) modeScreen.classList.add("visible");
      onRosterControlsChanged();
      setHelpText();
      return;
    }
    if (
      gameMode != null &&
      !modePickerOpen &&
      !mapPickerOpen &&
      !bossPickerOpen &&
      !characterPickerOpen
    ) {
      clearInputKeys();
      gameOver = false;
      winner = null;
      overlay.classList.remove("visible");
      openCharScreen();
    }
  }

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    physKeys[e.code] = true;
    if (e.code === "KeyM") {
      e.preventDefault();
      goBackOneScreen();
      return;
    }
    if (e.code === "Escape") {
      if (
        gameMode != null &&
        !modePickerOpen &&
        !mapPickerOpen &&
        !bossPickerOpen &&
        !characterPickerOpen
      ) {
        e.preventDefault();
        quitToMenu();
        return;
      }
    }
    if (e.code === "Space") e.preventDefault();
    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      e.preventDefault();
    }
    if (
      e.code === "KeyI" ||
      e.code === "KeyJ" ||
      e.code === "KeyK" ||
      e.code === "KeyL" ||
      e.code === "KeyO" ||
      e.code === "KeyB" ||
      e.code === "KeyP"
    ) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    physKeys[e.code] = false;
  });

  // Mouse aim (P1): track the pointer in canvas-pixel space; converted to
  // world/arena space on demand in mouseWorldPos() since the canvas can be
  // CSS-scaled and the arena view can be zoomed (see playfieldScale()).
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mouseCanvasPos = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });

  // Left click = attack, right click = ultimate, while mouse aim (P1) is on.
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) mouseButtonState.left = true;
    else if (e.button === 2) {
      mouseButtonState.right = true;
      e.preventDefault();
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseButtonState.left = false;
    else if (e.button === 2) mouseButtonState.right = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  // If the window loses focus (alt-tab, etc.) mid-click, don't leave a
  // button stuck "held" forever.
  window.addEventListener("blur", () => {
    mouseButtonState.left = false;
    mouseButtonState.right = false;
  });

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function len(x, y) {
    return Math.hypot(x, y);
  }

  function norm(x, y) {
    const l = len(x, y);
    if (l < 1e-6) return { x: 0, y: 0 };
    return { x: x / l, y: y / l };
  }

  function currentMapDef() {
    if (gameMode === "siege") {
      return { bounds: "rect", creatures: false };
    }
    // The Labyrinth fills the full rectangular play area, corners
    // included — clamping to an inscribed circle on top of that (the
    // Colosseum shape) cuts off corner maze cells, which yanks anything
    // resolved there (a warp-gate exit, a spawn point) clear across the
    // map to the nearest point still inside the circle. The maze's own
    // walls already define the playable shape, so ignore the arena-shape
    // pick and always use full rect bounds once it's active.
    if (mapModifiers.maze) {
      return { bounds: "rect", creatures: !!mapModifiers.creatures };
    }
    return {
      bounds: mapModifiers.bounds === "rect" ? "rect" : "circle",
      creatures: !!mapModifiers.creatures,
    };
  }

  function mapHasCreatures() {
    if (gameMode === "horde") return false;
    return !!mapModifiers.creatures;
  }

  function mapModifierWallWeight() {
    const m = mapModifiers;
    let w = 0;
    if (m.maze) w += 5;
    if (m.lattice) w += 2;
    if (m.pillars) w += 1.5;
    if (m.ring) w += 1;
    if (m.movers) w += 0.5;
    if (m.portals) w += 0.35;
    if (m.bounds === "rect") w += 0.45;
    return w;
  }

  function mapModifiersSummary() {
    const parts = [];
    const shape =
      mapModifiers.bounds === "rect" ? "Classic box" : "Colosseum";
    parts.push(shape);
    for (let i = 0; i < MAP_MODIFIER_TOGGLES.length; i++) {
      const t = MAP_MODIFIER_TOGGLES[i];
      if (mapModifiers[t.key]) parts.push(t.name);
    }
    if (parts.length === 1) {
      return parts[0] + " — open floor.";
    }
    return parts.join(" · ");
  }

  const RICOCHET_MAP_TUNE_DEFAULT = {
    damageMul: 1,
    bounceDmgMul: 1,
    maxBounces: RICOCHET_MAX_BOUNCES,
    cooldownMul: 1,
    rangeMul: 1,
    lifeMul: 1,
  };

  function ricochetMapTuning() {
    const t = clamp(mapModifierWallWeight() / 6.5, 0, 1);
    const box = mapModifiers.bounds === "rect";
    let damageMul = 1.22 + (0.84 - 1.22) * t;
    let bounceDmgMul = 0.78 + (0.95 - 0.78) * t;
    let maxBounces = Math.round(8 + (14 - 8) * t);
    let cooldownMul = 0.92 + (1.08 - 0.92) * t;
    let rangeMul = 1;
    let lifeMul = 1;
    // Classic box: sharp corners + predictable walls — lean into ricochets hard.
    if (box) {
      damageMul *= 1.28;
      bounceDmgMul = Math.min(1.45, bounceDmgMul * 1.7 + 0.18);
      maxBounces += 5;
      cooldownMul *= 0.86;
      rangeMul = 1.18;
      lifeMul = 1.35;
    }
    // Labyrinth's narrow corridors hand a bolt far more bounce
    // opportunities per second than any open arena — the charge-scaled
    // per-bounce growth (RICOCHET_CHARGE_BOUNCE_DMG_MUL_MAX) snowballs out
    // of control there without an extra, dedicated cut on top of the
    // generic wall-weight tuning above.
    if (mapModifiers.maze) {
      damageMul *= 0.7;
      bounceDmgMul *= 0.75;
      maxBounces = Math.max(6, maxBounces - 4);
    }
    return {
      damageMul,
      bounceDmgMul,
      maxBounces,
      cooldownMul,
      rangeMul,
      lifeMul,
    };
  }

  function arenaCenter() {
    return { cx: W * 0.5, cy: H * 0.5 };
  }

  function playfieldScale() {
    if (gameMode === "horde") return HORDE_ARENA_SCALE;
    // Siege's view is handled by the per-pane camera system, not this
    // fixed canvas-relative zoom.
    return 1;
  }

  /** Zoom so a larger horde playfield still fills the canvas. */
  function applyArenaViewTransform() {
    const s = playfieldScale();
    if (s <= 1) return;
    ctx.translate(W * 0.5, H * 0.5);
    ctx.scale(1 / s, 1 / s);
    ctx.translate(-W * 0.5, -H * 0.5);
  }

  /** Who pane `idx` should track: the matching local human when split,
   *  the lone human in a single-pane siege view, or (no local humans —
   *  full AI/spectator) the centroid of everyone still alive. */
  function siegePaneTarget(idx, humans) {
    if (humans.length >= 2) return humans[idx];
    if (humans.length === 1) return humans[0];
    const alive = players.filter((p) => p.hp > 0 && !p.eliminated);
    if (!alive.length) return null;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < alive.length; i++) {
      sx += alive[i].x;
      sy += alive[i].y;
    }
    return { x: sx / alive.length, y: sy / alive.length };
  }

  function updatePaneCamera(camera, target, dt) {
    if (!target) return;
    const k = 1 - Math.exp(-SIEGE_CAMERA_LERP_RATE * dt);
    camera.x += (target.x - camera.x) * k;
    camera.y += (target.y - camera.y) * k;
  }

  /** One entry per on-screen pane this frame: where it sits on the canvas
   *  and which world-space camera it's drawn through. Every mode besides
   *  a 0/1/2-human Siege match gets a single full-canvas pane at a fixed
   *  camera — since world space already equals canvas space there, that
   *  composes to the plain unpanned view every other mode has always had. */
  function computePanes(dt) {
    if (gameMode !== "siege") {
      return [
        {
          rect: { x: 0, y: 0, w: W, h: H },
          zoom: 1,
          camera: { x: W * 0.5, y: H * 0.5 },
        },
      ];
    }
    const humans = localHumans();
    const split = humans.length === 2;
    const paneCount = split ? 2 : 1;
    const bounds = rectArenaBounds(0);
    const panes = [];
    for (let i = 0; i < paneCount; i++) {
      const target = siegePaneTarget(i, humans);
      const cam = paneCameras[i];
      const frozen = target && target.playerNum != null && target.eliminated;
      if (target && !frozen) updatePaneCamera(cam, target, dt);
      // A small fixed pad, not half the pane's own view extent — the camera
      // must be able to center within reach of a base sitting near the
      // world edge, or the pane can never show it.
      cam.x = clamp(
        cam.x,
        bounds.minX + SIEGE_CAMERA_EDGE_PAD,
        bounds.maxX - SIEGE_CAMERA_EDGE_PAD
      );
      cam.y = clamp(
        cam.y,
        bounds.minY + SIEGE_CAMERA_EDGE_PAD,
        bounds.maxY - SIEGE_CAMERA_EDGE_PAD
      );
      // A 2-human split places panes side by side (vertical divider) so
      // each pane keeps the full canvas height, which shows more of the
      // world's tall (top-to-bottom) long axis than a stacked layout would.
      const paneW = split ? W / 2 : W;
      panes.push({
        rect: { x: split ? i * paneW : 0, y: 0, w: paneW, h: H },
        zoom: SIEGE_CAMERA_ZOOM,
        camera: cam,
      });
    }
    return panes;
  }

  function arenaRadius() {
    const s = playfieldScale();
    const base = Math.min(W - MARGIN * 2, H - MARGIN * 2) * 0.5 * s;
    if (currentMapDef().bounds === "circle") {
      // Keep the full fighter body on-canvas (centers sit up to R - bodyR).
      const fit = (Math.min(W, H) * 0.5 - 2) * s;
      return Math.min(base * COLOSSEUM_RADIUS_MUL, fit);
    }
    return base;
  }

  function arenaBoundaryRadius(pad) {
    return arenaRadius() - (pad != null ? pad : 0);
  }

  function rectArenaBounds(pad) {
    const p = pad != null ? pad : 0;
    const ac = arenaCenter();
    if (gameMode === "siege") {
      return {
        minX: ac.cx - SIEGE_WORLD_W / 2 + p,
        maxX: ac.cx + SIEGE_WORLD_W / 2 - p,
        minY: ac.cy - SIEGE_WORLD_H / 2 + p,
        maxY: ac.cy + SIEGE_WORLD_H / 2 - p,
      };
    }
    const s = playfieldScale();
    const halfW = (W * 0.5 - MARGIN) * s;
    const halfH = (H * 0.5 - MARGIN) * s;
    return {
      minX: ac.cx - halfW + p,
      maxX: ac.cx + halfW - p,
      minY: ac.cy - halfH + p,
      maxY: ac.cy + halfH - p,
    };
  }

  function clampPointToRect(x, y, pad) {
    const b = rectArenaBounds(pad);
    return {
      x: clamp(x, b.minX, b.maxX),
      y: clamp(y, b.minY, b.maxY),
    };
  }

  function clampPointToArena(x, y, pad) {
    if (currentMapDef().bounds === "rect") {
      return clampPointToRect(x, y, pad);
    }
    const ac = arenaCenter();
    const maxR = arenaBoundaryRadius(pad);
    const dx = x - ac.cx;
    const dy = y - ac.cy;
    const d = len(dx, dy);
    if (d <= maxR || d < 1e-6) return { x: x, y: y };
    const s = maxR / d;
    return { x: ac.cx + dx * s, y: ac.cy + dy * s };
  }

  function isInsideArena(x, y, pad) {
    if (currentMapDef().bounds === "rect") {
      const b = rectArenaBounds(pad);
      return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
    }
    const ac = arenaCenter();
    return len(x - ac.cx, y - ac.cy) <= arenaBoundaryRadius(pad);
  }

  function resolveCircleBoundary(x, y, vx, vy, bodyR) {
    const ac = arenaCenter();
    const maxR = arenaBoundaryRadius(bodyR);
    const dx = x - ac.cx;
    const dy = y - ac.cy;
    const d = len(dx, dy);
    if (d > maxR && d > 1e-6) {
      const s = maxR / d;
      x = ac.cx + dx * s;
      y = ac.cy + dy * s;
      const nx = dx / d;
      const ny = dy / d;
      const vOut = vx * nx + vy * ny;
      if (vOut > 0) {
        vx -= nx * vOut;
        vy -= ny * vOut;
      }
    }
    return { x: x, y: y, vx: vx, vy: vy };
  }

  function resolveRectBoundary(x, y, vx, vy, bodyR) {
    const b = rectArenaBounds(bodyR);
    if (x < b.minX) {
      x = b.minX;
      vx = Math.abs(vx);
    } else if (x > b.maxX) {
      x = b.maxX;
      vx = -Math.abs(vx);
    }
    if (y < b.minY) {
      y = b.minY;
      vy = Math.abs(vy);
    } else if (y > b.maxY) {
      y = b.maxY;
      vy = -Math.abs(vy);
    }
    return { x: x, y: y, vx: vx, vy: vy };
  }

  function resolveArenaBoundary(x, y, vx, vy, bodyR) {
    if (currentMapDef().bounds === "rect") {
      return resolveRectBoundary(x, y, vx, vy, bodyR);
    }
    return resolveCircleBoundary(x, y, vx, vy, bodyR);
  }

  function getCollidableObstacles() {
    const list = mapRuntime.obstacles.slice();
    for (let i = 0; i < mapRuntime.movers.length; i++) {
      const m = mapRuntime.movers[i];
      list.push({ x: m.x, y: m.y, r: m.r });
    }
    return list;
  }

  function resolveObstacleCollision(x, y, vx, vy, bodyR) {
    const obs = getCollidableObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = x - o.x;
      const dy = y - o.y;
      const d = len(dx, dy);
      const minD = o.r + bodyR;
      if (d >= minD || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      x = o.x + nx * minD;
      y = o.y + ny * minD;
      const dot = vx * nx + vy * ny;
      vx -= 2 * dot * nx;
      vy -= 2 * dot * ny;
    }
    return resolveWallCollision(x, y, vx, vy, wallCollisionRadius(bodyR));
  }

  function wallCollisionRadius(bodyR) {
    if (mapModifiers.maze) return Math.max(12, bodyR * 0.72);
    return bodyR;
  }

  function mapHasNavigationObstacles() {
    return (
      mapRuntime.walls.length > 0 ||
      mapRuntime.obstacles.length > 0 ||
      mapRuntime.movers.length > 0
    );
  }

  function repulsionFromWallRect(x, y, w, bodyR) {
    const cx = clamp(x, w.minX, w.maxX);
    const cy = clamp(y, w.minY, w.maxY);
    let dx = x - cx;
    let dy = y - cy;
    let d = len(dx, dy);
    if (d < 1e-6) {
      const penL = x - w.minX;
      const penR = w.maxX - x;
      const penT = y - w.minY;
      const penB = w.maxY - y;
      const minPen = Math.min(penL, penR, penT, penB);
      if (minPen === penL) {
        dx = -1;
        dy = 0;
      } else if (minPen === penR) {
        dx = 1;
        dy = 0;
      } else if (minPen === penT) {
        dx = 0;
        dy = -1;
      } else {
        dx = 0;
        dy = 1;
      }
      d = 1;
    }
    const influence = bodyR + 58;
    if (d >= influence) return { x: 0, y: 0 };
    const strength = ((influence - d) / influence) * ((influence - d) / influence);
    return { x: (dx / d) * strength, y: (dy / d) * strength };
  }

  function obstacleRepulsionVector(x, y, bodyR) {
    let rx = 0;
    let ry = 0;
    const obs = getCollidableObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = x - o.x;
      const dy = y - o.y;
      const d = len(dx, dy);
      const influence = o.r + bodyR + 78;
      if (d >= influence || d < 1e-6) continue;
      const strength = (influence - d) / influence;
      rx += (dx / d) * strength;
      ry += (dy / d) * strength;
    }
    const walls = mapRuntime.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (
        x < w.minX - 90 ||
        x > w.maxX + 90 ||
        y < w.minY - 90 ||
        y > w.maxY + 90
      ) {
        continue;
      }
      const rep = repulsionFromWallRect(x, y, w, bodyR);
      rx += rep.x;
      ry += rep.y;
    }
    const maze = mapModifiers.maze && mazeNavRows();
    const repMul = maze ? 2.75 : 2.1;
    return { x: rx * repMul, y: ry * repMul };
  }

  function steerAroundObstacles(p, ix, iy) {
    const mag = len(ix, iy);
    if (mag < 1e-3 || !mapHasNavigationObstacles()) {
      return { ix: ix, iy: iy };
    }

    const maze = mapModifiers.maze && mazeNavRows();
    const bodyR = getPlayerRadius(p);
    const pad = bodyR + (maze ? 14 : 10);
    const lookAhead = maze ? 170 + bodyR * 2.9 : 95 + bodyR * 2.2;
    const ux = ix / mag;
    const uy = iy / mag;
    const directClear = rayDistToArenaWall(p.x, p.y, ux, uy, pad);
    if (directClear >= lookAhead) {
      return { ix: ix, iy: iy };
    }

    if (maze && (p.aiStuckT || 0) > 0.45) {
      const escape = mazePickEscapeHeading(p, pad);
      if (escape) {
        p.aiStuckT = 0;
        p.aiLastX = p.x;
        p.aiLastY = p.y;
        return { ix: escape.x * mag, iy: escape.y * mag };
      }
    }

    const wantAng = Math.atan2(iy, ix);
    const spread = maze ? Math.PI * 1.12 : Math.PI * 0.92;
    const samples = maze ? 23 : 15;
    let bestIx = ix;
    let bestIy = iy;
    let bestScore = -Infinity;

    for (let s = 0; s < samples; s++) {
      const t = samples === 1 ? 0 : s / (samples - 1) - 0.5;
      const ang = wantAng + t * spread;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const clear = rayDistToArenaWall(p.x, p.y, dx, dy, pad);
      const align = dx * ux + dy * uy;
      let score = align * 2.4 + Math.min(clear, lookAhead) / lookAhead * 3.2;
      if (clear < (maze ? 48 : 38)) score -= 5;
      else if (clear < (maze ? 88 : 70)) score -= 1.5;
      if (score > bestScore) {
        bestScore = score;
        bestIx = dx * mag;
        bestIy = dy * mag;
      }
    }

    const rep = obstacleRepulsionVector(p.x, p.y, bodyR);
    bestIx += rep.x;
    bestIy += rep.y;
    const n = norm(bestIx, bestIy);
    if (n.x === 0 && n.y === 0) {
      return { ix: ix, iy: iy };
    }
    return { ix: n.x * mag, iy: n.y * mag };
  }

  function resolveWallCollision(x, y, vx, vy, bodyR) {
    const walls = mapRuntime.walls;
    const origVx = vx;
    const origVy = vy;
    let xZeroed = false;
    let yZeroed = false;
    for (let pass = 0; pass < 6; pass++) {
      let hit = false;
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        const left = w.minX - bodyR;
        const right = w.maxX + bodyR;
        const top = w.minY - bodyR;
        const bottom = w.maxY + bodyR;
        if (x < left || x > right || y < top || y > bottom) continue;
        const penL = x - left;
        const penR = right - x;
        const penT = y - top;
        const penB = bottom - y;
        const minPen = Math.min(penL, penR, penT, penB);
        if (minPen === penL) {
          x = left;
          if (vx > 0) {
            vx = 0;
            xZeroed = true;
          }
        } else if (minPen === penR) {
          x = right;
          if (vx < 0) {
            vx = 0;
            xZeroed = true;
          }
        } else if (minPen === penT) {
          y = top;
          if (vy > 0) {
            vy = 0;
            yZeroed = true;
          }
        } else {
          y = bottom;
          if (vy < 0) {
            vy = 0;
            yZeroed = true;
          }
        }
        hit = true;
      }
      if (!hit) break;
    }
    // A concave corner made of two separate wall segments can zero both
    // velocity axes across the pass (one wall kills vx, another kills vy),
    // leaving nothing stuck there with no velocity to escape with. A flat,
    // single-wall hit can only ever zero one axis, so this specifically
    // targets the corner case — send it back the way it came instead of
    // leaving it stranded until it expires.
    if (xZeroed && yZeroed) {
      vx = -origVx;
      vy = -origVy;
    }
    return { x: x, y: y, vx: vx, vy: vy };
  }

  function rayDistToAabb(x0, y0, dx, dy, minX, minY, maxX, maxY) {
    let tmin = 1e-4;
    let tmax = Infinity;
    if (Math.abs(dx) > 1e-6) {
      let t1 = (minX - x0) / dx;
      let t2 = (maxX - x0) / dx;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    } else if (x0 < minX || x0 > maxX) return Infinity;
    if (Math.abs(dy) > 1e-6) {
      let t1 = (minY - y0) / dy;
      let t2 = (maxY - y0) / dy;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    } else if (y0 < minY || y0 > maxY) return Infinity;
    return tmin <= tmax ? tmin : Infinity;
  }

  function rayDistToCircleWall(x0, y0, dirX, dirY, pad) {
    const ac = arenaCenter();
    const R = arenaBoundaryRadius(pad);
    const ox = x0 - ac.cx;
    const oy = y0 - ac.cy;
    const a = dirX * dirX + dirY * dirY;
    if (a < 1e-10) return 0;
    const b = 2 * (ox * dirX + oy * dirY);
    const c = ox * ox + oy * oy - R * R;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 0;
    const sqrtD = Math.sqrt(disc);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);
    let best = Infinity;
    if (t1 > 1e-4) best = Math.min(best, t1);
    if (t2 > 1e-4) best = Math.min(best, t2);
    return best === Infinity ? 0 : best;
  }

  function rayDistToRectWall(x0, y0, dirX, dirY, pad) {
    const b = rectArenaBounds(pad);
    let best = Infinity;
    if (Math.abs(dirX) > 1e-6) {
      let t = (b.minX - x0) / dirX;
      if (t > 1e-4 && y0 + dirY * t >= b.minY && y0 + dirY * t <= b.maxY) {
        best = Math.min(best, t);
      }
      t = (b.maxX - x0) / dirX;
      if (t > 1e-4 && y0 + dirY * t >= b.minY && y0 + dirY * t <= b.maxY) {
        best = Math.min(best, t);
      }
    }
    if (Math.abs(dirY) > 1e-6) {
      let t = (b.minY - y0) / dirY;
      if (t > 1e-4 && x0 + dirX * t >= b.minX && x0 + dirX * t <= b.maxX) {
        best = Math.min(best, t);
      }
      t = (b.maxY - y0) / dirY;
      if (t > 1e-4 && x0 + dirX * t >= b.minX && x0 + dirX * t <= b.maxX) {
        best = Math.min(best, t);
      }
    }
    return best === Infinity ? 0 : best;
  }

  function rayDistToArenaWall(x0, y0, dirX, dirY, pad) {
    let dist =
      currentMapDef().bounds === "rect"
        ? rayDistToRectWall(x0, y0, dirX, dirY, pad)
        : rayDistToCircleWall(x0, y0, dirX, dirY, pad);
    const obs = getCollidableObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const t = rayCircleIntersect(x0, y0, dirX, dirY, o.x, o.y, o.r + 4);
      if (t > 1e-4) dist = Math.min(dist, t);
    }
    const walls = mapRuntime.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const t = rayDistToAabb(x0, y0, dirX, dirY, w.minX, w.minY, w.maxX, w.maxY);
      if (t > 1e-4 && t < dist) dist = t;
    }
    return dist;
  }

  function rayCircleIntersect(x0, y0, dx, dy, cx, cy, r) {
    const ox = x0 - cx;
    const oy = y0 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-10) return Infinity;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return Infinity;
    const sqrtD = Math.sqrt(disc);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);
    let best = Infinity;
    if (t1 > 1e-4) best = Math.min(best, t1);
    if (t2 > 1e-4) best = Math.min(best, t2);
    return best;
  }

  function mazeFloorSeedCells() {
    return [
      [1, 1],
      [13, 11],
      [1, 11],
      [13, 1],
      [3, 5],
      [11, 5],
      [9, 9],
    ];
  }

  /** Turn unreachable floor into #; keeps only corridors connected to spawns/boss. */
  function bakeMazeGrid(rows) {
    const gridRows = rows.length;
    const cols = rows[0].length;
    const reachable = [];
    for (let gy = 0; gy < gridRows; gy++) {
      reachable.push(new Array(cols).fill(false));
    }
    const queue = [];
    const seeds = mazeFloorSeedCells();
    for (let s = 0; s < seeds.length; s++) {
      const gx = seeds[s][0];
      const gy = seeds[s][1];
      if (gy < 0 || gy >= gridRows || gx < 0 || gx >= cols) continue;
      if (rows[gy][gx] !== ".") continue;
      if (reachable[gy][gx]) continue;
      reachable[gy][gx] = true;
      queue.push({ gx: gx, gy: gy });
    }
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (queue.length > 0) {
      const cur = queue.shift();
      for (let d = 0; d < dirs.length; d++) {
        const nx = cur.gx + dirs[d][0];
        const ny = cur.gy + dirs[d][1];
        if (ny < 0 || ny >= gridRows || nx < 0 || nx >= cols) continue;
        if (rows[ny][nx] !== ".") continue;
        if (reachable[ny][nx]) continue;
        reachable[ny][nx] = true;
        queue.push({ gx: nx, gy: ny });
      }
    }
    const out = [];
    for (let gy = 0; gy < gridRows; gy++) {
      let line = "";
      for (let gx = 0; gx < cols; gx++) {
        if (rows[gy][gx] === "#") {
          line += "#";
        } else if (reachable[gy][gx]) {
          line += ".";
        } else {
          line += "#";
        }
      }
      out.push(line);
    }
    return out;
  }

  function buildMazeWallsFromGrid(rows) {
    const b = rectArenaBounds(0);
    const cols = rows[0].length;
    const gridRows = rows.length;
    const cellW = (b.maxX - b.minX) / cols;
    const cellH = (b.maxY - b.minY) / gridRows;

    for (let gy = 0; gy < gridRows; gy++) {
      const row = rows[gy];
      for (let gx = 0; gx < cols; gx++) {
        if (row[gx] !== "#") continue;
        const x0 = b.minX + gx * cellW;
        const y0 = b.minY + gy * cellH;
        mapRuntime.walls.push({
          minX: x0,
          minY: y0,
          maxX: x0 + cellW,
          maxY: y0 + cellH,
        });
      }
    }
  }

  function initMapRuntime() {
    const ac = arenaCenter();
    const R = arenaRadius();
    mapRuntime.obstacles = [];
    mapRuntime.walls = [];
    mapRuntime.movers = [];
    mapRuntime.portals = [];
    mapRuntime.portalCd = Object.create(null);
    mapRuntime.creatures = [];
    mapRuntime.creatureSpawnCd = CREATURE_SPAWN_INTERVAL * 0.4;
    mapRuntime.creatureNextId = 0;
    mapRuntime.waveEnemies = [];
    mapRuntime.waveEnemyNextId = 0;
    mapRuntime.hostileShots = [];
    mapRuntime.toxicPuddles = [];
    mapRuntime.bossBottles = [];
    mapRuntime.bossMinions = [];
    mapRuntime.bossMinionNextId = 0;
    mapRuntime.echoSummons = [];
    mapRuntime.echoSummonNextId = 0;
    mapRuntime.pikeSpears = [];
    mapRuntime.pikeSpearNextId = 0;
    mapRuntime.marionetteBolts = [];
    mapRuntime.marionetteBoltNextId = 0;
    mapRuntime.marionetteEffigies = [];
    mapRuntime.marionetteEffigyNextId = 0;
    mapRuntime.bases = [];
    mapRuntime.shadows = [];
    mapRuntime.shadowNextId = 0;

    if (gameMode === "siege") {
      const b = rectArenaBounds(0);
      const baseHp = scaleHp(SIEGE_BASE_HP);
      mapRuntime.bases.push(
        {
          team: "a",
          x: ac.cx,
          y: b.minY + SIEGE_BASE_INSET,
          r: SIEGE_BASE_R,
          hp: baseHp,
          maxHp: baseHp,
          hitFlash: 0,
          destroyed: false,
        },
        {
          team: "b",
          x: ac.cx,
          y: b.maxY - SIEGE_BASE_INSET,
          r: SIEGE_BASE_R,
          hp: baseHp,
          maxHp: baseHp,
          hitFlash: 0,
          destroyed: false,
        }
      );
    }

    const m = mapModifiers;

    if (m.maze) {
      const bakedMaze = bakeMazeGrid(MAZE_GRID);
      mapRuntime.mazeNavRows = bakedMaze;
      buildMazeWallsFromGrid(bakedMaze);
    } else {
      mapRuntime.mazeNavRows = null;
    }

    if (m.pillars) {
      // Randomized each match instead of a fixed layout — rejection-sample
      // each new pillar against the ones already placed so they don't land
      // on top of each other.
      const pillarSizes = [30, 24, 26, 20, 22];
      const placedPillars = [];
      for (let i = 0; i < pillarSizes.length; i++) {
        const pr = pillarSizes[i];
        let x = ac.cx;
        let y = ac.cy;
        for (let tries = 0; tries < 30; tries++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = R * (0.3 + Math.random() * 0.42);
          const cx = ac.cx + Math.cos(ang) * dist;
          const cy = ac.cy + Math.sin(ang) * dist;
          let ok = true;
          for (let j = 0; j < placedPillars.length; j++) {
            const other = placedPillars[j];
            if (len(cx - other.x, cy - other.y) < pr + other.r + 40) {
              ok = false;
              break;
            }
          }
          if (ok) {
            x = cx;
            y = cy;
            break;
          }
        }
        placedPillars.push({ x, y, r: pr });
        mapRuntime.obstacles.push({ x, y, r: pr });
      }
    }

    if (m.lattice) {
      const b = rectArenaBounds(PLAYER_R + 8);
      const cols = 3;
      const rows = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const tx = (col + 1) / (cols + 1);
          const ty = (row + 1) / (rows + 1);
          mapRuntime.obstacles.push({
            x: b.minX + (b.maxX - b.minX) * tx,
            y: b.minY + (b.maxY - b.minY) * ty,
            r: 22,
          });
        }
      }
    }

    if (m.ring) {
      mapRuntime.obstacles.push({ x: ac.cx, y: ac.cy, r: R * 0.38 });
    }

    if (m.movers) {
      // Randomized axis/position each match instead of a fixed layout.
      const moverDefs = [
        { r: 28, speed: 95 },
        { r: 24, speed: 110 },
      ];
      moverDefs.forEach((def) => {
        // Ranges kept modest enough that even the worst-case diagonal
        // corner (travel extreme + perpendicular offset combined) still
        // clears a circular arena boundary, not just a rectangular one.
        const horizontal = Math.random() < 0.5;
        const halfSpan = R * (0.25 + Math.random() * 0.25);
        if (horizontal) {
          const centerX = ac.cx + (Math.random() - 0.5) * R * 0.2;
          const fixedY = ac.cy + (Math.random() - 0.5) * R * 0.4;
          mapRuntime.movers.push({
            x: centerX - halfSpan * 0.5,
            y: fixedY,
            r: def.r,
            vx: def.speed,
            vy: 0,
            minX: centerX - halfSpan,
            maxX: centerX + halfSpan,
            minY: fixedY - 40,
            maxY: fixedY + 40,
          });
        } else {
          const centerY = ac.cy + (Math.random() - 0.5) * R * 0.2;
          const fixedX = ac.cx + (Math.random() - 0.5) * R * 0.4;
          mapRuntime.movers.push({
            x: fixedX,
            y: centerY - halfSpan * 0.5,
            r: def.r,
            vx: 0,
            vy: def.speed,
            minX: fixedX - 40,
            maxX: fixedX + 40,
            minY: centerY - halfSpan,
            maxY: centerY + halfSpan,
          });
        }
      });
    }

    if (m.portals) {
      if (m.maze) {
        // Labyrinth walls make the open-floor ratio placements below land
        // inside walls at random — pick a random pair of gates from the
        // known-open maze cell pool each match instead of fixed ones.
        const pool = MAZE_PORTAL_CELL_POOL.slice();
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = pool[i];
          pool[i] = pool[j];
          pool[j] = tmp;
        }
        const g1 = mazeGridCenterT(pool[0][0], pool[0][1]);
        const g2 = mazeGridCenterT(pool[1][0], pool[1][1]);
        const g3 = mazeGridCenterT(pool[2][0], pool[2][1]);
        const g4 = mazeGridCenterT(pool[3][0], pool[3][1]);
        mapRuntime.portals.push(
          { x: g1.x, y: g1.y, r: 20, tx: g2.x, ty: g2.y },
          { x: g2.x, y: g2.y, r: 20, tx: g1.x, ty: g1.y },
          { x: g3.x, y: g3.y, r: 20, tx: g4.x, ty: g4.y },
          { x: g4.x, y: g4.y, r: 20, tx: g3.x, ty: g3.y }
        );
      } else if (m.bounds === "rect") {
        const b = rectArenaBounds(PLAYER_R + 12);
        const randFrac = () => 0.16 + Math.random() * 0.68;
        let fx1 = randFrac();
        let fy1 = randFrac();
        let fx2 = randFrac();
        let fy2 = randFrac();
        for (let tries = 0; tries < 20 && len(fx1 - fx2, fy1 - fy2) < 0.42; tries++) {
          fx2 = randFrac();
          fy2 = randFrac();
        }
        const p1 = {
          x: b.minX + (b.maxX - b.minX) * fx1,
          y: b.minY + (b.maxY - b.minY) * fy1,
        };
        const p2 = {
          x: b.minX + (b.maxX - b.minX) * fx2,
          y: b.minY + (b.maxY - b.minY) * fy2,
        };
        mapRuntime.portals.push(
          { x: p1.x, y: p1.y, r: 22, tx: p2.x, ty: p2.y },
          { x: p2.x, y: p2.y, r: 22, tx: p1.x, ty: p1.y }
        );
      } else {
        // Two randomized pairs, each pair kept at least a quarter-turn
        // apart so the gates don't cluster next to each other.
        for (let pair = 0; pair < 2; pair++) {
          const ang1 = Math.random() * Math.PI * 2;
          let ang2 = Math.random() * Math.PI * 2;
          for (
            let tries = 0;
            tries < 20 && Math.abs(angleDiff(ang1, ang2)) < Math.PI * 0.5;
            tries++
          ) {
            ang2 = Math.random() * Math.PI * 2;
          }
          const dist1 = R * (0.48 + Math.random() * 0.24);
          const dist2 = R * (0.48 + Math.random() * 0.24);
          const gr = pair === 0 ? 22 : 20;
          const p1 = {
            x: ac.cx + Math.cos(ang1) * dist1,
            y: ac.cy + Math.sin(ang1) * dist1,
          };
          const p2 = {
            x: ac.cx + Math.cos(ang2) * dist2,
            y: ac.cy + Math.sin(ang2) * dist2,
          };
          mapRuntime.portals.push(
            { x: p1.x, y: p1.y, r: gr, tx: p2.x, ty: p2.y },
            { x: p2.x, y: p2.y, r: gr, tx: p1.x, ty: p1.y }
          );
        }
      }
    }
  }

  function updateMapDynamics(dt) {
    for (let i = 0; i < mapRuntime.movers.length; i++) {
      const m = mapRuntime.movers[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < m.minX) {
        m.x = m.minX;
        m.vx = Math.abs(m.vx);
      } else if (m.x > m.maxX) {
        m.x = m.maxX;
        m.vx = -Math.abs(m.vx);
      }
      if (m.y < m.minY) {
        m.y = m.minY;
        m.vy = Math.abs(m.vy);
      } else if (m.y > m.maxY) {
        m.y = m.maxY;
        m.vy = -Math.abs(m.vy);
      }
      const res = resolveArenaBoundary(m.x, m.y, m.vx, m.vy, m.r);
      m.x = res.x;
      m.y = res.y;
      m.vx = res.vx;
      m.vy = res.vy;
    }
    const keys = Object.keys(mapRuntime.portalCd);
    for (let k = 0; k < keys.length; k++) {
      mapRuntime.portalCd[keys[k]] = Math.max(0, mapRuntime.portalCd[keys[k]] - dt);
    }
    if (mapHasCreatures()) updateCreatures(dt);
    updateHexwrightDynamics(dt);
    updateEchoSummons(dt);
    updatePikeSpears(dt);
    updateMarionetteBolts(dt);
    updateMarionetteEffigies(dt);
  }

  function pointBlockedForCreature(x, y, r) {
    if (!isInsideArena(x, y, r + 6)) return true;
    const walls = mapRuntime.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (
        x >= w.minX - r &&
        x <= w.maxX + r &&
        y >= w.minY - r &&
        y <= w.maxY + r
      ) {
        return true;
      }
    }
    const obs = getCollidableObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (len(x - o.x, y - o.y) < o.r + r + 4) return true;
    }
    return false;
  }

  function pickRandomCreatureSpawn() {
    const ac = arenaCenter();
    const R = arenaRadius();
    for (let t = 0; t < 52; t++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = R * (0.18 + Math.random() * 0.68);
      const x = ac.cx + Math.cos(ang) * dist;
      const y = ac.cy + Math.sin(ang) * dist;
      if (pointBlockedForCreature(x, y, CREATURE_RADIUS)) continue;
      let ok = true;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.hp <= 0) continue;
        if (len(x - p.x, y - p.y) < getPlayerRadius(p) + CREATURE_RADIUS + CREATURE_SPAWN_CLEAR) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const list = mapRuntime.creatures;
      for (let c = 0; c < list.length; c++) {
        if (len(x - list[c].x, y - list[c].y) < CREATURE_RADIUS * 2.8) {
          ok = false;
          break;
        }
      }
      if (ok) return { x: x, y: y };
    }
    return null;
  }

  function spawnCreature(x, y) {
    mapRuntime.creatures.push({
      id: mapRuntime.creatureNextId++,
      isCreature: true,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      r: CREATURE_RADIUS,
      hp: scaleHp(CREATURE_MAX_HP),
      maxHp: scaleHp(CREATURE_MAX_HP),
      hitFlash: 0,
      wanderT: 0,
      touchCd: Object.create(null),
    });
    spawnPopBurst(x, y, "rgba(120, 200, 100, 1)");
  }

  function isMapCreature(target) {
    return !!(target && target.isCreature);
  }

  function resolveCreatureWall(c) {
    let res = resolveArenaBoundary(c.x, c.y, c.vx, c.vy, c.r);
    res = resolveObstacleCollision(res.x, res.y, res.vx, res.vy, c.r);
    c.x = res.x;
    c.y = res.y;
    c.vx = res.vx;
    c.vy = res.vy;
  }

  function steerCreature(c, dt) {
    tickSlowDebuff(c, dt);
    const slowMul =
      (c.slowT || 0) > 0 ? (c.slowMul != null ? c.slowMul : 0.5) : 1;
    let target = null;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.hp <= 0) continue;
      const d = len(p.x - c.x, p.y - c.y);
      if (d < bestD) {
        bestD = d;
        target = p;
      }
    }
    if (target && bestD > 1e-3) {
      const dx = target.x - c.x;
      const dy = target.y - c.y;
      const d = len(dx, dy);
      c.vx = (dx / d) * CREATURE_SPEED * slowMul;
      c.vy = (dy / d) * CREATURE_SPEED * slowMul;
    } else {
      c.wanderT = (c.wanderT || 0) - dt;
      if (c.wanderT <= 0) {
        c.wanderT = 0.35 + Math.random() * 0.75;
        const a = Math.random() * Math.PI * 2;
        c.vx = Math.cos(a) * CREATURE_SPEED * 0.38 * slowMul;
        c.vy = Math.sin(a) * CREATURE_SPEED * 0.38 * slowMul;
      }
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    resolveCreatureWall(c);
  }

  function creatureTouchesFighter(c, fighter) {
    if (isSiphonPhasing(fighter)) return false;
    return (
      len(fighter.x - c.x, fighter.y - c.y) <
      c.r + getPlayerRadius(fighter)
    );
  }

  function creatureTouchDamage(c, fighter) {
    if (fighter.hp <= 0) return;
    const key = String(fighter.playerNum);
    const cd = c.touchCd[key] || 0;
    if (cd > 0) return;
    if (!creatureTouchesFighter(c, fighter)) return;
    applyDamageTo(fighter, null, CREATURE_TOUCH_DAMAGE, {
      hitFlash: 0.1,
      knockFrom: c,
      knockMul: 0.034,
      skipRicochetReflect: true,
    });
    c.touchCd[key] = CREATURE_TOUCH_COOLDOWN;
  }

  function damageCreature(c, dmg, knockFrom) {
    dmg = scaleDmg(dmg);
    if (!Number.isFinite(c.hp) || c.hp <= 0) {
      c.hp = 0;
      return 0;
    }
    if (!(dmg > 0) || !Number.isFinite(dmg)) return 0;
    const hpBefore = c.hp;
    c.hp = Math.max(0, c.hp - dmg);
    const dealt = hpBefore - c.hp;
    if (knockFrom) grantUltimateMinionCharge(knockFrom, dealt);
    c.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(c.x, c.y, "rgba(140, 220, 120, 1)", 4);
    }
    if (knockFrom && dmg > 0) {
      const src = knockFrom;
      const dx = c.x - src.x;
      const dy = c.y - src.y;
      const n = norm(dx, dy);
      const kb = KNOCKBACK * 0.04;
      c.x += n.x * kb * 0.08;
      c.y += n.y * kb * 0.08;
    }
    if (c.hp <= 0) {
      spawnPopBurst(c.x, c.y, "rgba(120, 200, 100, 1)");
      // Defer list removal so multi-target loops (AoE ults, dashes) don't skip
      // the next critter after a splice.
    }
    return dealt;
  }

  function removeDeadCreatures() {
    const list = mapRuntime.creatures;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].hp <= 0) list.splice(i, 1);
    }
  }

  function hordePartySize() {
    const n =
      hordeState && hordeState.partySize != null
        ? hordeState.partySize
        : readRoster().total;
    return clamp(n, 1, MAX_TEAM_FIGHTERS);
  }

  /** Stronger enemies with more fighters (like boss scaling). */
  function hordePartyStrengthMul() {
    return 1 + (hordePartySize() - 1) * 0.11;
  }

  function hordePartyCountBonus() {
    return hordePartySize() - 1;
  }

  function hordeStatMul(wave) {
    const waveMul = 1 + (Math.max(1, wave) - 1) * 0.1;
    return waveMul * hordePartyStrengthMul();
  }

  function hordeWavePlan(wave) {
    const w = Math.max(1, wave);
    const extra = hordePartyCountBonus();
    return {
      swarmling: Math.floor(1 + w * 0.95 + extra * 0.6),
      grunt: Math.floor(1 + w * 0.7 + extra * 0.5),
      skitter: w >= 2 ? Math.floor((w - 1) * 0.65 + extra * 0.35) : 0,
      spitter: w >= 3 ? Math.floor((w - 2) * 0.5 + extra * 0.3) : 0,
      charger: w >= 4 ? Math.floor((w - 3) * 0.45 + extra * 0.28) : 0,
      bruiser: w >= 6 ? Math.floor((w - 5) * 0.4 + extra * 0.22) : 0,
    };
  }

  function isHordeHero(p) {
    return gameMode === "horde" && p && !p.isBot;
  }

  function isHordeHeroActive(p) {
    return isHordeHero(p) && !p.eliminated && p.hp > 0 && !p.downed;
  }

  function isHordeHeroDowned(p) {
    return isHordeHero(p) && p.downed && !p.eliminated;
  }

  function hordeTeamHasHope() {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (isHordeHero(p) && !p.eliminated) return true;
    }
    return false;
  }

  function hordeCheckDefeat() {
    if (gameMode !== "horde" || gameOver) return;
    if (!hordeTeamHasHope()) {
      winner = "horde_defeat";
      gameOver = true;
      showOverlay();
    }
  }

  function hordeEnterDowned(p) {
    if (!isHordeHero(p) || p.downed || p.eliminated) return;
    p.downed = true;
    p.downBleedT = HORDE_DOWN_BLEED;
    p.hp = 0;
    p.vx = 0;
    p.vy = 0;
    p.supportChannelT = 0;
    p.chargeT = 0;
    p.attackT = 0;
    p.beamActive = false;
    cancelPhoenixReviveState(p);
    hordeCheckDefeat();
  }

  function hordeEliminate(p) {
    if (!isHordeHero(p)) return;
    p.eliminated = true;
    p.downed = false;
    p.downBleedT = 0;
    p.supportChannelT = 0;
    hordeCheckDefeat();
  }

  function hordeReviveHero(p) {
    if (!isHordeHeroDowned(p)) return;
    p.downed = false;
    p.downBleedT = 0;
    p.hp = Math.max(8, Math.round(p.maxHp * HORDE_REVIVE_HP_MUL));
    p.hitFlash = 0.2;
    p.stunT = 0.35;
  }

  function hordeSupportRange(healer, target) {
    return (
      len(target.x - healer.x, target.y - healer.y) <=
      HORDE_SUPPORT_RANGE + getPlayerRadius(healer) + getPlayerRadius(target)
    );
  }

  function hordeTargetNeedsSupport(t) {
    if (!t || t.eliminated || !isHordeHero(t)) return false;
    if (isHordeHeroDowned(t)) return true;
    return t.hp > 0 && t.hp < t.maxHp - 0.5;
  }

  function hordeTargetClaimedByOther(healer, target) {
    for (let i = 0; i < players.length; i++) {
      const o = players[i];
      if (o === healer || !isHordeHeroActive(o)) continue;
      if (o.supportTargetNum !== target.playerNum) continue;
      if (!hordeSupportRange(o, target)) continue;
      if (o.isAi) {
        if (hordeTargetNeedsSupport(target)) return true;
      } else if (hordeSupportKeyHeld(o)) {
        return true;
      }
    }
    return false;
  }

  function hordePickSupportNeed(healer, requireInRange) {
    let best = null;
    let bestPri = -1;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (t === healer || !isHordeHero(t) || t.eliminated) continue;
      let pri = 0;
      if (isHordeHeroDowned(t)) pri = 2;
      else if (t.hp > 0 && t.hp < t.maxHp - 0.5) pri = 1;
      else continue;
      if (hordeTargetClaimedByOther(healer, t)) continue;
      const d = len(t.x - healer.x, t.y - healer.y);
      if (requireInRange && !hordeSupportRange(healer, t)) continue;
      if (pri > bestPri || (pri === bestPri && d < bestD)) {
        bestPri = pri;
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  function hordeFindSupportTarget(healer) {
    return hordePickSupportNeed(healer, true);
  }

  function hordeGetLockedSupportTarget(healer) {
    if (healer.supportTargetNum == null) return null;
    const locked = players.find(
      (pl) => pl.playerNum === healer.supportTargetNum
    );
    if (!locked || !hordeTargetNeedsSupport(locked)) {
      healer.supportTargetNum = null;
      healer.supportChannelT = 0;
      return null;
    }
    return locked;
  }

  function hordePickSupportFocus(healer) {
    const locked = hordeGetLockedSupportTarget(healer);
    if (locked) return locked;
    return hordePickSupportNeed(healer, false);
  }

  function hordeAiWantsToSupport(healer, target) {
    if (!target || !hordeTargetNeedsSupport(target)) return false;
    if (hordeTargetClaimedByOther(healer, target)) return false;
    if (isHordeHeroDowned(target)) return true;
    if (target.hp < target.maxHp * 0.68) return true;
    if (hordeState.phase === "intermission") return true;
    return false;
  }

  function hordeResolveSupportTarget(healer) {
    const locked = hordeGetLockedSupportTarget(healer);
    if (locked && hordeSupportRange(healer, locked)) {
      return locked;
    }
    return hordeFindSupportTarget(healer);
  }

  function hordeSupportKeyHeld(healer) {
    const code = healer.controls && healer.controls.support;
    if (!code) return false;
    return !!keys[code];
  }

  function hordeDownedIsBeingRevived(downed) {
    if (!isHordeHeroDowned(downed)) return false;
    for (let i = 0; i < players.length; i++) {
      const healer = players[i];
      if (!isHordeHeroActive(healer)) continue;
      if (healer.supportTargetNum !== downed.playerNum) continue;
      if (!hordeSupportRange(healer, downed)) continue;
      if (healer.isAi) return true;
      if (hordeSupportKeyHeld(healer)) return true;
    }
    return false;
  }

  function hordeIsActivelySupporting(healer) {
    if (gameMode !== "horde" || !isHordeHeroActive(healer)) return false;
    if (healer.isAi) {
      if (healer.supportTargetNum == null) return false;
      const target = players.find(
        (pl) => pl.playerNum === healer.supportTargetNum
      );
      return !!(
        target &&
        hordeTargetNeedsSupport(target) &&
        hordeSupportRange(healer, target)
      );
    }
    if (!hordeSupportKeyHeld(healer)) return false;
    return !!hordeResolveSupportTarget(healer);
  }

  function hordeTickSupport(healer, dt) {
    if (!isHordeHeroActive(healer)) {
      healer.supportChannelT = 0;
      return;
    }
    const target = hordeResolveSupportTarget(healer);
    const wantSupport = healer.isAi
      ? !!target
      : !!(target && hordeSupportKeyHeld(healer));
    if (!wantSupport || !target) {
      healer.supportChannelT = 0;
      healer.supportTargetNum = null;
      return;
    }

    healer.supportTargetNum = target.playerNum;
    healer.vx *= 0.85;
    healer.vy *= 0.85;

    if (isHordeHeroDowned(target)) {
      healer.supportChannelT = (healer.supportChannelT || 0) + dt;
      if (healer.supportChannelT >= HORDE_REVIVE_TIME) {
        hordeReviveHero(target);
        healer.supportChannelT = 0;
        healer.supportTargetNum = null;
      }
    } else {
      healer.supportChannelT = 0;
      if (target.hp >= target.maxHp - 0.5) {
        healer.supportTargetNum = null;
        return;
      }
      target.hp = Math.min(
        target.maxHp,
        target.hp + scaleHeal(HORDE_HEAL_PER_SEC * dt)
      );
    }
  }

  function updateHordeDowned(dt) {
    const pauseBleed =
      hordeState.phase === "intermission" && hordeState.intermissionT > 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isHordeHeroDowned(p)) continue;
      if (!pauseBleed) {
        if (hordeDownedIsBeingRevived(p)) {
          p.downBleedT = Math.min(
            HORDE_DOWN_BLEED,
            (p.downBleedT || 0) +
              HORDE_REVIVE_BLEED_RESTORE_PER_SEC * dt
          );
        } else {
          p.downBleedT = Math.max(0, (p.downBleedT || 0) - dt);
        }
      }
      if (!p.isBot) tickUltimateState(p, dt);
      if (p.isAi && isPhoenix(p) && ultimateReady(p)) {
        tryUseUltimate(p);
      }
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.downBleedT <= 0) hordeEliminate(p);
    }
  }

  function resetHordeState() {
    removeHordeBossPlayer();
    hordeState = {
      wave: 0,
      phase: "intermission",
      intermissionT: 2.2,
      partySize: clamp(readRoster().total, 1, MAX_TEAM_FIGHTERS),
      bossWave: false,
      bossWaveId: null,
    };
    mapRuntime.waveEnemies = [];
  }

  function pickWaveEnemySpawn(r) {
    const ac = arenaCenter();
    const R = arenaRadius();
    for (let t = 0; t < 60; t++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = R * (0.68 + Math.random() * 0.26);
      const x = ac.cx + Math.cos(ang) * dist;
      const y = ac.cy + Math.sin(ang) * dist;
      if (pointBlockedForCreature(x, y, r)) continue;
      let ok = true;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.hp <= 0) continue;
        if (len(x - p.x, y - p.y) < getPlayerRadius(p) + r + 24) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const list = mapRuntime.waveEnemies;
      for (let c = 0; c < list.length; c++) {
        if (len(x - list[c].x, y - list[c].y) < r + list[c].r + 10) {
          ok = false;
          break;
        }
      }
      if (ok) return { x: x, y: y };
    }
    return null;
  }

  function spawnWaveEnemy(kind, x, y, statMul) {
    const def = WAVE_ENEMY_KINDS[kind] || WAVE_ENEMY_KINDS.grunt;
    const mul = statMul || 1;
    const hpScale = 0.78;
    mapRuntime.waveEnemies.push({
      id: mapRuntime.waveEnemyNextId++,
      kind: kind,
      attack: def.attack || "melee",
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      facing: 0,
      r: def.r,
      hp: scaleHp(Math.max(1, Math.round(def.hp * mul * hpScale))),
      maxHp: scaleHp(Math.max(1, Math.round(def.hp * mul * hpScale))),
      speed: def.speed * (0.9 + mul * 0.06) * HORDE_ENEMY_SPEED_MUL,
      touchDamage: scaleDmg(def.touchDamage * mul * 0.88),
      color: def.color,
      hitFlash: 0,
      wanderT: 0,
      touchCd: Object.create(null),
      atkCd: 0.4 + Math.random() * 0.8,
      windupT: 0,
      pendingAttack: null,
      chargeT: 0,
      chargeVx: 0,
      chargeVy: 0,
      slamBlastT: 0,
    });
  }

  function spawnHordeWave() {
    hordeState.wave += 1;
    hordeState.phase = "active";
    const w = hordeState.wave;
    removeHordeBossPlayer();
    mapRuntime.waveEnemies = [];

    if (hordeIsBossWaveNumber(w)) {
      spawnHordeBossPlayer(w);
      return;
    }

    hordeState.bossWave = false;
    hordeState.bossWaveId = null;
    const plan = hordeWavePlan(w);
    const mul = hordeStatMul(w);
    const kinds = [
      "swarmling",
      "grunt",
      "skitter",
      "spitter",
      "charger",
      "bruiser",
    ];
    for (let k = 0; k < kinds.length; k++) {
      const kind = kinds[k];
      const count = plan[kind] || 0;
      for (let n = 0; n < count; n++) {
        const pos = pickWaveEnemySpawn(WAVE_ENEMY_KINDS[kind].r);
        if (pos) spawnWaveEnemy(kind, pos.x, pos.y, mul);
      }
    }
    updateHudLayout();
    refreshBossHudLabel();
  }

  function hordeThreatsAlive() {
    if (hordeBossWaveActive()) {
      const boss = getHordeBossPlayer();
      return boss && boss.hp > 0 ? 1 : 0;
    }
    let alive = 0;
    const list = mapRuntime.waveEnemies;
    for (let i = 0; i < list.length; i++) {
      if (list[i].hp > 0) alive += 1;
    }
    return alive;
  }

  function updateHordeMode(dt) {
    if (gameMode !== "horde" || gameOver) return;

    if (!hordeBossWaveActive()) {
      updateWaveEnemies(dt);
    }

    if (hordeState.phase === "intermission") {
      hordeState.intermissionT -= dt;
      if (hordeState.intermissionT <= 0) spawnHordeWave();
      return;
    }

    if (hordeThreatsAlive() === 0) {
      const wasBoss = hordeBossWaveActive();
      if (wasBoss) removeHordeBossPlayer();
      hordeState.phase = "intermission";
      hordeState.intermissionT = wasBoss
        ? HORDE_BOSS_WAVE_INTERMISSION
        : HORDE_WAVE_INTERMISSION;
    }
  }

  function resolveWaveEnemyWall(e) {
    let res = resolveArenaBoundary(e.x, e.y, e.vx, e.vy, e.r);
    res = resolveObstacleCollision(res.x, res.y, res.vx, res.vy, e.r);
    e.x = res.x;
    e.y = res.y;
    e.vx = res.vx;
    e.vy = res.vy;
  }

  function nearestHordeHero(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isHordeHeroActive(p)) continue;
      const d = len(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function spawnHostileShot(x, y, vx, vy, dmg) {
    mapRuntime.hostileShots.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      r: 6,
      dmg: dmg,
      traveled: 0,
      maxDist: 360,
    });
  }

  function waveEnemySlamHit(e) {
    const radius = e.r + 38;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isHordeHeroActive(p)) continue;
      if (len(p.x - e.x, p.y - e.y) > radius + getPlayerRadius(p)) continue;
      applyHordeHeroDamage(p, e, e.touchDamage * 2.2, {
        hitFlash: 0.14,
        knockFrom: e,
        knockMul: 0.06,
      });
    }
  }

  function waveEnemyChargeHit(e) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isHordeHeroActive(p)) continue;
      if (
        len(p.x - e.x, p.y - e.y) >
        e.r + getPlayerRadius(p) + 6
      ) {
        continue;
      }
      applyHordeHeroDamage(p, e, e.touchDamage * 1.35, {
        hitFlash: 0.12,
        knockFrom: e,
        knockMul: 0.05,
      });
    }
  }

  function executeWaveEnemyAttack(e, target) {
    if (!target || e.hp <= 0) return;
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = len(dx, dy);
    if (d > 1e-3) e.facing = Math.atan2(dy, dx);

    if (e.pendingAttack === "spit") {
      const spd = HORDE_HOSTILE_SHOT_SPEED;
      spawnHostileShot(
        e.x + Math.cos(e.facing) * (e.r + 4),
        e.y + Math.sin(e.facing) * (e.r + 4),
        Math.cos(e.facing) * spd,
        Math.sin(e.facing) * spd,
        Math.max(2.5, e.touchDamage * 1.1)
      );
    } else if (e.pendingAttack === "slam") {
      e.slamBlastT = 0.32;
      waveEnemySlamHit(e);
    } else if (e.pendingAttack === "charge") {
      e.chargeT = 0.38;
      e.chargeVx = Math.cos(e.facing) * e.speed * 2.35;
      e.chargeVy = Math.sin(e.facing) * e.speed * 2.35;
      if ((e.slowT || 0) > 0) {
        const sm = e.slowMul != null ? e.slowMul : 0.5;
        e.chargeVx *= sm;
        e.chargeVy *= sm;
      }
    }
    e.pendingAttack = null;
  }

  function tickWaveEnemyAttack(e, dt) {
    const target = nearestHordeHero(e.x, e.y);
    e.atkCd = Math.max(0, (e.atkCd || 0) - dt);
    e.slamBlastT = Math.max(0, (e.slamBlastT || 0) - dt);

    if (e.chargeT > 0) {
      e.chargeT = Math.max(0, e.chargeT - dt);
      e.x += e.chargeVx * dt;
      e.y += e.chargeVy * dt;
      resolveWaveEnemyWall(e);
      waveEnemyChargeHit(e);
      return true;
    }

    if (e.windupT > 0) {
      e.windupT = Math.max(0, e.windupT - dt);
      e.vx = 0;
      e.vy = 0;
      if (e.windupT <= 0) executeWaveEnemyAttack(e, target);
      return true;
    }

    if (!target) return false;
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = len(dx, dy);
    if (d > 1e-3) e.facing = Math.atan2(dy, dx);

    if (e.attack === "spit" && e.atkCd <= 0 && d > 52 && d < 270) {
      e.windupT = 0.38;
      e.pendingAttack = "spit";
      e.atkCd = 2.1 + Math.random() * 0.6;
      return true;
    }
    if (
      e.attack === "slam" &&
      e.atkCd <= 0 &&
      d < e.r + getPlayerRadius(target) + 52
    ) {
      e.windupT = 0.58;
      e.pendingAttack = "slam";
      e.atkCd = 3.2 + Math.random() * 0.8;
      return true;
    }
    if (e.attack === "charge" && e.atkCd <= 0 && d > 70 && d < 230) {
      e.windupT = 0.42;
      e.pendingAttack = "charge";
      e.atkCd = 3.8 + Math.random() * 0.9;
      return true;
    }
    return false;
  }

  function steerWaveEnemy(e, dt) {
    tickSlowDebuff(e, dt);
    const slowMul =
      (e.slowT || 0) > 0 ? (e.slowMul != null ? e.slowMul : 0.5) : 1;
    if (tickWaveEnemyAttack(e, dt)) return;

    const target = nearestHordeHero(e.x, e.y);
    if (target) {
      let dx = target.x - e.x;
      let dy = target.y - e.y;
      let d = len(dx, dy);
      if (mazeNavRows() && d > 1e-3) {
        const wp = mazeNavWaypoint(e.x, e.y, target.x, target.y, e.r + 6);
        if (wp) {
          const wx = wp.x - e.x;
          const wy = wp.y - e.y;
          const wd = len(wx, wy);
          if (wd > e.r * 2.2) {
            dx = wx;
            dy = wy;
            d = wd;
          }
        }
      }
      let moveSpeed = e.speed * slowMul;
      if (e.attack === "spit" && d < 90) moveSpeed *= 0.72;
      if (d > 1e-3) {
        e.vx = (dx / d) * moveSpeed;
        e.vy = (dy / d) * moveSpeed;
      }
    } else {
      e.wanderT = (e.wanderT || 0) - dt;
      if (e.wanderT <= 0) {
        e.wanderT = 0.4 + Math.random() * 0.8;
        const a = Math.random() * Math.PI * 2;
        e.vx = Math.cos(a) * e.speed * 0.35 * slowMul;
        e.vy = Math.sin(a) * e.speed * 0.35 * slowMul;
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    resolveWaveEnemyWall(e);
  }

  function applyHordeHeroDamage(p, source, dmg, opts) {
    if (!isHordeHero(p) || p.eliminated || p.downed) return;
    applyDamageTo(p, source, dmg, opts);
  }

  function updateHostileShots(dt) {
    if (gameMode !== "horde") return;
    const list = mapRuntime.hostileShots;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.traveled += len(s.vx * dt, s.vy * dt);
      if (!isInsideArena(s.x, s.y, -8) || s.traveled >= s.maxDist) {
        list.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (!isHordeHeroActive(p)) continue;
        if (len(p.x - s.x, p.y - s.y) > s.r + getPlayerRadius(p)) continue;
        applyHordeHeroDamage(p, null, s.dmg, {
          hitFlash: 0.1,
          knockFrom: s,
          knockMul: 0.028,
          skipRicochetReflect: true,
        });
        hit = true;
        break;
      }
      if (hit) list.splice(i, 1);
    }
  }

  function waveEnemyTouchesFighter(e, fighter) {
    if (isSiphonPhasing(fighter)) return false;
    return (
      len(fighter.x - e.x, fighter.y - e.y) < e.r + getPlayerRadius(fighter)
    );
  }

  function waveEnemyTouchDamage(e, fighter) {
    if (!isHordeHeroActive(fighter)) return;
    if (e.attack !== "melee" && e.chargeT <= 0) return;
    const key = String(fighter.playerNum);
    const cd = e.touchCd[key] || 0;
    if (cd > 0) return;
    if (!waveEnemyTouchesFighter(e, fighter)) return;
    applyHordeHeroDamage(fighter, e, e.touchDamage, {
      hitFlash: 0.1,
      knockFrom: e,
      knockMul: 0.038,
      skipRicochetReflect: true,
    });
    e.touchCd[key] = CREATURE_TOUCH_COOLDOWN;
  }

  function damageWaveEnemy(e, dmg, knockFrom) {
    dmg = scaleDmg(dmg);
    if (e.hp <= 0) return;
    const hpBefore = e.hp;
    e.hp = Math.max(0, e.hp - dmg);
    const dealt = hpBefore - e.hp;
    if (knockFrom) grantUltimateCdReduction(knockFrom, dealt);
    e.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(e.x, e.y, e.color || "#ff7a5c", 5);
    }
    if (knockFrom && dmg > 0) {
      const src = knockFrom;
      const dx = e.x - src.x;
      const dy = e.y - src.y;
      const n = norm(dx, dy);
      const kb = KNOCKBACK * 0.04;
      e.x += n.x * kb * 0.08;
      e.y += n.y * kb * 0.08;
    }
    if (e.hp <= 0) spawnDeathBurst(e.x, e.y, e.color || "#ff7a5c");
  }

  function removeDeadWaveEnemies() {
    const list = mapRuntime.waveEnemies;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].hp <= 0) list.splice(i, 1);
    }
  }

  function separateWaveEnemiesFromFighters() {
    const list = mapRuntime.waveEnemies;
    for (let pass = 0; pass < 4; pass++) {
      for (let ei = 0; ei < list.length; ei++) {
        const e = list[ei];
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.hp <= 0) continue;
          if (isSiphonPhasing(p)) continue;
          const minD = e.r + getPlayerRadius(p);
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.55;
          e.x += nx * push;
          e.y += ny * push;
          p.x -= nx * push * 0.45;
          p.y -= ny * push * 0.45;
        }
        for (let ej = ei + 1; ej < list.length; ej++) {
          const o = list[ej];
          const minD = e.r + o.r;
          const dx = o.x - e.x;
          const dy = o.y - e.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.5;
          e.x -= nx * push;
          e.y -= ny * push;
          o.x += nx * push;
          o.y += ny * push;
        }
        resolveWaveEnemyWall(e);
      }
    }
  }

  function updateWaveEnemies(dt) {
    if (gameMode !== "horde" || gameOver) return;
    updateHostileShots(dt);
    const list = mapRuntime.waveEnemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hp <= 0) continue;
      e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt);
      const keys = Object.keys(e.touchCd);
      for (let k = 0; k < keys.length; k++) {
        e.touchCd[keys[k]] = Math.max(0, e.touchCd[keys[k]] - dt);
      }
      steerWaveEnemy(e, dt);
      for (let pi = 0; pi < players.length; pi++) {
        waveEnemyTouchDamage(e, players[pi]);
      }
    }
    removeDeadWaveEnemies();
  }

  function waveEnemyMeleeHit(attacker, e) {
    if (attacker.attackT <= 0 || attacker.hp <= 0 || e.hp <= 0) return false;
    if (isBulwarkAuraSwing(attacker)) {
      const ratio = attacker.lastSwingChargeRatio;
      const radius = auraRadiusForPlayer(attacker, ratio);
      return len(e.x - attacker.x, e.y - attacker.y) <= radius + e.r;
    }
    if (
      attacker.attackStyle === "ranged" ||
      attacker.attackStyle === "spread" ||
      attacker.attackStyle === "nova" ||
      attacker.attackStyle === "barrage" ||
      attacker.attackStyle === "dash" ||
      attacker.attackStyle === "phoenix" ||
      attacker.attackStyle === "bounce" ||
      attacker.attackStyle === "beam"
    ) {
      return false;
    }
    const ratio = attacker.lastSwingChargeRatio;
    if (attacker.attackStyle === "lance") {
      return lanceCorridorHit(attacker, e.x, e.y, e.r);
    }
    const range = attackSectorRange(attacker, ratio);
    const arc = attackSectorArc(attacker, ratio);
    const dx = e.x - attacker.x;
    const dy = e.y - attacker.y;
    const d = len(dx, dy);
    if (d > range + e.r) return false;
    const ang = Math.atan2(dy, dx);
    const ad = Math.abs(angleDiff(ang, attacker.facing));
    if (ad > arc * 0.5) return false;
    return true;
  }

  function tryHitWaveEnemies(attacker) {
    if (gameMode !== "horde" || gameOver || attacker.hp <= 0 || attacker.attackT <= 0) {
      return;
    }
    const list = mapRuntime.waveEnemies;
    const swingKey = attacker.playerNum + ":w:" + attacker.swingId;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hp <= 0) continue;
      if (e.lastHitSwingKey === swingKey) continue;
      if (!waveEnemyMeleeHit(attacker, e)) continue;
      e.lastHitSwingKey = swingKey;
      const dmg =
        isBulwarkAuraSwing(attacker)
          ? Math.max(2, attacker.swingDamage * 0.38)
          : Math.max(
              3,
              meleeSwingDamageForTarget(attacker, e.x, e.y) * 0.48
            );
      damageWaveEnemy(e, dmg, attacker);
    }
    removeDeadWaveEnemies();
  }

  function projectileHitsWaveEnemy(pr, e) {
    return len(e.x - pr.x, e.y - pr.y) <= pr.r + e.r;
  }

  function tryProjectileHitWaveEnemies(pr, owner, consumeOnHit) {
    if (gameMode !== "horde" || !owner) return false;
    const list = mapRuntime.waveEnemies;
    let hit = false;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hp <= 0) continue;
      if (!projectileHitsWaveEnemy(pr, e)) continue;
      const swingKey =
        pr.ownerNum + ":pw:" + pr.swingId + ":" + (pr.pelletIdx != null ? pr.pelletIdx : 0);
      if (e.lastHitSwingKey === swingKey) continue;
      e.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: e.x, y: e.y });
      const dealt = Math.max(2, boltDmg * 0.58);
      const sx = pr.spawnX != null ? pr.spawnX : pr.x;
      const sy = pr.spawnY != null ? pr.spawnY : pr.y;
      const knockSrc = pr.reverseKnock
        ? { x: e.x * 2 - sx, y: e.y * 2 - sy }
        : { x: pr.x, y: pr.y };
      damageWaveEnemy(e, dealt, knockSrc);
      trackPhoenixDamageDealt(owner, dealt);
      hit = true;
    }
    removeDeadWaveEnemies();
    return hit && consumeOnHit !== false;
  }

  function tryDashHitWaveEnemy(attacker, e) {
    if (gameOver || attacker.hp <= 0 || e.hp <= 0) return;
    if (!isDashing(attacker)) return;
    const dx = e.x - attacker.x;
    const dy = e.y - attacker.y;
    if (len(dx, dy) > getPlayerRadius(attacker) + e.r + DASH_HIT_PAD) return;
    const swingKey = attacker.playerNum + ":wd:" + attacker.swingId;
    if (e.lastHitSwingKey === swingKey) return;
    e.lastHitSwingKey = swingKey;
    const perfect = dashMarkerOnDefender(attacker, { x: e.x, y: e.y, hitRadius: e.r });
    const dmgMul = perfect ? DASH_DAMAGE_PERFECT_MUL : DASH_DAMAGE_IMPERFECT_MUL;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    damageWaveEnemy(e, attacker.swingDamage * dmgMul * dashMul, attacker);
    attacker.dashHitLanded = true;
    healFromStrikerUltHit(attacker);
    if (perfect) {
      attacker.dashPerfectLanded = true;
    }
  }

  function laserBeamHitsWaveEnemy(beam, e) {
    if (e.hp <= 0) return false;
    const offset = laserBeamCenterOffset({ x: e.x, y: e.y }, beam);
    return offset <= e.r + LASER_BEAM_HALF_WIDTH;
  }

  function laserBeamHitsBossMinion(beam, m) {
    if (m.hp <= 0) return false;
    const offset = laserBeamCenterOffset({ x: m.x, y: m.y }, beam);
    return offset <= m.r + LASER_BEAM_HALF_WIDTH;
  }

  function separateCreaturesFromFighters() {
    const list = mapRuntime.creatures;
    for (let pass = 0; pass < 4; pass++) {
      for (let ci = 0; ci < list.length; ci++) {
        const c = list[ci];
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.hp <= 0) continue;
          if (isSiphonPhasing(p)) continue;
          const minD = c.r + getPlayerRadius(p);
          const dx = c.x - p.x;
          const dy = c.y - p.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.55;
          c.x += nx * push;
          c.y += ny * push;
          p.x -= nx * push * 0.45;
          p.y -= ny * push * 0.45;
        }
        for (let cj = ci + 1; cj < list.length; cj++) {
          const o = list[cj];
          const minD = c.r + o.r;
          const dx = o.x - c.x;
          const dy = o.y - c.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.5;
          c.x -= nx * push;
          c.y -= ny * push;
          o.x += nx * push;
          o.y += ny * push;
        }
        resolveCreatureWall(c);
      }
    }
  }

  function creatureMeleeHit(attacker, c) {
    if (attacker.attackT <= 0 || attacker.hp <= 0 || c.hp <= 0) return false;
    if (isBulwarkAuraSwing(attacker)) {
      const ratio = attacker.lastSwingChargeRatio;
      const radius = auraRadiusForPlayer(attacker, ratio);
      return len(c.x - attacker.x, c.y - attacker.y) <= radius + c.r;
    }
    if (
      attacker.attackStyle === "ranged" ||
      attacker.attackStyle === "spread" ||
      attacker.attackStyle === "nova" ||
      attacker.attackStyle === "barrage" ||
      attacker.attackStyle === "dash" ||
      attacker.attackStyle === "phoenix" ||
      attacker.attackStyle === "bounce" ||
      attacker.attackStyle === "beam"
    ) {
      return false;
    }
    const ratio = attacker.lastSwingChargeRatio;
    if (attacker.attackStyle === "lance") {
      return lanceCorridorHit(attacker, c.x, c.y, c.r);
    }
    const range = attackSectorRange(attacker, ratio);
    const arc = attackSectorArc(attacker, ratio);
    const dx = c.x - attacker.x;
    const dy = c.y - attacker.y;
    const d = len(dx, dy);
    if (d > range + c.r) return false;
    const ang = Math.atan2(dy, dx);
    const ad = Math.abs(angleDiff(ang, attacker.facing));
    if (ad > arc * 0.5) return false;
    return true;
  }

  function tryHitCreatures(attacker) {
    if (!mapHasCreatures() || gameOver || attacker.hp <= 0 || attacker.attackT <= 0) {
      return;
    }
    const list = mapRuntime.creatures;
    const swingKey = attacker.playerNum + ":c:" + attacker.swingId;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      if (c.hp <= 0) continue;
      if (c.lastHitSwingKey === swingKey) continue;
      if (!creatureMeleeHit(attacker, c)) continue;
      c.lastHitSwingKey = swingKey;
      const dmg =
        isBulwarkAuraSwing(attacker)
          ? Math.max(2, attacker.swingDamage * 0.35)
          : Math.max(
              3,
              meleeSwingDamageForTarget(attacker, c.x, c.y) * 0.42
            );
      damageCreature(c, dmg, attacker);
    }
    removeDeadCreatures();
  }

  function projectileHitsCreature(pr, c) {
    const dx = c.x - pr.x;
    const dy = c.y - pr.y;
    return len(dx, dy) <= pr.r + c.r;
  }

  function tryProjectileHitCreatures(pr, owner, consumeOnHit) {
    if (!mapHasCreatures() || !owner) return false;
    const list = mapRuntime.creatures;
    let hit = false;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.hp <= 0) continue;
      if (!projectileHitsCreature(pr, c)) continue;
      const swingKey =
        pr.ownerNum + ":pc:" + pr.swingId + ":" + (pr.pelletIdx != null ? pr.pelletIdx : 0);
      if (c.lastHitSwingKey === swingKey) continue;
      c.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: c.x, y: c.y });
      const dealt = Math.max(2, boltDmg * 0.55);
      damageCreature(c, dealt, owner);
      hit = true;
    }
    removeDeadCreatures();
    return hit && consumeOnHit !== false;
  }

  function updateCreatures(dt) {
    if (!mapHasCreatures() || gameOver) return;

    mapRuntime.creatureSpawnCd -= dt;
    if (
      mapRuntime.creatureSpawnCd <= 0 &&
      mapRuntime.creatures.length < CREATURE_MAX_ALIVE
    ) {
      const pt = pickRandomCreatureSpawn();
      if (pt) spawnCreature(pt.x, pt.y);
      mapRuntime.creatureSpawnCd =
        CREATURE_SPAWN_INTERVAL + Math.random() * CREATURE_SPAWN_JITTER;
    }

    const list = mapRuntime.creatures;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      c.hitFlash = Math.max(0, (c.hitFlash || 0) - dt);
      const cdKeys = Object.keys(c.touchCd);
      for (let k = 0; k < cdKeys.length; k++) {
        const key = cdKeys[k];
        c.touchCd[key] = Math.max(0, c.touchCd[key] - dt);
      }
      steerCreature(c, dt);
      for (let pi = 0; pi < players.length; pi++) {
        creatureTouchDamage(c, players[pi]);
      }
    }
    separateCreaturesFromFighters();
    removeDeadCreatures();
  }

  const PORTAL_EXIT_PAD = 20;
  const PORTAL_BLOCK_SEC = 1.75;

  function portalCdKey(cdKey, portalIdx) {
    return cdKey + "@" + portalIdx;
  }

  function portalBlocked(cdKey, portalIdx) {
    return (mapRuntime.portalCd[portalCdKey(cdKey, portalIdx)] || 0) > 0;
  }

  function blockPortal(cdKey, portalIdx, sec) {
    mapRuntime.portalCd[portalCdKey(cdKey, portalIdx)] = sec;
  }

  function findPortalIndexAt(x, y, bodyR) {
    for (let i = 0; i < mapRuntime.portals.length; i++) {
      const p = mapRuntime.portals[i];
      if (len(x - p.x, y - p.y) <= p.r + bodyR * 0.35) return i;
    }
    return -1;
  }

  function findPortalIndexNear(x, y, maxDist) {
    let best = -1;
    let bestD = maxDist;
    for (let i = 0; i < mapRuntime.portals.length; i++) {
      const p = mapRuntime.portals[i];
      const d = len(x - p.x, y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function portalExitPosition(fromPortal, bodyR, dir) {
    let nx = 1;
    let ny = 0;
    if (dir) {
      const dl = len(dir.x, dir.y);
      if (dl > 1e-6) {
        nx = dir.x / dl;
        ny = dir.y / dl;
      }
    } else {
      const dx = fromPortal.tx - fromPortal.x;
      const dy = fromPortal.ty - fromPortal.y;
      const d = len(dx, dy);
      if (d > 1e-6) {
        nx = dx / d;
        ny = dy / d;
      }
    }
    const destIdx = findPortalIndexNear(fromPortal.tx, fromPortal.ty, 36);
    const destR =
      destIdx >= 0 ? mapRuntime.portals[destIdx].r : fromPortal.r;
    let push = destR + bodyR + PORTAL_EXIT_PAD;
    if (mapModifiers.maze) {
      // A maze cell (~60x47px) is smaller than the usual push distance, so
      // a straight-line push this size reliably overshoots into whichever
      // wall happens to sit past the cell — cap it to stay inside the
      // destination's own cell, which is guaranteed open (the gate sits
      // in it).
      const cell = mazeCellSize();
      push = Math.min(push, Math.min(cell.w, cell.h) * 0.42);
    }
    const clamped = clampPointToArena(
      fromPortal.tx + nx * push,
      fromPortal.ty + ny * push,
      bodyR + 4
    );
    // clampPointToArena only keeps the exit inside the overall arena — in
    // tight quarters (a maze cell, or a gate placed near a pillar/crush
    // block) the straight-line exit point can still land inside a wall or
    // another obstacle, so push back out of those too.
    const resolved = resolveObstacleCollision(clamped.x, clamped.y, 0, 0, bodyR);
    if (
      mapModifiers.maze &&
      pointOverlapsAnyWall(resolved.x, resolved.y, wallCollisionRadius(bodyR))
    ) {
      // Very tight geometry can occasionally still leave an overlap even
      // after resolving — fall back to the destination gate's own spot,
      // which is guaranteed open (that's where the gate itself sits).
      return { x: fromPortal.tx, y: fromPortal.ty };
    }
    return { x: resolved.x, y: resolved.y };
  }

  function pointOverlapsAnyWall(x, y, bodyR) {
    const walls = mapRuntime.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (
        x >= w.minX - bodyR &&
        x <= w.maxX + bodyR &&
        y >= w.minY - bodyR &&
        y <= w.maxY + bodyR
      ) {
        return true;
      }
    }
    return false;
  }

  /** preserveDirection: exit moving the same direction it entered, instead
   *  of being redirected along the entry->destination portal axis. Used for
   *  projectiles (bullets keep their trajectory through a warp gate);
   *  players keep the original redirect-toward-destination behavior. */
  function tryPortalTeleport(x, y, vx, vy, bodyR, cdKey, preserveDirection) {
    if (mapRuntime.portals.length === 0) return null;
    const entryIdx = findPortalIndexAt(x, y, bodyR);
    if (entryIdx < 0) return null;
    if (portalBlocked(cdKey, entryIdx)) return null;

    const p = mapRuntime.portals[entryIdx];
    const destIdx = findPortalIndexNear(p.tx, p.ty, 36);
    const inDir = preserveDirection ? { x: vx, y: vy } : null;
    const out = portalExitPosition(p, bodyR, inDir);

    blockPortal(cdKey, entryIdx, PORTAL_BLOCK_SEC);
    if (destIdx >= 0) blockPortal(cdKey, destIdx, PORTAL_BLOCK_SEC);

    let nx = 1;
    let ny = 0;
    if (preserveDirection) {
      const vlen = len(vx, vy);
      if (vlen > 1e-6) {
        nx = vx / vlen;
        ny = vy / vlen;
      }
    } else {
      const dx = out.x - p.tx;
      const dy = out.y - p.ty;
      const outLen = len(dx, dy);
      if (outLen > 1e-6) {
        nx = dx / outLen;
        ny = dy / outLen;
      }
    }
    const spd = Math.max(len(vx, vy), MOVE_SPEED * 0.35);
    return {
      x: out.x,
      y: out.y,
      vx: nx * spd,
      vy: ny * spd,
    };
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function rangedDistForPlayer(p, ratio) {
    const rm = p.rangedRangeMul != null ? p.rangedRangeMul : 1;
    return RANGED_MAX_DIST * rm * (0.65 + 0.35 * ratio);
  }

  function spreadDistForPlayer(p, ratio) {
    const rm = p.spreadRangeMul != null ? p.spreadRangeMul : 1;
    return SPREAD_MAX_DIST * rm * (0.58 + 0.42 * ratio);
  }

  function novaDistForPlayer(p, ratio) {
    const rm = p.novaRangeMul != null ? p.novaRangeMul : 1;
    return NOVA_MAX_DIST * rm * (0.58 + 0.42 * ratio);
  }

  function novaPelletTier(pelletIdx, pelletCount) {
    const n = pelletCount != null ? pelletCount : NOVA_PELLET_COUNT;
    const idx = ((pelletIdx % n) + n) % n;
    const tier = idx <= n * 0.5 ? idx : n - idx;
    return clamp(tier, 0, NOVA_ANGLE_DMG_MUL.length - 1);
  }

  function novaPelletAngleMul(pelletIdx, pelletCount) {
    return NOVA_ANGLE_DMG_MUL[novaPelletTier(pelletIdx, pelletCount)];
  }

  function novaPelletSpeedMul(pelletIdx, pelletCount) {
    return NOVA_ANGLE_SPEED_MUL[novaPelletTier(pelletIdx, pelletCount)];
  }

  function dashDistForRatio(ratio) {
    return DASH_DIST_MIN + (DASH_DIST_MAX - DASH_DIST_MIN) * ratio;
  }

  function dashDistForPlayer(p, ratio) {
    if (isPhoenix(p)) {
      return (
        PHOENIX_DASH_DIST_MIN +
        (PHOENIX_DASH_DIST_MAX - PHOENIX_DASH_DIST_MIN) * ratio
      );
    }
    return dashDistForRatio(ratio);
  }

  function isDashing(p) {
    return p.dashT > 0;
  }

  function isStrikerUltDash(p) {
    return (
      p &&
      p.characterId === "striker" &&
      (p.dashDamageMul != null ? p.dashDamageMul : 1) > 1
    );
  }

  function healFromStrikerUltHit(attacker) {
    if (!isStrikerUltDash(attacker) || attacker.hp <= 0) return;
    const heal = Math.max(
      1,
      Math.round(attacker.maxHp * STRIKER_ULT_HIT_HEAL_FRAC)
    );
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + scaleHeal(heal));
  }

  function createPlayer(cfg, playerNum) {
    const isBot = !!cfg.isBot;
    const charId = isBot
      ? cfg.characterId != null
        ? cfg.characterId
        : null
      : cfg.characterId || "brawler";
    const def =
      charId != null
        ? getCharDef(charId)
        : {
            attackStyle: cfg.attackStyle || "melee",
            maxHp: MAX_HP,
            moveSpeedMul: 1,
            attackDamageMul: 1,
            chargeSpeedMul: 1,
          };
    const isAi = !!cfg.isAi;
    const maxHpRaw =
      cfg.maxHp != null ? cfg.maxHp : def.maxHp != null ? def.maxHp : MAX_HP;
    const maxHp = cfg.maxHp != null ? maxHpRaw : scaleHp(maxHpRaw);
    return {
      playerNum,
      isBot,
      isAi,
      aiDifficulty: isAi
        ? normalizeAiDifficulty(cfg.aiDifficulty)
        : null,
      team: cfg.team || "human",
      fightTeam: cfg.isBot ? "bot" : cfg.fightTeam || "a",
      damageMultiplier: cfg.damageMultiplier != null ? cfg.damageMultiplier : 1,
      maxHp,
      x: cfg.spawn[0],
      y: cfg.spawn[1],
      vx: 0,
      vy: 0,
      facing: 0,
      aimOverrideAngle: null,
      hp: maxHp,
      color: cfg.color,
      controls: cfg.controls || {},
      cooldown: 0,
      attackT: 0,
      hitFlash: 0,
      animPhase: Math.random() * Math.PI * 2,
      walkCycle: 0,
      squashX: 1,
      squashY: 1,
      lastHitSwingKey: "",
      swingId: 0,
      chargeT: 0,
      chargeHoldT: 0,
      stunT: 0,
      reaverRuinRootT: 0,
      reaverHookDisarmT: 0,
      needsRelease: false,
      botMustRelease: false,
      swingDamage: DAMAGE_MIN,
      swingKnockMul: 1,
      lastSwingChargeRatio: 0,
      characterId: charId,
      bossId: cfg.bossId != null ? cfg.bossId : null,
      isHordeBoss: !!cfg.isHordeBoss,
      hordeBossWave: cfg.hordeBossWave != null ? cfg.hordeBossWave : 0,
      attackStyle:
        cfg.attackStyle != null ? cfg.attackStyle : def.attackStyle,
      moveSpeedMul: isBot ? 1 : def.moveSpeedMul || 1,
      hitRadius: isBot
        ? PLAYER_R * BOSS_RADIUS_MUL
        : PLAYER_R * (def.hitRadiusMul != null ? def.hitRadiusMul : 1),
      attackDamageMul: isBot ? 1 : def.attackDamageMul || 1,
      chargeSpeedMul: isBot
        ? cfg.chargeSpeedMul != null
          ? cfg.chargeSpeedMul
          : 1
        : def.chargeSpeedMul || 1,
      knockbackResistMul: isBot ? 1 : def.knockbackResistMul || 1,
      rangedRangeMul:
        def.attackStyle === "ranged" ? def.rangedRangeMul || 1 : 1,
      spreadRangeMul:
        def.attackStyle === "spread" ? def.spreadRangeMul || 1 : 1,
      novaRangeMul: def.attackStyle === "nova" ? def.novaRangeMul || 1 : 1,
      downed: false,
      eliminated: false,
      spawnHomeX: cfg.spawn[0],
      spawnHomeY: cfg.spawn[1],
      lives: isBot ? 0 : readLivesPerPlayer(),
      maxLives: isBot ? 0 : readLivesPerPlayer(),
      respawnT: 0,
      respawnInvulnT: 0,
      downBleedT: 0,
      supportChannelT: 0,
      supportTargetNum: null,
      poundCd: isBot
        ? cfg.bossPoundInitialCd != null
          ? cfg.bossPoundInitialCd
          : 2.2
        : 0,
      poundWindup: 0,
      poundBlastT: 0,
      poundSwingId: 0,
      seismicSlamT: 0,
      seismicSlamX: 0,
      seismicSlamY: 0,
      beamCd: isBot
        ? cfg.bossBeamInitialCd != null
          ? cfg.bossBeamInitialCd
          : 3.5
        : 0,
      beamWindup: 0,
      beamActiveT: 0,
      beamFacing: 0,
      beamSweepDir: 0,
      beamSwingId: 0,
      bossMoveSpeedMul:
        cfg.bossMoveSpeedMul != null ? cfg.bossMoveSpeedMul : BOSS_MOVE_SPEED_MUL,
      bossPoundCooldown:
        cfg.bossPoundCooldown != null ? cfg.bossPoundCooldown : POUND_COOLDOWN,
      bossBeamCooldown:
        cfg.bossBeamCooldown != null ? cfg.bossBeamCooldown : BOSS_BEAM_COOLDOWN,
      bossPartySize: cfg.partySize != null ? cfg.partySize : 0,
      dashT: 0,
      dashDist: 0,
      dashTraveled: 0,
      dashSpeed: 0,
      dashDirX: 0,
      dashDirY: 0,
      dashTotalT: 0,
      dashHitLanded: false,
      dashPerfectLanded: false,
      dashEndX: 0,
      dashEndY: 0,
      aiAimError: 0,
      aiChargeGoal: 0,
      attackHoldT: 0,
      laserAiCd:
        isAi && def.attackStyle === "beam"
          ? LASER_AI_START_DELAY * (0.88 + Math.random() * 0.28)
          : 0,
      laserBeamBurstT: 0,
      phoenixReviving: false,
      phoenixReviveT: 0,
      phoenixReviveInterrupted: false,
      phoenixReviveStacks: 0,
      phoenixReviveBuffT: 0,
      phoenixRebirthArmedT: 0,
      phoenixRebirthDmgBonus: 0,
      phoenixDashShotsFired: false,
      reaverRuinCd: isBot && cfg.bossId === "reaver" ? 3.5 : 0,
      reaverRuinWindup: 0,
      reaverRuinBlastT: 0,
      reaverRuinSwingId: 0,
      reaverHookCd: isBot && cfg.bossId === "reaver" ? 4.5 : 0,
      reaverHookWindup: 0,
      reaverHookActive: false,
      reaverHookLen: 0,
      reaverHookFacing: 0,
      reaverHookPullT: 0,
      reaverHookTargetNum: null,
      reaverHookMissT: 0,
      reaverHookSwingId: 0,
      reaverGraspWindup: 0,
      reaverGraspActiveT: 0,
      reaverGraspTargetNum: null,
      reaverGraspSwingId: 0,
      hexBottleCd:
        isBot && cfg.bossId === "hexwright"
          ? cfg.hexBottleInitialCd != null
            ? cfg.hexBottleInitialCd
            : 2
          : 0,
      hexBottleWindup: 0,
      hexSummonCd:
        isBot && cfg.bossId === "hexwright"
          ? cfg.hexSummonInitialCd != null
            ? cfg.hexSummonInitialCd
            : 3.5
          : 0,
      hexSummonWindup: 0,
      hexTeleportCd:
        isBot && cfg.bossId === "hexwright"
          ? cfg.hexTeleportInitialCd != null
            ? cfg.hexTeleportInitialCd
            : 3
          : 0,
      hexTeleportWindup: 0,
      hexTeleportBlastT: 0,
      beamActive: false,
      beamSessionId: 0,
      beamFacing: null,
      beamWindupT: 0,
      beamFiring: false,
      beamHitAny: false,
      beamMaxDwellMul: 1,
      ultCd: isBot ? 0 : ultimateBaseCdFor({ characterId: charId }),
      ultActiveT: 0,
      ultLaserT: 0,
      ultDamageResistT: 0,
      novaChaosKnockT: 0,
      ultDmgMulT: 0,
      grapplerChargeBoostT: 0,
      grapplerHookActive: false,
      grapplerHookLen: 0,
      grapplerHookFacing: 0,
      grapplerHookPullT: 0,
      grapplerHookTargetKind: null,
      grapplerHookTargetId: null,
      grapplerHookMissT: 0,
      grapplerHookSwingId: 0,
      siphonUltPullT: 0,
      siphonUltShockPending: false,
      siphonPhaseT: 0,
      siphonShockVfxT: 0,
      siphonShockX: 0,
      siphonShockY: 0,
      siphonShotCount: 0,
      chargeSlowT: 0,
      chargeSlowMul: 1,
      ultDashChain: 0,
      ultKeyWasDown: false,
      ultFlashT: 0,
      dashDamageMul: 1,
      bulwarkAuraUlt: false,
      barrage: null,
    };
  }

  function nearestHumanDist(p) {
    let best = Infinity;
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.isBot || pl.hp <= 0) continue;
      const d = len(pl.x - p.x, pl.y - p.y);
      if (d < best) best = d;
    }
    return best;
  }

  function isBoss(p) {
    return !!p.isBot;
  }

  function isReaverBoss(p) {
    return !!p.isBot && p.bossId === "reaver";
  }

  function isHexwrightBoss(p) {
    return !!p.isBot && p.bossId === "hexwright";
  }

  function hexwrightMaxMinions(boss) {
    const party = boss.bossPartySize || 1;
    return HEX_MINION_CAP + Math.min(3, party - 1);
  }

  function hexwrightKiteAxes(p, dx, dy, dist) {
    if (dist < 1e-3) return { ix: 0, iy: 0 };
    const ux = dx / dist;
    const uy = dy / dist;
    let ix = 0;
    let iy = 0;
    if (dist < HEX_KITE_DIST_MIN) {
      const push = clamp((HEX_KITE_DIST_MIN - dist) / HEX_KITE_DIST_MIN, 0.4, 1);
      ix = -ux * push;
      iy = -uy * push;
    } else if (dist > HEX_KITE_DIST_MAX) {
      const pull = clamp((dist - HEX_KITE_DIST_MAX) / 140, 0.3, 0.8);
      ix = ux * pull;
      iy = uy * pull;
    } else {
      const err = dist - HEX_KITE_DIST_IDEAL;
      const radial = clamp(-err / (HEX_KITE_DIST_MAX - HEX_KITE_DIST_MIN), -0.4, 0.4);
      const sn = Math.sin(performance.now() * 0.0035 + p.x * 0.008) > 0 ? 1 : -1;
      ix = -uy * sn * 0.75 + -ux * radial;
      iy = ux * sn * 0.75 + -uy * radial;
    }
    return { ix: ix, iy: iy };
  }

  function spawnToxicPuddle(x, y, dmgMul) {
    mapRuntime.toxicPuddles.push({
      x: x,
      y: y,
      r: HEX_PUDDLE_RADIUS,
      duration: HEX_PUDDLE_DURATION,
      dps: HEX_PUDDLE_DPS * (dmgMul || 1),
      slowMul: HEX_PUDDLE_SLOW_MUL,
      splashT: 0.28,
    });
  }

  function pickHexwrightTeleportDest(boss) {
    const r = getPlayerRadius(boss);
    const pad = r + 8;
    const target = nearestHumanForMinion(boss.x, boss.y);
    let awayUx = Math.cos(boss.facing + Math.PI);
    let awayUy = Math.sin(boss.facing + Math.PI);
    let nowD = 0;
    if (target) {
      const dx = boss.x - target.x;
      const dy = boss.y - target.y;
      nowD = len(dx, dy);
      if (nowD > 1e-3) {
        awayUx = dx / nowD;
        awayUy = dy / nowD;
      }
    }
    const awayAng = Math.atan2(awayUy, awayUx);
    const awayCone = Math.PI * 0.42;
    let bestPt = null;
    let bestHeroDist = -1;

    for (let t = 0; t < 32; t++) {
      const ang = awayAng + (Math.random() - 0.5) * awayCone;
      const dist =
        HEX_TELEPORT_DIST_MIN +
        Math.random() * (HEX_TELEPORT_DIST_MAX - HEX_TELEPORT_DIST_MIN);
      const tx = boss.x + Math.cos(ang) * dist;
      const ty = boss.y + Math.sin(ang) * dist;
      const pt = clampPointToArena(tx, ty, pad);
      if (pointBlockedForCreature(pt.x, pt.y, r)) continue;

      const mvx = pt.x - boss.x;
      const mvy = pt.y - boss.y;
      const moveLen = len(mvx, mvy);
      if (moveLen < HEX_TELEPORT_DIST_MIN * 0.65) continue;
      if (mvx * awayUx + mvy * awayUy < moveLen * 0.6) continue;

      if (target) {
        const toHero = len(pt.x - target.x, pt.y - target.y);
        if (toHero < nowD + 28) continue;
        if (toHero > bestHeroDist) {
          bestHeroDist = toHero;
          bestPt = pt;
        }
      } else {
        return pt;
      }
    }

    if (bestPt) return bestPt;

    return clampPointToArena(
      boss.x + awayUx * HEX_TELEPORT_DIST_MAX,
      boss.y + awayUy * HEX_TELEPORT_DIST_MAX,
      pad
    );
  }

  function executeHexwrightTeleport(boss) {
    const ox = boss.x;
    const oy = boss.y;
    spawnToxicPuddle(ox, oy, boss.damageMultiplier || 1);
    const dest = pickHexwrightTeleportDest(boss);
    boss.x = dest.x;
    boss.y = dest.y;
    boss.vx = 0;
    boss.vy = 0;
    boss.hexTeleportBlastT = HEX_TELEPORT_VFX;
    boss.hexTeleportCd = HEX_TELEPORT_COOLDOWN;
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.cooldown = Math.max(boss.cooldown, 0.35);
    const target = nearestHumanForMinion(boss.x, boss.y);
    if (target) {
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      if (len(dx, dy) > 1e-3) boss.facing = Math.atan2(dy, dx);
    }
  }

  function throwHexwrightBottle(boss, ang) {
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const r = getPlayerRadius(boss);
    mapRuntime.bossBottles.push({
      x: boss.x + cx * (r + 12),
      y: boss.y + cy * (r + 12),
      vx: cx * HEX_BOTTLE_SPEED,
      vy: cy * HEX_BOTTLE_SPEED,
      r: 8,
      traveled: 0,
      maxDist: HEX_BOTTLE_RANGE,
      dmgMul: boss.damageMultiplier || 1,
    });
  }

  function updateBossBottles(dt) {
    const list = mapRuntime.bossBottles;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      const spd = len(b.vx, b.vy);
      if (spd < 1e-3) {
        spawnToxicPuddle(b.x, b.y, b.dmgMul);
        list.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += spd * dt;
      let land = false;
      if (!isInsideArena(b.x, b.y, b.r)) land = true;
      const ux = b.vx / spd;
      const uy = b.vy / spd;
      const wallDist = rayDistToArenaWall(b.x, b.y, ux, uy, b.r);
      const maxTravel =
        wallDist > 1e-3 ? Math.min(b.maxDist, wallDist) : b.maxDist;
      if (b.traveled >= maxTravel) {
        land = true;
      }
      if (pointBlockedForCreature(b.x, b.y, b.r)) land = true;
      const obsRes = resolveObstacleCollision(b.x, b.y, b.vx, b.vy, b.r);
      b.x = obsRes.x;
      b.y = obsRes.y;
      if (land) {
        spawnToxicPuddle(b.x, b.y, b.dmgMul);
        list.splice(i, 1);
      }
    }
  }

  function updateToxicPuddles(dt) {
    const list = mapRuntime.toxicPuddles;
    for (let i = list.length - 1; i >= 0; i--) {
      const pool = list[i];
      pool.duration -= dt;
      pool.splashT = Math.max(0, (pool.splashT || 0) - dt);
      if (pool.duration <= 0) {
        list.splice(i, 1);
        continue;
      }
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (p.isBot || p.hp <= 0) continue;
        if (len(p.x - pool.x, p.y - pool.y) > pool.r + getPlayerRadius(p)) {
          continue;
        }
        const tickDmg = pool.dps * dt;
        if (tickDmg > 1e-6) {
          applyDamageTo(p, null, tickDmg, {
            hitFlash: 0.06,
            skipRicochetReflect: true,
          });
        }
      }
    }
  }

  function pickBossMinionSpawn(boss) {
    for (let t = 0; t < 40; t++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = getPlayerRadius(boss) + 36 + Math.random() * 48;
      const x = boss.x + Math.cos(ang) * dist;
      const y = boss.y + Math.sin(ang) * dist;
      const pt = clampPointToArena(x, y, HEX_MINION_RADIUS + 4);
      if (pointBlockedForCreature(pt.x, pt.y, HEX_MINION_RADIUS)) continue;
      let ok = true;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.hp <= 0) continue;
        if (len(pt.x - p.x, pt.y - p.y) < getPlayerRadius(p) + HEX_MINION_RADIUS + 16) {
          ok = false;
          break;
        }
      }
      if (ok) return pt;
    }
    return clampPointToArena(
      boss.x + (Math.random() - 0.5) * 60,
      boss.y + (Math.random() - 0.5) * 60,
      HEX_MINION_RADIUS
    );
  }

  function spawnBossMinion(boss) {
    const pt = pickBossMinionSpawn(boss);
    const mul = boss.damageMultiplier || 1;
    mapRuntime.bossMinions.push({
      id: mapRuntime.bossMinionNextId++,
      x: pt.x,
      y: pt.y,
      vx: 0,
      vy: 0,
      r: HEX_MINION_RADIUS,
      hp: scaleHp(Math.round(HEX_MINION_HP * (0.88 + mul * 0.08))),
      maxHp: scaleHp(Math.round(HEX_MINION_HP * (0.88 + mul * 0.08))),
      speed: HEX_MINION_SPEED,
      touchDamage: scaleDmg(HEX_MINION_TOUCH * mul),
      color: "#4ade80",
      hitFlash: 0,
      touchCd: Object.create(null),
      spawnFlash: 0.35,
    });
    spawnPopBurst(pt.x, pt.y, "#4ade80");
  }

  function summonHexwrightThralls(boss) {
    const cap = hexwrightMaxMinions(boss);
    const list = mapRuntime.bossMinions;
    const need = Math.min(2, cap - list.length);
    for (let i = 0; i < need; i++) {
      if (list.length >= cap) break;
      spawnBossMinion(boss);
    }
  }

  function nearestHumanForMinion(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.isBot || p.hp <= 0) continue;
      const d = len(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function resolveBossMinionWall(m) {
    let res = resolveArenaBoundary(m.x, m.y, m.vx, m.vy, m.r);
    res = resolveObstacleCollision(res.x, res.y, res.vx, res.vy, m.r);
    m.x = res.x;
    m.y = res.y;
    m.vx = res.vx;
    m.vy = res.vy;
  }

  function separateBossMinionsFromFighters() {
    const list = mapRuntime.bossMinions;
    if (!list.length) return;
    for (let pass = 0; pass < 4; pass++) {
      for (let mi = 0; mi < list.length; mi++) {
        const m = list[mi];
        if (m.hp <= 0) continue;
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.hp <= 0) continue;
          if (isSiphonPhasing(p)) continue;
          const minD = m.r + getPlayerRadius(p);
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.55;
          m.x += nx * push;
          m.y += ny * push;
          if (!p.isBot) {
            p.x -= nx * push * 0.45;
            p.y -= ny * push * 0.45;
          }
        }
        for (let mj = mi + 1; mj < list.length; mj++) {
          const o = list[mj];
          if (o.hp <= 0) continue;
          const minD = m.r + o.r;
          const dx = o.x - m.x;
          const dy = o.y - m.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            nx = 1;
            ny = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.5;
          m.x -= nx * push;
          m.y -= ny * push;
          o.x += nx * push;
          o.y += ny * push;
        }
        resolveBossMinionWall(m);
      }
    }
  }

  function updateBossMinions(dt) {
    removeDeadBossMinions();
    const list = mapRuntime.bossMinions;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.hp <= 0) {
        list.splice(i, 1);
        continue;
      }
      m.hitFlash = Math.max(0, (m.hitFlash || 0) - dt);
      m.spawnFlash = Math.max(0, (m.spawnFlash || 0) - dt);
      const keys = Object.keys(m.touchCd);
      for (let k = 0; k < keys.length; k++) {
        m.touchCd[keys[k]] = Math.max(0, m.touchCd[keys[k]] - dt);
      }
      const target = nearestHumanForMinion(m.x, m.y);
      if (target) {
        const dx = target.x - m.x;
        const dy = target.y - m.y;
        const d = len(dx, dy);
        if (d > 1e-3) {
          m.vx = (dx / d) * m.speed;
          m.vy = (dy / d) * m.speed;
        }
      } else {
        m.vx *= 0.9;
        m.vy *= 0.9;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      resolveBossMinionWall(m);
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (p.isBot || p.hp <= 0) continue;
        if (isSiphonPhasing(p)) continue;
        const key = String(p.playerNum);
        if ((m.touchCd[key] || 0) > 0) continue;
        if (len(p.x - m.x, p.y - m.y) >= m.r + getPlayerRadius(p)) continue;
        applyDamageTo(p, null, m.touchDamage, {
          hitFlash: 0.1,
          knockFrom: m,
          knockMul: 0.032,
          skipRicochetReflect: true,
        });
        m.touchCd[key] = CREATURE_TOUCH_COOLDOWN;
      }
    }
  }

  function damageBossMinion(m, dmg, knockFrom) {
    dmg = scaleDmg(dmg);
    if (m.hp <= 0) return 0;
    const hpBefore = m.hp;
    m.hp = Math.max(0, m.hp - dmg);
    const dealt = hpBefore - m.hp;
    m.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(m.x, m.y, m.color || "#6ee7b7", 5);
    }
    if (knockFrom && knockFrom.playerNum != null) {
      grantUltimateMinionCharge(knockFrom, dealt);
    }
    if (knockFrom && dmg > 0) {
      const dx = m.x - knockFrom.x;
      const dy = m.y - knockFrom.y;
      const n = norm(dx, dy);
      m.x += n.x * 4;
      m.y += n.y * 4;
    }
    if (m.hp <= 0) {
      spawnPopBurst(m.x, m.y, m.color || "#6ee7b7");
      removeDeadBossMinions();
    }
    return dealt;
  }

  function removeDeadBossMinions() {
    const list = mapRuntime.bossMinions;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].hp <= 0) list.splice(i, 1);
    }
  }

  function bossMinionMeleeHit(attacker, m) {
    if (attacker.attackT <= 0 || attacker.hp <= 0 || m.hp <= 0) return false;
    if (isBulwarkAuraSwing(attacker)) {
      const ratio = attacker.lastSwingChargeRatio;
      const radius = auraRadiusForPlayer(attacker, ratio);
      return len(m.x - attacker.x, m.y - attacker.y) <= radius + m.r;
    }
    if (
      attacker.attackStyle === "ranged" ||
      attacker.attackStyle === "spread" ||
      attacker.attackStyle === "nova" ||
      attacker.attackStyle === "barrage" ||
      attacker.attackStyle === "dash" ||
      attacker.attackStyle === "phoenix" ||
      attacker.attackStyle === "bounce" ||
      attacker.attackStyle === "beam"
    ) {
      return false;
    }
    const ratio = attacker.lastSwingChargeRatio;
    if (attacker.attackStyle === "lance") {
      return lanceCorridorHit(attacker, m.x, m.y, m.r);
    }
    const range = attackSectorRange(attacker, ratio);
    const arc = attackSectorArc(attacker, ratio);
    const dx = m.x - attacker.x;
    const dy = m.y - attacker.y;
    const d = len(dx, dy);
    if (d > range + m.r) return false;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, attacker.facing)) > arc * 0.5) return false;
    return true;
  }

  function tryHitBossMinions(attacker) {
    if (gameOver || attacker.hp <= 0 || attacker.attackT <= 0) return;
    const list = mapRuntime.bossMinions;
    const swingKey = attacker.playerNum + ":bm:" + attacker.swingId;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.hp <= 0) continue;
      if (m.lastHitSwingKey === swingKey) continue;
      if (!bossMinionMeleeHit(attacker, m)) continue;
      m.lastHitSwingKey = swingKey;
      const dmg =
        isBulwarkAuraSwing(attacker)
          ? Math.max(2, attacker.swingDamage * 0.35)
          : Math.max(
              3,
              meleeSwingDamageForTarget(attacker, m.x, m.y) * 0.45
            );
      damageBossMinion(m, dmg, attacker);
    }
  }

  function tryProjectileHitBossMinions(pr, owner, consumeOnHit) {
    if (!owner) return false;
    const list = mapRuntime.bossMinions;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.hp <= 0) continue;
      if (len(m.x - pr.x, m.y - pr.y) > pr.r + m.r) continue;
      const swingKey =
        pr.ownerNum + ":bpm:" + pr.swingId + ":" + (pr.pelletIdx != null ? pr.pelletIdx : 0);
      if (m.lastHitSwingKey === swingKey) continue;
      m.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: m.x, y: m.y });
      const dealt = Math.max(2, boltDmg * 0.55);
      damageBossMinion(m, dealt, owner);
      return consumeOnHit !== false;
    }
    return false;
  }

  function getEchoSummonOwner(s) {
    return players.find((pl) => pl.playerNum === s.ownerNum) || null;
  }

  function echoSummonOwnerAlive(owner) {
    if (!owner) return false;
    if (owner.eliminated) return false;
    if ((owner.respawnT || 0) > 0) return false;
    if (gameMode === "horde") return isHordeHeroActive(owner);
    return owner.hp > 0;
  }

  function resolveEchoSummonWall(s) {
    let res = resolveArenaBoundary(s.x, s.y, s.vx, s.vy, s.r);
    res = resolveObstacleCollision(res.x, res.y, res.vx, res.vy, s.r);
    s.x = res.x;
    s.y = res.y;
    s.vx = res.vx;
    s.vy = res.vy;
  }

  function damageEchoSummon(s, dmg, knockFrom) {
    dmg = scaleDmg(dmg);
    if (s.hp <= 0 || dmg <= 0) return 0;
    const hpBefore = s.hp;
    s.hp = Math.max(0, s.hp - dmg);
    const dealt = hpBefore - s.hp;
    s.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(s.x, s.y, s.color || "#c4f542", 4);
    }
    if (knockFrom && knockFrom.playerNum != null) {
      grantUltimateMinionCharge(knockFrom, dealt);
    }
    if (knockFrom) {
      const n = norm(s.x - knockFrom.x, s.y - knockFrom.y);
      s.x += n.x * 5;
      s.y += n.y * 5;
    }
    if (s.hp <= 0) {
      spawnPopBurst(s.x, s.y, s.color || "#c4f542");
      removeDeadEchoSummons();
    }
    return dealt;
  }

  function removeDeadEchoSummons() {
    const list = mapRuntime.echoSummons;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].hp <= 0) list.splice(i, 1);
    }
  }

  function echoSummonCanHurtPlayer(owner, target) {
    if (!owner || !target) return false;
    return fightersCanDamage(owner, target);
  }

  function echoSummonChargeRatio(s) {
    if ((s.attackT || 0) > 0) {
      return clamp(
        s.lastSwingChargeRatio != null ? s.lastSwingChargeRatio : 0,
        0,
        1
      );
    }
    if ((s.chargeT || 0) <= 0) return 0;
    return clamp(s.chargeT / MAX_CHARGE, 0, 1);
  }

  function echoSummonRangeForRatio(ratio) {
    const r = clamp(ratio != null ? ratio : 0, 0, 1);
    return (
      ECHO_SUMMON_RANGE_MIN +
      (ECHO_SUMMON_RANGE_MAX - ECHO_SUMMON_RANGE_MIN) * r
    );
  }

  function applyEchoSummonConeHits(s, owner) {
    if ((s.attackT || 0) <= 0 || !owner) return;
    const range = echoSummonRangeForRatio(s.lastSwingChargeRatio);
    const swingKey =
      owner.playerNum + ":echo:" + s.id + ":" + s.swingId;
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (!echoSummonCanHurtPlayer(owner, t)) continue;
      if (t.lastHitSwingKey === swingKey) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = len(dx, dy);
      if (d > range + getPlayerRadius(t)) continue;
      if (d > 4) {
        const ad = Math.abs(angleDiff(Math.atan2(dy, dx), s.facing));
        if (ad > ECHO_SUMMON_ARC * 0.5) continue;
      }
      t.lastHitSwingKey = swingKey;
      applyDamageTo(t, owner, ECHO_SUMMON_DAMAGE, {
        hitFlash: 0.14,
        swingKey: swingKey,
        knockFrom: s,
        knockMul: ECHO_SUMMON_KNOCK_MUL,
      });
    }
    if (gameMode === "horde") {
      const list = mapRuntime.waveEnemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.hp <= 0) continue;
        if (e.lastHitSwingKey === swingKey) continue;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const d = len(dx, dy);
        if (d > range + e.r) continue;
        if (d > 4) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), s.facing));
          if (ad > ECHO_SUMMON_ARC * 0.5) continue;
        }
        e.lastHitSwingKey = swingKey;
        damageWaveEnemy(e, ECHO_SUMMON_DAMAGE, s);
      }
      if (hordeBossWaveActive()) {
        const boss = getHordeBossPlayer();
        if (boss && echoSummonCanHurtPlayer(owner, boss)) {
          if (boss.lastHitSwingKey !== swingKey) {
            const dx = boss.x - s.x;
            const dy = boss.y - s.y;
            const d = len(dx, dy);
            if (d <= range + getPlayerRadius(boss)) {
              const ad =
                d > 4
                  ? Math.abs(angleDiff(Math.atan2(dy, dx), s.facing))
                  : 0;
              if (ad <= ECHO_SUMMON_ARC * 0.5) {
                boss.lastHitSwingKey = swingKey;
                applyDamageTo(boss, owner, ECHO_SUMMON_DAMAGE, {
                  hitFlash: 0.14,
                  swingKey: swingKey,
                  knockFrom: s,
                  knockMul: 0.05,
                });
              }
            }
          }
        }
      }
    }
    if (mapHasCreatures()) {
      const clist = mapRuntime.creatures;
      for (let i = 0; i < clist.length; i++) {
        const c = clist[i];
        if (c.hp <= 0) continue;
        if (c.lastHitSwingKey === swingKey) continue;
        const dx = c.x - s.x;
        const dy = c.y - s.y;
        const d = len(dx, dy);
        if (d > range + c.r) continue;
        if (d > 4) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), s.facing));
          if (ad > ECHO_SUMMON_ARC * 0.5) continue;
        }
        c.lastHitSwingKey = swingKey;
        damageCreature(c, ECHO_SUMMON_DAMAGE, s);
      }
      removeDeadCreatures();
    }
    if (gameMode === "boss" || hordeBossWaveActive()) {
      const mlist = mapRuntime.bossMinions;
      for (let i = 0; i < mlist.length; i++) {
        const m = mlist[i];
        if (m.hp <= 0) continue;
        if (m.lastHitSwingKey === swingKey) continue;
        const dx = m.x - s.x;
        const dy = m.y - s.y;
        const d = len(dx, dy);
        if (d > range + m.r) continue;
        if (d > 4) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), s.facing));
          if (ad > ECHO_SUMMON_ARC * 0.5) continue;
        }
        m.lastHitSwingKey = swingKey;
        damageBossMinion(m, ECHO_SUMMON_DAMAGE, s);
      }
    }
  }

  function updateEchoSummons(dt) {
    removeDeadEchoSummons();
    const list = mapRuntime.echoSummons;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const owner = getEchoSummonOwner(s);
      if (!echoSummonOwnerAlive(owner) || s.hp <= 0) {
        list.splice(i, 1);
        continue;
      }
      if (s.life != null) {
        s.life = Math.max(0, s.life - dt);
        if (s.life <= 0) {
          spawnPopBurst(s.x, s.y, s.color || "rgba(129,140,248,1)");
          list.splice(i, 1);
          continue;
        }
      }
      s.hitFlash = Math.max(0, (s.hitFlash || 0) - dt);
      s.spawnFlash = Math.max(0, (s.spawnFlash || 0) - dt);
      s.attackT = Math.max(0, (s.attackT || 0) - dt);

      const ownerSpeed =
        MOVE_SPEED * (owner.moveSpeedMul != null ? owner.moveSpeedMul : 1);
      const tx = owner.x + Math.cos(s.orbitAng) * ECHO_SUMMON_ORBIT;
      const ty = owner.y + Math.sin(s.orbitAng) * ECHO_SUMMON_ORBIT;
      const toX = tx - s.x;
      const toY = ty - s.y;
      const fd = len(toX, toY);
      let formVx = 0;
      let formVy = 0;
      if (fd > 2) {
        const formSpeed = Math.min(ownerSpeed * 1.2, fd * 7);
        formVx = (toX / fd) * formSpeed;
        formVy = (toY / fd) * formSpeed;
      }
      s.vx = owner.vx * 0.7 + formVx * 0.55;
      s.vy = owner.vy * 0.7 + formVy * 0.55;
      const spd = len(s.vx, s.vy);
      if (spd > ownerSpeed && spd > 1e-4) {
        s.vx = (s.vx / spd) * ownerSpeed;
        s.vy = (s.vy / spd) * ownerSpeed;
      }
      s.facing = owner.facing;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      resolveEchoSummonWall(s);

      if ((s.attackT || 0) <= 0) {
        s.chargeT = owner.chargeT || 0;
      }

      if ((owner.swingId || 0) !== (s.lastCopiedSwingId || 0)) {
        s.lastCopiedSwingId = owner.swingId || 0;
        s.swingId = (s.swingId || 0) + 1;
        s.lastSwingChargeRatio = clamp(
          owner.lastSwingChargeRatio != null
            ? owner.lastSwingChargeRatio
            : (s.chargeT || 0) / MAX_CHARGE,
          0,
          1
        );
        s.attackT = ECHO_SUMMON_ATTACK_ACTIVE;
        s.chargeT = 0;
      }
      applyEchoSummonConeHits(s, owner);
    }
  }

  function tryHitEchoSummons(attacker) {
    if (attacker.hp <= 0 || attacker.attackT <= 0) return;
    if (
      !isBulwarkAuraSwing(attacker) &&
      (attacker.attackStyle === "ranged" ||
        attacker.attackStyle === "spread" ||
        attacker.attackStyle === "nova" ||
        attacker.attackStyle === "barrage" ||
        attacker.attackStyle === "dash" ||
        attacker.attackStyle === "phoenix" ||
        attacker.attackStyle === "bounce" ||
        attacker.attackStyle === "beam")
    ) {
      return;
    }
    const list = mapRuntime.echoSummons;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      const owner = getEchoSummonOwner(s);
      if (owner && !fightersCanDamage(attacker, owner)) continue;
      if (attacker.playerNum === s.ownerNum) continue;
      let hit = false;
      if (isBulwarkAuraSwing(attacker)) {
        const ratio = attacker.lastSwingChargeRatio;
        const radius = auraRadiusForPlayer(attacker, ratio);
        hit = len(s.x - attacker.x, s.y - attacker.y) <= radius + s.r;
      } else if (attacker.attackStyle === "lance") {
        hit = lanceCorridorHit(attacker, s.x, s.y, s.r);
      } else {
        const dx = s.x - attacker.x;
        const dy = s.y - attacker.y;
        const d = len(dx, dy);
        const ratio = attacker.lastSwingChargeRatio;
        const range = attackSectorRange(attacker, ratio);
        const arc = attackSectorArc(attacker, ratio);
        if (d <= range + s.r) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), attacker.facing));
          hit = ad <= arc * 0.5 || d < 8;
        }
      }
      if (!hit) continue;
      const swingKey = attacker.playerNum + ":es:" + attacker.swingId;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      damageEchoSummon(
        s,
        meleeSwingDamageForTarget(attacker, s.x, s.y),
        attacker
      );
    }
  }

  function tryProjectileHitEchoSummons(pr, owner, consumeOnHit) {
    if (!owner) return false;
    const list = mapRuntime.echoSummons;
    let hit = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      if (s.ownerNum === pr.ownerNum) continue;
      const summonOwner = getEchoSummonOwner(s);
      if (summonOwner && !fightersCanDamage(owner, summonOwner)) continue;
      if (len(s.x - pr.x, s.y - pr.y) > pr.r + s.r) continue;
      const swingKey =
        pr.ownerNum +
        ":pe:" +
        pr.swingId +
        ":" +
        (pr.pelletIdx != null ? pr.pelletIdx : 0) +
        ":" +
        s.id;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: s.x, y: s.y });
      const dealt = Math.max(2, boltDmg * 0.7);
      damageEchoSummon(s, dealt, owner);
      hit = true;
      if (consumeOnHit !== false) return true;
    }
    return hit && consumeOnHit !== false;
  }

  function tryDashHitEchoSummons(attacker) {
    if (!isDashing(attacker) || attacker.hp <= 0) return;
    const list = mapRuntime.echoSummons;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.hp <= 0) continue;
      if (s.ownerNum === attacker.playerNum) continue;
      const summonOwner = getEchoSummonOwner(s);
      if (summonOwner && !fightersCanDamage(attacker, summonOwner)) continue;
      if (len(s.x - attacker.x, s.y - attacker.y) > getPlayerRadius(attacker) + s.r + DASH_HIT_PAD) {
        continue;
      }
      const swingKey = attacker.playerNum + ":eds:" + attacker.swingId;
      if (s.lastHitSwingKey === swingKey) continue;
      s.lastHitSwingKey = swingKey;
      damageEchoSummon(
        s,
        attacker.swingDamage * DASH_DAMAGE_IMPERFECT_MUL * dashMul,
        attacker
      );
      attacker.dashHitLanded = true;
      healFromStrikerUltHit(attacker);
    }
  }

  function drawEchoSummons() {
    const list = mapRuntime.echoSummons;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.hp <= 0) continue;
      const flash = (s.hitFlash || 0) > 0;
      const spawn = (s.spawnFlash || 0) > 0;
      const bob = Math.sin(performance.now() * 0.012 + (s.id || i) * 0.9) * 1.8;
      const shimmer =
        0.72 +
        0.18 * Math.sin(performance.now() * 0.02 + (s.id || i));
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(s.facing);
      const lifeFrac =
        s.maxLife > 1e-3 && s.life != null
          ? clamp(s.life / s.maxLife, 0, 1)
          : 1;
      const lifeFade = lifeFrac < 0.28 ? 0.45 + 0.55 * (lifeFrac / 0.28) : 1;
      ctx.globalAlpha =
        (spawn
          ? 0.55 + 0.35 * (s.spawnFlash / 0.4)
          : shimmer) * lifeFade;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#ffffff" : s.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Lightweight hands so Echo clones match fighters.
      const handR = Math.max(3.5, s.r * 0.26);
      for (let h = 0; h < 2; h++) {
        const side = h === 0 ? -1 : 1;
        const attacking = (s.attackT || 0) > 0;
        const fx = s.r * (attacking ? 0.95 : 0.4);
        const fy = side * s.r * (attacking ? 0.45 : 0.8);
        ctx.beginPath();
        ctx.moveTo(s.r * 0.12, side * s.r * 0.5);
        ctx.lineTo(fx, fy);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy, handR, 0, Math.PI * 2);
        ctx.fillStyle = flash ? "#ffffff" : s.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.moveTo(s.r - 3, 0);
      ctx.lineTo(s.r * 0.3, 5);
      ctx.lineTo(s.r * 0.3, -5);
      ctx.closePath();
      ctx.fill();
      if ((s.attackT || 0) > 0) {
        const range = echoSummonRangeForRatio(s.lastSwingChargeRatio);
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -ECHO_SUMMON_ARC * 0.5, ECHO_SUMMON_ARC * 0.5);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
      } else if ((s.chargeT || 0) > 0) {
        const ratio = echoSummonChargeRatio(s);
        const range = echoSummonRangeForRatio(ratio);
        ctx.globalAlpha = 0.12 + 0.22 * ratio;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -ECHO_SUMMON_ARC * 0.5, ECHO_SUMMON_ARC * 0.5);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.globalAlpha = 0.35 + 0.4 * ratio;
        ctx.beginPath();
        ctx.arc(0, 0, s.r + 4 + ratio * 8, 0, Math.PI * 2);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5 + ratio;
        ctx.stroke();
      }
      ctx.restore();
      const hpFrac = s.maxHp > 0 ? clamp(s.hp / s.maxHp, 0, 1) : 0;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(s.x - s.r, s.y + s.r + 3 + bob, s.r * 2, 3);
      ctx.fillStyle = "rgba(196, 245, 66, 0.85)";
      ctx.fillRect(s.x - s.r, s.y + s.r + 3 + bob, s.r * 2 * hpFrac, 3);
      ctx.restore();
    }
  }

  /** Siege — stationary destructible base per team; loses respawns at 0 HP. */
  function siegeTeamColor(team) {
    return team === "b" ? SIEGE_TEAM_B_COLOR : SIEGE_TEAM_A_COLOR;
  }

  function damageBase(base, dmg, attacker) {
    dmg = scaleDmg(dmg);
    if (!base || base.destroyed || dmg <= 0) return 0;
    const hpBefore = base.hp;
    base.hp = Math.max(0, base.hp - dmg);
    const dealt = hpBefore - base.hp;
    base.hitFlash = 0.16;
    if (dealt > 0) {
      spawnHitSparks(base.x, base.y, siegeTeamColor(base.team), 6);
    }
    if (attacker && attacker.playerNum != null) {
      grantUltimateMinionCharge(attacker, dealt);
    }
    if (base.hp <= 0 && !base.destroyed) {
      base.destroyed = true;
      spawnPopBurst(base.x, base.y, siegeTeamColor(base.team));
      queueWinCheck();
    }
    return dealt;
  }

  function tryHitBase(attacker) {
    if (attacker.hp <= 0 || attacker.attackT <= 0) return;
    if (
      !isBulwarkAuraSwing(attacker) &&
      (attacker.attackStyle === "ranged" ||
        attacker.attackStyle === "spread" ||
        attacker.attackStyle === "nova" ||
        attacker.attackStyle === "barrage" ||
        attacker.attackStyle === "dash" ||
        attacker.attackStyle === "phoenix" ||
        attacker.attackStyle === "bounce" ||
        attacker.attackStyle === "beam")
    ) {
      return;
    }
    const list = mapRuntime.bases;
    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      if (base.destroyed || base.team === attacker.fightTeam) continue;
      let hit = false;
      if (isBulwarkAuraSwing(attacker)) {
        const ratio = attacker.lastSwingChargeRatio;
        const radius = auraRadiusForPlayer(attacker, ratio);
        hit = len(base.x - attacker.x, base.y - attacker.y) <= radius + base.r;
      } else if (attacker.attackStyle === "lance") {
        hit = lanceCorridorHit(attacker, base.x, base.y, base.r);
      } else {
        const dx = base.x - attacker.x;
        const dy = base.y - attacker.y;
        const d = len(dx, dy);
        const ratio = attacker.lastSwingChargeRatio;
        const range = attackSectorRange(attacker, ratio);
        const arc = attackSectorArc(attacker, ratio);
        if (d <= range + base.r) {
          const ad = Math.abs(angleDiff(Math.atan2(dy, dx), attacker.facing));
          hit = ad <= arc * 0.5 || d < 8;
        }
      }
      if (!hit) continue;
      const swingKey = attacker.playerNum + ":base:" + attacker.swingId;
      if (base.lastHitSwingKey === swingKey) continue;
      base.lastHitSwingKey = swingKey;
      damageBase(base, meleeSwingDamageForTarget(attacker, base.x, base.y), attacker);
    }
  }

  function tryProjectileHitBase(pr, owner, consumeOnHit) {
    if (!owner) return false;
    const list = mapRuntime.bases;
    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      if (base.destroyed || base.team === owner.fightTeam) continue;
      if (len(base.x - pr.x, base.y - pr.y) > pr.r + base.r) continue;
      const swingKey =
        pr.ownerNum +
        ":pb:" +
        pr.swingId +
        ":" +
        (pr.pelletIdx != null ? pr.pelletIdx : 0) +
        ":" +
        base.team;
      if (base.lastHitSwingKey === swingKey) continue;
      base.lastHitSwingKey = swingKey;
      const boltDmg = projectileBoltDamage(pr, { x: base.x, y: base.y });
      damageBase(base, boltDmg, owner);
      if (consumeOnHit !== false) return true;
    }
    return false;
  }

  function tryDashHitBase(attacker) {
    if (!isDashing(attacker) || attacker.hp <= 0) return;
    const list = mapRuntime.bases;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      if (base.destroyed || base.team === attacker.fightTeam) continue;
      if (
        len(base.x - attacker.x, base.y - attacker.y) >
        getPlayerRadius(attacker) + base.r + DASH_HIT_PAD
      ) {
        continue;
      }
      const swingKey = attacker.playerNum + ":dsb:" + attacker.swingId;
      if (base.lastHitSwingKey === swingKey) continue;
      base.lastHitSwingKey = swingKey;
      damageBase(
        base,
        attacker.swingDamage * DASH_DAMAGE_IMPERFECT_MUL * dashMul,
        attacker
      );
      attacker.dashHitLanded = true;
    }
  }

  function updateBases(dt) {
    const list = mapRuntime.bases;
    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      base.hitFlash = Math.max(0, (base.hitFlash || 0) - dt);
    }
  }

  function drawBases() {
    const list = mapRuntime.bases;
    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      const color = siegeTeamColor(base.team);
      const flash = (base.hitFlash || 0) > 0;
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.globalAlpha = base.destroyed ? 0.45 : 1;
      ctx.beginPath();
      ctx.arc(0, 0, base.r, 0, Math.PI * 2);
      ctx.fillStyle = base.destroyed ? "rgba(40,44,54,0.9)" : "rgba(20,26,38,0.92)";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = flash ? "#ffffff" : color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, base.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#ffffff" : color;
      ctx.globalAlpha = base.destroyed ? 0.25 : 0.55;
      ctx.fill();
      ctx.restore();
      if (!base.destroyed) {
        const w = base.r * 2.4;
        const h = 8;
        const hpFrac = base.maxHp > 0 ? clamp(base.hp / base.maxHp, 0, 1) : 0;
        ctx.save();
        ctx.translate(base.x - w / 2, base.y - base.r - 22);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w * hpFrac, h);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);
        ctx.restore();
      }
    }
  }

  function updateHexwrightDynamics(dt) {
    const bossMode = gameMode === "boss";
    const hordeBoss = gameMode === "horde" && hordeBossWaveActive();
    if (!bossMode && !hordeBoss) return;
    const boss = players.find(
      (pl) => isHexwrightBoss(pl) && pl.hp > 0 && (bossMode || isHordeBoss(pl))
    );
    if (!boss) {
      if (bossMode || hordeBoss) clearHordeBossMapExtras();
      return;
    }
    updateBossBottles(dt);
    updateToxicPuddles(dt);
    updateBossMinions(dt);
  }

  function drawToxicPuddles() {
    const list = mapRuntime.toxicPuddles;
    for (let i = 0; i < list.length; i++) {
      const pool = list[i];
      const pulse = 0.94 + 0.06 * Math.sin(performance.now() * 0.006 + i);
      const alpha = clamp(pool.duration / HEX_PUDDLE_DURATION, 0.25, 1);
      ctx.save();
      ctx.translate(pool.x, pool.y);
      ctx.beginPath();
      ctx.arc(0, 0, pool.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, " + (0.22 * alpha) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(110, 231, 183, " + (0.45 * alpha) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
      if ((pool.splashT || 0) > 0) {
        const t = pool.splashT / 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, pool.r * (0.4 + 0.6 * (1 - t)), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(190, 255, 220, " + (0.5 * t) + ")";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBossBottles() {
    const list = mapRuntime.bossBottles;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = "rgba(134, 239, 172, 0.95)";
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(20, 80, 50, 0.7)";
      ctx.fillRect(-3, -8, 6, 5);
      ctx.restore();
    }
  }

  function drawBossMinions() {
    const list = mapRuntime.bossMinions;
    const now = performance.now();
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.hp <= 0) continue;
      const flash = (m.hitFlash || 0) > 0;
      const spawn = (m.spawnFlash || 0) > 0;
      const phase = now * 0.011 + (m.id || i) * 1.3;
      const bob = Math.sin(phase) * 2.4;
      const stretch = 1 + Math.sin(phase * 2) * 0.08;
      ctx.save();
      ctx.translate(m.x, m.y + bob);
      ctx.scale(stretch, 1 / stretch);
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.fillStyle = flash
        ? "#fff"
        : spawn
          ? "rgba(190, 255, 210, 0.95)"
          : m.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 50, 36, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      const hpFrac = m.maxHp > 0 ? clamp(m.hp / m.maxHp, 0, 1) : 0;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(-m.r, -m.r - 7, m.r * 2, 3);
      ctx.fillStyle = "rgba(110, 231, 183, 0.9)";
      ctx.fillRect(-m.r, -m.r - 7, m.r * 2 * hpFrac, 3);
      ctx.restore();
    }
  }

  function drawHexwrightWindup(p) {
    if (!isHexwrightBoss(p) || p.hp <= 0) return;
    if (
      (p.hexBottleWindup || 0) <= 0 &&
      (p.hexSummonWindup || 0) <= 0 &&
      (p.hexTeleportWindup || 0) <= 0 &&
      (p.hexTeleportBlastT || 0) <= 0
    ) {
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if ((p.hexTeleportBlastT || 0) > 0) {
      const t = p.hexTeleportBlastT / HEX_TELEPORT_VFX;
      ctx.beginPath();
      ctx.arc(0, 0, getPlayerRadius(p) + 8 + 16 * (1 - t), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(167, 243, 208, " + (0.65 * (1 - t)) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(110, 231, 183, " + (0.2 * (1 - t)) + ")";
      ctx.fill();
    }
    if (p.hexTeleportWindup > 0) {
      const t = 1 - p.hexTeleportWindup / HEX_TELEPORT_WINDUP;
      ctx.globalAlpha = 0.35 + 0.45 * (1 - t);
      ctx.beginPath();
      ctx.arc(0, 0, getPlayerRadius(p), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(167, 243, 208, " + (0.5 + 0.5 * t) + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (p.hexSummonWindup > 0) {
      const t = 1 - p.hexSummonWindup / HEX_SUMMON_WINDUP;
      ctx.beginPath();
      ctx.arc(0, 0, getPlayerRadius(p) + 18 + 12 * t, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(110, 231, 183, " + (0.35 + 0.4 * t) + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (p.hexBottleWindup > 0) {
      const t = 1 - p.hexBottleWindup / HEX_BOTTLE_WINDUP;
      const ang = p.facing;
      ctx.rotate(ang);
      ctx.fillStyle = "rgba(134, 239, 172, " + (0.5 + 0.5 * t) + ")";
      ctx.beginPath();
      ctx.arc(getPlayerRadius(p) + 14, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function tickReaverRuinRoot(p, dt) {
    if ((p.reaverRuinRootT || 0) > 0) {
      p.reaverRuinRootT = Math.max(0, p.reaverRuinRootT - dt);
    }
  }

  function isReaverRuinRooted(p) {
    return (p.reaverRuinRootT || 0) > 0;
  }

  function tickReaverHookDisarm(p, dt) {
    if ((p.reaverHookDisarmT || 0) > 0) {
      p.reaverHookDisarmT = Math.max(0, p.reaverHookDisarmT - dt);
    }
  }

  function isReaverHookDisarmed(p) {
    return !p.isBot && (p.reaverHookDisarmT || 0) > 0;
  }

  function applyReaverHookDisarm(target) {
    if (!target || target.isBot || target.hp <= 0) return;
    target.reaverHookDisarmT = Math.max(
      target.reaverHookDisarmT || 0,
      REAVER_HOOK_DISARM_DURATION
    );
    target.chargeT = 0;
    target.chargeHoldT = 0;
    if (isLaser(target)) setLaserBeamActive(target, false);
  }

  function canPlayerUseAttacks(p) {
    if (grapplerHookBusy(p)) return false;
    return !isReaverHookDisarmed(p);
  }

  function reaverHealFromDamage(boss, dealt) {
    if (!isReaverBoss(boss) || dealt <= 0 || boss.hp <= 0 || gameOver) return;
    const heal = dealt * REAVER_LIFESTEAL_MUL;
    if (heal > 0) {
      boss.hp = Math.min(boss.maxHp, boss.hp + heal);
    }
  }

  function tickReaverBoss(p, dt) {
    if (!isReaverBoss(p) || p.hp <= 0 || gameOver || p.stunT > 0) return;
  }

  function reaverTouchDist(boss, target) {
    return getPlayerRadius(boss) + getPlayerRadius(target) + REAVER_GRASP_TOUCH_PAD;
  }

  function reaverIsTouching(boss, target) {
    if (!target || target.isBot || target.hp <= 0) return false;
    return len(target.x - boss.x, target.y - boss.y) <= reaverTouchDist(boss, target);
  }

  function reaverNearestTouchingHuman(boss) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.isBot || pl.hp <= 0) continue;
      const d = len(pl.x - boss.x, pl.y - boss.y);
      const touch = reaverTouchDist(boss, pl);
      if (d <= touch && d < bestD) {
        bestD = d;
        best = pl;
      }
    }
    return best;
  }

  function reaverGraspTarget(boss) {
    if (boss.reaverGraspTargetNum == null) return null;
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.playerNum === boss.reaverGraspTargetNum) return pl;
    }
    return null;
  }

  function reaverGraspInProgress(boss) {
    return (boss.reaverGraspWindup || 0) > 0 || (boss.reaverGraspActiveT || 0) > 0;
  }

  function triggerReaverGrasp(boss, target) {
    if (!target || target.isBot || target.hp <= 0) return;
    boss.reaverGraspSwingId = (boss.reaverGraspSwingId || 0) + 1;
    const swingKey = boss.playerNum + ":grasp:" + boss.reaverGraspSwingId;
    if (target.lastHitSwingKey === swingKey) return;
    const dmg = REAVER_GRASP_DAMAGE * boss.damageMultiplier;
    applyDamageTo(target, boss, dmg, {
      hitFlash: 0.28,
      swingKey: swingKey,
      knockFrom: boss,
      knockMul: REAVER_GRASP_KNOCK_MUL,
      stunT: 0.22,
    });
    boss.cooldown = Math.max(boss.cooldown, 0.5 * REAVER_ATTACK_CD_MUL);
  }

  function reaverRuinHumansInRange(boss, radius) {
    let count = 0;
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.isBot || pl.hp <= 0) continue;
      if (len(pl.x - boss.x, pl.y - boss.y) <= radius + getPlayerRadius(pl)) {
        count += 1;
      }
    }
    return count;
  }

  function triggerReaverRuin(boss) {
    boss.reaverRuinSwingId = (boss.reaverRuinSwingId || 0) + 1;
    const swingKey = boss.playerNum + ":ruin:" + boss.reaverRuinSwingId;
    const dmg = REAVER_RUIN_DAMAGE * boss.damageMultiplier;

    for (let i = 0; i < players.length; i++) {
      const target = players[i];
      if (target.isBot || target.hp <= 0) continue;
      const d = len(target.x - boss.x, target.y - boss.y);
      if (d > REAVER_RUIN_RADIUS + getPlayerRadius(target)) continue;
      if (target.lastHitSwingKey === swingKey) continue;
      applyDamageTo(target, boss, dmg, {
        hitFlash: 0.28,
        swingKey: swingKey,
        knockFrom: boss,
        knockMul: REAVER_RUIN_KNOCK_MUL,
        reaverRuinRoot: true,
      });
    }

    boss.reaverRuinBlastT = REAVER_RUIN_VFX;
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.cooldown = Math.max(boss.cooldown, 0.55);
    boss.vx = 0;
    boss.vy = 0;
  }

  function reaverHookAim(boss) {
    const facing =
      boss.reaverHookFacing != null ? boss.reaverHookFacing : boss.facing;
    const cx = Math.cos(facing);
    const cy = Math.sin(facing);
    const r = getPlayerRadius(boss);
    return {
      facing: facing,
      cx: cx,
      cy: cy,
      x0: boss.x + cx * (r + 10),
      y0: boss.y + cy * (r + 10),
    };
  }

  function reaverHookTip(boss) {
    const aim = reaverHookAim(boss);
    const hookLen = boss.reaverHookLen || 0;
    return {
      x0: aim.x0,
      y0: aim.y0,
      x1: aim.x0 + aim.cx * hookLen,
      y1: aim.y0 + aim.cy * hookLen,
      cx: aim.cx,
      cy: aim.cy,
    };
  }

  function reaverHookMaxLen(boss) {
    const aim = reaverHookAim(boss);
    const wall = rayDistToArenaWall(aim.x0, aim.y0, aim.cx, aim.cy, 10);
    if (wall <= 0 || !Number.isFinite(wall)) return REAVER_HOOK_RANGE;
    return Math.min(REAVER_HOOK_RANGE, wall);
  }

  function reaverHookFindVictim(boss) {
    const line = reaverHookTip(boss);
    let best = null;
    let bestAlong = Infinity;
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.isBot || pl.hp <= 0) continue;
      const hitR = getPlayerRadius(pl) + REAVER_HOOK_HALF_WIDTH;
      if (
        distPointToSegment(pl.x, pl.y, line.x0, line.y0, line.x1, line.y1) >
        hitR
      ) {
        continue;
      }
      const along =
        (pl.x - line.x0) * line.cx + (pl.y - line.y0) * line.cy;
      if (along < 12 || along > (boss.reaverHookLen || 0) + 8) continue;
      if (along < bestAlong) {
        bestAlong = along;
        best = pl;
      }
    }
    return best ? { target: best, along: bestAlong } : null;
  }

  function beginReaverHookPull(boss, target, along) {
    boss.reaverHookActive = false;
    boss.reaverHookLen = Math.max(18, along);
    boss.reaverHookPullT = REAVER_HOOK_PULL_TIME;
    boss.reaverHookTargetNum = target.playerNum;
    boss.reaverHookCd = REAVER_HOOK_COOLDOWN;
    boss.reaverHookMissT = 0;
    boss.reaverHookSwingId = (boss.reaverHookSwingId || 0) + 1;
    const swingKey =
      boss.playerNum + ":hook:" + boss.reaverHookSwingId;
    applyDamageTo(target, boss, REAVER_HOOK_DAMAGE * boss.damageMultiplier, {
      hitFlash: 0.2,
      swingKey: swingKey,
      knockFrom: boss,
      knockMul: REAVER_HOOK_KNOCK_MUL,
    });
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.cooldown = Math.max(boss.cooldown, 0.35);
    boss.vx = 0;
    boss.vy = 0;
  }

  function endReaverHook(boss) {
    boss.reaverHookActive = false;
    boss.reaverHookLen = 0;
    boss.reaverHookPullT = 0;
    boss.reaverHookTargetNum = null;
    boss.reaverHookWindup = 0;
    boss.reaverHookMissT = 0;
  }

  function fireReaverHook(boss) {
    const humans = players.filter((pl) => !pl.isBot && pl.hp > 0);
    if (humans.length) {
      let best = humans[0];
      let bestD = len(best.x - boss.x, best.y - boss.y);
      for (let h = 1; h < humans.length; h++) {
        const pl = humans[h];
        const d = len(pl.x - boss.x, pl.y - boss.y);
        if (d < bestD) {
          bestD = d;
          best = pl;
        }
      }
      const dx = best.x - boss.x;
      const dy = best.y - boss.y;
      if (len(dx, dy) > 1e-3) boss.reaverHookFacing = Math.atan2(dy, dx);
    }
    boss.reaverHookActive = true;
    boss.reaverHookLen = 0;
    boss.reaverHookMissT = 0;
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.vx = 0;
    boss.vy = 0;
  }

  function tickReaverHookExtend(boss, dt) {
    const maxLen = reaverHookMaxLen(boss);
    boss.reaverHookLen = (boss.reaverHookLen || 0) + REAVER_HOOK_SPEED * dt;
    const hit = reaverHookFindVictim(boss);
    if (hit) {
      beginReaverHookPull(boss, hit.target, hit.along);
      return;
    }
    if (boss.reaverHookLen >= maxLen) {
      boss.reaverHookLen = maxLen;
      boss.reaverHookActive = false;
      boss.reaverHookMissT = REAVER_HOOK_MISS_RETRACT;
      boss.reaverHookCd = REAVER_HOOK_COOLDOWN * 0.55;
    }
  }

  function tickReaverHookPull(boss, dt) {
    const target = players.find(
      (pl) => pl.playerNum === boss.reaverHookTargetNum
    );
    if (!target || target.isBot || target.hp <= 0) {
      endReaverHook(boss);
      return;
    }
    const aim = reaverHookAim(boss);
    const stopD = getPlayerRadius(boss) + getPlayerRadius(target) + REAVER_HOOK_PULL_STOP;
    const dx = boss.x - target.x;
    const dy = boss.y - target.y;
    let d = len(dx, dy);
    boss.reaverHookPullT = Math.max(0, (boss.reaverHookPullT || 0) - dt);

    if (d > 1e-3) {
      const pull = Math.min(
        Math.max(0, d - stopD),
        (REAVER_HOOK_RANGE / REAVER_HOOK_PULL_TIME) * 1.15 * dt
      );
      if (pull > 0) {
        target.x += (dx / d) * pull;
        target.y += (dy / d) * pull;
        resolvePlayerWall(target);
      }
    }
    d = len(boss.x - target.x, boss.y - target.y);

    const along =
      (target.x - aim.x0) * aim.cx + (target.y - aim.y0) * aim.cy;
    boss.reaverHookLen = clamp(along, 12, reaverHookMaxLen(boss));

    if (d <= stopD || boss.reaverHookPullT <= 0) {
      applyReaverHookDisarm(target);
      endReaverHook(boss);
      boss.cooldown = Math.max(boss.cooldown, 0.45);
    }
  }

  function bossBeamSweepDir(boss) {
    const humans = players.filter((pl) => !pl.isBot && pl.hp > 0);
    if (!humans.length) return 1;
    const beam = bossBeamEndpoints(boss);
    let nearest = humans[0];
    let bestD = distPointToSegment(
      nearest.x,
      nearest.y,
      beam.x0,
      beam.y0,
      beam.x1,
      beam.y1
    );
    for (let i = 1; i < humans.length; i++) {
      const pl = humans[i];
      const d = distPointToSegment(
        pl.x,
        pl.y,
        beam.x0,
        beam.y0,
        beam.x1,
        beam.y1
      );
      if (d < bestD) {
        bestD = d;
        nearest = pl;
      }
    }
    const ang = boss.beamFacing != null ? boss.beamFacing : boss.facing;
    const bx = Math.cos(ang);
    const by = Math.sin(ang);
    const cross = bx * (nearest.y - boss.y) - by * (nearest.x - boss.x);
    return cross >= 0 ? 1 : -1;
  }

  function bossBeamEndpoints(boss) {
    const ang = boss.beamFacing != null ? boss.beamFacing : boss.facing;
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const r = getPlayerRadius(boss);
    const x0 = boss.x + cx * (r + 12);
    const y0 = boss.y + cy * (r + 12);
    let dist = BOSS_BEAM_RANGE;
    const wallDist = rayDistToArenaWall(x0, y0, cx, cy, 4);
    if (wallDist > 0) {
      dist = Math.min(dist, wallDist);
    }
    dist = Math.max(0, dist);
    return {
      x0: x0,
      y0: y0,
      x1: x0 + cx * dist,
      y1: y0 + cy * dist,
    };
  }

  function applyBossBeamDamage(target, boss, dmg) {
    dmg = scaleDmg(dmg);
    if (target.hp <= 0) return;
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    const dealt = hpBefore - target.hp;
    target.hitFlash = Math.max(target.hitFlash, 0.08);
    grantBulwarkUltFromDamageTaken(target, dealt);
    if (target.hp <= 0) handleFighterDeath(target);
  }

  function tickBossBeam(boss, dt) {
    const beam = bossBeamEndpoints(boss);
    boss.beamX0 = beam.x0;
    boss.beamY0 = beam.y0;
    boss.beamX1 = beam.x1;
    boss.beamY1 = beam.y1;
    const tickDmg = BOSS_BEAM_DPS * boss.damageMultiplier * dt;

    for (let i = 0; i < players.length; i++) {
      const target = players[i];
      if (target.isBot || target.hp <= 0) continue;
      const hitR = getPlayerRadius(target) + BOSS_BEAM_HALF_WIDTH;
      if (
        distPointToSegment(
          target.x,
          target.y,
          beam.x0,
          beam.y0,
          beam.x1,
          beam.y1
        ) > hitR
      ) {
        continue;
      }
      applyBossBeamDamage(target, boss, tickDmg);
    }
  }

  function startBossBeam(boss) {
    boss.beamSwingId += 1;
    boss.beamFacing = boss.facing;
    boss.beamSweepDir = bossBeamSweepDir(boss);
    boss.beamActiveT = BOSS_BEAM_DURATION;
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.cooldown = Math.max(boss.cooldown, 0.25);
  }

  function triggerGroundPound(boss) {
    boss.poundSwingId += 1;
    const swingKey = boss.playerNum + ":pound:" + boss.poundSwingId;
    const dmg = POUND_DAMAGE * boss.damageMultiplier;
    const kb = KNOCKBACK * POUND_KNOCK_MUL * 0.11;

    for (let i = 0; i < players.length; i++) {
      const target = players[i];
      if (target.isBot || target.hp <= 0) continue;
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      const d = len(dx, dy);
      if (d > POUND_RADIUS + getPlayerRadius(target)) continue;
      if (target.lastHitSwingKey === swingKey) continue;

      applyDamageTo(target, boss, dmg, {
        hitFlash: 0.22,
        swingKey: swingKey,
        knockFrom: boss,
        knockMul: POUND_KNOCK_MUL * 0.11,
      });
    }

    boss.poundBlastT = POUND_BLAST_VFX;
    boss.chargeT = 0;
    boss.chargeHoldT = 0;
    boss.cooldown = Math.max(boss.cooldown, 0.35);
  }

  function drawBossScorchBeam(p) {
    if (p.beamWindup > 0) {
      const t = 1 - p.beamWindup / BOSS_BEAM_WINDUP;
      const pulse = 0.88 + 0.12 * Math.sin(performance.now() * 0.014);
      const beam = bossBeamEndpoints(p);
      const dx = beam.x1 - beam.x0;
      const dy = beam.y1 - beam.y0;
      const beamLen = len(dx, dy);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (beamLen > 6) {
        const ux = dx / beamLen;
        const uy = dy / beamLen;
        const px = -uy;
        const py = ux;
        const halfW = BOSS_BEAM_HALF_WIDTH * (0.35 + 0.65 * t) * pulse;
        const mouth = halfW * 0.5;
        ctx.beginPath();
        ctx.moveTo(beam.x0 + px * mouth, beam.y0 + py * mouth);
        ctx.lineTo(beam.x1 + px * halfW, beam.y1 + py * halfW);
        ctx.lineTo(beam.x1 - px * halfW, beam.y1 - py * halfW);
        ctx.lineTo(beam.x0 - px * mouth, beam.y0 - py * mouth);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 72, 28, " + (0.1 + 0.18 * t) + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 150, 70, " + (0.4 + 0.45 * t) + ")";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 200, 120, " + (0.35 + 0.55 * t) + ")";
      ctx.lineWidth = 4 + 8 * t;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(beam.x0, beam.y0);
      ctx.lineTo(beam.x1, beam.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 220, 160, " + (0.5 + 0.5 * t) + ")";
      ctx.beginPath();
      ctx.arc(beam.x1, beam.y1, 7 + 5 * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (p.beamActiveT > 0) {
      const beam = bossBeamEndpoints(p);
      const fade = clamp(p.beamActiveT / 0.22, 0, 1);
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.02);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 90, 40, 0.35)";
      ctx.lineWidth = BOSS_BEAM_HALF_WIDTH * 1.1 * pulse;
      ctx.beginPath();
      ctx.moveTo(beam.x0, beam.y0);
      ctx.lineTo(beam.x1, beam.y1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 200, 120, 0.9)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(beam.x0, beam.y0);
      ctx.lineTo(beam.x1, beam.y1);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.65;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawReaverRuin(p) {
    if (!isReaverBoss(p) || p.hp <= 0) return;
    if (p.reaverRuinWindup <= 0 && p.reaverRuinBlastT <= 0) return;
    const wind = p.reaverRuinWindup > 0;
    const t = wind
      ? 1 - p.reaverRuinWindup / REAVER_RUIN_WINDUP
      : 1 - p.reaverRuinBlastT / REAVER_RUIN_VFX;
    const r = REAVER_RUIN_RADIUS * (wind ? 0.35 + 0.65 * t : 0.85 + 0.15 * (1 - t));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (wind) {
      ctx.strokeStyle = "rgba(192, 132, 252, " + (0.45 + 0.5 * t) + ")";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(168, 85, 247, 0.1)";
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(220, 80, 255, " + (0.35 * (1 - t)) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 255, " + (0.75 * (1 - t)) + ")";
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReaverGrasp(p) {
    if (!isReaverBoss(p) || p.hp <= 0) return;
    if ((p.reaverGraspWindup || 0) <= 0 && (p.reaverGraspActiveT || 0) <= 0) {
      return;
    }
    const wind = (p.reaverGraspWindup || 0) > 0;
    const t = wind
      ? 1 - p.reaverGraspWindup / REAVER_GRASP_WINDUP
      : 1 - (p.reaverGraspActiveT || 0) / REAVER_GRASP_VFX;
    const pr = getPlayerRadius(p);
    const r = pr * (wind ? 1.05 + 0.2 * t : 1.15 + 0.1 * (1 - t));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (wind) {
      ctx.strokeStyle = "rgba(248, 113, 113, " + (0.5 + 0.45 * t) + ")";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "rgba(220, 38, 38, 0.12)";
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(239, 68, 68, " + (0.35 * (1 - t)) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 200, " + (0.8 * (1 - t)) + ")";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReaverHook(p) {
    if (!isReaverBoss(p) || p.hp <= 0) return;
    const wind = (p.reaverHookWindup || 0) > 0;
    const active =
      p.reaverHookActive ||
      (p.reaverHookPullT || 0) > 0 ||
      (p.reaverHookMissT || 0) > 0;
    if (!wind && !active) return;

    const aim = reaverHookAim(p);
    const maxLen = reaverHookMaxLen(p);
    let hookLen = wind ? maxLen * 0.22 : p.reaverHookLen || 0;
    if (wind) {
      const t = 1 - p.reaverHookWindup / REAVER_HOOK_WINDUP;
      hookLen = maxLen * (0.18 + 0.28 * t);
    }
    const x1 = aim.x0 + aim.cx * hookLen;
    const y1 = aim.y0 + aim.cy * hookLen;

    ctx.save();
    ctx.lineCap = "round";
    if (wind) {
      const t = 1 - p.reaverHookWindup / REAVER_HOOK_WINDUP;
      ctx.strokeStyle = "rgba(192, 132, 252, " + (0.35 + 0.45 * t) + ")";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(aim.x0, aim.y0);
      ctx.lineTo(aim.x0 + aim.cx * maxLen * 0.35, aim.y0 + aim.cy * maxLen * 0.35);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (active && hookLen > 4) {
      ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(aim.x0, aim.y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 220, 255, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(aim.x0, aim.y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.translate(x1, y1);
      ctx.rotate(aim.facing);
      ctx.fillStyle = "rgba(220, 180, 255, 0.95)";
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-5, 5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, -5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 40, 120, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBossGroundPound(p) {
    if (p.poundWindup > 0) {
      const t = 1 - p.poundWindup / POUND_WINDUP;
      const r = POUND_RADIUS * (0.35 + 0.65 * t);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(232, 93, 76, 0.75)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(232, 93, 76, 0.12)";
      ctx.fill();
      ctx.restore();
    }
    if (p.poundBlastT > 0) {
      const t = 1 - p.poundBlastT / POUND_BLAST_VFX;
      const r = POUND_RADIUS * (0.2 + 0.95 * t);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 140, 90, " + (0.85 * (1 - t)) + ")";
      ctx.lineWidth = 4 + 6 * (1 - t);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 100, 60, " + (0.18 * (1 - t)) + ")";
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSeismicSlam(p) {
    if ((p.seismicSlamT || 0) <= 0) return;
    const life = p.seismicSlamT;
    const t = 1 - life / BRAWLER_ULT_VFX;
    const fade = clamp(life / (BRAWLER_ULT_VFX * 0.55), 0, 1);
    const cx = p.seismicSlamX != null ? p.seismicSlamX : p.x;
    const cy = p.seismicSlamY != null ? p.seismicSlamY : p.y;
    const color = p.color || "#ef4444";
    const maxR = BRAWLER_ULT_RADIUS;
    ctx.save();
    ctx.translate(cx, cy);

    // Expanding ground pulse fill
    ctx.beginPath();
    ctx.arc(0, 0, maxR * (0.18 + 0.92 * t), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16 * fade;
    ctx.fill();

    // Primary shockwave ring
    ctx.beginPath();
    ctx.arc(0, 0, maxR * (0.22 + 0.88 * t), 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75 * fade;
    ctx.lineWidth = 5 + 7 * (1 - t);
    ctx.stroke();

    // Secondary delayed ring
    const t2 = clamp((t - 0.12) / 0.88, 0, 1);
    if (t2 > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, maxR * (0.1 + 0.95 * t2), 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.globalAlpha = 0.35 * fade * (1 - t2);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Radial crack lines
    const cracks = 8;
    for (let i = 0; i < cracks; i++) {
      const ang = (i / cracks) * Math.PI * 2 + t * 0.15;
      const inner = maxR * (0.12 + 0.08 * Math.sin(i * 1.7));
      const outer = maxR * (0.35 + 0.6 * t) * (0.78 + 0.22 * ((i * 3) % 5) / 4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
      ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55 * fade * (1 - t * 0.35);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Impact core flash
    ctx.beginPath();
    ctx.arc(0, 0, 10 + 18 * (1 - t), 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.45 * fade * (1 - t);
    ctx.fill();

    ctx.restore();
  }

  function buildPlayers() {
    const { humans, ai, total } = readRoster();
    const heroes = buildHeroConfigs(humans, ai).map((cfg, i) =>
      createPlayer(cfg, i + 1)
    );
    if (gameMode === "boss") {
      const boss = createPlayer(buildBossConfig(total), total + 1);
      return heroes.concat([boss]);
    }
    return heroes;
  }

  let gameOver = false;
  /** @type {null | "heroes" | "bot" | "draw" | number} */
  let winner = null;

  function updateHudLayout() {
    if (!hudRoot) return;
    const { total } = readRoster();
    hudRoot.classList.toggle(
      "mode-versus",
      gameMode === "versus" || gameMode === "teams" || gameMode === "siege"
    );
    hudRoot.classList.toggle("mode-many", total >= 4);
    hudRoot.classList.toggle("mode-six", total >= 6);
    for (let i = 0; i < heroHudWraps.length; i++) {
      const w = heroHudWraps[i];
      if (w) w.classList.toggle("hidden", i >= total);
    }
    if (hudBossWrap) {
      hudBossWrap.classList.toggle(
        "hidden",
        gameMode !== "boss" && !hordeBossWaveActive()
      );
    }
    if (hudBaseAWrap) hudBaseAWrap.classList.toggle("hidden", gameMode !== "siege");
    if (hudBaseBWrap) hudBaseBWrap.classList.toggle("hidden", gameMode !== "siege");
  }

  function refreshBossHudLabel() {
    const bossNameEl = hudBossWrap
      ? hudBossWrap.querySelector(".name.boss")
      : null;
    if (!bossNameEl) return;
    if (gameMode === "horde" && hordeBossWaveActive()) {
      const boss = getHordeBossPlayer();
      const bid =
        (boss && boss.bossId) ||
        hordeState.bossWaveId ||
        "colossus";
      const bdef = getBossDef(bid);
      const wave = hordeState.wave || (boss && boss.hordeBossWave) || 25;
      const n = hordePartySize();
      const scale = getHordeBossScaling(bid, wave, n);
      bossNameEl.textContent =
        bdef.name + " · wave " + wave + " · HP " + scale.maxHp;
      return;
    }
    if (gameMode !== "boss") {
      bossNameEl.textContent = "Boss";
      return;
    }
    const party = readRoster().total;
    const boss = players.find((pl) => pl.isBot);
    const bid =
      boss && boss.bossId ? boss.bossId : selectedBossId || "colossus";
    const bdef = getBossDef(bid);
    const n = boss && boss.bossPartySize ? boss.bossPartySize : party;
    const scale = getBossScaling(bid, n);
    bossNameEl.textContent =
      bdef.name + " · " + n + "v1 · HP " + scale.maxHp;
  }

  function refreshHudLabels() {
    const { total } = readRoster();
    refreshBossHudLabel();
    for (let i = 0; i < MAX_TEAM_FIGHTERS; i++) {
      const lab = document.getElementById("hero-label-" + i);
      if (!lab) continue;
      if (i >= total) {
        lab.textContent = "P" + (i + 1);
        lab.style.color = "";
        continue;
      }
      const p = players.find((pl) => pl.playerNum === i + 1);
      if (p || characterPickerOpen) {
        lab.textContent = formatSlotHudLabel(i, p || null);
        const charId =
          (p && p.characterId) || slotCharacters[i] || RANDOM_CHAR_ID;
        lab.style.color = p ? p.color : charTintForId(charId);
      } else {
        lab.textContent = "P" + (i + 1);
        lab.style.color = "";
      }
    }
  }

  function ensureSlotCharacters() {
    const { total } = readRoster();
    while (slotCharacters.length < total) {
      slotCharacters.push(RANDOM_CHAR_ID);
    }
    slotCharacters.length = total;
  }

  function ensureSlotAiDifficulty() {
    const { humans, total } = readRoster();
    while (slotAiDifficulty.length < total) {
      slotAiDifficulty.push(AI_DIFFICULTY_DEFAULT);
    }
    slotAiDifficulty.length = total;
    for (let i = humans; i < total; i++) {
      slotAiDifficulty[i] = normalizeAiDifficulty(slotAiDifficulty[i]);
    }
  }

  function ensureSlotTeams() {
    const { total } = readRoster();
    while (slotTeams.length < total) {
      slotTeams.push(slotTeams.length % 2 === 0 ? "a" : "b");
    }
    slotTeams.length = total;
  }

  function paintCharSelectIcon(c2d, cid, color, size) {
    const r = size * 0.34;
    c2d.clearRect(0, 0, size, size);
    c2d.save();
    c2d.translate(size * 0.5, size * 0.5);
    c2d.fillStyle = color || "#8b95a8";
    c2d.strokeStyle = "rgba(255,255,255,0.45)";
    c2d.lineWidth = 1.5;
    if (cid === "brawler") {
      const s = r * 1.7;
      const rr = r * 0.28;
      const x = -s * 0.5;
      const y = -s * 0.5;
      c2d.beginPath();
      c2d.moveTo(x + rr, y);
      c2d.arcTo(x + s, y, x + s, y + s, rr);
      c2d.arcTo(x + s, y + s, x, y + s, rr);
      c2d.arcTo(x, y + s, x, y, rr);
      c2d.arcTo(x, y, x + s, y, rr);
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "marksman") {
      c2d.scale(1.2, 0.7);
      c2d.beginPath();
      c2d.arc(0, 0, r, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
    } else if (cid === "striker") {
      c2d.beginPath();
      c2d.moveTo(r * 1.1, 0);
      c2d.lineTo(0.1 * r, r * 0.75);
      c2d.lineTo(-r, r * 0.25);
      c2d.lineTo(-r * 0.5, 0);
      c2d.lineTo(-r, -r * 0.25);
      c2d.lineTo(0.1 * r, -r * 0.75);
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "bulwark") {
      c2d.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        const x = Math.cos(a) * r * 1.05;
        const y = Math.sin(a) * r * 1.05;
        if (i === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
      }
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "ricochet") {
      c2d.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * r * 1.05;
        const y = Math.sin(a) * r * 1.05;
        if (i === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
      }
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "laser") {
      c2d.beginPath();
      c2d.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
      c2d.beginPath();
      c2d.moveTo(r * 0.3, -r * 0.35);
      c2d.lineTo(r * 1.15, 0);
      c2d.lineTo(r * 0.3, r * 0.35);
      c2d.closePath();
      c2d.fill();
    } else if (cid === "scatter") {
      c2d.beginPath();
      c2d.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
      c2d.beginPath();
      c2d.moveTo(r * 0.2, -r * 0.55);
      c2d.lineTo(r * 1.1, -r * 0.35);
      c2d.lineTo(r * 0.45, 0);
      c2d.lineTo(r * 1.1, r * 0.35);
      c2d.lineTo(r * 0.2, r * 0.55);
      c2d.closePath();
      c2d.fill();
    } else if (cid === "nova") {
      c2d.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6 - Math.PI / 2;
        const rad = i % 2 === 0 ? r * 1.1 : r * 0.55;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
      }
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "phoenix") {
      c2d.beginPath();
      c2d.moveTo(r, 0);
      c2d.lineTo(r * 0.3, r * 0.7);
      c2d.lineTo(-r * 0.9, r * 0.2);
      c2d.lineTo(-r * 0.4, 0);
      c2d.lineTo(-r * 0.9, -r * 0.2);
      c2d.lineTo(r * 0.3, -r * 0.7);
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "echo") {
      c2d.globalAlpha = 0.4;
      c2d.beginPath();
      c2d.arc(-r * 0.25, r * 0.15, r * 0.8, 0, Math.PI * 2);
      c2d.fill();
      c2d.globalAlpha = 1;
      c2d.beginPath();
      c2d.arc(0, 0, r, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
    } else if (cid === "pike") {
      c2d.beginPath();
      c2d.moveTo(r * 1.15, 0);
      c2d.lineTo(r * 0.2, r * 0.7);
      c2d.lineTo(-r * 0.85, r * 0.3);
      c2d.lineTo(-r * 0.5, 0);
      c2d.lineTo(-r * 0.85, -r * 0.3);
      c2d.lineTo(r * 0.2, -r * 0.7);
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
    } else if (cid === "grappler") {
      c2d.beginPath();
      c2d.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
      c2d.beginPath();
      c2d.moveTo(r * 0.15, -r * 0.15);
      c2d.quadraticCurveTo(r * 1.05, -r * 0.55, r * 1.05, r * 0.15);
      c2d.quadraticCurveTo(r * 1.05, r * 0.55, r * 0.35, r * 0.35);
      c2d.strokeStyle = "#fff";
      c2d.lineWidth = 2.2;
      c2d.lineCap = "round";
      c2d.stroke();
      c2d.beginPath();
      c2d.arc(r * 0.35, r * 0.35, r * 0.22, 0, Math.PI * 2);
      c2d.fillStyle = "#fff";
      c2d.fill();
    } else if (cid === "siphon") {
      c2d.beginPath();
      c2d.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
      c2d.beginPath();
      c2d.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      c2d.strokeStyle = "#fff";
      c2d.lineWidth = 2;
      c2d.stroke();
      c2d.beginPath();
      c2d.moveTo(-r * 0.15, 0);
      c2d.lineTo(r * 0.55, -r * 0.35);
      c2d.lineTo(r * 0.55, r * 0.35);
      c2d.closePath();
      c2d.fillStyle = "#fff";
      c2d.fill();
    } else {
      c2d.beginPath();
      c2d.arc(0, 0, r, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
    }
    c2d.restore();
  }

  function buildCharSelectUI() {
    if (!charSlotsEl) return;
    ensureSlotCharacters();
    ensureSlotTeams();
    ensureSlotAiDifficulty();
    const { humans, ai, total } = readRoster();
    const showTeams = gameMode === "teams" || gameMode === "siege";
    charSlotsEl.innerHTML = "";
    if (charTeamHintEl) charTeamHintEl.innerHTML = "";
    if (showTeams && charTeamHintEl) {
      const ids = teamIdsForMode();
      const counts = countSlotTeams();
      const countsText = ids
        .map((t) => counts[t] + " on " + TEAM_LABELS[t])
        .join(", ");
      const warn = document.createElement("p");
      warn.className = "team-roster-hint";
      warn.innerHTML =
        (gameMode === "siege"
          ? "Assign <strong>Team A</strong> vs <strong>Team B</strong>"
          : "Assign fighters to <strong>2-4 teams</strong>") +
        " — need at least two teams with a fighter. " +
        "Now: " +
        countsText +
        "." +
        (teamsRosterValid()
          ? ""
          : ' <span class="team-warn">Add someone to another team.</span>');
      charTeamHintEl.appendChild(warn);
    }
    for (let i = 0; i < total; i++) {
      const isAi = i >= humans;
      const slotLabel = isAi
        ? "AI " + (i - humans + 1)
        : "Player " + (i + 1);
      const cur = slotCharacters[i] || RANDOM_CHAR_ID;
      const curDef = getCharSelectDef(cur);
      const teamCur = slotFightTeam(i);
      const slot = document.createElement("div");
      slot.className = "char-slot";
      const title = document.createElement("div");
      title.className = "slot-title";
      title.textContent =
        slotLabel + (isAi ? "" : " \u00b7 keyboard");
      slot.appendChild(title);
      const meta = document.createElement("div");
      meta.className = "slot-meta";
      const charBadge = document.createElement("span");
      charBadge.className = "slot-char-badge";
      const swatch = document.createElement("span");
      swatch.className = "slot-swatch";
      swatch.style.background = charTintForId(cur);
      charBadge.appendChild(swatch);
      charBadge.appendChild(document.createTextNode(curDef.name));
      meta.appendChild(charBadge);
      if (isAi) {
        const diffBadge = document.createElement("span");
        diffBadge.className = "slot-diff-badge";
        diffBadge.textContent =
          AI_DIFFICULTY_LABELS[resolveSlotAiDifficulty(i)] || "Normal";
        meta.appendChild(diffBadge);
      }
      if (showTeams) {
        const teamBadge = document.createElement("span");
        teamBadge.className = "slot-team-badge team-" + teamCur;
        teamBadge.textContent = "Team " + teamCur.toUpperCase();
        meta.appendChild(teamBadge);
      }
      slot.appendChild(meta);
      if (isAi) {
        const diffRow = document.createElement("div");
        diffRow.className = "slot-diff-row";
        const diffLab = document.createElement("label");
        diffLab.className = "slot-diff-label";
        diffLab.textContent = "Difficulty";
        const diffSel = document.createElement("select");
        diffSel.className = "roster-select slot-diff-select";
        diffSel.setAttribute("aria-label", slotLabel + " difficulty");
        AI_DIFFICULTY_IDS.forEach((did) => {
          const opt = document.createElement("option");
          opt.value = did;
          opt.textContent = AI_DIFFICULTY_LABELS[did];
          if (did === resolveSlotAiDifficulty(i)) opt.selected = true;
          diffSel.appendChild(opt);
        });
        diffSel.addEventListener("change", () => {
          slotAiDifficulty[i] = normalizeAiDifficulty(diffSel.value);
          buildCharSelectUI();
          refreshHudLabels();
        });
        diffLab.appendChild(diffSel);
        diffRow.appendChild(diffLab);
        slot.appendChild(diffRow);
      }
      if (showTeams) {
        const teamPick = document.createElement("div");
        teamPick.className = "team-pick";
        teamIdsForMode().forEach((tid) => {
          const tbtn = document.createElement("button");
          tbtn.type = "button";
          tbtn.className =
            "team-btn team-" +
            tid +
            (teamCur === tid ? " selected" : "");
          tbtn.textContent = "Team " + tid.toUpperCase();
          tbtn.addEventListener("click", () => {
            slotTeams[i] = tid;
            buildCharSelectUI();
            refreshHudLabels();
          });
          teamPick.appendChild(tbtn);
        });
        slot.appendChild(teamPick);
      }
      const pickWrap = document.createElement("div");
      pickWrap.className = "char-pick-wrap";
      const randomDef = getCharSelectDef(RANDOM_CHAR_ID);
      const randomBtn = document.createElement("button");
      randomBtn.type = "button";
      randomBtn.className =
        "char-option char-option-random char-option-random-top" +
        (cur === RANDOM_CHAR_ID ? " selected" : "");
      randomBtn.title = randomDef.desc;
      randomBtn.innerHTML =
        "<strong>" +
        randomDef.name +
        "</strong><span>" +
        randomDef.desc +
        "</span>";
      randomBtn.addEventListener("click", () => {
        slotCharacters[i] = RANDOM_CHAR_ID;
        buildCharSelectUI();
        refreshHudLabels();
      });
      pickWrap.appendChild(randomBtn);
      const opts = document.createElement("div");
      opts.className = "char-options";
      CHARACTER_IDS.forEach((cid) => {
        const def = getCharSelectDef(cid);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "char-option" + (cur === cid ? " selected" : "");
        if (def.tint) {
          btn.style.borderLeftColor = def.tint;
          btn.style.borderLeftWidth = "3px";
        }
        btn.title = def.desc;
        const icon = document.createElement("canvas");
        icon.className = "char-option-icon";
        icon.width = 40;
        icon.height = 40;
        const ictx = icon.getContext("2d");
        if (ictx) paintCharSelectIcon(ictx, cid, def.tint, 40);
        btn.appendChild(icon);
        const label = document.createElement("strong");
        label.textContent = def.name;
        btn.appendChild(label);
        const desc = document.createElement("span");
        desc.innerHTML = def.desc;
        btn.appendChild(desc);
        btn.addEventListener("click", () => {
          slotCharacters[i] = cid;
          buildCharSelectUI();
          refreshHudLabels();
        });
        opts.appendChild(btn);
      });
      pickWrap.appendChild(opts);
      slot.appendChild(pickWrap);
      charSlotsEl.appendChild(slot);
    }
    updateCharContinueState();
    refreshHudLabels();
  }

  function renderBossChoices() {
    if (!bossChoicesEl) return;
    bossChoicesEl.innerHTML = "";
    BOSS_IDS.forEach((bid) => {
      const def = BOSSES[bid];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "boss-choice" + (bid === selectedBossId ? " selected" : "");
      btn.innerHTML =
        "<span class=\"boss-choice-name\">" +
        def.name +
        "</span><span class=\"boss-choice-desc\">" +
        def.desc +
        "</span>";
      btn.addEventListener("click", () => {
        selectedBossId = bid;
        renderBossChoices();
        updateBossModeHint();
        if (btnBossContinue) btnBossContinue.disabled = false;
      });
      bossChoicesEl.appendChild(btn);
    });
    if (btnBossContinue) btnBossContinue.disabled = !selectedBossId;
  }

  function openBossScreen() {
    bossPickerOpen = true;
    modePickerOpen = false;
    mapPickerOpen = false;
    characterPickerOpen = false;
    if (modeScreen) modeScreen.classList.remove("visible");
    closeCharScreen();
    closeMapScreen();
    renderBossChoices();
    if (bossScreen) bossScreen.classList.add("visible");
    setHelpText();
    refreshBossHudLabel();
  }

  function closeBossScreen() {
    bossPickerOpen = false;
    if (bossScreen) bossScreen.classList.remove("visible");
  }

  function renderMapModifiers() {
    if (!mapModifiersEl) return;
    mapModifiersEl.innerHTML = "";

    const shapeSec = document.createElement("div");
    shapeSec.className = "map-mod-section";
    const shapeLabel = document.createElement("h3");
    shapeLabel.className = "map-mod-label";
    shapeLabel.textContent = "Arena shape";
    shapeSec.appendChild(shapeLabel);
    const shapeRow = document.createElement("div");
    shapeRow.className = "map-shape-row";
    for (let i = 0; i < ARENA_SHAPE_OPTIONS.length; i++) {
      const opt = ARENA_SHAPE_OPTIONS[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "map-shape-btn" +
        (mapModifiers.bounds === opt.key ? " selected" : "");
      btn.innerHTML =
        "<strong>" + opt.name + "</strong><span>" + opt.desc + "</span>";
      btn.addEventListener("click", () => {
        mapModifiers.bounds = opt.key;
        renderMapModifiers();
        setHelpText();
      });
      shapeRow.appendChild(btn);
    }
    shapeSec.appendChild(shapeRow);
    mapModifiersEl.appendChild(shapeSec);

    const hazardSec = document.createElement("div");
    hazardSec.className = "map-mod-section";
    const hazardLabel = document.createElement("h3");
    hazardLabel.className = "map-mod-label";
    hazardLabel.textContent = "Hazards & features";
    hazardSec.appendChild(hazardLabel);
    const list = document.createElement("div");
    list.className = "map-mod-list";
    for (let i = 0; i < MAP_MODIFIER_TOGGLES.length; i++) {
      const t = MAP_MODIFIER_TOGGLES[i];
      const label = document.createElement("label");
      label.className =
        "map-mod-toggle" + (mapModifiers[t.key] ? " on" : "");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!mapModifiers[t.key];
      input.addEventListener("change", () => {
        mapModifiers[t.key] = input.checked;
        label.className =
          "map-mod-toggle" + (mapModifiers[t.key] ? " on" : "");
        const summary = hazardSec.querySelector(".map-mod-summary");
        if (summary) summary.textContent = mapModifiersSummary();
        setHelpText();
      });
      label.appendChild(input);
      const text = document.createElement("div");
      text.className = "map-mod-toggle-text";
      text.innerHTML =
        "<strong>" + t.name + "</strong><span>" + t.desc + "</span>";
      label.appendChild(text);
      list.appendChild(label);
    }
    hazardSec.appendChild(list);
    const summary = document.createElement("p");
    summary.className = "map-mod-summary";
    summary.textContent = mapModifiersSummary();
    hazardSec.appendChild(summary);
    mapModifiersEl.appendChild(hazardSec);

    if (btnMapContinue) btnMapContinue.disabled = false;
  }

  function openMapScreen() {
    mapPickerOpen = true;
    modePickerOpen = false;
    bossPickerOpen = false;
    characterPickerOpen = false;
    if (modeScreen) modeScreen.classList.remove("visible");
    closeCharScreen();
    closeBossScreen();
    renderMapModifiers();
    if (mapScreen) mapScreen.classList.add("visible");
    setHelpText();
  }

  function closeMapScreen() {
    mapPickerOpen = false;
    if (mapScreen) mapScreen.classList.remove("visible");
  }

  function openCharScreen() {
    characterPickerOpen = true;
    modePickerOpen = false;
    mapPickerOpen = false;
    bossPickerOpen = false;
    if (modeScreen) modeScreen.classList.remove("visible");
    closeMapScreen();
    ensureSlotCharacters();
    ensureSlotTeams();
    ensureSlotAiDifficulty();
    syncRosterSelectOptions();
    syncAiSelectCap();
    onRosterControlsChanged();
    if (charScreen) charScreen.classList.add("visible");
    setHelpText();
    refreshBossHudLabel();
  }

  function closeCharScreen() {
    characterPickerOpen = false;
    if (charScreen) charScreen.classList.remove("visible");
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTING_SHOW_INSTRUCTIONS_KEY);
      if (raw === "0" || raw === "false") showInstructions = false;
    } catch (e) {
      showInstructions = true;
    }
    try {
      const shineRaw = localStorage.getItem(SETTING_CHARACTER_SHINE_KEY);
      if (shineRaw === "1" || shineRaw === "true") showCharacterShine = true;
    } catch (e) {
      showCharacterShine = false;
    }
    try {
      const handsRaw = localStorage.getItem(SETTING_FIGHTER_HANDS_KEY);
      if (handsRaw === "0" || handsRaw === "false") showFighterHands = false;
      else showFighterHands = true;
    } catch (e) {
      showFighterHands = true;
    }
    try {
      const tagsRaw = localStorage.getItem(SETTING_NAME_TAGS_KEY);
      if (tagsRaw === "0" || tagsRaw === "false") showNameTags = false;
      else showNameTags = true;
    } catch (e) {
      showNameTags = true;
    }
    try {
      const hpRaw = localStorage.getItem(SETTING_OVERHEAD_HP_KEY);
      if (hpRaw === "1" || hpRaw === "true") showOverheadHpBars = true;
      else showOverheadHpBars = false;
    } catch (e) {
      showOverheadHpBars = false;
    }
    try {
      const shapesRaw = localStorage.getItem(SETTING_UNIQUE_SHAPES_KEY);
      if (shapesRaw === "0" || shapesRaw === "false") showUniqueShapes = false;
      else showUniqueShapes = true;
    } catch (e) {
      showUniqueShapes = true;
    }
    try {
      const arrowRaw = localStorage.getItem(SETTING_FACING_ARROW_KEY);
      if (arrowRaw === "0" || arrowRaw === "false") showFacingArrow = false;
      else showFacingArrow = true;
    } catch (e) {
      showFacingArrow = true;
    }
    try {
      const mouseAimRaw = localStorage.getItem(SETTING_MOUSE_AIM_KEY);
      if (mouseAimRaw === "0" || mouseAimRaw === "false") useMouseAimP1 = false;
      else useMouseAimP1 = true;
    } catch (e) {
      useMouseAimP1 = true;
    }
    try {
      const raw = localStorage.getItem(SETTING_NAME_TAG_CHAR_NAME_KEY);
      if (raw === "0" || raw === "false") showNameTagCharName = false;
      else showNameTagCharName = true;
    } catch (e) {
      showNameTagCharName = true;
    }
    try {
      const raw = localStorage.getItem(SETTING_NAME_TAG_TEAM_KEY);
      if (raw === "0" || raw === "false") showNameTagTeam = false;
      else showNameTagTeam = true;
    } catch (e) {
      showNameTagTeam = true;
    }
    try {
      const raw = localStorage.getItem(SETTING_NAME_TAG_HUMAN_AI_KEY);
      if (raw === "1" || raw === "true") showNameTagHumanAi = true;
      else showNameTagHumanAi = false;
    } catch (e) {
      showNameTagHumanAi = false;
    }
    try {
      const raw = localStorage.getItem(SETTING_NAME_TAG_AI_DIFFICULTY_KEY);
      if (raw === "1" || raw === "true") showNameTagAiDifficulty = true;
      else showNameTagAiDifficulty = false;
    } catch (e) {
      showNameTagAiDifficulty = false;
    }
    try {
      const raw = localStorage.getItem(SETTING_NAME_TAG_PLAYER_NUM_KEY);
      if (raw === "1" || raw === "true") showNameTagPlayerNum = true;
      else showNameTagPlayerNum = false;
    } catch (e) {
      showNameTagPlayerNum = false;
    }
  }

  function saveShowInstructions() {
    try {
      localStorage.setItem(
        SETTING_SHOW_INSTRUCTIONS_KEY,
        showInstructions ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveCharacterShine() {
    try {
      localStorage.setItem(
        SETTING_CHARACTER_SHINE_KEY,
        showCharacterShine ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveFighterHands() {
    try {
      localStorage.setItem(
        SETTING_FIGHTER_HANDS_KEY,
        showFighterHands ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTags() {
    try {
      localStorage.setItem(SETTING_NAME_TAGS_KEY, showNameTags ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTagCharName() {
    try {
      localStorage.setItem(
        SETTING_NAME_TAG_CHAR_NAME_KEY,
        showNameTagCharName ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTagTeam() {
    try {
      localStorage.setItem(SETTING_NAME_TAG_TEAM_KEY, showNameTagTeam ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTagHumanAi() {
    try {
      localStorage.setItem(
        SETTING_NAME_TAG_HUMAN_AI_KEY,
        showNameTagHumanAi ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTagAiDifficulty() {
    try {
      localStorage.setItem(
        SETTING_NAME_TAG_AI_DIFFICULTY_KEY,
        showNameTagAiDifficulty ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveNameTagPlayerNum() {
    try {
      localStorage.setItem(
        SETTING_NAME_TAG_PLAYER_NUM_KEY,
        showNameTagPlayerNum ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveOverheadHpBars() {
    try {
      localStorage.setItem(
        SETTING_OVERHEAD_HP_KEY,
        showOverheadHpBars ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveUniqueShapes() {
    try {
      localStorage.setItem(
        SETTING_UNIQUE_SHAPES_KEY,
        showUniqueShapes ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveFacingArrow() {
    try {
      localStorage.setItem(
        SETTING_FACING_ARROW_KEY,
        showFacingArrow ? "1" : "0"
      );
    } catch (e) {
      /* ignore */
    }
  }

  function saveMouseAim() {
    try {
      localStorage.setItem(SETTING_MOUSE_AIM_KEY, useMouseAimP1 ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  function applyHelpVisibility() {
    document.body.classList.toggle(
      "help-instructions-hidden",
      !showInstructions
    );
    window.dispatchEvent(new Event("topduel-help-visibility"));
  }

  function setModeTab(tab) {
    const playPanel = document.getElementById("mode-panel-play");
    const settingsPanel = document.getElementById("mode-panel-settings");
    const tabs = document.querySelectorAll(".mode-screen-tab");
    const pick = tab === "settings" ? "settings" : "play";
    for (let i = 0; i < tabs.length; i++) {
      const btn = tabs[i];
      const on = btn.getAttribute("data-mode-tab") === pick;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
    if (playPanel) playPanel.hidden = pick !== "play";
    if (settingsPanel) settingsPanel.hidden = pick !== "settings";
  }

  function initSettingsUI() {
    const cb = document.getElementById("setting-show-instructions");
    if (cb) {
      cb.checked = showInstructions;
      cb.addEventListener("change", () => {
        showInstructions = cb.checked;
        saveShowInstructions();
        applyHelpVisibility();
      });
    }
    const shineCb = document.getElementById("setting-character-shine");
    if (shineCb) {
      shineCb.checked = showCharacterShine;
      shineCb.addEventListener("change", () => {
        showCharacterShine = shineCb.checked;
        saveCharacterShine();
      });
    }
    const handsCb = document.getElementById("setting-fighter-hands");
    if (handsCb) {
      handsCb.checked = showFighterHands;
      handsCb.addEventListener("change", () => {
        showFighterHands = handsCb.checked;
        saveFighterHands();
      });
    }
    const nameTagSubgroup = document.getElementById("name-tag-subgroup");
    function updateNameTagSubgroupVisibility() {
      if (nameTagSubgroup) nameTagSubgroup.hidden = !showNameTags;
    }
    const tagsCb = document.getElementById("setting-name-tags");
    if (tagsCb) {
      tagsCb.checked = showNameTags;
      tagsCb.addEventListener("change", () => {
        showNameTags = tagsCb.checked;
        saveNameTags();
        updateNameTagSubgroupVisibility();
      });
    }
    updateNameTagSubgroupVisibility();
    const tagCharNameCb = document.getElementById("setting-nametag-charname");
    if (tagCharNameCb) {
      tagCharNameCb.checked = showNameTagCharName;
      tagCharNameCb.addEventListener("change", () => {
        showNameTagCharName = tagCharNameCb.checked;
        saveNameTagCharName();
      });
    }
    const tagTeamCb = document.getElementById("setting-nametag-team");
    if (tagTeamCb) {
      tagTeamCb.checked = showNameTagTeam;
      tagTeamCb.addEventListener("change", () => {
        showNameTagTeam = tagTeamCb.checked;
        saveNameTagTeam();
      });
    }
    const tagHumanAiCb = document.getElementById("setting-nametag-humanai");
    if (tagHumanAiCb) {
      tagHumanAiCb.checked = showNameTagHumanAi;
      tagHumanAiCb.addEventListener("change", () => {
        showNameTagHumanAi = tagHumanAiCb.checked;
        saveNameTagHumanAi();
      });
    }
    const tagAiDiffCb = document.getElementById("setting-nametag-aidifficulty");
    if (tagAiDiffCb) {
      tagAiDiffCb.checked = showNameTagAiDifficulty;
      tagAiDiffCb.addEventListener("change", () => {
        showNameTagAiDifficulty = tagAiDiffCb.checked;
        saveNameTagAiDifficulty();
      });
    }
    const tagPlayerNumCb = document.getElementById("setting-nametag-playernum");
    if (tagPlayerNumCb) {
      tagPlayerNumCb.checked = showNameTagPlayerNum;
      tagPlayerNumCb.addEventListener("change", () => {
        showNameTagPlayerNum = tagPlayerNumCb.checked;
        saveNameTagPlayerNum();
      });
    }
    const overheadHpCb = document.getElementById("setting-overhead-hp");
    if (overheadHpCb) {
      overheadHpCb.checked = showOverheadHpBars;
      overheadHpCb.addEventListener("change", () => {
        showOverheadHpBars = overheadHpCb.checked;
        saveOverheadHpBars();
      });
    }
    const shapesCb = document.getElementById("setting-unique-shapes");
    if (shapesCb) {
      shapesCb.checked = showUniqueShapes;
      shapesCb.addEventListener("change", () => {
        showUniqueShapes = shapesCb.checked;
        saveUniqueShapes();
      });
    }
    const arrowCb = document.getElementById("setting-facing-arrow");
    if (arrowCb) {
      arrowCb.checked = showFacingArrow;
      arrowCb.addEventListener("change", () => {
        showFacingArrow = arrowCb.checked;
        saveFacingArrow();
      });
    }
    const mouseAimCb = document.getElementById("setting-mouse-aim");
    if (mouseAimCb) {
      mouseAimCb.checked = useMouseAimP1;
      mouseAimCb.addEventListener("change", () => {
        useMouseAimP1 = mouseAimCb.checked;
        saveMouseAim();
      });
    }
    const tabBtns = document.querySelectorAll(".mode-screen-tab");
    for (let i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener("click", () => {
        setModeTab(tabBtns[i].getAttribute("data-mode-tab") || "play");
      });
    }
    applyHelpVisibility();
  }

  function setHelpText() {
    if (!helpEl) return;
    const { humans, ai } = readRoster();
    let rosterHint = "";
    if (bossPickerOpen) {
      helpEl.innerHTML =
        "Choose a boss, then continue to <strong>arena modifiers</strong>. <kbd>M</kbd> back to mode select.";
      applyHelpVisibility();
      return;
    }
    if (mapPickerOpen) {
      const rt = ricochetMapTuning();
      let ricHint = "";
      if (mapModifiers.maze) {
        ricHint =
          " <strong>Ricochet</strong>: nerfed hard in the Labyrinth — tight corridors hand bolts too many bounces, so damage, bounce scaling, and max bounces are all cut well below the open-floor baseline.";
      } else if (mapModifiers.bounds === "rect") {
        ricHint =
          " <strong>Ricochet</strong>: strongly buffed on Classic box — higher damage, stronger bounce scaling, more life & bounces, faster fire.";
      } else if (rt.damageMul >= 1.1 && rt.bounceDmgMul <= 0.8) {
        ricHint =
          " <strong>Ricochet</strong>: buffed here — higher base damage, fewer wall scalings.";
      } else if (rt.bounceDmgMul <= 0.68) {
        ricHint =
          " <strong>Ricochet</strong>: nerfed here — wall-bounce damage is much lower.";
      } else if (rt.bounceDmgMul < 0.8) {
        ricHint =
          " <strong>Ricochet</strong>: slightly weaker wall-bounce scaling on this map.";
      }
      if (mapHasCreatures()) {
        ricHint +=
          " <strong>Critters</strong>: weak spawns damage all fighters.";
      }
      helpEl.innerHTML =
        "Toggle arena modifiers, then continue to <strong>character select</strong>. " +
        "<em>" +
        mapModifiersSummary() +
        "</em>" +
        ricHint +
        " <kbd>M</kbd> back" +
        (gameMode === "boss" ? " to boss select" : " to mode select") +
        ".";
      applyHelpVisibility();
      return;
    }
    if (characterPickerOpen) {
      const rosterLine =
        "<strong>Humans</strong> (0–" +
        Math.min(HUMAN_PRESETS.length, MAX_TEAM_FIGHTERS) +
        ") and <strong>AI</strong> count at the top — up to <strong>" +
        MAX_TEAM_FIGHTERS +
        "</strong> fighters total. ";
      const livesLine =
        gameMode === "versus" || gameMode === "teams" || gameMode === "boss"
          ? " Set <strong>lives each</strong> for longer matches (Versus, Teams, Boss). "
          : " ";
      if (gameMode === "teams") {
        helpEl.innerHTML =
          rosterLine +
          livesLine +
          "Pick a character and a team (A-D, at least two teams used) for each fighter, then <strong>Start fight</strong>. <kbd>M</kbd> back to map setup.";
      } else {
        helpEl.innerHTML =
          rosterLine +
          livesLine +
          "Choose a fighter for each slot, then press <strong>Start fight</strong>. Versus and Teams need at least two fighters. <kbd>M</kbd> back to map setup.";
      }
      applyHelpVisibility();
      return;
    }
    if (gameMode == null) {
      rosterHint =
        "Set <strong>humans</strong> and <strong>AI</strong> on character select (up to <strong>" +
        MAX_TEAM_FIGHTERS +
        "</strong> fighters). ";
    } else if (humans === 0) {
      rosterHint =
        " <strong>AI-only</strong> — " +
        ai +
        " computer fighter" +
        (ai === 1 ? "" : "s") +
        ".";
    } else if (ai === 0) {
      rosterHint = "";
    } else if (ai === 1) {
      rosterHint = " Includes one AI teammate.";
    } else {
      rosterHint = " Includes " + ai + " AI teammates.";
    }

    const soloWarn =
      humans === 1
        ? " Only one human slot (<kbd>P1</kbd> controls)."
        : humans === 0
          ? " No keyboard fighters — watch or use <kbd>R</kbd> / <kbd>M</kbd> between rounds."
          : "";
    const creatureHint = mapHasCreatures()
      ? " Weak critters spawn at random and damage all fighters."
      : "";
    const livesN = readLivesPerPlayer();
    const livesHint =
      livesN > 1 &&
      (gameMode === "versus" || gameMode === "teams" || gameMode === "boss")
        ? " Each fighter has <strong>" + livesN + " lives</strong>."
        : "";
    const aimHint = useMouseAimP1
      ? " <strong>P1 aim</strong>: mouse — left click attack, right click ult (toggle in Settings)."
      : "";
    const gamepadSlots = connectedGamepadSlots();
    const gamepadHint =
      gamepadSlots.length > 0
        ? " <strong>" +
          gamepadSlots.map((slot) => "P" + (slot + 1)).join("/") +
          " gamepad</strong>: left stick move, right stick aim, R2 attack, L2 ult, Square support."
        : " Connect a gamepad for <strong>P2</strong> (and beyond): left stick move, right stick aim, R2 attack.";
    const controlsAddendum = aimHint + gamepadHint;

    if (gameMode === "versus") {
      helpEl.innerHTML =
        "<strong>Versus</strong> — free-for-all, " +
        (livesN > 1 ? "last fighter with lives remaining" : "last fighter standing") +
        "." +
        livesHint +
        creatureHint +
        rosterHint +
        soloWarn +
        "<br /><strong>P1</strong>: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · hold <kbd>Space</kbd> · ult <kbd>C</kbd> · " +
        "<strong>P2</strong>: arrows · hold <kbd>Enter</kbd> · ult <kbd>R Shift</kbd> · " +
        "<strong>P3</strong>: <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> · hold <kbd>O</kbd> · ult <kbd>[</kbd>. Ricochet: hold attack to charge bolts. Ult cooldown shrinks when you deal damage (green ring)." +
        controlsAddendum +
        " <kbd>R</kbd> rematch · <kbd>M</kbd> back · <kbd>Esc</kbd> menu.";
    } else if (gameMode === "teams") {
      helpEl.innerHTML =
        "<strong>Teams</strong> — up to 4 sides (A-D). Teammates cannot hurt each other; eliminate every other team." +
        livesHint +
        creatureHint +
        rosterHint +
        soloWarn +
        "<br /><strong>P1</strong>: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · hold <kbd>Space</kbd> · ult <kbd>C</kbd> · " +
        "<strong>P2</strong>: arrows · hold <kbd>Enter</kbd> · ult <kbd>R Shift</kbd> · " +
        "<strong>P3</strong>: <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> · hold <kbd>O</kbd> · ult <kbd>[</kbd>. Ult: damage lowers cooldown." +
        controlsAddendum +
        " <kbd>R</kbd> rematch · <kbd>M</kbd> back · <kbd>Esc</kbd> menu.";
    } else if (gameMode === "horde") {
      const party = humans + ai;
      helpEl.innerHTML =
        "<strong>Horde</strong> — co-op wave survival. Waves scale with your team size (<strong>" +
        party +
        " fighters</strong> — more enemies, tougher stats). Every <strong>" +
        HORDE_BOSS_WAVE_INTERVAL +
        " waves</strong>, a random boss appears (Colossus, Reaver, or Hexwright) instead of the horde — boss power scales with wave and roster. Varied types: melee, spitters, chargers, slammers. Downed allies bleed out; hold support to <strong>heal</strong> or <strong>revive</strong>." +
        rosterHint +
        soloWarn +
        "<br /><strong>P1</strong>: move <kbd>WASD</kbd> · attack <kbd>Space</kbd> · ult <kbd>C</kbd> · support <kbd>B</kbd> · " +
        "<strong>P2</strong>: arrows · attack <kbd>Enter</kbd> · ult <kbd>R Shift</kbd> · support <kbd>/</kbd> · " +
        "<strong>P3</strong>: <kbd>IJKL</kbd> · attack <kbd>O</kbd> · ult <kbd>[</kbd> · support <kbd>P</kbd>." +
        controlsAddendum +
        " <kbd>R</kbd> rematch · <kbd>M</kbd> back · <kbd>Esc</kbd> menu.";
    } else if (gameMode === "boss") {
      const party = humans + ai;
      const bdef = getBossDef(selectedBossId);
      const scale = getBossScaling(selectedBossId, party);
      const bossHint =
        selectedBossId === "reaver"
          ? " Reaver heals on hit, Soul Grasp on contact, Ruin Burst up close, Soul Hook at range."
          : selectedBossId === "hexwright"
            ? " Hexwright throws toxic puddles, teleports away leaving slime, and summons thralls."
            : " Colossus pounds up close and scorches at mid range.";
      helpEl.innerHTML =
        "<strong>Team vs " +
        bdef.name +
        "</strong> — humans + AI teammates don't hurt each other. Boss scales to your team size and lives (<strong>" +
        party +
        " fighters</strong>" +
        (scale.lives > 1 ? ", <strong>" + scale.lives + " lives each</strong>" : "") +
        ": " +
        scale.maxHp +
        " HP, damage ×" +
        scale.damageMultiplier.toFixed(1) +
        ")." +
        livesHint +
        bossHint +
        creatureHint +
        rosterHint +
        soloWarn +
        "<br /><strong>P1</strong>: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · hold <kbd>Space</kbd> · ult <kbd>C</kbd> · " +
        "<strong>P2</strong>: arrows · hold <kbd>Enter</kbd> · ult <kbd>R Shift</kbd> · " +
        "<strong>P3</strong>: <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> · hold <kbd>O</kbd> · ult <kbd>[</kbd>." +
        controlsAddendum +
        " <kbd>R</kbd> rematch · <kbd>M</kbd> back · <kbd>Esc</kbd> menu.";
    } else {
      helpEl.innerHTML =
        rosterHint +
        " Pick a mode. During a fight: <kbd>R</kbd> rematch, <kbd>M</kbd> back one screen, <kbd>Esc</kbd> main menu.";
    }
    applyHelpVisibility();
  }

  function openModeScreen() {
    gameMode = null;
    modePickerOpen = true;
    mapPickerOpen = false;
    bossPickerOpen = false;
    characterPickerOpen = false;
    gameOver = false;
    winner = null;
    players = [];
    projectiles.length = 0;
    hpEls.forEach((el) => {
      if (el) el.style.width = "0%";
    });
    if (hpBossEl) hpBossEl.style.width = "0%";
    overlay.classList.remove("visible");
    closeCharScreen();
    closeMapScreen();
    closeBossScreen();
    if (modeScreen) modeScreen.classList.add("visible");
    setModeTab("play");
    onRosterControlsChanged();
    setHelpText();
  }

  function selectMode(mode) {
    gameMode = mode;
    if (mode === "boss") {
      openBossScreen();
    } else if (mode === "siege") {
      openCharScreen();
    } else {
      openMapScreen();
    }
  }

  function selectHordeMode() {
    selectMode("horde");
  }

  function startFightFromCharSelect() {
    const roster = readRoster();
    if (roster.total < 1) return;
    if (
      (gameMode === "versus" || gameMode === "teams" || gameMode === "siege") &&
      roster.total < 2
    ) {
      return;
    }
    if (
      (gameMode === "teams" || gameMode === "siege") &&
      !teamsRosterValid()
    ) {
      return;
    }
    closeCharScreen();
    modePickerOpen = false;
    mapPickerOpen = false;
    bossPickerOpen = false;
    // A roster <select> (humans/AI/lives/team) can still hold keyboard
    // focus from setup — left there, arrow-key presses would get eaten by
    // that dropdown instead of reaching movement, so drop focus before
    // the fight actually starts.
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    updateHudLayout();
    setHelpText();
    resetGame();
  }

  function settlePlayerPositions() {
    for (let pass = 0; pass < 4; pass++) {
      separatePlayers();
    }
  }

  function resetGame() {
    if (gameMode == null) return;
    projectiles.length = 0;
    animFx.length = 0;
    winCheckPending = false;
    if (mapModifiers.maze) randomizeMazeVariant();
    initMapRuntime();
    if (gameMode === "horde") resetHordeState();
    players = buildPlayers();
    settlePlayerPositions();
    gameOver = false;
    winner = null;
    overlay.classList.remove("visible");
    updateHudLayout();
    refreshHudLabels();
    resetPaneCameras();
  }

  function localHumans() {
    return players.filter((p) => !p.isBot && !p.isAi);
  }

  function siegeSplitActive() {
    return gameMode === "siege" && localHumans().length === 2;
  }

  /** Seed each pane's camera at its follow target's spawn point so the
   *  first frame doesn't lerp in from some stale prior position. */
  function resetPaneCameras() {
    const ac = arenaCenter();
    paneCameras[0].x = ac.cx;
    paneCameras[0].y = ac.cy;
    paneCameras[1].x = ac.cx;
    paneCameras[1].y = ac.cy;
    if (gameMode !== "siege") return;
    const humans = localHumans();
    for (let i = 0; i < Math.min(2, humans.length); i++) {
      paneCameras[i].x = humans[i].x;
      paneCameras[i].y = humans[i].y;
    }
  }

  if (btnVersus) {
    btnVersus.addEventListener("click", () => selectMode("versus"));
  }
  if (btnTeams) {
    btnTeams.addEventListener("click", () => selectMode("teams"));
  }
  if (btnBoss) {
    btnBoss.addEventListener("click", () => selectMode("boss"));
  }
  if (btnHorde) {
    btnHorde.addEventListener("click", selectHordeMode);
  }
  if (btnSiege) {
    btnSiege.addEventListener("click", () => selectMode("siege"));
  }
  if (humanCountSelect) {
    humanCountSelect.addEventListener("change", () =>
      onRosterControlsChanged()
    );
  }
  if (aiCountSelect) {
    aiCountSelect.addEventListener("change", () => onRosterControlsChanged());
  }
  if (livesCountSelect) {
    livesCountSelect.addEventListener("change", () => onRosterControlsChanged());
  }
  if (btnCharContinue) {
    btnCharContinue.addEventListener("click", startFightFromCharSelect);
  }
  if (btnCharBack) {
    btnCharBack.addEventListener("click", () => {
      closeCharScreen();
      openMapScreen();
    });
  }
  if (btnMapContinue) {
    btnMapContinue.addEventListener("click", () => {
      closeMapScreen();
      openCharScreen();
    });
  }
  if (btnMapBack) {
    btnMapBack.addEventListener("click", () => {
      closeMapScreen();
      if (gameMode === "boss") {
        openBossScreen();
      } else {
        gameMode = null;
        modePickerOpen = true;
        if (modeScreen) modeScreen.classList.add("visible");
        onRosterControlsChanged();
      }
    });
  }
  if (btnBossContinue) {
    btnBossContinue.addEventListener("click", () => {
      if (!selectedBossId) return;
      closeBossScreen();
      openMapScreen();
    });
  }
  if (btnBossBack) {
    btnBossBack.addEventListener("click", () => {
      closeBossScreen();
      gameMode = null;
      modePickerOpen = true;
      if (modeScreen) modeScreen.classList.add("visible");
      onRosterControlsChanged();
    });
  }

  loadSettings();
  initSettingsUI();
  openModeScreen();

  function resolvePlayerWall(p) {
    const r = getPlayerRadius(p);
    let res = resolveArenaBoundary(p.x, p.y, p.vx, p.vy, r);
    res = resolveObstacleCollision(res.x, res.y, res.vx, res.vy, r);
    p.x = res.x;
    p.y = res.y;
    p.vx = res.vx;
    p.vy = res.vy;
    const port = tryPortalTeleport(
      p.x,
      p.y,
      p.vx,
      p.vy,
      r,
      "p" + p.playerNum
    );
    if (port) {
      p.x = port.x;
      p.y = port.y;
      p.vx = port.vx;
      p.vy = port.vy;
    }
  }

  function steerPlayer(p, dt) {
    tickNovaChaosKnock(p, dt);
    tickUniversalRegen(p, dt);
    tickFighterRespawn(p, dt);
    tickBulwarkRegen(p, dt);
    tickPhoenixRevive(p, dt);
    tickBulwarkBarrage(p, dt);
    if (!p.isBot) tickUltimateState(p, dt);
    if ((p.marionetteUltWindupT || 0) > 0) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      return;
    }
    if (isPhoenix(p) && p.phoenixReviving) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if (gameMode === "horde" && isHordeHeroDowned(p)) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if ((p.respawnT || 0) > 0) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if (p.hp <= 0) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    tickReaverRuinRoot(p, dt);
    tickReaverHookDisarm(p, dt);
    if (p.stunT > 0) {
      p.stunT = Math.max(0, p.stunT - dt);
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      return;
    }
    if (isReaverRuinRooted(p)) {
      p.vx = 0;
      p.vy = 0;
    }
    if (isDashing(p)) {
      updateDash(p, dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if (isGrappler(p) && grapplerHookBusy(p)) {
      tickGrapplerHook(p, dt);
      if (p.grapplerHookFacing != null) p.facing = p.grapplerHookFacing;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.isBot) {
        p.vx *= 0.25;
        p.vy *= 0.25;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        resolvePlayerWall(p);
        return;
      }
      if (p.isAi) {
        p.vx *= 0.3;
        p.vy *= 0.3;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        resolvePlayerWall(p);
        return;
      }
      const cHook = p.controls;
      let hx = 0;
      let hy = 0;
      if (keys[cHook.left]) hx -= 1;
      if (keys[cHook.right]) hx += 1;
      if (keys[cHook.up]) hy -= 1;
      if (keys[cHook.down]) hy += 1;
      applyMovementFromAxes(p, hx, hy, dt, 0.28);
      if (p.grapplerHookFacing != null) p.facing = p.grapplerHookFacing;
      return;
    }
    if (p.isBot) {
      steerBot(p, dt);
      return;
    }
    if (p.isAi) {
      steerAllyAi(p, dt);
      return;
    }
    const c = p.controls;
    const ultKey = c.ultimate;
    if (ultKey) {
      const ultDown = !!keys[ultKey];
      if (ultDown && !p.ultKeyWasDown) tryUseUltimate(p);
      p.ultKeyWasDown = ultDown;
    }

    let ix = 0;
    let iy = 0;
    if (keys[c.left]) ix -= 1;
    if (keys[c.right]) ix += 1;
    if (keys[c.up]) iy -= 1;
    if (keys[c.down]) iy += 1;

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (isPike(p) && p.attackT > 0 && p.lanceSwingFacing != null) {
      p.facing = p.lanceSwingFacing;
    }

    const atk = c.attack;
    if (isLaser(p)) {
      const meltdown = (p.ultLaserT || 0) > 0;
      const wantBeam =
        meltdown || (!!keys[atk] && !gameOver && canPlayerUseAttacks(p));
      setLaserBeamActive(p, wantBeam);
      if (p.beamActive) {
        if (meltdown) {
          // Ultimate ("meltdown") beam can be freely re-aimed while firing:
          // mouse/gamepad aim wins if active, otherwise raw movement-key
          // direction steers it directly (the player is rooted in place,
          // so there's no velocity to derive facing from like normal).
          // Either way it turns at a capped rate rather than snapping
          // straight to the target angle. The regular beam attack stays
          // locked to its starting direction below, unchanged.
          let targetAngle = null;
          let isMouseAim = false;
          if (p.aimOverrideAngle != null) {
            targetAngle = p.aimOverrideAngle;
            isMouseAim =
              p.controls === HUMAN_PRESETS[0].controls && useMouseAimP1;
          } else if (ix !== 0 || iy !== 0) {
            targetAngle = Math.atan2(iy, ix);
          }
          if (targetAngle != null) {
            const turnSpeed = isMouseAim
              ? LASER_ULT_MOUSE_TURN_SPEED
              : LASER_ULT_TURN_SPEED;
            const maxTurn = turnSpeed * dt;
            let diff = angleDiff(targetAngle, p.facing);
            if (diff > maxTurn) diff = maxTurn;
            else if (diff < -maxTurn) diff = -maxTurn;
            p.facing += diff;
          }
          p.beamFacing = p.facing;
        } else if (p.beamFacing != null) {
          p.facing = p.beamFacing;
        }
        p.vx = 0;
        p.vy = 0;
        tickLaserBeam(p, dt);
        return;
      }
      applyMovementFromAxes(p, ix, iy, dt);
      return;
    }

    applyMovementFromAxes(p, ix, iy, dt);
    // Pike's swing-recovery lock: keep the strike-time facing even though
    // an active aim device (mouse/gamepad) would otherwise override it
    // unconditionally above (previously this relied on the player not
    // moving during recovery to stay under the sp>8 movement-facing gate).
    if (isPike(p) && p.attackT > 0 && p.lanceSwingFacing != null) {
      p.facing = p.lanceSwingFacing;
    }

    if (isSiphon(p) && (p.siphonUltPullT || 0) > 0) {
      p.vx *= 0.45;
      p.vy *= 0.45;
    }

    if (p.needsRelease && !keys[atk]) p.needsRelease = false;

    const canCharge =
      !gameOver &&
      p.cooldown <= 0 &&
      p.attackT <= 0 &&
      !p.needsRelease &&
      canPlayerUseAttacks(p);

    if (keys[atk] && canCharge) {
      const ch = tickChargeWhileHeld(p, dt);
      if (ch.fire && !isBulwark(p)) {
        startSwing(p, ch.ratio);
        p.needsRelease = true;
        p.chargeHoldT = 0;
      }
    } else if (!keys[atk]) {
      const held = p.chargeT;
      if (
        !gameOver &&
        held > 0 &&
        p.cooldown <= 0 &&
        p.attackT <= 0 &&
        !p.needsRelease
      ) {
        const raw = held / MAX_CHARGE;
        if (isBulwark(p) && raw < BULWARK_TAP_IGNORE_RAW) {
          /* tap too short — no barrage */
        } else {
          const ratio = isBulwark(p) ? raw : clamp(raw, 0.08, 1);
          startSwing(p, ratio);
          if (isBulwark(p)) {
            p.needsRelease = true;
          }
        }
      }
      p.chargeT = 0;
      p.chargeHoldT = 0;
    }
  }

  function applyMovementFromAxes(p, ix, iy, dt, speedMul) {
    tickSlowDebuff(p, dt);
    tickPhoenixReviveBuff(p, dt);
    if (p.stunT > 0 || isReaverRuinRooted(p)) {
      p.vx = 0;
      p.vy = 0;
      return;
    }
    const sm = moveSpeedMultiplier(p, speedMul);
    const n = norm(ix, iy);
    p.vx += n.x * MOVE_SPEED * sm * dt;
    p.vy += n.y * MOVE_SPEED * sm * dt;
    p.vx *= FRICTION;
    p.vy *= FRICTION;

    const sp = len(p.vx, p.vy);
    const cap = MOVE_SPEED * 0.95 * sm;
    if (sp > cap) {
      const s = cap / sp;
      p.vx *= s;
      p.vy *= s;
    }

    if (p.aimOverrideAngle != null) {
      p.facing = p.aimOverrideAngle;
    } else if (sp > 8) {
      p.facing = Math.atan2(p.vy, p.vx);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    resolvePlayerWall(p);
  }

  function steerReaverBoss(p, dt) {
    tickReaverBoss(p, dt);

    if (p.stunT > 0) {
      p.stunT = Math.max(0, p.stunT - dt);
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }

    p.reaverRuinCd = Math.max(0, (p.reaverRuinCd || 0) - dt);
    p.reaverHookCd = Math.max(0, (p.reaverHookCd || 0) - dt);
    if (p.reaverGraspActiveT > 0) {
      p.reaverGraspActiveT = Math.max(0, p.reaverGraspActiveT - dt);
    }
    if (p.reaverRuinBlastT > 0) {
      p.reaverRuinBlastT = Math.max(0, p.reaverRuinBlastT - dt);
    }
    if (p.reaverHookMissT > 0) {
      p.reaverHookMissT = Math.max(0, p.reaverHookMissT - dt);
      if (p.reaverHookMissT <= 0) p.reaverHookLen = 0;
    }

    const humans = players.filter((pl) => !pl.isBot && pl.hp > 0);
    const nearDist = nearestHumanDist(p);

    if ((p.reaverHookPullT || 0) > 0) {
      tickReaverHookPull(p, dt);
      p.vx *= 0.35;
      p.vy *= 0.35;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.reaverHookActive) {
      tickReaverHookExtend(p, dt);
      p.vx *= 0.2;
      p.vy *= 0.2;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.reaverHookWindup > 0) {
      p.reaverHookWindup = Math.max(0, p.reaverHookWindup - dt);
      p.vx *= 0.45;
      p.vy *= 0.45;
      if (humans.length && nearDist < 1e6) {
        const best = humans.reduce((a, b) =>
          len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
        );
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.reaverHookFacing = Math.atan2(dy, dx);
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.reaverHookWindup <= 0) fireReaverHook(p);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.reaverRuinWindup > 0) {
      p.reaverRuinWindup = Math.max(0, p.reaverRuinWindup - dt);
      p.vx *= 0.55;
      p.vy *= 0.55;
      if (humans.length && nearDist < 1e6) {
        const best = humans.reduce((a, b) =>
          len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
        );
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.reaverRuinWindup <= 0) {
        triggerReaverRuin(p);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.reaverGraspWindup > 0) {
      p.reaverGraspWindup = Math.max(0, p.reaverGraspWindup - dt);
      const graspTgt = reaverGraspTarget(p);
      let ix = 0;
      let iy = 0;
      if (graspTgt && graspTgt.hp > 0) {
        const dx = graspTgt.x - p.x;
        const dy = graspTgt.y - p.y;
        const d = len(dx, dy);
        if (d > 1e-3) {
          p.facing = Math.atan2(dy, dx);
          // Stay mobile during Soul Grasp so Reaver can track a moving target.
          ix = dx / d;
          iy = dy / d;
        }
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.reaverGraspWindup <= 0) {
        const tgt = reaverGraspTarget(p);
        if (tgt && reaverIsTouching(p, tgt)) {
          triggerReaverGrasp(p, tgt);
          p.reaverGraspActiveT = REAVER_GRASP_VFX;
        }
        p.reaverGraspTargetNum = null;
      }
      applyMovementFromAxes(p, ix, iy, dt, p.bossMoveSpeedMul);
      return;
    }

    const graspTarget = reaverNearestTouchingHuman(p);
    const canGrasp =
      graspTarget &&
      !reaverGraspInProgress(p) &&
      p.cooldown <= 0.12 &&
      p.attackT <= 0;
    if (canGrasp) {
      p.reaverGraspWindup = REAVER_GRASP_WINDUP;
      p.reaverGraspTargetNum = graspTarget.playerNum;
      p.chargeT = 0;
      p.chargeHoldT = 0;
      return;
    }

    const canHook =
      humans.length &&
      nearDist >= REAVER_HOOK_TRIGGER_MIN &&
      nearDist <= REAVER_HOOK_TRIGGER_MAX &&
      (p.reaverHookCd || 0) <= 0 &&
      p.cooldown <= 0.15 &&
      p.attackT <= 0;
    if (canHook) {
      p.reaverHookWindup = REAVER_HOOK_WINDUP;
      p.reaverHookCd = REAVER_HOOK_COOLDOWN;
      const best = humans.reduce((a, b) =>
        len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
      );
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.reaverHookFacing = Math.atan2(dy, dx);
      p.chargeT = 0;
      p.chargeHoldT = 0;
      return;
    }

    const canRuin =
      humans.length &&
      nearDist <= REAVER_RUIN_TRIGGER_DIST &&
      (p.reaverRuinCd || 0) <= 0 &&
      p.cooldown <= 0 &&
      p.attackT <= 0;
    if (canRuin) {
      const victims = reaverRuinHumansInRange(
        p,
        REAVER_RUIN_RADIUS * 0.92
      );
      if (victims >= 1 && (nearDist < 92 || victims >= 2)) {
        p.reaverRuinWindup = REAVER_RUIN_WINDUP;
        p.reaverRuinCd = REAVER_RUIN_COOLDOWN;
        p.chargeT = 0;
        p.chargeHoldT = 0;
        return;
      }
    }

    let ix = 0;
    let iy = 0;
    let dist = nearDist < 1e6 ? nearDist : 0;
    let best = null;

    if (humans.length) {
      best = humans[0];
      let bestD = len(best.x - p.x, best.y - p.y);
      for (let h = 1; h < humans.length; h++) {
        const pl = humans[h];
        const d = len(pl.x - p.x, pl.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = pl;
        }
      }
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      dist = len(dx, dy);
      const graspReach =
        getPlayerRadius(p) + getPlayerRadius(best) + REAVER_GRASP_TOUCH_PAD + 14;
      if (dist > 52) {
        ix = dx / dist;
        iy = dy / dist;
      } else if (dist > graspReach && dist > 1e-3) {
        ix = (dx / dist) * 0.92;
        iy = (dy / dist) * 0.92;
      } else if (dist > 1e-3) {
        ix = (dx / dist) * 0.95;
        iy = (dy / dist) * 0.95;
      }
    }

    if (humans.length && best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
    }

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.chargeT = 0;
    p.chargeHoldT = 0;

    tickAiStuck(p, dt, len(ix, iy) > 0.12);
    const nav = aiSteerNav(
      p,
      ix,
      iy,
      best ? best.x : null,
      best ? best.y : null
    );
    applyMovementFromAxes(p, nav.ix, nav.iy, dt, p.bossMoveSpeedMul);
  }

  function steerHexwrightBoss(p, dt) {
    if (p.stunT > 0) {
      p.stunT = Math.max(0, p.stunT - dt);
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }

    p.hexBottleCd = Math.max(0, (p.hexBottleCd || 0) - dt);
    p.hexSummonCd = Math.max(0, (p.hexSummonCd || 0) - dt);
    p.hexTeleportCd = Math.max(0, (p.hexTeleportCd || 0) - dt);
    if (p.hexTeleportBlastT > 0) {
      p.hexTeleportBlastT = Math.max(0, p.hexTeleportBlastT - dt);
    }

    const humans = players.filter((pl) => !pl.isBot && pl.hp > 0);
    const nearDist = nearestHumanDist(p);
    const minionCount = mapRuntime.bossMinions.length;

    if (p.hexTeleportWindup > 0) {
      p.hexTeleportWindup = Math.max(0, p.hexTeleportWindup - dt);
      p.vx = 0;
      p.vy = 0;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.hexTeleportWindup <= 0) {
        executeHexwrightTeleport(p);
      }
      return;
    }

    if (p.hexSummonWindup > 0) {
      p.hexSummonWindup = Math.max(0, p.hexSummonWindup - dt);
      p.vx *= 0.35;
      p.vy *= 0.35;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.hexSummonWindup <= 0) {
        summonHexwrightThralls(p);
        p.hexSummonCd = HEX_SUMMON_COOLDOWN;
        p.cooldown = Math.max(p.cooldown, 0.5);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.hexBottleWindup > 0) {
      p.hexBottleWindup = Math.max(0, p.hexBottleWindup - dt);
      p.vx *= 0.5;
      p.vy *= 0.5;
      if (humans.length && nearDist < 1e6) {
        const best = humans.reduce((a, b) =>
          len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
        );
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.hexBottleWindup <= 0) {
        throwHexwrightBottle(p, p.facing);
        p.hexBottleCd = HEX_BOTTLE_COOLDOWN;
        p.cooldown = Math.max(p.cooldown, 0.22);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    let ix = 0;
    let iy = 0;
    let dist = nearDist < 1e6 ? nearDist : 0;
    let best = null;

    const canSummon =
      humans.length &&
      minionCount < hexwrightMaxMinions(p) &&
      (p.hexSummonCd || 0) <= 0 &&
      p.cooldown <= 0 &&
      p.attackT <= 0;

    const canBottle =
      humans.length &&
      nearDist >= Math.max(HEX_BOTTLE_TRIGGER_MIN, HEX_KITE_DIST_MIN) &&
      nearDist <= HEX_BOTTLE_TRIGGER_MAX &&
      (p.hexBottleCd || 0) <= 0 &&
      p.cooldown <= 0 &&
      p.attackT <= 0;

    const canTeleport =
      humans.length &&
      nearDist <= HEX_TELEPORT_TRIGGER_DIST &&
      nearDist >= 32 &&
      (p.hexTeleportCd || 0) <= 0 &&
      p.cooldown <= 0.15 &&
      p.attackT <= 0;

    if (canBottle) {
      p.hexBottleWindup = HEX_BOTTLE_WINDUP;
      const bestH = humans.reduce((a, b) =>
        len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
      );
      const dx = bestH.x - p.x;
      const dy = bestH.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      p.chargeT = 0;
      return;
    }
    if (canTeleport) {
      p.hexTeleportWindup = HEX_TELEPORT_WINDUP;
      p.chargeT = 0;
      return;
    }
    if (
      canSummon &&
      (minionCount === 0 ||
        (minionCount < hexwrightMaxMinions(p) - 2 && (p.hexBottleCd || 0) > 2.5))
    ) {
      p.hexSummonWindup = HEX_SUMMON_WINDUP;
      p.chargeT = 0;
      return;
    }

    if (humans.length) {
      best = humans[0];
      let bestD = len(best.x - p.x, best.y - p.y);
      for (let h = 1; h < humans.length; h++) {
        const pl = humans[h];
        const d = len(pl.x - p.x, pl.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = pl;
        }
      }
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      dist = len(dx, dy);
      const kite = hexwrightKiteAxes(p, dx, dy, dist);
      ix = kite.ix;
      iy = kite.iy;
    }

    if (humans.length && best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
    }

    tickAiStuck(p, dt, len(ix, iy) > 0.12);
    const nav = aiSteerNav(
      p,
      ix,
      iy,
      best ? best.x : null,
      best ? best.y : null
    );
    applyMovementFromAxes(p, nav.ix, nav.iy, dt, p.bossMoveSpeedMul);

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.botMustRelease = false;
  }

  function steerBot(p, dt) {
    tickNovaChaosKnock(p, dt);
    if (p.stunT > 0) {
      p.stunT = Math.max(0, p.stunT - dt);
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if (p.bossId === "reaver") {
      steerReaverBoss(p, dt);
      return;
    }
    if (p.bossId === "hexwright") {
      steerHexwrightBoss(p, dt);
      return;
    }
    p.poundCd = Math.max(0, p.poundCd - dt);
    p.beamCd = Math.max(0, p.beamCd - dt);
    if (p.poundBlastT > 0) {
      p.poundBlastT = Math.max(0, p.poundBlastT - dt);
    }

    const humans = players.filter((pl) => !pl.isBot && pl.hp > 0);
    const nearDist = nearestHumanDist(p);

    if (p.beamActiveT > 0) {
      p.beamActiveT = Math.max(0, p.beamActiveT - dt);
      const sweepDir = p.beamSweepDir != null ? p.beamSweepDir : 1;
      p.beamFacing += BOSS_BEAM_SWEEP_SPEED * sweepDir * dt;
      p.facing = p.beamFacing;
      if (p.beamActiveT <= 0) {
        p.beamSweepDir = 0;
      }
      p.vx *= 0.65;
      p.vy *= 0.65;
      tickBossBeam(p, dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    if (p.beamWindup > 0) {
      p.beamWindup = Math.max(0, p.beamWindup - dt);
      p.vx = 0;
      p.vy = 0;
      // Keep the telegraph locked — no tracking after aim is set.
      if (p.beamFacing != null) p.facing = p.beamFacing;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.beamWindup <= 0) {
        startBossBeam(p);
        p.beamCd = p.bossBeamCooldown;
      }
      resolvePlayerWall(p);
      return;
    }

    if (p.poundWindup > 0) {
      p.poundWindup = Math.max(0, p.poundWindup - dt);
      p.vx *= 0.82;
      p.vy *= 0.82;
      if (humans.length && nearDist < 1e6) {
        const best = humans.reduce((a, b) =>
          len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
        );
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.poundWindup <= 0) {
        triggerGroundPound(p);
        p.poundCd = p.bossPoundCooldown;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolvePlayerWall(p);
      return;
    }

    let ix = 0;
    let iy = 0;
    let dist = nearDist < 1e6 ? nearDist : 0;
    let best = null;

    const canPound =
      humans.length &&
      p.poundCd <= 0 &&
      nearDist <= POUND_TRIGGER_DIST &&
      p.cooldown <= 0 &&
      p.attackT <= 0;

    const canBeam =
      humans.length &&
      p.beamCd <= 0 &&
      nearDist >= BOSS_BEAM_TRIGGER_MIN &&
      nearDist <= BOSS_BEAM_TRIGGER_MAX &&
      p.cooldown <= 0 &&
      p.attackT <= 0;

    if (canPound) {
      p.poundWindup = POUND_WINDUP;
      p.chargeT = 0;
      p.poundCd = p.bossPoundCooldown;
    } else if (canBeam) {
      p.beamWindup = BOSS_BEAM_WINDUP;
      // Lock aim at commit so the preview stays put through windup.
      if (humans.length && nearDist < 1e6) {
        const aim = humans.reduce((a, b) =>
          len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a
        );
        const adx = aim.x - p.x;
        const ady = aim.y - p.y;
        if (len(adx, ady) > 1e-3) p.facing = Math.atan2(ady, adx);
      }
      p.beamFacing = p.facing;
      p.chargeT = 0;
      p.beamCd = p.bossBeamCooldown;
    }

    if (humans.length) {
      best = humans[0];
      let bestD = len(best.x - p.x, best.y - p.y);
      for (let h = 1; h < humans.length; h++) {
        const pl = humans[h];
        const d = len(pl.x - p.x, pl.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = pl;
        }
      }
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      dist = len(dx, dy);
      if (dist > 62) {
        ix = dx / dist;
        iy = dy / dist;
      } else if (dist < 36 && dist > 1e-3) {
        ix = (-dx / dist) * 0.9;
        iy = (-dy / dist) * 0.9;
      } else if (dist > 1e-3) {
        const sn = Math.sin(performance.now() * 0.0033) > 0 ? 1 : -1;
        ix = (-dy / dist) * sn * 0.75;
        iy = (dx / dist) * sn * 0.75;
      }
    }

    tickAiStuck(p, dt, len(ix, iy) > 0.12);
    const nav = aiSteerNav(
      p,
      ix,
      iy,
      best ? best.x : null,
      best ? best.y : null
    );
    applyMovementFromAxes(p, nav.ix, nav.iy, dt, p.bossMoveSpeedMul);

    if (humans.length && best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
    }

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);

    if (p.botMustRelease && p.attackT <= 0 && p.cooldown <= 0) {
      p.botMustRelease = false;
    }

    const canCharge =
      !gameOver && p.cooldown <= 0 && p.attackT <= 0 && !p.botMustRelease;

    const wantsCharge =
      humans.length > 0 &&
      dist < 70 * BOSS_ATTACK_RANGE_MUL + 24 &&
      dist > 30 &&
      !p.botMustRelease;

    if (wantsCharge && canCharge) {
      const ch = tickChargeWhileHeld(p, dt);
      if (ch.fire) {
        startSwing(p, ch.ratio);
        p.botMustRelease = true;
        p.chargeHoldT = 0;
      }
    } else {
      if (
        p.chargeT > 0 &&
        canCharge &&
        !gameOver &&
        p.cooldown <= 0 &&
        p.attackT <= 0 &&
        !p.botMustRelease
      ) {
        const ratio = clamp(p.chargeT / MAX_CHARGE, 0.1, 1);
        startSwing(p, ratio);
      }
      p.chargeT = 0;
      p.chargeHoldT = 0;
    }
  }

  function aiCombatRangeBase(p) {
    if (p.attackStyle === "ranged" && isGrappler(p)) {
      // Grapple bolts do far more damage close-in (GRAPPLE_CLOSE_DMG_MUL vs
      // GRAPPLE_FAR_DMG_MUL) and the ult reels a foe in to follow up on —
      // the shared Marksman-style "hold max range" profile below fights
      // that design, so Grappler gets its own close-favoring one.
      const maxR = RANGED_MAX_DIST * (p.rangedRangeMul != null ? p.rangedRangeMul : 1);
      return {
        chase: maxR * 0.75,
        close: maxR * 0.12,
        chargeMin: maxR * 0.05,
        chargeMax: maxR * 0.55,
      };
    }
    if (p.attackStyle === "ranged") {
      const maxR = RANGED_MAX_DIST * (p.rangedRangeMul != null ? p.rangedRangeMul : 1);
      return {
        chase: maxR * 0.98,
        close: maxR * MARKSMAN_AI_KITE_MIN_MUL * 0.88,
        chargeMin: maxR * MARKSMAN_AI_RANGE_MIN_MUL,
        chargeMax: maxR * MARKSMAN_AI_RANGE_MAX_MUL,
      };
    }
    if (p.attackStyle === "nova") {
      // Nova's burst phases through every fighter in its path, so it's
      // worth the most when fired from inside a cluster of enemies, not
      // poked from Scatter's mid-range comfort zone — the AI should dive
      // to near point-blank and stay there instead of hovering back.
      const maxR = novaDistForPlayer(p, 1);
      return {
        chase: maxR * 0.92,
        close: maxR * 0.05,
        chargeMin: 0,
        chargeMax: maxR * 0.62,
      };
    }
    if (p.attackStyle === "spread") {
      const maxR = spreadDistForPlayer(p, 1);
      return {
        chase: maxR * 0.92,
        close: maxR * 0.2,
        chargeMin: maxR * 0.12,
        chargeMax: maxR * 0.62,
      };
    }
    if (p.attackStyle === "dash") {
      return {
        chase: DASH_DIST_MAX + 36,
        close: DASH_DIST_MIN * 0.65,
        chargeMin: DASH_DIST_MIN * 0.78,
        chargeMax: DASH_DIST_MAX + 18,
      };
    }
    if (p.attackStyle === "phoenix") {
      if (phoenixUltAttackActive(p)) {
        const shotR = PHOENIX_SHOT_RANGE;
        return {
          chase: shotR * 0.94,
          close: PHOENIX_AI_ULT_TOO_CLOSE,
          chargeMin: shotR * PHOENIX_AI_ULT_KITE_MIN_MUL,
          chargeMax: shotR * PHOENIX_AI_ULT_KITE_MAX_MUL,
        };
      }
      const shotR = PHOENIX_SHOT_RANGE * 0.72;
      return {
        chase: shotR * 0.96,
        close: PHOENIX_AI_TOO_CLOSE,
        chargeMin: shotR * PHOENIX_AI_KITE_MIN_MUL,
        chargeMax: shotR * PHOENIX_AI_KITE_MAX_MUL,
      };
    }
    if (p.attackStyle === "barrage") {
      return {
        chase: BULWARK_BARRAGE_MAX_DIST * 0.82,
        close: 36,
        chargeMin: 18,
        chargeMax: BULWARK_BARRAGE_MAX_DIST * 0.95,
      };
    }
    if (p.attackStyle === "aura") {
      return {
        chase: 56,
        close: 22,
        chargeMin: 0,
        chargeMax: AURA_RADIUS_MAX + getPlayerRadius(p) + 12,
      };
    }
    if (p.attackStyle === "bounce") {
      return {
        chase: RICOCHET_MAX_DIST * 0.88,
        close: 48,
        chargeMin: 0,
        chargeMax: RICOCHET_MAX_DIST * 0.95,
      };
    }
    if (p.attackStyle === "beam") {
      return {
        chase: LASER_RANGE * 0.92,
        close: LASER_RANGE * 0.28,
        chargeMin: LASER_RANGE * 0.2,
        chargeMax: LASER_RANGE * 0.98,
      };
    }
    if (p.attackStyle === "lance") {
      return {
        chase: LANCE_RANGE_MAX * 0.92,
        close: LANCE_RANGE_MIN * 0.42,
        chargeMin: LANCE_RANGE_MIN * 0.55,
        chargeMax: LANCE_RANGE_MAX * 0.95,
      };
    }
    return { chase: 62, close: 36, chargeMin: 30, chargeMax: 94 };
  }

  /** Layers difficulty-scaled self-preservation on top of the per-style base
   *  ranges: the lower an AI's HP, the farther out a cautious (high
   *  selfPreserveMul) fighter starts backing off; a reckless one (Easy)
   *  barely changes its behavior at all when hurt. */
  function aiCombatRange(p) {
    const base = aiCombatRangeBase(p);
    if (!p.isAi || !(p.maxHp > 0)) return base;
    const skill = getAiSkill(p);
    const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
    const hurtT = clamp(
      (AI_SELF_PRESERVE_HP_FRAC - hpFrac) / AI_SELF_PRESERVE_HP_FRAC,
      0,
      1
    );
    const retreatMul =
      1 + hurtT * skill.selfPreserveMul * AI_SELF_PRESERVE_CLOSE_MUL;
    return {
      chase: base.chase,
      close: base.close * retreatMul,
      chargeMin: base.chargeMin,
      chargeMax: base.chargeMax,
    };
  }

  function aiStrikerTravelDist(dist) {
    return clamp(
      dist - PLAYER_R * 1.15,
      DASH_DIST_MIN * 0.92,
      DASH_DIST_MAX * 0.97
    );
  }

  function aiStrikerChargeGoal(dist) {
    const travel = aiStrikerTravelDist(dist);
    return clamp(
      (travel - DASH_DIST_MIN) / (DASH_DIST_MAX - DASH_DIST_MIN),
      0.38,
      1
    );
  }

  function allyAiMoveStriker(p, best, dist, ix, iy) {
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (dist < 1e-3) return { ix, iy };
    const ideal = aiStrikerTravelDist(dist);
    if (dist > ideal + STRIKER_AI_DIST_MARGIN) {
      return { ix: dx / dist, iy: dy / dist };
    }
    const isStriker = p.characterId === "striker";
    if (isStriker && dist < DASH_DIST_MIN * 0.9) {
      const sn = Math.sin(performance.now() * 0.0028 + p.playerNum * 1.7) > 0 ? 1 : -1;
      return {
        ix: (-dy / dist) * sn * 0.5,
        iy: (dx / dist) * sn * 0.5,
      };
    }
    if (dist < DASH_DIST_MIN * 0.82) {
      return { ix: (-dx / dist) * 0.95, iy: (-dy / dist) * 0.95 };
    }
    const sn = Math.sin(performance.now() * 0.0028 + p.playerNum * 1.7) > 0 ? 1 : -1;
    return {
      ix: ix + (-dy / dist) * sn * 0.4,
      iy: iy + (dx / dist) * sn * 0.4,
    };
  }

  function allyAiMoveScatter(p, best, dist, ix, iy) {
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (dist < 1e-3) return { ix, iy };
    const nova = isNova(p);
    const maxR = nova ? novaDistForPlayer(p, 1) : spreadDistForPlayer(p, 1);
    // Nova wants to be right on top of (inside) the enemy so the phasing
    // burst clips them every time, not hovering at Scatter's poke range.
    const sweetMin = nova ? 0 : maxR * 0.18;
    const sweetMax = nova ? maxR * 0.14 : maxR * 0.52;
    if (dist > sweetMax) {
      const urge = nova ? 1.18 : 1.05;
      return { ix: (dx / dist) * urge, iy: (dy / dist) * urge };
    }
    if (dist < sweetMin) {
      return { ix: (-dx / dist) * 0.75, iy: (-dy / dist) * 0.75 };
    }
    const sn = Math.sin(performance.now() * 0.0038 + p.playerNum * 1.3) > 0 ? 1 : -1;
    return {
      ix: ix + (-dy / dist) * sn * 0.45,
      iy: iy + (dx / dist) * sn * 0.45,
    };
  }

  function allyAiMoveMarksman(p, best, dist, ix, iy) {
    const skill = getAiSkill(p);
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (dist < 1e-3) return { ix, iy };
    const maxR =
      RANGED_MAX_DIST * (p.rangedRangeMul != null ? p.rangedRangeMul : 1);
    const kite = skill.kiteMul;
    // Grappler's damage is inverted from Marksman's (best up close, worst at
    // range — see GRAPPLE_CLOSE_DMG_MUL/GRAPPLE_FAR_DMG_MUL), so it needs
    // its own tight, close-in sweet spot instead of the standard kiting band.
    const grappler = isGrappler(p);
    const sweetMin = grappler
      ? maxR * 0.05 * (0.92 + 0.08 * kite)
      : maxR * MARKSMAN_AI_KITE_MIN_MUL * (0.92 + 0.08 * kite);
    const sweetMax = grappler
      ? maxR * 0.42 * (0.94 + 0.06 * kite)
      : maxR * MARKSMAN_AI_KITE_MAX_MUL * (0.94 + 0.06 * kite);
    const sweetMid = (sweetMin + sweetMax) * 0.5;
    if (dist < sweetMin) {
      const panic = dist < sweetMin * 0.65 ? 1.28 * kite : 1.05 * kite;
      return { ix: (-dx / dist) * panic, iy: (-dy / dist) * panic };
    }
    if (dist > sweetMax) {
      const urge = dist > maxR * 0.92 ? 1.12 * kite : 0.88 * kite;
      return { ix: (dx / dist) * urge, iy: (dy / dist) * urge };
    }
    const toMid = (sweetMid - dist) / Math.max(sweetMax - sweetMin, 1);
    const sn =
      Math.sin(performance.now() * 0.0037 + p.playerNum * 1.7) > 0 ? 1 : -1;
    const nx = -dy / dist;
    const ny = dx / dist;
    return {
      ix: nx * sn * 0.98 + (dx / dist) * toMid * 0.4,
      iy: ny * sn * 0.98 + (dy / dist) * toMid * 0.4,
    };
  }

  function allyAiMarksmanAimPoint(p, best) {
    const skill = getAiSkill(p);
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    const dist = Math.max(len(dx, dy), 1);
    const chargeFrac = clamp((p.chargeT || 0) / MAX_CHARGE, 0.35, 1);
    const boltSpeed = RANGED_SPEED * (0.55 + 0.45 * chargeFrac);
    const eta = dist / Math.max(boltSpeed, 1);
    const lead = MARKSMAN_AI_LEAD * skill.leadMul;
    return {
      x: best.x + (best.vx || 0) * eta * lead,
      y: best.y + (best.vy || 0) * eta * lead,
    };
  }

  function allyAiFaceMarksman(p, best) {
    const skill = getAiSkill(p);
    const aim = allyAiMarksmanAimPoint(p, best);
    const dx = aim.x - p.x;
    const dy = aim.y - p.y;
    if (len(dx, dy) < 1e-3) return;
    const base = Math.atan2(dy, dx);
    const spread = MARKSMAN_AI_AIM_SPREAD * skill.aimSpreadMul;
    if ((p.chargeT || 0) <= 0 && (p.attackT || 0) <= 0) {
      p.aiAimError = (Math.random() - 0.5) * spread;
    } else {
      p.aiAimError = (p.aiAimError || 0) * 0.88;
    }
    const wobble =
      Math.sin(performance.now() * 0.0028 + p.playerNum) *
      0.035 *
      skill.aimWobbleMul;
    p.facing = base + (p.aiAimError || 0) + wobble;
  }

  function allyAiFacePhoenixTarget(p, best) {
    const skill = getAiSkill(p);
    const forward = phoenixUltAttackActive(p);
    let aimX = best.x;
    let aimY = best.y;
    if (forward) {
      const dx0 = best.x - p.x;
      const dy0 = best.y - p.y;
      const dist = Math.max(len(dx0, dy0), 1);
      const ratio = clamp((p.chargeT || 0) / MAX_CHARGE, 0.35, 1);
      const boltSpeed = PHOENIX_SHOT_SPEED * (0.65 + 0.35 * ratio);
      const eta = dist / Math.max(boltSpeed, 1);
      const lead = PHOENIX_AI_ULT_LEAD * skill.leadMul;
      aimX = best.x + (best.vx || 0) * eta * lead;
      aimY = best.y + (best.vy || 0) * eta * lead;
    }
    const dx = aimX - p.x;
    const dy = aimY - p.y;
    if (len(dx, dy) < 1e-3) return;
    const toEnemy = Math.atan2(dy, dx);
    if (p.chargeT <= 0 && p.attackT <= 0) {
      p.aiAimError =
        (Math.random() - 0.5) *
        (forward ? 0.07 : 0.16) *
        skill.aimSpreadMul;
    }
    // Normal: back to foe (rear bolts). Ult: face foe (forward bolts).
    p.facing = forward
      ? toEnemy + (p.aiAimError || 0)
      : toEnemy + Math.PI + (p.aiAimError || 0);
  }

  function allyAiMovePhoenix(p, best, dist, ix, iy) {
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (dist < 1e-3) return { ix, iy };
    const forward = phoenixUltAttackActive(p);
    const sweetMin =
      PHOENIX_SHOT_RANGE *
      (forward ? PHOENIX_AI_ULT_KITE_MIN_MUL : PHOENIX_AI_KITE_MIN_MUL);
    const sweetMax =
      PHOENIX_SHOT_RANGE *
      (forward ? PHOENIX_AI_ULT_KITE_MAX_MUL : PHOENIX_AI_KITE_MAX_MUL);
    const tooClose = forward ? PHOENIX_AI_ULT_TOO_CLOSE : PHOENIX_AI_TOO_CLOSE;
    if (dist < tooClose) {
      return { ix: (-dx / dist) * 1.05, iy: (-dy / dist) * 1.05 };
    }
    if (dist > sweetMax) {
      return {
        ix: (dx / dist) * (forward ? 0.95 : 0.72),
        iy: (dy / dist) * (forward ? 0.95 : 0.72),
      };
    }
    if (dist < sweetMin) {
      return {
        ix: (-dx / dist) * (forward ? 0.7 : 0.82),
        iy: (-dy / dist) * (forward ? 0.7 : 0.82),
      };
    }
    const sn = Math.sin(performance.now() * 0.0036 + p.playerNum * 1.4) > 0 ? 1 : -1;
    const orbit = forward ? 0.32 : 0.5;
    return {
      ix: ix + (-dy / dist) * sn * orbit,
      iy: iy + (dx / dist) * sn * orbit,
    };
  }

  function allyAiFaceTarget(p, best, style) {
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (len(dx, dy) < 1e-3) return;
    const base = Math.atan2(dy, dx);
    if (style === "phoenix") {
      allyAiFacePhoenixTarget(p, best);
      return;
    }
    if (style === "ranged") {
      allyAiFaceMarksman(p, best);
      return;
    }
    if (style === "spread" || style === "nova") {
      const skill = getAiSkill(p);
      if (p.chargeT <= 0 && p.attackT <= 0) {
        p.aiAimError = (Math.random() - 0.5) * 0.28 * skill.aimSpreadMul;
      }
      p.facing = base + (p.aiAimError || 0);
      return;
    }
    if (style === "lance") {
      const skill = getAiSkill(p);
      if (p.chargeT <= 0 && p.attackT <= 0) {
        p.aiAimError = (Math.random() - 0.5) * 0.1 * skill.aimSpreadMul;
      }
      p.facing = base + (p.aiAimError || 0);
      return;
    }
    if (style === "dash") {
      p.facing = base;
      return;
    }
    p.facing = base + Math.sin(performance.now() * 0.003) * 0.06;
  }

  function allyAiPhoenixAttack(p, best, dist, dt) {
    const skill = getAiSkill(p);
    allyAiFacePhoenixTarget(p, best);
    const forward = phoenixUltAttackActive(p);
    const sweetMin =
      PHOENIX_SHOT_RANGE *
      (forward ? PHOENIX_AI_ULT_KITE_MIN_MUL : PHOENIX_AI_KITE_MIN_MUL);
    const sweetMax =
      PHOENIX_SHOT_RANGE *
      (forward ? PHOENIX_AI_ULT_KITE_MAX_MUL : PHOENIX_AI_KITE_MAX_MUL);
    const inBand = dist >= sweetMin && dist <= sweetMax;
    if (!inBand) {
      p.chargeT = Math.max(0, p.chargeT - dt * 2.8);
      p.aiChargeGoal = 0;
      return;
    }
    const bandT = clamp((dist - sweetMin) / Math.max(sweetMax - sweetMin, 1), 0, 1);
    // Ult: prefer fuller charge so forward bolts reach; normal: mid-band charge.
    const ratioGoal = clamp(
      forward ? 0.62 + bandT * 0.32 : 0.5 + bandT * 0.42,
      skill.chargeGoalMin,
      skill.chargeGoalMax
    );
    if (p.aiChargeGoal <= 0) {
      p.aiChargeGoal = ratioGoal;
    }
    p.chargeT = Math.min(
      p.chargeT + dt * (forward ? 1.35 : 1.22) * skill.chargeRateMul,
      MAX_CHARGE
    );
    const ratio = p.chargeT / MAX_CHARGE;
    const rushed =
      ratio >= (forward ? 0.7 : 0.78) &&
      Math.random() < 0.18 + skill.fireNoise * 0.4;
    if (ratio >= p.aiChargeGoal || rushed) {
      startSwing(
        p,
        clamp(ratio * (0.88 + Math.random() * 0.1), forward ? 0.52 : 0.42, 1)
      );
      p.botMustRelease = true;
      p.aiChargeGoal = 0;
      p.chargeHoldT = 0;
    }
  }

  function allyAiStrikerAttack(p, best, dist, dt) {
    const skill = getAiSkill(p);
    allyAiFaceTarget(p, best, "dash");
    const ratioGoal = clamp(
      aiStrikerChargeGoal(dist),
      skill.chargeGoalMin * 0.85,
      skill.chargeGoalMax
    );
    p.aiChargeGoal = ratioGoal;
    const inWindow =
      dist >= DASH_DIST_MIN * 0.74 && dist <= DASH_DIST_MAX + 32;
    const closeEngage = dist < DASH_DIST_MIN * 0.88;

    if (closeEngage) {
      p.chargeT = Math.min(
        p.chargeT + dt * chargeRateFor(p),
        MAX_CHARGE
      );
      const ratio = meleeChargeRatio(p);
      if (ratio >= 0.34 - skill.fireNoise * 0.12) {
        startSwing(p, clamp(ratio, 0.34, Math.min(ratioGoal, 0.72)));
        p.botMustRelease = true;
        p.chargeHoldT = 0;
        p.aiChargeGoal = 0;
      }
      return;
    }

    if (inWindow) {
      p.chargeT = Math.min(
        p.chargeT + dt * chargeRateFor(p),
        MAX_CHARGE
      );
      const ratio = meleeChargeRatio(p);
      if (ratio >= ratioGoal - 0.07 - skill.fireNoise * 0.1) {
        startSwing(p, Math.max(ratioGoal, ratio));
        p.botMustRelease = true;
        p.chargeHoldT = 0;
      }
      return;
    }

    if (p.chargeT > 0) {
      if (dist >= DASH_DIST_MIN * 0.55 && dist <= DASH_DIST_MAX + 28) {
        startSwing(p, clamp(p.chargeT / MAX_CHARGE, 0.3, 1));
        p.botMustRelease = true;
      }
      p.chargeT = 0;
      p.chargeHoldT = 0;
    }
  }

  function allyAiLaserAttack(p, best, dist, dt, rng) {
    if ((p.laserAiCd || 0) > 0) {
      p.laserAiCd = Math.max(0, p.laserAiCd - dt);
      setLaserBeamActive(p, false);
      p.laserBeamBurstT = 0;
      if (best) {
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) {
          p.facing = Math.atan2(dy, dx);
        }
      }
      return;
    }

    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) {
        p.facing = Math.atan2(dy, dx);
      }
    }

    const inRange =
      best &&
      dist >= rng.chargeMin &&
      dist <= rng.chargeMax &&
      dist > rng.close * 0.45;
    const hpRatio = p.hp / p.maxHp;

    if (p.beamActive) {
      p.laserBeamBurstT = (p.laserBeamBurstT || 0) + dt;
      const burstT = p.laserBeamBurstT;
      const fireT = Math.max(0, burstT - LASER_WINDUP);
      const release =
        !inRange ||
        gameOver ||
        burstT >= LASER_AI_BURST_MAX + LASER_WINDUP ||
        hpRatio <= LASER_AI_RELEASE_HP ||
        (p.beamHitAny && fireT >= LASER_AI_BURST_MIN_HIT) ||
        (!p.beamHitAny && burstT >= LASER_AI_BURST_MAX_MISS + LASER_WINDUP);

      if (release) {
        setLaserBeamActive(p, false);
        p.laserBeamBurstT = 0;
        p.laserAiCd =
          LASER_AI_COOLDOWN * (0.88 + Math.random() * 0.32);
      }
      return;
    }

    p.laserBeamBurstT = 0;

    const canStart =
      inRange &&
      !gameOver &&
      p.laserAiCd <= 0 &&
      hpRatio > LASER_AI_RELEASE_HP + 0.06;

    setLaserBeamActive(p, !!canStart);
  }

  function allyAiLanceAttack(p, best, dist, dt, rng) {
    const skill = getAiSkill(p);
    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) {
        if (p.chargeT <= 0 && p.attackT <= 0) {
          p.aiAimError = (Math.random() - 0.5) * 0.1 * skill.aimSpreadMul;
        }
        p.facing = Math.atan2(dy, dx) + (p.aiAimError || 0);
      }
    }
    const inBand = dist >= rng.chargeMin && dist <= rng.chargeMax;
    if (!inBand) {
      p.chargeT = Math.max(0, p.chargeT - dt * 2.4);
      p.aiChargeGoal = 0;
      return;
    }
    const bandT = clamp(
      (dist - rng.chargeMin) / Math.max(rng.chargeMax - rng.chargeMin, 1),
      0,
      1
    );
    const ratioGoal = clamp(
      0.48 + bandT * 0.45,
      skill.chargeGoalMin,
      skill.chargeGoalMax
    );
    if (p.aiChargeGoal <= 0) p.aiChargeGoal = ratioGoal;
    p.chargeT = Math.min(
      p.chargeT + dt * 1.18 * skill.chargeRateMul,
      MAX_CHARGE
    );
    const ratio = p.chargeT / MAX_CHARGE;
    if (ratio >= p.aiChargeGoal || (ratio >= 0.72 && Math.random() < 0.2)) {
      startSwing(p, clamp(ratio, 0.4, 1));
      p.botMustRelease = true;
      p.aiChargeGoal = 0;
      p.chargeHoldT = 0;
    }
  }

  function allyAiRicochetAttack(p, best, dist, dt, rng) {
    const skill = getAiSkill(p);
    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      const d = len(dx, dy);
      if (d > 1e-3) {
        // Roll the bank side/angle once per charge attempt (not every
        // tick) so the aim holds steady instead of jittering while
        // charging.
        if (p.chargeT <= 0 || p.aiRicochetBankAngle == null) {
          const sign = Math.random() < 0.5 ? 1 : -1;
          p.aiRicochetBankAngle =
            sign *
            (RICOCHET_AI_BANK_ANGLE_MIN +
              Math.random() *
                (RICOCHET_AI_BANK_ANGLE_MAX - RICOCHET_AI_BANK_ANGLE_MIN));
        }
        p.facing = Math.atan2(dy, dx) + p.aiRicochetBankAngle;
      }
    }
    const distOk = dist >= rng.chargeMin && dist <= rng.chargeMax;
    // The random gate only decides whether to COMMIT to a fresh charge —
    // re-rolling it every tick (as this used to) meant an already-charging
    // shot had a small chance to bail on every single frame, so across the
    // ~40+ ticks needed to reach a high charge goal it almost always got
    // interrupted into an early, weak release before ever getting there.
    const startingFresh = p.chargeT <= 0;
    const wantsCharge =
      distOk &&
      (!startingFresh || Math.random() > 0.1 + skill.fireNoise * 0.25);

    if (wantsCharge) {
      if (p.aiChargeGoal <= 0) {
        // Charge now drives both per-bounce damage growth and max life
        // (RICOCHET_CHARGE_DAMAGE_MIN_MUL / RICOCHET_CHARGE_BOUNCE_DMG_MUL_MAX
        // / RICOCHET_SHOT_LIFE_CAP_CHARGE_BONUS all scale off it), so a
        // half-charged tap is a dramatically weaker shot than it used to
        // be — the AI should hold for something close to full charge.
        p.aiChargeGoal = clamp(
          0.8 + Math.random() * 0.19,
          skill.chargeGoalMin,
          skill.chargeGoalMax
        );
      }
      p.chargeT = Math.min(
        p.chargeT + dt * (0.8 + Math.random() * 0.28) * skill.chargeRateMul,
        MAX_CHARGE
      );
      const ratio = meleeChargeRatio(p);
      const rushed = ratio >= 0.9 && Math.random() < 0.2 + skill.fireNoise;
      if (ratio >= p.aiChargeGoal || rushed) {
        startSwing(
          p,
          clamp(ratio * (0.88 + Math.random() * 0.12), 0.6, 1)
        );
        p.botMustRelease = true;
        p.aiChargeGoal = 0;
        p.chargeHoldT = 0;
      }
      return;
    }

    if (p.chargeT > 0 && distOk && Math.random() < 0.34 + skill.fireNoise) {
      startSwing(p, clamp(p.chargeT / MAX_CHARGE, 0.55, 0.92));
      p.botMustRelease = true;
    }
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.aiChargeGoal = 0;
  }

  function allyAiBulwarkAttack(p, best, dist, dt, rng) {
    const skill = getAiSkill(p);
    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
    }
    if (p.botMustRelease) {
      p.chargeT = 0;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
      return;
    }
    // Mirror tickChargeWhileHeld's Unbreakable cap here too — this AI path
    // (ally/Horde teammates) accumulates charge independently and would
    // otherwise never be bounded by that cap at all.
    if (isBulwarkUnbreakable(p)) {
      p.chargeT = Math.min(
        p.chargeT + dt * chargeRateFor(p),
        MAX_CHARGE * BULWARK_UNBREAKABLE_CHARGE_CAP_MUL
      );
    } else {
      p.chargeT += dt * chargeRateFor(p);
    }
    if (!(p.aiChargeGoal > 0)) {
      const goalScale = isBulwarkUnbreakable(p)
        ? 1.25 + Math.random() * 0.95
        : 0.55 + Math.random() * 0.7;
      p.aiChargeGoal =
        MAX_CHARGE *
        goalScale *
        (0.85 + 0.2 * (1 - skill.fireNoise));
    }
    const auraMode = isBulwarkUnbreakable(p);
    const inRange =
      !!best &&
      Number.isFinite(dist) &&
      (auraMode
        ? dist <= AURA_RADIUS_MAX + getPlayerRadius(p) + 12
        : dist >= rng.chargeMin &&
          dist <= rng.chargeMax + getPlayerRadius(p) * 0.25);
    if (inRange && p.chargeT >= p.aiChargeGoal) {
      startSwing(p, bulwarkChargeRatio(p));
      p.botMustRelease = true;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
    }
  }

  function allyAiScatterAttack(p, best, dist, dt, rng, faceStyle) {
    const skill = getAiSkill(p);
    allyAiFaceTarget(p, best, faceStyle || "spread");
    const distOk = dist >= rng.chargeMin && dist <= rng.chargeMax;
    // Only roll the "do I commit to a fresh charge" gate when actually
    // starting one — re-rolling every tick of an already-started charge
    // made it almost impossible to ever reach a high charge goal.
    const startingFresh = p.chargeT <= 0;
    const wantsCharge =
      distOk &&
      (!startingFresh || Math.random() > 0.12 + skill.fireNoise * 0.2);

    if (wantsCharge) {
      if (p.aiChargeGoal <= 0) {
        p.aiChargeGoal = clamp(
          0.5 + Math.random() * 0.42,
          skill.chargeGoalMin,
          skill.chargeGoalMax
        );
      }
      p.chargeT = Math.min(
        p.chargeT + dt * (0.78 + Math.random() * 0.35) * skill.chargeRateMul,
        MAX_CHARGE
      );
      const ratio = meleeChargeRatio(p);
      const rushed = ratio >= 0.88 && Math.random() < 0.28 + skill.fireNoise;
      if (ratio >= p.aiChargeGoal || rushed) {
        const shotRatio = clamp(
          ratio * (0.9 + Math.random() * 0.14),
          0.28,
          1
        );
        startSwing(p, shotRatio);
        p.botMustRelease = true;
        p.aiAimError = (Math.random() - 0.5) * 0.32 * skill.aimSpreadMul;
        p.aiChargeGoal = 0;
        p.chargeHoldT = 0;
      }
      return;
    }

    if (p.chargeT > 0 && Math.random() < 0.45 + skill.fireNoise) {
      startSwing(p, clamp(p.chargeT / MAX_CHARGE, 0.2, 0.72));
      p.botMustRelease = true;
      p.aiAimError = (Math.random() - 0.5) * 0.38 * skill.aimSpreadMul;
    }
    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.aiChargeGoal = 0;
  }

  function allyAiMarksmanAttack(p, best, dist, dt, rng) {
    const skill = getAiSkill(p);
    allyAiFaceMarksman(p, best);
    const inFireBand = dist >= rng.chargeMin && dist <= rng.chargeMax;
    const nearlyInBand =
      dist >= rng.chargeMin * 0.82 && dist <= rng.chargeMax * 1.1;
    const tooClose = dist < rng.close;
    const closing =
      ((best.x - p.x) * (best.vx || 0) + (best.y - p.y) * (best.vy || 0)) <
      -55;

    if ((inFireBand || ((p.chargeT || 0) > 0 && nearlyInBand)) && !p.botMustRelease) {
      if (!(p.aiChargeGoal > 0)) {
        const quality = inFireBand ? 1 : 0.75;
        p.aiChargeGoal = clamp(
          0.64 +
            Math.random() * 0.3 * quality -
            MARKSMAN_AI_CHARGE_JITTER * 0.5 * (1 + skill.fireNoise),
          skill.chargeGoalMin,
          skill.chargeGoalMax
        );
      }
      p.chargeT = Math.min(
        p.chargeT + dt * chargeRateFor(p) * 1.08,
        MAX_CHARGE
      );
      allyAiFaceMarksman(p, best);
      const ratio = meleeChargeRatio(p);
      const panicShot = tooClose && ratio >= 0.32;
      const ready =
        ratio >= p.aiChargeGoal ||
        (ratio >= 0.9 && Math.random() < 0.28 + skill.fireNoise * 0.5);
      const opportunistic =
        closing &&
        ratio >= 0.48 &&
        inFireBand &&
        Math.random() < 0.35 + skill.fireNoise * 0.25;
      if (inFireBand && (ready || panicShot || opportunistic)) {
        startSwing(p, clamp(ratio, panicShot ? 0.32 : 0.5, 1));
        p.botMustRelease = true;
        p.aiAimError =
          (Math.random() - 0.5) * MARKSMAN_AI_AIM_SPREAD * skill.aimSpreadMul;
        p.aiChargeGoal = 0;
        p.chargeHoldT = 0;
      }
      return;
    }

    if ((p.chargeT || 0) > 0) {
      const ratio = meleeChargeRatio(p);
      if (
        ratio >= 0.42 &&
        dist <= rng.chase &&
        Math.random() < 0.55 + skill.fireNoise * 0.3
      ) {
        allyAiFaceMarksman(p, best);
        startSwing(p, clamp(ratio, 0.38, 0.94));
        p.botMustRelease = true;
        p.aiChargeGoal = 0;
        p.chargeHoldT = 0;
      } else {
        p.chargeT = Math.max(0, p.chargeT - dt * 1.15);
        if (p.chargeT <= 0) p.aiChargeGoal = 0;
      }
      return;
    }

    p.chargeT = 0;
    p.chargeHoldT = 0;
    p.aiChargeGoal = 0;
  }

  function allyAiDefaultAttack(p, dt) {
    // Unlike every other attack style's allyAi*Attack, plain melee (Brawler)
    // used to always ride the charge to a perfect full swing regardless of
    // difficulty. Now it picks a per-swing charge goal from the skill
    // profile (a sloppy, impatient tap on Easy vs. a disciplined near-full
    // charge on Elite) the same way Striker/Marksman/etc. already do.
    const skill = getAiSkill(p);
    if (!p.aiChargeGoal) {
      p.aiChargeGoal = clamp(
        skill.chargeGoalMin +
          Math.random() * (skill.chargeGoalMax - skill.chargeGoalMin),
        0.15,
        1
      );
    }
    p.chargeT = Math.min(p.chargeT + dt * chargeRateFor(p), MAX_CHARGE);
    p.chargeHoldT = 0;
    const ratio = meleeChargeRatio(p);
    if (ratio >= p.aiChargeGoal - skill.fireNoise * 0.15 || ratio >= 1) {
      startSwing(p, clamp(ratio, 0.15, 1));
      p.botMustRelease = true;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
    }
  }

  function allyAiTryAttack(p, best, dist, dt) {
    if (!canPlayerUseAttacks(p)) return;
    const canCharge =
      !gameOver && p.cooldown <= 0 && p.attackT <= 0 && !p.botMustRelease;
    const rng = aiCombatRange(p);
    const wantsCharge =
      best &&
      dist < rng.chargeMax &&
      dist > rng.chargeMin &&
      !p.botMustRelease;

    if (p.attackStyle === "dash" && best && canCharge) {
      allyAiStrikerAttack(p, best, dist, dt);
      return;
    }

    if (p.attackStyle === "phoenix" && best && canCharge) {
      allyAiPhoenixAttack(p, best, dist, dt);
      return;
    }

    if ((p.attackStyle === "aura" || p.attackStyle === "barrage") && canCharge) {
      allyAiBulwarkAttack(p, best, best ? dist : Infinity, dt, rng);
      return;
    }

    if (p.attackStyle === "bounce" && best && canCharge) {
      allyAiRicochetAttack(p, best, dist, dt, rng);
      return;
    }

    if (p.attackStyle === "lance" && best && canCharge) {
      allyAiLanceAttack(p, best, dist, dt, rng);
      return;
    }

    if (p.attackStyle === "beam" && best) {
      allyAiLaserAttack(p, best, dist, dt, rng);
      return;
    }

    if (p.attackStyle === "ranged" && best && canCharge) {
      allyAiMarksmanAttack(p, best, dist, dt, rng);
      return;
    }

    if (
      (p.attackStyle === "spread" || p.attackStyle === "nova") &&
      best &&
      canCharge
    ) {
      if (wantsCharge || p.chargeT > 0) {
        allyAiScatterAttack(
          p,
          best,
          dist,
          dt,
          rng,
          p.attackStyle === "nova" ? "nova" : "spread"
        );
      } else {
        p.chargeT = 0;
        p.chargeHoldT = 0;
        p.aiChargeGoal = 0;
      }
      return;
    }

    if (wantsCharge && canCharge) {
      allyAiDefaultAttack(p, dt);
    } else if (
      p.chargeT > 0 &&
      canCharge &&
      !gameOver &&
      p.cooldown <= 0 &&
      p.attackT <= 0 &&
      !p.botMustRelease
    ) {
      const raw = p.chargeT / MAX_CHARGE;
      if (isBulwark(p) && raw < BULWARK_TAP_IGNORE_RAW) {
        p.chargeT = 0;
        p.chargeHoldT = 0;
        return;
      }
      const ratio = isBulwark(p) ? raw : clamp(raw, 0.1, 1);
      startSwing(p, ratio);
      p.chargeT = 0;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
    } else {
      p.chargeT = 0;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
    }
  }

  function allyAiTargets(self) {
    if (gameMode === "horde") {
      if (hordeBossWaveActive()) {
        const boss = getHordeBossPlayer();
        return boss && boss.hp > 0 ? [boss] : [];
      }
      return mapRuntime.waveEnemies.filter((e) => e.hp > 0);
    }
    if (gameMode === "boss") {
      return players.filter((pl) => pl.isBot && pl.hp > 0);
    }
    if (gameMode === "teams" || gameMode === "siege") {
      return players.filter(
        (pl) => pl.hp > 0 && pl.fightTeam !== self.fightTeam
      );
    }
    return players.filter(
      (pl) => pl.hp > 0 && pl.playerNum !== self.playerNum
    );
  }

  /** On labyrinth, prefer targets reachable through corridors (not through walls). */
  function allyAiPickBestTargetMaze(self, fighters) {
    const rows = mazeNavRows();
    const start = mazeNearestFloorCell(self.x, self.y);
    if (!rows || !start || !fighters.length) return null;
    let best = null;
    let bestCost = Infinity;
    for (let i = 0; i < fighters.length; i++) {
      const t = fighters[i];
      const end = mazeNearestFloorCell(t.x, t.y);
      if (!end) continue;
      let steps = mazeBfsStepCount(start.gx, start.gy, end.gx, end.gy, rows);
      const euclid = len(t.x - self.x, t.y - self.y);
      if (!isFinite(steps)) {
        steps = 80 + euclid * 0.05;
      }
      const cost = steps * 40 + euclid * 0.12;
      if (cost < bestCost) {
        bestCost = cost;
        best = t;
      }
    }
    return best;
  }

  /** Closest fighter target, or a nearby critter when one is harassing. */
  function allyAiPickBestTarget(self) {
    const fighters = allyAiTargets(self);
    let best = null;
    let bestD = Infinity;

    if (fighters.length > 1 && mazeNavRows()) {
      const mazeBest = allyAiPickBestTargetMaze(self, fighters);
      if (mazeBest) {
        best = mazeBest;
        bestD = len(mazeBest.x - self.x, mazeBest.y - self.y);
      }
    }

    if (!best) {
      for (let i = 0; i < fighters.length; i++) {
        const t = fighters[i];
        const d = len(t.x - self.x, t.y - self.y);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
    }

    // A sharper AI notices a nearly-dead enemy worth finishing off even when
    // it isn't the closest target; a dumb one never looks past "nearest".
    if (best && self.isAi && fighters.length > 1) {
      const skill = getAiSkill(self);
      if (skill.killPriority > 0) {
        let weakest = null;
        let weakestD = 0;
        let weakestFrac = 1;
        for (let i = 0; i < fighters.length; i++) {
          const t = fighters[i];
          if (!(t.maxHp > 0) || t === best) continue;
          const frac = t.hp / t.maxHp;
          if (frac < weakestFrac) {
            weakestFrac = frac;
            weakest = t;
            weakestD = len(t.x - self.x, t.y - self.y);
          }
        }
        if (
          weakest &&
          weakestFrac <= AI_KILL_PRIORITY_HP_FRAC &&
          weakestD <= bestD + AI_KILL_PRIORITY_EXTRA_DIST &&
          Math.random() < skill.killPriority
        ) {
          best = weakest;
          bestD = weakestD;
        }
      }
    }

    if (gameMode === "siege") {
      const enemyBase = mapRuntime.bases.find(
        (b) => !b.destroyed && b.team !== self.fightTeam
      );
      if (enemyBase) {
        const baseD = len(enemyBase.x - self.x, enemyBase.y - self.y);
        if (!best || baseD < bestD * SIEGE_AI_BASE_PREFERENCE_MUL) {
          best = enemyBase;
          bestD = baseD;
        }
      }
    }

    if (mapHasCreatures()) {
      const harassR = getPlayerRadius(self) + CREATURE_RADIUS + 88;
      const huntR = fighters.length === 0 ? arenaRadius() * 0.55 : harassR;
      const list = mapRuntime.creatures;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.hp <= 0) continue;
        const d = len(c.x - self.x, c.y - self.y);
        if (d > huntR) continue;
        if (!best || d < bestD * 0.9) {
          bestD = d;
          best = c;
        }
      }
    }

    return { best: best, dist: best ? bestD : 0 };
  }

  function allyAiFaceForUltimate(p, best) {
    if (!best) return;
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
  }

  function allyAiNearbyThreatCount(p, radius) {
    let count = 0;
    const inRange = (x, y, r) =>
      len(x - p.x, y - p.y) <= radius + r;
    if (gameMode === "horde") {
      const wlist = mapRuntime.waveEnemies;
      for (let wi = 0; wi < wlist.length; wi++) {
        const e = wlist[wi];
        if (e.hp <= 0) continue;
        if (inRange(e.x, e.y, e.r)) count++;
      }
      const boss =
        typeof getHordeBossPlayer === "function" ? getHordeBossPlayer() : null;
      if (boss && boss.hp > 0 && inRange(boss.x, boss.y, getPlayerRadius(boss))) {
        count++;
      }
    }
    const fighters = allyAiTargets(p);
    for (let fi = 0; fi < fighters.length; fi++) {
      const t = fighters[fi];
      const tr = t.r != null ? t.r : getPlayerRadius(t);
      if (inRange(t.x, t.y, tr)) count++;
    }
    if (mapHasCreatures()) {
      const clist = mapRuntime.creatures;
      for (let ci = 0; ci < clist.length; ci++) {
        const c = clist[ci];
        if (c.hp <= 0) continue;
        if (inRange(c.x, c.y, c.r)) count++;
      }
    }
    return count;
  }

  function allyAiWantsUltimate(p, best, dist) {
    if (!ultimateReady(p) || gameOver) return false;
    if (p.attackT > 0.14 || isDashing(p)) return false;
    if (isLaser(p) && ((p.ultLaserT || 0) > 0 || p.beamActive)) return false;
    if ((p.ultActiveT || 0) > 0.08) return false;

    const skill = getAiSkill(p);
    if (Math.random() > skill.ultWillingness) return false;

    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    const id = p.characterId || "brawler";
    const threats = allyAiNearbyThreatCount(p, 118);
    const rng = aiCombatRange(p);

    if (isPhoenix(p)) {
      return (
        isHordeHeroDowned(p) ||
        hpFrac < 0.42 ||
        (hpFrac < 0.58 && threats >= 1) ||
        (hpFrac < 0.72 && threats >= 2)
      );
    }

    if (id === "bulwark") {
      return hpFrac < 0.58 || threats >= 2 || (best && dist <= rng.chargeMax * 1.05);
    }

    if (id === "echo") {
      return threats >= 1 || hpFrac < 0.55 || (best && dist <= rng.chase * 0.9);
    }

    if (!best) return false;

    if (id === "brawler") {
      return dist <= 135 && threats >= 1;
    }
    if (id === "striker") {
      return (
        dist <= rng.chargeMax * 1.08 &&
        dist >= rng.close * 0.82 &&
        threats >= 1
      );
    }
    if (id === "laser") {
      return (
        dist <= rng.chargeMax * 0.98 &&
        dist >= rng.close * 0.45 &&
        threats >= 1
      );
    }
    if (id === "nova") {
      // Supernova is a pure no-damage self-buff (Chaos Field: damage
      // resist + knockback-to-pull) with no target/range requirement, so
      // unlike the offensive ults below it should fire proactively off
      // Nova's own danger/HP state, not wait for a target in kill range.
      return (
        threats >= 1 || hpFrac < 0.65 || (!!best && dist <= rng.close * 1.3)
      );
    }
    if (
      id === "marksman" ||
      id === "ricochet" ||
      id === "scatter" ||
      id === "pike" ||
      id === "grappler" ||
      id === "siphon" ||
      id === "marionette"
    ) {
      return (
        dist <= rng.chase * 0.96 &&
        dist >= rng.close * 0.38 &&
        threats >= 1
      );
    }
    return dist <= rng.chargeMax && threats >= 1;
  }

  function allyAiTryUltimate(p, best, dist) {
    if (!allyAiWantsUltimate(p, best, dist)) return false;
    if (!isPhoenix(p) || !isHordeHeroDowned(p)) {
      allyAiFaceForUltimate(p, best);
    }
    return tryUseUltimate(p);
  }

  function steerAllyAi(p, dt) {
    tickNovaChaosKnock(p, dt);
    tickUniversalRegen(p, dt);
    if (!p.isBot) tickUltimateState(p, dt);
    if ((p.marionetteUltWindupT || 0) > 0) {
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      return;
    }
    if (gameMode === "horde") {
      const sup = hordePickSupportFocus(p);
      if (sup && hordeAiWantsToSupport(p, sup)) {
        p.supportTargetNum = sup.playerNum;
        const dx = sup.x - p.x;
        const dy = sup.y - p.y;
        const d = len(dx, dy);
        if (!hordeSupportRange(p, sup) && d > 1e-3) {
          tickAiStuck(p, dt, true);
          const nav = aiSteerNav(p, dx / d, dy / d, sup.x, sup.y);
          applyMovementFromAxes(p, nav.ix, nav.iy, dt, allyAiMoveSpeedMul(p) * 0.92);
        } else {
          p.vx *= 0.85;
          p.vy *= 0.85;
        }
        p.cooldown = Math.max(0, p.cooldown - dt);
        p.attackT = Math.max(0, p.attackT - dt);
        p.hitFlash = Math.max(0, p.hitFlash - dt);
        if (isLaser(p)) setLaserBeamActive(p, false);
        return;
      }
      if (hordeState.phase === "intermission") {
        p.cooldown = Math.max(0, p.cooldown - dt);
        p.attackT = Math.max(0, p.attackT - dt);
        p.hitFlash = Math.max(0, p.hitFlash - dt);
        if (isLaser(p)) setLaserBeamActive(p, false);
        return;
      }
    }
    tickReaverRuinRoot(p, dt);
    tickReaverHookDisarm(p, dt);
    if (p.stunT > 0) {
      p.stunT = Math.max(0, p.stunT - dt);
      p.vx = 0;
      p.vy = 0;
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.attackT = Math.max(0, p.attackT - dt);
      return;
    }
    if (isReaverRuinRooted(p)) {
      p.vx = 0;
      p.vy = 0;
    }
    if (isDashing(p)) {
      updateDash(p, dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      return;
    }
    if (isLaser(p) && (p.ultLaserT || 0) > 0) {
      setLaserBeamActive(p, true);
    }
    const picked = allyAiPickBestTarget(p);
    let ix = 0;
    let iy = 0;
    let dist = picked.dist;
    let best = picked.best;

    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      dist = len(dx, dy);
      const rng = aiCombatRange(p);
      if (dist > rng.chase) {
        ix = dx / dist;
        iy = dy / dist;
      } else if (dist < rng.close && dist > 1e-3) {
        ix = (-dx / dist) * 0.9;
        iy = (-dy / dist) * 0.9;
      } else if (dist > 1e-3) {
        const sn = Math.sin(performance.now() * 0.0033) > 0 ? 1 : -1;
        ix = (-dy / dist) * sn * 0.75;
        iy = (dx / dist) * sn * 0.75;
      }
      if (p.attackStyle === "phoenix") {
        const mv = allyAiMovePhoenix(p, best, dist, ix, iy);
        ix = mv.ix;
        iy = mv.iy;
      } else if (p.attackStyle === "dash") {
        const mv = allyAiMoveStriker(p, best, dist, ix, iy);
        ix = mv.ix;
        iy = mv.iy;
      } else if (p.attackStyle === "ranged" || p.attackStyle === "beam") {
        const mv = allyAiMoveMarksman(p, best, dist, ix, iy);
        ix = mv.ix;
        iy = mv.iy;
      } else if (p.attackStyle === "lance" && dist > 1e-3) {
        const ideal = (LANCE_RANGE_MIN + LANCE_RANGE_MAX) * 0.5;
        if (dist > ideal + 28) {
          ix = (dx / dist) * 0.88;
          iy = (dy / dist) * 0.88;
        } else if (dist < LANCE_RANGE_MIN * 0.7) {
          ix = (-dx / dist) * 0.85;
          iy = (-dy / dist) * 0.85;
        } else {
          const sn = Math.sin(performance.now() * 0.003) > 0 ? 1 : -1;
          ix = (-dy / dist) * sn * 0.4;
          iy = (dx / dist) * sn * 0.4;
        }
      } else if (p.attackStyle === "spread" || p.attackStyle === "nova") {
        const mv = allyAiMoveScatter(p, best, dist, ix, iy);
        ix = mv.ix;
        iy = mv.iy;
      } else if (p.attackStyle === "barrage" && dist > 1e-3) {
        const reach = BULWARK_BARRAGE_MAX_DIST * 0.72;
        if (dist > reach) {
          ix = (dx / dist) * 0.9;
          iy = (dy / dist) * 0.9;
        } else if (dist < 42) {
          ix = (-dx / dist) * 0.55;
          iy = (-dy / dist) * 0.55;
        } else {
          ix *= 0.35;
          iy *= 0.35;
        }
      } else if (p.attackStyle === "bounce") {
        const mv = allyAiMoveMarksman(p, best, dist, ix, iy);
        ix = mv.ix;
        iy = mv.iy;
      } else if (p.attackStyle === "aura" && dist > 1e-3) {
        const reach = AURA_RADIUS_MAX + getPlayerRadius(p) + 8;
        if (dist > reach) {
          ix = (dx / dist) * 0.85;
          iy = (dy / dist) * 0.85;
        }
      }
    }

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (isPike(p) && p.attackT > 0 && p.lanceSwingFacing != null) {
      p.facing = p.lanceSwingFacing;
    }

    if (p.botMustRelease && p.attackT <= 0 && p.cooldown <= 0) {
      p.botMustRelease = false;
    }

    if (best) {
      if (p.attackStyle === "phoenix" && p.chargeT <= 0 && !isDashing(p)) {
        allyAiFacePhoenixTarget(p, best);
      } else if (
        p.attackStyle === "dash" &&
        p.chargeT <= 0 &&
        !isDashing(p)
      ) {
        allyAiFaceTarget(p, best, "dash");
      } else if (
        p.attackStyle === "ranged" &&
        p.chargeT <= 0 &&
        p.attackT <= 0
      ) {
        allyAiFaceTarget(p, best, "ranged");
      } else if (
        p.attackStyle === "lance" &&
        p.chargeT <= 0 &&
        p.attackT <= 0
      ) {
        allyAiFaceTarget(p, best, "lance");
      } else if (
        (p.attackStyle === "spread" || p.attackStyle === "nova") &&
        p.chargeT <= 0 &&
        p.attackT <= 0
      ) {
        allyAiFaceTarget(
          p,
          best,
          p.attackStyle === "nova" ? "nova" : "spread"
        );
      } else if (
        p.attackStyle === "barrage" &&
        p.chargeT <= 0 &&
        p.attackT <= 0
      ) {
        allyAiFaceTarget(p, best, "spread");
      } else if (
        p.attackStyle === "bounce" &&
        p.attackT <= 0
      ) {
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      } else if (
        p.attackStyle === "beam" &&
        p.attackT <= 0 &&
        !p.beamActive
      ) {
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
      }
      if (!allyAiTryUltimate(p, best, dist)) {
        allyAiTryAttack(p, best, dist, dt);
      }
    } else {
      p.chargeT = 0;
      p.chargeHoldT = 0;
      p.aiChargeGoal = 0;
      if (isLaser(p)) {
        setLaserBeamActive(p, false);
      }
    }

    if (isLaser(p) && (p.beamActive || (p.ultLaserT || 0) > 0)) {
      if (p.beamFacing != null) {
        p.facing = p.beamFacing;
      }
      p.vx = 0;
      p.vy = 0;
    } else {
      tickAiStuck(p, dt, len(ix, iy) > 0.12);
      const nav = aiSteerNav(
        p,
        ix,
        iy,
        best ? best.x : null,
        best ? best.y : null
      );
      applyMovementFromAxes(p, nav.ix, nav.iy, dt, allyAiMoveSpeedMul(p));
    }

    if (
      best &&
      p.attackStyle !== "ranged" &&
      p.attackStyle !== "spread" &&
      p.attackStyle !== "nova" &&
      p.attackStyle !== "dash" &&
      p.attackStyle !== "phoenix" &&
      p.attackStyle !== "bounce" &&
      p.attackStyle !== "beam"
    ) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      if (len(dx, dy) > 1e-3) p.facing = Math.atan2(dy, dx);
    }

    if (isLaser(p) && (p.beamActive || (p.ultLaserT || 0) > 0)) {
      tickLaserBeam(p, dt);
    } else if (isLaser(p)) {
      p.beamHitAny = false;
    }
  }

  /**
   * Normal barrage charge-up is protected (no loss when hit). But while
   * charging the aura during the Unbreakable ultimate specifically, getting
   * hit still drains the charge.
   */
  function applyBulwarkHitChargePenalty(defender, dmgDealt) {
    if (!isBulwarkUnbreakable(defender)) return;
    if (!isBulwark(defender) || defender.chargeT <= 0 || dmgDealt <= 0) return;
    const hpFrac = dmgDealt / Math.max(1, defender.maxHp);
    const loss = MAX_CHARGE * clamp(
      BULWARK_HIT_CHARGE_LOSS + hpFrac * BULWARK_HIT_CHARGE_LOSS_PER_HP,
      BULWARK_HIT_CHARGE_LOSS_MIN,
      BULWARK_HIT_CHARGE_LOSS_MAX
    );
    defender.chargeT = Math.max(0, defender.chargeT - loss);
  }

  /** Chaos Field (Nova ult): a push becomes a pull at 3x strength; an
   *  already-pulling knockback is just strengthened 3x, not re-flipped. */
  function applyNovaChaosKnock(defender, kb) {
    if ((defender.novaChaosKnockT || 0) <= 0) return kb;
    return kb >= 0 ? kb * NOVA_ULT_CHAOS_FLIP_MUL : kb * NOVA_ULT_CHAOS_PULL_MUL;
  }

  function tickNovaChaosKnock(p, dt) {
    if ((p.novaChaosKnockT || 0) > 0) {
      p.novaChaosKnockT = Math.max(0, p.novaChaosKnockT - dt);
    }
  }

  function applyDamageTo(defender, attacker, dmg, opts) {
    opts = opts || {};
    dmg = scaleDmg(dmg);
    if (isHordeHero(defender) && defender.eliminated) return;
    if (isHordeHeroDowned(defender)) return;
    if (isPhoenix(defender) && defender.phoenixReviving) {
      if (dmg > 0) {
        defender.phoenixReviveInterrupted = true;
        defender.hitFlash = opts.hitFlash != null ? opts.hitFlash : 0.18;
        if (opts.knockFrom && opts.knockMul != null) {
          const kbResist =
            defender.knockbackResistMul != null ? defender.knockbackResistMul : 1;
          const src = opts.knockFrom;
          const n = norm(defender.x - src.x, defender.y - src.y);
          const kb = applyNovaChaosKnock(
            defender,
            KNOCKBACK * opts.knockMul * kbResist * 0.35
          );
          defender.vx += n.x * kb;
          defender.vy += n.y * kb;
        }
      }
      if (defender.hp < 1) defender.hp = 1;
      return;
    }
    if ((defender.respawnInvulnT || 0) > 0) return;
    if (isSiphonPhasing(defender)) return;
    if (defender.hp <= 0) {
      return;
    }
    const defenderStunned =
      (defender.stunT || 0) > 0 || (opts.stunT != null && opts.stunT > 0);
    if (attacker && isBrawlerMelee(attacker) && defenderStunned) {
      dmg *= BRAWLER_VS_STUNNED_DMG_MUL;
    }
    if ((defender.ultDamageResistT || 0) > 0) {
      dmg *= BULWARK_ULT_RESIST_DMG_MUL;
    }
    if ((defender.novaChaosKnockT || 0) > 0) {
      dmg *= NOVA_ULT_CHAOS_DMG_RESIST_MUL;
    }
    if (isPhoenix(defender) && (defender.phoenixReviveBuffT || 0) > 0) {
      dmg *= PHOENIX_REVIVE_SHIELD_DMG_MUL;
    }
    const hpBefore = defender.hp;
    defender.hp = Math.max(0, defender.hp - dmg);
    const dealt = hpBefore - defender.hp;
    defender.hitFlash = opts.hitFlash != null ? opts.hitFlash : 0.18;
    if (dealt > 0) {
      defender.squashX = 1.2;
      defender.squashY = 0.78;
      spawnHitSparks(
        defender.x,
        defender.y,
        (attacker && attacker.color) || defender.color,
        Math.min(10, 4 + Math.floor(dealt / 8))
      );
    }
    if (opts.swingKey) defender.lastHitSwingKey = opts.swingKey;
    const kbResist =
      defender.knockbackResistMul != null ? defender.knockbackResistMul : 1;
    if (opts.kb != null) {
      defender.vx += opts.kb.vx * kbResist;
      defender.vy += opts.kb.vy * kbResist;
    } else if (opts.knockFrom && opts.knockMul != null) {
      const src = opts.knockFrom;
      const dx = defender.x - src.x;
      const dy = defender.y - src.y;
      const n = norm(dx, dy);
      const kb = applyNovaChaosKnock(defender, KNOCKBACK * opts.knockMul * kbResist);
      defender.vx += n.x * kb;
      defender.vy += n.y * kb;
    }
    if (
      opts.stunT != null &&
      opts.stunT > 0 &&
      attacker &&
      !attacker.isBot
    ) {
      defender.stunT = Math.max(defender.stunT || 0, opts.stunT);
    }
    const bulwarkWasCharging = isBulwark(defender) && defender.chargeT > 0;
    if (bulwarkWasCharging && dealt > 0) {
      applyBulwarkHitChargePenalty(defender, dealt);
    }
    grantBulwarkUltFromDamageTaken(defender, dealt);
    if (attacker) trackPhoenixDamageDealt(attacker, dealt);
    if (
      attacker &&
      isReaverBoss(attacker) &&
      dealt > 0 &&
      !defender.isBot
    ) {
      reaverHealFromDamage(attacker, dealt);
    }
    if (opts.reaverRuinRoot && dealt > 0 && !defender.isBot) {
      defender.reaverRuinRootT = Math.max(
        defender.reaverRuinRootT || 0,
        REAVER_RUIN_ROOT_DURATION
      );
    }
    if (defender.hp <= 0) {
      spawnDeathBurst(defender.x, defender.y, defender.color);
      if (tryPhoenixUltRebirth(defender)) {
        /* Rebirth armed — revived instead of dying. */
        spawnRingBurst(defender.x, defender.y, "#fb923c", 36);
      } else if (gameMode === "horde" && isHordeHero(defender)) {
        hordeEnterDowned(defender);
        grantUltimateKillCharge(attacker, defender);
        grantUltimateDeathCharge(defender);
      } else {
        handleFighterDeath(defender, attacker);
      }
    }
  }

  function startSwing(p, ratio, opts) {
    opts = opts || {};
    if (isHexwrightBoss(p)) return;
    if (
      isBulwark(p) &&
      (p.attackStyle === "barrage" || p.attackStyle === "aura") &&
      ratio < BULWARK_TAP_IGNORE_RAW
    ) {
      return;
    }
    // Unbreakable: fire the old charged aura instead of the barrage.
    if (isBulwark(p) && isBulwarkUnbreakable(p)) {
      beginBulwarkAuraSwing(p, ratio);
      return;
    }
    const swingRatio =
      isBulwark(p) &&
      (p.attackStyle === "barrage" || p.attackStyle === "aura")
        ? bulwarkEffectiveRatio(ratio)
        : ratio;
    p.swingId += 1;
    p.lastSwingChargeRatio = swingRatio;
    if (p.attackStyle === "barrage") {
      p.swingDamage = BULWARK_BARRAGE_DAMAGE * p.damageMultiplier;
    } else if (p.attackStyle === "aura") {
      p.swingDamage = bulwarkAuraDamageForRatio(swingRatio) * p.damageMultiplier;
    } else if (p.attackStyle === "bounce") {
      p.swingDamage = RICOCHET_DAMAGE_INITIAL;
    } else if (p.attackStyle === "spread") {
      const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
      const pelletBase =
        SPREAD_DAMAGE_BASE +
        (SPREAD_DAMAGE_MAX - SPREAD_DAMAGE_BASE) * ratio;
      p.swingDamage = pelletBase * p.damageMultiplier * charDmg;
    } else if (p.attackStyle === "nova") {
      const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
      const pelletBase =
        NOVA_DAMAGE_BASE +
        (NOVA_DAMAGE_MAX - NOVA_DAMAGE_BASE) * ratio;
      p.swingDamage = pelletBase * p.damageMultiplier * charDmg;
    } else if (isPhoenix(p)) {
      const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
      const shotBase =
        PHOENIX_SHOT_DAMAGE_MIN +
        (PHOENIX_SHOT_DAMAGE_MAX - PHOENIX_SHOT_DAMAGE_MIN) * ratio;
      p.swingDamage =
        shotBase * p.damageMultiplier * charDmg * phoenixReviveDamageMul(p);
    } else if (p.attackStyle === "lance") {
      const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
      const base =
        LANCE_DAMAGE_MIN + (LANCE_DAMAGE_MAX - LANCE_DAMAGE_MIN) * ratio;
      p.swingDamage = base * p.damageMultiplier * charDmg;
    } else {
      const base = DAMAGE_MIN + (DAMAGE_MAX - DAMAGE_MIN) * ratio;
      const charDmg = p.attackDamageMul != null ? p.attackDamageMul : 1;
      p.swingDamage = base * p.damageMultiplier * charDmg;
    }
    p.swingKnockMul = isBulwark(p)
      ? 0.5 + 0.12 * Math.sqrt(Math.max(1, swingRatio))
      : 0.55 + 0.45 * ratio;
    if (p.attackStyle === "barrage") {
      p.cooldown = BULWARK_BARRAGE_COOLDOWN;
    } else if (p.attackStyle === "aura") {
      p.cooldown = BULWARK_AURA_PULSE_CD;
    } else if (p.attackStyle === "bounce") {
      p.cooldown = RICOCHET_ATTACK_COOLDOWN * ricochetMapTuning().cooldownMul;
    } else if (p.attackStyle === "spread") {
      p.cooldown = SPREAD_ATTACK_COOLDOWN;
    } else if (p.attackStyle === "nova") {
      p.cooldown = NOVA_ATTACK_COOLDOWN;
    } else if (p.attackStyle === "lance") {
      p.cooldown = LANCE_ATTACK_COOLDOWN;
    } else if (isSiphon(p) && !opts.skipCooldown) {
      p.siphonShotCount = (p.siphonShotCount || 0) + 1;
      if (p.siphonShotCount >= SIPHON_RELOAD_EVERY) {
        p.siphonShotCount = 0;
        p.cooldown = SIPHON_ATTACK_COOLDOWN;
      } else {
        p.cooldown = ATTACK_COOLDOWN;
      }
    } else if (
      p.attackStyle !== "dash" &&
      p.attackStyle !== "phoenix" &&
      !opts.skipCooldown
    ) {
      p.cooldown = ATTACK_COOLDOWN;
    }
    p.chargeT = 0;
    p.chargeHoldT = 0;

    if (p.attackStyle === "ranged") {
      spawnProjectile(p, ratio);
      p.attackT = 0.1;
      return;
    }

    if (p.attackStyle === "barrage") {
      beginBulwarkBarrage(p, swingRatio);
      p.attackT =
        (p.barrage && p.barrage.duration) || BULWARK_BARRAGE_DURATION;
      p.needsRelease = true;
      return;
    }

    if (p.attackStyle === "spread") {
      spawnSpreadShots(p, ratio);
      p.attackT = 0.1;
      return;
    }

    if (p.attackStyle === "nova") {
      spawnNovaShots(p, ratio);
      p.attackT = 0.1;
      return;
    }

    if (p.attackStyle === "bounce") {
      spawnBounceShot(p, ratio);
      p.attackT = 0.06;
      return;
    }

    if (isPhoenix(p)) {
      startPhoenixAttack(p, ratio);
      return;
    }
    if (p.attackStyle === "dash") {
      startDash(p, ratio);
      return;
    }

    if (p.attackStyle === "aura") {
      p.attackT = bulwarkAuraActiveTime(swingRatio);
      p.needsRelease = true;
      return;
    }

    if (p.attackStyle === "lance") {
      p.lanceSwingFacing = p.facing;
      p.attackT = LANCE_ATTACK_ACTIVE;
      return;
    }

    p.attackT = ATTACK_ACTIVE;
  }

  function finishDashCooldown(p) {
    if ((p.ultDashChain || 0) > 0) {
      p.ultDashChain--;
      p.dashHitLanded = false;
      p.dashPerfectLanded = false;
      p.cooldown = 0;
      startDash(p, 1);
      return;
    }
    p.dashDamageMul = 1;
    if (isPhoenix(p)) {
      p.cooldown = PHOENIX_ATTACK_COOLDOWN * phoenixReviveCooldownMul(p);
      return;
    }
    let cd;
    if (p.dashPerfectLanded) {
      cd = DASH_COOLDOWN_PERFECT;
    } else if (p.dashHitLanded) {
      cd = DASH_COOLDOWN_HIT;
    } else {
      cd = DASH_COOLDOWN_MISS;
    }
    if (isReaverBoss(p)) cd *= REAVER_ATTACK_CD_MUL;
    p.cooldown = cd;
  }

  function dashMarkerOnDefender(attacker, defender) {
    const d = len(defender.x - attacker.dashEndX, defender.y - attacker.dashEndY);
    return d <= DASH_PERFECT_RADIUS + PLAYER_R * 0.35;
  }

  function startPhoenixAttack(p, ratio) {
    p.phoenixDashShotsFired = true;
    spawnPhoenixBackShots(p, ratio);
    const dist = dashDistForPlayer(p, ratio);
    p.dashDist = dist;
    p.dashTraveled = 0;
    p.dashHitLanded = false;
    p.dashPerfectLanded = false;
    p.dashSpeed =
      PHOENIX_DASH_SPEED_MIN +
      (PHOENIX_DASH_SPEED_MAX - PHOENIX_DASH_SPEED_MIN) * ratio;
    let dirX = Math.cos(p.facing);
    let dirY = Math.sin(p.facing);
    if ((p.isAi || p.isBot) && mapHasNavigationObstacles()) {
      const dashGoalX = p.x + dirX * Math.max(dist, 80);
      const dashGoalY = p.y + dirY * Math.max(dist, 80);
      const nav = mazeNavRows()
        ? aiSteerNav(p, dirX, dirY, dashGoalX, dashGoalY)
        : steerAroundObstacles(p, dirX, dirY);
      const n = norm(nav.ix, nav.iy);
      if (n.x !== 0 || n.y !== 0) {
        dirX = n.x;
        dirY = n.y;
        p.facing = Math.atan2(dirY, dirX);
      }
    }
    p.dashDirX = dirX;
    p.dashDirY = dirY;
    p.dashEndX = p.x + p.dashDirX * dist;
    p.dashEndY = p.y + p.dashDirY * dist;
    p.dashTotalT = dist / p.dashSpeed;
    p.dashT = p.dashTotalT;
    p.attackT = p.dashT;
    p.cooldown = 0;
    p.vx = 0;
    p.vy = 0;
  }

  function startDash(p, ratio) {
    if ((p.ultDashChain || 0) <= 0) p.dashDamageMul = 1;
    const dist = dashDistForPlayer(p, ratio);
    p.dashDist = dist;
    p.dashTraveled = 0;
    p.dashHitLanded = false;
    p.dashPerfectLanded = false;
    if (isPhoenix(p)) {
      p.dashSpeed =
        PHOENIX_DASH_SPEED_MIN +
        (PHOENIX_DASH_SPEED_MAX - PHOENIX_DASH_SPEED_MIN) * ratio;
    } else {
      p.dashSpeed = DASH_SPEED_MIN + (DASH_SPEED_MAX - DASH_SPEED_MIN) * ratio;
    }
    let dirX = Math.cos(p.facing);
    let dirY = Math.sin(p.facing);
    if ((p.isAi || p.isBot) && mapHasNavigationObstacles()) {
      const dashGoalX = p.x + dirX * Math.max(dist, 80);
      const dashGoalY = p.y + dirY * Math.max(dist, 80);
      const nav = mazeNavRows()
        ? aiSteerNav(p, dirX, dirY, dashGoalX, dashGoalY)
        : steerAroundObstacles(p, dirX, dirY);
      const n = norm(nav.ix, nav.iy);
      if (n.x !== 0 || n.y !== 0) {
        dirX = n.x;
        dirY = n.y;
        p.facing = Math.atan2(dirY, dirX);
      }
    }
    p.dashDirX = dirX;
    p.dashDirY = dirY;
    p.dashEndX = p.x + p.dashDirX * dist;
    p.dashEndY = p.y + p.dashDirY * dist;
    p.dashTotalT = dist / p.dashSpeed;
    p.dashT = p.dashTotalT;
    p.attackT = p.dashT;
    p.cooldown = 0;
    p.vx = 0;
    p.vy = 0;
  }

  function updateDash(p, dt) {
    if (p.dashT <= 0) return;

    const remain = p.dashDist - p.dashTraveled;
    const step = Math.min(p.dashSpeed * dt, remain);
    if (step > 1e-4) {
      p.x += p.dashDirX * step;
      p.y += p.dashDirY * step;
      p.dashTraveled += step;
      resolvePlayerWall(p);
    }

    p.dashT = Math.max(0, p.dashT - dt);
    p.attackT = p.dashT;

    if (!isPhoenix(p)) {
      for (let j = 0; j < players.length; j++) {
        tryDashHit(p, players[j]);
      }
      if (gameMode === "horde") {
        const wlist = mapRuntime.waveEnemies;
        for (let w = 0; w < wlist.length; w++) {
          tryDashHitWaveEnemy(p, wlist[w]);
        }
      }
      if (mapHasCreatures()) {
        const clist = mapRuntime.creatures;
        for (let c = 0; c < clist.length; c++) {
          tryDashHitCreature(p, clist[c]);
        }
        removeDeadCreatures();
      }
      const mlist = mapRuntime.bossMinions;
      for (let mi = mlist.length - 1; mi >= 0; mi--) {
        const m = mlist[mi];
        if (m.hp <= 0) continue;
        if (!isDashing(p)) continue;
        if (len(m.x - p.x, m.y - p.y) > getPlayerRadius(p) + m.r + DASH_HIT_PAD) {
          continue;
        }
        const swingKey = p.playerNum + ":bmd:" + p.swingId;
        if (m.lastHitSwingKey === swingKey) continue;
        m.lastHitSwingKey = swingKey;
        damageBossMinion(m, p.swingDamage * DASH_DAMAGE_IMPERFECT_MUL, p);
        p.dashHitLanded = true;
        healFromStrikerUltHit(p);
      }
    }

    if (p.dashTraveled >= p.dashDist - 1e-3 || p.dashT <= 0) {
      p.dashT = 0;
      p.attackT = 0;
      finishDashCooldown(p);
    }
  }

  function tryDashHitCreature(attacker, c) {
    if (gameOver || attacker.hp <= 0 || c.hp <= 0) return;
    if (!isDashing(attacker)) return;
    const dx = c.x - attacker.x;
    const dy = c.y - attacker.y;
    if (len(dx, dy) > getPlayerRadius(attacker) + c.r + DASH_HIT_PAD) return;
    const swingKey = attacker.playerNum + ":cd:" + attacker.swingId;
    if (c.lastHitSwingKey === swingKey) return;
    c.lastHitSwingKey = swingKey;
    const perfect = dashMarkerOnDefender(attacker, { x: c.x, y: c.y });
    const dmgMul = perfect
      ? DASH_DAMAGE_PERFECT_MUL
      : DASH_DAMAGE_IMPERFECT_MUL;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    damageCreature(c, attacker.swingDamage * dmgMul * dashMul, attacker);
    attacker.dashHitLanded = true;
    healFromStrikerUltHit(attacker);
    if (perfect) {
      attacker.dashPerfectLanded = true;
    }
  }

  function tryDashHit(attacker, defender) {
    if (gameOver || attacker.hp <= 0 || defender.hp <= 0) return;
    if (!isDashing(attacker)) return;
    if (!fightersCanDamage(attacker, defender)) return;

    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    if (
      len(dx, dy) >
      getPlayerRadius(attacker) + getPlayerRadius(defender) + DASH_HIT_PAD
    ) {
      return;
    }

    const swingKey = attacker.playerNum + ":" + attacker.swingId;
    if (defender.lastHitSwingKey === swingKey) return;

    const perfect = dashMarkerOnDefender(attacker, defender);
    const dmgMul = perfect
      ? DASH_DAMAGE_PERFECT_MUL
      : DASH_DAMAGE_IMPERFECT_MUL;
    const dashMul = attacker.dashDamageMul != null ? attacker.dashDamageMul : 1;
    const dmg = attacker.swingDamage * dmgMul * dashMul;

    applyDamageTo(defender, attacker, dmg, {
      hitFlash: perfect ? 0.28 : 0.16,
      swingKey: swingKey,
      knockFrom: attacker,
      knockMul: attacker.swingKnockMul * (perfect ? 0.13 : 0.085),
    });
    attacker.dashHitLanded = true;
    healFromStrikerUltHit(attacker);
    if (perfect) {
      attacker.dashPerfectLanded = true;
    }

  }

  function spawnSpreadShots(p, ratio) {
    const ang = p.facing;
    const speed = SPREAD_SPEED * (0.62 + 0.38 * ratio);
    const maxDist = spreadDistForPlayer(p, ratio);
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 6);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 6);
    const center = (SPREAD_PELLET_COUNT - 1) * 0.5;
    for (let i = 0; i < SPREAD_PELLET_COUNT; i++) {
      const pelletAng = ang + (i - center) * SPREAD_CONE_HALF_ANGLE;
      projectiles.push({
        kind: "spread",
        pelletIdx: i,
        x: ox,
        y: oy,
        px: ox,
        py: oy,
        spawnX: ox,
        spawnY: oy,
        vx: Math.cos(pelletAng) * speed,
        vy: Math.sin(pelletAng) * speed,
        baseSpeed: speed,
        age: 0,
        ownerNum: p.playerNum,
        swingId: p.swingId,
        baseDamage: p.swingDamage,
        knockMul: p.swingKnockMul,
        maxDist,
        traveled: 0,
        r: SPREAD_HIT_R,
        color: p.color,
      });
    }
  }

  function bulwarkBarrageCount(ratio) {
    const t = clamp(Math.max(0, ratio) / 1.15, 0, 1);
    return Math.round(
      BULWARK_BARRAGE_COUNT_MIN +
        (BULWARK_BARRAGE_COUNT_MAX - BULWARK_BARRAGE_COUNT_MIN) * t
    );
  }

  function fireBulwarkBarragePellet(p, pelletIdx, ratio) {
    const ang = p.facing;
    const cone = BULWARK_BARRAGE_CONE * (0.82 + 0.28 * Math.min(1.2, ratio));
    const maxDist =
      BULWARK_BARRAGE_MAX_DIST * (0.7 + 0.3 * Math.min(1.15, ratio));
    const baseSpeed =
      BULWARK_BARRAGE_SPEED * (0.68 + 0.32 * Math.min(1.15, ratio));
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 5);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 5);
    const centerBias = (Math.random() + Math.random()) * 0.5 - 0.5;
    const jitter = (Math.random() - 0.5) * 0.34;
    const pelletAng = ang + centerBias * cone + jitter;
    const speedMul =
      1 + (Math.random() - 0.5) * 2 * BULWARK_BARRAGE_SPEED_JITTER;
    const speed = baseSpeed * speedMul;
    const sx = ox + (Math.random() - 0.5) * 10;
    const sy = oy + (Math.random() - 0.5) * 10;
    projectiles.push({
      kind: "barrage",
      pelletIdx: pelletIdx,
      x: sx,
      y: sy,
      px: sx,
      py: sy,
      spawnX: sx,
      spawnY: sy,
      vx: Math.cos(pelletAng) * speed,
      vy: Math.sin(pelletAng) * speed,
      baseSpeed: speed,
      age: 0,
      ownerNum: p.playerNum,
      swingId: p.swingId,
      baseDamage: p.swingDamage * (0.85 + Math.random() * 0.3),
      knockMul: p.swingKnockMul * BULWARK_BARRAGE_KNOCK,
      maxDist: maxDist * (0.78 + Math.random() * 0.32),
      traveled: 0,
      r: BULWARK_BARRAGE_HIT_R * (0.8 + Math.random() * 0.4),
      color: p.color,
    });
  }

  function beginBulwarkBarrage(p, ratio) {
    const count = bulwarkBarrageCount(ratio);
    const duration = BULWARK_BARRAGE_DURATION;
    const times = [];
    for (let i = 0; i < count; i++) {
      // Irregular fire times across the spray window (random, not a metronome).
      times.push(Math.random() * duration);
    }
    times.sort((a, b) => a - b);
    // Kick the first pellet out almost immediately.
    times[0] = Math.min(times[0], 0.03 + Math.random() * 0.04);
    p.barrage = {
      ratio: ratio,
      elapsed: 0,
      nextIdx: 0,
      times: times,
      duration: duration,
    };
  }

  function tickBulwarkBarrage(p, dt) {
    if (p.bulwarkAuraUlt && (p.attackT || 0) <= 0) {
      p.bulwarkAuraUlt = false;
    }
    const b = p.barrage;
    if (!b) return;
    if (p.hp <= 0 || gameOver) {
      p.barrage = null;
      return;
    }
    b.elapsed += dt;
    const ratio = b.ratio != null ? b.ratio : 1;
    const duration =
      b.duration != null ? b.duration : BULWARK_BARRAGE_DURATION;
    while (b.nextIdx < b.times.length && b.elapsed >= b.times[b.nextIdx]) {
      fireBulwarkBarragePellet(p, b.nextIdx, ratio);
      b.nextIdx += 1;
    }
    if (b.nextIdx >= b.times.length || b.elapsed >= duration + 0.05) {
      p.barrage = null;
    }
  }

  function spawnNovaShots(p, ratio) {
    const facing = p.facing;
    const baseSpeed = NOVA_SPEED * (0.62 + 0.38 * ratio);
    const maxDist = novaDistForPlayer(p, ratio);
    const ox = p.x + Math.cos(facing) * (getPlayerRadius(p) + 6);
    const oy = p.y + Math.sin(facing) * (getPlayerRadius(p) + 6);
    const step = (Math.PI * 2) / NOVA_PELLET_COUNT;
    for (let i = 0; i < NOVA_PELLET_COUNT; i++) {
      const pelletAng = facing + i * step;
      const angleMul = novaPelletAngleMul(i);
      const speedMul = novaPelletSpeedMul(i);
      const speed = baseSpeed * speedMul;
      projectiles.push({
        kind: "nova",
        pelletIdx: i,
        angleMul: angleMul,
        speedMul: speedMul,
        x: ox,
        y: oy,
        px: ox,
        py: oy,
        spawnX: ox,
        spawnY: oy,
        vx: Math.cos(pelletAng) * speed,
        vy: Math.sin(pelletAng) * speed,
        baseSpeed: speed,
        age: 0,
        ownerNum: p.playerNum,
        swingId: p.swingId,
        baseDamage: p.swingDamage,
        // Normal Nova bolts deal damage only, no knockback.
        knockMul: 0,
        maxDist: maxDist,
        traveled: 0,
        r: NOVA_HIT_R,
        color: p.color,
      });
    }
  }

  function phoenixUltAttackActive(p) {
    return isPhoenix(p) && (p.ultDmgMulT || 0) > 0;
  }

  function spawnPhoenixBackShots(p, ratio) {
    const speed = PHOENIX_SHOT_SPEED * (0.65 + 0.35 * ratio);
    const maxDist = PHOENIX_SHOT_RANGE;
    const forward = phoenixUltAttackActive(p);
    const spread = forward ? PHOENIX_SHOT_SPREAD_ULT : PHOENIX_SHOT_SPREAD;
    const baseAng = forward ? p.facing : p.facing + Math.PI;
    const ox = p.x + (forward ? Math.cos(p.facing) * 8 : 0);
    const oy = p.y + (forward ? Math.sin(p.facing) * 8 : 0);
    for (let i = 0; i < 2; i++) {
      const off = i === 0 ? -spread : spread;
      const flyAng = baseAng + off;
      projectiles.push({
        kind: "phoenix",
        pelletIdx: i,
        x: ox,
        y: oy,
        px: ox,
        py: oy,
        spawnX: ox,
        spawnY: oy,
        vx: Math.cos(flyAng) * speed,
        vy: Math.sin(flyAng) * speed,
        baseSpeed: speed,
        age: 0,
        ownerNum: p.playerNum,
        swingId: p.swingId,
        baseDamage: p.swingDamage,
        knockMul: p.swingKnockMul,
        maxDist: maxDist,
        traveled: 0,
        r: RANGED_HIT_R,
        color: p.color,
      });
    }
  }

  function spawnProjectile(p, ratio) {
    const ang = p.facing;
    const r = clamp(ratio != null ? ratio : 0, 0, 1);
    const grappler = isGrappler(p);
    const siphon = isSiphon(p);
    const marionette = isMarionette(p);
    let speed = RANGED_SPEED * (0.55 + 0.45 * r);
    let hitR = grappler ? GRAPPLE_HIT_R : RANGED_HIT_R;
    if (siphon) {
      speed =
        RANGED_SPEED *
        (SIPHON_BOLT_SPEED_MIN_MUL +
          (SIPHON_BOLT_SPEED_MAX_MUL - SIPHON_BOLT_SPEED_MIN_MUL) * r);
      hitR =
        SIPHON_BOLT_HIT_R_MIN +
        (SIPHON_BOLT_HIT_R_MAX - SIPHON_BOLT_HIT_R_MIN) * r;
    } else if (marionette) {
      speed = MARIONETTE_NEEDLE_SPEED * (0.7 + 0.3 * r);
      hitR = MARIONETTE_NEEDLE_HIT_R;
    }
    const maxDist = rangedDistForPlayer(p, r);
    const ox = p.x + Math.cos(ang) * (PLAYER_R + 6);
    const oy = p.y + Math.sin(ang) * (PLAYER_R + 6);
    projectiles.push({
      kind: grappler ? "grapple" : siphon ? "siphon" : marionette ? "needle" : "ranged",
      x: ox,
      y: oy,
      px: ox,
      py: oy,
      spawnX: ox,
      spawnY: oy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      baseSpeed: speed,
      age: 0,
      ownerNum: p.playerNum,
      swingId: p.swingId,
      baseDamage: p.swingDamage,
      knockMul: p.swingKnockMul,
      maxDist,
      traveled: 0,
      r: hitR,
      color: p.color,
      reverseKnock: grappler,
      reverseKnockMul: grappler ? GRAPPLE_REVERSE_KNOCK_MUL : undefined,
      pierce: marionette,
    });
  }

  function ricochetBoltDamage(pr) {
    const tune = pr.ricochetTune || ricochetMapTuning();
    const bounces = Math.max(0, pr.wallBounceIdx || 0);
    const chargeRatio = pr.chargeRatio != null ? pr.chargeRatio : 0;
    const chargeDmgMul =
      RICOCHET_CHARGE_DAMAGE_MIN_MUL +
      (1 - RICOCHET_CHARGE_DAMAGE_MIN_MUL) * chargeRatio;
    const chargeBoost =
      1 + (RICOCHET_CHARGE_BOUNCE_DMG_MUL_MAX - 1) * chargeRatio;
    const growth =
      1 +
      (RICOCHET_WALL_DMG_EXP - 1) *
        (tune.bounceDmgMul != null ? tune.bounceDmgMul : 1) *
        chargeBoost;
    const dmgMul = tune.damageMul != null ? tune.damageMul : 1;
    return (
      RICOCHET_DAMAGE_INITIAL *
      dmgMul *
      chargeDmgMul *
      Math.pow(Math.max(1.01, growth), bounces)
    );
  }

  function spawnBounceShot(p, ratio, opts) {
    opts = opts || {};
    const tune = ricochetMapTuning();
    const ult = !!opts.ultShot;
    const ang = opts.angle != null ? opts.angle : p.facing;
    const speed = RICOCHET_SHOT_SPEED * (0.86 + 0.14 * ratio);
    const ox = p.x + Math.cos(ang) * (getPlayerRadius(p) + 8);
    const oy = p.y + Math.sin(ang) * (getPlayerRadius(p) + 8);
    const life =
      (ult ? RICOCHET_ULT_SHOT_LIFE : RICOCHET_SHOT_LIFE * (0.9 + 0.1 * ratio)) *
      tune.lifeMul *
      (ult ? 1.15 : 1);
    projectiles.push({
      kind: "bounce",
      pelletIdx: opts.pelletIdx != null ? opts.pelletIdx : 0,
      x: ox,
      y: oy,
      px: ox,
      py: oy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      baseSpeed: speed,
      age: 0,
      ownerNum: p.playerNum,
      swingId: p.swingId,
      wallBounceIdx: 0,
      hitSeq: 0,
      ricochetBaseDamage: p.swingDamage,
      baseDamage: p.swingDamage,
      ricochetTune: tune,
      chargeRatio: ratio,
      lifeCap: RICOCHET_SHOT_LIFE_CAP + RICOCHET_SHOT_LIFE_CAP_CHARGE_BONUS * ratio,
      knockMul: p.swingKnockMul,
      maxDist:
        RICOCHET_MAX_DIST *
        (0.88 + 0.12 * ratio) *
        tune.rangeMul *
        (ult ? 1.2 : 1),
      traveled: 0,
      life: life,
      maxLife: life,
      bouncesLeft: ult ? tune.maxBounces + 4 : tune.maxBounces,
      r: RICOCHET_HIT_R,
      color: p.color,
      hitLockT: 0,
      ultShot: ult,
    });
  }

  function refreshRicochetLifeOnEnemyHit(pr) {
    // The bolt also dies once cumulative pr.traveled crosses pr.maxDist,
    // independent of its lifetime — without resetting that budget here too,
    // a bolt reaches maxDist in ~2-2.5s of flight regardless of how much
    // life it's been granted, making the life reset above nearly moot.
    pr.traveled = 0;
    if (pr.ultShot) {
      // Prism Cascade: full lifetime reset on every fighter hit, and the
      // reset target itself grows a little each hit, capped.
      const base = pr.maxLife != null ? pr.maxLife : RICOCHET_ULT_SHOT_LIFE;
      const grown = Math.min(
        base + RICOCHET_ULT_LIFE_GROWTH_PER_HIT,
        RICOCHET_ULT_LIFE_CAP
      );
      pr.maxLife = grown;
      pr.life = grown;
      return;
    }
    pr.life = Math.min(
      pr.life + RICOCHET_LIFE_BONUS_ON_HIT,
      pr.lifeCap != null ? pr.lifeCap : RICOCHET_SHOT_LIFE_CAP
    );
  }

  /** Scale velocity toward launchSpeed + accel*age, capped by maxMul. */
  function accelerateProjectile(pr, dt, accel, maxMul) {
    const base =
      pr.baseSpeed != null && pr.baseSpeed > 1e-3
        ? pr.baseSpeed
        : len(pr.vx, pr.vy);
    if (!(base > 1e-3)) return;
    pr.age = (pr.age || 0) + dt;
    const target = Math.min(base * maxMul, base + accel * pr.age);
    const sp = len(pr.vx, pr.vy);
    if (sp < 1e-3) return;
    const scale = target / sp;
    pr.vx *= scale;
    pr.vy *= scale;
  }

  function projectileTargetSpeed(pr, accel, maxMul) {
    const base =
      pr.baseSpeed != null && pr.baseSpeed > 1e-3
        ? pr.baseSpeed
        : len(pr.vx, pr.vy);
    if (!(base > 1e-3)) return RICOCHET_SHOT_SPEED;
    return Math.min(base * maxMul, base + accel * (pr.age || 0));
  }

  function reflectVelocity(vx, vy, nx, ny) {
    const dot = vx * nx + vy * ny;
    return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
  }

  function segmentHitsCircle(x0, y0, x1, y1, cx, cy, radius) {
    const sdx = x1 - x0;
    const sdy = y1 - y0;
    const len2 = sdx * sdx + sdy * sdy;
    if (len2 < 1e-8) {
      return len(cx - x0, cy - y0) <= radius;
    }
    let t = ((cx - x0) * sdx + (cy - y0) * sdy) / len2;
    t = clamp(t, 0, 1);
    const cxp = x0 + sdx * t;
    const cyp = y0 + sdy * t;
    return len(cx - cxp, cy - cyp) <= radius;
  }

  function ejectBounceShotFromPlayer(pr, target, reflect) {
    let dx = pr.x - target.x;
    let dy = pr.y - target.y;
    let d = len(dx, dy);
    let nx;
    let ny;
    if (d < 1e-3) {
      const vlen = len(pr.vx, pr.vy);
      if (vlen > 1e-3) {
        nx = pr.vx / vlen;
        ny = pr.vy / vlen;
      } else {
        nx = 1;
        ny = 0;
      }
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    const out = getPlayerRadius(target) + pr.r + RICOCHET_EXIT_PAD;
    pr.x = target.x + nx * out;
    pr.y = target.y + ny * out;
    if (reflect) {
      const rv = reflectVelocity(pr.vx, pr.vy, nx, ny);
      const rsp = len(rv.vx, rv.vy);
      if (rsp > 1e-3) {
        const keep = Math.max(
          projectileTargetSpeed(
            pr,
            RICOCHET_SPEED_ACCEL,
            RICOCHET_SPEED_MAX_MUL
          ),
          RICOCHET_SHOT_SPEED * 0.94
        );
        pr.vx = (rv.vx / rsp) * keep;
        pr.vy = (rv.vy / rsp) * keep;
      } else {
        pr.vx = rv.vx;
        pr.vy = rv.vy;
      }
    }
    const vlen = len(pr.vx, pr.vy);
    if (vlen > 1e-3) {
      pr.x += (pr.vx / vlen) * 6;
      pr.y += (pr.vy / vlen) * 6;
    }
  }

  function mapWallBounceNormal(hx, hy, w, pad) {
    const left = w.minX - pad;
    const right = w.maxX + pad;
    const top = w.minY - pad;
    const bottom = w.maxY + pad;
    const dL = Math.abs(hx - left);
    const dR = Math.abs(hx - right);
    const dT = Math.abs(hy - top);
    const dB = Math.abs(hy - bottom);
    const m = Math.min(dL, dR, dT, dB);
    if (m === dL) return { nx: -1, ny: 0 };
    if (m === dR) return { nx: 1, ny: 0 };
    if (m === dT) return { nx: 0, ny: -1 };
    return { nx: 0, ny: 1 };
  }

  /** Labyrinth (and any mapRuntime.walls) — sweep + overlap so thin panels register. */
  function reflectBounceOffMapWalls(pr) {
    const walls = mapRuntime.walls;
    if (!walls.length) return false;

    let bounced = false;
    const bodyR = pr.r;
    const sx = pr.px;
    const sy = pr.py;
    const dx = pr.x - sx;
    const dy = pr.y - sy;
    const step = len(dx, dy);

    if (step > 1e-6) {
      const dirX = dx / step;
      const dirY = dy / step;
      let bestT = Infinity;
      let bestNx = 0;
      let bestNy = 0;
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        const t = rayDistToAabb(
          sx,
          sy,
          dirX,
          dirY,
          w.minX - bodyR,
          w.minY - bodyR,
          w.maxX + bodyR,
          w.maxY + bodyR
        );
        if (t >= 1e-4 && t <= step + 1e-3 && t < bestT) {
          bestT = t;
          const hx = sx + dirX * t;
          const hy = sy + dirY * t;
          const n = mapWallBounceNormal(hx, hy, w, bodyR);
          bestNx = n.nx;
          bestNy = n.ny;
        }
      }
      if (bestT < Infinity) {
        pr.x = sx + dirX * bestT + bestNx * 4;
        pr.y = sy + dirY * bestT + bestNy * 4;
        const rv = reflectVelocity(pr.vx, pr.vy, bestNx, bestNy);
        pr.vx = rv.vx;
        pr.vy = rv.vy;
        bounced = true;
      }
    }

    for (let pass = 0; pass < 4; pass++) {
      let hit = false;
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        const left = w.minX - bodyR;
        const right = w.maxX + bodyR;
        const top = w.minY - bodyR;
        const bottom = w.maxY + bodyR;
        if (pr.x < left || pr.x > right || pr.y < top || pr.y > bottom) continue;
        const penL = pr.x - left;
        const penR = right - pr.x;
        const penT = pr.y - top;
        const penB = bottom - pr.y;
        const minPen = Math.min(penL, penR, penT, penB);
        let nx;
        let ny;
        if (minPen === penL) {
          pr.x = left;
          nx = -1;
          ny = 0;
        } else if (minPen === penR) {
          pr.x = right;
          nx = 1;
          ny = 0;
        } else if (minPen === penT) {
          pr.y = top;
          nx = 0;
          ny = -1;
        } else {
          pr.y = bottom;
          nx = 0;
          ny = 1;
        }
        const dot = pr.vx * nx + pr.vy * ny;
        if (dot < 0) {
          const rv = reflectVelocity(pr.vx, pr.vy, nx, ny);
          pr.vx = rv.vx;
          pr.vy = rv.vy;
        }
        hit = true;
        bounced = true;
      }
      if (!hit) break;
    }
    return bounced;
  }

  function nearestEnemyFighterTo(x, y, owner) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const t = players[i];
      if (t === owner || t.hp <= 0) continue;
      if (!fightersCanDamage(owner, t)) continue;
      const d = len(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  function bounceShotOffWalls(pr, owner) {
    let bounced = false;
    const obs = getCollidableObstacles();
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = pr.x - o.x;
      const dy = pr.y - o.y;
      const d = len(dx, dy);
      const minD = o.r + pr.r;
      if (d >= minD || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      pr.x = o.x + nx * minD;
      pr.y = o.y + ny * minD;
      const dot = pr.vx * nx + pr.vy * ny;
      pr.vx -= 2 * dot * nx;
      pr.vy -= 2 * dot * ny;
      bounced = true;
    }
    if (reflectBounceOffMapWalls(pr)) {
      bounced = true;
    }
    if (currentMapDef().bounds === "rect") {
      const b = rectArenaBounds(pr.r);
      if (pr.x < b.minX) {
        pr.x = b.minX;
        pr.vx = Math.abs(pr.vx);
        bounced = true;
      } else if (pr.x > b.maxX) {
        pr.x = b.maxX;
        pr.vx = -Math.abs(pr.vx);
        bounced = true;
      }
      if (pr.y < b.minY) {
        pr.y = b.minY;
        pr.vy = Math.abs(pr.vy);
        bounced = true;
      } else if (pr.y > b.maxY) {
        pr.y = b.maxY;
        pr.vy = -Math.abs(pr.vy);
        bounced = true;
      }
    } else {
      const ac = arenaCenter();
      const maxR = arenaBoundaryRadius(pr.r);
      const dx = pr.x - ac.cx;
      const dy = pr.y - ac.cy;
      const d = len(dx, dy);
      if (d > maxR && d > 1e-6) {
        const nx = dx / d;
        const ny = dy / d;
        pr.x = ac.cx + nx * maxR;
        pr.y = ac.cy + ny * maxR;
        const dot = pr.vx * nx + pr.vy * ny;
        pr.vx -= 2 * dot * nx;
        pr.vy -= 2 * dot * ny;
        bounced = true;
      }
    }
    if (bounced) {
      pr.bouncesLeft -= 1;
      pr.wallBounceIdx = (pr.wallBounceIdx || 0) + 1;
      if (pr.ultShot && owner) {
        const target = nearestEnemyFighterTo(pr.x, pr.y, owner);
        if (target) {
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let diff = angleDiff(desired, cur);
          if (diff > RICOCHET_ULT_BOUNCE_HOMING_TURN) {
            diff = RICOCHET_ULT_BOUNCE_HOMING_TURN;
          } else if (diff < -RICOCHET_ULT_BOUNCE_HOMING_TURN) {
            diff = -RICOCHET_ULT_BOUNCE_HOMING_TURN;
          }
          const newAngle = cur + diff;
          const speed = len(pr.vx, pr.vy);
          pr.vx = Math.cos(newAngle) * speed;
          pr.vy = Math.sin(newAngle) * speed;
        }
      }
    }
    return bounced;
  }

  function updateBounceProjectile(pr, owner, dt, i) {
    if (!pr.ultShot) {
      accelerateProjectile(
        pr,
        dt,
        RICOCHET_SPEED_ACCEL,
        RICOCHET_SPEED_MAX_MUL
      );
    }
    pr.px = pr.x;
    pr.py = pr.y;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    const step = len(pr.vx * dt, pr.vy * dt);
    pr.traveled += step;
    pr.life -= dt;
    pr.hitLockT = Math.max(0, (pr.hitLockT || 0) - dt);

    bounceShotOffWalls(pr, owner);
    const bObs = resolveObstacleCollision(pr.x, pr.y, pr.vx, pr.vy, pr.r);
    pr.x = bObs.x;
    pr.y = bObs.y;
    pr.vx = bObs.vx;
    pr.vy = bObs.vy;
    const bPort = tryPortalTeleport(pr.x, pr.y, pr.vx, pr.vy, pr.r, "bounce" + i, true);
    if (bPort) {
      pr.x = bPort.x;
      pr.y = bPort.y;
      pr.vx = bPort.vx;
      pr.vy = bPort.vy;
    }

    if (pr.life <= 0 || pr.traveled >= pr.maxDist || pr.bouncesLeft < 0) {
      projectiles.splice(i, 1);
      return;
    }

    if (pr.hitLockT > 0) {
      return;
    }

    tryProjectileHitCreatures(pr, owner, false);
    tryProjectileHitEchoSummons(pr, owner, false);
    tryProjectileHitPikeSpears(pr, owner, false);
    tryProjectileHitMarionetteEffigies(pr, owner, false);
    if (gameMode === "siege") tryProjectileHitBase(pr, owner, false);

    for (let j = 0; j < players.length; j++) {
      const target = players[j];
      if (target.playerNum === pr.ownerNum) continue;
      if (target.hp <= 0) continue;
      if (!fightersCanDamage(owner, target)) continue;

      const hitR = pr.r + getPlayerRadius(target);
      const dPrev = len(target.x - pr.px, target.y - pr.py);
      const dNow = len(target.x - pr.x, target.y - pr.y);
      const wasInside = dPrev < hitR;
      const nowInside = dNow < hitR;
      const crossed =
        !wasInside &&
        (nowInside ||
          segmentHitsCircle(
            pr.px,
            pr.py,
            pr.x,
            pr.y,
            target.x,
            target.y,
            hitR
          ));

      if (!nowInside && !crossed) continue;

      if (wasInside && nowInside) {
        ejectBounceShotFromPlayer(pr, target, true);
        pr.hitLockT = RICOCHET_HIT_LOCK * 0.35;
        return;
      }

      if (!crossed) continue;

      const swingKey =
        pr.ownerNum + ":" + pr.swingId + ":" + (pr.hitSeq || 0);
      if (target.lastHitSwingKey === swingKey) continue;

      applyDamageTo(target, owner, ricochetBoltDamage(pr), {
        hitFlash: 0.16,
        swingKey: swingKey,
        knockFrom: { x: pr.x, y: pr.y },
        knockMul:
          pr.knockMul * (0.055 + 0.012 * (pr.wallBounceIdx || 0)),
      });

      ejectBounceShotFromPlayer(pr, target, true);
      pr.hitSeq = (pr.hitSeq || 0) + 1;
      refreshRicochetLifeOnEnemyHit(pr);
      pr.hitLockT = RICOCHET_HIT_LOCK;
      bounceShotOffWalls(pr, owner);
      if (pr.bouncesLeft < 0 || pr.life <= 0) {
        projectiles.splice(i, 1);
      }
      return;
    }
  }

  function marksmanBoltDamage(pr, target) {
    const sx = pr.spawnX != null ? pr.spawnX : pr.x;
    const sy = pr.spawnY != null ? pr.spawnY : pr.y;
    const dist = len(target.x - sx, target.y - sy);
    const t = pr.maxDist > 1e-3 ? clamp(dist / pr.maxDist, 0, 1) : 0;
    const mul =
      RANGED_DIST_DMG_MIN_MUL +
      (RANGED_DIST_DMG_MAX_MUL - RANGED_DIST_DMG_MIN_MUL) * t;
    const dmg = pr.baseDamage * mul;
    return Number.isFinite(dmg) ? dmg : pr.baseDamage || 0;
  }

  function grappleBoltDamage(pr, target) {
    const sx = pr.spawnX != null ? pr.spawnX : pr.x;
    const sy = pr.spawnY != null ? pr.spawnY : pr.y;
    const dist = len(target.x - sx, target.y - sy);
    const t = pr.maxDist > 1e-3 ? clamp(dist / pr.maxDist, 0, 1) : 0;
    const mul =
      GRAPPLE_FAR_DMG_MUL +
      (GRAPPLE_CLOSE_DMG_MUL - GRAPPLE_FAR_DMG_MUL) * (1 - t);
    const dmg = pr.baseDamage * mul;
    return Number.isFinite(dmg) ? dmg : pr.baseDamage || 0;
  }

  function projectileBoltDamage(pr, target) {
    if (pr.kind === "phoenix" || pr.kind === "barrage") return pr.baseDamage;
    if (pr.kind === "spread") return spreadBoltDamage(pr, target);
    if (pr.kind === "nova") return novaBoltDamage(pr, target);
    if (pr.kind === "bounce") return ricochetBoltDamage(pr);
    if (pr.kind === "grapple") return grappleBoltDamage(pr, target);
    return marksmanBoltDamage(pr, target);
  }

  function spreadBoltDamage(pr, target) {
    const sx = pr.spawnX != null ? pr.spawnX : pr.x;
    const sy = pr.spawnY != null ? pr.spawnY : pr.y;
    const dist = len(target.x - sx, target.y - sy);
    const t = pr.maxDist > 1e-3 ? clamp(dist / pr.maxDist, 0, 1) : 0;
    const mul =
      SPREAD_FAR_DMG_MUL +
      (SPREAD_CLOSE_DMG_MUL - SPREAD_FAR_DMG_MUL) * (1 - t);
    const dmg = pr.baseDamage * mul;
    return Number.isFinite(dmg) ? dmg : pr.baseDamage || 0;
  }

  function novaBoltDamage(pr, target) {
    const sx = pr.spawnX != null ? pr.spawnX : pr.x;
    const sy = pr.spawnY != null ? pr.spawnY : pr.y;
    const dist = len(target.x - sx, target.y - sy);
    const t = pr.maxDist > 1e-3 ? clamp(dist / pr.maxDist, 0, 1) : 0;
    const distMul =
      SPREAD_FAR_DMG_MUL +
      (SPREAD_CLOSE_DMG_MUL - SPREAD_FAR_DMG_MUL) * (1 - t);
    const angleMul = pr.angleMul != null ? pr.angleMul : 1;
    const dmg = pr.baseDamage * distMul * angleMul;
    return Number.isFinite(dmg) ? dmg : pr.baseDamage || 0;
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      const owner = players.find((pl) => pl.playerNum === pr.ownerNum);
      if (!owner || owner.hp <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      if (pr.kind === "bounce") {
        updateBounceProjectile(pr, owner, dt, i);
        continue;
      }

      const isSpread = pr.kind === "spread";
      const isNova = pr.kind === "nova";
      const isBarrage = pr.kind === "barrage";

      accelerateProjectile(pr, dt, BOLT_SPEED_ACCEL, BOLT_SPEED_MAX_MUL);
      pr.px = pr.x;
      pr.py = pr.y;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      const step = len(pr.vx * dt, pr.vy * dt);
      pr.traveled += step;

      if (!isInsideArena(pr.x, pr.y, -14) || pr.traveled >= pr.maxDist) {
        projectiles.splice(i, 1);
        continue;
      }

      const obsRes = resolveObstacleCollision(
        pr.x,
        pr.y,
        pr.vx,
        pr.vy,
        pr.r
      );
      pr.x = obsRes.x;
      pr.y = obsRes.y;
      pr.vx = obsRes.vx;
      pr.vy = obsRes.vy;

      const prPort = tryPortalTeleport(
        pr.x,
        pr.y,
        pr.vx,
        pr.vy,
        pr.r,
        "pr" + i,
        true
      );
      if (prPort) {
        pr.x = prPort.x;
        pr.y = prPort.y;
        pr.vx = prPort.vx;
        pr.vy = prPort.vy;
      }

      if (tryProjectileHitCreatures(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (tryProjectileHitWaveEnemies(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (tryProjectileHitBossMinions(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (tryProjectileHitEchoSummons(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (tryProjectileHitPikeSpears(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (tryProjectileHitMarionetteEffigies(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (gameMode === "siege" && tryProjectileHitBase(pr, owner, true)) {
        projectiles.splice(i, 1);
        continue;
      }

      for (let j = 0; j < players.length; j++) {
        const target = players[j];
        if (target.playerNum === pr.ownerNum) continue;
        if (target.hp <= 0) continue;
        if (!fightersCanDamage(owner, target)) continue;
        const dx = target.x - pr.x;
        const dy = target.y - pr.y;
        if (len(dx, dy) > pr.r + getPlayerRadius(target)) continue;

        const swingKey =
          pr.ownerNum +
          ":" +
          pr.swingId +
          ":" +
          (pr.pelletIdx != null ? pr.pelletIdx : 0);
        if (target.lastHitSwingKey === swingKey) continue;

        const boltDmg = projectileBoltDamage(pr, target);
        const sx = pr.spawnX != null ? pr.spawnX : pr.x;
        const sy = pr.spawnY != null ? pr.spawnY : pr.y;
        const distT = len(target.x - sx, target.y - sy);
        const distMul =
          pr.maxDist > 1e-3 ? clamp(distT / pr.maxDist, 0, 1) : 0;
        const knockScale = isSpread || isNova || isBarrage
          ? 0.048 + 0.024 * (1 - distMul)
          : 0.055 + 0.02 * distMul;
        const reverse = !!pr.reverseKnock;
        const reverseMul = pr.reverseKnockMul != null ? pr.reverseKnockMul : 1;
        applyDamageTo(target, owner, boltDmg, {
          hitFlash: 0.18,
          swingKey: swingKey,
          // Grappler pulls toward spawn; normal shots (incl. Nova ult pellets) push from the bolt.
          knockFrom: reverse ? { x: sx, y: sy } : { x: pr.x, y: pr.y },
          knockMul:
            pr.knockMul * knockScale * (reverse ? -reverseMul : 1),
        });

        // Piercing needles keep flying and can still hit other targets this
        // frame (or later ones — the swingKey guard above stops a repeat
        // hit on the same fighter).
        if (pr.pierce) continue;
        projectiles.splice(i, 1);
        break;
      }
    }
  }

  let winCheckPending = false;

  function queueWinCheck() {
    winCheckPending = true;
  }

  /** Run after all damage in a frame so mutual KOs don't crown a winner mid-swing. */
  function flushWinCheck() {
    if (!winCheckPending) return;
    winCheckPending = false;
    if (gameOver) return;
    evaluateMatchEnd();
  }

  function checkWinAfterKo(/* defender */) {
    // Kept for call sites; win is evaluated once per frame via flushWinCheck.
    queueWinCheck();
  }

  function evaluateMatchEnd() {
    if (gameOver) return;
    if (gameMode === "horde") {
      hordeCheckDefeat();
      return;
    }
    if (gameMode === "boss") {
      const bossDead = players.some((pl) => pl.isBot && pl.hp <= 0);
      if (bossDead) {
        winner = "heroes";
        gameOver = true;
        showOverlay();
        return;
      }
      const botAlive = players.some((pl) => pl.isBot && pl.hp > 0);
      const heroesAlive = players.filter(
        (pl) => !pl.isBot && fighterStillInMatch(pl)
      ).length;
      if (heroesAlive === 0 && botAlive) {
        winner = "bot";
        gameOver = true;
        showOverlay();
      }
      return;
    }
    if (gameMode === "versus") {
      const inMatch = players.filter((pl) => !pl.isBot && fighterStillInMatch(pl));
      if (inMatch.length === 1) {
        winner = inMatch[0].playerNum;
        gameOver = true;
        showOverlay();
      } else if (inMatch.length === 0) {
        winner = "draw";
        gameOver = true;
        showOverlay();
      }
      return;
    }
    if (gameMode === "teams") {
      const inMatch = players.filter((pl) => !pl.isBot && fighterStillInMatch(pl));
      const teamsLeft = [];
      for (let i = 0; i < inMatch.length; i++) {
        const t = inMatch[i].fightTeam;
        if (teamsLeft.indexOf(t) < 0) teamsLeft.push(t);
      }
      if (teamsLeft.length <= 1) {
        winner = teamsLeft.length === 1 ? teamsLeft[0] : "draw";
        gameOver = true;
        showOverlay();
      }
      return;
    }
    if (gameMode === "siege") {
      const baseA = mapRuntime.bases.find((b) => b.team === "a");
      const baseB = mapRuntime.bases.find((b) => b.team === "b");
      const aAlive =
        !!baseA &&
        !baseA.destroyed &&
        players.some((pl) => pl.fightTeam === "a" && fighterStillInMatch(pl));
      const bAlive =
        !!baseB &&
        !baseB.destroyed &&
        players.some((pl) => pl.fightTeam === "b" && fighterStillInMatch(pl));
      if (!aAlive && !bAlive) {
        winner = "draw";
        gameOver = true;
        showOverlay();
      } else if (!aAlive) {
        winner = "b";
        gameOver = true;
        showOverlay();
      } else if (!bAlive) {
        winner = "a";
        gameOver = true;
        showOverlay();
      }
    }
  }

  function auraHit(attacker, target) {
    if (!isBulwarkAuraSwing(attacker)) return false;
    if (attacker.hp <= 0 || target.hp <= 0) return false;
    const ratio = attacker.lastSwingChargeRatio;
    const radius = auraRadiusForPlayer(attacker, ratio);
    const d = len(target.x - attacker.x, target.y - attacker.y);
    return d <= radius + getPlayerRadius(target);
  }

  function sectorHit(attacker, target) {
    if (
      attacker.attackStyle === "ranged" ||
      attacker.attackStyle === "spread" ||
      attacker.attackStyle === "nova" ||
      attacker.attackStyle === "barrage" ||
      attacker.attackStyle === "dash" ||
      attacker.attackStyle === "phoenix" ||
      attacker.attackStyle === "aura" ||
      attacker.attackStyle === "bounce" ||
      attacker.attackStyle === "beam"
    ) {
      return false;
    }
    if (attacker.hp <= 0 || attacker.attackT <= 0 || target.hp <= 0) return false;
    if (attacker.attackStyle === "lance") {
      return lanceCorridorHit(
        attacker,
        target.x,
        target.y,
        getPlayerRadius(target)
      );
    }
    const ratio = attacker.lastSwingChargeRatio;
    const range = attackSectorRange(attacker, ratio);
    const arc = attackSectorArc(attacker, ratio);
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const d = len(dx, dy);
    if (d > range + getPlayerRadius(target)) return false;
    const ang = Math.atan2(dy, dx);
    const ad = Math.abs(angleDiff(ang, attacker.facing));
    if (ad > arc * 0.5) return false;
    if (d < 8) return false;
    return true;
  }

  function separatePlayers() {
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i];
          const b = players[j];
          if (a.eliminated || b.eliminated) continue;
          if (a.hp <= 0 && !isHordeHeroDowned(a)) continue;
          if (b.hp <= 0 && !isHordeHeroDowned(b)) continue;
          // Nova / Siphon Vacuum Rift phase through other fighters (no body collision).
          if (isNova(a) || isNova(b) || isSiphonPhasing(a) || isSiphonPhasing(b)) {
            continue;
          }
          const minD = getPlayerRadius(a) + getPlayerRadius(b);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let d = len(dx, dy);
          if (d >= minD) continue;
          let nx;
          let ny;
          if (d < 1e-6) {
            const ang = (i + j + 1) * 2.399;
            nx = Math.cos(ang);
            ny = Math.sin(ang);
            d = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const push = (minD - d) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    for (let i = 0; i < players.length; i++) {
      if (players[i].hp > 0) resolvePlayerWall(players[i]);
    }
  }

  function tryHit(attacker, defender) {
    if (gameOver || attacker.hp <= 0 || defender.hp <= 0) return;
    if (!fightersCanDamage(attacker, defender)) return;
    const auraSwing = isBulwarkAuraSwing(attacker);
    const hit = auraSwing
      ? auraHit(attacker, defender)
      : sectorHit(attacker, defender);
    if (!hit) return;
    const swingKey = attacker.playerNum + ":" + attacker.swingId;
    if (defender.lastHitSwingKey === swingKey) return;

    applyDamageTo(defender, attacker, meleeSwingDamageForTarget(attacker, defender.x, defender.y), {
      hitFlash: 0.18,
      swingKey: swingKey,
      knockFrom: attacker,
      knockMul: attacker.swingKnockMul * (auraSwing ? 0.075 : 0.092),
    });
  }

  function showOverlay() {
    let title;
    let col = "#e8ecf4";
    if (winner === "heroes") {
      title = "You win";
      col = "#7ee787";
    } else if (winner === "bot") {
      const boss = players.find((pl) => pl.isBot);
      const bdef = getBossDef(boss && boss.bossId ? boss.bossId : "colossus");
      title = bdef.name + " wins";
      col = bdef.color;
    } else if (winner === "horde_defeat") {
      const n = hordeState.wave;
      title =
        n <= 0
          ? "Defeated"
          : "Defeated — survived " + n + " wave" + (n === 1 ? "" : "s");
      col = "#e85d4c";
    } else if (typeof winner === "string" && TEAM_LABELS[winner]) {
      title = "Team " + TEAM_LABELS[winner] + " wins";
      col = TEAM_COLORS[winner] || col;
    } else if (typeof winner === "number") {
      title = "Player " + winner + " wins";
      const wp = players.find((pl) => pl.playerNum === winner);
      col = wp ? wp.color : col;
    } else {
      title = "Draw";
      col = "#8b95a8";
    }
    overlayInner.innerHTML =
      "<h2 style=\"color:" +
      col +
      "\">" +
      title +
      "</h2>" +
      "<p>Press <kbd>R</kbd> for a rematch.</p>" +
      "<p class=\"accent\"><kbd>M</kbd> — back to character select · <kbd>Esc</kbd> — main menu</p>";
    overlay.classList.add("visible");
  }

  function drawMapFeatures() {
    const walls = mapRuntime.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      ctx.save();
      ctx.fillStyle = "rgba(38, 48, 68, 0.98)";
      ctx.fillRect(w.minX, w.minY, w.maxX - w.minX, w.maxY - w.minY);
      ctx.strokeStyle = "rgba(130, 155, 200, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(w.minX, w.minY, w.maxX - w.minX, w.maxY - w.minY);
      ctx.restore();
    }

    const obs = mapRuntime.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(45, 58, 82, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 165, 210, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < mapRuntime.movers.length; i++) {
      const m = mapRuntime.movers[i];
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(
        m.x - m.r * 0.25,
        m.y - m.r * 0.25,
        m.r * 0.1,
        m.x,
        m.y,
        m.r
      );
      g.addColorStop(0, "rgba(200, 120, 90, 0.55)");
      g.addColorStop(1, "rgba(120, 70, 55, 0.9)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 160, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < mapRuntime.portals.length; i++) {
      const p = mapRuntime.portals[i];
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.006 + i * 1.7);
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(120, 220, 255, 0.75)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80, 180, 255, 0.22)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.strokeStyle = "rgba(120, 220, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawArenaDotGrid(minX, minY, maxX, maxY, step) {
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        const dx = x - (minX + maxX) * 0.5;
        const dy = y - (minY + maxY) * 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const fade = clamp(1 - dist / (step * 9), 0.15, 1);
        ctx.beginPath();
        ctx.arc(x, y, 1.1 + fade * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(72, 108, 168, " + (0.12 + fade * 0.22) + ")";
        ctx.fill();
      }
    }
  }

  function drawArenaRim(cx, cy, radius, isRect, bounds) {
    ctx.save();
    if (isRect) {
      const b = bounds;
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      ctx.strokeStyle = "rgba(50, 90, 180, 0.18)";
      ctx.lineWidth = 10;
      ctx.strokeRect(b.minX, b.minY, w, h);
      ctx.strokeStyle = "rgba(130, 175, 255, 0.55)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(b.minX, b.minY, w, h);
      ctx.strokeStyle = "rgba(200, 225, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.minX + 2, b.minY + 2, w - 4, h - 4);
    } else {
      ctx.strokeStyle = "rgba(50, 90, 180, 0.2)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(130, 175, 255, 0.58)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(200, 225, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawArenaVignette(cx, cy, radius, isRect, bounds) {
    ctx.save();
    const vig = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.25,
      cx,
      cy,
      radius * 1.08
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(0.72, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.62)");
    ctx.fillStyle = vig;
    if (isRect) {
      const b = bounds;
      ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawArena() {
    const ac = arenaCenter();
    const R = arenaRadius();
    const map = currentMapDef();
    const t = performance.now() * 0.001;

    // Siege's world is panned/zoomed by a per-pane camera rather than the
    // fixed canvas-relative transform every other mode uses, so a fill sized
    // off W/H wouldn't track the camera — skip it; the opaque floor fill
    // below already covers the whole world regardless of camera position.
    if (gameMode !== "siege") {
      const s = playfieldScale();
      const ox = (W * (s - 1)) * 0.5;
      const oy = (H * (s - 1)) * 0.5;
      const skyGrad = ctx.createLinearGradient(0, -oy, 0, H + oy);
      skyGrad.addColorStop(0, "#0c101a");
      skyGrad.addColorStop(0.45, "#080b12");
      skyGrad.addColorStop(1, "#05070c");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-ox, -oy, W + ox * 2, H + oy * 2);
    }

    if (map.bounds === "rect") {
      const b = rectArenaBounds(0);
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const floorGrad = ctx.createLinearGradient(b.minX, b.minY, b.maxX, b.maxY);
      floorGrad.addColorStop(0, "#1e2a42");
      floorGrad.addColorStop(0.5, "#151f32");
      floorGrad.addColorStop(1, "#0f1524");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(b.minX, b.minY, w, h);
      const spot = ctx.createRadialGradient(
        ac.cx,
        ac.cy,
        0,
        ac.cx,
        ac.cy,
        Math.max(w, h) * 0.55
      );
      spot.addColorStop(0, "rgba(90, 140, 220, " + (0.14 + 0.03 * Math.sin(t * 0.7)) + ")");
      spot.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = spot;
      ctx.fillRect(b.minX, b.minY, w, h);
      drawArenaDotGrid(b.minX, b.minY, b.maxX, b.maxY, 40);
      drawArenaRim(ac.cx, ac.cy, R, true, b);
      drawArenaVignette(ac.cx, ac.cy, R, true, b);
    } else {
      const floorGrad = ctx.createRadialGradient(
        ac.cx,
        ac.cy,
        R * 0.05,
        ac.cx,
        ac.cy,
        R
      );
      floorGrad.addColorStop(0, "#1e2a42");
      floorGrad.addColorStop(0.55, "#151f32");
      floorGrad.addColorStop(1, "#0c111c");
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.arc(ac.cx, ac.cy, R, 0, Math.PI * 2);
      ctx.fill();
      const spot = ctx.createRadialGradient(
        ac.cx,
        ac.cy,
        0,
        ac.cx,
        ac.cy,
        R * 0.72
      );
      spot.addColorStop(0, "rgba(90, 140, 220, " + (0.16 + 0.04 * Math.sin(t * 0.7)) + ")");
      spot.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.arc(ac.cx, ac.cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ac.cx, ac.cy, R, 0, Math.PI * 2);
      ctx.clip();
      for (let ring = 1; ring <= 5; ring++) {
        ctx.beginPath();
        ctx.arc(ac.cx, ac.cy, (R * ring) / 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(55, 85, 140, " + (0.06 + ring * 0.02) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const spokes = 16;
      for (let i = 0; i < spokes; i++) {
        const a = (Math.PI * 2 * i) / spokes;
        ctx.beginPath();
        ctx.moveTo(ac.cx, ac.cy);
        ctx.lineTo(ac.cx + Math.cos(a) * R, ac.cy + Math.sin(a) * R);
        ctx.strokeStyle = "rgba(45, 70, 120, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      drawArenaDotGrid(ac.cx - R, ac.cy - R, ac.cx + R, ac.cy + R, 38);
      ctx.restore();
      drawArenaRim(ac.cx, ac.cy, R, false, null);
      drawArenaVignette(ac.cx, ac.cy, R, false, null);
    }

    if (gameMode !== "siege") {
      const outerVig = ctx.createRadialGradient(
        ac.cx,
        ac.cy,
        arenaRadius() * 0.5,
        ac.cx,
        ac.cy,
        Math.max(W, H) * 0.72 * playfieldScale()
      );
      outerVig.addColorStop(0, "rgba(0,0,0,0)");
      outerVig.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = outerVig;
      const vs = playfieldScale();
      const ox = (W * (vs - 1)) * 0.5;
      const oy = (H * (vs - 1)) * 0.5;
      ctx.fillRect(-ox, -oy, W + ox * 2, H + oy * 2);
    }

    drawMapFeatures();
  }

  function pushAnimFx(fx) {
    if (animFx.length >= ANIM_FX_CAP) animFx.shift();
    animFx.push(fx);
  }

  function spawnHitSparks(x, y, color, count) {
    const n = count != null ? count : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      pushAnimFx({
        kind: "spark",
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.18 + Math.random() * 0.22,
        maxLife: 0.4,
        r: 1.5 + Math.random() * 2.2,
        color: color || "#fff",
      });
    }
  }

  function spawnRingBurst(x, y, color, radius) {
    pushAnimFx({
      kind: "ring",
      x: x,
      y: y,
      life: 0.35,
      maxLife: 0.35,
      r: radius != null ? radius : 18,
      color: color || "#fff",
    });
  }

  function spawnPopBurst(x, y, color) {
    spawnRingBurst(x, y, color, 14);
    spawnHitSparks(x, y, color, 5);
  }

  function spawnDeathBurst(x, y, color) {
    spawnRingBurst(x, y, color, 28);
    spawnHitSparks(x, y, color, 12);
  }

  function updateAnimFx(dt) {
    for (let i = animFx.length - 1; i >= 0; i--) {
      const fx = animFx[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        animFx.splice(i, 1);
        continue;
      }
      if (fx.kind === "spark") {
        fx.x += fx.vx * dt;
        fx.y += fx.vy * dt;
        fx.vx *= 0.9;
        fx.vy *= 0.9;
      }
    }
  }

  function drawAnimFx() {
    for (let i = 0; i < animFx.length; i++) {
      const fx = animFx[i];
      const t = fx.maxLife > 0 ? clamp(fx.life / fx.maxLife, 0, 1) : 0;
      ctx.save();
      if (fx.kind === "spark") {
        ctx.globalAlpha = 0.25 + 0.75 * t;
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (0.55 + 0.45 * t), 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.kind === "ring") {
        const grow = 1 + (1 - t) * 1.8;
        ctx.globalAlpha = 0.55 * t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2 + 3 * t;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * grow, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function tickFighterAnim(p, dt) {
    if (!p || p.eliminated) return;
    p.animPhase = (p.animPhase || 0) + dt;
    const spd = len(p.vx || 0, p.vy || 0);
    if (spd > 28 && p.hp > 0 && (p.respawnT || 0) <= 0) {
      p.walkCycle = (p.walkCycle || 0) + dt * (2.6 + spd * 0.012);
    }
    let tx = 1;
    let ty = 1;
    if ((p.hitFlash || 0) > 0.08) {
      tx = 1.16;
      ty = 0.82;
    } else if (isDashing(p)) {
      tx = 1.28;
      ty = 0.72;
    } else if ((p.attackT || 0) > 0) {
      tx = 1.1;
      ty = 0.9;
    } else if ((p.chargeT || 0) > 0.12) {
      const pulse = 0.5 + 0.5 * Math.sin((p.animPhase || 0) * 10);
      tx = 1 + 0.06 * pulse;
      ty = 1 - 0.05 * pulse;
    } else if (spd > 40) {
      const step = Math.sin((p.walkCycle || 0) * Math.PI * 2);
      tx = 1 + step * 0.07;
      ty = 1 - step * 0.07;
    }
    const k = Math.min(1, dt * 14);
    let sx = (p.squashX != null ? p.squashX : 1) + (tx - (p.squashX || 1)) * k;
    let sy = (p.squashY != null ? p.squashY : 1) + (ty - (p.squashY || 1)) * k;
    if (!Number.isFinite(sx)) sx = 1;
    if (!Number.isFinite(sy)) sy = 1;
    p.squashX = clamp(sx, 0.55, 1.45);
    p.squashY = clamp(sy, 0.55, 1.45);
  }

  /** Pull fighters back if positions go invalid / off the drawable canvas. */
  function sanitizeFighterPose(p) {
    if (!p) return;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      const ac = arenaCenter();
      p.x = ac.cx;
      p.y = ac.cy;
      p.vx = 0;
      p.vy = 0;
      return;
    }
    const pad = getPlayerRadius(p) + 2;
    const clamped = clampPointToArena(p.x, p.y, pad);
    p.x = clamped.x;
    p.y = clamped.y;
    // Absolute canvas safety — circular arenas used to extend past the bitmap.
    p.x = clamp(p.x, pad, W - pad);
    p.y = clamp(p.y, pad, H - pad);
    if (!Number.isFinite(p.vx)) p.vx = 0;
    if (!Number.isFinite(p.vy)) p.vy = 0;
    if (!Number.isFinite(p.facing)) p.facing = 0;
    if (!Number.isFinite(p.squashX)) p.squashX = 1;
    if (!Number.isFinite(p.squashY)) p.squashY = 1;
  }

  function drawFighterShadow(p) {
    if (p.hp <= 0 && !isHordeHeroDowned(p)) return;
    if (p.eliminated) return;
    const pr = getPlayerRadius(p);
    ctx.save();
    ctx.translate(p.x + 2, p.y + 5);
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, pr * 0.95, pr * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fill();
    ctx.restore();
  }

  function drawProjectiles() {
    const now = performance.now();
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      const bounce = pr.kind === "bounce";
      const spread = pr.kind === "spread";
      const nova = pr.kind === "nova";
      const barrage = pr.kind === "barrage";
      const grapple = pr.kind === "grapple";
      const siphon = pr.kind === "siphon";
      const spin = now * 0.012 + i * 1.7;
      ctx.save();
      ctx.lineCap = "round";
      const trailW = bounce
        ? 5
        : barrage
          ? 2.4
          : grapple
            ? 6.5
            : siphon
              ? 3.5 + Math.min(5, (pr.r || 10) * 0.22)
              : spread || nova
                ? 3.5
                : 4;
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = trailW * 2.8;
      ctx.globalAlpha = nova
        ? 0.12 + 0.1 * (pr.angleMul != null ? pr.angleMul : 0.5)
        : 0.18;
      ctx.beginPath();
      ctx.moveTo(pr.px, pr.py);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = trailW;
      ctx.globalAlpha = nova
        ? 0.45 + 0.5 * (pr.angleMul != null ? pr.angleMul : 0.5)
        : bounce
          ? 0.95
          : 0.9;
      ctx.beginPath();
      ctx.moveTo(pr.px, pr.py);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
      const headR = pr.r * (bounce ? 0.65 : 0.55);
      const pulse = 1 + 0.12 * Math.sin(spin * 2);
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.y - pr.py, pr.x - pr.px) + (bounce ? spin : 0));
      ctx.beginPath();
      ctx.arc(0, 0, headR * 1.8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = pr.color;
      ctx.globalAlpha = nova
        ? 0.1 + 0.12 * (pr.angleMul != null ? pr.angleMul : 0.5)
        : 0.14;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, headR * pulse, 0, Math.PI * 2);
      ctx.fillStyle = pr.color;
      ctx.globalAlpha = nova
        ? 0.35 + 0.45 * (pr.angleMul != null ? pr.angleMul : 0.5)
        : bounce
          ? 0.7
          : 0.55;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(-headR * 0.2, -headR * 0.2, headR * 0.35, 0, Math.PI * 2);
      ctx.fill();
      if (bounce) {
        const bi = pr.wallBounceIdx || 0;
        ctx.strokeStyle = bi > 0 ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5 + Math.min(bi, 6) * 0.35;
        ctx.globalAlpha = 0.4 + Math.min(bi, 8) * 0.06;
        ctx.beginPath();
        ctx.arc(0, 0, headR * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawLaserBeam(p) {
    if (!isLaser(p) || !p.beamActive || p.hp <= 0) return;
    if (p.beamX0 == null) return;
    const charging = !p.beamFiring;
    const wind = laserWindupProgress(p);
    const hitting = p.beamHitAny;
    const ramp = p.beamMaxDwellMul != null ? p.beamMaxDwellMul : 1;
    const rampT = clamp((ramp - 1) / (LASER_DWELL_MAX_MUL - 1), 0, 1);
    const outerW = LASER_BEAM_HALF_WIDTH * 1.15;
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.018);
    ctx.save();
    ctx.lineCap = "round";
    if (charging) {
      ctx.strokeStyle = "rgba(244, 114, 182, 0.45)";
      ctx.lineWidth = 6 + wind * 5;
      ctx.globalAlpha = 0.18 + wind * 0.28;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(p.beamX0, p.beamY0);
      ctx.lineTo(p.beamX1, p.beamY1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 + wind * 2;
      ctx.globalAlpha = 0.35 + wind * 0.35 * pulse;
      ctx.beginPath();
      ctx.moveTo(p.beamX0, p.beamY0);
      ctx.lineTo(p.beamX1, p.beamY1);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = hitting ? p.color : "rgba(244, 114, 182, 0.35)";
    ctx.lineWidth = outerW;
    ctx.globalAlpha = hitting ? 0.18 + rampT * 0.14 : 0.12;
    ctx.beginPath();
    ctx.moveTo(p.beamX0, p.beamY0);
    ctx.lineTo(p.beamX1, p.beamY1);
    ctx.stroke();
    ctx.strokeStyle = hitting ? p.color : "rgba(244, 114, 182, 0.55)";
    ctx.lineWidth = hitting ? 10 + rampT * 6 : 8;
    ctx.globalAlpha = hitting ? 0.45 + rampT * 0.28 : 0.32;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = hitting ? 3 + rampT * 3 : 3;
    ctx.globalAlpha = hitting ? 0.55 + rampT * 0.3 : 0.35;
    ctx.stroke();
    ctx.restore();
  }

  function drawAttackArc(p) {
    if (p.hp <= 0 || p.attackT <= 0) return;
    if (p.attackStyle === "bounce") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(getPlayerRadius(p), 0);
      ctx.lineTo(RICOCHET_MAX_DIST * 0.42, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "lance") {
      const t = clamp(p.attackT / LANCE_ATTACK_ACTIVE, 0, 1);
      const ratio = p.lastSwingChargeRatio;
      const range = attackSectorRange(p, ratio);
      const ang = lanceAimFacing(p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const x0 = PLAYER_R * 0.3;
      const halfW0 = lanceHalfWidthAt(x0, range);
      const halfW1 = lanceHalfWidthAt(range, range);
      ctx.beginPath();
      ctx.moveTo(x0, -halfW0);
      ctx.lineTo(range, -halfW1);
      ctx.lineTo(range, halfW1);
      ctx.lineTo(x0, halfW0);
      ctx.closePath();
      ctx.globalAlpha = 0.28 + 0.4 * t;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + 2 * ratio;
      ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.35 * t;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "ranged") {
      const range = rangedDistForPlayer(p, p.lastSwingChargeRatio);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(PLAYER_R, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (isPhoenix(p) && isDashing(p)) {
      drawPhoenixBurst(p);
      return;
    }
    if (p.attackStyle === "dash" && isDashing(p)) {
      const t =
        p.dashTotalT > 1e-6 ? 1 - p.dashT / p.dashTotalT : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.dashDirY, p.dashDirX));
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.35 + 0.5 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(-PLAYER_R * 0.5, 0);
      ctx.lineTo(PLAYER_R + 18, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PLAYER_R * 0.6, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "aura" || p.bulwarkAuraUlt) {
      const ratio = p.lastSwingChargeRatio;
      const radius = auraRadiusForPlayer(p, ratio);
      const auraDur =
        p.lastSwingChargeRatio > 0
          ? bulwarkAuraActiveTime(p.lastSwingChargeRatio)
          : AURA_ATTACK_ACTIVE;
      const t = p.attackT / auraDur;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.globalAlpha = 0.2 + 0.45 * t;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 + 2 * (1 - t);
      ctx.globalAlpha = 0.5 + 0.4 * t;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "barrage") {
      const dur =
        (p.barrage && p.barrage.duration) || BULWARK_BARRAGE_DURATION;
      const t = clamp(p.attackT / Math.max(0.05, dur), 0, 1);
      const ratio = Math.max(0.15, p.lastSwingChargeRatio || 0);
      const range = BULWARK_BARRAGE_MAX_DIST * (0.55 + 0.35 * Math.min(1, ratio));
      const cone = BULWARK_BARRAGE_CONE * 0.5;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, range, -cone, cone);
      ctx.closePath();
      ctx.globalAlpha = 0.16 + 0.28 * t;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 0.55 + 0.25 * t;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "spread") {
      const t = clamp(p.attackT / 0.1, 0, 1);
      const ratio = p.lastSwingChargeRatio;
      const range = ATTACK_RANGE * meleeRangeScale(p, ratio);
      const arc = ATTACK_ARC * meleeArcScale(p, ratio);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, range, -arc * 0.5, arc * 0.5);
      ctx.closePath();
      ctx.globalAlpha = 0.22 + 0.32 * t;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + 1.5 * p.lastSwingChargeRatio;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    if (p.attackStyle === "nova") {
      const t = clamp(p.attackT / 0.1, 0, 1);
      const ratio = p.lastSwingChargeRatio;
      const range = novaDistForPlayer(p, ratio) * (0.35 + 0.65 * t);
      const step = (Math.PI * 2) / NOVA_PELLET_COUNT;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      for (let i = 0; i < NOVA_PELLET_COUNT; i++) {
        const mul = novaPelletAngleMul(i);
        const ang = i * step;
        ctx.globalAlpha = (0.12 + 0.38 * t) * mul;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5 + 2 * mul * ratio;
        ctx.beginPath();
        ctx.moveTo(PLAYER_R * 0.4, 0);
        ctx.lineTo(range * Math.cos(ang), range * Math.sin(ang));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R * 0.85, 0, Math.PI * 2);
      ctx.globalAlpha = 0.2 + 0.35 * t;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
      return;
    }
    const t = p.attackT / ATTACK_ACTIVE;
    const ratio = p.lastSwingChargeRatio;
    const range = ATTACK_RANGE * meleeRangeScale(p, ratio);
    const arc = ATTACK_ARC * meleeArcScale(p, ratio);
    const sweep = (1 - t) * arc;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -arc * 0.5, -arc * 0.5 + sweep);
    ctx.closePath();
    ctx.globalAlpha = 0.2 + 0.4 * t;
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -arc * 0.5, arc * 0.5);
    ctx.closePath();
    ctx.globalAlpha = 0.18 + 0.22 * t;
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2 + 2 * p.lastSwingChargeRatio;
    ctx.stroke();
    // Leading edge gleam
    const edge = -arc * 0.5 + sweep;
    ctx.globalAlpha = 0.55 + 0.35 * t;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(edge) * range, Math.sin(edge) * range);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawChargeArc(p) {
    const atk = p.controls && p.controls.attack;
    const keyHeld = atk ? keys[atk] : false;
    const attackHeld =
      p.isBot || p.isAi ? p.chargeT > 0 : keyHeld;
    const canShow =
      p.hp > 0 &&
      attackHeld &&
      !gameOver &&
      p.cooldown <= 0 &&
      p.attackT <= 0 &&
      !p.needsRelease &&
      !p.botMustRelease &&
      canPlayerUseAttacks(p) &&
      p.chargeT > 0;
    if (!canShow) return;
    const ratio = chargeRatioFor(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);

    if (p.attackStyle === "ranged") {
      const range = rangedDistForPlayer(p, ratio);
      const siphon = isSiphon(p);
      ctx.globalAlpha = 0.2 + 0.45 * ratio;
      ctx.strokeStyle = siphon ? "#fda4af" : p.color;
      ctx.lineWidth = (siphon ? 2.5 + 2.5 * ratio : 2) + 2 * ratio;
      ctx.setLineDash(siphon ? [8, 6] : [6, 8]);
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.5, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "bounce") {
      const tune = ricochetMapTuning();
      const range = RICOCHET_MAX_DIST * (0.88 + 0.12 * ratio) * tune.rangeMul;
      ctx.globalAlpha = 0.2 + 0.45 * ratio;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + 2 * ratio;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.5, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "lance") {
      const range = attackSectorRange(p, ratio);
      const x0 = PLAYER_R * 0.3;
      const halfW0 = lanceHalfWidthAt(x0, range);
      const halfW1 = lanceHalfWidthAt(range, range);
      ctx.globalAlpha = 0.16 + 0.38 * ratio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(x0, -halfW0);
      ctx.lineTo(range, -halfW1);
      ctx.lineTo(range, halfW1);
      ctx.lineTo(x0, halfW0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5 + ratio * 1.5;
      ctx.setLineDash([4, 6]);
      ctx.globalAlpha = 0.4 + 0.4 * ratio;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(range, 0);
      ctx.moveTo(x0, -halfW0);
      ctx.lineTo(range, -halfW1);
      ctx.moveTo(x0, halfW0);
      ctx.lineTo(range, halfW1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "spread") {
      const range = spreadDistForPlayer(p, ratio);
      const half = SPREAD_CONE_HALF_ANGLE;
      ctx.globalAlpha = 0.18 + 0.4 * ratio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.45, 0);
      ctx.arc(0, 0, range, -half, half);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5 + ratio;
      ctx.setLineDash([5, 7]);
      ctx.globalAlpha = 0.35 + 0.35 * ratio;
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.45, 0);
      ctx.lineTo(range * Math.cos(-half), range * Math.sin(-half));
      ctx.moveTo(PLAYER_R * 0.45, 0);
      ctx.lineTo(range, 0);
      ctx.moveTo(PLAYER_R * 0.45, 0);
      ctx.lineTo(range * Math.cos(half), range * Math.sin(half));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "barrage" && isBulwarkUnbreakable(p)) {
      const radius = auraRadiusForPlayer(p, ratio);
      const vis = Math.min(ratio, 6);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.globalAlpha = 0.12 + 0.12 * vis;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + Math.min(vis, 4);
      ctx.setLineDash([5, 6]);
      ctx.globalAlpha = 0.28 + 0.1 * vis;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "barrage") {
      const range =
        BULWARK_BARRAGE_MAX_DIST * (0.62 + 0.38 * Math.min(1.2, ratio));
      const half = BULWARK_BARRAGE_CONE * 0.5;
      ctx.globalAlpha = 0.14 + 0.32 * Math.min(1.2, ratio);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.4, 0);
      ctx.arc(0, 0, range, -half, half);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.4 + Math.min(1.2, ratio);
      ctx.setLineDash([4, 6]);
      ctx.globalAlpha = 0.3 + 0.35 * Math.min(1.2, ratio);
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.4, 0);
      ctx.lineTo(range * Math.cos(-half), range * Math.sin(-half));
      ctx.moveTo(PLAYER_R * 0.4, 0);
      ctx.lineTo(range, 0);
      ctx.moveTo(PLAYER_R * 0.4, 0);
      ctx.lineTo(range * Math.cos(half), range * Math.sin(half));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "nova") {
      const range = novaDistForPlayer(p, ratio);
      const step = (Math.PI * 2) / NOVA_PELLET_COUNT;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2 + 1.4 * ratio;
      ctx.setLineDash([4, 6]);
      for (let i = 0; i < NOVA_PELLET_COUNT; i++) {
        const mul = novaPelletAngleMul(i);
        const ang = i * step;
        ctx.globalAlpha = (0.2 + 0.45 * ratio) * mul;
        ctx.beginPath();
        ctx.moveTo(PLAYER_R * 0.45, 0);
        ctx.lineTo(range * Math.cos(ang), range * Math.sin(ang));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (isPhoenix(p)) {
      const hop = dashDistForPlayer(p, ratio);
      const shotR = PHOENIX_SHOT_RANGE * (0.65 + 0.35 * ratio);
      const forward = phoenixUltAttackActive(p);
      const spread = forward ? PHOENIX_SHOT_SPREAD_ULT : PHOENIX_SHOT_SPREAD;
      ctx.globalAlpha = 0.3 + 0.4 * ratio;
      ctx.strokeStyle = forward ? "#fbbf24" : "#fdba74";
      ctx.lineWidth = 2 + ratio;
      ctx.beginPath();
      ctx.arc(PLAYER_R * 0.35, 0, 10 + 4 * ratio, -0.55, 0.55);
      ctx.stroke();
      ctx.setLineDash([3, 5]);
      for (let si = 0; si < 2; si++) {
        const off = si === 0 ? -spread : spread;
        const dir = forward ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dir * shotR * Math.cos(off), shotR * Math.sin(off));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.35 + 0.35 * ratio;
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.25, 0);
      ctx.lineTo(hop, 0);
      ctx.stroke();
      const dotR = 3 + ratio;
      ctx.beginPath();
      ctx.arc(hop, 0, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#fb923c";
      ctx.globalAlpha = 0.5 + 0.35 * ratio;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "dash") {
      const range = dashDistForPlayer(p, ratio);
      ctx.globalAlpha = 0.22 + 0.42 * ratio;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + 2 * ratio;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(PLAYER_R * 0.5, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      const dotR = 6 + 2 * ratio;
      ctx.beginPath();
      ctx.arc(range, 0, dotR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + 0.35 * ratio;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(range, 0, dotR, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.5 + 0.4 * ratio;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (p.attackStyle === "aura" || (p.attackStyle === "barrage" && isBulwarkUnbreakable(p))) {
      const radius = auraRadiusForPlayer(p, ratio);
      const vis = Math.min(ratio, 6);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.globalAlpha = 0.12 + 0.12 * vis;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + Math.min(vis, 4);
      ctx.setLineDash([5, 6]);
      ctx.globalAlpha = 0.28 + 0.1 * vis;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (p.attackStyle === "barrage") {
      const vis = Math.max(0.12, Math.min(ratio, 1.4));
      const range = BULWARK_BARRAGE_MAX_DIST * (0.55 + 0.4 * Math.min(1, vis));
      const cone = BULWARK_BARRAGE_CONE * 0.5 * (0.85 + 0.2 * Math.min(1, vis));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, range, -cone, cone);
      ctx.closePath();
      ctx.globalAlpha = 0.1 + 0.16 * vis;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 0.3 + 0.25 * vis;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    const previewRatio = Math.max(0.12, ratio);
    const range = ATTACK_RANGE * meleeRangeScale(p, previewRatio);
    const arc = ATTACK_ARC * meleeArcScale(p, Math.max(0.12, ratio));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -arc * 0.5, arc * 0.5);
    ctx.closePath();
    ctx.globalAlpha = 0.12 + 0.22 * ratio;
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.35 * ratio;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPhoenixBurst(p) {
    if (!isPhoenix(p) || !isDashing(p) || p.hp <= 0) return;
    const t = p.dashTotalT > 1e-6 ? 1 - p.dashT / p.dashTotalT : 1;
    const pr = getPlayerRadius(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.4 + 0.45 * (1 - t);
    ctx.strokeStyle = "#fdba74";
    ctx.lineWidth = 2.5;
    for (let wi = 0; wi < 2; wi++) {
      const side = wi === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(pr * 0.15, side * 5);
      ctx.quadraticCurveTo(pr * 0.75, side * 16, pr + 10 + t * 6, side * 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#fb923c";
    for (let i = 0; i < 5; i++) {
      const fx = pr * 0.35 + i * 4 + t * 6;
      const fy = (i - 2) * 3.5;
      ctx.globalAlpha = 0.35 + 0.4 * (1 - t);
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    const hopEnd = p.dashDist > 0 ? p.dashDist : len(p.dashEndX - p.x, p.dashEndY - p.y);
    const dotPulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.018);
    ctx.globalAlpha = 0.5 + 0.4 * (1 - t);
    ctx.beginPath();
    ctx.arc(hopEnd, 0, 4 * dotPulse, 0, Math.PI * 2);
    ctx.fillStyle = "#fb923c";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawDashMarker(p) {
    if (isPhoenix(p) || !isDashing(p) || p.hp <= 0) return;
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.014);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.dashEndX, p.dashEndY, DASH_PERFECT_RADIUS * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p.dashEndX, p.dashEndY, 7, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawDashTrail(p) {
    if (isPhoenix(p) || !isDashing(p) || p.hp <= 0) return;
    const t = p.dashTotalT > 1e-6 ? 1 - p.dashT / p.dashTotalT : 0;
    const tail = 28 + 40 * t;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dashDirY, p.dashDirX));
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 + 4 * (1 - t);
    ctx.globalAlpha = 0.25 + 0.45 * (1 - t);
    ctx.beginPath();
    ctx.moveTo(-tail, 0);
    ctx.lineTo(PLAYER_R * 0.3, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawWaveEnemies() {
    const list = mapRuntime.waveEnemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hp <= 0) continue;
      const flash = (e.hitFlash || 0) > 0;
      const phase = performance.now() * 0.014 + e.id * 1.3;
      const pulse = 0.92 + 0.08 * Math.sin(phase);
      const bob = Math.sin(phase * 1.2) * 2.2;
      const stretch = 1 + Math.sin(phase * 2.1) * 0.07;
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.scale(stretch, 1 / stretch);
      if ((e.windupT || 0) > 0) {
        const w = e.windupT / 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 10 + 8 * (1 - w), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 200, 120, " + (0.35 + 0.45 * w) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if ((e.slamBlastT || 0) > 0) {
        const t = e.slamBlastT / 0.32;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 38 * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(180, 120, 255, " + (0.5 * (1 - t)) + ")";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (e.chargeT > 0) {
        ctx.rotate(e.facing || 0);
        ctx.fillStyle = "rgba(255, 180, 80, 0.35)";
        ctx.beginPath();
        ctx.moveTo(e.r * 0.5, 0);
        ctx.lineTo(-e.r, e.r * 0.55);
        ctx.lineTo(-e.r, -e.r * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(-(e.facing || 0));
      }
      ctx.beginPath();
      ctx.arc(0, 0, e.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "rgba(255, 220, 200, 0.95)" : e.color;
      ctx.globalAlpha = flash ? 1 : 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(12, 16, 28, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (e.attack === "spit") {
        ctx.fillStyle = "rgba(90, 200, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(e.r * 0.45, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const hpT = e.maxHp > 0 ? e.hp / e.maxHp : 0;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(-e.r, -e.r - 7, e.r * 2, 4);
      ctx.fillStyle = "rgba(255, 120, 90, 0.9)";
      ctx.fillRect(-e.r, -e.r - 7, e.r * 2 * clamp(hpT, 0, 1), 4);
      ctx.restore();
    }
  }

  function drawHostileShots() {
    const list = mapRuntime.hostileShots;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(90, 210, 255, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(20, 60, 90, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHordeSupportLinks() {
    if (gameMode !== "horde") return;
    for (let i = 0; i < players.length; i++) {
      const healer = players[i];
      if (!isHordeHeroActive(healer) || !healer.supportTargetNum) continue;
      const target = players.find(
        (pl) => pl.playerNum === healer.supportTargetNum
      );
      if (!target || !hordeSupportRange(healer, target)) continue;
      const ch = healer.supportChannelT || 0;
      const rev = isHordeHeroDowned(target);
      const prog = rev ? clamp(ch / HORDE_REVIVE_TIME, 0, 1) : 0.5;
      ctx.save();
      ctx.strokeStyle = rev
        ? "rgba(126, 231, 135, " + (0.35 + 0.45 * prog) + ")"
        : "rgba(90, 200, 255, 0.45)";
      ctx.lineWidth = rev ? 2 + 2 * prog : 2;
      ctx.setLineDash(rev ? [5, 5] : []);
      ctx.beginPath();
      ctx.moveTo(healer.x, healer.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawHordeHud() {
    if (gameMode !== "horde") return;
    ctx.save();
    ctx.font = "600 13px JetBrains Mono, SF Mono, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(230, 236, 244, 0.95)";
    let label;
    if (hordeState.phase === "intermission" && hordeState.wave === 0) {
      label = "Wave 1 incoming… " + Math.max(1, Math.ceil(hordeState.intermissionT));
    } else if (hordeState.phase === "intermission") {
      const nextWave = hordeState.wave + 1;
      if (hordeIsBossWaveNumber(nextWave)) {
        label =
          "Boss wave " +
          nextWave +
          " incoming… " +
          Math.max(1, Math.ceil(hordeState.intermissionT));
      } else {
        label =
          "Wave " +
          nextWave +
          " in " +
          Math.max(1, Math.ceil(hordeState.intermissionT));
      }
    } else if (hordeBossWaveActive()) {
      const boss = getHordeBossPlayer();
      const bdef = getBossDef(
        (boss && boss.bossId) || hordeState.bossWaveId || "colossus"
      );
      label = "Wave " + hordeState.wave + " — " + bdef.name;
    } else {
      const alive = hordeThreatsAlive();
      label = "Wave " + hordeState.wave + " — " + alive + " enemies";
    }
    ctx.fillText(label, W * 0.5, 26);
    ctx.restore();
  }

  function drawCreatures() {
    const list = mapRuntime.creatures;
    const now = performance.now();
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.hp <= 0) continue;
      const flash = (c.hitFlash || 0) > 0;
      const phase = now * 0.01 + c.id * 1.7;
      const hop = Math.abs(Math.sin(phase * 1.4)) * 3.2;
      const squash = 1 + Math.sin(phase * 1.4) * 0.12;
      const pulse = 0.92 + 0.08 * Math.sin(phase);
      ctx.save();
      ctx.translate(c.x, c.y - hop);
      ctx.scale(1 / squash, squash);
      ctx.rotate(Math.sin(phase) * 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, c.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = flash
        ? "rgba(210, 255, 175, 0.95)"
        : "rgba(88, 168, 82, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(36, 62, 32, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(14, 24, 12, 0.92)";
      ctx.beginPath();
      ctx.arc(-c.r * 0.27, -c.r * 0.17, c.r * 0.18, 0, Math.PI * 2);
      ctx.arc(c.r * 0.27, -c.r * 0.17, c.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayerOverheadHp(p) {
    if (!showOverheadHpBars) return;
    if (p.eliminated) return;
    if (p.hp <= 0 && !isHordeHeroDowned(p)) return;
    const pr = getPlayerRadius(p);
    let pct;
    let fill;
    if (isHordeHeroDowned(p)) {
      pct =
        HORDE_DOWN_BLEED > 0
          ? clamp((p.downBleedT || 0) / HORDE_DOWN_BLEED, 0, 1)
          : 0;
      fill = "#7ee787";
    } else {
      pct = p.maxHp > 0 ? clamp(p.hp / p.maxHp, 0, 1) : 0;
      fill = pct > 0.5 ? "#7ee787" : pct > 0.25 ? "#e6c35c" : "#f07178";
    }
    const barW = Math.max(26, pr * 2.2);
    const barH = 4;
    const x = -barW * 0.5;
    const y = -pr - 8;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(6, 10, 18, 0.78)";
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, barW + 2, barH + 2, 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, barW * pct, barH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, barH + 1);
    ctx.restore();
  }

  /** Each name-tag segment gets its own color instead of one flat color
   *  for the whole label — team letter, AI/Human, and AI difficulty all
   *  read at a glance instead of blending into the character-tint text. */
  function playerBadgeParts(p) {
    const parts = [];
    if (showNameTagPlayerNum) {
      parts.push({ text: "P" + p.playerNum, color: NAME_TAG_PLAYER_NUM_COLOR });
    }
    if (showNameTagCharName) {
      parts.push({ text: playerCharName(p), color: p.color });
    }
    if (showNameTagTeam) {
      const team = playerTeamTag(p);
      if (team) {
        parts.push({
          text: "Team " + team,
          color: TEAM_COLORS[p.fightTeam] || p.color,
        });
      }
    }
    if (showNameTagHumanAi) {
      parts.push({
        text: p.isAi ? "AI" : "Human",
        color: p.isAi ? NAME_TAG_AI_COLOR : NAME_TAG_HUMAN_COLOR,
      });
    }
    if (showNameTagAiDifficulty && p.isAi) {
      const diffId = normalizeAiDifficulty(p.aiDifficulty);
      parts.push({
        text: AI_DIFFICULTY_LABELS[diffId] || "Normal",
        color: NAME_TAG_AI_DIFFICULTY_COLORS[diffId] || NAME_TAG_AI_COLOR,
      });
    }
    return parts;
  }

  function drawPlayerBadge(p) {
    if (!showNameTags) return;
    if (p.isBot || p.eliminated) return;
    if (p.hp <= 0 && !isHordeHeroDowned(p)) return;
    const parts = playerBadgeParts(p);
    if (!parts.length) return;
    const pr = getPlayerRadius(p);
    let badgeY = -pr - 8;
    if (showOverheadHpBars) badgeY -= 12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.font = "600 10px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const sep = " · ";
    const sepW = ctx.measureText(sep).width;
    const widths = parts.map((part) => ctx.measureText(part.text).width);
    let tw = 0;
    for (let i = 0; i < parts.length; i++) {
      tw += widths[i];
      if (i < parts.length - 1) tw += sepW;
    }
    const padX = 8;
    const padY = 4;
    const bx = -tw * 0.5 - padX;
    const by = badgeY - 14;
    const bw = tw + padX * 2;
    const bh = 16;
    ctx.fillStyle = "rgba(6, 10, 18, 0.82)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(bx, by, bw, bh, 5);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + bh);
    ctx.lineTo(bx + bw - 4, by + bh);
    ctx.stroke();
    ctx.globalAlpha = 1;
    let cx = -tw * 0.5;
    for (let i = 0; i < parts.length; i++) {
      ctx.fillStyle = parts[i].color;
      ctx.fillText(parts[i].text, cx, badgeY);
      cx += widths[i];
      if (i < parts.length - 1) {
        ctx.fillStyle = NAME_TAG_SEPARATOR_COLOR;
        ctx.fillText(sep, cx, badgeY);
        cx += sepW;
      }
    }
    ctx.restore();
  }

  function drawRespawnCountdown(p) {
    const t =
      RESPAWN_DELAY > 0 ? clamp((p.respawnT || 0) / RESPAWN_DELAY, 0, 1) : 0;
    const pr = getPlayerRadius(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    // Corpse / ghost so multi-KOs don't look like everyone vanished.
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12, 14, 22, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, pr + 8, -Math.PI / 2, -Math.PI / 2 + (1 - t) * Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function fighterBodyFill(p, pr, flash) {
    if (flash) return "#ffffff";
    if (!showCharacterShine) return p.color;
    const g = ctx.createRadialGradient(
      -pr * 0.35,
      -pr * 0.35,
      pr * 0.05,
      0,
      0,
      pr * 1.05
    );
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.42, p.color);
    g.addColorStop(1, "rgba(0,0,0,0.38)");
    return g;
  }

  function strokeFighterOutline(heavy) {
    ctx.strokeStyle = showCharacterShine
      ? "rgba(255,255,255,0.5)"
      : "rgba(255,255,255,0.35)";
    ctx.lineWidth = heavy ? 3 : 2;
    ctx.stroke();
  }

  function pathPolygon(points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
  }

  function pathRoundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawFighterShineSpeck(pr, flash) {
    if (!showCharacterShine) return;
    ctx.beginPath();
    ctx.arc(-pr * 0.28, -pr * 0.32, pr * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255," + (flash ? 0.55 : 0.22) + ")";
    ctx.fill();
  }

  function drawFighterBody(p, pr, flash) {
    const fill = fighterBodyFill(p, pr, flash);
    const id = p.isBot ? "boss" : p.characterId || "brawler";
    ctx.fillStyle = fill;

    if (!showUniqueShapes && id !== "boss") {
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      drawFighterShineSpeck(pr * 0.85, flash);
      return;
    }

    if (id === "brawler") {
      // Stocky rounded square — heavyweight brawler.
      pathRoundedRect(-pr * 0.92, -pr * 0.92, pr * 1.84, pr * 1.84, pr * 0.32);
      ctx.fill();
      strokeFighterOutline(true);
      ctx.beginPath();
      ctx.moveTo(-pr * 0.45, pr * 0.35);
      ctx.quadraticCurveTo(0, pr * 0.62, pr * 0.45, pr * 0.35);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Knuckle studs
      for (const sy of [-0.55, 0.55]) {
        ctx.beginPath();
        ctx.arc(pr * 0.55, pr * sy, pr * 0.14, 0, Math.PI * 2);
        ctx.fillStyle = flash ? "#fff" : "rgba(0,0,0,0.28)";
        ctx.fill();
      }
    } else if (id === "marksman") {
      // Slim elongated body + scope visor.
      ctx.save();
      ctx.scale(1.18, 0.72);
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.restore();
      pathRoundedRect(pr * 0.15, -pr * 0.38, pr * 0.85, pr * 0.76, pr * 0.12);
      ctx.fillStyle = flash ? "#ffffff" : "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pr * 0.78, 0, pr * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#fff" : "rgba(255,255,255,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (id === "striker") {
      // Forward kite / blade silhouette.
      pathPolygon([
        [pr * 1.15, 0],
        [pr * 0.1, pr * 0.78],
        [-pr * 0.95, pr * 0.28],
        [-pr * 0.55, 0],
        [-pr * 0.95, -pr * 0.28],
        [pr * 0.1, -pr * 0.78],
      ]);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.moveTo(pr * 0.35, 0);
      ctx.lineTo(-pr * 0.35, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (id === "bulwark") {
      // Thick octagon plate armor.
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 8) + (i * Math.PI) / 4;
        pts.push([Math.cos(a) * pr * 1.05, Math.sin(a) * pr * 1.05]);
      }
      pathPolygon(pts);
      ctx.fill();
      strokeFighterOutline(true);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-pr * 0.35, -pr * 0.15);
      ctx.lineTo(pr * 0.35, -pr * 0.15);
      ctx.moveTo(0, -pr * 0.35);
      ctx.lineTo(0, pr * 0.35);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (id === "ricochet") {
      // Crystal hexagon with inner facet.
      const outer = [];
      const inner = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        outer.push([Math.cos(a) * pr * 1.08, Math.sin(a) * pr * 1.08]);
        inner.push([Math.cos(a) * pr * 0.48, Math.sin(a) * pr * 0.48]);
      }
      pathPolygon(outer);
      ctx.fill();
      strokeFighterOutline(false);
      pathPolygon(inner);
      ctx.fillStyle = flash ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (id === "laser") {
      // Round core + forward emitter lens.
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.92, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      pathPolygon([
        [pr * 0.35, -pr * 0.42],
        [pr * 1.2, 0],
        [pr * 0.35, pr * 0.42],
      ]);
      ctx.fillStyle = flash ? "#ffffff" : "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pr * 0.55, 0, pr * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "#fff" : "rgba(255,180,220,0.85)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (id === "scatter") {
      // Chunky body with sawtooth barrel front.
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.88, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      pathPolygon([
        [pr * 0.2, -pr * 0.7],
        [pr * 1.15, -pr * 0.45],
        [pr * 0.55, -pr * 0.15],
        [pr * 1.2, 0],
        [pr * 0.55, pr * 0.15],
        [pr * 1.15, pr * 0.45],
        [pr * 0.2, pr * 0.7],
      ]);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (id === "nova") {
      // Soft 6-point star / burst.
      const star = [];
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6 - Math.PI / 2;
        const rad = i % 2 === 0 ? pr * 1.12 : pr * 0.58;
        star.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      pathPolygon(star);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.28)";
      ctx.fill();
    } else if (id === "phoenix") {
      // Flame teardrop with rear crest.
      pathPolygon([
        [pr * 1.05, 0],
        [pr * 0.35, pr * 0.72],
        [-pr * 0.35, pr * 0.55],
        [-pr * 1.05, pr * 0.15],
        [-pr * 0.55, 0],
        [-pr * 1.05, -pr * 0.15],
        [-pr * 0.35, -pr * 0.55],
        [pr * 0.35, -pr * 0.72],
      ]);
      ctx.fill();
      strokeFighterOutline(false);
      // Inner flame tongue
      pathPolygon([
        [pr * 0.55, 0],
        [-pr * 0.1, pr * 0.28],
        [-pr * 0.45, 0],
        [-pr * 0.1, -pr * 0.28],
      ]);
      ctx.fillStyle = flash ? "rgba(255,255,255,0.65)" : "rgba(255,220,120,0.55)";
      ctx.fill();
    } else if (id === "echo") {
      // Ghost twin offset behind + hollow core.
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(-pr * 0.35, pr * 0.2, pr * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (id === "pike") {
      // Elongated diamond / spearhead silhouette.
      pathPolygon([
        [pr * 1.15, 0],
        [pr * 0.25, pr * 0.72],
        [-pr * 0.85, pr * 0.35],
        [-pr * 0.55, 0],
        [-pr * 0.85, -pr * 0.35],
        [pr * 0.25, -pr * 0.72],
      ]);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.moveTo(-pr * 0.2, 0);
      ctx.lineTo(pr * 0.75, 0);
      ctx.strokeStyle = flash ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (id === "grappler") {
      // Rounded body with a hooked crescent silhouette.
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.92, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.arc(pr * 0.35, 0, pr * 0.55, -Math.PI * 0.65, Math.PI * 0.65);
      ctx.strokeStyle = flash ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pr * 0.72, pr * 0.28, pr * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = flash ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)";
      ctx.fill();
    } else if (id === "siphon") {
      // Spiral / vortex disc.
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.95, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.55, 0, Math.PI * 1.6);
      ctx.strokeStyle = flash ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pr * 0.15, 0);
      ctx.lineTo(pr * 0.85, -pr * 0.22);
      ctx.lineTo(pr * 0.85, pr * 0.22);
      ctx.closePath();
      ctx.fillStyle = flash ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)";
      ctx.fill();
    } else if (id === "boss") {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pts.push([Math.cos(a) * pr, Math.sin(a) * pr]);
      }
      pathPolygon(pts);
      ctx.fill();
      strokeFighterOutline(true);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fill();
      strokeFighterOutline(false);
    }

    drawFighterShineSpeck(pr * 0.85, flash);
  }

  function drawFighterHands(p, pr, flash) {
    if (!showFighterHands) return;
    if (p.isBot) return;
    const spd = len(p.vx || 0, p.vy || 0);
    const walk = (p.walkCycle || 0) * Math.PI * 2;
    const attacking = (p.attackT || 0) > 0;
    const charging =
      (p.chargeT || 0) > 0.08 && p.attackStyle !== "beam" && !p.beamActive;
    const beaming = !!(p.beamActive || (p.ultLaserT || 0) > 0);
    const dashing = isDashing(p);
    const handR = Math.max(4.2, pr * 0.26);
    const palm = flash ? "#ffffff" : p.color;
    const outline = showCharacterShine
      ? "rgba(255,255,255,0.45)"
      : "rgba(0,0,0,0.35)";
    const id = p.characterId || "brawler";
    const shoulderSpread =
      id === "bulwark" ? 0.62 : id === "striker" ? 0.48 : 0.55;

    const hands = { left: null, right: null };
    for (let h = 0; h < 2; h++) {
      const side = h === 0 ? -1 : 1;
      let fx = pr * 0.4;
      let fy = side * pr * 0.82;

      if (dashing) {
        fx = pr * -0.05;
        fy = side * pr * 0.72;
      } else if (beaming) {
        fx = pr * 0.92;
        fy = side * pr * 0.38;
      } else if (attacking) {
        const lead = side > 0 ? 1 : 0.55;
        fx = pr * (0.72 + lead * 0.42);
        fy = side * pr * (0.48 + (1 - lead) * 0.18);
      } else if (charging) {
        const pulse = 0.5 + 0.5 * Math.sin((p.animPhase || 0) * 11);
        fx = pr * (0.62 + pulse * 0.12);
        fy = side * pr * 0.58;
      } else if (spd > 28) {
        const swing = Math.sin(walk) * (side > 0 ? 1 : -1);
        fx = pr * (0.32 + swing * 0.3);
        fy = side * pr * (0.8 - Math.abs(swing) * 0.1);
      }

      // Two-handed guns pull hands onto the weapon.
      if (
        id === "marksman" ||
        id === "scatter" ||
        id === "laser" ||
        id === "ricochet" ||
        id === "pike" ||
        id === "grappler" ||
        id === "siphon"
      ) {
        fx = pr * (beaming || attacking || charging ? 0.85 : 0.55);
        fy = side * pr * (side > 0 ? 0.22 : 0.42);
      } else if (id === "bulwark") {
        if (side < 0) {
          // Shield arm stays out front-left.
          fx = pr * (attacking || charging ? 0.48 : 0.32);
          fy = -pr * 0.78;
        } else {
          // Right hand braces the barrage cannon.
          fx = pr * (attacking || charging ? 0.95 : 0.72);
          fy = pr * 0.28;
        }
      } else if (id === "striker" && side > 0) {
        fx = pr * (attacking || dashing ? 1.05 : 0.7);
        fy = pr * 0.35;
      }

      const shoulderX = pr * 0.15;
      const shoulderY = side * pr * shoulderSpread;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = flash
        ? "rgba(255,255,255,0.7)"
        : "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(2.2, pr * 0.14);
      ctx.lineCap = "round";
      ctx.stroke();

      if (side > 0) hands.right = { x: fx, y: fy };
      else hands.left = { x: fx, y: fy };
    }

    drawFighterWeapon(p, pr, flash, hands, {
      attacking: attacking,
      charging: charging,
      beaming: beaming,
      dashing: dashing,
    });

    for (const side of [-1, 1]) {
      const hand = side > 0 ? hands.right : hands.left;
      if (!hand) continue;
      const fx = hand.x;
      const fy = hand.y;
      if (showCharacterShine && !flash) {
        const hg = ctx.createRadialGradient(
          fx - handR * 0.3,
          fy - handR * 0.3,
          handR * 0.1,
          fx,
          fy,
          handR
        );
        hg.addColorStop(0, "rgba(255,255,255,0.5)");
        hg.addColorStop(0.55, palm);
        hg.addColorStop(1, "rgba(0,0,0,0.3)");
        ctx.beginPath();
        ctx.arc(fx, fy, handR, 0, Math.PI * 2);
        ctx.fillStyle = hg;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(fx, fy, handR, 0, Math.PI * 2);
        ctx.fillStyle = palm;
        ctx.fill();
      }
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawFighterWeapon(p, pr, flash, hands, pose) {
    const id = p.characterId || "";
    if (!id || !hands.right) return;
    const rh = hands.right;
    const lh = hands.left || { x: pr * 0.4, y: -pr * 0.7 };
    const metal = flash ? "#ffffff" : "#d7dee8";
    const dark = flash ? "#f0f0f0" : "#2a3140";
    const accent = flash ? "#ffffff" : p.color;
    const extend = pose.attacking || pose.charging || pose.beaming ? 1.12 : 1;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (id === "brawler") {
      // Spiked gauntlets on both fists.
      for (const hand of [rh, lh]) {
        if (!hand) continue;
        ctx.beginPath();
        ctx.arc(hand.x, hand.y, pr * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = dark;
        ctx.fill();
        ctx.strokeStyle = metal;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = -0.6 + i * 0.6;
          ctx.beginPath();
          ctx.moveTo(hand.x + Math.cos(a) * pr * 0.28, hand.y + Math.sin(a) * pr * 0.28);
          ctx.lineTo(hand.x + Math.cos(a) * pr * 0.52, hand.y + Math.sin(a) * pr * 0.52);
          ctx.strokeStyle = metal;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    } else if (id === "striker") {
      // Forward knife / dagger in the right hand.
      const tip = pr * (1.15 * extend);
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.08, rh.y);
      ctx.lineTo(rh.x + tip * 0.35, rh.y - pr * 0.12);
      ctx.lineTo(rh.x + tip, rh.y);
      ctx.lineTo(rh.x + tip * 0.35, rh.y + pr * 0.12);
      ctx.closePath();
      ctx.fillStyle = metal;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.2, rh.y - pr * 0.16);
      ctx.lineTo(rh.x + pr * 0.12, rh.y - pr * 0.16);
      ctx.lineTo(rh.x + pr * 0.12, rh.y + pr * 0.16);
      ctx.lineTo(rh.x - pr * 0.2, rh.y + pr * 0.16);
      ctx.closePath();
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rh.x + tip * 0.2, rh.y);
      ctx.lineTo(rh.x + tip * 0.92, rh.y);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (id === "marksman") {
      // Long sniper rifle along facing.
      const barrel = pr * (1.7 * extend);
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.55, rh.y + pr * 0.06);
      ctx.lineTo(rh.x + barrel, rh.y);
      ctx.strokeStyle = dark;
      ctx.lineWidth = pr * 0.16;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.15, rh.y - pr * 0.02);
      ctx.lineTo(rh.x + barrel * 0.92, rh.y - pr * 0.02);
      ctx.strokeStyle = metal;
      ctx.lineWidth = pr * 0.08;
      ctx.stroke();
      // Scope
      pathRoundedRect(rh.x + pr * 0.15, rh.y - pr * 0.28, pr * 0.55, pr * 0.22, 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + barrel, rh.y, pr * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = metal;
      ctx.fill();
    } else if (id === "scatter") {
      // Short shotgun.
      const barrel = pr * (1.15 * extend);
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.35, rh.y + pr * 0.08);
      ctx.lineTo(rh.x + barrel * 0.55, rh.y + pr * 0.02);
      ctx.strokeStyle = dark;
      ctx.lineWidth = pr * 0.28;
      ctx.lineCap = "butt";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x + barrel * 0.35, rh.y);
      ctx.lineTo(rh.x + barrel, rh.y - pr * 0.08);
      ctx.moveTo(rh.x + barrel * 0.35, rh.y);
      ctx.lineTo(rh.x + barrel, rh.y + pr * 0.08);
      ctx.strokeStyle = metal;
      ctx.lineWidth = pr * 0.14;
      ctx.stroke();
      ctx.lineCap = "round";
      pathRoundedRect(rh.x - pr * 0.45, rh.y - pr * 0.12, pr * 0.4, pr * 0.28, 3);
      ctx.fillStyle = "#5c4030";
      ctx.fill();
    } else if (id === "laser") {
      // Beam cannon / emitter gun.
      const barrel = pr * (1.35 * extend);
      pathRoundedRect(rh.x - pr * 0.25, rh.y - pr * 0.18, barrel, pr * 0.36, 4);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + barrel * 0.85, rh.y, pr * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = pose.beaming ? 0.95 : 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (pose.beaming) {
        ctx.beginPath();
        ctx.moveTo(rh.x + barrel, rh.y);
        ctx.lineTo(rh.x + barrel + pr * 0.8, rh.y);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else if (id === "ricochet") {
      // Prism pistol.
      const barrel = pr * (0.95 * extend);
      pathPolygon([
        [rh.x - pr * 0.15, rh.y - pr * 0.12],
        [rh.x + barrel, rh.y - pr * 0.08],
        [rh.x + barrel + pr * 0.12, rh.y],
        [rh.x + barrel, rh.y + pr * 0.08],
        [rh.x - pr * 0.15, rh.y + pr * 0.18],
        [rh.x - pr * 0.28, rh.y + pr * 0.05],
      ]);
      ctx.fillStyle = metal;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x + barrel * 0.2, rh.y - pr * 0.04);
      ctx.lineTo(rh.x + barrel * 0.85, rh.y - pr * 0.02);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (id === "bulwark") {
      // Tower shield on left + multi-barrel barrage cannon on right.
      const shieldX = lh.x + pr * 0.08;
      const shieldY = lh.y;
      pathPolygon([
        [shieldX - pr * 0.22, shieldY - pr * 0.78],
        [shieldX + pr * 0.38, shieldY - pr * 0.62],
        [shieldX + pr * 0.48, shieldY],
        [shieldX + pr * 0.38, shieldY + pr * 0.62],
        [shieldX - pr * 0.22, shieldY + pr * 0.78],
        [shieldX - pr * 0.38, shieldY + pr * 0.2],
        [shieldX - pr * 0.38, shieldY - pr * 0.2],
      ]);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shieldX - pr * 0.12, shieldY - pr * 0.45);
      ctx.lineTo(shieldX + pr * 0.28, shieldY - pr * 0.32);
      ctx.moveTo(shieldX - pr * 0.12, shieldY + pr * 0.45);
      ctx.lineTo(shieldX + pr * 0.28, shieldY + pr * 0.32);
      ctx.moveTo(shieldX - pr * 0.18, shieldY);
      ctx.lineTo(shieldX + pr * 0.34, shieldY);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(shieldX + pr * 0.05, shieldY, pr * 0.18, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const barrel = pr * (1.22 * extend);
      const gunX = rh.x - pr * 0.12;
      const gunY = rh.y;
      // Receiver / body
      pathRoundedRect(gunX, gunY - pr * 0.22, barrel * 0.72, pr * 0.44, 4);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Magazine / drum under the receiver
      ctx.beginPath();
      ctx.ellipse(
        gunX + barrel * 0.32,
        gunY + pr * 0.28,
        pr * 0.28,
        pr * 0.2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = metal;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gunX + barrel * 0.32, gunY + pr * 0.28, pr * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      // Triple muzzle cluster for the chaotic spray
      const muzzleX = gunX + barrel * 0.78;
      for (let bi = -1; bi <= 1; bi++) {
        const by = gunY + bi * pr * 0.14;
        pathRoundedRect(muzzleX, by - pr * 0.07, barrel * 0.34, pr * 0.14, 2);
        ctx.fillStyle = metal;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(muzzleX + barrel * 0.34, by, pr * 0.055, 0, Math.PI * 2);
        ctx.fillStyle = pose.attacking || pose.charging ? accent : dark;
        ctx.fill();
      }
      if (pose.attacking || pose.charging) {
        ctx.globalAlpha = pose.attacking ? 0.7 : 0.35;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        for (let si = -1; si <= 1; si++) {
          ctx.beginPath();
          ctx.moveTo(muzzleX + barrel * 0.34, gunY + si * pr * 0.12);
          ctx.lineTo(
            muzzleX + barrel * 0.34 + pr * (0.35 + Math.abs(si) * 0.12),
            gunY + si * pr * 0.28
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } else if (id === "nova") {
      // Orb staff.
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.2, rh.y + pr * 0.05);
      ctx.lineTo(rh.x + pr * 1.05 * extend, rh.y - pr * 0.05);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + pr * 1.15 * extend, rh.y - pr * 0.05, pr * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + pr * 1.15 * extend, rh.y - pr * 0.05, pr * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fill();
    } else if (id === "phoenix") {
      // Flame brand — points forward during ult buff, otherwise trails back.
      const forward = phoenixUltAttackActive(p);
      const dir = forward ? 1 : -1;
      const tipX = rh.x + dir * pr * 1.2 * extend;
      pathPolygon([
        [rh.x, rh.y],
        [rh.x + dir * pr * 0.35, rh.y - pr * 0.18],
        [tipX, rh.y],
        [rh.x + dir * pr * 0.35, rh.y + pr * 0.18],
      ]);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      pathPolygon([
        [rh.x + dir * pr * 0.25, rh.y],
        [rh.x + dir * pr * 0.55, rh.y - pr * 0.1],
        [tipX - dir * pr * 0.15, rh.y],
        [rh.x + dir * pr * 0.55, rh.y + pr * 0.1],
      ]);
      ctx.fillStyle = flash ? "#fff" : "rgba(255,240,180,0.75)";
      ctx.fill();
    } else if (id === "echo") {
      // Twin ghost pistols.
      for (const hand of [rh, lh]) {
        if (!hand) continue;
        ctx.globalAlpha = hand === lh ? 0.55 : 0.9;
        pathRoundedRect(hand.x - pr * 0.1, hand.y - pr * 0.1, pr * 0.85 * extend, pr * 0.2, 2);
        ctx.fillStyle = metal;
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hand.x + pr * 0.15, hand.y + pr * 0.1);
        ctx.lineTo(hand.x - pr * 0.05, hand.y + pr * 0.32);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (id === "pike") {
      // Long spear held two-handed along facing.
      const tip = pr * (2.05 * extend);
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.75, rh.y);
      ctx.lineTo(rh.x + tip * 0.72, rh.y);
      ctx.strokeStyle = dark;
      ctx.lineWidth = pr * 0.12;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.55, rh.y);
      ctx.lineTo(rh.x + tip * 0.62, rh.y);
      ctx.strokeStyle = metal;
      ctx.lineWidth = pr * 0.055;
      ctx.stroke();
      pathPolygon([
        [rh.x + tip * 0.62, rh.y],
        [rh.x + tip * 0.78, rh.y - pr * 0.16],
        [rh.x + tip, rh.y],
        [rh.x + tip * 0.78, rh.y + pr * 0.16],
      ]);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x - pr * 0.15, rh.y - pr * 0.14);
      ctx.lineTo(rh.x + pr * 0.05, rh.y - pr * 0.14);
      ctx.lineTo(rh.x + pr * 0.05, rh.y + pr * 0.14);
      ctx.lineTo(rh.x - pr * 0.15, rh.y + pr * 0.14);
      ctx.closePath();
      ctx.fillStyle = dark;
      ctx.fill();
    } else if (id === "grappler") {
      // Compact hook launcher.
      const tip = pr * (1.45 * extend);
      pathRoundedRect(rh.x - pr * 0.2, rh.y - pr * 0.14, tip * 0.72, pr * 0.28, 3);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rh.x + tip * 0.55, rh.y);
      ctx.quadraticCurveTo(
        rh.x + tip * 0.95,
        rh.y - pr * 0.35,
        rh.x + tip,
        rh.y + pr * 0.05
      );
      ctx.strokeStyle = accent;
      ctx.lineWidth = pr * 0.1;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + tip * 0.92, rh.y + pr * 0.08, pr * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    } else if (id === "siphon") {
      // Short vortex blaster.
      const tip = pr * (1.25 * extend);
      pathRoundedRect(rh.x - pr * 0.15, rh.y - pr * 0.16, tip * 0.75, pr * 0.32, 4);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rh.x + tip * 0.78, rh.y, pr * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = pose.attacking || pose.charging ? 0.95 : 0.65;
      ctx.fill();
      ctx.globalAlpha = 1;
      if ((p.cooldown || 0) > ATTACK_COOLDOWN + 0.05) {
        const cdFrac = clamp(p.cooldown / SIPHON_ATTACK_COOLDOWN, 0, 1);
        ctx.beginPath();
        ctx.arc(rh.x + tip * 0.78, rh.y, pr * 0.32, 0, Math.PI * 2 * cdFrac);
        ctx.strokeStyle = "rgba(255, 200, 210, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawFighterFacingArrow(p, pr) {
    if (!showFacingArrow) return;
    const id = p.isBot ? "boss" : p.characterId || "brawler";
    // Shapes that already read facing strongly skip the generic arrow.
    if (
      showUniqueShapes &&
      (id === "striker" ||
        id === "marksman" ||
        id === "laser" ||
        id === "scatter" ||
        id === "phoenix" ||
        id === "pike" ||
        id === "grappler" ||
        id === "siphon")
    ) {
      return;
    }
    if (!showCharacterShine) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.moveTo(pr - 4, 0);
      ctx.lineTo(pr * 0.35, 6);
      ctx.lineTo(pr * 0.35, -6);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.moveTo(pr + 2, 0);
    ctx.lineTo(pr * 0.2, 7);
    ctx.lineTo(pr * 0.2, -7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(pr - 1, 0);
    ctx.lineTo(pr * 0.35, 5);
    ctx.lineTo(pr * 0.35, -5);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer(p) {
    if ((p.respawnT || 0) > 0 && !p.isBot) {
      drawRespawnCountdown(p);
      return;
    }
    if (isHordeHeroDowned(p)) {
      const pr = getPlayerRadius(p);
      const bleed = HORDE_DOWN_BLEED > 0 ? (p.downBleedT || 0) / HORDE_DOWN_BLEED : 0;
      const reviving = hordeDownedIsBeingRevived(p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(40,45,58,0.75)";
      ctx.fill();
      ctx.strokeStyle = reviving
        ? "rgba(126, 231, 135, 0.9)"
        : "rgba(126, 231, 135, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-pr, pr + 4, pr * 2, 4);
      ctx.fillStyle = reviving
        ? "rgba(126, 231, 135, 0.95)"
        : "rgba(255, 90, 90, 0.9)";
      ctx.fillRect(-pr, pr + 4, pr * 2 * clamp(bleed, 0, 1), 4);
      ctx.restore();
      return;
    }
    if (isPhoenix(p) && p.phoenixReviving) {
      const pr = getPlayerRadius(p);
      const t =
        PHOENIX_REVIVE_DURATION > 0
          ? 1 - (p.phoenixReviveT || 0) / PHOENIX_REVIVE_DURATION
          : 1;
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.012);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 6 + 4 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle =
        "rgba(251, 191, 36, " + (0.35 + 0.45 * t) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(249, 115, 22, " + (0.15 + 0.2 * t) + ")";
      ctx.fill();
      ctx.restore();
      return;
    }
    if (p.hp <= 0 || p.eliminated) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, getPlayerRadius(p), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(40,45,58,0.85)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const flash = p.hitFlash > 0;
    const charging =
      p.chargeT > 0 && p.attackStyle !== "beam" && !p.beamActive;
    const chargeFrac = charging
      ? clamp(p.chargeT / Math.max(p.aiChargeGoal || 1, 0.35), 0, 1)
      : 0;
    const spd = len(p.vx || 0, p.vy || 0);
    const bob =
      Math.sin((p.animPhase || 0) * (spd > 40 ? 9 : 3.6) + p.playerNum) *
      (spd > 40 ? 2.2 : 1.15);
    const walkLean =
      spd > 40 ? Math.sin((p.walkCycle || 0) * Math.PI * 2) * 0.1 : 0;
    ctx.save();
    if (isSiphonPhasing(p)) {
      ctx.globalAlpha = 0.38;
    }
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.facing + walkLean);
    const sx = clamp(
      Number.isFinite(p.squashX) ? p.squashX : 1,
      0.55,
      1.45
    );
    const sy = clamp(
      Number.isFinite(p.squashY) ? p.squashY : 1,
      0.55,
      1.45
    );
    ctx.scale(sx, sy);

    const pr = getPlayerRadius(p);
    if (charging) {
      const chargePulse = 0.6 + 0.4 * Math.sin((p.animPhase || 0) * 12);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 6 + chargeFrac * 10, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = (0.12 + chargeFrac * 0.28) * chargePulse;
      ctx.lineWidth = 3 + chargeFrac * 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawFighterBody(p, pr, flash);
    drawFighterHands(p, pr, flash);

    if ((p.respawnInvulnT || 0) > 0) {
      const pulse = 0.45 + 0.35 * Math.sin(performance.now() * 0.014);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(196, 245, 66, " + pulse + ")";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (p.stunT > 0) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.018);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 214, 102, " + (0.35 + 0.35 * pulse) + ")";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isReaverRuinRooted(p)) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.022);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(168, 85, 247, " + (0.4 + 0.35 * pulse) + ")";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isReaverHookDisarmed(p)) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, pr + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251, 191, 36, " + (0.45 + 0.35 * pulse) + ")";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawFighterFacingArrow(p, pr);

    ctx.restore();
  }

  function updateHud() {
    players.forEach((p, idx) => {
      let pct;
      if (isHordeHeroDowned(p)) {
        pct = Math.max(0, ((p.downBleedT || 0) / HORDE_DOWN_BLEED) * 100);
      } else if (p.eliminated) {
        pct = 0;
      } else {
        pct = Math.max(0, (p.hp / p.maxHp) * 100);
      }
      if (p.isBot) {
        if (hpBossEl) hpBossEl.style.width = pct + "%";
      } else if (hpEls[idx]) {
        hpEls[idx].style.width = pct + "%";
      }
    });
    if (gameMode === "siege") {
      const baseA = mapRuntime.bases.find((b) => b.team === "a");
      const baseB = mapRuntime.bases.find((b) => b.team === "b");
      if (hpBaseAEl) {
        const pct = baseA && baseA.maxHp > 0 ? Math.max(0, (baseA.hp / baseA.maxHp) * 100) : 0;
        hpBaseAEl.style.width = pct + "%";
      }
      if (hpBaseBEl) {
        const pct = baseB && baseB.maxHp > 0 ? Math.max(0, (baseB.hp / baseB.maxHp) * 100) : 0;
        hpBaseBEl.style.width = pct + "%";
      }
    }
  }

  let last = performance.now();

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    pollGamepad();
    updateGamepadStatusUI();
    syncGamepadKeys();
    syncMouseButtonKeys();
    updateAimOverrides();

    // Reset canvas state every frame so a bad clip/alpha/transform can't stick.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    if (
      keys["KeyR"] &&
      gameMode != null &&
      !modePickerOpen &&
      !mapPickerOpen &&
      !bossPickerOpen &&
      !characterPickerOpen
    ) {
      resetGame();
      keys["KeyR"] = false;
    }

    if (
      !modePickerOpen &&
      !mapPickerOpen &&
      !bossPickerOpen &&
      !characterPickerOpen &&
      !gameOver &&
      gameMode != null
    ) {
      updateMapDynamics(dt);
      if (gameMode === "siege") updateBases(dt);
      if (gameMode === "horde") updateHordeMode(dt);
      players.forEach((p) => steerPlayer(p, dt));
      if (gameMode === "horde") {
        updateHordeDowned(dt);
        players.forEach((p) => {
          if (isHordeHeroActive(p)) hordeTickSupport(p, dt);
        });
      }
      separatePlayers();
      if (mapHasCreatures()) separateCreaturesFromFighters();
      if (gameMode === "horde") separateWaveEnemiesFromFighters();
      if (
        (gameMode === "boss" || hordeBossWaveActive()) &&
        mapRuntime.bossMinions.length > 0
      ) {
        separateBossMinionsFromFighters();
      }
      updateProjectiles(dt);
      players.forEach((p) => {
        tickFighterAnim(p, dt);
        sanitizeFighterPose(p);
      });
      for (let i = 0; i < players.length; i++) {
        for (let j = 0; j < players.length; j++) {
          if (i !== j) tryHit(players[i], players[j]);
        }
        tryHitCreatures(players[i]);
        tryHitWaveEnemies(players[i]);
        tryHitBossMinions(players[i]);
        tryHitEchoSummons(players[i]);
        tryHitPikeSpears(players[i]);
        tryDashHitEchoSummons(players[i]);
        tryDashHitPikeSpears(players[i]);
        tryHitMarionetteEffigies(players[i]);
        tryDashHitMarionetteEffigies(players[i]);
        if (gameMode === "siege") {
          tryHitBase(players[i]);
          tryDashHitBase(players[i]);
        }
      }
      flushWinCheck();
    } else if (
      !modePickerOpen &&
      !mapPickerOpen &&
      !bossPickerOpen &&
      !characterPickerOpen &&
      gameMode != null
    ) {
      players.forEach((p) => sanitizeFighterPose(p));
    }

    if (
      !modePickerOpen &&
      !mapPickerOpen &&
      !bossPickerOpen &&
      !characterPickerOpen &&
      gameMode != null
    ) {
      updateAnimFx(dt);
    }

    const panes = computePanes(dt);
    for (let pi = 0; pi < panes.length; pi++) {
      const pane = panes[pi];
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.rect.x, pane.rect.y, pane.rect.w, pane.rect.h);
      ctx.clip();
      // Siege's own background fill is skipped (it can't track a moving
      // camera) so paint over whatever the previous frame left here first —
      // otherwise a camera nudged near the world edge would show stale
      // pixels instead of a clean edge.
      if (gameMode === "siege") {
        ctx.fillStyle = "#080b12";
        ctx.fillRect(pane.rect.x, pane.rect.y, pane.rect.w, pane.rect.h);
      }
      ctx.translate(
        pane.rect.x + pane.rect.w * 0.5,
        pane.rect.y + pane.rect.h * 0.5
      );
      ctx.scale(pane.zoom, pane.zoom);
      ctx.translate(-pane.camera.x, -pane.camera.y);
      applyArenaViewTransform();
      drawWorldView();
      ctx.restore();
    }
    if (panes.length > 1) drawPaneDivider(panes);
    drawHordeHud();
    updateHud();

    requestAnimationFrame(frame);
  }

  function drawWorldView() {
    drawArena();
    drawToxicPuddles();
    drawBossBottles();
    drawBossMinions();
    drawEchoSummons();
    drawPikeSpears();
    drawMarionetteBolts();
    drawMarionetteEffigies();
    if (gameMode === "siege") drawBases();
    drawProjectiles();
    players.forEach((p) => {
      if (p.isBot) {
        drawBossGroundPound(p);
        drawBossScorchBeam(p);
        drawReaverRuin(p);
        drawReaverHook(p);
        drawReaverGrasp(p);
        drawHexwrightWindup(p);
      }
    });
    players.forEach((p) => drawChargeArc(p));
    players.forEach((p) => drawAttackArc(p));
    players.forEach((p) => drawDashMarker(p));
    players.forEach((p) => drawDashTrail(p));
    players.forEach((p) => drawPhoenixBurst(p));
    players.forEach((p) => drawSeismicSlam(p));
    players.forEach((p) => drawLaserBeam(p));
    players.forEach((p) => drawGrapplerHook(p));
    players.forEach((p) => drawSiphonUltimate(p));
    drawCreatures();
    drawWaveEnemies();
    drawHostileShots();
    drawAnimFx();
    drawHordeSupportLinks();
    players.forEach((p) => drawFighterShadow(p));
    players.forEach((p) => drawPlayer(p));
    players.forEach((p) => drawUltimateRing(p));
    players.forEach((p) => drawPlayerOverheadHp(p));
    players.forEach((p) => drawPlayerBadge(p));
  }

  function drawPaneDivider(panes) {
    const x = panes[1].rect.x;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(frame);
})();

