import React, { useEffect, useRef, useState } from 'react';
import {
  computeAmmoGaugeState,
  FACTION_META,
  formatClock,
  KILLSTREAK_TARGET,
  WEAPONS,
} from '../game/rules';
import { BodyPart, Faction, HudSnapshot } from '../game/types';
import { HudGlyphIcon, Keycap, ThreatStarRow, WeaponSvgIcon } from './GameUiKit';

const WEAPON_ACCENTS = ['#f5b342', '#f97316', '#38d9ff', '#ff4b36', '#fb923c', '#67e8f9'] as const;

interface GameHudProps {
  hud: HudSnapshot;
  onSelectWeapon: (idx: number) => void;
  onToggleMute: () => void;
  onToggleTts: () => void;
  onPause: () => void;
  onVatsTargetClick: (unitId: number, part: BodyPart) => void;
  onResolveCampaignChoice: (option: 'F' | 'G') => void;
  onSelectAc130Weapon: (idx: 0 | 1 | 2) => void;
  onToggleAc130Thermal: () => void;
}

const CARDINALS: Array<{ deg: number; label: string }> = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' },
];

const COMPASS_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

function shortestAngleDelta(targetDeg: number, currentDeg: number): number {
  let d = ((targetDeg - currentDeg + 540) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

const RADAR_SIZE = 140;
const ARENA_HALF = 58;

function worldToRadar(val: number): number {
  return ((val + ARENA_HALF) / (ARENA_HALF * 2)) * RADAR_SIZE;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onSelectWeapon,
  onToggleMute,
  onToggleTts,
  onPause,
  onVatsTargetClick,
  onResolveCampaignChoice,
  onSelectAc130Weapon,
  onToggleAc130Thermal,
}) => {
  const bloodCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ghostHp, setGhostHp] = useState(100);
  const [hmVisible, setHmVisible] = useState(false);
  const [dmgFlash, setDmgFlash] = useState(false);
  const [dmgArcVisible, setDmgArcVisible] = useState(false);
  const [blastFlash, setBlastFlash] = useState(false);
  const [empFlash, setEmpFlash] = useState(false);
  const [wantedSiren, setWantedSiren] = useState(false);
  const [checkpointVisible, setCheckpointVisible] = useState(false);

  // Delayed trailing damage ghost bar on HP
  useEffect(() => {
    if (hud.hp >= ghostHp) {
      setGhostHp(hud.hp);
      return;
    }
    const timer = window.setTimeout(() => setGhostHp(hud.hp), 300);
    return () => clearTimeout(timer);
  }, [hud.hp, ghostHp]);

  // Hitmarker flash
  useEffect(() => {
    if (hud.hitmarkerSeq === 0) return;
    setHmVisible(true);
    const t = window.setTimeout(() => setHmVisible(false), 120);
    return () => clearTimeout(t);
  }, [hud.hitmarkerSeq]);

  // Damage flash + directional arc
  useEffect(() => {
    if (hud.damageFlashSeq === 0) return;
    setDmgFlash(true);
    setDmgArcVisible(true);
    const t1 = window.setTimeout(() => setDmgFlash(false), 130);
    const t2 = window.setTimeout(() => setDmgArcVisible(false), 480);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hud.damageFlashSeq]);

  // Blast flash
  useEffect(() => {
    if (hud.blastFlashSeq === 0) return;
    setBlastFlash(true);
    const t = window.setTimeout(() => setBlastFlash(false), 180);
    return () => clearTimeout(t);
  }, [hud.blastFlashSeq]);

  // EMP flash
  useEffect(() => {
    if (hud.empFlashSeq === 0) return;
    setEmpFlash(true);
    const t = window.setTimeout(() => setEmpFlash(false), 180);
    return () => clearTimeout(t);
  }, [hud.empFlashSeq]);

  // GTA Wanted Threat Escalation Dispatch Siren Pulse
  useEffect(() => {
    if (hud.wantedFlashSeq === 0) return;
    setWantedSiren(true);
    const t = window.setTimeout(() => setWantedSiren(false), 1800);
    return () => clearTimeout(t);
  }, [hud.wantedFlashSeq]);

  // Subtle Call of Duty Image-3 style top-left "체크포인트 도달" indicator
  useEffect(() => {
    if (hud.checkpointSeq === 0) return;
    setCheckpointVisible(true);
    const t = window.setTimeout(() => setCheckpointVisible(false), 3600);
    return () => clearTimeout(t);
  }, [hud.checkpointSeq]);

  // Paint Low-HP Vignette Canvas once & on resize
  useEffect(() => {
    const drawVignette = () => {
      const c = bloodCanvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const w = c.width;
      const h = c.height;
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.72
      );
      g.addColorStop(0, 'rgba(120,0,10,0)');
      g.addColorStop(0.64, 'rgba(130,8,18,0.22)');
      g.addColorStop(0.88, 'rgba(155,10,20,0.62)');
      g.addColorStop(1, 'rgba(72,4,10,0.84)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    drawVignette();
    window.addEventListener('resize', drawVignette);
    return () => window.removeEventListener('resize', drawVignette);
  }, []);

  const currentWeapon = WEAPONS[hud.weaponIdx] ?? WEAPONS[0];
  const activeWeaponAccent = WEAPON_ACCENTS[hud.weaponIdx] ?? '#f5b342';
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostHpPct = Math.max(0, Math.min(100, (ghostHp / hud.maxHp) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100));

  const ammoGauge = computeAmmoGaugeState({
    ammo: hud.ammo,
    mag: hud.mag,
    reloading: hud.reloading,
    reloadPct: hud.reloadPct,
    reloadPhasePct: hud.reloadPhasePct,
    reloadStageGroup: hud.reloadStageGroup,
    reloadEmptyThreshold: hud.reloadEmptyThreshold,
    reloadIsTactical: hud.reloadIsTactical,
    reloadAccentCss: hud.reloadAccentCss,
  });

  const hideHudForCinematic = hud.cinematic.letterbox;
  const ac130Mode = hud.ac130.active;
  const heliRideMode = hud.heliRide.active;
  const tankDriving = hud.tank.driving;
  const coreHpPct = Math.max(
    0,
    Math.min(100, Math.round((hud.coreHp / Math.max(1, hud.coreMaxHp)) * 100))
  );
  const strikePct = hud.airstrikeReady
    ? 100
    : Math.round((hud.killstreak / Math.max(1, KILLSTREAK_TARGET)) * 100);

  // =========================================================================
  // MISSION 03 STAGE 1 — UH-60K ASSAULT HELICOPTER DOOR-GUNNER HUD
  // =========================================================================
  if (heliRideMode && !hideHudForCinematic) {
    const heatCol = hud.heliRide.minigunOverheated
      ? '#ff3b3b'
      : hud.heliRide.minigunHeatPct > 72
        ? '#f59e0b'
        : '#38d9ff';
    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none select-none font-tactical"
        data-testid="heli-gunner-hud"
      >
        {/* Top-Left Aviation Telemetry (Crisp Glass Badge for readability over bright Neo-Seoul skyline) */}
        <div className="fixed top-5 left-6 px-3.5 py-2.5 rounded-[5px] bg-[#060c16]/72 backdrop-blur-md border border-[#38d9ff]/30 flex flex-col gap-0.5 text-[11px] tracking-[0.15em] text-[#e2ecf8] tabular-nums shadow-lg">
          <div className="font-bold text-[#38d9ff] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38d9ff] animate-pulse" />
            <span>UH-60K SURION // DOOR GUNNER</span>
          </div>
          <div className="text-[#dce6f4]">
            ALT {hud.heliRide.altitudeM}M · SPD {hud.heliRide.speedKts} KTS · PASS {hud.heliRide.progressPct}%
          </div>
          <div className="text-[10px] text-[#f5b342] font-semibold mt-0.5">
            지상 대공·매복 표적 격파: {hud.heliRide.targetsDestroyed} / {hud.heliRide.targetsTotal}
          </div>
        </div>

        {/* Top-Right Pause & Mute */}
        <div className="fixed top-5 right-6 flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="px-2.5 py-1 rounded-[3px] bg-black/55 border border-white/25 text-[10px] text-white cursor-pointer hover:bg-black/80"
          >
            {hud.muted ? 'MUTE' : 'SFX ON'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="px-2.5 py-1 rounded-[3px] bg-black/55 border border-white/25 text-[10px] text-white cursor-pointer hover:bg-black/80"
          >
            [ESC]
          </button>
        </div>

        {/* Subtle Pointer-Lock Hint */}
        {!hud.pointerLocked && (
          <div className="fixed top-[68px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10.5px] text-[#e2ecf8] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38d9ff] animate-pulse" />
            <span>화면 클릭 후 마우스 조준 · 좌클릭 M134 미니건 연속 사격</span>
          </div>
        )}

        {/* Center M134 Rotary Minigun Gunship Reticle + Live Heat Bar */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true">
            <circle cx="60" cy="60" r="34" fill="none" stroke={heatCol} strokeWidth="1.4" strokeDasharray="12 8" opacity="0.88" />
            <line x1="16" y1="60" x2="42" y2="60" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="78" y1="60" x2="104" y2="60" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="60" y1="16" x2="60" y2="42" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="60" y1="78" x2="60" y2="104" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="2.6" fill="#ff6242" />
          </svg>
          <div className="mt-2 w-36 flex flex-col items-center gap-1">
            <div className="w-full h-[5px] bg-black/65 border border-white/20 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-75"
                style={{ width: `${hud.heliRide.minigunHeatPct}%`, backgroundColor: heatCol }}
              />
            </div>
            <span className="text-[9.5px] font-bold tracking-[0.16em] game-text-outline" style={{ color: heatCol }}>
              {hud.heliRide.minigunOverheated
                ? 'OVERHEAT // 배럴 냉각 중'
                : `M134 HEAT ${hud.heliRide.minigunHeatPct}%`}
            </span>
          </div>
        </div>

        {/* Bottom Flight Progress & Controls Legend */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <div className="w-64 h-[4px] bg-black/60 border border-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#38d9ff] transition-all duration-150"
              style={{ width: `${hud.heliRide.progressPct}%` }}
            />
          </div>
          <div className="text-[10px] text-[#dce6f4] tracking-wider game-text-outline">
            [좌클릭] M134 6연장 미니건 · [우클릭] 정밀 조준 · 완료 시 AC-130 FLIR 자동 전환
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MISSION 03 — ICONIC CALL OF DUTY AC-130 THERMAL FLIR GUNSHIP HUD OVERLAY
  // =========================================================================
  if (ac130Mode && !hideHudForCinematic) {
    const isBhot = hud.ac130.thermalMode === 'bhot';
    const inkClass = isBhot ? 'text-[#0b0e14]' : 'text-[#eef2f6]';
    const strokeCol = isBhot ? 'rgba(12, 16, 22, 0.85)' : 'rgba(238, 242, 246, 0.85)';
    const cal = hud.ac130.caliber;

    return (
      <div
        className="fixed inset-0 z-10 pointer-events-none select-none font-tactical"
        data-testid="ac130-flir-hud"
      >
        {/* Subtle top-left Checkpoint stamp if triggered */}
        {checkpointVisible && (
          <div className="fixed top-4 left-5 flex items-center gap-2 text-xs font-semibold tracking-wider text-[#f6e29c] game-text-outline animate-panel-in">
            <span className="w-2 h-2 rotate-45 bg-[#f5b342] shadow-[0_0_8px_#f5b342]" />
            <span>{hud.checkpointLabel || '체크포인트 도달'}</span>
          </div>
        )}

        {/* Top-Left FLIR Sensor Status */}
        <div className={`fixed top-5 left-6 flex flex-col gap-0.5 text-[11px] tracking-[0.16em] tabular-nums ${inkClass} game-text-outline`}>
          <div className="font-bold">AC-130U SPECTRE // ANGEL-01</div>
          <div className="opacity-85">
            FLIR {isBhot ? 'BHOT (흑열)' : 'WHOT (백열)'} · {hud.ac130.zoomed ? 'ZOOM 2.2x' : 'WIDE 1.0x'}
          </div>
          <div className="opacity-75 text-[10px] mt-0.5">{hud.objectiveText}</div>
        </div>

        {/* Top-Right Telemetry & Quick Pause/Mute */}
        <div className="fixed top-5 right-6 flex flex-col items-end gap-2">
          <div className={`text-[11px] tracking-[0.16em] tabular-nums text-right ${inkClass} game-text-outline`}>
            <div>ALT {hud.ac130.altitudeM}M · HDG {String(hud.ac130.headingDeg).padStart(3, '0')}°</div>
            <div className="opacity-80">IR STROBE FRIENDLY SAFE</div>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleAc130Thermal();
              }}
              className="px-2.5 py-1 rounded-[2px] bg-black/55 border border-white/30 text-[10px] text-white cursor-pointer hover:bg-black/80"
            >
              [T] {isBhot ? 'BHOT' : 'WHOT'}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="px-2.5 py-1 rounded-[2px] bg-black/55 border border-white/30 text-[10px] text-white cursor-pointer hover:bg-black/80"
            >
              [ESC]
            </button>
          </div>
        </div>

        {/* Blinking Friendly Ground Squad IR Strobes (DO NOT FIRE!) */}
        {hud.ac130.friendlyStrobes.map((st) => (
          <div
            key={st.id}
            className="fixed -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 pointer-events-none"
            style={{ left: `${st.screenX}px`, top: `${st.screenY}px` }}
          >
            <div className="w-4 h-4 rotate-45 border-[1.8px] border-[#38e8ff] animate-pulse flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white" />
            </div>
            <span className="text-[9px] font-bold tracking-wider text-[#7ee6ff] whitespace-nowrap game-text-outline">
              아군 IR · {st.label}
            </span>
          </div>
        ))}

        {/* Hostile Thermal Heat Signature Boxes */}
        {hud.ac130.hostileMarkers.map((hm) => (
          <div
            key={hm.id}
            className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${hm.screenX}px`, top: `${hm.screenY}px` }}
          >
            <div
              className={`border ${hm.isHeavy ? 'w-7 h-7 border-[1.6px]' : 'w-4 h-4 border-[1.2px]'}`}
              style={{ borderColor: strokeCol }}
            />
          </div>
        ))}

        {/* Center Caliber-Specific AC-130 Ballistic Reticle */}
        <svg
          viewBox="0 0 400 400"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54vmin] h-[54vmin]"
          aria-hidden="true"
        >
          {/* Outer corner viewfinder brackets */}
          <path d="M24 64 V24 H64 M336 24 H376 V64 M24 336 V376 H64 M336 376 H376 V336" fill="none" stroke={strokeCol} strokeWidth="1.5" />
          {cal === '105MM' ? (
            <>
              {/* Giant 105mm M102 Howitzer heavy blast bracket */}
              <rect x="148" y="148" width="104" height="104" fill="none" stroke={strokeCol} strokeWidth="1.8" strokeDasharray="16 12" />
              <line x1="76" y1="200" x2="148" y2="200" stroke={strokeCol} strokeWidth="1.6" />
              <line x1="252" y1="200" x2="324" y2="200" stroke={strokeCol} strokeWidth="1.6" />
              <line x1="200" y1="76" x2="200" y2="148" stroke={strokeCol} strokeWidth="1.6" />
              <line x1="200" y1="252" x2="200" y2="324" stroke={strokeCol} strokeWidth="1.6" />
              <circle cx="200" cy="200" r="3" fill={strokeCol} />
            </>
          ) : cal === '40MM' ? (
            <>
              {/* 40mm Bofors classic mil-dot horizontal/vertical cross */}
              <line x1="108" y1="200" x2="184" y2="200" stroke={strokeCol} strokeWidth="1.5" />
              <line x1="216" y1="200" x2="292" y2="200" stroke={strokeCol} strokeWidth="1.5" />
              <line x1="200" y1="108" x2="200" y2="184" stroke={strokeCol} strokeWidth="1.5" />
              <line x1="200" y1="216" x2="200" y2="292" stroke={strokeCol} strokeWidth="1.5" />
              {[-60, -35, 35, 60].map((d) => (
                <g key={d} stroke={strokeCol} strokeWidth="1.3">
                  <line x1={200 + d} y1="194" x2={200 + d} y2="206" />
                  <line x1="194" y1={200 + d} x2="206" y2={200 + d} />
                </g>
              ))}
              <circle cx="200" cy="200" r="2.2" fill={strokeCol} />
            </>
          ) : (
            <>
              {/* 25mm GAU-12 tight rotary autocannon reticle */}
              <line x1="158" y1="200" x2="192" y2="200" stroke={strokeCol} strokeWidth="1.4" />
              <line x1="208" y1="200" x2="242" y2="200" stroke={strokeCol} strokeWidth="1.4" />
              <line x1="200" y1="158" x2="200" y2="192" stroke={strokeCol} strokeWidth="1.4" />
              <line x1="200" y1="208" x2="200" y2="242" stroke={strokeCol} strokeWidth="1.4" />
              <circle cx="200" cy="200" r="18" fill="none" stroke={strokeCol} strokeWidth="1.2" strokeDasharray="4 4" />
            </>
          )}
        </svg>

        {/* Hitmarker X inside FLIR */}
        <div
          className="fixed top-1/2 left-1/2 w-7 h-7 pointer-events-none transition-opacity duration-75"
          style={{ opacity: hmVisible ? 1 : 0, transform: 'translate(-50%, -50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 w-5 h-[2px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" />
          <div className="absolute top-1/2 left-1/2 w-5 h-[2px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white" />
        </div>

        {/* Bottom-Left Gunship Weapon Selector ([1] 25mm / [2] 40mm / [3] 105mm) */}
        <div className="fixed bottom-6 left-6 flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            {(
              [
                { idx: 0 as const, label: '[1] 25MM', sub: '기관포' },
                { idx: 1 as const, label: '[2] 40MM', sub: '보포스' },
                { idx: 2 as const, label: '[3] 105MM', sub: '곡사포' },
              ] as const
            ).map((w) => {
              const active = hud.ac130.weaponIdx === w.idx;
              return (
                <button
                  key={w.idx}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectAc130Weapon(w.idx);
                  }}
                  className={`px-3 py-1.5 rounded-[2px] border text-left cursor-pointer transition-all ${
                    active
                      ? 'bg-white text-[#07090f] border-white font-extrabold'
                      : 'bg-black/55 text-white/75 border-white/25 hover:border-white/60'
                  }`}
                >
                  <div className="text-[11px] leading-none">{w.label}</div>
                  <div className="text-[9px] opacity-75 mt-0.5 leading-none">{w.sub}</div>
                </button>
              );
            })}
          </div>
          <div className={`flex items-center gap-2 text-[10px] tracking-[0.14em] tabular-nums ${inkClass} game-text-outline`}>
            <span>{hud.ac130.weaponName}</span>
            <span>·</span>
            <span>{hud.ac130.reloadPct >= 100 ? 'READY' : `RELOAD ${hud.ac130.reloadPct}%`}</span>
            <span>·</span>
            <span>좌클릭 발사 · 우클릭 줌 · [T] 열화상 반전</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-10 pointer-events-none transition-opacity duration-500 ${
        hideHudForCinematic ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="combat-hud-root"
    >
      {/* Whisper-subtle atmospheric lens vignette */}
      <div className="fixed inset-0 pointer-events-none cinema-film-grain" aria-hidden="true" />

      {/* Kinetic Speedlines during Exo-Dash / Power Slide */}
      {(hud.isDashing || hud.isSliding) && (
        <div
          className="fixed inset-0 pointer-events-none speedlines-overlay transition-opacity duration-100"
          aria-hidden="true"
        />
      )}

      {/* CoD Last-Stand Adrenaline Overdrive Vignette */}
      {hud.adrenalineActive && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 80px rgba(255, 68, 34, 0.56)',
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(255, 68, 34, 0.2) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* CoD Slow-Mo Kill-Cam Stamp */}
      {hud.killCamActive && hud.killCamBanner && (
        <div className="fixed top-[20%] left-1/2 -translate-x-1/2 pointer-events-none animate-panel-in text-center">
          <div className="font-tactical text-[9.5px] tracking-[0.32em] text-[#ff6242] uppercase game-text-outline">
            CINEMATIC KILL-CAM
          </div>
          <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-[0.14em] text-[#f8fafc] game-text-outline">
            {hud.killCamBanner}
          </div>
        </div>
      )}

      {/* Low-HP Pulsing Blood Vignette */}
      <canvas
        ref={bloodCanvasRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{ opacity: hud.lowHpIntensity }}
      />

      {/* V.A.T.S. Tactical Targeting Tint */}
      {hud.vatsActive && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, rgba(16, 185, 129, 0.05) 42%, rgba(4, 30, 19, 0.48) 100%)',
          }}
        />
      )}

      {/* Edge-weighted Non-Blinding Screen Flashes */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-100"
        style={{
          background:
            'radial-gradient(circle at center, transparent 48%, rgba(190, 20, 30, 0.55) 100%)',
          opacity: dmgFlash ? 0.65 : 0,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          background:
            'radial-gradient(circle at center, transparent 38%, rgba(232, 138, 42, 0.26) 78%, rgba(194, 86, 12, 0.38) 100%)',
          opacity: blastFlash ? 0.56 : 0,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          background:
            'radial-gradient(circle at center, transparent 38%, rgba(56, 217, 255, 0.2) 78%, rgba(14, 116, 144, 0.34) 100%)',
          opacity: empFlash ? 0.54 : 0,
        }}
      />

      {/* GTA Wanted Level Escalation Red/Blue Siren Edge Pulse */}
      {wantedSiren && (
        <div className="fixed inset-0 pointer-events-none animate-gta-siren" aria-hidden="true" />
      )}

      {/* World-Space 3D -> 2D Friendly ROK Squadmate Callsigns (Image 3 style!) */}
      {!hud.vatsActive && hud.squadTags.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {hud.squadTags.map((sq) => (
            <div
              key={sq.id}
              className="fixed -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
              style={{ left: `${sq.screenX}px`, top: `${sq.screenY}px` }}
            >
              <span
                className="font-tactical text-[10px] font-bold tracking-wide whitespace-nowrap game-text-outline"
                style={{
                  color:
                    sq.status === 'wounded'
                      ? '#f5b342'
                      : sq.status === 'ghost'
                        ? '#2dd4bf'
                        : '#5eead4',
                }}
              >
                {sq.name}
                {sq.status === 'wounded' ? ' [부상]' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* World-Space 3D -> 2D Objective, Supply & Turret Waypoints (auto-fade near crosshair) */}
      {!hud.vatsActive && hud.waypoints.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {hud.waypoints.map((wp) => (
            <div
              key={wp.id}
              className="fixed -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 transition-opacity duration-100"
              style={{
                left: `${wp.screenX}px`,
                top: `${wp.screenY}px`,
                opacity: wp.opacity,
              }}
            >
              <div
                className="w-2.5 h-2.5 rotate-45 border-[1.5px] flex items-center justify-center bg-black/55"
                style={{ borderColor: wp.accentCss }}
              >
                <span className="w-1 h-1" style={{ backgroundColor: wp.accentCss }} />
              </div>
              <span className="font-tactical text-[8.5px] font-bold tracking-wider whitespace-nowrap tabular-nums game-text-outline">
                <span style={{ color: wp.accentCss }}>{wp.label}</span>{' '}
                <span className="text-[#f4f6fa]">{wp.distanceM}m</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* RAIL-X9 2.8x Crystal-Clear Transparent Tactical Sniper Optic Lens */}
      {hud.scopedOpticActive && (
        <div
          className="fixed inset-0 pointer-events-none z-15 animate-panel-in"
          data-testid="sniper-optic-overlay"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 0%, transparent 39vmin, rgba(5, 8, 14, 0.35) 41.5vmin, rgba(4, 6, 10, 0.94) 44vmin, rgba(3, 4, 8, 0.98) 100%)',
            }}
          />
          <svg
            viewBox="0 0 800 800"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88vmin] h-[88vmin]"
            aria-hidden="true"
          >
            <circle cx="400" cy="400" r="368" fill="none" stroke="rgba(56, 217, 255, 0.32)" strokeWidth="1.5" />
            <line x1="36" y1="400" x2="380" y2="400" stroke="rgba(218, 242, 255, 0.62)" strokeWidth="1" />
            <line x1="420" y1="400" x2="764" y2="400" stroke="rgba(218, 242, 255, 0.62)" strokeWidth="1" />
            <line x1="400" y1="36" x2="400" y2="380" stroke="rgba(218, 242, 255, 0.62)" strokeWidth="1" />
            <line x1="400" y1="420" x2="400" y2="764" stroke="rgba(218, 242, 255, 0.62)" strokeWidth="1" />
            <line x1="36" y1="400" x2="176" y2="400" stroke="rgba(7, 10, 16, 0.92)" strokeWidth="4" />
            <line x1="624" y1="400" x2="764" y2="400" stroke="rgba(7, 10, 16, 0.92)" strokeWidth="4" />
            <line x1="400" y1="624" x2="400" y2="764" stroke="rgba(7, 10, 16, 0.92)" strokeWidth="4" />
            {[-210, -150, -90, -45, 45, 90, 150, 210].map((d) => (
              <g key={d} stroke="rgba(56, 217, 255, 0.85)" strokeWidth="1.2">
                <line x1={400 + d} y1={393} x2={400 + d} y2={407} />
                <line x1={393} y1={400 + d} x2={407} y2={400 + d} />
              </g>
            ))}
            <circle cx="400" cy="400" r="2.6" fill={hud.aimTarget ? '#ff4422' : '#38d9ff'} />
          </svg>

          <div className="fixed top-1/2 left-[calc(50%-34vmin)] -translate-y-1/2 flex flex-col gap-1 font-tactical text-[10px] tabular-nums game-text-outline">
            <span className="text-[#38d9ff] font-bold tracking-[0.14em]">2.8x OPTIC</span>
            <span className={hud.holdingBreath ? 'text-[#2ee6a6] font-bold' : 'text-[#9aa8bd]'}>
              {hud.holdingBreath ? '호흡 고정됨' : '[SHIFT] 호흡 고정'}
            </span>
            {hud.mounted && (
              <span className="text-[#2ee6a6] font-bold tracking-wider">MOUNTED · 반동 -68%</span>
            )}
            {hud.leanDir !== 0 && (
              <span className="text-[#f5b342] font-bold tracking-wider">
                {hud.leanDir < 0 ? '◀ LEFT PEEK' : 'RIGHT PEEK ▶'}
              </span>
            )}
          </div>

          <div className="fixed top-1/2 right-[calc(50%-34vmin)] -translate-y-1/2 flex flex-col items-end gap-1 font-tactical text-[10px] tabular-nums game-text-outline">
            <span className="text-[#f8fafc] font-bold">
              {hud.aimDistanceM !== null ? `${hud.aimDistanceM.toFixed(1)}m` : '--.-m'}
            </span>
            <span className={hud.aimTarget ? 'text-[#ff6242] font-bold' : 'text-[#7c8ba1]'}>
              {hud.aimTarget ? 'LOCKED' : 'RANGEFINDER'}
            </span>
          </div>
        </div>
      )}

      {/* Directional Damage Arc */}
      <div className="fixed top-1/2 left-1/2 w-[236px] h-[236px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div
          className="absolute inset-0 rounded-full transition-opacity duration-200"
          style={{
            border: '3.5px solid transparent',
            borderTopColor: 'rgba(255, 68, 52, 0.92)',
            transform: `rotate(${hud.damageDirDeg}deg)`,
            opacity: dmgArcVisible ? 1 : 0,
          }}
        />
      </div>

      {/* Subtle Pointer-Lock Click Hint (Frameless Whisper Pill — offsets cleanly below Core/Boss bars!) */}
      {hud.phase === 'playing' && !hud.pointerLocked && !hud.vatsActive && !hud.cinematic.letterbox && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10.5px] font-tactical text-[#e2ecf8] flex items-center gap-2 pointer-events-none ${
            hud.coreShieldDown || hud.bossName ? 'top-[116px]' : 'top-[68px]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#38d9ff] animate-pulse" />
          <span>화면 클릭으로 마우스 조준 활성화</span>
        </div>
      )}

      {/* CoD Frameless Live Target Nameplate & Slim HP Bar */}
      {!hud.vatsActive && hud.aimTarget && (
        <div
          className="fixed top-[42%] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          data-testid="hud-aim-target"
        >
          <div className="flex items-baseline gap-2 text-[10.5px] font-tactical tabular-nums game-text-outline">
            <span className="font-bold" style={{ color: hud.aimTarget.accentCss }}>
              {hud.aimTarget.name}
            </span>
            <span className="text-[#dce4ef] text-[9.5px]">{hud.aimTarget.distanceM}m</span>
          </div>
          <div className="w-36 h-[3.5px] bg-black/55 rounded-full overflow-hidden mt-1">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${hud.aimTarget.hpPct}%`,
                backgroundColor: hud.aimTarget.accentCss,
              }}
            />
          </div>
          {hud.aimTarget.weakpointHint && (
            <span className="mt-0.5 text-[8.5px] font-tactical font-bold tracking-[0.14em] text-[#f6b75e] game-text-outline">
              {hud.aimTarget.weakpointHint}
            </span>
          )}
        </div>
      )}

      {/* Whisper-Light Frameless Rangefinder & MWIII Mount / Q-E Peek Indicator below Reticle */}
      {!hud.vatsActive &&
        !hud.scopedOpticActive &&
        ((hud.adsBlend > 0.65 && (hud.weaponIdx === 0 || hud.weaponIdx === 3 || hud.weaponIdx === 5)) ||
          hud.mounted ||
          hud.leanDir !== 0) && (
          <div className="fixed top-[57.5%] left-1/2 -translate-x-1/2 flex items-center gap-2 font-tactical text-[9.5px] pointer-events-none tabular-nums game-text-outline whitespace-nowrap">
            {hud.leanDir < 0 && <span className="text-[#f5b342] font-bold">◀ PEEK</span>}
            {hud.mounted && (
              <span className="text-[#2ee6a6] font-bold tracking-wider" data-testid="hud-mounted-badge">
                MOUNTED · 반동 -68%
              </span>
            )}
            {hud.adsBlend > 0.65 && (hud.weaponIdx === 0 || hud.weaponIdx === 3 || hud.weaponIdx === 5) && (
              <>
                {hud.mounted && <span className="text-white/30">·</span>}
                <span className="text-[#38d9ff] font-bold">
                  {hud.aimDistanceM !== null ? `${hud.aimDistanceM.toFixed(1)}m` : '--m'}
                </span>
                <span className="text-white/30">·</span>
                <span className={hud.holdingBreath ? 'text-[#2ee6a6] font-bold' : 'text-[#cbd5e1]'}>
                  {hud.holdingBreath ? '호흡 고정' : 'SHIFT 호흡'}
                </span>
              </>
            )}
            {hud.leanDir > 0 && <span className="text-[#f5b342] font-bold">PEEK ▶</span>}
          </div>
        )}

      {/* K2-X Black Panther Tank Gunner Optic Reticle (RMB) & Chase FCS Crosshair */}
      {tankDriving && (
        <div className="fixed inset-0 pointer-events-none" data-testid="tank-fcs-reticle">
          {hud.tank.gunnerOptic && (
            <div
              className="fixed inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, transparent 44%, rgba(4, 16, 20, 0.72) 86%, rgba(2, 8, 12, 0.94) 100%)',
              }}
            />
          )}
          <svg
            viewBox="0 0 400 400"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48vmin] h-[48vmin]"
            aria-hidden="true"
          >
            <path
              d="M34 80 V34 H80 M320 34 H366 V80 M34 320 V366 H80 M320 366 H366 V320"
              fill="none"
              stroke={hud.tank.gunnerOptic ? '#2ee6a6' : '#38d9ff'}
              strokeWidth="1.6"
              opacity={hud.tank.gunnerOptic ? 0.9 : 0.45}
            />
            <line x1="110" y1="200" x2="184" y2="200" stroke="#2ee6a6" strokeWidth="1.6" />
            <line x1="216" y1="200" x2="290" y2="200" stroke="#2ee6a6" strokeWidth="1.6" />
            <line x1="200" y1="138" x2="200" y2="184" stroke="#2ee6a6" strokeWidth="1.6" />
            <line x1="200" y1="216" x2="200" y2="280" stroke="#2ee6a6" strokeWidth="1.5" />
            {/* Ballistic 120mm drop stadia ticks */}
            <line x1="188" y1="232" x2="212" y2="232" stroke="#2ee6a6" strokeWidth="1.3" />
            <line x1="192" y1="252" x2="208" y2="252" stroke="#2ee6a6" strokeWidth="1.2" />
            <circle
              cx="200"
              cy="200"
              r="3.2"
              fill={hud.tank.cannonReloadPct >= 100 ? '#2ee6a6' : '#f59e0b'}
            />
          </svg>
          <div className="fixed top-[57%] left-1/2 -translate-x-1/2 font-tactical text-[10px] tracking-[0.18em] game-text-outline flex items-center gap-2">
            <span className={hud.tank.cannonReloadPct >= 100 ? 'text-[#2ee6a6] font-bold' : 'text-[#f5b342]'}>
              120MM {hud.tank.cannonReloadPct >= 100 ? 'READY' : `LOAD ${hud.tank.cannonReloadPct}%`}
            </span>
            {hud.tank.gunnerOptic && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-[#38d9ff] font-bold">K2-X THERMAL FCS 2.4x</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Weapon-Aware Dynamic Center Reticle (Fades cleanly during transparent 3D scope ADS, K2-X Tank, or uncut 1st-person setpieces) */}
      {!hud.vatsActive && !hud.scopedOpticActive && !hud.firstPersonSetpieceActive && !tankDriving && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-100"
          style={{
            opacity:
              hud.weaponIdx === 0 ||
              hud.weaponIdx === 2 ||
              hud.weaponIdx === 3 ||
              hud.weaponIdx === 5
                ? Math.max(0, 1 - hud.adsBlend * 1.45)
                : hud.weaponIdx === 1
                  ? Math.max(0.25, 1 - hud.adsBlend * 0.75)
                  : 1,
          }}
        >
          {hud.weaponIdx === 1 ? (
            <>
              <div
                className="absolute w-2.5 h-5 border-l-[1.5px] border-t-[1.5px] border-b-[1.5px] border-white/85 -translate-y-1/2"
                style={{ right: `${hud.crosshairGap + 5}px` }}
              />
              <div
                className="absolute w-2.5 h-5 border-r-[1.5px] border-t-[1.5px] border-b-[1.5px] border-white/85 -translate-y-1/2"
                style={{ left: `${hud.crosshairGap + 5}px` }}
              />
              <div className="absolute w-[3px] h-[3px] -left-[1.5px] -top-[1.5px] rounded-full bg-[#f5b342]" />
            </>
          ) : hud.weaponIdx === 2 ? (
            <>
              <div
                className="absolute h-[1.5px] w-4 -top-[0.75px] bg-[#38d9ff]"
                style={{ right: `${Math.max(5, hud.crosshairGap - 4)}px` }}
              />
              <div
                className="absolute h-[1.5px] w-4 -top-[0.75px] bg-[#38d9ff]"
                style={{ left: `${Math.max(5, hud.crosshairGap - 4)}px` }}
              />
              <div className="absolute w-[3.5px] h-[3.5px] -left-[1.75px] -top-[1.75px] rotate-45 bg-[#38d9ff]" />
            </>
          ) : hud.weaponIdx === 3 ? (
            <>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff6242]/80"
                style={{
                  width: `${20 + hud.crosshairGap}px`,
                  height: `${20 + hud.crosshairGap}px`,
                }}
              />
              <div className="absolute w-[3px] h-[3px] -left-[1.5px] -top-[1.5px] rounded-full bg-[#ff4b36]" />
            </>
          ) : hud.weaponIdx === 4 ? (
            <>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#fb923c]/75"
                style={{
                  width: `${26 + hud.crosshairGap}px`,
                  height: `${26 + hud.crosshairGap}px`,
                }}
              />
              <div className="absolute w-[3px] h-[3px] -left-[1.5px] -top-[1.5px] rounded-full bg-[#fb923c]" />
            </>
          ) : hud.weaponIdx === 5 ? (
            <svg width="38" height="38" viewBox="0 0 38 38" className="absolute -left-[19px] -top-[19px]" aria-hidden="true">
              <circle
                cx="19"
                cy="19"
                r={Math.min(15, 9 + hud.crosshairGap * 0.3)}
                fill="none"
                stroke="#67e8f9"
                strokeWidth="1.2"
                strokeDasharray="5 5"
              />
              <circle cx="19" cy="19" r="1.8" fill="#e0f2fe" />
            </svg>
          ) : (
            <>
              <div
                className="absolute w-[1.5px] h-[7px] -left-[0.75px] bg-white/90"
                style={{ bottom: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute w-[1.5px] h-[7px] -left-[0.75px] bg-white/90"
                style={{ top: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute h-[1.5px] w-[7px] -top-[0.75px] bg-white/90"
                style={{ right: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute h-[1.5px] w-[7px] -top-[0.75px] bg-white/90"
                style={{ left: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.85)' }}
              />
              <div className="absolute w-[2.5px] h-[2.5px] -left-[1.25px] -top-[1.25px] rounded-full bg-[#f5b342]" />
            </>
          )}
        </div>
      )}

      {/* Hitmarker X */}
      <div
        className="fixed top-1/2 left-1/2 w-6 h-6 pointer-events-none transition-all duration-75"
        style={{
          opacity: hmVisible ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${hud.hitmarkerCrit ? 1.25 : 1.0})`,
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 w-4 h-[1.8px] -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ backgroundColor: hud.hitmarkerCrit ? '#ff4422' : '#f8fafc' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-4 h-[1.8px] -translate-x-1/2 -translate-y-1/2 -rotate-45"
          style={{ backgroundColor: hud.hitmarkerCrit ? '#ff4422' : '#f8fafc' }}
        />
      </div>

      {/* Floating 3D -> 2D Damage & Crit Numbers */}
      {hud.floatingDamages.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {hud.floatingDamages.map((fd) => (
            <div
              key={fd.id}
              className="fixed -translate-x-1/2 -translate-y-1/2 flex flex-col items-center leading-none"
              style={{
                left: `${fd.screenX}px`,
                top: `${fd.screenY}px`,
                opacity: fd.opacity,
              }}
            >
              <span
                className={`font-display font-bold tracking-tight tabular-nums ${
                  fd.isCrit ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'
                }`}
                style={{
                  color: fd.color,
                  textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                }}
              >
                {fd.text}
              </span>
              {fd.subLabel && (
                <span className="text-[9.5px] font-tactical font-semibold tracking-wider uppercase mt-0.5 whitespace-nowrap text-[#f6b75e] game-text-outline">
                  {fd.subLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ultra-Slim Frameless Reload Progress Strip (No giant 3-row box!) */}
      {!hud.vatsActive && hud.reloading && (
        <div
          className="fixed top-[54.8%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none"
          data-testid="hud-reload-bar"
          data-reload-phase={hud.reloadPhase}
          data-reload-stage={hud.reloadStageGroup}
          data-reload-tactical={hud.reloadIsTactical ? 'true' : 'false'}
        >
          <div className="w-[148px] h-[3.5px] bg-black/60 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${hud.reloadPct}%`,
                backgroundColor: hud.reloadIsTactical ? '#38d9ff' : hud.reloadAccentCss,
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-[9.5px] font-tactical font-bold tracking-wider whitespace-nowrap game-text-outline tabular-nums">
            <span style={{ color: hud.reloadIsTactical ? '#38d9ff' : '#f5b342' }}>
              {hud.reloadIsTactical ? `전술 재장전 -${hud.reloadSpeedBonusPct}%` : hud.reloadPhaseLabel}
            </span>
            <span className="text-[#f8fafc]">{hud.reloadPct}%</span>
          </div>
        </div>
      )}

      {!hud.vatsActive && !hud.reloading && hud.ammo <= Math.max(1, Math.floor(hud.mag * 0.25)) && (
        <div className="fixed top-[55%] left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-[10px] font-tactical font-bold text-[#f6b75e] tracking-wider whitespace-nowrap pointer-events-none game-text-outline">
          <Keycap size="xs" tone="amber">
            R
          </Keycap>
          <span>{hud.ammo > 0 ? '전술 재장전' : '재장전'}</span>
        </div>
      )}

      {/* V.A.T.S. 3D -> 2D Clickable Target Boxes */}
      {hud.vatsActive && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          <div className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#061811]/82 backdrop-blur-md border border-[#2ee6a6]/45 text-[#a7f3d0] font-tactical text-xs tracking-wider">
            V.A.T.S. (0.1x) · 적 부위 클릭 확정 파괴 [Q 종료]
          </div>
          {hud.vatsTargets.map((t) => (
            <button
              key={`${t.unitId}-${t.part}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onVatsTargetClick(t.unitId, t.part);
              }}
              className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-[4px] bg-[#061811]/88 backdrop-blur-sm border border-[#2ee6a6]/65 hover:border-[#f5b342] text-left cursor-pointer transition-colors min-w-[128px]"
              style={{ left: `${t.screenX}px`, top: `${t.screenY}px` }}
            >
              <div className="text-[9.5px] font-tactical text-[#6ee7b7] leading-tight tabular-nums">
                {t.unitName} · {t.distance}m
              </div>
              <div className="text-xs font-bold text-white flex items-center justify-between gap-3 mt-0.5">
                <span>{t.partLabel}</span>
                <span className="text-[#f6b75e] font-tactical tabular-nums">{t.multiplier.toFixed(1)}x</span>
              </div>
              <div className="text-[9.5px] font-tactical text-[#2ee6a6] mt-0.5 tabular-nums">
                명중 {t.hitChance}% · HP {t.hpPct}%
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Frameless Contextual Action Prompts */}
      {hud.calloutText && (
        <div
          className="fixed top-[59%] left-1/2 -translate-x-1/2 font-display font-bold tracking-wider text-sm sm:text-base text-center whitespace-nowrap game-text-outline"
          style={{ color: hud.calloutColor }}
        >
          {hud.calloutText}
        </div>
      )}

      {/* Mission 02 Euljiro C4 Blast Door Breach Prompt */}
      {hud.breachPromptVisible && !hud.vatsActive && !hud.campaignPrompt && (
        <div
          className="fixed top-[63%] left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#1e1205]/82 backdrop-blur-md border border-[#f5b342]/70 text-white font-semibold text-xs whitespace-nowrap inline-flex items-center gap-2 animate-panel-in"
          data-testid="breach-door-prompt"
        >
          <Keycap size="xs" tone="amber">
            F
          </Keycap>
          <span>C4 부착 · 슬로모션(0.2x) 방폭문 브리칭</span>
        </div>
      )}

      {/* Non-Blocking Diegetic Field Choice Bar (Mission 02 Survivor/Ghost-9 & Mission 04 Sergeant So Rescue Crisis) */}
      {hud.campaignPrompt && !hud.vatsActive && (
        <div
          className="fixed bottom-[17%] left-1/2 -translate-x-1/2 w-[min(92vw,560px)] px-4 py-3 rounded-[4px] bg-[#06090f]/82 backdrop-blur-md border-l-2 border-l-[#f5b342] pointer-events-auto animate-panel-in"
          data-testid="campaign-choice-prompt"
        >
          <div className="flex items-center justify-between gap-2 text-[10px] font-tactical font-bold tracking-[0.16em] text-[#f5b342] uppercase">
            <span>{hud.campaignPrompt.title}</span>
            {hud.campaignPrompt.remainingSec !== null && (
              <span className="text-[#ff523b] tabular-nums">
                {hud.campaignPrompt.remainingSec}s
              </span>
            )}
          </div>
          <p className="text-xs text-[#e2e8f0] mt-1 mb-2.5 leading-snug break-keep">
            {hud.campaignPrompt.subtitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="campaign-choice-f"
              onClick={(e) => {
                e.currentTarget.blur();
                onResolveCampaignChoice('F');
              }}
              className="px-3 py-2 rounded-[3px] bg-[#0b2a22]/85 hover:bg-[#0f3d30] border border-[#2ee6a6]/65 text-left text-[11px] font-semibold text-[#e6fff6] cursor-pointer transition-colors"
            >
              {hud.campaignPrompt.optionFLabel}
            </button>
            <button
              type="button"
              data-testid="campaign-choice-g"
              onClick={(e) => {
                e.currentTarget.blur();
                onResolveCampaignChoice('G');
              }}
              className="px-3 py-2 rounded-[3px] bg-[#2a120b]/85 hover:bg-[#3f1a0f] border border-[#ff6242]/65 text-left text-[11px] font-semibold text-[#ffece6] cursor-pointer transition-colors"
            >
              {hud.campaignPrompt.optionGLabel}
            </button>
          </div>
        </div>
      )}

      {hud.tank.nearPrompt && !tankDriving && !hud.vatsActive && !hud.campaignPrompt && (
        <div
          className="fixed top-[56.5%] left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#071824]/90 backdrop-blur-md border border-[#38d9ff]/80 text-white font-semibold text-xs sm:text-sm whitespace-nowrap inline-flex items-center gap-2.5 shadow-[0_8px_28px_rgba(56,217,255,0.32)] animate-panel-in"
          data-testid="tank-board-prompt"
        >
          <Keycap size="xs" tone="cyan">
            F
          </Keycap>
          <span>K2-X 흑표 주력전차 탑승 · 120mm 주포 + 동축 12.7mm</span>
        </div>
      )}

      {hud.nearHackableTurretName && !hud.vatsActive && !hud.campaignPrompt && !hud.breachPromptVisible && !hud.tank.nearPrompt && (
        <div
          className="fixed top-[64%] left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#061818]/78 backdrop-blur-md border border-[#2dd4bf]/55 text-white font-semibold text-xs whitespace-nowrap inline-flex items-center gap-2 animate-panel-in"
          data-testid="turret-hack-prompt"
        >
          <Keycap size="xs" tone="emerald">
            F
          </Keycap>
          <span>{hud.nearHackableTurretName} 해킹</span>
        </div>
      )}

      {hud.gloryKillTargetName && !hud.nearHackableTurretName && !hud.vatsActive && (
        <div className="fixed top-[64%] left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#2b0c10]/80 backdrop-blur-md border border-[#ff4422]/60 text-white font-semibold text-xs whitespace-nowrap inline-flex items-center gap-2 animate-panel-in">
          <Keycap size="xs" tone="signal">
            E
          </Keycap>
          <span>글로리 킬 · {hud.gloryKillTargetName}</span>
        </div>
      )}

      {hud.canShutdownCore && !hud.vatsActive && !hud.serverShutdownActive && (
        <div
          className="fixed top-[69%] left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#061626]/82 backdrop-blur-md border border-[#38d9ff]/65 text-white font-semibold text-xs sm:text-sm whitespace-nowrap inline-flex items-center gap-2 animate-panel-in"
          data-testid="core-shutdown-prompt"
        >
          <Keycap size="xs" tone="cyan">
            F
          </Keycap>
          <span>OMNI-CORE 심장부 접속 · 제로 아워 결단</span>
        </div>
      )}

      {/* =====================================================================
          TOP LEFT — IMAGE-3 SUBTLE "체크포인트 도달" + FRAMELESS MISSION OBJECTIVE
          ===================================================================== */}
      <div className="fixed top-4 left-5 max-w-[280px] flex flex-col gap-2">
        {/* Image-3 Homage Subtle Top-Left Checkpoint Indicator */}
        {checkpointVisible && (
          <div
            className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#f6e8b8] game-text-outline animate-panel-in"
            data-testid="hud-checkpoint-toast"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-[#f5b342] shrink-0" fill="currentColor" aria-hidden="true">
              <polygon points="10,1 13,7 19,10 13,13 10,19 7,13 1,10 7,7" />
            </svg>
            <span>{hud.checkpointLabel || '체크포인트 도달'}</span>
          </div>
        )}

        <div className="pl-3 border-l-2 border-l-[#f5b342]">
          <div className="flex items-center gap-2 text-[10px] font-tactical tracking-[0.14em] uppercase game-text-outline">
            <span className="text-[#f5b342] font-bold">
              {hud.gameMode === 'freeroam' ? 'FREE ROAM' : hud.missionTitle}
            </span>
            <span className="text-white/35">·</span>
            <span className="text-[#e2e8f0] tabular-nums">{hud.objectiveProgressPct}%</span>
          </div>
          <div className="text-xs sm:text-[13px] font-semibold text-[#f8fafc] mt-0.5 leading-snug break-keep game-text-outline">
            {hud.objectiveText}
          </div>
          {hud.gameMode === 'freeroam' && (
            <div className="mt-1.5 flex items-center gap-2.5 text-[10px] font-tactical text-[#cbd5e1] tabular-nums game-text-outline">
              <span>
                기록 <b className="text-[#f6b75e]">{hud.holotapesFound}/{hud.holotapesTotal}</b>
              </span>
              <span>
                포탑 <b className="text-[#2dd4bf]">{hud.turretsHacked}/{hud.turretsTotal}</b>
              </span>
            </div>
          )}
        </div>

        {/* Frameless Combo Style & Overdrive Momentum */}
        {(hud.comboCount > 0 || hud.overdriveTimer > 0) && (
          <div className="pl-3 border-l-2 border-l-[#ff4422] animate-panel-in">
            {hud.comboCount > 0 && (
              <div className="flex items-baseline gap-2 game-text-outline">
                <span className="font-display text-2xl font-extrabold leading-none text-[#ff6242]">
                  {hud.styleGrade}
                </span>
                <span className="font-display text-base font-bold text-[#f6b75e] tabular-nums">
                  {hud.comboCount}x
                </span>
                <span className="font-tactical text-[9.5px] tracking-[0.12em] text-[#e2e8f0]">
                  {hud.styleLabel}
                </span>
              </div>
            )}
            {hud.comboCount > 0 && (
              <div className="w-32 h-[2px] bg-white/15 mt-1 overflow-hidden">
                <div className="h-full bg-[#ff4422] transition-all duration-100" style={{ width: `${hud.comboTimerPct}%` }} />
              </div>
            )}
            {hud.overdriveTimer > 0 && (
              <div className="mt-1 text-[10px] font-tactical font-bold text-[#2ee6a6] tabular-nums game-text-outline">
                OVERDRIVE 1.4x · {hud.overdriveTimer.toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          TOP CENTER — PUBG / CoD COMPLETELY FRAMELESS COMPASS TAPE (Zero Box!)
          ===================================================================== */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        <div
          className="relative w-[300px] sm:w-[400px] h-7 overflow-hidden"
          style={{
            maskImage: 'linear-gradient(90deg, transparent 0%, black 14%, black 86%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 14%, black 86%, transparent 100%)',
          }}
          aria-label="전술 나침반"
        >
          {/* Center tiny amber indicator triangle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#f5b342]" />

          {/* Crisp PUBG-style degree hairline ticks */}
          {COMPASS_TICKS.map((deg) => {
            const delta = shortestAngleDelta(deg, hud.playerYawDeg);
            if (Math.abs(delta) > 85) return null;
            const leftPct = 50 + (delta / 85) * 48;
            const isMajor = deg % 45 === 0;
            return (
              <span
                key={deg}
                className="absolute bottom-1.5 -translate-x-1/2 bg-white/45"
                style={{
                  left: `${leftPct}%`,
                  width: '1px',
                  height: isMajor ? '5px' : '3px',
                }}
              />
            );
          })}

          {CARDINALS.map((c) => {
            const delta = shortestAngleDelta(c.deg, hud.playerYawDeg);
            if (Math.abs(delta) > 85) return null;
            const leftPct = 50 + (delta / 85) * 48;
            const isMain = c.label.length === 1;
            return (
              <span
                key={c.label}
                className={`absolute top-1.5 -translate-x-1/2 font-tactical game-text-outline ${
                  isMain ? 'text-[11px] text-[#ffffff] font-bold' : 'text-[9px] text-[#cbd5e1] font-medium'
                }`}
                style={{ left: `${leftPct}%` }}
              >
                {c.label}
              </span>
            );
          })}

          {hud.compassContacts.map((ct) => {
            if (Math.abs(ct.relativeDeg) > 85) return null;
            const leftPct = 50 + (ct.relativeDeg / 85) * 48;
            const color = ct.isServerCore
              ? '#38d9ff'
              : ct.isRelay
                ? '#ff4b36'
                : ct.isTurret
                  ? '#2dd4bf'
                  : ct.isSupply
                    ? '#2ee6a6'
                    : ct.isHolotape
                      ? '#f5b342'
                      : ct.isBoss
                        ? '#f5b342'
                        : ct.faction === Faction.RAIDER
                          ? '#f59e0b'
                          : ct.faction === Faction.SYNDICATE
                            ? '#7aa2f7'
                            : '#f87171';
            const isDiamond =
              Boolean(ct.isServerCore) ||
              Boolean(ct.isRelay) ||
              Boolean(ct.isTurret) ||
              Boolean(ct.isSupply) ||
              ct.isBoss ||
              Boolean(ct.isHolotape);
            const sizePx = ct.isServerCore || ct.isBoss ? '6.5px' : ct.isRelay ? '6px' : '4.5px';
            return (
              <span
                key={ct.id}
                className="absolute bottom-0.5 -translate-x-1/2"
                style={{
                  left: `${leftPct}%`,
                  width: sizePx,
                  height: sizePx,
                  backgroundColor: color,
                  transform: isDiamond ? 'translateX(-50%) rotate(45deg)' : 'translateX(-50%)',
                }}
              />
            );
          })}
        </div>

        {/* Whisper-Minimal Telemetry Line */}
        <div
          className="flex items-center gap-2.5 font-tactical text-[10px] tracking-[0.14em] text-[#e2e8f0] tabular-nums game-text-outline"
          data-testid="hud-topbar"
        >
          <span className="text-[#f5b342] font-bold">
            {hud.gameMode === 'campaign'
              ? `MISSION 0${hud.missionId}`
              : `WAVE ${String(hud.wave).padStart(2, '0')}`}
          </span>
          <span className="text-white/30">·</span>
          <span>{formatClock(hud.survivalTime)}</span>
        </div>

        {hud.coreShieldDown && !hud.serverShutdownActive && (
          <div className="w-64 sm:w-80 mt-0.5" data-testid="hud-core-hp">
            <div className="flex justify-between text-[9.5px] font-tactical font-bold text-[#fde6b8] mb-0.5 tabular-nums game-text-outline">
              <span>OMNI-CORE MAINFRAME</span>
              <span>{coreHpPct}%</span>
            </div>
            <div className="w-full h-[4px] bg-black/60 rounded-full overflow-hidden">
              <div className="h-full bg-[#f5b342] transition-all duration-150" style={{ width: `${coreHpPct}%` }} />
            </div>
          </div>
        )}

        {hud.bossName && (
          <div className="w-64 sm:w-80 mt-0.5">
            <div className="flex justify-between items-center text-[9.5px] font-tactical font-bold text-[#fecaca] mb-0.5 tabular-nums game-text-outline">
              <span>
                BOSS · {hud.bossName} {hud.bossPhase >= 2 ? '· PHASE 2' : ''}
              </span>
              <span>{hud.bossHpPct}%</span>
            </div>
            <div className="w-full h-[4px] bg-black/60 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${hud.bossHpPct}%`,
                  backgroundColor: hud.bossPhase >= 2 ? '#ff6242' : '#ff3b3b',
                }}
              />
            </div>
          </div>
        )}

        {hud.alertBanner && (
          <div className="px-3 py-1 rounded-full bg-[#380b0e]/82 border border-[#ff4422]/65 text-white font-semibold text-xs tracking-wide animate-alert-banner">
            {hud.alertBanner}
          </div>
        )}

        {/* CoD Compact Combat Medal Popups (offset cleanly below pointer-lock hint so they never collide!) */}
        {hud.medals.length > 0 && (
          <div
            className={`flex items-center justify-center gap-3 pointer-events-none ${
              !hud.pointerLocked ? 'mt-9' : 'mt-1.5'
            }`}
          >
            {hud.medals.slice(0, 2).map((m) => (
              <div key={m.id} className="text-center animate-medal-pop game-text-outline">
                <div
                  className="font-display text-base font-extrabold tracking-[0.14em] leading-none uppercase"
                  style={{ color: m.accentCss }}
                >
                  {m.title}
                </div>
                <div className="text-[9px] font-tactical text-[#e2e8f0] whitespace-nowrap">
                  {m.subtitle}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================================
          TOP RIGHT — PUBG Clean Kill/Threat Pill + Sleek Translucent Square Radar
          ===================================================================== */}
      <div className="fixed top-4 right-5 flex flex-col items-end gap-2">
        {/* PUBG-Inspired Compact Score + Threat Stars + Unobtrusive Utility Icons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-black/55 backdrop-blur-sm rounded-[3px] overflow-hidden border border-white/[0.1] text-[11px] font-tactical tabular-nums">
            <span className="px-2 py-1 bg-white/[0.92] text-[#07090f] font-extrabold leading-none">
              {hud.kills}
            </span>
            <span className="px-2 py-1 text-[#dce4ef] text-[10px] leading-none">처치</span>
          </div>

          <div
            className="flex items-center px-2 py-1 rounded-[3px] bg-black/50 backdrop-blur-sm border border-white/[0.08]"
            data-testid="hud-threat-stars"
            title={`OMNI 위협 등급 ★${hud.threatLevel} (${hud.threatLabel})`}
          >
            <ThreatStarRow level={hud.threatLevel} />
          </div>

          <div className="flex items-center gap-1 opacity-65 hover:opacity-100 transition-opacity">
            <button
              type="button"
              tabIndex={-1}
              aria-label={hud.muted ? '음소거 해제' : '음소거'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-7 h-7 rounded-[3px] bg-black/45 hover:bg-black/75 border border-white/10 text-[#dce4ef] flex items-center justify-center cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.18" />
                {hud.muted ? (
                  <>
                    <line x1="21" y1="9" x2="15" y2="15" stroke="#ff4b36" />
                    <line x1="15" y1="9" x2="21" y2="15" stroke="#ff4b36" />
                  </>
                ) : (
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                )}
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="일시정지"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-7 h-7 rounded-[3px] bg-black/45 hover:bg-black/75 border border-white/10 text-[#dce4ef] flex items-center justify-center cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <rect x="6.5" y="5" width="3.2" height="14" rx="1" />
                <rect x="14.3" y="5" width="3.2" height="14" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clean Translucent Minimal Square Radar (PUBG / CoD Style — Zero Bulky Plastic Frame) */}
        <div
          className="relative w-[118px] h-[118px] rounded-[3px] overflow-hidden bg-[#05080f]/58 backdrop-blur-sm border transition-colors duration-300"
          style={{
            borderColor: hud.threatLevel >= 4 ? 'rgba(255, 68, 34, 0.6)' : 'rgba(255, 255, 255, 0.14)',
          }}
          data-testid="hud-minimap"
          aria-label="실시간 전술 레이더"
        >
          <svg viewBox="0 0 140 140" className="w-full h-full block">
            <line x1="70" y1="0" x2="70" y2="140" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />
            <line x1="0" y1="70" x2="140" y2="70" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />

            {hud.minimapWalls.map((w, idx) => {
              const x1 = worldToRadar(w.minX);
              const x2 = worldToRadar(w.maxX);
              const y1 = worldToRadar(w.minZ);
              const y2 = worldToRadar(w.maxZ);
              const fill =
                w.kind === 'citadel'
                  ? hud.coreShieldDown
                    ? 'rgba(14, 78, 118, 0.8)'
                    : 'rgba(92, 22, 30, 0.8)'
                  : 'rgba(30, 41, 59, 0.72)';
              const stroke =
                w.kind === 'citadel'
                  ? hud.coreShieldDown
                    ? '#38d9ff'
                    : '#ff4b36'
                  : 'rgba(148,163,184,0.22)';
              return (
                <rect
                  key={idx}
                  x={x1}
                  y={y1}
                  width={Math.max(1.8, x2 - x1)}
                  height={Math.max(1.8, y2 - y1)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={w.kind === 'citadel' ? 1 : 0.45}
                />
              );
            })}

            {hud.minimapDots.map((dot) => {
              const dx = worldToRadar(dot.x);
              const dy = worldToRadar(dot.z);
              const dotKey = `${dot.kind}-${dot.id}`;
              if (dot.kind === 'core') {
                const col = hud.coreShieldDown ? '#38d9ff' : '#ff4b36';
                return (
                  <g key={dotKey} transform={`translate(${dx}, ${dy})`}>
                    <polygon points="0,-4.5 3.9,-2.2 3.9,2.2 0,4.5 -3.9,2.2 -3.9,-2.2" fill={col} />
                  </g>
                );
              }
              if (dot.kind === 'relay') {
                return (
                  <g key={dotKey} transform={`translate(${dx}, ${dy})`}>
                    <rect x="-2.4" y="-2.4" width="4.8" height="4.8" transform="rotate(45)" fill="#ff4b36" />
                  </g>
                );
              }
              if (dot.kind === 'holotape') {
                return <circle key={dotKey} cx={dx} cy={dy} r="2.1" fill="#f5b342" />;
              }
              if (dot.kind === 'turret') {
                return (
                  <polygon
                    key={dotKey}
                    points={`${dx},${dy - 2.8} ${dx + 2.6},${dy + 2.2} ${dx - 2.6},${dy + 2.2}`}
                    fill="#2dd4bf"
                  />
                );
              }
              if (dot.kind === 'supply') {
                return <rect key={dotKey} x={dx - 2.2} y={dy - 2.2} width="4.4" height="4.4" fill="#2ee6a6" />;
              }
              const isBossDot = dot.kind === 'boss';
              const eColor = isBossDot
                ? '#f5b342'
                : dot.kind === 'raider'
                  ? '#f59e0b'
                  : dot.kind === 'syndicate'
                    ? '#7aa2f7'
                    : '#ff5c5c';
              return <circle key={dotKey} cx={dx} cy={dy} r={isBossDot ? 3.2 : 2.1} fill={eColor} />;
            })}

            {(() => {
              const px = worldToRadar(hud.playerX);
              const py = worldToRadar(hud.playerZ);
              return (
                <g transform={`translate(${px}, ${py}) rotate(${hud.playerYawDeg})`}>
                  <polygon points="0,0 -9,-19 9,-19" fill="#38d9ff" fillOpacity="0.18" />
                  <polygon points="0,-4.8 3.4,3.4 0,1.4 -3.4,3.4" fill="#ffffff" />
                </g>
              );
            })()}
          </svg>
          <span className="absolute bottom-1 right-1.5 text-[8.5px] font-tactical font-bold text-[#f5b342] tabular-nums game-text-outline">
            {hud.coreDistance}m
          </span>
        </div>

        {/* Pure Frameless Killfeed */}
        <div className="flex flex-col items-end gap-0.5 max-w-[280px]">
          {hud.killFeed.slice(0, 3).map((item) => {
            const kMeta = FACTION_META[item.killerFaction] ?? FACTION_META[-1];
            const vMeta = FACTION_META[item.victimFaction] ?? FACTION_META[3];
            return (
              <div
                key={item.id}
                className="text-[10px] font-medium whitespace-nowrap animate-kf-slide game-text-outline"
              >
                <span style={{ color: kMeta.cssColor }}>{item.killerName}</span>
                <span className="mx-1.5 font-tactical text-[#94a3b8] text-[9px]">[{item.tag}]</span>
                <span style={{ color: vMeta.cssColor }}>{item.victimName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          BOTTOM LEFT — K2-X TANK ARMOR & HULL/TURRET DIAGRAM vs SOLO OPERATOR VITALS
          ===================================================================== */}
      {tankDriving ? (
        <div
          className="fixed bottom-5 left-6 flex items-center gap-3.5 px-3.5 py-2.5 rounded-[5px] bg-[#060d17]/76 backdrop-blur-md border border-[#38d9ff]/30 shadow-[0_12px_32px_rgba(0,0,0,0.65)] font-tactical"
          data-testid="tank-hull-hud"
        >
          {/* Battlefield-style Live Top-Down Hull vs Independent 360° Turret SVG Diagram */}
          <div className="w-16 h-16 rounded-[4px] bg-[#06111a]/75 backdrop-blur-sm border border-[#38d9ff]/45 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="w-14 h-14" aria-hidden="true">
              {/* Armored K2 Hull + Tracks (fixed upright representing tank chassis forward) */}
              <rect x="17" y="16" width="6" height="32" rx="1.5" fill="#475569" />
              <rect x="41" y="16" width="6" height="32" rx="1.5" fill="#475569" />
              <rect x="23" y="18" width="18" height="28" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
              <polygon points="32,12 27,18 37,18" fill="#38d9ff" opacity="0.7" />
              {/* Independent Rotating Turret + 120mm Barrel */}
              <g transform={`rotate(${hud.tank.turretRelativeDeg} 32 32)`}>
                <line x1="32" y1="30" x2="32" y2="6" stroke="#2ee6a6" strokeWidth="2.4" strokeLinecap="round" />
                <polygon points="32,20 24,29 26,41 38,41 40,29" fill="#2ee6a6" fillOpacity="0.32" stroke="#2ee6a6" strokeWidth="1.3" />
              </g>
            </svg>
          </div>

          <div className="w-[210px] flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold text-[#2ee6a6] leading-none game-text-outline">
                  {hud.tank.hp}
                </span>
                <span className="text-[10px] text-white/60 game-text-outline">/ {hud.tank.maxHp}</span>
              </div>
              <span className="text-xs font-bold text-[#38d9ff] game-text-outline">
                {hud.tank.speedKmh} KM/H
              </span>
            </div>
            <div className="w-full h-[6px] bg-black/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2ee6a6] transition-all duration-100"
                style={{ width: `${Math.round((hud.tank.hp / Math.max(1, hud.tank.maxHp)) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-[9.5px] text-[#dce6f4] game-text-outline pt-0.5">
              <span>[H] 수리 ({hud.armorPlates})</span>
              <span className="text-white/30">·</span>
              <span className={hud.tank.apsReady ? 'text-[#38d9ff] font-bold' : 'text-white/45'}>
                [B] IR연막 {hud.tank.apsReady ? 'RDY' : 'CD'}
              </span>
              <span className="text-white/30">·</span>
              <span className="text-[#f5b342] font-bold">[F] 하차</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-5 left-6 w-[216px] flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between tabular-nums">
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-display text-5xl font-extrabold leading-none game-text-outline"
                style={{ color: hud.hp < 40 ? '#ff4b36' : '#ffffff' }}
                data-testid="hud-hp"
              >
                {hud.hp}
              </span>
              <span className="font-tactical text-[10px] text-white/55 game-text-outline">
                / {hud.maxHp}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[#38d9ff] game-text-outline">
              <HudGlyphIcon kind="armor" size={12} />
              <span className="font-display text-2xl font-bold leading-none">{hud.armor}</span>
            </div>
          </div>

          {/* Overwatch-style Crisp Segmented Health Bar */}
          <div className="relative w-full h-[7px] flex gap-[2px]">
            {Array.from({ length: 10 }).map((_, i) => {
              const segStart = i * 10;
              const fill = Math.max(0, Math.min(100, ((hpPct - segStart) / 10) * 100));
              const ghostFill = Math.max(0, Math.min(100, ((ghostHpPct - segStart) / 10) * 100));
              return (
                <div
                  key={i}
                  className="relative flex-1 h-full bg-black/50 overflow-hidden"
                  style={{ transform: 'skewX(-14deg)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#f59e0b]/80 transition-all duration-300"
                    style={{ width: `${ghostFill}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-75"
                    style={{
                      width: `${fill}%`,
                      backgroundColor: hud.hp < 40 ? '#ff4422' : '#f8fafc',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Slim Cyan Armor Bar */}
          <div className="w-full h-[3px] bg-black/45 overflow-hidden" style={{ transform: 'skewX(-14deg)' }}>
            <div className="h-full bg-[#38d9ff] transition-all duration-100" style={{ width: `${armorPct}%` }} />
          </div>

          {/* Minimal Exo-Dash [C] Pips */}
          <div className="flex items-center gap-2 pt-0.5">
            <Keycap size="xs" tone="cyan">
              C
            </Keycap>
            <div className="flex items-center gap-1.5 flex-1">
              {Array.from({ length: hud.dashMaxCharges }).map((_, idx) => {
                const filled = idx < hud.dashCharges;
                const charging = idx === hud.dashCharges;
                return (
                  <div
                    key={idx}
                    className="h-[4px] w-11 bg-black/45 overflow-hidden"
                    style={{ transform: 'skewX(-14deg)' }}
                  >
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: filled ? '100%' : charging ? `${hud.dashChargePct}%` : '0%',
                        backgroundColor: filled ? '#38d9ff' : 'rgba(56, 217, 255, 0.45)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-[9px] font-tactical text-white/65 tracking-wider game-text-outline">
              {hud.isSliding ? 'SLIDE' : 'DASH'}
            </span>
          </div>

          {/* Warzone Ceramic Armor Plate [H] + M18 Tactical Smoke [B] */}
          <div className="flex items-center gap-2 pt-1 text-[9.5px] font-tactical">
            <div className="flex items-center gap-1 text-[#38d9ff] game-text-outline">
              <Keycap size="xs" tone="cyan">
                H
              </Keycap>
              <span>방탄판 {hud.armorPlates}/{hud.maxArmorPlates}</span>
            </div>
            <div className="flex items-center gap-1 text-[#cbd5e1] game-text-outline">
              <Keycap size="xs">B</Keycap>
              <span>연막 {hud.smokeGrenades}</span>
            </div>
            {hud.inSmokeCover && (
              <span className="px-1.5 py-0.5 rounded-[2px] bg-[#64748b]/45 border border-white/25 text-[8.5px] text-white font-bold">
                연막 은폐
              </span>
            )}
          </div>
          {hud.platingActive && (
            <div className="w-full flex flex-col gap-0.5 pt-0.5">
              <div className="flex justify-between text-[9px] font-tactical text-[#38d9ff] game-text-outline">
                <span>방탄판 교체 중...</span>
                <span>{hud.platingPct}%</span>
              </div>
              <div className="w-full h-[3px] bg-black/55 overflow-hidden">
                <div
                  className="h-full bg-[#38d9ff] transition-all duration-75"
                  style={{ width: `${hud.platingPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          BOTTOM RIGHT — K2-X 120MM/COAX WEAPONS vs SOLO OPERATOR ARSENAL
          ===================================================================== */}
      {tankDriving ? (
        <div
          className="fixed bottom-5 right-6 flex flex-col items-end gap-2 px-3.5 py-2.5 rounded-[5px] bg-[#060d17]/76 backdrop-blur-md border border-[#38d9ff]/30 shadow-[0_12px_32px_rgba(0,0,0,0.65)] font-tactical"
          data-testid="tank-weapon-hud"
        >
          <div className="text-[10px] font-bold tracking-[0.18em] text-[#38d9ff] game-text-outline">
            ROK K2-X BLACK PANTHER // MBT
          </div>
          <div className="flex flex-col items-end gap-1 w-52">
            <div className="w-full flex justify-between text-[10.5px] game-text-outline">
              <span className="text-[#f8fafc] font-bold">[LMB] 120MM L/55 주포</span>
              <span className={hud.tank.cannonReloadPct >= 100 ? 'text-[#2ee6a6] font-bold' : 'text-[#f5b342]'}>
                {hud.tank.cannonReloadPct >= 100 ? 'READY' : `${hud.tank.cannonReloadPct}%`}
              </span>
            </div>
            <div className="w-full h-[5px] bg-black/60 overflow-hidden" style={{ transform: 'skewX(-14deg)' }}>
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${hud.tank.cannonReloadPct}%`,
                  backgroundColor: hud.tank.cannonReloadPct >= 100 ? '#2ee6a6' : '#f5b342',
                }}
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 w-52">
            <div className="w-full flex justify-between text-[10px] game-text-outline">
              <span className="text-[#dce6f4]">[SPACE] 12.7MM 동축 기관총</span>
              <span className={hud.tank.coaxHeatPct > 75 ? 'text-[#ff4b36] font-bold' : 'text-[#38d9ff]'}>
                HEAT {hud.tank.coaxHeatPct}%
              </span>
            </div>
            <div className="w-full h-[4px] bg-black/60 overflow-hidden" style={{ transform: 'skewX(-14deg)' }}>
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${hud.tank.coaxHeatPct}%`,
                  backgroundColor: hud.tank.coaxHeatPct > 75 ? '#ff4b36' : '#38d9ff',
                }}
              />
            </div>
          </div>
          <div className="text-[9.5px] text-white/75 game-text-outline">
            [WASD] 차체 주행 · [마우스] 360° 포탑 · [RMB] 열화상 조준경
          </div>
        </div>
      ) : (
        <div className="fixed bottom-5 right-6 flex flex-col items-end gap-2.5">
        {/* Row 1: Compact Overwatch Ability Icon Squares ([Q] [V] [X] [G]) */}
        <div className="flex items-center gap-2">
          {[
            {
              key: 'Q',
              label: 'VATS',
              pct: hud.vatsEnergy,
              ready: hud.vatsActive || hud.vatsEnergy >= 18,
              active: hud.vatsActive,
              color: '#2ee6a6',
              value: `${hud.vatsEnergy}%`,
            },
            {
              key: 'V',
              label: '보급',
              pct: hud.supplyDropCooldownPct,
              ready: hud.supplyDropReady,
              active: hud.supplyDropReady,
              color: '#2dd4bf',
              value: hud.supplyDropReady ? 'RDY' : `${hud.supplyDropCooldownPct}%`,
            },
            {
              key: 'X',
              label: '폭격',
              pct: strikePct,
              ready: hud.airstrikeReady,
              active: hud.airstrikeReady,
              color: '#f5b342',
              value: hud.airstrikeReady ? 'RDY' : `${hud.killstreak}/${KILLSTREAK_TARGET}`,
            },
            {
              key: 'G',
              label: 'EMP',
              pct: Math.min(100, (hud.grenades / 3) * 100),
              ready: hud.grenades > 0,
              active: false,
              color: '#38d9ff',
              value: `x${hud.grenades}`,
            },
          ].map((ab) => (
            <div key={ab.key} className="flex flex-col items-center gap-1">
              <div
                className={`relative w-10 h-9 rounded-[4px] overflow-hidden bg-black/50 backdrop-blur-sm border flex flex-col items-center justify-center transition-all ${
                  ab.active ? 'animate-ready-pulse' : ''
                }`}
                style={{
                  borderColor: ab.ready ? `${ab.color}88` : 'rgba(255,255,255,0.14)',
                }}
              >
                <div
                  className="absolute bottom-0 inset-x-0 transition-all duration-150"
                  style={{
                    height: `${ab.pct}%`,
                    backgroundColor: `${ab.color}24`,
                  }}
                />
                <span
                  className="relative z-10 text-[9px] font-tactical font-bold leading-none"
                  style={{ color: ab.ready ? ab.color : '#94a3b8' }}
                >
                  {ab.label}
                </span>
                <span className="relative z-10 text-[8.5px] font-tactical text-[#f1f5f9] leading-none mt-1 tabular-nums">
                  {ab.value}
                </span>
              </div>
              <Keycap size="xs">{ab.key}</Keycap>
            </div>
          ))}
        </div>

        {/* Row 2: Frameless CoD / Overwatch Giant Hero Ammo Readout */}
        <div className="flex flex-col items-end" data-testid="hud-ammo">
          <span className="text-[10.5px] font-tactical font-semibold tracking-wider text-white/75 game-text-outline">
            {currentWeapon.name}
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums leading-none mt-0.5">
            {hud.reloading ? (
              <span
                className="font-display text-4xl font-extrabold game-text-outline"
                style={{ color: hud.reloadIsTactical ? '#38d9ff' : hud.reloadAccentCss }}
              >
                {hud.reloadPct}%
              </span>
            ) : (
              <>
                <span
                  className="font-display text-5xl font-extrabold game-text-outline transition-colors"
                  style={{ color: ammoGauge.lowAmmoAlert ? '#ff4b36' : '#ffffff' }}
                >
                  {hud.ammo}
                </span>
                <span className="font-display text-xl font-semibold text-white/50 game-text-outline">
                  / {hud.mag}
                </span>
              </>
            )}
          </div>
          {/* Razor-thin 3px weapon-colored ammo bar */}
          <div
            className="w-44 h-[3px] bg-black/50 mt-1.5 overflow-hidden"
            style={{ transform: 'skewX(-14deg)' }}
            data-testid="hud-ammo-gauge"
            data-ammo-status={ammoGauge.status}
            data-ammo-pct={ammoGauge.fillPct}
          >
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${ammoGauge.fillPct}%`,
                backgroundColor: ammoGauge.lowAmmoAlert ? '#ff4b36' : activeWeaponAccent,
              }}
            />
          </div>
        </div>

        {/* Row 3: Whisper-Minimal Frameless 6-Weapon Micro Selector */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {WEAPONS.map((w, idx) => {
            const active = hud.weaponIdx === idx;
            const accent = WEAPON_ACCENTS[idx] ?? '#f5b342';
            return (
              <button
                key={w.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(idx);
                }}
                title={`[${w.slotKey}] ${w.name}`}
                className={`relative flex flex-col items-center px-1.5 py-1 transition-all duration-150 cursor-pointer ${
                  active ? 'opacity-100 -translate-y-0.5' : 'opacity-42 hover:opacity-85'
                }`}
              >
                <WeaponSvgIcon weaponIdx={idx} accent={active ? accent : '#cbd5e1'} active={active} />
                <span
                  className="text-[8.5px] font-tactical font-bold leading-none mt-0.5 tabular-nums game-text-outline"
                  style={{ color: active ? accent : '#cbd5e1' }}
                >
                  {w.slotKey}
                </span>
                <span
                  className="mt-1 w-full h-[2px] rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: accent,
                    opacity: active ? 1 : 0,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};
