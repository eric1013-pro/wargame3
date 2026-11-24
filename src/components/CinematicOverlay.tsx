import React from 'react';
import { getPortraitUrlForComms } from '../game/campaignMissions';
import { ENDING_PROFILES } from '../game/story';
import {
  CinematicHudState,
  EndingId,
  GamePhase,
  RadioTransmission,
} from '../game/types';
import { Keycap } from './GameUiKit';

interface CinematicOverlayProps {
  phase: GamePhase;
  cinematic: CinematicHudState;
  comms: RadioTransmission | null;
  onSkip: () => void;
  onChooseEnding: (ending: EndingId) => void;
}

const SEQ_LABELS: Record<CinematicHudState['sequence'], string> = {
  none: 'STANDBY',
  opening: 'SEQ-00 // THE LAST PULSE',
  titan_drop: 'SEQ-01 // IRON TITANFALL',
  breach: 'SEQ-02 // BREACH PROTOCOL',
  choice: 'SEQ-03 // ZERO HOUR DECISION',
  dawn: 'EPILOGUE A // DAWN OF HUMANITY',
  symbiosis: 'EPILOGUE B // BLUE HORIZON',
  ascension: 'EPILOGUE C // THE IRON SOVEREIGN',
};

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  phase,
  cinematic,
  comms,
  onSkip,
  onChooseEnding,
}) => {
  if (phase !== 'playing' && phase !== 'paused') return null;

  const card = cinematic.chapterCard;
  const typedActCode = card ? card.actCode.slice(0, card.visibleChars) : '';
  const typedMeta = card
    ? card.metaLine.slice(0, Math.max(0, card.visibleChars - card.actCode.length))
    : '';
  const isTyping = card ? card.visibleChars < card.actCode.length + card.metaLine.length : false;

  const ecgDashOffset =
    cinematic.ecgPhase >= 0 ? Math.max(0, 620 - cinematic.ecgPhase * 620) : 620;

  const isChoiceActive = cinematic.sequence === 'choice';
  const endingChoices: EndingId[] = ['dawn', 'symbiosis', 'ascension'];

  return (
    <div className="fixed inset-0 z-25 pointer-events-none overflow-hidden">
      {/* 1) OPENING PITCH-BLACK BLACKOUT + GREEN ECG HEARTBEAT */}
      {cinematic.blackoutOpacity > 0.01 && (
        <div
          className="fixed inset-0 bg-[#05070c] flex flex-col items-center justify-center"
          style={{ opacity: cinematic.blackoutOpacity }}
          data-testid="opening-blackout"
        >
          {cinematic.ecgPhase >= 0 && (
            <div className="w-full max-w-lg px-6 flex flex-col items-center">
              <div className="text-[11px] font-tactical tracking-[0.28em] text-[#34d399]/80 mb-3 tabular-nums">
                BIO-TELEMETRY // VAULT-00 CRYO-POD · NEO-SEOUL 2099
              </div>
              <svg viewBox="0 0 600 90" className="w-full h-20" aria-hidden="true">
                <path
                  d="M0 48 L120 48 L140 48 L152 14 L164 78 L178 34 L190 48 L330 48 L345 48 L358 10 L372 82 L386 30 L398 48 L600 48"
                  fill="none"
                  stroke="#10b981"
                  strokeOpacity="0.18"
                  strokeWidth="2"
                />
                <path
                  d="M0 48 L120 48 L140 48 L152 14 L164 78 L178 34 L190 48 L330 48 L345 48 L358 10 L372 82 L386 30 L398 48 L600 48"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="620"
                  strokeDashoffset={ecgDashOffset}
                  style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.85))' }}
                />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* HELMET VISOR BOOT DIAGNOSTIC OVERLAY */}
      {cinematic.visorBootStep > 0 && (
        <div
          className="fixed inset-0 flex items-center justify-center visor-scanlines"
          data-testid="visor-boot-overlay"
        >
          <div className="w-full max-w-xl mx-6 px-6 py-5 rounded-md border border-[#38d9ff]/35 bg-[#090e17]/88 font-tactical shadow-[0_24px_56px_rgba(0,0,0,0.72)] tabular-nums">
            <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-[#38d9ff] border-b border-white/[0.08] pb-2.5 mb-3">
              <span>EXO-SUIT MK.IV // VISOR BOOT SEQUENCE V3.0</span>
              <span className="text-[#34d399]">SYS_OK</span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm tracking-wider">
              <div className="text-[#34d399] font-semibold">
                &gt; BIO-LINK ONLINE · 생체 맥박 정상 복구 (72 BPM)
              </div>
              {cinematic.visorBootStep >= 2 && (
                <div className="text-[#eef4fb] font-semibold">
                  &gt; SUBJECT-00: IAN KANE · 프로젝트 라자루스 코어 동기화
                </div>
              )}
              {cinematic.visorBootStep >= 3 && (
                <div className="text-[#2ee6a6] font-semibold">
                  &gt; ORBITAL LINK: VALKYRIE-01 (UNS 아크라이트) 암호 접속 성공
                </div>
              )}
              {cinematic.visorBootStep >= 4 && (
                <div className="text-[#f5b342] font-semibold">
                  &gt; SECTOR ZERO // NEO-SEOUL · 2099.11.24 · 전술 HUD 전개 중...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2) OMNI-CORE RGB CHROMATIC ABERRATION GLITCH OVERLAY */}
      {cinematic.glitchIntensity > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none animate-glitch-rgb"
          style={{ opacity: cinematic.glitchIntensity * 0.82 }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(220,76,76,0.16) 0px, rgba(220,76,76,0.16) 2px, transparent 2px, transparent 6px)',
              transform: 'translateX(-4px)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(86,194,255,0.14) 0px, rgba(86,194,255,0.14) 2px, transparent 2px, transparent 8px)',
              transform: 'translateX(4px)',
            }}
          />
          <div
            className="absolute inset-x-0 top-[24%] h-7 bg-[#dc4c4c]/18"
            style={{ transform: 'translateX(-8px)' }}
          />
          <div
            className="absolute inset-x-0 top-[68%] h-5 bg-[#56c2ff]/16"
            style={{ transform: 'translateX(8px)' }}
          />
        </div>
      )}

      {/* 3) EMERGENCY CRIMSON STROBE */}
      {cinematic.emergencyRedOpacity > 0.01 && (
        <div
          className="fixed inset-0 bg-[#c93b3b] pointer-events-none"
          style={{ opacity: cinematic.emergencyRedOpacity }}
          aria-hidden="true"
        />
      )}

      {/* 4) DETONATION FLASH (Balanced warm cinematic peak, non-blinding) */}
      {cinematic.whiteoutOpacity > 0.01 && (
        <div
          className="fixed inset-0 bg-[#f3ead8] pointer-events-none"
          style={{ opacity: Math.min(0.62, cinematic.whiteoutOpacity * 0.62) }}
          aria-hidden="true"
        />
      )}

      {/* 5) 2.39:1 CINEMATIC LETTERBOX BARS */}
      <div
        className="fixed top-0 left-0 right-0 h-[10.5vh] bg-[#06090f] border-b border-white/[0.08]"
        style={{
          transform: cinematic.letterbox ? 'translateY(0)' : 'translateY(-102%)',
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        data-testid="letterbox-top"
      />
      <div
        className="fixed bottom-0 left-0 right-0 h-[10.5vh] bg-[#06090f] border-t border-white/[0.08] flex items-center justify-between px-6 sm:px-10"
        style={{
          transform: cinematic.letterbox ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        data-testid="letterbox-bottom"
      >
        <div className="text-[10px] font-tactical tracking-[0.26em] text-[#7c889c] uppercase hidden sm:block tabular-nums">
          IRON ASH III // REAL-TIME CINEMA · {SEQ_LABELS[cinematic.sequence]}
        </div>
        <div />
      </div>

      {/* 6) INTERACTIVE ZERO HOUR 3-ENDING DECISION OVERLAY */}
      {isChoiceActive && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center px-4 sm:px-8 pointer-events-auto"
          style={{
            background:
              'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(7, 10, 18, 0.42) 0%, rgba(5, 7, 13, 0.84) 100%)',
          }}
          data-testid="zero-hour-choice-overlay"
        >
          <div className="w-full max-w-5xl max-h-[82vh] overflow-y-auto px-1 py-2 animate-panel-in">
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-[#070b14]/88 border border-[#38d9ff]/45 backdrop-blur-md text-[10px] font-tactical font-bold tracking-[0.22em] text-[#38d9ff] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38d9ff] animate-pulse" />
                <span>OMNI-CORE MAINFRAME INTERFACE // ZERO HOUR DECISION</span>
              </div>
              <h2 className="mt-2.5 font-display text-3xl sm:text-5xl font-extrabold tracking-[0.05em] text-[#f8fafc] game-text-outline">
                지구와 인류의 최후 결말을 선택하라
              </h2>
              <p className="mt-1.5 inline-flex flex-wrap items-center justify-center gap-1.5 text-xs sm:text-sm text-[#cbd5e1] game-text-outline">
                <Keycap size="xs" tone="amber">
                  1
                </Keycap>
                <Keycap size="xs" tone="emerald">
                  2
                </Keycap>
                <Keycap size="xs" tone="signal">
                  3
                </Keycap>
                <span>또는 아래 프로토콜 카드를 클릭해 최종 엔딩을 집행하십시오</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {endingChoices.map((endId) => {
                const prof = ENDING_PROFILES[endId];
                return (
                  <button
                    key={endId}
                    type="button"
                    data-testid={`choose-ending-${endId}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onChooseEnding(endId);
                    }}
                    className="group relative h-full text-left flex flex-col overflow-hidden rounded-[5px] bg-[#0a0e18]/92 backdrop-blur-md border border-white/15 hover:border-white/60 transition-all duration-250 hover:-translate-y-1.5 cursor-pointer"
                    style={{
                      borderTop: `2.5px solid ${prof.accentCss}`,
                      boxShadow: `0 24px 48px -12px rgba(0,0,0,0.88), 0 0 28px -14px ${prof.accentCss}66`,
                    }}
                  >
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-[#07090d]">
                      <img
                        src={prof.imageUrl}
                        alt={prof.title}
                        className="w-full h-full object-cover object-center opacity-88 group-hover:scale-106 group-hover:opacity-100 transition-all duration-500"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(8,10,16,0.16) 0%, rgba(10,14,24,0.96) 100%)',
                        }}
                      />
                      <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2">
                        <span
                          className="px-2 py-0.5 text-[10px] font-tactical font-extrabold rounded-[3px] text-[#07080a] shadow-sm"
                          style={{ backgroundColor: prof.accentCss }}
                        >
                          KEY [{prof.keyHint}]
                        </span>
                        <span className="px-2 py-0.5 rounded-[2px] bg-[#070a12]/75 text-[9.5px] font-tactical font-semibold text-[#e2e8f0]">
                          {prof.choiceTag}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div
                          className="text-[10px] font-tactical font-bold tracking-[0.14em] uppercase"
                          style={{ color: prof.accentCss }}
                        >
                          {prof.code}
                        </div>
                        <div className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#f8fafc] leading-tight">
                          {prof.title}
                        </div>
                        <p className="mt-2 text-xs text-[#cbd5e1] leading-relaxed break-keep">
                          {prof.choiceSummary}
                        </p>
                      </div>

                      <div
                        className="pl-2.5 py-1.5 pr-2 rounded-r-[3px] bg-white/[0.03] border-l-2 text-[11px] text-[#e2e8f0] leading-snug break-keep"
                        style={{ borderColor: prof.accentCss }}
                      >
                        <div className="font-tactical text-[9.5px] text-[#94a3b8] mb-0.5">
                          {prof.advisorSpeaker}
                        </div>
                        {prof.advisorQuote}
                      </div>

                      <div
                        className="w-full py-2 text-center font-tactical text-xs font-bold tracking-wider uppercase rounded-[3px] border transition-all group-hover:brightness-115"
                        style={{
                          borderColor: `${prof.accentCss}99`,
                          color: prof.accentCss,
                          backgroundColor: `${prof.accentCss}18`,
                        }}
                      >
                        프로토콜 집행 [{prof.keyHint}]
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7) CALL OF DUTY–STYLE CHAPTER TITLE CARD */}
      {card && !isChoiceActive && (
        <div
          key={`card-${card.id}`}
          className="fixed left-6 sm:left-8 max-w-[360px] pointer-events-none transition-all duration-300"
          style={{
            top: cinematic.letterbox ? '14vh' : undefined,
            bottom: cinematic.letterbox ? undefined : '188px',
            opacity: card.opacity,
          }}
          data-testid="chapter-title-card"
        >
          <div
            className="font-tactical text-[11px] sm:text-xs font-extrabold tracking-[0.2em] uppercase game-text-outline tabular-nums"
            style={{ color: card.accentCss }}
          >
            {typedActCode}
            {isTyping && typedMeta.length === 0 && (
              <span className="inline-block w-2 h-3.5 ml-1 align-middle bg-current animate-pulse" />
            )}
          </div>
          <div
            className="h-[2px] mt-1 mb-1.5 transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(18, card.visibleChars * 3.6))}%`,
              maxWidth: '280px',
              background: `linear-gradient(90deg, ${card.accentCss} 0%, rgba(255,255,255,0.2) 80%, transparent 100%)`,
            }}
          />
          <div className="font-stencil text-xl sm:text-2xl tracking-[0.12em] text-[#f8fafc] leading-tight game-text-outline break-keep">
            {card.title}
          </div>
          <div className="mt-1 font-tactical text-[10px] sm:text-[10.5px] tracking-[0.12em] text-[#cbd5e1] game-text-outline tabular-nums break-keep">
            {typedMeta}
            {isTyping && typedMeta.length > 0 && (
              <span className="inline-block w-1.5 h-3 ml-1 align-middle bg-white animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* 8) CALL OF DUTY–STYLE TACTICAL RADIO SUBTITLE BAR WITH PORTRAIT & VHF WAVEFORM */}
      {comms && !isChoiceActive && (
        <div
          key={`comms-${comms.id}`}
          className={`fixed left-1/2 -translate-x-1/2 px-4 pointer-events-none transition-all duration-250 animate-comms-enter ${
            cinematic.letterbox ? 'bottom-[12.2vh]' : 'bottom-6'
          }`}
          style={{
            maxWidth: 'min(92vw, 660px)',
          }}
          data-testid="cinematic-subtitle-bar"
        >
          <div
            className="inline-flex items-center gap-3.5 px-3.5 py-2.5 rounded-[5px] bg-[#060b14]/88 backdrop-blur-md border border-white/[0.12] shadow-[0_14px_36px_rgba(0,0,0,0.82)]"
            style={{
              borderLeft: `3px solid ${comms.accentCss}`,
              boxShadow: `0 14px 36px rgba(0,0,0,0.82), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <div className="relative shrink-0">
              <img
                src={getPortraitUrlForComms(comms.sender, comms.speaker)}
                alt={comms.speaker}
                className="w-11 h-11 rounded-[4px] object-cover border shadow-md"
                style={{ borderColor: `${comms.accentCss}99` }}
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse border-2 border-[#060b14]"
                style={{ backgroundColor: comms.accentCss }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="font-tactical text-[10.5px] sm:text-[11px] font-extrabold tracking-wide whitespace-nowrap"
                  style={{ color: comms.accentCss }}
                >
                  {comms.speaker.split('·')[0].trim()}
                  {comms.lineIndex && comms.lineTotal ? ` [${comms.lineIndex}/${comms.lineTotal}]` : ''}
                </span>
                {/* Animated VHF Tactical Signal Waveform */}
                <span className="inline-flex items-end gap-[2px] h-2.5" aria-hidden="true">
                  {[0.45, 0.95, 0.65, 1.0, 0.5].map((hScale, idx) => (
                    <span
                      key={idx}
                      className="w-[2px] rounded-full animate-pulse"
                      style={{
                        height: `${Math.round(hScale * 10)}px`,
                        backgroundColor: comms.accentCss,
                        opacity: 0.85,
                        animationDelay: `${idx * 110}ms`,
                        animationDuration: '720ms',
                      }}
                    />
                  ))}
                </span>
                <span className="text-[9px] font-tactical tracking-[0.18em] text-white/50 uppercase">
                  VHF // CH-01
                </span>
              </div>
              <p
                className="text-xs sm:text-[13.5px] font-medium text-[#f8fafc] leading-snug break-keep mt-0.5"
                style={
                  comms.sender === 'arcadia'
                    ? { textShadow: '-1px 0 rgba(255,68,52,0.55), 1px 0 rgba(56,217,255,0.35)' }
                    : { textShadow: '0 1px 4px rgba(0,0,0,0.9)' }
                }
              >
                {comms.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 9) UNIVERSAL [SPACE] SKIP BUTTON */}
      {cinematic.canSkip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onSkip();
          }}
          data-testid="skip-cinematic-btn"
          className="fixed bottom-[2.6vh] right-6 sm:right-10 z-30 pointer-events-auto game-btn game-btn-secondary px-3.5 py-2 text-xs font-tactical tracking-wider backdrop-blur-md"
        >
          <Keycap size="xs" tone="amber">
            SPACE
          </Keycap>
          <span>건너뛰기</span>
        </button>
      )}
    </div>
  );
};
