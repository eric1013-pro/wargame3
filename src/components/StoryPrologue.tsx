import React, { useEffect, useState } from 'react';
import { PROLOGUE_BEATS } from '../game/story';
import { Faction } from '../game/types';
import { FactionCrest, GameButton, HudGlyphIcon, Keycap } from './GameUiKit';

interface StoryPrologueProps {
  onDeploy: () => void;
  onClose: () => void;
}

export const StoryPrologue: React.FC<StoryPrologueProps> = ({ onDeploy, onClose }) => {
  const [step, setStep] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const beat = PROLOGUE_BEATS[step];
  const isLast = step === PROLOGUE_BEATS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'ArrowRight' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (step < PROLOGUE_BEATS.length - 1) {
          setStep((s) => s + 1);
        } else {
          onDeploy();
        }
      } else if (e.code === 'ArrowLeft' && step > 0) {
        e.preventDefault();
        setStep((s) => s - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onDeploy, onClose]);

  const imgBroken = Boolean(failedImages[beat.id]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-between px-5 py-5 sm:px-10 sm:py-7 pointer-events-auto surface-grain overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 68% 54% at 72% 46%, ${beat.accentCss}1c 0%, transparent 66%), linear-gradient(128deg, rgba(7, 10, 16, 0.99) 0%, rgba(12, 16, 25, 0.98) 54%, rgba(16, 22, 33, 0.97) 100%)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="작전 스토리 브리핑"
      data-testid="story-prologue"
    >
      {/* Top briefing bar */}
      <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-white/[0.09]">
        <div className="flex items-center gap-3 text-xs font-tactical text-[#94a0b2] tabular-nums">
          <span className="p-1.5 rounded-[3px] bg-white/[0.05] border border-white/[0.09] text-[#f5b342]">
            <HudGlyphIcon kind="holotape" size={14} />
          </span>
          <span className="text-[#f3f5f8] font-bold tracking-[0.08em]">VAULT-00 작전 브리핑</span>
          <span aria-hidden="true" className="text-white/20">
            /
          </span>
          <span
            className="px-2 py-0.5 rounded-[3px] font-bold border"
            style={{
              color: beat.accentCss,
              borderColor: `${beat.accentCss}55`,
              backgroundColor: `${beat.accentCss}14`,
            }}
          >
            SCENE {beat.index} / 0{PROLOGUE_BEATS.length}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-white/20">
            ·
          </span>
          <span className="hidden sm:inline text-[#f6b75e]">{beat.radLevel}</span>
        </div>

        <GameButton variant="ghost" size="sm" onClick={onClose}>
          <span>타이틀로</span>
          <Keycap size="xs">ESC</Keycap>
        </GameButton>
      </div>

      {/* Main 2-column cinematic illustrated briefing */}
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center py-4">
        <div
          key={beat.id}
          className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-center animate-panel-in"
        >
          <div className="md:col-span-6 flex flex-col gap-3.5 lg:gap-4.5">
            <div className="flex items-center gap-2.5 text-xs font-tactical text-[#8c98ab] tabular-nums">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: beat.accentCss, boxShadow: `0 0 10px ${beat.accentCss}` }}
              />
              <span className="font-bold tracking-[0.1em]" style={{ color: beat.accentCss }}>
                {beat.dateLabel}
              </span>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <span>{beat.locationLabel}</span>
            </div>

            <div>
              <h2
                className="text-3xl sm:text-4xl font-black tracking-tight text-[#f5f7fb] leading-[1.14] break-keep"
                style={{ textWrap: 'balance' }}
              >
                {beat.title}
              </h2>
              <p
                className="mt-2 text-sm sm:text-base font-semibold break-keep"
                style={{ color: beat.accentCss }}
              >
                {beat.subtitle}
              </p>
            </div>

            <div className="space-y-3 text-sm sm:text-[15px] text-[#ced7e4] leading-relaxed max-w-xl break-keep">
              {beat.body.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {/* 3-Faction War Crest Strip on Beat 2 */}
            {beat.id === 'ai-factions' && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-[#f6b75e]">
                  <FactionCrest faction={Faction.RAIDER} size={28} />
                  <span>폐철 약탈기</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-[#7ee6ff]">
                  <FactionCrest faction={Faction.SYNDICATE} size={28} />
                  <span>이지스 신스</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-[#ff856d]">
                  <FactionCrest faction={Faction.ROBOT} size={28} />
                  <span>에이펙스 수호기</span>
                </div>
              </div>
            )}

            {/* Intercepted radio quote */}
            <blockquote
              className="pl-4 py-2 pr-3 max-w-xl border-l-2 rounded-r-[4px] bg-white/[0.025]"
              style={{ borderColor: beat.accentCss }}
            >
              <p className="text-sm text-[#eef2f7] font-medium leading-relaxed break-keep">
                {beat.quote}
              </p>
              <footer className="mt-1.5 text-[11px] font-tactical tracking-[0.06em] text-[#8f9cb0]">
                {beat.speaker}
              </footer>
            </blockquote>
          </div>

          {/* High-Resolution Illustrated Viewport inside Machined Obsidian Frame */}
          <div className="md:col-span-6">
            <div
              className="game-plaque tac-corners p-2.5"
              style={{
                boxShadow: `0 28px 64px -18px rgba(0,0,0,0.9), 0 0 38px -18px ${beat.accentCss}66`,
              }}
            >
              <div className="relative w-full aspect-[16/9] rounded-[3px] overflow-hidden border border-white/[0.1] bg-gradient-to-br from-[#161e2b] via-[#0e131b] to-[#080b11]">
                {!imgBroken && (
                  <img
                    key={beat.imageUrl}
                    src={beat.imageUrl}
                    alt={beat.imageAlt}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((prev) => ({ ...prev, [beat.id]: true }))}
                    className="w-full h-full object-cover object-center animate-ken-burns"
                  />
                )}

                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(8,11,17,0.34) 0%, rgba(8,11,17,0.02) 45%, rgba(8,11,17,0.88) 100%)',
                  }}
                />

                {/* Top-left live archive REC stamp */}
                <div className="absolute top-3 left-3.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#070a10]/80 border border-white/[0.12] text-[9.5px] font-tactical text-[#e2e8f0]">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: beat.accentCss }}
                  />
                  <span>ARCHIVE FEED · 0{step + 1}</span>
                </div>

                {/* Subtle architectural corner marks + optical dial */}
                <svg
                  viewBox="0 0 640 360"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                >
                  <path
                    d="M16 40 L16 16 L40 16 M600 16 L624 16 L624 40 M16 320 L16 344 L40 344 M600 344 L624 344 L624 320"
                    fill="none"
                    stroke={beat.accentCss}
                    strokeWidth="1.8"
                    strokeOpacity="0.72"
                  />
                  <g transform="translate(580, 56)">
                    <g className="animate-spin-slow">
                      <circle
                        cx="0"
                        cy="0"
                        r="22"
                        fill="none"
                        stroke={beat.accentCss}
                        strokeOpacity="0.58"
                        strokeWidth="1.4"
                        strokeDasharray="7 5"
                      />
                    </g>
                    <g className="animate-spin-rev">
                      <circle
                        cx="0"
                        cy="0"
                        r="12"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeOpacity="0.45"
                        strokeWidth="1.2"
                        strokeDasharray="3 4"
                      />
                    </g>
                    <circle cx="0" cy="0" r="2.6" fill={beat.accentCss} />
                  </g>
                </svg>

                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-3 text-[11px] font-tactical tabular-nums game-text-outline">
                  <span className="text-[#f3f5f8] font-semibold truncate">{beat.locationLabel}</span>
                  <span className="shrink-0 font-bold" style={{ color: beat.accentCss }}>
                    {beat.radLevel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Interactive Chapter Stepper & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-white/[0.09]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {PROLOGUE_BEATS.map((b, idx) => {
            const active = idx === step;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setStep(idx)}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] border text-[10.5px] font-tactical transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-white/[0.09] border-white/30 text-[#f8fafc]'
                    : 'bg-white/[0.02] border-white/[0.07] text-[#8494aa] hover:text-[#dce4ef] hover:border-white/20'
                }`}
                aria-label={`${idx + 1}번 브리핑으로 이동: ${b.title}`}
              >
                <span
                  className="font-bold"
                  style={{ color: active ? b.accentCss : undefined }}
                >
                  {b.index}
                </span>
                {active && (
                  <span className="hidden lg:inline font-sans font-semibold max-w-[120px] truncate">
                    {b.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          {step > 0 && (
            <GameButton variant="secondary" size="md" onClick={() => setStep((s) => s - 1)}>
              <Keycap size="xs">←</Keycap>
              <span>이전 장면</span>
            </GameButton>
          )}
          {!isLast ? (
            <GameButton
              variant="primary"
              size="lg"
              data-testid="prologue-next-btn"
              onClick={() => setStep((s) => s + 1)}
            >
              <span>다음 브리핑</span>
              <Keycap size="xs">ENTER</Keycap>
            </GameButton>
          ) : (
            <GameButton
              variant="primary"
              size="lg"
              data-testid="prologue-deploy-btn"
              onClick={onDeploy}
            >
              <HudGlyphIcon kind="skull" size={17} />
              <span>VAULT-00 방폭문 개방 · 작전 투입</span>
              <Keycap size="xs">ENTER</Keycap>
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
};
