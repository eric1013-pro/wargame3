import React from 'react';
import { CommsSender, Faction } from '../game/types';

export type GameButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'crimson'
  | 'amber'
  | 'emerald'
  | 'steel';
export type GameButtonSize = 'sm' | 'md' | 'lg';

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  fullWidth?: boolean;
  selected?: boolean;
}

const SIZE_CLASSES: Record<GameButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-xs sm:text-sm',
  lg: 'h-12 px-6 text-sm sm:text-[15px]',
};

export const GameButton: React.FC<GameButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  selected = false,
  className = '',
  children,
  onClick,
  ...rest
}) => {
  return (
    <button
      type="button"
      aria-pressed={selected || undefined}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick?.(e);
      }}
      className={`game-btn game-btn-${variant} ${SIZE_CLASSES[size]} ${
        fullWidth ? 'w-full' : ''
      } ${selected ? 'game-btn-selected' : ''} ${className}`}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

/**
 * Sculpted Miniature Titanium Keycap Badge
 */
export const Keycap: React.FC<{
  children: React.ReactNode;
  tone?: 'default' | 'signal' | 'cyan' | 'amber' | 'emerald';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}> = ({ children, tone = 'default', size = 'sm', className = '' }) => {
  const sizeCls =
    size === 'xs'
      ? 'px-1.5 py-[2px] text-[9px] min-w-[18px]'
      : size === 'md'
        ? 'px-2 py-1 text-[11px] min-w-[24px]'
        : 'px-1.5 py-[3px] text-[10px] min-w-[20px]';

  const toneStyle: React.CSSProperties =
    tone === 'signal'
      ? { borderColor: 'rgba(255, 68, 34, 0.65)', color: '#ff8a73' }
      : tone === 'cyan'
        ? { borderColor: 'rgba(56, 217, 255, 0.6)', color: '#7ee6ff' }
        : tone === 'amber'
          ? { borderColor: 'rgba(245, 179, 66, 0.6)', color: '#fbd17b' }
          : tone === 'emerald'
            ? { borderColor: 'rgba(46, 230, 166, 0.6)', color: '#6ee7b7' }
            : {};

  return (
    <kbd className={`tac-kbd ${sizeCls} ${className}`} style={toneStyle}>
      {children}
    </kbd>
  );
};

/**
 * Razor-Sharp Geometric Faction Insignia (Modern AAA Military Stencil)
 */
export const FactionCrest: React.FC<{ faction: Faction; size?: number; className?: string }> = ({
  faction,
  size = 44,
  className = '',
}) => {
  const palette =
    faction === Faction.RAIDER
      ? { stroke: '#f5b342', fill: '#18130b', glyph: '#f4f4f0', accent: '#f5b342' }
      : faction === Faction.SYNDICATE
        ? { stroke: '#38d9ff', fill: '#0b151c', glyph: '#f4f4f0', accent: '#38d9ff' }
        : { stroke: '#ff4422', fill: '#1a0c0a', glyph: '#f4f4f0', accent: '#ff4422' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polygon
        points="32,3 58,15 58,45 32,61 6,45 6,15"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.8"
      />
      <polygon
        points="32,8 53,18 53,42 32,55 11,42 11,18"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />

      {faction === Faction.RAIDER && (
        <g fill={palette.glyph}>
          <path d="M22 29 L32 21 L42 29 L39 40 L35 43 L29 43 L25 40 Z" />
          <rect x="26" y="29" width="4" height="3.5" fill="#07080a" />
          <rect x="34" y="29" width="4" height="3.5" fill="#07080a" />
          <rect x="29.5" y="36.5" width="5" height="4" fill={palette.accent} />
        </g>
      )}
      {faction === Faction.SYNDICATE && (
        <g fill={palette.glyph}>
          <polygon points="32,18 46,29 39,34 42,44 32,39 22,44 25,34 18,29" />
          <polygon points="24,29 32,32 40,29 32,26.5" fill={palette.accent} />
        </g>
      )}
      {faction === Faction.ROBOT && (
        <g fill={palette.glyph}>
          <polygon points="32,18 45,28 41,43 23,43 19,28" />
          <rect x="25" y="29" width="14" height="6" fill="#07080a" />
          <rect x="28" y="30.8" width="8" height="2.4" fill={palette.accent} />
        </g>
      )}
    </svg>
  );
};

/**
 * Architectural Octagonal Combat Rank Stamp (S / A / B / C)
 */
export const RankShieldCrest: React.FC<{
  grade: 'S' | 'A' | 'B' | 'C';
  size?: number;
}> = ({ grade, size = 76 }) => {
  const cfg =
    grade === 'S'
      ? { stroke: '#ff4422', text: '#f4f4f0', bg: '#160c0a', tag: 'ELITE' }
      : grade === 'A'
        ? { stroke: '#38d9ff', text: '#f4f4f0', bg: '#0a141a', tag: 'ALPHA' }
        : grade === 'B'
          ? { stroke: '#2ee6a6', text: '#f4f4f0', bg: '#091712', tag: 'BRAVO' }
          : { stroke: '#7c828f', text: '#c8ccd4', bg: '#111216', tag: 'UNIT' };

  return (
    <svg width={size} height={size} viewBox="0 0 84 84" className="shrink-0" aria-label={`전투 등급 ${grade}`}>
      <polygon
        points="18,4 66,4 80,18 80,66 66,80 18,80 4,66 4,18"
        fill={cfg.bg}
        stroke={cfg.stroke}
        strokeWidth="2"
      />
      <polygon
        points="21,10 63,10 74,21 74,63 63,74 21,74 10,63 10,21"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
      <text
        x="42"
        y="52"
        textAnchor="middle"
        fill={cfg.text}
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="800"
        fontSize="40"
      >
        {grade}
      </text>
      <text
        x="42"
        y="68"
        textAnchor="middle"
        fill={cfg.stroke}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        fontSize="8.5"
        letterSpacing="2"
      >
        {cfg.tag}
      </text>
    </svg>
  );
};

/**
 * Ultra-Clean Flat Military Weapon Silhouettes
 */
export const WeaponSvgIcon: React.FC<{
  weaponIdx: number;
  accent: string;
  active?: boolean;
  onLight?: boolean;
}> = ({ weaponIdx, accent, active = false, onLight = false }) => {
  const fill = onLight ? '#07080a' : active ? '#f4f4f0' : 'rgba(200, 204, 212, 0.42)';
  return (
    <svg viewBox="0 0 56 22" className="w-9 h-3.5 shrink-0" aria-hidden="true">
      {weaponIdx === 0 && (
        <g fill={fill}>
          <path d="M5 9 L14 8 L39 8 L42 9.5 L51 9.5 L51 12 L41 12 L38 14 L32 14 L33 19 L28 19 L26 14 L18 14 L15 18 L11 18 L13 13 L5 14 Z" />
          <rect x="20" y="5.5" width="9" height="2.2" fill={active ? accent : fill} />
        </g>
      )}
      {weaponIdx === 1 && (
        <g fill={fill}>
          <path d="M5 12 L15 10 L18 8 L49 8 L49 13.5 L20 13.5 L15 16 L6 17 Z" />
          <rect x="44" y="8.2" width="4" height="5" fill={active ? accent : fill} />
        </g>
      )}
      {weaponIdx === 2 && (
        <g fill={fill}>
          <path d="M4 10 L15 8 L52 8 L52 10.5 L22 10.5 L22 12.2 L52 12.2 L52 14.5 L18 14.5 L12 18 L6 17 Z" />
          <rect x="25" y="10.4" width="24" height="1.8" fill={active ? accent : fill} />
          <rect x="17" y="5.5" width="11" height="2.2" fill={active ? accent : fill} />
        </g>
      )}
      {weaponIdx === 3 && (
        <g fill={fill}>
          <rect x="7" y="7" width="38" height="8" />
          <polygon points="45,6 52,8 52,14 45,16" fill={active ? accent : fill} />
          <rect x="18" y="15" width="4.5" height="4.2" />
          <rect x="29" y="15" width="3.8" height="3.8" />
        </g>
      )}
      {weaponIdx === 4 && (
        <g fill={fill}>
          <path d="M6 10 L38 9 L45 10 L45 13 L38 14 L18 14 L13 18 L8 17 Z" />
          <rect x="22" y="13.5" width="13" height="5.5" fill={active ? accent : fill} />
          <path d="M46 11.5 L53 9.5 L51 13.5 Z" fill={active ? accent : fill} />
        </g>
      )}
      {weaponIdx === 5 && (
        <g fill={fill}>
          <path d="M5 10 L16 8 L30 8 L33 9.5 L49 9.5 L49 12.5 L33 12.5 L30 14 L18 14 L14 18 L8 17 Z" />
          <rect x="28" y="6.2" width="3" height="9.6" fill={active ? accent : fill} />
          <rect x="34" y="6.8" width="3" height="8.4" fill={active ? accent : fill} />
          <rect x="40" y="7.4" width="3" height="7.2" fill={active ? accent : fill} />
          <path d="M49 9 L54 7.5 L51 11 L54 14.5 L49 13 Z" fill={active ? accent : fill} />
        </g>
      )}
    </svg>
  );
};

/**
 * CoD × Cyberpunk Tactical Radio Character Portrait Crest
 */
export const CharacterBadge: React.FC<{
  sender: CommsSender;
  accentCss: string;
  code?: string;
}> = ({ sender, accentCss, code }) => {
  return (
    <div
      className="relative w-10 h-10 shrink-0 rounded-[3px] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(16,20,28,0.96), rgba(8,10,14,0.98))',
        border: `1px solid ${accentCss}88`,
        boxShadow: `inset 0 0 12px ${accentCss}28`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="w-6 h-6">
        {sender === 'valkyrie' && (
          <g fill="none" stroke={accentCss} strokeWidth="1.7">
            <polygon points="18,4 30,11 26,28 18,32 10,28 6,11" fill={`${accentCss}18`} />
            <path d="M11 16 L18 22 L25 16 M18 10 V22" strokeLinecap="round" />
          </g>
        )}
        {sender === 'ghost9' && (
          <g fill="none" stroke={accentCss} strokeWidth="1.7">
            <polygon points="18,5 28,13 25,29 11,29 8,13" fill={`${accentCss}18`} />
            <path d="M12 16 L18 19 L24 16" strokeWidth="2.2" />
            <circle cx="18" cy="24" r="1.8" fill={accentCss} />
          </g>
        )}
        {sender === 'arcadia' && (
          <g fill="none" stroke={accentCss} strokeWidth="1.7">
            <polygon points="18,4 32,18 18,32 4,18" fill={`${accentCss}22`} />
            <circle cx="18" cy="18" r="4.5" fill={accentCss} />
          </g>
        )}
        {sender === 'exo' && (
          <g fill="none" stroke={accentCss} strokeWidth="1.7">
            <circle cx="18" cy="18" r="11" fill={`${accentCss}14`} />
            <path d="M9 18 H14 L16 12 L20 24 L22 18 H27" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {sender === 'holotape' && (
          <g fill="none" stroke={accentCss} strokeWidth="1.6">
            <rect x="6" y="10" width="24" height="16" rx="2" fill={`${accentCss}18`} />
            <circle cx="13.5" cy="18" r="2.6" />
            <circle cx="22.5" cy="18" r="2.6" />
          </g>
        )}
      </svg>
      {code && (
        <span
          className="text-[7px] font-tactical font-bold tracking-wider leading-none -mt-0.5"
          style={{ color: accentCss }}
        >
          {code}
        </span>
      )}
    </div>
  );
};

/**
 * GTA-Inspired 5-Star OMNI Threat Level Escalation Indicator
 */
export const ThreatStarRow: React.FC<{
  level: number;
  max?: number;
}> = ({ level, max = 5 }) => {
  const color =
    level >= 5 ? '#ff4422' : level >= 4 ? '#f97316' : level >= 3 ? '#f5b342' : level >= 2 ? '#38d9ff' : '#cbd5e1';
  return (
    <div className="flex items-center gap-1" aria-label={`OMNI 위협 등급 ${level}단계`}>
      {Array.from({ length: max }).map((_, idx) => {
        const active = idx < level;
        return (
          <svg
            key={idx}
            viewBox="0 0 20 20"
            className={`w-3.5 h-3.5 transition-all duration-300 ${
              active && level >= 4 ? 'animate-threat-star' : ''
            }`}
            aria-hidden="true"
          >
            <polygon
              points="10,1.5 12.6,6.8 18.5,7.6 14.2,11.7 15.2,17.5 10,14.7 4.8,17.5 5.8,11.7 1.5,7.6 7.4,6.8"
              fill={active ? color : 'rgba(148,163,184,0.18)'}
              stroke={active ? '#fff5eb' : 'rgba(148,163,184,0.3)'}
              strokeWidth={active ? '0.8' : '0.7'}
            />
          </svg>
        );
      })}
    </div>
  );
};

/**
 * Precision Architectural Micro-Glyphs
 */
export const HudGlyphIcon: React.FC<{
  kind:
    | 'hp'
    | 'armor'
    | 'vats'
    | 'airstrike'
    | 'grenade'
    | 'holotape'
    | 'chart'
    | 'skull'
    | 'settings'
    | 'play'
    | 'bolt'
    | 'film'
    | 'book'
    | 'keyboard'
    | 'compass';
  size?: number;
}> = ({ kind, size = 15 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      {kind === 'hp' && (
        <path d="M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z" fill="#ff4422" />
      )}
      {kind === 'armor' && (
        <path
          d="M12 3 L19 6.5 V12 C19 16.5 16 19.8 12 21 C8 19.8 5 16.5 5 12 V6.5 Z"
          fill="#38d9ff"
        />
      )}
      {kind === 'vats' && (
        <g fill="none" stroke="#2ee6a6" strokeWidth="1.9">
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="2" fill="#2ee6a6" stroke="none" />
          <path d="M12 2.5 V6 M12 18 V21.5 M2.5 12 H6 M18 12 H21.5" />
        </g>
      )}
      {kind === 'airstrike' && (
        <path d="M12 3 L16.5 10 H13.8 L17.5 16.5 H13 V21 H11 V16.5 H6.5 L10.2 10 H7.5 Z" fill="#f5b342" />
      )}
      {kind === 'grenade' && (
        <g fill="#38d9ff">
          <rect x="9.5" y="3" width="5" height="2.4" fill="#989ca6" />
          <rect x="6.5" y="7.5" width="11" height="12.5" rx="2" />
          <rect x="6.5" y="12.6" width="11" height="1.8" fill="#07080a" />
        </g>
      )}
      {kind === 'holotape' && (
        <g fill="none" stroke="#f5b342" strokeWidth="1.7">
          <rect x="3" y="5.5" width="18" height="13" />
          <circle cx="9" cy="12" r="1.9" fill="#f5b342" stroke="none" />
          <circle cx="15" cy="12" r="1.9" fill="#f5b342" stroke="none" />
        </g>
      )}
      {kind === 'chart' && (
        <g fill="currentColor">
          <rect x="4" y="13" width="3.8" height="7" opacity="0.6" />
          <rect x="10.1" y="8" width="3.8" height="12" opacity="0.85" />
          <rect x="16.2" y="4" width="3.8" height="16" />
        </g>
      )}
      {kind === 'skull' && (
        <g fill="currentColor">
          <polygon points="7,6 17,6 19,12 16,18 8,18 5,12" />
          <rect x="8.5" y="10.5" width="2.4" height="2.4" fill="#07080a" />
          <rect x="13.1" y="10.5" width="2.4" height="2.4" fill="#07080a" />
        </g>
      )}
      {kind === 'settings' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3 V5.5 M12 18.5 V21 M3 12 H5.5 M18.5 12 H21 M5.6 5.6 L7.4 7.4 M16.6 16.6 L18.4 18.4 M18.4 5.6 L16.6 7.4 M7.4 16.6 L5.6 18.4" />
        </g>
      )}
      {kind === 'play' && <polygon points="7,5 20,12 7,19" fill="currentColor" />}
      {kind === 'bolt' && (
        <polygon points="13,2 4.5,13.5 11.2,13.5 10,22 19.5,10 12.8,10" fill="currentColor" />
      )}
      {kind === 'film' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M7 5 V19 M17 5 V19 M3 9.5 H7 M17 9.5 H21 M3 14.5 H7 M17 14.5 H21" />
        </g>
      )}
      {kind === 'book' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 5.5 H10.5 C11.5 5.5 12 6.2 12 7.2 V19 C12 18 11.2 17.5 10 17.5 H4 Z" />
          <path d="M20 5.5 H13.5 C12.5 5.5 12 6.2 12 7.2 V19 C12 18 12.8 17.5 14 17.5 H20 Z" />
        </g>
      )}
      {kind === 'keyboard' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <path d="M6.5 10 H8.5 M11 10 H13 M15.5 10 H17.5 M7.5 14 H16.5" strokeLinecap="round" />
        </g>
      )}
      {kind === 'compass' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="8.5" />
          <polygon points="15.5,8.5 13.3,13.3 8.5,15.5 10.7,10.7" fill="currentColor" />
        </g>
      )}
    </svg>
  );
};
