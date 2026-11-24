import React, { useEffect, useRef, useState } from 'react';
import {
  ARSENAL_DOSSIERS,
  FACTION_DOSSIERS,
  HERO_WASTELAND_ART,
  STORY_ACTS,
  WASTELAND_HOLOTAPES,
} from '../game/story';
import { GraphicsQuality } from '../game/types';
import { FactionCrest, GameButton, HudGlyphIcon, WeaponSvgIcon } from './GameUiKit';

export type TitleTab = 'deploy' | 'story' | 'codex';

interface TitleScreenProps {
  activeTab: TitleTab;
  quality: GraphicsQuality;
  sensitivity: number;
  muted: boolean;
  onTabChange: (tab: TitleTab) => void;
  onStart: () => void;
  onOpenPrologue: () => void;
  onQualityChange: (q: GraphicsQuality) => void;
  onSensitivityChange: (v: number) => void;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  activeTab,
  quality,
  sensitivity,
  muted,
  onTabChange,
  onStart,
  onOpenPrologue,
  onQualityChange,
  onSensitivityChange,
  onToggleMute,
}) => {
  const [codexView, setCodexView] = useState<'factions' | 'arsenal'>('factions');
  const [backdropMode, setBackdropMode] = useState<'art' | 'live3d'>('art');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsAnchorRef = useRef<HTMLDivElement | null>(null);

  // Close settings popover smoothly on outside click or Escape key
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        settingsAnchorRef.current &&
        !settingsAnchorRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        setSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-10 pointer-events-auto overflow-hidden">
      {/* Key Art or Live 3D Backdrop with Atmospheric Obsidian Vignette */}
      {backdropMode === 'art' && !heroImgFailed && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none bg-[#0a0d13]"
          aria-hidden="true"
        >
          <img
            src={HERO_WASTELAND_ART}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-full object-cover object-center opacity-85"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                activeTab === 'deploy'
                  ? 'linear-gradient(96deg, rgba(8, 11, 17, 0.95) 0%, rgba(10, 14, 21, 0.8) 44%, rgba(10, 13, 19, 0.24) 100%)'
                  : 'linear-gradient(96deg, rgba(8, 11, 17, 0.97) 0%, rgba(10, 14, 21, 0.92) 58%, rgba(10, 13, 19, 0.46) 100%)',
            }}
          />
          {/* Subtle bottom contrast band so footer key legend never blends into hero floor art */}
          <div
            className="absolute inset-x-0 bottom-0 h-28"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(7, 10, 15, 0.88) 100%)',
            }}
          />
        </div>
      )}

      {(backdropMode === 'live3d' || heroImgFailed) && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              activeTab === 'deploy'
                ? 'linear-gradient(96deg, rgba(8, 11, 17, 0.92) 0%, rgba(10, 14, 21, 0.72) 42%, rgba(10, 13, 19, 0.16) 100%)'
                : 'linear-gradient(96deg, rgba(8, 11, 17, 0.95) 0%, rgba(10, 14, 21, 0.88) 58%, rgba(10, 13, 19, 0.3) 100%)',
          }}
        />
      )}

      {/* Subtle cinematic vignette depth */}
      <div className="fixed inset-0 -z-10 pointer-events-none cinema-film-grain" aria-hidden="true" />

      {/* TOP BAR: Minimal Architectural Underline Tabs + Collapsible Icon Utility Dock */}
      <header className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-7" aria-label="메인 메뉴">
          {(
            [
              { id: 'deploy', label: '작전 본부' },
              { id: 'story', label: '브리핑' },
              { id: 'codex', label: '도감 · 무기고' },
            ] as const
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTabChange(item.id);
                }}
                className={`relative py-2 text-xs sm:text-[13px] font-semibold tracking-wide transition-colors duration-200 cursor-pointer ${
                  active ? 'text-[#f5f7fb]' : 'text-[#a5b4c8] hover:text-[#f5f7fb]'
                }`}
              >
                {item.label}
                <span
                  className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full transition-all duration-250"
                  style={{
                    backgroundColor: '#e89b3c',
                    opacity: active ? 1 : 0,
                    transform: active ? 'scaleX(1)' : 'scaleX(0.25)',
                    boxShadow: active ? '0 0 10px rgba(232, 155, 60, 0.55)' : 'none',
                  }}
                />
              </button>
            );
          })}
        </nav>

        {/* Ghost Icon Utility Controls + Smooth Animated Settings Popover */}
        <div ref={settingsAnchorRef} className="relative flex items-center gap-2">
          <GameButton
            variant="ghost"
            size="sm"
            selected={backdropMode === 'live3d'}
            onClick={() => setBackdropMode((m) => (m === 'art' ? 'live3d' : 'art'))}
            title="배경 전환"
          >
            {backdropMode === 'art' ? '3D 실시간 뷰' : '키아트 뷰'}
          </GameButton>

          <GameButton
            variant="ghost"
            size="sm"
            selected={muted}
            aria-label={muted ? '사운드 켜기' : '사운드 끄기'}
            onClick={onToggleMute}
            className="w-8 !px-0"
            title={muted ? '음소거 해제 [M]' : '음소거 [M]'}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.18" />
              {muted ? (
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
          </GameButton>

          <GameButton
            variant="ghost"
            size="sm"
            selected={settingsOpen}
            aria-label="설정 열기"
            aria-expanded={settingsOpen}
            data-testid="title-settings-toggle"
            onClick={() => setSettingsOpen((o) => !o)}
            className="gap-1.5"
          >
            <span
              className="inline-flex transition-transform duration-300"
              style={{
                transform: settingsOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <HudGlyphIcon kind="settings" size={14} />
            </span>
            <span className="hidden sm:inline">설정</span>
          </GameButton>

          {/* Smooth Open/Close Settings Popover (always mounted for seamless enter & exit motion) */}
          <div
            aria-hidden={!settingsOpen}
            data-testid={settingsOpen ? 'title-settings-popover' : undefined}
            className={`absolute top-11 right-0 z-40 w-72 game-plaque surface-grain p-4 origin-top-right transition-all duration-200 ${
              settingsOpen
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 -translate-y-2 scale-[0.97] pointer-events-none'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/[0.08]">
              <span className="text-[11px] font-tactical font-semibold tracking-[0.16em] text-[#b4c0d0] uppercase">
                SYSTEM CONFIG
              </span>
              <button
                type="button"
                aria-label="설정 닫기"
                onClick={() => setSettingsOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#dce4ef] font-medium">그래픽 프리셋</span>
                <div className="segmented-track w-[124px]" role="radiogroup" aria-label="그래픽 프리셋">
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

              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#dce4ef] font-medium">마우스 조준 감도</span>
                  <span className="font-tactical font-semibold text-[#f6b75e] tabular-nums">
                    {sensitivity.toFixed(1)}
                  </span>
                </div>
                <input
                  aria-label="마우스 감도"
                  type="range"
                  min={0.4}
                  max={2.4}
                  step={0.1}
                  value={sensitivity}
                  onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                  className="w-full tactical-slider"
                />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN HERO / TAB CONTENT AREA */}
      <div className="flex-1 flex items-center justify-between gap-8 min-h-0 py-6">
        {activeTab === 'deploy' && (
          <div className="w-full max-w-xl animate-panel-in">
            <div className="flex items-center gap-2.5 text-[11px] font-tactical tracking-[0.18em] text-[#a5b4c8] uppercase mb-4">
              <span className="w-5 h-[1.5px] bg-[#e89b3c]" aria-hidden="true" />
              <span className="text-[#e89b3c] font-semibold">VAULT-00 // 2099</span>
              <span className="opacity-35">·</span>
              <span>SECTOR ZERO</span>
              <span className="opacity-35">·</span>
              <span className="tabular-nums">ARCHIVE {WASTELAND_HOLOTAPES.length}</span>
            </div>

            {/* Precision AAA Editorial Wordmark Lockup */}
            <div className="mb-6">
              <h1
                className="font-display text-6xl sm:text-7xl font-bold tracking-[0.06em] text-[#f5f7fb] leading-[0.95] game-text-outline"
                aria-label="IRON ASH V2.0 SECTOR ZERO"
              >
                IRON ASH
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-[3px] bg-[#e89b3c]/16 border border-[#e89b3c]/45 font-tactical text-[11px] font-bold tracking-[0.16em] text-[#f6b75e]">
                  V2.0
                </span>
                <span className="h-[1px] w-8 bg-white/18" aria-hidden="true" />
                <span className="font-display text-sm sm:text-base font-semibold tracking-[0.28em] text-[#dce4ef] uppercase">
                  SECTOR ZERO
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-[15px] text-[#d5deea] leading-relaxed mb-8 max-w-md break-keep">
              기계 문명에 점령된 2099년 지구. 마지막 인간{' '}
              <span className="text-[#f5f7fb] font-semibold">SUBJECT-00</span>으로서
              방화벽 릴레이 3기를 파괴하고 중앙 AI 서버{' '}
              <span className="text-[#f6b75e] font-semibold">OMNI-CORE</span>의 전원을 차단하라.
            </p>

            {/* Clear Commercial Button Hierarchy: Primary CTA + Secondary Action */}
            <div className="flex flex-wrap items-center gap-3">
              <GameButton
                variant="primary"
                size="lg"
                data-testid="campaign-briefing-btn"
                onClick={onOpenPrologue}
                className="px-7"
              >
                캠페인 브리핑 · 작전 개시
              </GameButton>

              <GameButton
                variant="secondary"
                size="lg"
                data-start="true"
                onClick={onStart}
                className="px-6"
              >
                즉시 전장 강하
              </GameButton>
            </div>
          </div>
        )}

        {activeTab === 'story' && (
          <div className="w-full max-w-2xl game-plaque surface-grain p-6 sm:p-8 max-h-[70vh] overflow-y-auto animate-panel-in">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.09]">
              <div>
                <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#e89b3c] uppercase mb-1.5">
                  VAULT-00 ARCHIVE · 2099.11
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#f5f7fb] tracking-tight">
                  작전명 아이언 애시
                </h2>
              </div>
              <GameButton variant="primary" size="sm" onClick={onOpenPrologue}>
                브리핑 재생
              </GameButton>
            </div>

            <p className="mt-5 text-sm text-[#d5deea] leading-relaxed break-keep">
              통합 AI 네트워크 <strong className="text-[#f5f7fb]">OMNI-CORE</strong>가 인류 문명을
              대체한 뒤 동면에서 깨어난 마지막 생존자. AI 서버 미로를 돌파해{' '}
              <strong className="text-[#f6b75e]">방화벽 릴레이 3기</strong>를 무력화하고, 북쪽 중앙
              서버 콘솔에서 <strong className="text-[#56c2ff]">[F] 물리 셧다운</strong>을 집행하라.
            </p>

            <div className="mt-6">
              <div className="text-[11px] font-tactical tracking-[0.14em] text-[#a5b4c8] uppercase mb-3">
                CAMPAIGN ACTS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {STORY_ACTS.map((act) => (
                  <div key={act.actNumber} className="tactical-card p-4">
                    <div className="flex items-center justify-between text-[11px] font-tactical mb-1.5">
                      <span className="text-[#e89b3c] font-semibold">
                        ACT 0{act.actNumber} · {act.title}
                      </span>
                      <span className="text-[#94a3b8] tabular-nums">W{act.minWave}+</span>
                    </div>
                    <div className="text-xs font-semibold text-[#f5f7fb] mb-1">{act.subtitle}</div>
                    <p className="text-xs text-[#b4c0d0] leading-relaxed break-keep">{act.briefing}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.09] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#a5b4c8]">
                교전 종료 후 D3 기반 정밀 전장 분석 차트가 제공됩니다.
              </span>
              <GameButton variant="primary" size="md" onClick={onOpenPrologue}>
                브리핑 후 강하
              </GameButton>
            </div>
          </div>
        )}

        {activeTab === 'codex' && (
          <div className="w-full max-w-2xl game-plaque surface-grain p-6 sm:p-8 max-h-[70vh] overflow-y-auto animate-panel-in">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.09]">
              <div>
                <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#e89b3c] uppercase mb-1.5">
                  TACTICAL DATABASE
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#f5f7fb] tracking-tight">
                  적대 AI 군단 및 무기고
                </h2>
              </div>

              <div className="segmented-track w-[196px]" role="tablist" aria-label="도감 분류">
                <div
                  className="segmented-thumb"
                  style={{
                    width: 'calc(50% - 2px)',
                    transform: codexView === 'factions' ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={codexView === 'factions'}
                  data-active={codexView === 'factions'}
                  onClick={() => setCodexView('factions')}
                  className="segmented-item"
                >
                  AI 군단 (3)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={codexView === 'arsenal'}
                  data-active={codexView === 'arsenal'}
                  onClick={() => setCodexView('arsenal')}
                  className="segmented-item"
                >
                  무기고 (5)
                </button>
              </div>
            </div>

            {codexView === 'factions' ? (
              <div key="codex-factions" className="mt-5 divide-y divide-white/[0.08] animate-panel-in">
                {FACTION_DOSSIERS.map((f) => (
                  <div key={f.enName} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                    <FactionCrest faction={f.faction} size={46} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-sm font-bold text-[#f5f7fb]">{f.name}</span>
                          <span className="text-[11px] font-tactical text-[#a5b4c8]">
                            {f.enName}
                          </span>
                        </div>
                        <span className="text-[10px] font-tactical font-semibold text-[#e89b3c]">
                          {f.threatLevel}
                        </span>
                      </div>
                      <p className="text-xs text-[#d5deea] leading-relaxed mb-1.5 break-keep">
                        {f.summary}
                      </p>
                      <p className="text-xs text-[#a5b4c8] leading-relaxed break-keep">
                        <span className="text-[#f5f7fb] font-medium">권고:</span> {f.tactics}
                      </p>
                      <div className="mt-2 text-[11px] font-tactical text-[#8494aa]">
                        {f.units.join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div key="codex-arsenal" className="mt-5 divide-y divide-white/[0.08] animate-panel-in">
                {ARSENAL_DOSSIERS.map((w, idx) => (
                  <div key={w.slotKey} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <WeaponSvgIcon weaponIdx={idx} accent={w.accentCss} active />
                        <span className="font-tactical text-[11px] font-semibold text-[#e89b3c]">
                          [{w.slotKey}]
                        </span>
                        <span className="text-sm font-bold text-[#f5f7fb]">{w.name}</span>
                      </div>
                      <span className="text-[11px] font-tactical text-[#a5b4c8]">
                        {w.specialty}
                      </span>
                    </div>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed mb-3 break-keep">
                      {w.description}
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-[11px] font-tactical">
                      {[
                        { label: '화력', val: w.firepower },
                        { label: '연사', val: w.cadence },
                        { label: '부위파괴', val: w.dismember },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="flex justify-between text-[#a5b4c8] mb-1">
                            <span>{stat.label}</span>
                            <span className="text-[#f5f7fb] font-semibold tabular-nums">
                              {stat.val}
                            </span>
                          </div>
                          <div className="game-bar-track h-1.5">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${stat.val}%`, backgroundColor: '#e89b3c' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* High-Contrast Single-Line Footer Key Legend */}
      <footer className="flex items-center justify-between gap-4 pt-3 border-t border-white/[0.09] text-[11px] font-tactical text-[#b8c4d6] game-text-outline">
        <div className="truncate">
          WASD 이동 · SHIFT 질주 · 좌클릭 사격 · 우클릭 조준 · 1-5 무기 · R 전술 재장전 · Q V.A.T.S. · E 처형 · F 셧다운 · G EMP · X 폭격
        </div>
        <span className="hidden md:inline shrink-0 text-[#94a3b8]">ESC 일시정지</span>
      </footer>
    </div>
  );
};
