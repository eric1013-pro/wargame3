import React from 'react';
import { AmmoGaugeState } from '../game/rules';

interface AmmoDialGaugeProps {
  gauge: AmmoGaugeState;
}

interface AmmoSegmentStripProps {
  gauge: AmmoGaugeState;
  reloading: boolean;
  reloadIsTactical: boolean;
}

const DIAL_SIZE = 48;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 19;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;
// 270-degree swept aerospace/tactical arc (leaves crisp 90-degree bottom opening for status tag)
const ARC_SWEEP_FRACTION = 0.75;
const ARC_LENGTH = DIAL_CIRCUMFERENCE * ARC_SWEEP_FRACTION;
const LOW_ZONE_LENGTH = ARC_LENGTH * 0.25;

/**
 * Compact 270-degree radial ammunition dial paired beside the numeric mag readout.
 */
export const AmmoDialGauge: React.FC<AmmoDialGaugeProps> = ({ gauge }) => {
  const filledArc = Math.max(0, Math.min(ARC_LENGTH, ARC_LENGTH * gauge.fillRatio));
  const dashOffset = ARC_LENGTH - filledArc;
  const centerValue = `${gauge.fillPct}%`;

  return (
    <div
      className={`ammo-dial-well relative w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 ${
        gauge.lowAmmoAlert ? 'animate-ammo-low' : ''
      }`}
      role="meter"
      aria-label="탄약 잔량 게이지"
      aria-valuenow={gauge.ammo}
      aria-valuemin={0}
      aria-valuemax={gauge.mag}
      data-testid="hud-ammo-dial"
      data-ammo-status={gauge.status}
      data-ammo-pct={gauge.fillPct}
    >
      <svg
        width={DIAL_SIZE}
        height={DIAL_SIZE}
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        className="block overflow-visible"
        aria-hidden="true"
      >
        {/* Full 270° recessed track */}
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER}
          r={DIAL_RADIUS}
          fill="none"
          stroke="rgba(148, 163, 184, 0.16)"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${DIAL_CIRCUMFERENCE}`}
          transform={`rotate(135 ${DIAL_CENTER} ${DIAL_CENTER})`}
        />

        {/* Subtle 25% low-ammo threshold zone highlight on the track */}
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER}
          r={DIAL_RADIUS}
          fill="none"
          stroke="rgba(220, 76, 76, 0.34)"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray={`${LOW_ZONE_LENGTH} ${DIAL_CIRCUMFERENCE}`}
          transform={`rotate(135 ${DIAL_CENTER} ${DIAL_CENTER})`}
        />

        {/* Dynamic live fill arc */}
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER}
          r={DIAL_RADIUS}
          fill="none"
          stroke={gauge.accentCss}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${DIAL_CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(135 ${DIAL_CENTER} ${DIAL_CENTER})`}
          style={{
            transition: 'stroke-dashoffset 90ms cubic-bezier(0.22, 1, 0.36, 1), stroke 160ms ease',
            filter: `drop-shadow(0 0 4px ${gauge.accentCss}66)`,
          }}
        />
      </svg>

      {/* Crisp centered telemetry readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none leading-none">
        <span
          className="font-tactical text-[10.5px] font-bold tabular-nums tracking-tight"
          style={{ color: gauge.lowAmmoAlert ? '#fecaca' : '#f5f7fb' }}
        >
          {centerValue}
        </span>
        <span
          className="font-tactical text-[7px] font-semibold tracking-[0.08em] uppercase mt-[3px]"
          style={{ color: gauge.accentCss }}
        >
          {gauge.statusTag}
        </span>
      </div>
    </div>
  );
};

/**
 * Weapon-adaptive recessed cartridge/shell/cell strip gauge showing exact live capacity.
 */
export const AmmoSegmentStrip: React.FC<AmmoSegmentStripProps> = ({
  gauge,
  reloading,
  reloadIsTactical,
}) => {
  const unitHint =
    gauge.unitMode === 'shells'
      ? 'CELL'
      : gauge.unitMode === 'cells'
        ? 'FUEL'
        : 'MAG';

  return (
    <div
      className="mt-2"
      data-testid="hud-ammo-gauge"
      data-ammo-status={gauge.status}
      data-ammo-pct={gauge.fillPct}
      data-ammo-segments={gauge.segmentCount}
      data-ammo-mode={gauge.unitMode}
    >
      <div className="ammo-gauge-well relative w-full p-[3px]">
        <div
          className="grid w-full h-[8px]"
          style={{
            gridTemplateColumns: `repeat(${gauge.segmentCount}, minmax(0, 1fr))`,
            gap: gauge.segmentCount >= 14 ? '2px' : '3px',
          }}
        >
          {gauge.segments.map((seg) => {
            const isActive = seg.fill > 0;
            const fillPct = Math.round(seg.fill * 100);
            return (
              <div key={seg.index} className="ammo-cell-slot h-full">
                <div
                  className={`relative h-full transition-all duration-75 ${
                    reloading && reloadIsTactical && isActive ? 'tactical-reload-sheen' : ''
                  }`}
                  style={{
                    width: `${fillPct}%`,
                    background: isActive
                      ? `linear-gradient(180deg, ${gauge.accentCss} 0%, ${gauge.accentCss}cc 100%)`
                      : 'transparent',
                    boxShadow: isActive
                      ? `inset 0 1px 0 rgba(255, 255, 255, 0.42), 0 0 6px ${gauge.accentCss}55`
                      : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Reload phase transition tick */}
        {reloading && (
          <div
            className="absolute inset-y-[2px] w-[1.5px] bg-white/85 pointer-events-none z-10"
            style={{ left: `${gauge.emptySplitPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Micro scale caption row: weapon magazine mode + discrete capacity readout */}
      <div className="mt-1 flex items-center justify-between text-[8.5px] font-tactical tracking-[0.1em] text-[#94a3b8] tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${gauge.lowAmmoAlert ? 'animate-ammo-low' : ''}`}
            style={{ backgroundColor: gauge.accentCss }}
            aria-hidden="true"
          />
          <span>{unitHint} TRACK</span>
        </span>
        <span style={{ color: gauge.lowAmmoAlert ? '#fca5a5' : '#cbd5e1' }}>
          {reloading
            ? reloadIsTactical
              ? 'TAC -20% SYNC'
              : 'CYCLING MAG'
            : gauge.lowAmmoAlert
              ? gauge.ammo === 0
                ? 'RELOAD [R]'
                : 'LOW AMMO'
              : `${gauge.ammo}/${gauge.mag} RDS`}
        </span>
      </div>
    </div>
  );
};
