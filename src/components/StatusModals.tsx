import React, { useState } from 'react';
import { computeBattleAnalytics } from '../game/analytics';
import { formatClock } from '../game/rules';
import { computeCombatRank, ENDING_PROFILES, WASTELAND_HOLOTAPES } from '../game/story';
import { GraphicsQuality, HudSnapshot } from '../game/types';
import { GameButton, HudGlyphIcon, Keycap, RankShieldCrest, ThreatStarRow } from './GameUiKit';

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

const CONTROL_ITEMS: Array<{
  keys: string;
  label: string;
  tone?: 'default' | 'signal' | 'cyan' | 'amber' | 'emerald';
}> = [
  { keys: 'WASD', label: '전술 이동 · 2층 상가/고가도로 진입' },
  { keys: 'RMB', label: '투명 스코프 조준 · 엄폐물 자동 마운팅', tone: 'cyan' },
  { keys: 'Q / E', label: '조준 중 좌우 피킹 / V.A.T.S. · 글로리 킬', tone: 'emerald' },
  { keys: 'SHIFT', label: '질주 / 조준 중 호흡 고정', tone: 'cyan' },
  { keys: 'C', label: '엑소 대시 · 파워 슬라이드', tone: 'cyan' },
  { keys: '1-6', label: '6종 중화기 전환', tone: 'amber' },
  { keys: 'R', label: '전술 재장전 (-20%)' },
  { keys: 'H', label: '세라믹 방탄판 교체 / 전차 긴급 수리', tone: 'cyan' },
  { keys: 'B', label: 'M18 연막탄 / 전차 적외선 연막 발사', tone: 'emerald' },
  { keys: 'F', label: 'K2-X 전차 탑승·하차 / 브리칭 / 포탑 해킹', tone: 'cyan' },
  { keys: 'SPACE', label: '점프 / 전차 12.7mm 동축 기관총 사격', tone: 'amber' },
  { keys: 'T', label: '3D 총기 각인·탄창 살펴보기', tone: 'amber' },
  { keys: 'V', label: '발키리 궤도 보급 · 방탄판/연막 보충', tone: 'emerald' },
  { keys: 'G / X', label: 'EMP 수류탄 / 궤도 폭격', tone: 'amber' },
];

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
  const [tab, setTab] = useState<'config' | 'controls'>('config');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="w-full max-w-md game-plaque p-6 sm:p-7 animate-panel-in max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-end justify-between gap-3 pb-4 mb-5 border-b border-white/[0.09]">
          <div>
            <div className="text-[10.5px] font-tactical font-semibold tracking-[0.2em] text-[#ff6242] uppercase mb-1">
              IRON ASH III · TACTICAL STANDBY
            </div>
            <h2
              id="pause-title"
              className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[#f5f7fb]"
            >
              일시정지
            </h2>
          </div>

          <div className="segmented-track w-[166px]" role="tablist" aria-label="일시정지 탭">
            <div
              className="segmented-thumb"
              style={{
                width: 'calc(50% - 2px)',
                transform: tab === 'config' ? 'translateX(0%)' : 'translateX(100%)',
              }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'config'}
              data-active={tab === 'config'}
              onClick={() => setTab('config')}
              className="segmented-item"
            >
              설정
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'controls'}
              data-active={tab === 'controls'}
              onClick={() => setTab('controls')}
              className="segmented-item"
            >
              조작법
            </button>
          </div>
        </div>

        {tab === 'config' ? (
          <div className="divide-y divide-white/[0.07] mb-6 text-xs animate-panel-in">
            <div className="py-3.5">
              <div className="flex items-center justify-between text-[#dce4ef] font-medium">
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
              <p className="mt-1.5 text-[10.5px] text-[#8c9ab0]">
                {quality === 'ultra'
                  ? '실시간 GTAO 접지 음영 · 볼류메트릭 유증기/스팀 · 2048px 그림자 · 실내외 노출 적응'
                  : '고프레임 경량화 모드 (그림자/안개/빗줄기 절전)'}
              </p>
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
              <span>무전 통신 오디오</span>
              <span className="text-[11px] font-tactical font-semibold text-[#2ee6a6]">
                VHF 스퀠치 · 자막 전용
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 animate-panel-in">
            {CONTROL_ITEMS.map((item) => (
              <div
                key={item.keys}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]"
              >
                <span className="text-[11px] text-[#d5deea] truncate">{item.label}</span>
                <Keycap size="xs" tone={item.tone}>
                  {item.keys}
                </Keycap>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <GameButton variant="primary" size="lg" fullWidth onClick={onResume}>
            <span>전투 복귀</span>
            <Keycap size="xs">ESC</Keycap>
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
    <div className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kia-title"
        className="w-full max-w-xl game-plaque p-6 sm:p-8 animate-panel-in"
      >
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.09]">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#ff6242] uppercase tabular-nums">
                MISSION TERMINATED · WAVE {String(hud.wave).padStart(2, '0')}
              </span>
              <ThreatStarRow level={hud.threatLevel} />
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
            <span className="text-[11px] font-tactical font-semibold text-[#f6b75e] tabular-nums">
              K/D {metrics.kdRatio.toFixed(2)} · 부위파괴 효율 {metrics.dismemberEfficiencyPct}%
            </span>
          </div>
          <p className="text-xs text-[#b4c0d0] leading-relaxed">{rank.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-5 tabular-nums">
          {[
            { label: '생존 시간', val: formatClock(hud.survivalTime), color: '#f8fafc' },
            { label: 'AI 파괴', val: String(hud.kills), color: '#ff6242' },
            { label: '부위 파괴', val: String(hud.dismembers), color: '#f5b342' },
            {
              label: '블랙박스',
              val: `${hud.holotapesFound}/${hud.holotapesTotal}`,
              color: '#38d9ff',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]"
            >
              <div className="text-[9.5px] font-tactical text-[#8c9ab0] uppercase">{stat.label}</div>
              <div
                className="font-display text-2xl font-bold mt-0.5 leading-none"
                style={{ color: stat.color }}
              >
                {stat.val}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
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
  onReplayChoice: () => void;
  onTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  hud,
  onOpenAnalytics,
  onRedeploy,
  onReplayChoice,
  onTitle,
}) => {
  const [selectedTapeId, setSelectedTapeId] = useState<string | null>(null);
  const metrics = computeBattleAnalytics(hud.kills, hud.dismembers, hud.analytics);
  const truthPct = Math.round(
    (hud.holotapesFound / Math.max(1, hud.holotapesTotal)) * 100
  );
  const ending = ENDING_PROFILES[hud.endingId ?? 'dawn'];
  const selectedTape = WASTELAND_HOLOTAPES.find((t) => t.id === selectedTapeId) ?? null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-4 sm:p-6"
      data-testid="victory-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        className="w-full max-w-3xl game-plaque overflow-hidden animate-credits-in max-h-[92vh] overflow-y-auto"
        style={{
          borderColor: `${ending.accentCss}55`,
          boxShadow: `0 32px 72px -16px rgba(0,0,0,0.9), 0 0 42px -18px ${ending.accentCss}55`,
        }}
      >
        {/* Full-Bleed Ending Key Art Banner */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-[#07090d]">
          <img
            src={ending.imageUrl}
            alt={ending.title}
            className="w-full h-full object-cover object-center animate-ken-burns"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,10,16,0.18) 0%, rgba(10,12,18,0.68) 64%, rgba(11,14,21,0.99) 100%)',
            }}
          />
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <div
                className="text-[11px] font-tactical font-bold tracking-[0.2em] uppercase"
                style={{ color: ending.accentCss }}
              >
                {ending.code}
              </div>
              <h2
                id="victory-title"
                className="font-display text-3xl sm:text-4xl font-extrabold tracking-wide text-[#f8fafc] mt-0.5 game-text-outline"
              >
                {ending.epilogueTitle}
              </h2>
            </div>
            <RankShieldCrest grade="S" size={72} />
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {hud.autoEndingReason && (
            <div
              className="mb-4 px-4 py-3 rounded-xl bg-white/[0.04] border-l-2 text-xs text-[#e2e8f0] leading-snug break-keep"
              style={{ borderLeftColor: ending.accentCss }}
              data-testid="victory-auto-ending-reason"
            >
              <div
                className="font-tactical text-[9.5px] font-bold tracking-[0.14em] uppercase mb-0.5"
                style={{ color: ending.accentCss }}
              >
                CAMPAIGN CHOICES RESOLUTION
              </div>
              {hud.autoEndingReason}
            </div>
          )}

          <div className="space-y-2 pb-5 border-b border-white/[0.09] text-xs sm:text-sm text-[#d5deea] leading-relaxed break-keep">
            {ending.epilogueBody.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4 border-b border-white/[0.09] tabular-nums">
            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-[9.5px] font-tactical text-[#8c9ab0] uppercase">생존 시간</div>
              <div className="font-display text-2xl font-bold text-[#f8fafc] mt-0.5 leading-none">
                {formatClock(hud.survivalTime)}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-[9.5px] font-tactical text-[#8c9ab0] uppercase">AI 처치</div>
              <div className="font-display text-2xl font-bold text-[#38d9ff] mt-0.5 leading-none">
                {hud.kills}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-[9.5px] font-tactical text-[#8c9ab0] uppercase">부위 파괴</div>
              <div className="font-display text-2xl font-bold text-[#f5b342] mt-0.5 leading-none">
                {hud.dismembers}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-[9.5px] font-tactical text-[#8c9ab0] uppercase">진실 해금률</div>
              <div
                className="font-display text-2xl font-bold text-[#2ee6a6] mt-0.5 leading-none"
                data-testid="victory-truth-rate"
              >
                {truthPct}%
              </div>
            </div>
          </div>

          <div className="py-4 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs tabular-nums">
              <span className="font-semibold text-[#f5f7fb]">
                블랙박스 진실 아카이브 ({hud.holotapesFound} / {hud.holotapesTotal})
              </span>
              <span className="text-[11px] font-tactical text-[#a5b4c8]">
                칭호: <b style={{ color: ending.accentCss }}>{ending.rankTitle}</b> · K/D{' '}
                {metrics.kdRatio.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-tactical">
              {WASTELAND_HOLOTAPES.map((tape, idx) => {
                const unlocked =
                  hud.unlockedHolotapeIds.includes(tape.id) || idx < hud.holotapesFound;
                const active = selectedTapeId === tape.id;
                return (
                  <button
                    key={tape.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setSelectedTapeId(active ? null : tape.id)}
                    className={`px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors ${
                      unlocked
                        ? active
                          ? 'bg-[#f5b342]/24 border border-[#f5b342]/80 text-[#fff6dc] cursor-pointer'
                          : 'bg-[#f5b342]/10 hover:bg-[#f5b342]/18 border border-[#f5b342]/35 text-[#fde6b8] cursor-pointer'
                        : 'bg-white/[0.03] border border-white/[0.07] text-[#7c889c] cursor-default'
                    }`}
                  >
                    <span className="truncate">
                      {tape.code} · {tape.title}
                    </span>
                    <span
                      className={`shrink-0 text-[9.5px] ${
                        unlocked ? 'text-[#f6b75e] font-bold' : ''
                      }`}
                    >
                      {unlocked ? (active ? 'VIEWING' : 'UNLOCKED') : 'LOCKED'}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedTape && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-[#070b14]/88 border border-[#f5b342]/40 text-xs animate-panel-in">
                <div className="flex items-center justify-between text-[10px] font-tactical text-[#f6b75e] mb-1">
                  <span>
                    {selectedTape.code} · {selectedTape.title}
                  </span>
                  <span className="text-[#9aa8bd]">
                    {selectedTape.speaker} ({selectedTape.role})
                  </span>
                </div>
                <p className="text-[#e2e8f0] leading-relaxed break-keep">“{selectedTape.logText}”</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <GameButton
              variant="primary"
              size="lg"
              data-start="true"
              onClick={onRedeploy}
              className="flex-1 min-w-[140px]"
            >
              새 작전 투입
            </GameButton>
            <GameButton
              variant="secondary"
              size="lg"
              onClick={onReplayChoice}
              className="flex-1 min-w-[150px]"
            >
              다른 엔딩 분기 체험
            </GameButton>
            <GameButton
              variant="secondary"
              size="lg"
              data-testid="victory-analytics-btn"
              onClick={onOpenAnalytics}
            >
              <HudGlyphIcon kind="chart" size={14} />
              D3 분석
            </GameButton>
            <GameButton variant="ghost" size="lg" onClick={onTitle}>
              타이틀
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
};
