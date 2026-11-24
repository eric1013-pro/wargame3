import React, { useEffect, useRef } from 'react';
import { CinematicHudState, CommsSender, GamePhase, RadioTransmission } from '../game/types';

interface CinematicOverlayProps {
  phase: GamePhase;
  cinematic: CinematicHudState;
  comms: RadioTransmission | null;
  onSkip: () => void;
}

const LiveWaveformCanvas: React.FC<{ sender: CommsSender; accentCss: string }> = ({
  sender,
  accentCss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let phase = 0;
    const id = window.setInterval(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      phase += sender === 'arcadia' ? 0.52 : sender === 'holotape' ? 0.24 : 0.34;
      const w = c.width;
      const h = c.height;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = accentCss;
      ctx.lineWidth = sender === 'arcadia' ? 1.8 : 1.65;
      ctx.beginPath();

      for (let x = 0; x <= w; x += 2) {
        const nx = x / w;
        const env = Math.sin(nx * Math.PI);
        let y = mid;
        if (sender === 'exo') {
          y =
            mid +
            Math.sin(nx * Math.PI * 6 + phase) * 6.5 * env +
            Math.sin(nx * Math.PI * 12 - phase * 1.4) * 2.2 * env;
        } else if (sender === 'arcadia') {
          const saw = ((nx * 7 + phase * 0.45) % 1) * 2 - 1;
          const jitter = Math.sin(x * 1.9 + phase * 3.1) > 0.72 ? (Math.random() - 0.5) * 9 : 0;
          y = mid + saw * 7.8 * env + jitter * env;
        } else {
          y =
            mid +
            Math.sin(nx * Math.PI * 8 + phase) * 4.8 * env +
            Math.cos(nx * Math.PI * 19 + phase * 0.7) * 2.5 * env;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }, 48);

    return () => clearInterval(id);
  }, [sender, accentCss]);

  return <canvas ref={canvasRef} width={72} height={24} className="w-[72px] h-6 shrink-0" />;
};

const SpinningCassetteIcon: React.FC = () => (
  <svg viewBox="0 0 36 24" className="w-9 h-6 shrink-0" aria-hidden="true">
    <rect
      x="1.5"
      y="2"
      width="33"
      height="20"
      rx="3"
      fill="#181410"
      stroke="#e89b3c"
      strokeWidth="1.5"
    />
    <rect x="4.5" y="4.5" width="27" height="5.5" rx="1" fill="#e89b3c" fillOpacity="0.22" />
    <rect x="8.5" y="12" width="19" height="6" rx="2" fill="#0b0d13" stroke="#e89b3c" strokeWidth="0.9" />
    <g transform="translate(13, 15)">
      <g className="animate-cassette-spin">
        <circle cx="0" cy="0" r="2.6" fill="none" stroke="#f6b75e" strokeWidth="1.2" strokeDasharray="2 1.6" />
        <circle cx="0" cy="0" r="0.9" fill="#f6b75e" />
      </g>
    </g>
    <g transform="translate(23, 15)">
      <g className="animate-cassette-spin">
        <circle cx="0" cy="0" r="2.6" fill="none" stroke="#f6b75e" strokeWidth="1.2" strokeDasharray="2 1.6" />
        <circle cx="0" cy="0" r="0.9" fill="#f6b75e" />
      </g>
    </g>
  </svg>
);

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  phase,
  cinematic,
  comms,
  onSkip,
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
                BIO-TELEMETRY // VAULT-00 CRYO-POD
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
          <div className="w-full max-w-xl mx-6 px-6 py-5 rounded-lg border border-[#56c2ff]/35 bg-[#090e17]/86 font-tactical shadow-[0_24px_56px_rgba(0,0,0,0.68)] tabular-nums">
            <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-[#56c2ff] border-b border-white/[0.08] pb-2.5 mb-3">
              <span>EXO-SUIT MK.IV // VISOR BOOT SEQUENCE</span>
              <span className="text-[#34d399]">SYS_OK</span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm tracking-wider">
              <div className="text-[#34d399] font-semibold">
                &gt; BIO-LINK ONLINE · 생체 맥박 정상 복구 (72 BPM)
              </div>
              {cinematic.visorBootStep >= 2 && (
                <div className="text-[#eef4fb] font-semibold">
                  &gt; SUBJECT-00: IAN KANE · 최후의 인류 식별 확인
                </div>
              )}
              {cinematic.visorBootStep >= 3 && (
                <div className="text-[#e89b3c] font-semibold">
                  &gt; NEURAL SYNC 100% · 오프라인 전술 HUD 초기화 중...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2) ARCADIA AI RGB CHROMATIC ABERRATION GLITCH OVERLAY */}
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

      {/* 3) RELAY-2 EMERGENCY CRIMSON STROBE */}
      {cinematic.emergencyRedOpacity > 0.01 && (
        <div
          className="fixed inset-0 bg-[#c93b3b] pointer-events-none"
          style={{ opacity: cinematic.emergencyRedOpacity }}
          aria-hidden="true"
        />
      )}

      {/* 4) DAWN SERVER DETONATION WHITEOUT FLASH */}
      {cinematic.whiteoutOpacity > 0.01 && (
        <div
          className="fixed inset-0 bg-[#fffaf0] pointer-events-none"
          style={{ opacity: cinematic.whiteoutOpacity }}
          aria-hidden="true"
        />
      )}

      {/* 5) 2.39:1 CINEMATIC LETTERBOX BARS (11vh top & bottom, 0.6s cubic-bezier) */}
      <div
        className="fixed top-0 left-0 right-0 h-[11vh] bg-[#06090f] border-b border-white/[0.08]"
        style={{
          transform: cinematic.letterbox ? 'translateY(0)' : 'translateY(-102%)',
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        data-testid="letterbox-top"
      />
      <div
        className="fixed bottom-0 left-0 right-0 h-[11vh] bg-[#06090f] border-t border-white/[0.08] flex items-center justify-between px-6 sm:px-10"
        style={{
          transform: cinematic.letterbox ? 'translateY(0)' : 'translateY(102%)',
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        data-testid="letterbox-bottom"
      >
        <div className="text-[10px] font-tactical tracking-[0.26em] text-[#6d798c] uppercase hidden sm:block tabular-nums">
          IRON ASH // REAL-TIME CINEMATIC FEED ·{' '}
          {cinematic.sequence === 'opening'
            ? 'SEQ-00 THE LAST PULSE'
            : cinematic.sequence === 'breach'
              ? 'SEQ-02 BREACH PROTOCOL'
              : cinematic.sequence === 'dawn'
                ? 'SEQ-03 DAWN'
                : 'STANDBY'}
        </div>
        <div />
      </div>

      {/* 6) CALL OF DUTY–STYLE CHAPTER TITLE CARD */}
      {card && (
        <div
          key={`card-${card.id}`}
          className="fixed left-7 sm:left-11 max-w-xl pointer-events-none transition-all duration-300"
          style={{
            top: cinematic.letterbox ? '15.5vh' : undefined,
            bottom: cinematic.letterbox ? undefined : '218px',
            opacity: card.opacity,
          }}
          data-testid="chapter-title-card"
        >
          <div
            className="font-tactical text-sm sm:text-base font-extrabold tracking-[0.18em] uppercase game-text-outline tabular-nums"
            style={{ color: card.accentCss }}
          >
            {typedActCode}
            {isTyping && typedMeta.length === 0 && (
              <span className="inline-block w-2 h-3.5 ml-1 align-middle bg-current animate-pulse" />
            )}
          </div>
          <div
            className="h-[2px] mt-1.5 mb-2 transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(18, card.visibleChars * 3.6))}%`,
              maxWidth: '380px',
              background: `linear-gradient(90deg, ${card.accentCss} 0%, rgba(255,255,255,0.2) 80%, transparent 100%)`,
            }}
          />
          <div className="font-stencil text-2xl sm:text-3xl tracking-[0.14em] text-[#f3f5f8] leading-none game-text-outline">
            {card.title}
          </div>
          <div className="mt-1.5 font-tactical text-[11px] sm:text-xs tracking-[0.14em] text-[#cbd3df] game-text-outline tabular-nums">
            {typedMeta}
            {isTyping && typedMeta.length > 0 && (
              <span className="inline-block w-1.5 h-3 ml-1 align-middle bg-white animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* 7) MOVIE-STYLE BOTTOM-CENTER SUBTITLE BAR */}
      {comms && cinematic.letterbox && (
        <div
          className="fixed left-0 right-0 bottom-[11vh] h-32 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(6,9,15,0.84) 0%, rgba(6,9,15,0.34) 55%, transparent 100%)',
          }}
          aria-hidden="true"
        />
      )}
      {comms && (
        <div
          key={`comms-${comms.id}`}
          className="fixed left-1/2 -translate-x-1/2 px-4 pointer-events-none transition-all duration-300 animate-comms-enter"
          style={{
            bottom: cinematic.letterbox ? '13.5vh' : '92px',
            width: cinematic.letterbox ? 'min(92vw, 660px)' : 'min(92vw, 520px)',
          }}
          data-testid="cinematic-subtitle-bar"
        >
          <div
            className="relative overflow-hidden px-4 py-3 rounded-lg bg-[#0b0f17]/92 border border-white/[0.09]"
            style={{
              boxShadow:
                comms.sender === 'arcadia'
                  ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 36px rgba(0,0,0,0.72), 0 0 24px rgba(220,76,76,0.18)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 36px rgba(0,0,0,0.72)',
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: comms.accentCss }}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-3 mb-1.5 pl-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {comms.sender === 'holotape' ? (
                  <SpinningCassetteIcon />
                ) : (
                  <LiveWaveformCanvas sender={comms.sender} accentCss={comms.accentCss} />
                )}
                <div className="min-w-0">
                  <div
                    className="text-[11px] font-tactical font-bold tracking-[0.14em] truncate"
                    style={{ color: comms.accentCss }}
                  >
                    {comms.speaker}
                  </div>
                  <div className="text-[10px] font-tactical text-[#8490a3] truncate">
                    {comms.role}
                  </div>
                </div>
              </div>

              {comms.lineIndex && comms.lineTotal ? (
                <span className="shrink-0 text-[10px] font-tactical font-bold px-2 py-0.5 rounded bg-[#e89b3c]/15 border border-[#e89b3c]/40 text-[#f6b75e] tabular-nums">
                  LOG {comms.lineIndex}/{comms.lineTotal}
                </span>
              ) : (
                <span
                  className="shrink-0 text-[9px] font-tactical font-bold tracking-[0.16em] uppercase"
                  style={{ color: comms.accentCss }}
                >
                  {comms.sender === 'arcadia'
                    ? 'HOSTILE SIGNAL'
                    : comms.sender === 'holotape'
                      ? 'ARCHIVE PLAYBACK'
                      : 'ENCRYPTED LINK'}
                </span>
              )}
            </div>

            <p
              className="text-xs sm:text-[13.5px] font-medium text-[#f3f5f8] leading-relaxed text-center break-keep"
              style={
                comms.sender === 'arcadia'
                  ? { textShadow: '-1px 0 rgba(220,76,76,0.6), 1px 0 rgba(86,194,255,0.4)' }
                  : { textShadow: '0 2px 6px rgba(0,0,0,0.9)' }
              }
            >
              “{comms.text}”
            </p>
          </div>
        </div>
      )}

      {/* 8) UNIVERSAL [SPACE] SKIP BUTTON — TACTILE SECONDARY FINISH */}
      {cinematic.canSkip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onSkip();
          }}
          data-testid="skip-cinematic-btn"
          className="fixed bottom-[3.2vh] right-6 sm:right-10 z-30 pointer-events-auto game-btn game-btn-secondary px-3.5 py-2 text-xs font-tactical tracking-wider"
        >
          <span className="px-1.5 py-0.5 rounded bg-[#e89b3c] text-[#110c05] text-[10px] font-extrabold leading-none">
            SPACE
          </span>
          <span>건너뛰기</span>
        </button>
      )}
    </div>
  );
};
