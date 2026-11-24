import React, { useEffect, useRef, useState } from 'react';
import {
  computeAmmoGaugeState,
  FACTION_META,
  formatClock,
  KILLSTREAK_TARGET,
  WEAPONS,
} from '../game/rules';
import { BodyPart, Faction, HudSnapshot } from '../game/types';
import { AmmoDialGauge, AmmoSegmentStrip } from './AmmoGauge';
import { HudGlyphIcon, WeaponSvgIcon } from './GameUiKit';

interface GameHudProps {
  hud: HudSnapshot;
  onSelectWeapon: (idx: number) => void;
  onToggleMute: () => void;
  onToggleTts: () => void;
  onPause: () => void;
  onVatsTargetClick: (unitId: number, part: BodyPart) => void;
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
}) => {
  const bloodCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ghostHp, setGhostHp] = useState(100);
  const [hmVisible, setHmVisible] = useState(false);
  const [dmgFlash, setDmgFlash] = useState(false);
  const [dmgArcVisible, setDmgArcVisible] = useState(false);
  const [blastFlash, setBlastFlash] = useState(false);
  const [empFlash, setEmpFlash] = useState(false);

  // Delayed trailing damage ghost bar on HP
  useEffect(() => {
    if (hud.hp >= ghostHp) {
      setGhostHp(hud.hp);
      return;
    }
    const timer = window.setTimeout(() => setGhostHp(hud.hp), 320);
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
    const t = window.setTimeout(() => setBlastFlash(false), 190);
    return () => clearTimeout(t);
  }, [hud.blastFlashSeq]);

  // EMP flash
  useEffect(() => {
    if (hud.empFlashSeq === 0) return;
    setEmpFlash(true);
    const t = window.setTimeout(() => setEmpFlash(false), 200);
    return () => clearTimeout(t);
  }, [hud.empFlashSeq]);

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
        Math.min(w, h) * 0.28,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.72
      );
      g.addColorStop(0, 'rgba(120,0,10,0)');
      g.addColorStop(0.62, 'rgba(130,8,18,0.26)');
      g.addColorStop(0.88, 'rgba(155,10,20,0.74)');
      g.addColorStop(1, 'rgba(72,4,10,0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    drawVignette();
    window.addEventListener('resize', drawVignette);
    return () => window.removeEventListener('resize', drawVignette);
  }, []);

  // Live ECG Heartbeat waveform synced to player HP
  const hpRef = useRef(hud.hp);
  hpRef.current = hud.hp;
  useEffect(() => {
    let phase = 0;
    const timer = window.setInterval(() => {
      const c = ecgCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const low = hpRef.current < 45;
      phase += low ? 0.14 : 0.065;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = low ? '#dc4c4c' : 'rgba(52, 211, 153, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x < c.width; x += 2) {
        const t = (x / 58 + phase) % 1;
        let y = 9;
        if (t > 0.42 && t < 0.48) y = 2;
        else if (t >= 0.48 && t < 0.54) y = 16;
        else if (t >= 0.54 && t < 0.6) y = 6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }, 55);
    return () => clearInterval(timer);
  }, []);

  const currentWeapon = WEAPONS[hud.weaponIdx] ?? WEAPONS[0];
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostHpPct = Math.max(0, Math.min(100, (ghostHp / hud.maxHp) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100));
  const isEmptyingPhase = hud.reloading && hud.reloadStageGroup === 'emptying';
  const isLoadingPhase = hud.reloading && hud.reloadStageGroup === 'loading';
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
  const emptySplitPct = ammoGauge.emptySplitPct;

  const hideHudForCinematic = hud.cinematic.letterbox;
  const coreHpPct = Math.max(
    0,
    Math.min(100, Math.round((hud.coreHp / Math.max(1, hud.coreMaxHp)) * 100))
  );

  return (
    <div
      className={`fixed inset-0 z-10 pointer-events-none transition-opacity duration-500 ${
        hideHudForCinematic ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="combat-hud-root"
    >
      {/* Subtle atmospheric lens vignette (enhances 3D depth without obscuring action) */}
      <div className="fixed inset-0 pointer-events-none cinema-film-grain" aria-hidden="true" />

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
              'radial-gradient(circle at center, rgba(16, 185, 129, 0.06) 40%, rgba(4, 30, 19, 0.54) 100%)',
          }}
        />
      )}

      {/* Damage, Blast & EMP Screen Flashes */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-100"
        style={{
          background:
            'radial-gradient(circle at center, transparent 38%, rgba(190, 20, 30, 0.72) 100%)',
          opacity: dmgFlash ? 0.85 : 0,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          background:
            'radial-gradient(circle at center, rgba(246, 183, 94, 0.34) 0%, rgba(217, 119, 6, 0.16) 60%, transparent 100%)',
          opacity: blastFlash ? 0.85 : 0,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          background:
            'radial-gradient(circle at center, rgba(86, 194, 255, 0.22) 0%, rgba(14, 116, 144, 0.12) 65%, transparent 100%)',
          opacity: empFlash ? 0.85 : 0,
        }}
      />

      {/* Directional Damage Arc */}
      <div className="fixed top-1/2 left-1/2 w-[256px] h-[256px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div
          className="absolute inset-0 rounded-full transition-opacity duration-200"
          style={{
            border: '4px solid transparent',
            borderTopColor: 'rgba(220, 76, 76, 0.92)',
            transform: `rotate(${hud.damageDirDeg}deg)`,
            opacity: dmgArcVisible ? 1 : 0,
          }}
        />
      </div>

      {/* Weapon-Aware Dynamic Center Reticle */}
      {!hud.vatsActive && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {hud.weaponIdx === 1 ? (
            <>
              <div
                className="absolute w-2.5 h-5 border-l-[1.5px] border-t-[1.5px] border-b-[1.5px] border-white/85 -translate-y-1/2"
                style={{ right: `${hud.crosshairGap + 4}px` }}
              />
              <div
                className="absolute w-2.5 h-5 border-r-[1.5px] border-t-[1.5px] border-b-[1.5px] border-white/85 -translate-y-1/2"
                style={{ left: `${hud.crosshairGap + 4}px` }}
              />
              <div className="absolute w-[3px] h-[3px] -left-[1.5px] -top-[1.5px] rounded-full bg-[#e89b3c]" />
            </>
          ) : hud.weaponIdx === 2 ? (
            <>
              <div
                className="absolute h-[1.5px] w-4 -top-[0.75px] bg-[#56c2ff]"
                style={{ right: `${Math.max(4, hud.crosshairGap - 4)}px` }}
              />
              <div
                className="absolute h-[1.5px] w-4 -top-[0.75px] bg-[#56c2ff]"
                style={{ left: `${Math.max(4, hud.crosshairGap - 4)}px` }}
              />
              <div
                className="absolute w-[1.5px] h-2.5 -left-[0.75px] bg-white/80"
                style={{ bottom: `${Math.max(4, hud.crosshairGap - 4)}px` }}
              />
              <div
                className="absolute w-[1.5px] h-2.5 -left-[0.75px] bg-white/80"
                style={{ top: `${Math.max(4, hud.crosshairGap - 4)}px` }}
              />
              <div className="absolute w-[3px] h-[3px] -left-[1.5px] -top-[1.5px] rounded-full bg-[#56c2ff]" />
            </>
          ) : (
            <>
              <div
                className="absolute w-[1.5px] h-[8px] -left-[0.75px] bg-white/90"
                style={{ bottom: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.8)' }}
              />
              <div
                className="absolute w-[1.5px] h-[8px] -left-[0.75px] bg-white/90"
                style={{ top: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.8)' }}
              />
              <div
                className="absolute h-[1.5px] w-[8px] -top-[0.75px] bg-white/90"
                style={{ right: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.8)' }}
              />
              <div
                className="absolute h-[1.5px] w-[8px] -top-[0.75px] bg-white/90"
                style={{ left: `${hud.crosshairGap}px`, boxShadow: '0 0 3px rgba(0,0,0,0.8)' }}
              />
              <div className="absolute w-[2.5px] h-[2.5px] -left-[1.25px] -top-[1.25px] rounded-full bg-[#e89b3c]" />
            </>
          )}
        </div>
      )}

      {/* Hitmarker X */}
      <div
        className="fixed top-1/2 left-1/2 w-7 h-7 pointer-events-none transition-all duration-75"
        style={{
          opacity: hmVisible ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${hud.hitmarkerCrit ? 1.28 : 1.0})`,
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 w-5 h-[2px] -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ backgroundColor: hud.hitmarkerCrit ? '#dc4c4c' : '#f4f6fa' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-5 h-[2px] -translate-x-1/2 -translate-y-1/2 -rotate-45"
          style={{ backgroundColor: hud.hitmarkerCrit ? '#dc4c4c' : '#f4f6fa' }}
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
                <span className="text-[10px] font-tactical font-semibold tracking-wider uppercase mt-0.5 whitespace-nowrap text-[#f6b75e] game-text-outline">
                  {fd.subLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Center Below-Reticle [R] Tactical (-20%) vs Full Empty Reload Indicator */}
      {!hud.vatsActive && hud.reloading && (
        <div
          className="fixed top-[54.6%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none px-3.5 py-2 rounded-[6px] hud-scrim-center transition-all duration-150"
          style={{
            border: hud.reloadIsTactical
              ? '1px solid rgba(86, 194, 255, 0.45)'
              : '1px solid rgba(232, 155, 60, 0.35)',
          }}
          data-testid="hud-reload-bar"
          data-reload-phase={hud.reloadPhase}
          data-reload-stage={hud.reloadStageGroup}
          data-reload-tactical={hud.reloadIsTactical ? 'true' : 'false'}
        >
          <div className="flex items-center justify-between w-[264px] gap-3 text-[10px] font-tactical font-semibold tracking-wider whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 uppercase min-w-0 truncate" style={{ color: hud.reloadAccentCss }}>
              <span>{hud.reloadStageBadge}</span>
              <span className="text-white/25">·</span>
              <span className="text-[#f4f6fa]">{hud.reloadPhaseLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums shrink-0">
              {hud.reloadIsTactical && (
                <span className="px-1.5 py-0.5 text-[9px] leading-none rounded-[2px] bg-[#56c2ff]/20 text-[#7dd3fc]">
                  -{hud.reloadSpeedBonusPct}%
                </span>
              )}
              <span className="text-[#f4f6fa]">{hud.reloadPct}%</span>
            </span>
          </div>

          <div className="relative w-[264px] h-1.5 bg-white/[0.08] rounded-[2px] overflow-hidden flex">
            <div
              className="relative h-full overflow-hidden"
              style={{ width: `${emptySplitPct}%` }}
            >
              <div
                className={`relative h-full transition-all duration-75 ${
                  hud.reloadIsTactical && isEmptyingPhase ? 'tactical-reload-sheen' : ''
                }`}
                style={{
                  width: isEmptyingPhase ? `${hud.reloadPhasePct}%` : '100%',
                  backgroundColor: hud.reloadIsTactical
                    ? isEmptyingPhase
                      ? '#56c2ff'
                      : '#0c4a6e'
                    : isEmptyingPhase
                      ? '#e89b3c'
                      : '#78350f',
                }}
              />
            </div>

            <div className="w-[1.5px] h-full bg-white/75 shrink-0 z-10" />

            <div className="relative h-full flex-1 overflow-hidden">
              <div
                className={`relative h-full transition-all duration-75 ${
                  hud.reloadIsTactical && isLoadingPhase ? 'tactical-reload-sheen' : ''
                }`}
                style={{
                  width: isLoadingPhase
                    ? `${Math.min(
                        100,
                        ((hud.reloadPct - emptySplitPct) / Math.max(1, 100 - emptySplitPct)) * 100
                      )}%`
                    : '0%',
                  backgroundColor: hud.reloadIsTactical
                    ? '#2dd4bf'
                    : hud.reloadPhase === 'chambering'
                      ? '#56c2ff'
                      : '#34d399',
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between w-[264px] text-[9px] font-tactical tracking-wide whitespace-nowrap">
            <span
              className={
                isEmptyingPhase
                  ? hud.reloadIsTactical
                    ? 'text-[#56c2ff] font-semibold'
                    : 'text-[#f6b75e] font-semibold'
                  : 'text-[#64748b] line-through'
              }
            >
              {hud.reloadIsTactical ? '01 잔탄 분리' : '01 탄창 비움'}
            </span>
            <span className="text-white/20">→</span>
            <span
              className={
                isLoadingPhase
                  ? hud.reloadIsTactical
                    ? 'text-[#2dd4bf] font-semibold'
                    : hud.reloadPhase === 'chambering'
                      ? 'text-[#56c2ff] font-semibold'
                      : 'text-[#34d399] font-semibold'
                  : 'text-[#64748b]'
              }
            >
              {hud.reloadIsTactical
                ? '02 신속 체결'
                : hud.reloadPhase === 'chambering'
                  ? '02 장전 체결'
                  : '02 탄창 장전'}
            </span>
          </div>
        </div>
      )}

      {!hud.vatsActive && !hud.reloading && hud.ammo <= Math.max(1, Math.floor(hud.mag * 0.25)) && (
        <div className="fixed top-[54.8%] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-[4px] hud-scrim-center text-[10px] font-tactical font-semibold text-[#f6b75e] tracking-wider whitespace-nowrap pointer-events-none">
          [R] {hud.ammo > 0 ? '전술 재장전 (-20%)' : '재장전 필요'}
        </div>
      )}

      {/* V.A.T.S. 3D -> 2D Clickable Target Boxes */}
      {hud.vatsActive && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-[5px] bg-[#071610]/92 border border-[#34d399]/40 text-[#a7f3d0] font-tactical text-xs tracking-wider">
            V.A.T.S. 신경 가속 (0.1x) · 적 부위 클릭 확정 파괴 [Q 종료]
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
              className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-[5px] bg-[#071610]/94 border border-[#34d399]/60 hover:border-[#e89b3c] text-left cursor-pointer transition-colors min-w-[132px]"
              style={{ left: `${t.screenX}px`, top: `${t.screenY}px` }}
            >
              <div className="text-[10px] font-tactical text-[#6ee7b7] leading-tight tabular-nums">
                {t.unitName} · {t.distance}m
              </div>
              <div className="text-xs font-bold text-white flex items-center justify-between gap-3 mt-0.5">
                <span>{t.partLabel}</span>
                <span className="text-[#f6b75e] font-tactical tabular-nums">
                  {t.multiplier.toFixed(1)}x
                </span>
              </div>
              <div className="text-[10px] font-tactical text-[#34d399] mt-0.5 tabular-nums">
                명중 {t.hitChance}% · HP {t.hpPct}%
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Center Callout & Contextual Action Prompts */}
      {hud.calloutText && (
        <div
          className="fixed top-[58%] left-1/2 -translate-x-1/2 font-display font-bold tracking-wider text-sm sm:text-base text-center whitespace-nowrap game-text-outline"
          style={{ color: hud.calloutColor }}
        >
          {hud.calloutText}
        </div>
      )}

      {hud.gloryKillTargetName && !hud.vatsActive && (
        <div className="fixed top-[63.5%] left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-[5px] bg-[#361114]/92 border border-[#dc4c4c]/55 text-white font-semibold text-xs tracking-wide whitespace-nowrap">
          <span className="font-tactical text-[#f6b75e] mr-2">[E]</span>
          글로리 킬 처형 · {hud.gloryKillTargetName}
        </div>
      )}

      {hud.canShutdownCore && !hud.vatsActive && !hud.serverShutdownActive && (
        <div
          className="fixed top-[69%] left-1/2 -translate-x-1/2 px-5 py-2 rounded-[5px] bg-[#0b1826]/92 border border-[#56c2ff]/60 text-white font-semibold text-xs sm:text-sm tracking-wide whitespace-nowrap"
          data-testid="core-shutdown-prompt"
        >
          <span className="font-tactical text-[#56c2ff] mr-2">[F]</span>
          OMNI-CORE 중앙 AI 서버 물리 셧다운 실행
        </div>
      )}

      {/* TOP LEFT: Strictly Aligned 256px Mission Objective Scrim (matches Bottom-Left Vitals width) */}
      <div className="fixed top-4 left-4 w-[256px]">
        <div className="hud-scrim-left pl-3.5 pr-4 py-2.5 border-l-2 border-l-[#e89b3c] rounded-r-[6px]">
          <div className="flex items-center justify-between gap-2 text-[10px] font-tactical tracking-[0.14em]">
            <span className="text-[#f6b75e] font-semibold uppercase">
              ACT 0{hud.actNumber} · {hud.actTitle}
            </span>
            <span className="text-[#e2e8f0] font-semibold tabular-nums">
              {hud.objectiveProgressPct}%
            </span>
          </div>
          <div className="text-xs font-medium text-[#f5f7fb] mt-1 leading-snug break-keep game-text-outline">
            {hud.objectiveText}
          </div>
          <div className="game-bar-track w-full h-[3px] mt-2">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${hud.objectiveProgressPct}%`,
                backgroundColor: hud.coreShieldDown ? '#56c2ff' : '#e89b3c',
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-tactical text-[#cbd5e1] tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rotate-45"
                style={{ backgroundColor: hud.coreShieldDown ? '#56c2ff' : '#dc4c4c' }}
              />
              릴레이
              <b className={hud.coreShieldDown ? 'text-[#56c2ff]' : 'text-[#f87171]'}>
                {hud.coreShieldDown ? '해제' : `${hud.relaysDestroyed}/${hud.relaysTotal}`}
              </b>
            </span>
            <span className="text-white/20">·</span>
            <span className="inline-flex items-center gap-1">
              <HudGlyphIcon kind="holotape" size={11} />
              기록 <b className="text-[#f6b75e]">{hud.holotapesFound}/{hud.holotapesTotal}</b>
            </span>
          </div>
        </div>
      </div>

      {/* TOP CENTER: Integrated 2-Tier Compass + Hairline Telemetry Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="hud-scrim-center w-[344px] sm:w-[400px] rounded-[6px] overflow-hidden">
          <div
            className="relative w-full h-6 overflow-hidden border-b border-white/[0.08]"
            aria-label="전술 위협 나침반"
          >
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] -translate-x-1/2 bg-[#e89b3c]/85" />
            {CARDINALS.map((c) => {
              const delta = shortestAngleDelta(c.deg, hud.playerYawDeg);
              if (Math.abs(delta) > 85) return null;
              const leftPct = 50 + (delta / 85) * 48;
              const isMain = c.label.length === 1;
              return (
                <span
                  key={c.label}
                  className={`absolute top-0.5 -translate-x-1/2 font-tactical text-[9px] ${
                    isMain ? 'text-[#f5f7fb] font-bold' : 'text-[#b4c0d0] font-medium'
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
                ? '#56c2ff'
                : ct.isRelay
                  ? '#dc4c4c'
                  : ct.isHolotape
                    ? '#f6b75e'
                    : ct.isBoss
                      ? '#e89b3c'
                      : ct.faction === Faction.RAIDER
                        ? '#e89b3c'
                        : ct.faction === Faction.SYNDICATE
                          ? '#7aa2f7'
                          : '#f87171';
              const isDiamond =
                Boolean(ct.isServerCore) ||
                Boolean(ct.isRelay) ||
                ct.isBoss ||
                Boolean(ct.isHolotape);
              const sizePx = ct.isServerCore
                ? '7px'
                : ct.isBoss
                  ? '7px'
                  : ct.isRelay
                    ? '6.5px'
                    : ct.isHolotape
                      ? '5.5px'
                      : '4.5px';
              return (
                <span
                  key={ct.id}
                  className="absolute bottom-1 -translate-x-1/2"
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

          <div
            className="flex items-center justify-center gap-3 px-3 py-1 font-tactical text-[10.5px] tracking-wider tabular-nums"
            data-testid="hud-topbar"
          >
            <span className="text-[#f6b75e] font-semibold">
              WAVE {String(hud.wave).padStart(2, '0')}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[#b8c4d6]">
              처치 <b className="text-[#f5f7fb] font-semibold ml-0.5">{hud.kills}</b>
            </span>
            <span className="text-[#b8c4d6]">
              파괴 <b className="text-[#f6b75e] font-semibold ml-0.5">{hud.dismembers}</b>
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[#e2e8f0] font-medium">{formatClock(hud.survivalTime)}</span>
          </div>
        </div>

        {hud.coreShieldDown && !hud.serverShutdownActive && (
          <div
            className="hud-scrim-center w-72 sm:w-[384px] px-3 py-1.5 rounded-[5px] border border-[#e89b3c]/45"
            data-testid="hud-core-hp"
          >
            <div className="flex justify-between text-[10px] font-tactical font-semibold text-[#fde6b8] mb-1 tabular-nums">
              <span>ARCADIA 중앙 서버 코어</span>
              <span>{coreHpPct}%</span>
            </div>
            <div className="game-bar-track w-full h-1.5">
              <div
                className="h-full bg-[#e89b3c] transition-all duration-150"
                style={{ width: `${coreHpPct}%` }}
              />
            </div>
          </div>
        )}

        {hud.bossName && (
          <div className="hud-scrim-center w-72 sm:w-96 px-3 py-1.5 rounded-[5px] border border-[#dc4c4c]/50">
            <div className="flex justify-between text-[10px] font-tactical font-semibold text-[#fecaca] mb-1 tabular-nums">
              <span>BOSS · {hud.bossName}</span>
              <span>{hud.bossHpPct}%</span>
            </div>
            <div className="game-bar-track w-full h-1.5">
              <div
                className="h-full bg-[#dc4c4c] transition-all duration-150"
                style={{ width: `${hud.bossHpPct}%` }}
              />
            </div>
          </div>
        )}

        {hud.alertBanner && (
          <div className="px-3.5 py-1 rounded-[4px] border text-white font-semibold text-xs tracking-wide animate-alert-banner">
            {hud.alertBanner}
          </div>
        )}
      </div>

      {/* TOP RIGHT: Minimal Ghost Icon Controls + Frameless Dark Radar + Borderless Killfeed */}
      <div className="fixed top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.ttsEnabled ? '한국어 음성 안내 끄기' : '한국어 음성 안내 켜기'}
            title={hud.ttsEnabled ? '한국어 TTS 음성 ON' : '한국어 TTS 음성 OFF'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTts();
            }}
            className={`game-btn game-btn-ghost h-8 px-2 text-[10px] font-tactical ${
              hud.ttsEnabled ? 'game-btn-selected' : ''
            }`}
          >
            <span className="relative z-10">{hud.ttsEnabled ? 'TTS ON' : 'TTS'}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.muted ? '음소거 해제' : '음소거'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="game-btn game-btn-ghost w-8 h-8 !p-0"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative z-10" fill="none" stroke="currentColor" strokeWidth="1.9">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.18" />
              {hud.muted ? (
                <>
                  <line x1="21" y1="9" x2="15" y2="15" stroke="#dc4c4c" />
                  <line x1="15" y1="9" x2="21" y2="15" stroke="#dc4c4c" />
                </>
              ) : (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M19 5a9 9 0 0 1 0 14" />
                </>
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
            className="game-btn game-btn-ghost w-8 h-8 !p-0"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative z-10" fill="currentColor">
              <rect x="6.5" y="5" width="3.2" height="14" rx="1" />
              <rect x="14.3" y="5" width="3.2" height="14" rx="1" />
            </svg>
          </button>
        </div>

        {/* Recessed Optical Tactical Minimap Radar (decluttered, crisp bezel depth) */}
        <div
          className="radar-optical-frame rounded-[8px] p-2 w-[144px]"
          data-testid="hud-minimap"
          aria-label="실시간 미로 전술 레이더"
        >
          <div className="flex items-center justify-between text-[9px] font-tactical font-semibold mb-1.5 px-0.5 tabular-nums">
            <span className="text-[#cbd5e1] tracking-[0.1em]">SECTOR-0</span>
            <span className="text-[#f6b75e]">{hud.coreDistance}m</span>
          </div>
          <div className="radar-optical-screen relative rounded-[4px] overflow-hidden">
            <svg viewBox="0 0 140 140" className="w-[126px] h-[126px] block">
              <line x1="70" y1="0" x2="70" y2="140" stroke="rgba(148,163,184,0.1)" strokeWidth="0.7" />
              <line x1="0" y1="70" x2="140" y2="70" stroke="rgba(148,163,184,0.1)" strokeWidth="0.7" />

              {hud.minimapWalls.map((w, idx) => {
                const x1 = worldToRadar(w.minX);
                const x2 = worldToRadar(w.maxX);
                const y1 = worldToRadar(w.minZ);
                const y2 = worldToRadar(w.maxZ);
                const fill =
                  w.kind === 'citadel'
                    ? hud.coreShieldDown
                      ? '#0c3b59'
                      : '#42141a'
                    : w.kind === 'barricade'
                      ? '#334155'
                      : '#1e293b';
                const stroke =
                  w.kind === 'citadel'
                    ? hud.coreShieldDown
                      ? '#56c2ff'
                      : '#dc4c4c'
                    : 'rgba(148,163,184,0.26)';
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
                  const col = hud.coreShieldDown ? '#56c2ff' : '#dc4c4c';
                  return (
                    <g key={dotKey} transform={`translate(${dx}, ${dy})`}>
                      <circle r="6" fill={col} fillOpacity="0.22" />
                      <polygon points="0,-4.5 3.9,-2.2 3.9,2.2 0,4.5 -3.9,2.2 -3.9,-2.2" fill={col} />
                    </g>
                  );
                }
                if (dot.kind === 'relay') {
                  return (
                    <g key={dotKey} transform={`translate(${dx}, ${dy})`}>
                      <circle r="4.2" fill="#dc4c4c" fillOpacity="0.22" />
                      <rect x="-2.4" y="-2.4" width="4.8" height="4.8" transform="rotate(45)" fill="#dc4c4c" />
                    </g>
                  );
                }
                if (dot.kind === 'holotape') {
                  return <circle key={dotKey} cx={dx} cy={dy} r="2.2" fill="#f6b75e" />;
                }
                const isBossDot = dot.kind === 'boss';
                const eColor = isBossDot
                  ? '#f6b75e'
                  : dot.kind === 'raider'
                    ? '#e89b3c'
                    : dot.kind === 'syndicate'
                      ? '#7aa2f7'
                      : '#f87171';
                return <circle key={dotKey} cx={dx} cy={dy} r={isBossDot ? 3.2 : 2.1} fill={eColor} />;
              })}

              {(() => {
                const px = worldToRadar(hud.playerX);
                const py = worldToRadar(hud.playerZ);
                return (
                  <g transform={`translate(${px}, ${py}) rotate(${hud.playerYawDeg})`}>
                    <polygon points="0,0 -10,-20 10,-20" fill="#56c2ff" fillOpacity="0.18" />
                    <polygon points="0,-5 3.6,3.6 0,1.6 -3.6,3.6" fill="#f5f7fb" />
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Clean Borderless Killfeed */}
        <div className="flex flex-col items-end gap-1 max-w-[300px]">
          {hud.killFeed.slice(0, 3).map((item) => {
            const kMeta = FACTION_META[item.killerFaction] ?? FACTION_META[-1];
            const vMeta = FACTION_META[item.victimFaction] ?? FACTION_META[3];
            return (
              <div
                key={item.id}
                className="hud-scrim-right pl-4 pr-2.5 py-0.5 rounded-l-[3px] text-[10px] font-medium whitespace-nowrap animate-kf-slide"
              >
                <span style={{ color: kMeta.cssColor }}>{item.killerName}</span>
                <span className="mx-1.5 font-tactical text-[#64748b]">{item.tag}</span>
                <span style={{ color: vMeta.cssColor }}>{item.victimName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM LEFT: Strictly Aligned 256px Vitals Telemetry */}
      <div className="fixed bottom-4 left-4 w-[256px] hud-scrim-left pl-3.5 pr-4 py-3 border-l-2 border-l-white/25 rounded-r-[6px]">
        <div className="flex items-baseline justify-between mb-2 tabular-nums">
          <div className="flex items-baseline gap-2">
            <HudGlyphIcon kind="hp" size={14} />
            <span
              className="font-display text-4xl font-bold leading-none game-text-outline"
              style={{ color: hud.hp < 40 ? '#f87171' : '#f5f7fb' }}
              data-testid="hud-hp"
            >
              {hud.hp}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <HudGlyphIcon kind="armor" size={13} />
            <span className="font-display text-xl font-semibold text-[#56c2ff] leading-none game-text-outline">
              {hud.armor}
            </span>
          </div>
        </div>

        <div className="game-bar-track w-full h-[5px] mb-1.5">
          <div
            className="absolute inset-y-0 left-0 bg-[#e89b3c]/75 transition-all duration-300"
            style={{ width: `${ghostHpPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-[#f5f7fb] transition-all duration-75"
            style={{
              width: `${hpPct}%`,
              backgroundColor: hud.hp < 40 ? '#dc4c4c' : '#f5f7fb',
            }}
          />
        </div>

        <div className="game-bar-track w-full h-[3px] mb-2">
          <div
            className="h-full bg-[#56c2ff] transition-all duration-100"
            style={{ width: `${armorPct}%` }}
          />
        </div>

        <canvas ref={ecgCanvasRef} width={220} height={18} className="w-full h-3.5 block opacity-85" />
      </div>

      {/* BOTTOM RIGHT: Strictly Aligned 328px Unified Weapons & Ability Column */}
      <div className="fixed bottom-4 right-4 w-[328px] flex flex-col gap-1.5">
        {/* Compact Inline Ability Telemetry (exact 328px right column alignment) */}
        <div className="w-full grid grid-cols-[1fr_1px_1fr] items-center gap-3 hud-scrim-right px-3.5 py-2 rounded-[6px] border-r-2 border-r-white/15">
          <div>
            <div className="flex items-center justify-between text-[10px] font-tactical mb-1 tabular-nums">
              <span className={hud.vatsActive ? 'text-[#34d399] font-semibold' : 'text-[#cbd5e1]'}>
                [Q] V.A.T.S
              </span>
              <span className="text-[#34d399] font-semibold">{hud.vatsEnergy}%</span>
            </div>
            <div className="game-bar-track w-full h-[3.5px]">
              <div
                className="h-full bg-[#34d399] transition-all duration-100"
                style={{ width: `${hud.vatsEnergy}%` }}
              />
            </div>
          </div>

          <span className="w-[1px] h-6 bg-white/12" aria-hidden="true" />

          <div>
            <div className="flex items-center justify-between text-[10px] font-tactical mb-1 tabular-nums">
              <span className={hud.airstrikeReady ? 'text-[#f6b75e] font-semibold' : 'text-[#cbd5e1]'}>
                [X] 폭격
              </span>
              <span className="text-[#f6b75e] font-semibold">
                {hud.airstrikeReady ? 'READY' : `${hud.killstreak}/${KILLSTREAK_TARGET}`}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: KILLSTREAK_TARGET }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[3.5px] flex-1 rounded-[1px] transition-colors duration-200"
                  style={{
                    backgroundColor:
                      idx < hud.killstreak || hud.airstrikeReady
                        ? '#e89b3c'
                        : 'rgba(226, 232, 240, 0.16)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Active Weapon, Visual Ammunition Tracking Gauge & Numeric Readout */}
        <div
          className="w-full hud-scrim-right px-3.5 py-2.5 border-r-2 rounded-[6px] transition-colors duration-150"
          style={{
            borderRightColor: ammoGauge.accentCss,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-tactical text-[#cbd5e1] tabular-nums">
              <HudGlyphIcon kind="grenade" size={12} />
              [G] EMP <b className="text-[#56c2ff]">{hud.grenades}</b>
            </span>
            <span className="text-[11px] font-semibold text-[#f5f7fb] tracking-wide truncate">
              {currentWeapon.name}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3" data-testid="hud-ammo">
            <AmmoDialGauge gauge={ammoGauge} />

            {hud.reloading ? (
              <div className="flex flex-col items-end tabular-nums leading-none">
                <span
                  className="text-[9.5px] font-tactical font-semibold tracking-[0.14em] uppercase"
                  style={{ color: hud.reloadAccentCss }}
                >
                  {hud.reloadIsTactical ? 'TACTICAL RELOAD' : 'RELOADING'}
                </span>
                <span
                  className="font-display text-3xl font-bold leading-none mt-0.5 game-text-outline"
                  style={{ color: hud.reloadAccentCss }}
                >
                  {hud.reloadPct}%
                </span>
              </div>
            ) : (
              <div className="flex items-baseline justify-end tabular-nums">
                <span
                  className="font-display text-4xl font-bold leading-none game-text-outline transition-colors duration-150"
                  style={{ color: ammoGauge.lowAmmoAlert ? '#f87171' : '#f5f7fb' }}
                >
                  {hud.ammo}
                </span>
                <span className="font-tactical text-xs font-semibold text-[#b4c0d0] ml-1.5">
                  / {hud.mag}
                </span>
              </div>
            )}
          </div>

          <AmmoSegmentStrip
            gauge={ammoGauge}
            reloading={hud.reloading}
            reloadIsTactical={hud.reloadIsTactical}
          />
        </div>

        {/* Exact 5-Column Aligned Weapon Selector Dock */}
        <div className="w-full grid grid-cols-5 gap-1 pointer-events-auto">
          {WEAPONS.map((w, idx) => {
            const active = hud.weaponIdx === idx;
            return (
              <button
                key={w.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(idx);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-[6px] transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-b from-[#232d40]/96 to-[#141a26]/98 text-[#f5f7fb] -translate-y-0.5'
                    : 'bg-[#0a0e16]/86 text-[#b4c0d0] hover:bg-[#161e2e]/92 hover:text-[#f5f7fb]'
                }`}
                style={{
                  border: active
                    ? '1px solid rgba(232, 155, 60, 0.72)'
                    : '1px solid rgba(226, 232, 240, 0.1)',
                  boxShadow: active
                    ? 'inset 0 1px 0 rgba(255, 236, 200, 0.25), 0 6px 14px -4px rgba(232, 155, 60, 0.34)'
                    : 'none',
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <WeaponSvgIcon
                  weaponIdx={idx}
                  accent={active ? '#f6b75e' : '#94a3b8'}
                  active={active}
                  onLight={false}
                />
                <span className="text-[8.5px] font-tactical font-semibold leading-none tabular-nums whitespace-nowrap">
                  <span className={active ? 'text-[#f6b75e]' : 'text-[#8494aa]'}>[{w.slotKey}]</span>{' '}
                  {w.shortName.split(' ')[0]}
                </span>
                <span
                  className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-[#e89b3c] transition-all duration-200"
                  style={{
                    opacity: active ? 1 : 0,
                    transform: active ? 'scaleX(1)' : 'scaleX(0.3)',
                  }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
