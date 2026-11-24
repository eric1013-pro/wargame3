import React, { useEffect, useState } from 'react';
import { PROLOGUE_BEATS } from '../game/story';
import { Faction } from '../game/types';
import { FactionCrest, GameButton, HudGlyphIcon } from './GameUiKit';

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
      className="fixed inset-0 z-40 flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 pointer-events-auto surface-grain"
      style={{
        background:
          'linear-gradient(125deg, rgba(10, 13, 19, 0.98) 0%, rgba(14, 19, 27, 0.97) 56%, rgba(19, 25, 36, 0.96) 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="작전 스토리 브리핑"
      data-testid="story-prologue"
    >
      {/* Top briefing bar — clean hairline rhythm, zero nested box clutter */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3 text-xs font-tactical text-[#94a0b2] tabular-nums">
          <span className="text-[#e89b3c]">
            <HudGlyphIcon kind="holotape" size={16} />
          </span>
          <span className="text-[#f3f5f8] font-bold tracking-[0.06em]">VAULT-00 작전 브리핑</span>
          <span aria-hidden="true" className="text-white/20">
            /
          </span>
          <span className="font-bold" style={{ color: beat.accentCss }}>
            SCENE {beat.index} / 0{PROLOGUE_BEATS.length}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-white/20">
            ·
          </span>
          <span className="hidden sm:inline text-[#e89b3c]">{beat.radLevel}</span>
        </div>

        <GameButton variant="ghost" size="sm" onClick={onClose}>
          타이틀로 돌아가기 [ESC]
        </GameButton>
      </div>

      {/* Main 2-column cinematic illustrated briefing */}
      <div
        key={beat.id}
        className="w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center animate-panel-in"
      >
        <div className="lg:col-span-6 flex flex-col gap-5">
          <div className="flex items-center gap-3 text-xs font-tactical text-[#8c98ab] tabular-nums">
            <span className="font-bold tracking-[0.08em]" style={{ color: beat.accentCss }}>
              {beat.dateLabel}
            </span>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span>{beat.locationLabel}</span>
          </div>

          <div>
            <h2
              className="text-3xl sm:text-4xl font-black tracking-tight text-[#f3f5f8] leading-[1.16] break-keep"
              style={{ textWrap: 'balance' }}
            >
              {beat.title}
            </h2>
            <p className="mt-2.5 text-sm sm:text-base font-semibold break-keep" style={{ color: beat.accentCss }}>
              {beat.subtitle}
            </p>
          </div>

          <div className="space-y-3 text-sm sm:text-[15px] text-[#cbd3df] leading-relaxed max-w-xl break-keep">
            {beat.body.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          {/* 3-Faction War Crest Strip on Beat 2 (Obsidian + Cobalt Steel, zero purple) */}
          {beat.id === 'ai-factions' && (
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#f6b75e]">
                <FactionCrest faction={Faction.RAIDER} size={32} />
                <span>폐철 약탈기</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#93b4fa]">
                <FactionCrest faction={Faction.SYNDICATE} size={32} />
                <span>이지스 신스</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#f18b8b]">
                <FactionCrest faction={Faction.ROBOT} size={32} />
                <span>에이펙스 수호기</span>
              </div>
            </div>
          )}

          {/* Intercepted radio quote — restrained editorial left-rule instead of heavy boxed plaque */}
          <blockquote
            className="pl-4 py-1 max-w-xl border-l-2"
            style={{ borderColor: beat.accentCss }}
          >
            <p className="text-sm text-[#eef2f7] font-medium leading-relaxed break-keep">
              {beat.quote}
            </p>
            <footer className="mt-1.5 text-[11px] font-tactical tracking-[0.06em] text-[#8490a3]">
              {beat.speaker}
            </footer>
          </blockquote>
        </div>

        {/* High-Resolution Illustrated Viewport inside Machined Obsidian Frame */}
        <div className="lg:col-span-6">
          <div className="game-plaque p-2.5">
            <div className="relative w-full aspect-[16/9] rounded-md overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#161e2b] via-[#0e131b] to-[#080b11]">
              {!imgBroken && (
                <img
                  src={beat.imageUrl}
                  alt={beat.imageAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, [beat.id]: true }))}
                  className="w-full h-full object-cover object-center"
                />
              )}

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,13,19,0.22) 0%, rgba(10,13,19,0.04) 45%, rgba(10,13,19,0.86) 100%)',
                }}
              />

              {/* Subtle architectural corner marks + restrained optical dial */}
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

      {/* Bottom progress & 4-tier tactile action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2">
          {PROLOGUE_BEATS.map((b, idx) => {
            const active = idx === step;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active ? 'w-14 bg-[#e89b3c]' : 'w-7 bg-white/15 hover:bg-white/30'
                }`}
                aria-label={`${idx + 1}번 브리핑으로 이동`}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 && (
            <GameButton variant="secondary" size="md" onClick={() => setStep((s) => s - 1)}>
              이전 장면
            </GameButton>
          )}
          {!isLast ? (
            <GameButton
              variant="primary"
              size="lg"
              data-testid="prologue-next-btn"
              onClick={() => setStep((s) => s + 1)}
            >
              다음 브리핑 [ENTER]
            </GameButton>
          ) : (
            <GameButton
              variant="primary"
              size="lg"
              data-testid="prologue-deploy-btn"
              onClick={onDeploy}
            >
              <HudGlyphIcon kind="skull" size={18} />
              VAULT-00 방폭문 개방 · 작전 투입 [ENTER]
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
};
