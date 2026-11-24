import React from 'react';
import { computeBattleAnalytics } from '../game/analytics';
import { formatClock } from '../game/rules';
import { computeCombatRank, WASTELAND_HOLOTAPES } from '../game/story';
import { GraphicsQuality, HudSnapshot } from '../game/types';
import { GameButton, HudGlyphIcon, RankShieldCrest } from './GameUiKit';

interface PauseModalProps {
  quality: GraphicsQuality;
  sensitivity: number;
  muted: boolean;
  ttsEnabled: boolean;
  onResume: () => void;
  onOpenAnalytics: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onQualityChange: (q: GraphicsQuality) => void;
  onSensitivityChange: (v: number) => void;
  onToggleMute: () => void;
  onToggleTts: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  quality,
  sensitivity,
  muted,
  ttsEnabled,
  onResume,
  onOpenAnalytics,
  onRestart,
  onTitle,
  onQualityChange,
  onSensitivityChange,
  onToggleMute,
  onToggleTts,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="w-full max-w-md game-plaque surface-grain p-6 sm:p-8 animate-panel-in"
      >
        <div className="pb-5 mb-5 border-b border-white/[0.09]">
          <div className="text-[11px] font-tactical font-semibold tracking-[0.2em] text-[#e89b3c] uppercase mb-1">
            SECTOR ZERO · TACTICAL STANDBY
          </div>
          <h2
            id="pause-title"
            className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[#f5f7fb]"
          >
            일시정지
          </h2>
        </div>

        {/* Hairline-divided settings rows with tactile segmented control & physical switches */}
        <div className="divide-y divide-white/[0.07] mb-6 text-xs">
          <div className="py-3.5 flex items-center justify-between text-[#dce4ef] font-medium">
            <span>그래픽 품질</span>
            <div className="segmented-track w-[132px]" role="radiogroup" aria-label="그래픽 품질">
              <div
                className="segmented-thumb"
                style={{
                  width: 'calc(50% - 2px)',
                  transform: quality === 'ultra' ? 'translateX(0%)' : 'translateX(100%)',
                }}
              />
              {(['ultra', 'high'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={quality === q}
                  data-active={quality === q}
                  onClick={() => onQualityChange(q)}
                  className="segmented-item font-tactical"
                >
                  {q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <label className="py-3.5 flex items-center justify-between text-[#dce4ef] font-medium">
            <span>조준 감도</span>
            <div className="flex items-center gap-3">
              <input
                aria-label="일시정지 마우스 감도"
                type="range"
                min={0.4}
                max={2.4}
                step={0.1}
                value={sensitivity}
                onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                className="w-28 tactical-slider"
              />
              <span className="font-tactical font-semibold text-[#f6b75e] w-7 text-right tabular-nums">
                {sensitivity.toFixed(1)}
              </span>
            </div>
          </label>

          <div className="py-3.5 flex items-center justify-between text-[#dce4ef] font-medium">
            <span>오디오 출력</span>
            <div className="flex items-center gap-2.5">
              <span
                className={`text-[11px] font-tactical font-semibold transition-colors ${
                  muted ? 'text-[#f87171]' : 'text-[#cbd5e1]'
                }`}
              >
                {muted ? 'OFF' : 'ON'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!muted}
                aria-label="오디오 출력 전환"
                data-checked={!muted}
                onClick={onToggleMute}
                className="tactical-switch"
              >
                <span className="tactical-switch-thumb" />
              </button>
            </div>
          </div>

          <div className="py-3.5 flex items-center justify-between text-[#dce4ef] font-medium">
            <span>자막 한국어 음성 (TTS)</span>
            <div className="flex items-center gap-2.5">
              <span
                className={`text-[11px] font-tactical font-semibold transition-colors ${
                  ttsEnabled ? 'text-[#f6b75e]' : 'text-[#8c9ab0]'
                }`}
              >
                {ttsEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={ttsEnabled}
                aria-label="한국어 TTS 음성 전환"
                data-checked={ttsEnabled}
                onClick={onToggleTts}
                className="tactical-switch"
              >
                <span className="tactical-switch-thumb" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <GameButton variant="primary" size="lg" fullWidth onClick={onResume}>
            전투 복귀
          </GameButton>
          <GameButton
            variant="secondary"
            size="md"
            fullWidth
            data-testid="pause-analytics-btn"
            onClick={onOpenAnalytics}
          >
            <HudGlyphIcon kind="chart" size={14} />
            전장 분석 차트 (D3)
          </GameButton>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <GameButton variant="ghost" size="sm" fullWidth onClick={onRestart}>
              처음부터 재시작
            </GameButton>
            <GameButton variant="ghost" size="sm" fullWidth onClick={onTitle}>
              타이틀 화면
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DeathModalProps {
  hud: HudSnapshot;
  onOpenAnalytics: () => void;
  onRedeploy: () => void;
  onTitle: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  hud,
  onOpenAnalytics,
  onRedeploy,
  onTitle,
}) => {
  const rank = computeCombatRank(hud.kills, hud.dismembers, hud.executions, hud.survivalTime);
  const metrics = computeBattleAnalytics(hud.kills, hud.dismembers, hud.analytics);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kia-title"
        className="w-full max-w-xl game-plaque surface-grain p-6 sm:p-8 animate-panel-in"
      >
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.09]">
          <div>
            <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#dc4c4c] uppercase tabular-nums">
              MISSION TERMINATED · ACT 0{hud.actNumber} · WAVE {String(hud.wave).padStart(2, '0')}
            </div>
            <h2
              id="kia-title"
              className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-[#f5f7fb] mt-1"
            >
              KIA REPORT
            </h2>
            <p className="text-xs sm:text-sm text-[#a5b4c8] mt-1.5">
              교전 중단 · 사인:{' '}
              <span className="text-[#fca5a5] font-medium">
                {hud.causeOfDeath || 'AI 군단과 교전 중 전사'}
              </span>
            </p>
          </div>

          <RankShieldCrest grade={rank.grade} size={82} />
        </div>

        <div className="py-4 border-b border-white/[0.09]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-[#f5f7fb]">전투 평가 · {rank.title}</span>
            <span className="text-[11px] font-tactical font-semibold text-[#e89b3c] tabular-nums">
              K/D {metrics.kdRatio.toFixed(2)} · 부위파괴 효율 {metrics.dismemberEfficiencyPct}%
            </span>
          </div>
          <p className="text-xs text-[#b4c0d0] leading-relaxed">{rank.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 tabular-nums">
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">생존 시간</div>
            <div className="font-display text-2xl font-bold text-[#f5f7fb] mt-0.5">
              {formatClock(hud.survivalTime)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">AI 파괴</div>
            <div className="font-display text-2xl font-bold text-[#f87171] mt-0.5">{hud.kills}</div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">부위 파괴</div>
            <div className="font-display text-2xl font-bold text-[#e89b3c] mt-0.5">
              {hud.dismembers}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">블랙박스</div>
            <div className="font-display text-2xl font-bold text-[#f6b75e] mt-0.5">
              {hud.holotapesFound}/{hud.holotapesTotal}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <GameButton
            variant="danger"
            size="lg"
            data-start="true"
            onClick={onRedeploy}
            className="flex-1"
          >
            전장 재투입
          </GameButton>
          <GameButton
            variant="secondary"
            size="lg"
            data-testid="open-analytics-btn"
            onClick={onOpenAnalytics}
            className="flex-1"
          >
            <HudGlyphIcon kind="chart" size={14} />
            전장 분석 차트 (D3)
          </GameButton>
          <GameButton variant="ghost" size="lg" onClick={onTitle}>
            타이틀
          </GameButton>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  hud: HudSnapshot;
  onOpenAnalytics: () => void;
  onRedeploy: () => void;
  onTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  hud,
  onOpenAnalytics,
  onRedeploy,
  onTitle,
}) => {
  const metrics = computeBattleAnalytics(hud.kills, hud.dismembers, hud.analytics);
  const truthPct = Math.round(
    (hud.holotapesFound / Math.max(1, hud.holotapesTotal)) * 100
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-6"
      data-testid="victory-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        className="w-full max-w-2xl game-plaque surface-grain !border-[#e89b3c]/45 p-6 sm:p-8 animate-credits-in max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.09]">
          <div>
            <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#e89b3c] uppercase">
              EPILOGUE // DAWN · OPERATION COMPLETE
            </div>
            <h2
              id="victory-title"
              className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[#f5f7fb] mt-1"
            >
              정적과 새벽 · 작전 완수
            </h2>
            <p className="text-xs sm:text-sm text-[#cbd5e1] mt-1.5 break-keep">
              ARCADIA 중앙 AI 서버가 영구 정지되었고, 대기권 너머 궤도 생존자 신호가 응답하고 있습니다.
            </p>
          </div>

          <RankShieldCrest grade="S" size={82} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-white/[0.09] tabular-nums">
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">생존 시간</div>
            <div className="font-display text-2xl font-bold text-[#f5f7fb] mt-0.5">
              {formatClock(hud.survivalTime)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">AI 처치</div>
            <div className="font-display text-2xl font-bold text-[#56c2ff] mt-0.5">{hud.kills}</div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">부위 파괴</div>
            <div className="font-display text-2xl font-bold text-[#e89b3c] mt-0.5">
              {hud.dismembers}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-tactical text-[#8c9ab0] uppercase">진실 해금률</div>
            <div
              className="font-display text-2xl font-bold text-[#f6b75e] mt-0.5"
              data-testid="victory-truth-rate"
            >
              {truthPct}%
            </div>
          </div>
        </div>

        <div className="py-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs tabular-nums">
            <span className="font-semibold text-[#f5f7fb]">
              황무지 홀로테이프 진실 해금 ({hud.holotapesFound} / {hud.holotapesTotal})
            </span>
            <span className="text-[11px] font-tactical text-[#a5b4c8]">
              K/D {metrics.kdRatio.toFixed(2)} · 부위파괴 효율 {metrics.dismemberEfficiencyPct}%
            </span>
          </div>
          <div className="game-bar-track w-full h-1.5 mb-4">
            <div
              className="h-full bg-[#e89b3c] transition-all duration-300"
              style={{ width: `${truthPct}%` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-tactical">
            {WASTELAND_HOLOTAPES.map((tape, idx) => {
              const unlocked = idx < hud.holotapesFound;
              return (
                <div
                  key={tape.id}
                  className={`px-3 py-2 rounded-[6px] flex items-center justify-between gap-2 ${
                    unlocked
                      ? 'bg-[#e89b3c]/12 border border-[#e89b3c]/35 text-[#fde6b8]'
                      : 'bg-white/[0.025] border border-white/[0.06] text-[#8494aa]'
                  }`}
                >
                  <span className="truncate">
                    {tape.code} · {tape.title}
                  </span>
                  <span className={`shrink-0 text-[10px] ${unlocked ? 'text-[#f6b75e] font-semibold' : ''}`}>
                    {unlocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <GameButton
            variant="primary"
            size="lg"
            data-start="true"
            onClick={onRedeploy}
            className="flex-1"
          >
            새 작전 투입
          </GameButton>
          <GameButton
            variant="secondary"
            size="lg"
            data-testid="victory-analytics-btn"
            onClick={onOpenAnalytics}
            className="flex-1"
          >
            <HudGlyphIcon kind="chart" size={14} />
            전장 분석 차트 (D3)
          </GameButton>
          <GameButton variant="ghost" size="lg" onClick={onTitle}>
            타이틀
          </GameButton>
        </div>
      </div>
    </div>
  );
};
