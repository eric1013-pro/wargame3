import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceKillstreak,
  computeAmmoGaugeState,
  computeSpawnBalance,
  computeWaveForKills,
  createRagdollConstraints,
  evaluatePartHit,
  formatClock,
  KILLSTREAK_TARGET,
  resolveXZCollision,
  stepVatsGauge,
  stepVerletRagdoll,
  WEAPONS,
} from './rules';
import { computeBattleAnalytics, createEmptyAnalytics } from './analytics';
import {
  computeCombatRank,
  computeMissionObjective,
  getStoryActForWave,
  PROLOGUE_BEATS,
  WASTELAND_HOLOTAPES,
} from './story';
import { CinematicDirector } from './cinematicDirector';
import {
  computeReloadTiming,
  evaluateWeaponReload,
  TACTICAL_RELOAD_MULTIPLIER,
  WEAPON_RELOAD_PROFILES,
} from './reloadSystem';
import { AabbCollider, VerletNode } from './types';

test('all 5 GDD weapons are configured with valid specs', () => {
  assert.equal(WEAPONS.length, 5);
  assert.equal(WEAPONS[0].slotKey, '1');
  assert.equal(WEAPONS[4].slotKey, '5');
  assert.equal(WEAPONS[4].projectile, 'flame');
  assert.equal(WEAPONS[3].projectile, 'rocket');
  assert.equal(WEAPONS[2].pierce, true);
});

test('headshot applies 2.5x multiplier and instant dismemberment fatality on non-boss', () => {
  const res = evaluatePartHit({
    baseDamage: 40,
    part: 'head',
    currentHp: 100,
    dismemberPower: 1.5,
    isBoss: false,
    alreadyMissing: false,
  });
  assert.equal(res.finalDamage, 100);
  assert.equal(res.isCrit, true);
  assert.equal(res.shouldDismember, true);
  assert.equal(res.instantFatal, true);
  assert.ok(res.newHp <= 0);
});

test('V.A.T.S. guaranteed shot dismembers arm without instantly killing healthy enemy', () => {
  const res = evaluatePartHit({
    baseDamage: 30,
    part: 'rightArm',
    currentHp: 120,
    dismemberPower: 0.65,
    isBoss: false,
    alreadyMissing: false,
    isVatsGuaranteed: true,
  });
  assert.equal(res.shouldDismember, true);
  assert.equal(res.instantFatal, false);
  assert.ok(res.newHp > 0);
});

test('boss armor plates detach on heavy hit without instant fatality', () => {
  const res = evaluatePartHit({
    baseDamage: 155,
    part: 'armorFront',
    currentHp: 600,
    dismemberPower: 2.4,
    isBoss: true,
    alreadyMissing: false,
  });
  assert.equal(res.shouldDismember, true);
  assert.equal(res.instantFatal, false);
  assert.ok(res.newHp > 400);
});

test('resolveXZCollision pushes entity out of active AABB collider and clamps arena', () => {
  const colliders: AabbCollider[] = [
    { minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 5, alive: true },
  ];
  const ent = { x: 1.9, z: 0 };
  resolveXZCollision(ent, 0.5, colliders, 58);
  assert.ok(ent.x >= 2.5 - 1e-6);

  const far = { x: 120, z: -120 };
  resolveXZCollision(far, 0.5, colliders, 58);
  assert.ok(far.x <= 56.2);
  assert.ok(far.z >= -56.2);
});

test('Verlet ragdoll preserves 8 stick constraints, settles on floor, and detects wall slam', () => {
  const links = createRagdollConstraints(1);
  assert.equal(links.length, 8);

  const makeNode = (x: number, y: number, z: number, vx = 0): VerletNode => ({
    x,
    y,
    z,
    ox: x - vx / 60,
    oy: y,
    oz: z,
    r: 0.2,
  });

  const nodes: Record<string, VerletNode> = {
    pelvis: makeNode(0, 1.0, 0, 16),
    chest: makeNode(0, 1.65, 0, 18),
    head: makeNode(0, 2.05, 0, 18),
    lHand: makeNode(-0.5, 1.2, 0, 16),
    rHand: makeNode(0.5, 1.2, 0, 16),
    lFoot: makeNode(-0.2, 0.25, 0, 14),
    rFoot: makeNode(0.2, 0.25, 0, 14),
  };

  const wall: AabbCollider[] = [
    { minX: 0.45, maxX: 2.0, minZ: -5, maxZ: 5, height: 6, alive: true },
  ];

  let sawWallImpact = false;
  for (let i = 0; i < 40; i++) {
    const step = stepVerletRagdoll(nodes, links, wall, 1 / 60, 58);
    if (step.wallImpacts.length > 0) sawWallImpact = true;
  }
  assert.equal(sawWallImpact, true);
  for (const key of Object.keys(nodes)) {
    assert.ok(Number.isFinite(nodes[key].x));
    assert.ok(nodes[key].y >= nodes[key].r - 1e-5);
  }
});

test('killstreak charges airstrike at 5 kills and V.A.T.S. drains/regens properly', () => {
  let streak = 0;
  let ready = false;
  let chargedAt = -1;
  for (let k = 1; k <= 6; k++) {
    const res = advanceKillstreak(streak, ready);
    streak = res.streak;
    ready = res.airstrikeReady;
    if (res.justCharged) chargedAt = k;
  }
  assert.equal(chargedAt, KILLSTREAK_TARGET);
  assert.equal(ready, true);

  const drained = stepVatsGauge(50, true, 1.0);
  assert.ok(drained.energy < 50 && drained.active);
  const empty = stepVatsGauge(5, true, 1.0);
  assert.equal(empty.energy, 0);
  assert.equal(empty.active, false);

  const regened = stepVatsGauge(40, false, 1.0);
  assert.ok(regened.energy > 40);
});

test('wave progression and clock formatting', () => {
  assert.equal(computeWaveForKills(0), 1);
  assert.equal(computeWaveForKills(10), 2);
  assert.equal(computeWaveForKills(25), 3);
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(125), '02:05');
});

test('story acts, prologue beats, holotapes, mission objectives, and combat rank tiers', () => {
  assert.equal(PROLOGUE_BEATS.length, 3);
  assert.equal(WASTELAND_HOLOTAPES.length, 4);
  assert.equal(getStoryActForWave(1).actNumber, 1);
  assert.equal(getStoryActForWave(3).actNumber, 2);
  assert.equal(getStoryActForWave(5).actNumber, 3);
  assert.equal(getStoryActForWave(8).actNumber, 4);

  const relayObj = computeMissionObjective(1, 3, null, 1, 3, false);
  assert.ok(relayObj.text.includes('1/3'));
  assert.equal(relayObj.progressPct, 33);

  const bossObj = computeMissionObjective(5, 30, 'OMNI-TITAN 워든', 2, 3, false);
  assert.ok(bossObj.text.includes('OMNI-TITAN 워든'));
  assert.equal(bossObj.progressPct, 67);

  const shieldDownObj = computeMissionObjective(5, 30, null, 3, 3, true);
  assert.ok(shieldDownObj.text.includes('[F]'));
  assert.equal(shieldDownObj.progressPct, 100);

  assert.equal(computeCombatRank(0, 0, 0, 10).grade, 'C');
  assert.equal(computeCombatRank(8, 3, 1, 60).grade, 'B');
  assert.equal(computeCombatRank(16, 8, 2, 120).grade, 'A');
  assert.equal(computeCombatRank(28, 16, 6, 220).grade, 'S');
});

test('D3 battlefield analytics metrics compute K/D, dismemberment efficiency, accuracy, and faction shares safely', () => {
  const empty = createEmptyAnalytics(4);
  const zeroRes = computeBattleAnalytics(0, 0, empty);
  assert.equal(zeroRes.kdRatio, 0);
  assert.equal(zeroRes.dismemberEfficiencyPct, 0);
  assert.equal(zeroRes.accuracyPct, 0);
  assert.equal(zeroRes.totalFactionKills, 0);

  const active = createEmptyAnalytics(4);
  active.deaths = 1;
  active.shotsFired = 40;
  active.shotsHit = 28;
  active.killsByFaction = { raider: 8, syndicate: 6, robot: 6 };
  active.partBreakdown = { head: 6, arm: 4, leg: 2, armor: 1, gloryKill: 3 };
  const res = computeBattleAnalytics(20, 13, active);
  assert.equal(res.kdRatio, 20);
  assert.equal(res.dismemberEfficiencyPct, 65);
  assert.equal(res.accuracyPct, 70);
  assert.equal(res.headshotRatePct, 30);
  assert.equal(res.totalFactionKills, 20);
  assert.equal(res.factionShares[0].pct, 40);
  assert.equal(res.factionShares[1].pct, 30);
  assert.equal(res.factionShares[2].pct, 30);
  assert.equal(res.partBars.length, 5);
});

test('CinematicDirector Opening sequence enforces invulnerability, letterbox, visor boot, and [SPACE] skip', () => {
  let heartbeats = 0;
  let braaams = 0;
  let completedSeq = '';
  const dir = new CinematicDirector({
    onHeartbeat: () => heartbeats++,
    onBraaam: () => braaams++,
    onSequenceComplete: (seq) => {
      completedSeq = seq;
    },
  });

  dir.startOpening({ x: 0, y: 1.7, z: 32 }, { x: 0, y: 12, z: -35 });
  assert.equal(dir.isCutsceneActive(), true);
  assert.equal(dir.isInvulnerable(), true);

  // Advance 2.2s into Opening (2 heartbeats + Visor Boot stage 2)
  for (let i = 0; i < 44; i++) dir.update(0.05);
  const midHud = dir.getHudState();
  assert.equal(heartbeats, 2);
  assert.equal(midHud.letterbox, true);
  assert.equal(midHud.canSkip, true);
  assert.ok(midHud.visorBootStep >= 1);
  assert.ok(midHud.blurPx > 0);

  const pose = dir.getCameraPose();
  assert.equal(pose.active, true);
  assert.ok(pose.rollRad < 0);

  // [SPACE] skip immediately resolves ACT 01 card + EXO-SUIT subtitle and exits cutscene cleanly
  assert.equal(dir.skip(), true);
  assert.equal(dir.isCutsceneActive(), false);
  assert.equal(dir.isInvulnerable(), false);
  assert.equal(completedSeq, 'opening');
  assert.equal(braaams, 1);
  const postHud = dir.getHudState();
  assert.equal(postHud.letterbox, false);
  assert.ok(postHud.chapterCard?.actCode.includes('ACT 01'));
  assert.equal(dir.getActiveSubtitle()?.sender, 'exo');
});

test('CinematicDirector Breach & Dawn sequences fire critical milestones, dawn morph, and sequential Holotape logs', () => {
  let shattered = false;
  let dawnBlackout = false;
  let finished = '';
  const dir = new CinematicDirector({
    onBreachDomeShatter: () => {
      shattered = true;
    },
    onDawnBlackoutImpact: () => {
      dawnBlackout = true;
    },
    onSequenceComplete: (seq) => {
      finished = seq;
    },
  });

  // Test Breach 0.3x slow-mo + shatter milestone
  dir.startBreach({ x: 0, y: 1.7, z: 10 }, { x: 0, y: 2, z: -10 }, { x: 0, y: 12, z: -35 });
  assert.equal(dir.getTimeScale(), 0.3);
  for (let i = 0; i < 45; i++) dir.update(0.05); // 2.25s
  assert.equal(shattered, true);
  assert.ok(dir.getHudState().chapterCard?.actCode.includes('ACT 02'));
  assert.equal(dir.getActiveSubtitle()?.sender, 'arcadia');

  // Test Dawn 5s sky morph & blackout impact
  dir.startDawn({ x: 0, y: 1.7, z: -10 }, { x: 0, y: 8, z: -35 }, { x: 0, y: 12, z: -35 });
  for (let i = 0; i < 155; i++) dir.update(0.05); // 7.75s -> completes 7.4s Dawn
  assert.equal(dawnBlackout, true);
  assert.equal(dir.getDawnProgress(), 1);
  assert.equal(finished, 'dawn');

  // Test non-blocking 3-line Holotape sequential playback
  const tape = WASTELAND_HOLOTAPES[3];
  assert.equal(tape.lines.length, 3);
  dir.enqueueSubtitles(
    tape.lines.map((text, idx) => ({
      speaker: `${tape.code} [${tape.title}]`,
      role: tape.role,
      sender: 'holotape' as const,
      accentCss: '#f59e0b',
      text,
      duration: 2.0,
      lineIndex: idx + 1,
      lineTotal: 3,
    })),
    true
  );
  assert.equal(dir.getActiveSubtitle()?.lineIndex, 1);
  assert.equal(dir.getActiveSubtitle()?.sender, 'holotape');
  for (let i = 0; i < 42; i++) dir.update(0.05); // 2.1s -> advances to line 2
  assert.equal(dir.getActiveSubtitle()?.lineIndex, 2);
  for (let i = 0; i < 42; i++) dir.update(0.05); // 2.1s -> advances to line 3
  assert.equal(dir.getActiveSubtitle()?.lineIndex, 3);
});

test('weapon-specific reload sequences transition cleanly from emptying to loading to chambering across all 5 weapons', () => {
  assert.equal(WEAPON_RELOAD_PROFILES.length, WEAPONS.length);

  for (let w = 0; w < WEAPONS.length; w++) {
    const idle = evaluateWeaponReload(w, 0, false);
    assert.equal(idle.hud.phase, 'idle');
    assert.equal(idle.hud.stageGroup, 'idle');
    assert.equal(idle.pose.magVisible, true);

    const profile = WEAPON_RELOAD_PROFILES[w];
    assert.ok(profile.emptyEnd > 0.2 && profile.emptyEnd < profile.chamberStart);
    assert.ok(profile.chamberStart < 0.95);

    // Mid-emptying
    const emptying = evaluateWeaponReload(w, profile.emptyEnd * 0.5, true);
    assert.equal(emptying.hud.phase, 'emptying');
    assert.equal(emptying.hud.stageGroup, 'emptying');
    assert.equal(emptying.hud.phaseLabel, profile.emptyingLabel);

    // Mid-loading
    const loading = evaluateWeaponReload(
      w,
      (profile.emptyEnd + profile.chamberStart) * 0.5,
      true
    );
    assert.equal(loading.hud.phase, 'loading');
    assert.equal(loading.hud.stageGroup, 'loading');
    assert.equal(loading.hud.phaseLabel, profile.loadingLabel);
    assert.notEqual(loading.hud.accentCss, emptying.hud.accentCss);

    // Mid-chambering
    const chambering = evaluateWeaponReload(
      w,
      (profile.chamberStart + 1) * 0.5,
      true
    );
    assert.equal(chambering.hud.phase, 'chambering');
    assert.equal(chambering.hud.stageGroup, 'loading');
    assert.equal(chambering.hud.phaseLabel, profile.chamberingLabel);
    assert.equal(chambering.pose.magVisible, true);
  }

  // Weapon-specific articulation checks:
  // M41-X detaches mag downward during emptying and pulls charging handle during chambering
  const m41Empty = evaluateWeaponReload(0, 0.28, true);
  assert.ok(m41Empty.pose.magPos.y < -0.15);
  const m41Chamber = evaluateWeaponReload(0, 0.88, true);
  assert.ok(m41Chamber.pose.auxValue > 0.7);

  // DOOM-99 racks pump forend rearward (+Z) during chambering
  const shotgunPump = evaluateWeaponReload(1, 0.89, true);
  assert.ok(shotgunPump.pose.magPos.z > 0.1);

  // RAIL-X9 discharges plasma core during emptying and surges it back during chambering
  const railEmpty = evaluateWeaponReload(2, 0.3, true);
  const railCharge = evaluateWeaponReload(2, 0.96, true);
  assert.ok(railEmpty.pose.auxValue < 0.2);
  assert.ok(railCharge.pose.auxValue > 0.9);

  // INFERNO-X rotates fuel canister while unscrewing during emptying
  const flamerEmpty = evaluateWeaponReload(4, 0.25, true);
  assert.ok(flamerEmpty.pose.magRot.y > 1.0);
});

test('Tactical Reload reduces reload duration by 20% when bullets remain and skips chambering phase', () => {
  const w = WEAPONS[0]; // M41-X: mag 32, reload 1.35s
  const emptyTiming = computeReloadTiming(w.reload, 0, w.mag);
  assert.equal(emptyTiming.isTactical, false);
  assert.equal(emptyTiming.durationSec, w.reload);
  assert.equal(emptyTiming.speedBonusPct, 0);

  const tacTiming = computeReloadTiming(w.reload, 12, w.mag);
  assert.equal(tacTiming.isTactical, true);
  assert.equal(tacTiming.speedBonusPct, 20);
  assert.equal(
    tacTiming.durationSec,
    Math.round(w.reload * TACTICAL_RELOAD_MULTIPLIER * 1000) / 1000
  );

  // Full mag returns non-tactical baseline timing
  const fullTiming = computeReloadTiming(w.reload, w.mag, w.mag);
  assert.equal(fullTiming.isTactical, false);

  // Evaluate Tactical Reload across all 5 weapons: never enters chambering, transitions emptying -> loading
  for (let i = 0; i < WEAPONS.length; i++) {
    const tacEarly = evaluateWeaponReload(i, 0.2, true, true, 1.08);
    assert.equal(tacEarly.hud.isTactical, true);
    assert.equal(tacEarly.hud.speedBonusPct, 20);
    assert.equal(tacEarly.hud.phase, 'emptying');
    assert.equal(tacEarly.hud.stageBadge, 'TACTICAL');

    const tacLate = evaluateWeaponReload(i, 0.92, true, true, 1.08);
    assert.equal(tacLate.hud.isTactical, true);
    assert.equal(tacLate.hud.phase, 'loading'); // Skips empty-chambering rack
    assert.equal(tacLate.hud.stageGroup, 'loading');
    assert.equal(tacLate.hud.durationSec, 1.08);
  }
});

test('computeSpawnBalance scales enemy cap, spawn cadence, and Titan boss gating fairly across waves', () => {
  const w1 = computeSpawnBalance(1, 0, false);
  assert.equal(w1.allowTitanBoss, false);
  assert.equal(w1.batchSize, 1);
  assert.equal(w1.maxConcurrentAttackers, 2);
  assert.ok(w1.maxActiveUnits <= 8);

  const w2Relay1 = computeSpawnBalance(2, 1, false);
  assert.equal(w2Relay1.allowTitanBoss, true);
  assert.ok(w2Relay1.maxActiveUnits > w1.maxActiveUnits);
  assert.ok(w2Relay1.spawnIntervalSec < w1.spawnIntervalSec);

  const w4Breach = computeSpawnBalance(4, 3, true);
  assert.equal(w4Breach.batchSize, 2);
  assert.equal(w4Breach.maxConcurrentAttackers, 3);
  assert.ok(w4Breach.maxActiveUnits <= 14);
  assert.ok(w4Breach.spawnIntervalSec >= 3.1);
});

test('computeAmmoGaugeState adapts segment layout per weapon, tracks partial rounds, and syncs reload phases', () => {
  // M41-X Rifle (32 mag -> 16 paired round segments)
  const rifleFull = computeAmmoGaugeState({
    ammo: 32,
    mag: 32,
    reloading: false,
    reloadPct: 0,
    reloadPhasePct: 0,
    reloadStageGroup: 'idle',
    reloadEmptyThreshold: 0.42,
    reloadIsTactical: false,
    reloadAccentCss: '#e89b3c',
  });
  assert.equal(rifleFull.segmentCount, 16);
  assert.equal(rifleFull.unitMode, 'rounds');
  assert.equal(rifleFull.status, 'optimal');
  assert.equal(rifleFull.fillPct, 100);
  assert.equal(rifleFull.lowAmmoAlert, false);
  assert.ok(rifleFull.segments.every((s) => s.state === 'filled'));

  // Odd round count (17/32) yields 8 filled + 1 half-filled partial + 7 empty segments & tactical status
  const riflePartial = computeAmmoGaugeState({
    ammo: 17,
    mag: 32,
    reloading: false,
    reloadPct: 0,
    reloadPhasePct: 0,
    reloadStageGroup: 'idle',
    reloadEmptyThreshold: 0.42,
    reloadIsTactical: false,
    reloadAccentCss: '#e89b3c',
  });
  assert.equal(riflePartial.status, 'tactical');
  assert.equal(riflePartial.statusTag, 'TAC-R');
  assert.equal(riflePartial.segments[7].state, 'filled');
  assert.equal(riflePartial.segments[8].state, 'partial');
  assert.equal(riflePartial.segments[8].fill, 0.5);
  assert.equal(riflePartial.segments[9].state, 'empty');

  // DOOM-99 Shotgun (6 mag -> 6 discrete 1:1 shells), low ammo at 1/6
  const shotgunLow = computeAmmoGaugeState({
    ammo: 1,
    mag: 6,
    reloading: false,
    reloadPct: 0,
    reloadPhasePct: 0,
    reloadStageGroup: 'idle',
    reloadEmptyThreshold: 0.4,
    reloadIsTactical: false,
    reloadAccentCss: '#e89b3c',
  });
  assert.equal(shotgunLow.segmentCount, 6);
  assert.equal(shotgunLow.unitMode, 'shells');
  assert.equal(shotgunLow.status, 'low');
  assert.equal(shotgunLow.lowAmmoAlert, true);
  assert.equal(shotgunLow.segments[0].state, 'filled');
  assert.equal(shotgunLow.segments[1].state, 'empty');

  // INFERNO-X Flamethrower (60 mag -> 12 fuel cells), empty critical state
  const flamerEmpty = computeAmmoGaugeState({
    ammo: 0,
    mag: 60,
    reloading: false,
    reloadPct: 0,
    reloadPhasePct: 0,
    reloadStageGroup: 'idle',
    reloadEmptyThreshold: 0.4,
    reloadIsTactical: false,
    reloadAccentCss: '#e89b3c',
  });
  assert.equal(flamerEmpty.segmentCount, 12);
  assert.equal(flamerEmpty.unitMode, 'cells');
  assert.equal(flamerEmpty.status, 'critical');
  assert.equal(flamerEmpty.statusTag, 'EMPTY');
  assert.equal(flamerEmpty.fillPct, 0);
  assert.equal(flamerEmpty.lowAmmoAlert, true);

  // Tactical reload emptying vs loading transitions
  const tacEmptying = computeAmmoGaugeState({
    ammo: 16,
    mag: 32,
    reloading: true,
    reloadPct: 20,
    reloadPhasePct: 50,
    reloadStageGroup: 'emptying',
    reloadEmptyThreshold: 0.4,
    reloadIsTactical: true,
    reloadAccentCss: '#56c2ff',
  });
  assert.equal(tacEmptying.status, 'reloading');
  assert.equal(tacEmptying.statusTag, 'SWAP');
  assert.equal(tacEmptying.fillPct, 25);

  const tacLoading = computeAmmoGaugeState({
    ammo: 16,
    mag: 32,
    reloading: true,
    reloadPct: 70,
    reloadPhasePct: 50,
    reloadStageGroup: 'loading',
    reloadEmptyThreshold: 0.4,
    reloadIsTactical: true,
    reloadAccentCss: '#56c2ff',
  });
  assert.equal(tacLoading.status, 'reloading');
  assert.equal(tacLoading.statusTag, 'TAC');
  assert.equal(tacLoading.fillPct, 50);
});
