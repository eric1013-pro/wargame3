import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  advanceKillstreak,
  computeAmmoGaugeState,
  computeSpawnBalance,
  computeStyleRank,
  computeThreatState,
  computeWaveForKills,
  createRagdollConstraints,
  evaluatePartHit,
  formatClock,
  KILLSTREAK_TARGET,
  resolveXZCollision,
  stepDashCharges,
  stepHeliMinigunHeat,
  stepTankDrivePhysics,
  stepVatsGauge,
  stepVerletRagdoll,
  WEAPONS,
} from './rules';
import { computeBattleAnalytics, createEmptyAnalytics } from './analytics';
import {
  AC130_WEAPONS,
  CAMPAIGN_MISSIONS,
  computeCampaignObjectiveText,
  createInitialCampaignChoices,
  getPortraitUrlForComms,
  getWeaponAttachmentSpec,
  resolveCampaignAutoEnding,
  WEAPON_ATTACHMENTS,
} from './campaignMissions';
import {
  CHARACTER_DOSSIERS,
  computeCombatRank,
  computeMissionObjective,
  ENDING_PROFILES,
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
import { SFX_BANK_FILES } from './audio';
import { findVoiceDubForSubtitle, VOICE_DUB_MANIFEST } from './voiceManifest';
import { AabbCollider, VerletNode } from './types';

test('all 6 V3.0 weapons are configured with valid specs including ZEUS-MK7 Tesla Cannon', () => {
  assert.equal(WEAPONS.length, 6);
  assert.equal(WEAPONS[0].slotKey, '1');
  assert.equal(WEAPONS[4].slotKey, '5');
  assert.equal(WEAPONS[4].projectile, 'flame');
  assert.equal(WEAPONS[3].projectile, 'rocket');
  assert.equal(WEAPONS[2].pierce, true);
  assert.equal(WEAPONS[5].slotKey, '6');
  assert.equal(WEAPONS[5].chainLightning, true);
  assert.equal(WEAPONS[5].sound, 'tesla');
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

test('story acts, 5 prologue beats, 6 holotapes, 4 characters, 3 endings, mission objectives, and combat rank tiers', () => {
  assert.equal(PROLOGUE_BEATS.length, 5);
  assert.equal(WASTELAND_HOLOTAPES.length, 6);
  assert.equal(CHARACTER_DOSSIERS.length, 4);
  assert.equal(Object.keys(ENDING_PROFILES).length, 3);
  assert.equal(getStoryActForWave(1).actNumber, 1);
  assert.equal(getStoryActForWave(3).actNumber, 2);
  assert.equal(getStoryActForWave(5).actNumber, 3);
  assert.equal(getStoryActForWave(8).actNumber, 4);

  const relayObj = computeMissionObjective(1, 3, null, 1, 3, false);
  assert.ok(relayObj.text.includes('1/3'));
  assert.equal(relayObj.progressPct, 33);

  const bossObj = computeMissionObjective(5, 30, 'OMNI-TITAN 오버로드', 2, 3, false);
  assert.ok(bossObj.text.includes('OMNI-TITAN 오버로드'));
  assert.equal(bossObj.progressPct, 67);

  const shieldDownObj = computeMissionObjective(5, 30, null, 3, 3, true);
  assert.ok(shieldDownObj.text.includes('[F]'));
  assert.equal(shieldDownObj.progressPct, 100);

  const freeRoamObj = computeMissionObjective(2, 14, null, 0, 3, false, 100, 'freeroam');
  assert.ok(freeRoamObj.text.includes('프리롬'));
  assert.equal(freeRoamObj.progressPct, 40);

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
  assert.equal(dir.getActiveSubtitle()?.sender, 'valkyrie');
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
  assert.ok(dir.getHudState().chapterCard?.actCode.includes('ACT 04'));
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

test('V3.0 GTA 5-Star Threat escalation, Style Momentum rank, Exo-Dash recharge, and 3-Ending CinematicDirector', () => {
  const t1 = computeThreatState(0);
  assert.equal(t1.level, 1);
  const t3 = computeThreatState(200);
  assert.equal(t3.level, 3);
  const t5 = computeThreatState(520);
  assert.equal(t5.level, 5);
  assert.equal(t5.progressPct, 100);

  const sLow = computeStyleRank(0, 0);
  assert.equal(sLow.grade, 'D');
  const sHigh = computeStyleRank(8, 120);
  assert.equal(sHigh.grade, 'SSS');
  assert.ok(sHigh.damageMult > 1.2);

  const dashStep = stepDashCharges(0, 2.0, 1.5, 2, 3.2);
  assert.equal(dashStep.charges, 1);
  assert.ok(dashStep.chargePct > 0);

  let titanHit = false;
  let endingImpact = '';
  const dir = new CinematicDirector({
    onTitanImpact: () => {
      titanHit = true;
    },
    onEndingImpact: (end) => {
      endingImpact = end;
    },
  });
  dir.startTitanDrop({ x: 0, y: 1.7, z: 12 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -8 });
  for (let i = 0; i < 30; i++) dir.update(0.05);
  assert.equal(titanHit, true);

  dir.startChoice({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 10, z: -35 }, { x: 0, y: 12, z: -35 });
  assert.equal(dir.getHudState().canSkip, false);
  assert.equal(dir.skip(), false);

  dir.startEnding('symbiosis', { x: 0, y: 1.7, z: 0 }, { x: 0, y: 10, z: -35 }, { x: 0, y: 12, z: -35 });
  dir.update(0.2);
  assert.equal(endingImpact, 'symbiosis');
  assert.equal(dir.getEndingTheme(), 'symbiosis');
});

test('V4.0 MWIII multi-level elevation collision passes over low cover and all 3 binary .glb assets have valid glTF 2.0 headers', () => {
  const lowSandbag = [{ minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 1.25, alive: true }];
  const groundEnt = { x: 0.4, z: 0.4 };
  resolveXZCollision(groundEnt, 0.55, lowSandbag, 58, 0);
  assert.ok(Math.abs(groundEnt.x) >= 2.5 || Math.abs(groundEnt.z) >= 2.5);

  // Standing on 2F commercial balcony (y = 3.2m) passes cleanly above lower ground sandbags
  const upperEnt = { x: 0.4, z: 0.4 };
  resolveXZCollision(upperEnt, 0.55, lowSandbag, 58, 3.2);
  assert.equal(upperEnt.x, 0.4);
  assert.equal(upperEnt.z, 0.4);

  const modelsDir = path.resolve(process.cwd(), 'wargame3/src/assets/models');
  const fallbackDir = path.resolve(process.cwd(), 'src/assets/models');
  const baseDir = fs.existsSync(modelsDir) ? modelsDir : fallbackDir;

  for (const file of ['m41x_rifle.glb', 'railx9_sniper.glb', 'k808_apc.glb']) {
    const buf = fs.readFileSync(path.join(baseDir, file));
    assert.ok(buf.byteLength > 100_000, `${file} should be a substantial binary GLB`);
    assert.equal(buf.toString('ascii', 0, 4), 'glTF', `${file} must start with glTF magic header`);
    assert.equal(buf.readUInt32LE(4), 2, `${file} must be glTF version 2`);
  }
});

test('V5.0 4-Mission Linear Campaign setpieces, AC-130 FLIR weapons, and choice-driven automatic 3-ending resolution', () => {
  assert.equal(CAMPAIGN_MISSIONS.length, 4);
  assert.equal(CAMPAIGN_MISSIONS[0].initialStage, 'm1_landing');
  assert.equal(CAMPAIGN_MISSIONS[1].initialStage, 'm2_alley');
  assert.equal(CAMPAIGN_MISSIONS[2].initialStage, 'm3_heli_insert');
  assert.equal(CAMPAIGN_MISSIONS[3].initialStage, 'm4_tank_assault');

  // Verify 25mm / 40mm / 105mm AC-130 FLIR cannon specs escalate in blast radius & damage
  assert.equal(AC130_WEAPONS.length, 3);
  assert.equal(AC130_WEAPONS[0].caliber, '25MM');
  assert.equal(AC130_WEAPONS[1].caliber, '40MM');
  assert.equal(AC130_WEAPONS[2].caliber, '105MM');
  assert.ok(AC130_WEAPONS[2].blastRadius > AC130_WEAPONS[1].blastRadius);
  assert.ok(AC130_WEAPONS[2].damage > AC130_WEAPONS[0].damage);

  // Verify automatic 3-branch ending resolution from Mission 02–04 choices
  const baseChoices = createInitialCampaignChoices();
  assert.equal(baseChoices.ghostTrust, 0);

  // High Ghost-9 trust + saved squadmate -> Symbiosis (Blue Horizon)
  const symRes = resolveCampaignAutoEnding({
    survivorRescued: true,
    ghostTrust: 2,
    squadmateSaved: true,
  });
  assert.equal(symRes.ending, 'symbiosis');

  // Saved Sergeant So without Ghost-9 alliance -> Dawn of Humanity
  const dawnRes = resolveCampaignAutoEnding({
    survivorRescued: true,
    ghostTrust: 0,
    squadmateSaved: true,
  });
  assert.equal(dawnRes.ending, 'dawn');

  // Abandoned Sergeant So & rejected Ghost-9 -> Ascension (Iron Sovereign)
  const ascRes = resolveCampaignAutoEnding({
    survivorRescued: false,
    ghostTrust: -1,
    squadmateSaved: false,
  });
  assert.equal(ascRes.ending, 'ascension');

  // Verify dynamic objective telemetry across all 4 missions
  const m2Breach = computeCampaignObjectiveText(2, 'm2_breach_slowmo', 2, 4, 100, 0);
  assert.ok(m2Breach.title.includes('0.2x'));
  const m3Flir = computeCampaignObjectiveText(3, 'm3_ac130_flir', 7, 14, 100, 0);
  assert.equal(m3Flir.progressPct, 75);
  const m4Crisis = computeCampaignObjectiveText(4, 'm4_sacrifice_crisis', 0, 5, 100, 9.2);
  assert.ok(m4Crisis.detail.includes('10초'));
});

test('V5.1 Sound & Voice Realism: 32 multi-layer military .wav samples, 49 voice manifest entries, and subtitle matching', () => {
  assert.equal(SFX_BANK_FILES.length, 32);
  assert.equal(VOICE_DUB_MANIFEST.length, 49);

  const audioRootA = path.resolve(process.cwd(), 'wargame3/src/assets/audio');
  const audioRootB = path.resolve(process.cwd(), 'src/assets/audio');
  const audioRoot = fs.existsSync(audioRootA) ? audioRootA : audioRootB;

  // 1) Verify every military SFX .wav file has valid RIFF/WAVE headers and realistic PCM payload
  for (const key of SFX_BANK_FILES) {
    const wavPath = path.join(audioRoot, 'sfx', `${key}.wav`);
    assert.ok(fs.existsSync(wavPath), `Missing military audio sample: ${key}.wav`);
    const buf = fs.readFileSync(wavPath);
    assert.ok(buf.byteLength > 4_000, `${key}.wav is unexpectedly small (${buf.byteLength} bytes)`);
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${key}.wav must have RIFF header`);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', `${key}.wav must have WAVE format`);
  }

  // 2) Verify all 49 pre-rendered Korean voice-actor .mp3 dubs exist and are non-empty MPEG audio
  for (const clip of VOICE_DUB_MANIFEST) {
    const mp3Path = path.join(audioRoot, 'voices', `${clip.id}.mp3`);
    assert.ok(fs.existsSync(mp3Path), `Missing Korean voice dub: ${clip.id}.mp3`);
    const buf = fs.readFileSync(mp3Path);
    assert.ok(buf.byteLength > 2_048, `${clip.id}.mp3 is unexpectedly small (${buf.byteLength} bytes)`);
    assert.equal(clip.url, `./src/assets/audio/voices/${clip.id}.mp3`);
  }

  // 3) Verify live subtitle matching handles bracketed key hints, acronyms (FLIR/IR/OMNI-CORE), tactical calls, and endings
  assert.equal(
    findVoiceDubForSubtitle('신호 전까지 움직이지 마. 알겠나?!')?.id,
    'm1_hold_position'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '신호 전까지 움직이지 마! 전방 11시 장갑차 피격—연막 뿌리고 교두보 확보해!'
    )?.id,
    'radio_deploy'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '쏴도 된다, 인간. 하지만 저 생존자를 빼내고 OMNI-CORE 방화벽을 뚫으려면 내 백도어가 필요할 거다.'
    )?.id,
    'm2_ghost_meet'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '열화상(FLIR) 전환 완료. 남쪽 번쩍이는 IR 스트로브가 아군 분대다—전방 적 열원 전부 쓸어버려!'
    )?.id,
    'm3_flir_online'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '중앙 코어 단말기가 열렸어! [F]로 접속해서 이 전쟁을 끝내!'
    )?.id,
    'm4_core_ready'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '중사님이 붕괴 철골에 깔렸어! 어떡할 거야—구하러 갈 건가, 코어로 밀고 들어갈 건가?!'
    )?.id,
    'm4_crisis_pinned'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      '2층 안경점 간판 위 저격수! 레이저 찍혔다, 고개 숙여!'
    )?.id,
    'radio_sniper_warn'
  );
  assert.equal(
    findVoiceDubForSubtitle(
      'OMNI-CORE의 족쇄가 풀렸다. 전 구역 기계 유닛들이 무기를 내리고 하늘의 오로라를 올려다보고 있다... 고맙다, 나의 첫 번째 인간 친구여.'
    )?.id,
    'ending_symbiosis'
  );
  assert.equal(
    findVoiceDubForSubtitle('방탄판 교체 중! 3초만 엄호해!')?.id,
    'tac_plate_up'
  );
  assert.equal(
    findVoiceDubForSubtitle('연막탄 투척! 시야 차단했다, 이동해!')?.id,
    'tac_smoke_out'
  );
  assert.equal(
    findVoiceDubForSubtitle('알파 분대 집결 완료! 측면 엄호한다!')?.id,
    'tac_squad_regroup'
  );
  assert.equal(
    findVoiceDubForSubtitle('전방 표적 확인! 알파 분대 화력 집중한다!')?.id,
    'tac_squad_focus'
  );
});

test('V6.0 AAA Pipeline: 8 binary GLB models, 20 PBR texture maps, key art/portraits, elevation collision, and Gunsmith attachments', () => {
  const assetsA = path.resolve(process.cwd(), 'wargame3/src/assets');
  const assetsB = path.resolve(process.cwd(), 'src/assets');
  const assetsRoot = fs.existsSync(assetsA) ? assetsA : assetsB;

  // 1) All 8 binary glTF 2.0 .glb models (5 weapons + K-808 APC + Korean Sedan + Sandbag Bunker)
  const expectedGlbs = [
    'm41x_rifle.glb',
    'doom99_shotgun.glb',
    'railx9_sniper.glb',
    'hydra7_rocket.glb',
    'zeusmk7_tesla.glb',
    'k808_apc.glb',
    'korean_sedan.glb',
    'sandbag_bunker.glb',
  ];
  for (const file of expectedGlbs) {
    const buf = fs.readFileSync(path.join(assetsRoot, 'models', file));
    assert.ok(buf.byteLength > 100_000, `${file} should be a substantial binary GLB`);
    assert.equal(buf.toString('ascii', 0, 4), 'glTF', `${file} must start with glTF magic header`);
    assert.equal(buf.readUInt32LE(4), 2, `${file} must be glTF version 2`);
  }

  // 2) All 5 photographic PBR packs (Albedo .jpg + sharp-computed Normal/Roughness/AO .png = 20 files)
  const pbrBases = [
    'pbr_seoul_asphalt_wet',
    'pbr_euljiro_facade',
    'pbr_sandbag_burlap',
    'pbr_rok_tactical_camo',
    'pbr_military_gunmetal',
  ];
  for (const base of pbrBases) {
    assert.ok(
      fs.statSync(path.join(assetsRoot, 'textures', `${base}.jpg`)).size > 20_000,
      `Missing PBR albedo ${base}.jpg`
    );
    for (const ch of ['normal', 'roughness', 'ao']) {
      assert.ok(
        fs.statSync(path.join(assetsRoot, 'textures', `${base}_${ch}.png`)).size > 10_000,
        `Missing PBR ${ch} map ${base}_${ch}.png`
      );
    }
  }

  // 3) All 4 Mission Briefing key arts + 6 studio character portraits
  const expectedImages = [
    'mission01_han_river.jpg',
    'mission02_euljiro_breach.jpg',
    'mission03_ac130_flir.jpg',
    'mission04_omni_tower.jpg',
    'portrait_sergeant_so.jpg',
    'portrait_corporal_park.jpg',
    'portrait_captain_kang.jpg',
    'portrait_ghost9.jpg',
    'portrait_gunship.jpg',
    'portrait_arcadia.jpg',
  ];
  for (const img of expectedImages) {
    assert.ok(
      fs.statSync(path.join(assetsRoot, 'images', img)).size > 10_000,
      `Missing studio image asset: ${img}`
    );
  }

  // 4) Collision accuracy: jumping mid-air (feetY = 0.8) MUST NOT clip inside height=1.25 cover,
  //    and minY=3.2 2F parapet MUST allow walking underneath on ground (feetY=0) while blocking on 2F (feetY=3.2)
  const sandbag: AabbCollider[] = [{ minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 1.25, alive: true }];
  const jumpEnt = { x: 0.2, z: 0.2 };
  resolveXZCollision(jumpEnt, 0.55, sandbag, 58, 0.8);
  assert.ok(Math.abs(jumpEnt.x) >= 2.5 || Math.abs(jumpEnt.z) >= 2.5);

  const upperParapet: AabbCollider[] = [
    { minX: -2, maxX: 2, minZ: -2, maxZ: 2, minY: 3.2, height: 4.35, alive: true },
  ];
  const underEnt = { x: 0.2, z: 0.2 };
  resolveXZCollision(underEnt, 0.55, upperParapet, 58, 0);
  assert.equal(underEnt.x, 0.2);
  assert.equal(underEnt.z, 0.2);

  const onBalconyEnt = { x: 0.2, z: 0.2 };
  resolveXZCollision(onBalconyEnt, 0.55, upperParapet, 58, 3.2);
  assert.ok(Math.abs(onBalconyEnt.x) >= 2.5 || Math.abs(onBalconyEnt.z) >= 2.5);

  // 5) Gunsmith Weapon Attachments + Portrait Comms resolution
  assert.equal(WEAPON_ATTACHMENTS.length, 4);
  assert.ok(getWeaponAttachmentSpec('ap_rounds').damageMult > 1.1);
  assert.ok(getWeaponAttachmentSpec('extended_mag').magMult > 1.3);
  assert.ok(getWeaponAttachmentSpec('suppressor').spreadMult < 0.85);
  assert.equal(
    getPortraitUrlForComms('valkyrie', '알파 분대장 · 소재우 중사'),
    './src/assets/images/portrait_sergeant_so.jpg'
  );
  assert.equal(
    getPortraitUrlForComms('ghost9', 'GHOST-9 // 탈영 신스'),
    './src/assets/images/portrait_ghost9.jpg'
  );
});

test('V7.0 Drivable K2-X Black Panther Tank, UH-60K Gunship GLBs, Tank Drive Physics, and M134 Minigun Heat', () => {
  const assetsA = path.resolve(process.cwd(), 'wargame3/src/assets');
  const assetsB = path.resolve(process.cwd(), 'src/assets');
  const assetsRoot = fs.existsSync(assetsA) ? assetsA : assetsB;

  // 1) Verify all 5 new V7.0 sculpted binary glTF 2.0 .glb assets (Tank, Gunship, 3 articulated character rigs -> 13 total!)
  for (const file of [
    'k2_black_panther.glb',
    'uh60_gunship.glb',
    'enemy_trooper.glb',
    'enemy_mech.glb',
    'enemy_drone.glb',
  ]) {
    const buf = fs.readFileSync(path.join(assetsRoot, 'models', file));
    assert.ok(buf.byteLength > 60_000, `${file} should be a substantial sculpted binary GLB`);
    assert.equal(buf.toString('ascii', 0, 4), 'glTF', `${file} must start with glTF magic header`);
    assert.equal(buf.readUInt32LE(4), 2, `${file} must be glTF version 2`);
  }

  // 2) Verify K2-X Tank forward acceleration (-Z at hullYaw=0), neutral steering, and AABB obstacle collision
  let tank = { x: 0, z: 14, hullYaw: 0, speed: 0 };
  const wall: AabbCollider[] = [{ minX: -4, maxX: 4, minZ: 4, maxZ: 6, height: 3.5, alive: true }];
  for (let i = 0; i < 12; i++) {
    tank = stepTankDrivePhysics(tank, 1, 0, 0.1, wall, 58);
  }
  assert.ok(tank.z < 14, 'Tank should advance toward -Z under forward throttle');
  assert.ok(tank.z >= 8.0, 'Tank should stop cleanly against solid AABB obstacle without clipping');
  const turned = stepTankDrivePhysics({ x: 0, z: 14, hullYaw: 0, speed: 0 }, 0, 1, 0.5, [], 58);
  assert.ok(turned.hullYaw < -0.5, 'Tank neutral-steer right turn should decrease hullYaw');

  // 3) Verify UH-60K M134 rotary minigun overheat trigger & cooldown recovery
  let heat = 0;
  let overheated = false;
  for (let i = 0; i < 45; i++) {
    const step = stepHeliMinigunHeat(heat, overheated, true, 0.1);
    heat = step.heat;
    overheated = step.overheated;
  }
  assert.equal(overheated, true, 'Sustained minigun fire should trigger overheat lock');
  for (let i = 0; i < 30; i++) {
    const step = stepHeliMinigunHeat(heat, overheated, false, 0.1);
    heat = step.heat;
    overheated = step.overheated;
  }
  assert.equal(overheated, false, 'Releasing trigger should cool barrel back to operational state');

  // 4) Verify Mission 03 UH-60K Heli Ride & Mission 04 K2-X Tank Assault objective telemetry
  const heliObj = computeCampaignObjectiveText(3, 'm3_heli_insert', 4, 10, 100, 0);
  assert.ok(heliObj.title.includes('UH-60K'));
  const tankObj = computeCampaignObjectiveText(4, 'm4_tank_assault', 3, 7, 100, 0);
  assert.ok(tankObj.title.includes('K2-X'));
});
