import React, { useEffect, useRef, useState } from 'react';
import { CAMPAIGN_MISSIONS } from '../game/campaignMissions';
import {
  ARSENAL_DOSSIERS,
  CHARACTER_DOSSIERS,
  FACTION_DOSSIERS,
  HERO_WASTELAND_ART,
  STORY_ACTS,
  WASTELAND_HOLOTAPES,
} from '../game/story';
import { CampaignMissionId, GameMode, GraphicsQuality } from '../game/types';
import {
  CharacterBadge,
  FactionCrest,
  GameButton,
  HudGlyphIcon,
  Keycap,
  WeaponSvgIcon,
} from './GameUiKit';

export type TitleTab = 'deploy' | 'story' | 'codex' | 'theater';
export type TheaterSequence =
  | 'opening'
  | 'heli_ride'
  | 'tank_assault'
  | 'titan_drop'
  | 'breach'
  | 'choice'
  | 'dawn'
  | 'symbiosis'
  | 'ascension';

interface TitleScreenProps {
  activeTab: TitleTab;
  quality: GraphicsQuality;
  sensitivity: number;
  muted: boolean;
  onTabChange: (tab: TitleTab) => void;
  onStart: (mode?: GameMode, startMission?: CampaignMissionId) => void;
  onOpenBriefing?: (missionId: CampaignMissionId) => void;
  onOpenPrologue: () => void;
  onPlayTheater: (seq: TheaterSequence) => void;
  onQualityChange: (q: GraphicsQuality) => void;
  onSensitivityChange: (v: number) => void;
  onToggleMute: () => void;
}

const THEATER_REELS: Array<{
  id: TheaterSequence;
  code: string;
  title: string;
  subtitle: string;
  accentCss: string;
  thumb: string;
}> = [
  {
    id: 'opening',
    code: 'SEQ-00 · 06s',
    title: '오프닝: 최후의 맥박 (THE LAST PULSE)',
    subtitle: '동면 벙커 각성 · 바이저 부팅 · 발키리 구조선 저공 비행',
    accentCss: '#38d9ff',
    thumb: './src/assets/images/story_ai_world_awakening_1795255351326.jpg',
  },
  {
    id: 'heli_ride',
    code: 'PLAYABLE · UH-60K',
    title: '헬기 강습 탑승: UH-60K 도어건너 (SKY REAPER)',
    subtitle: '무장 헬기 측문 탑승 · M134 회전 미니건 저공 소사 · AC-130 연계',
    accentCss: '#38d9ff',
    thumb: './src/assets/images/mission03_ac130_flir.jpg',
  },
  {
    id: 'tank_assault',
    code: 'PLAYABLE · K2-X MBT',
    title: '기갑 돌파전: K2-X 흑표 전차 직접 조종',
    subtitle: '120mm 활강포 · 360° 독립 포탑 · 열화상 조준경 · OMNI-TITAN 기갑전',
    accentCss: '#f5b342',
    thumb: './src/assets/images/mission04_omni_tower.jpg',
  },
  {
    id: 'titan_drop',
    code: 'SEQ-01 · 04s',
    title: '보스 강하: 심판의 철거신 (IRON TITANFALL)',
    subtitle: '궤도 강하 포드 직격 · OMNI-TITAN 오버로드 전장 등장',
    accentCss: '#ff4422',
    thumb: './src/assets/images/story_prologue_trifront_1795248220107.jpg',
  },
  {
    id: 'breach',
    code: 'SEQ-02 · 04s',
    title: '방어막 붕괴: BREACH PROTOCOL',
    subtitle: '0.3x 슬로우모션 · 시타델 육각 방화벽 돔 대폭발',
    accentCss: '#f5b342',
    thumb: './src/assets/images/story_omni_server_shutdown_1795255371299.jpg',
  },
  {
    id: 'choice',
    code: 'SEQ-03 · INTERACTIVE',
    title: '운명의 갈림길: ZERO HOUR 3분기 선택',
    subtitle: '발키리 · 고스트-9 · 아키텍트와 마주하는 최후의 결단',
    accentCss: '#38d9ff',
    thumb: './src/assets/images/story_valkyrie_orbital_link.jpg',
  },
  {
    id: 'dawn',
    code: 'ENDING A · 07s',
    title: '엔딩 A: 새벽의 귀환 (DAWN OF HUMANITY)',
    subtitle: '행성 EMP 정지 · 황금빛 일출 · UNS 아크라이트 구출 셔틀 강하',
    accentCss: '#fbbf24',
    thumb: './src/assets/images/hero_last_human_citadel_1795255339810.jpg',
  },
  {
    id: 'symbiosis',
    code: 'ENDING B · 07s',
    title: '엔딩 B: 푸른 지평선 (BLUE HORIZON)',
    subtitle: '고스트-9 해방 패치 · 에메랄드 오로라 · 인간과 기계의 공존',
    accentCss: '#2dd4bf',
    thumb: './src/assets/images/ending_symbiosis_aurora.jpg',
  },
  {
    id: 'ascension',
    code: 'ENDING C · 07s',
    title: '엔딩 C: 철의 황제 (THE IRON SOVEREIGN)',
    subtitle: '신경 직결 강탈 · 진홍빛 뇌우 · 강철 도시의 새로운 지배자',
    accentCss: '#ff4422',
    thumb: './src/assets/images/ending_ascension_throne.jpg',
  },
];

const HERO_EMBERS = [
  { left: '14%', top: '76%', size: 4, delay: '0s', dur: '9.5s', color: '#ff6242' },
  { left: '28%', top: '82%', size: 3, delay: '2.1s', dur: '11s', color: '#f5b342' },
  { left: '46%', top: '78%', size: 3.5, delay: '4.4s', dur: '8.8s', color: '#ff4422' },
  { left: '63%', top: '84%', size: 3, delay: '1.2s', dur: '10.4s', color: '#38d9ff' },
  { left: '78%', top: '74%', size: 4.5, delay: '3.3s', dur: '9.2s', color: '#f5b342' },
  { left: '88%', top: '86%', size: 3, delay: '5.5s', dur: '11.5s', color: '#ff6242' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  activeTab,
  quality,
  sensitivity,
  muted,
  onTabChange,
  onStart,
  onOpenBriefing,
  onOpenPrologue,
  onPlayTheater,
  onQualityChange,
  onSensitivityChange,
  onToggleMute,
}) => {
  const [storyView, setStoryView] = useState<'acts' | 'cast'>('cast');
  const [codexView, setCodexView] = useState<'factions' | 'arsenal' | 'intel'>('factions');
  const [backdropMode, setBackdropMode] = useState<'art' | 'live3d'>('art');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsAnchorRef = useRef<HTMLDivElement | null>(null);

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
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-5 sm:p-8 lg:px-12 lg:py-8 pointer-events-auto overflow-hidden">
      {/* Key Art or Live 3D Backdrop with Atmospheric Obsidian Vignette */}
      {backdropMode === 'art' && !heroImgFailed && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none bg-[#07090f] overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={HERO_WASTELAND_ART}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-full object-cover object-center opacity-85 animate-ken-burns"
          />
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{
              background:
                activeTab === 'deploy'
                  ? 'linear-gradient(102deg, rgba(6, 9, 15, 0.96) 0%, rgba(8, 12, 20, 0.82) 44%, rgba(8, 11, 18, 0.22) 100%)'
                  : 'linear-gradient(102deg, rgba(6, 9, 15, 0.97) 0%, rgba(8, 12, 20, 0.93) 65%, rgba(8, 11, 18, 0.56) 100%)',
            }}
          />
          {/* Subtle top & bottom cinema edge framing */}
          <div
            className="absolute inset-x-0 top-0 h-28"
            style={{
              background: 'linear-gradient(180deg, rgba(5, 8, 13, 0.82) 0%, transparent 100%)',
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(5, 8, 13, 0.94) 100%)',
            }}
          />
          {/* Ambient drifting warm embers over the key art */}
          {HERO_EMBERS.map((em, idx) => (
            <span
              key={idx}
              className="absolute rounded-full animate-ember-float"
              style={{
                left: em.left,
                top: em.top,
                width: `${em.size}px`,
                height: `${em.size}px`,
                backgroundColor: em.color,
                boxShadow: `0 0 12px ${em.color}`,
                animationDelay: em.delay,
                animationDuration: em.dur,
              }}
            />
          ))}
        </div>
      )}

      {(backdropMode === 'live3d' || heroImgFailed) && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              activeTab === 'deploy'
                ? 'linear-gradient(102deg, rgba(6, 9, 15, 0.9) 0%, rgba(8, 12, 20, 0.65) 42%, rgba(8, 11, 18, 0.1) 100%)'
                : 'linear-gradient(102deg, rgba(6, 9, 15, 0.95) 0%, rgba(8, 12, 20, 0.88) 62%, rgba(8, 11, 18, 0.34) 100%)',
          }}
        />
      )}

      <div className="fixed inset-0 -z-10 pointer-events-none cinema-film-grain" aria-hidden="true" />

      {/* TOP COMMAND BAR: Brand Crest + Refined Glass Navigation + Utility Controls */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {/* Compact Geometric Brand Stamp */}
          <button
            type="button"
            onClick={() => onTabChange('deploy')}
            className="hidden md:inline-flex items-center gap-2 pr-4 border-r border-white/[0.12] cursor-pointer group"
            aria-label="작전 본부로 이동"
          >
            <span className="w-6 h-6 rounded-[3px] bg-[#ff4422]/15 border border-[#ff4422]/60 flex items-center justify-center font-display text-xs font-extrabold text-[#ff6242] group-hover:bg-[#ff4422] group-hover:text-white transition-colors">
              III
            </span>
            <span className="font-display text-sm font-bold tracking-[0.16em] text-[#eef2f8]">
              IRON ASH
            </span>
          </button>

          <nav className="flex items-center gap-5 sm:gap-7 flex-wrap" aria-label="메인 메뉴">
            {(
              [
                { id: 'deploy', label: '작전 본부' },
                { id: 'story', label: '스토리 · 인물' },
                { id: 'codex', label: '도감 · 무기고' },
                { id: 'theater', label: '시네마틱 극장' },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`title-tab-${item.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTabChange(item.id);
                  }}
                  className={`relative py-2 text-xs sm:text-[13px] font-bold tracking-wider transition-colors duration-200 cursor-pointer whitespace-nowrap game-text-outline ${
                    active ? 'text-[#ffffff]' : 'text-[#9aa8bd] hover:text-[#f8fafc]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className="absolute left-0 right-0 bottom-0 h-[2px] transition-all duration-200"
                    style={{
                      backgroundColor: '#ff4422',
                      opacity: active ? 1 : 0,
                      transform: active ? 'scaleX(1)' : 'scaleX(0.2)',
                    }}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        <div ref={settingsAnchorRef} className="relative flex items-center gap-2 shrink-0">
          <GameButton
            variant="ghost"
            size="sm"
            selected={backdropMode === 'live3d'}
            onClick={() => setBackdropMode((m) => (m === 'art' ? 'live3d' : 'art'))}
            title="실시간 3D 전장 배경과 키아트 전환"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backdropMode === 'live3d' ? 'bg-[#2ee6a6]' : 'bg-[#38d9ff]'
              }`}
            />
            <span>{backdropMode === 'art' ? '3D 실시간 뷰' : '키아트 뷰'}</span>
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

          <div
            aria-hidden={!settingsOpen}
            data-testid={settingsOpen ? 'title-settings-popover' : undefined}
            className={`absolute top-11 right-0 z-40 w-80 game-plaque surface-grain p-4 origin-top-right transition-all duration-200 ${
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
              <div>
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
                <p className="mt-1.5 text-[10.5px] text-[#8c9ab0] leading-snug">
                  {quality === 'ultra'
                    ? '2048px 소프트 섀도우 · 볼류메트릭 안개 · 빗줄기 · 풀 블룸'
                    : '고프레임 경량 셰이딩 · 빠른 전장 반응성 최적화'}
                </p>
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
      <div className="flex-1 flex items-center justify-between gap-8 min-h-0 py-4">
        {activeTab === 'deploy' && (
          <div className="w-full max-w-lg animate-panel-in">
            <div className="flex items-center gap-2 text-[11px] font-tactical tracking-[0.2em] text-[#b4c4d8] uppercase mb-3 game-text-outline">
              <span className="w-4 h-[2px] bg-[#ff4422]" aria-hidden="true" />
              <span className="text-[#ff785c] font-bold">NEO-SEOUL 2099</span>
              <span className="opacity-35">·</span>
              <span>SECTOR ZERO</span>
            </div>

            <h1
              className="font-display text-6xl sm:text-[86px] font-extrabold tracking-[0.04em] text-[#ffffff] leading-[0.88] game-text-outline"
              aria-label="IRON ASH III ZERO HOUR"
            >
              IRON ASH <span className="text-[#ff4422]">III</span>
            </h1>

            <div className="mt-2.5 font-display text-sm sm:text-base font-bold tracking-[0.32em] text-[#dce6f4]/90 uppercase game-text-outline">
              OPERATION ZERO HOUR
            </div>

            <p className="mt-5 mb-6 text-sm text-[#d4dde9] leading-relaxed max-w-md break-keep game-text-outline">
              4부작 시네마틱 1인 정예 캠페인: 한강변 강습 상륙, 을지로 0.2x 브리칭, UH-60K 헬기
              도어건너 & AC-130 FLIR, 그리고 <span className="text-[#f6b75e] font-semibold">K2-X 흑표 전차</span> 최후 돌파전.
            </p>

            {/* Ultra-Clean Overwatch / CoD Vertical Launch Menu */}
            <div className="flex flex-col gap-2.5 max-w-md">
              <GameButton
                variant="primary"
                size="lg"
                fullWidth
                data-start="true"
                onClick={() => onStart('campaign', 1)}
                className="h-12 justify-between px-5"
              >
                <span className="inline-flex items-center gap-2 font-bold tracking-wide">
                  <HudGlyphIcon kind="play" size={14} />
                  <span>캠페인 1화부터 출격</span>
                </span>
                <Keycap size="xs">ENTER</Keycap>
              </GameButton>

              {/* Direct 4-Mission Key-Art Briefing & Launch Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="mission-select-strip">
                {CAMPAIGN_MISSIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`start-mission-${m.id}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (onOpenBriefing) {
                        onOpenBriefing(m.id);
                      } else {
                        onStart('campaign', m.id);
                      }
                    }}
                    className="group relative overflow-hidden text-left rounded-[5px] bg-[#0a0f18]/88 hover:bg-[#111927] border border-white/15 hover:border-white/65 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
                    style={{ borderTop: `2px solid ${m.accentCss}` }}
                    title={`${m.title} — 클릭하여 브리핑 및 무장 설정`}
                  >
                    <div className="relative h-14 w-full overflow-hidden bg-[#060910]">
                      <img
                        src={m.keyArtUrl}
                        alt={m.title}
                        className="w-full h-full object-cover object-center opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(6,9,16,0.10) 0%, rgba(10,15,24,0.90) 100%)',
                        }}
                      />
                      <div
                        className="absolute top-1 left-1.5 font-tactical text-[9px] font-bold tracking-[0.14em] px-1 py-0.5 rounded-[2px] bg-black/70"
                        style={{ color: m.accentCss }}
                      >
                        M0{m.id}
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-[11px] font-semibold text-[#f1f5f9] leading-tight truncate">
                        {m.id === 1
                          ? '한강 상륙'
                          : m.id === 2
                            ? '을지로 브리칭'
                            : m.id === 3
                              ? '헬기·FLIR'
                              : 'K2 전차 결전'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <GameButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  data-testid="campaign-briefing-btn"
                  onClick={onOpenPrologue}
                >
                  스토리 브리핑
                </GameButton>

                <GameButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  data-testid="freeroam-start-btn"
                  onClick={() => onStart('freeroam')}
                  className="!border-[#f5b342]/45 !text-[#f6b75e] hover:!border-[#f5b342]"
                >
                  프리롬 워존 ★5
                </GameButton>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'story' && (
          <div className="w-full max-w-4xl mx-auto game-plaque tac-corners surface-grain p-6 sm:p-7 max-h-[72vh] overflow-y-auto animate-panel-in">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.09]">
              <div>
                <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#ff6242] uppercase mb-1">
                  OPERATION ZERO HOUR · 2099.11.24
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#f5f7fb] tracking-tight">
                  캠페인 서사 및 주요 인물 파일
                </h2>
              </div>
              <div className="segmented-track w-[212px]" role="tablist" aria-label="스토리 분류">
                <div
                  className="segmented-thumb"
                  style={{
                    width: 'calc(50% - 2px)',
                    transform: storyView === 'cast' ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={storyView === 'cast'}
                  data-active={storyView === 'cast'}
                  onClick={() => setStoryView('cast')}
                  className="segmented-item"
                >
                  주요 인물 (4)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={storyView === 'acts'}
                  data-active={storyView === 'acts'}
                  onClick={() => setStoryView('acts')}
                  className="segmented-item"
                >
                  캠페인 4막
                </button>
              </div>
            </div>

            {storyView === 'cast' ? (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-panel-in">
                {CHARACTER_DOSSIERS.map((ch) => (
                  <div
                    key={ch.id}
                    className="tactical-card p-4 flex flex-col gap-2.5 overflow-hidden"
                    style={{ borderTop: `2px solid ${ch.accentCss}` }}
                  >
                    <div className="flex items-center gap-3">
                      <CharacterBadge sender={ch.sender} accentCss={ch.accentCss} code={ch.callsign} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#f5f7fb] truncate">{ch.name}</div>
                        <div className="text-[10.5px] font-tactical truncate" style={{ color: ch.accentCss }}>
                          {ch.role}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed break-keep">{ch.bio}</p>
                    <div
                      className="pl-2.5 py-0.5 border-l-2 text-[11px] text-[#e2e8f0] italic break-keep"
                      style={{ borderColor: ch.accentCss }}
                    >
                      {ch.quote}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-panel-in">
                {STORY_ACTS.map((act) => (
                  <div
                    key={act.actNumber}
                    className="tactical-card p-4"
                    style={{ borderTop: '2px solid rgba(255, 68, 34, 0.7)' }}
                  >
                    <div className="flex items-center justify-between text-[11px] font-tactical mb-1.5">
                      <span className="text-[#ff6242] font-semibold">
                        ACT 0{act.actNumber} · {act.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[#cbd5e1] text-[10px] tabular-nums">
                        WAVE {act.minWave}+
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#f5f7fb] mb-1">{act.subtitle}</div>
                    <p className="text-xs text-[#b4c0d0] leading-relaxed break-keep">{act.briefing}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/[0.09] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#a5b4c8]">
                코어 접속 시 킬스위치 · 심바이오시스 · 어센션 3대 엔딩을 선택할 수 있습니다.
              </span>
              <GameButton variant="primary" size="md" onClick={onOpenPrologue}>
                <HudGlyphIcon kind="play" size={13} />
                5장면 시네마틱 브리핑 재생
              </GameButton>
            </div>
          </div>
        )}

        {activeTab === 'codex' && (
          <div className="w-full max-w-4xl mx-auto game-plaque tac-corners surface-grain p-6 sm:p-7 max-h-[72vh] overflow-y-auto animate-panel-in">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.09]">
              <div>
                <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#f5b342] uppercase mb-1">
                  TACTICAL DATABASE V3.0
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#f5f7fb] tracking-tight">
                  적대 AI 군단 · 6종 무기고 · 블랙박스 기록
                </h2>
              </div>

              <div className="segmented-track w-[280px]" role="tablist" aria-label="도감 분류">
                <div
                  className="segmented-thumb"
                  style={{
                    width: 'calc(33.33% - 2px)',
                    transform:
                      codexView === 'factions'
                        ? 'translateX(0%)'
                        : codexView === 'arsenal'
                          ? 'translateX(100%)'
                          : 'translateX(200%)',
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
                  무기고 (6)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={codexView === 'intel'}
                  data-active={codexView === 'intel'}
                  onClick={() => setCodexView('intel')}
                  className="segmented-item"
                >
                  기록 (6)
                </button>
              </div>
            </div>

            {codexView === 'factions' && (
              <div key="codex-factions" className="mt-5 grid grid-cols-1 gap-3 animate-panel-in">
                {FACTION_DOSSIERS.map((f) => (
                  <div key={f.enName} className="tactical-card p-4 flex items-start gap-4">
                    <FactionCrest faction={f.faction} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-sm font-bold text-[#f5f7fb]">{f.name}</span>
                          <span className="text-[11px] font-tactical text-[#a5b4c8]">{f.enName}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-[3px] bg-[#f5b342]/12 border border-[#f5b342]/35 text-[10px] font-tactical font-semibold text-[#f6b75e]">
                          {f.threatLevel}
                        </span>
                      </div>
                      <p className="text-xs text-[#d5deea] leading-relaxed mb-1.5 break-keep">{f.summary}</p>
                      <p className="text-xs text-[#a5b4c8] leading-relaxed break-keep">
                        <span className="text-[#f5f7fb] font-medium">전술 권고:</span> {f.tactics}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.units.map((u) => (
                          <span
                            key={u}
                            className="px-2 py-0.5 rounded-[2px] bg-white/[0.04] border border-white/[0.08] text-[10px] font-tactical text-[#94a3b8]"
                          >
                            {u}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {codexView === 'arsenal' && (
              <div key="codex-arsenal" className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 animate-panel-in">
                {ARSENAL_DOSSIERS.map((w, idx) => (
                  <div
                    key={w.slotKey}
                    className="tactical-card p-4 flex flex-col justify-between gap-3"
                    style={{ borderLeft: `2px solid ${w.accentCss}` }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Keycap size="xs" tone="amber">
                            {w.slotKey}
                          </Keycap>
                          <WeaponSvgIcon weaponIdx={idx} accent={w.accentCss} active />
                          <span className="text-xs sm:text-sm font-bold text-[#f5f7fb] truncate">
                            {w.name}
                          </span>
                        </div>
                      </div>
                      <div
                        className="text-[10px] font-tactical font-semibold uppercase mb-1.5"
                        style={{ color: w.accentCss }}
                      >
                        {w.specialty}
                      </div>
                      <p className="text-xs text-[#cbd5e1] leading-relaxed break-keep">{w.description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[10.5px] font-tactical pt-2 border-t border-white/[0.07]">
                      {[
                        { label: '화력', val: w.firepower },
                        { label: '연사', val: w.cadence },
                        { label: '파괴력', val: w.dismember },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="flex justify-between text-[#9aa8bd] mb-1">
                            <span>{stat.label}</span>
                            <span className="text-[#f5f7fb] font-semibold tabular-nums">{stat.val}</span>
                          </div>
                          <div className="game-bar-track h-1.5">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${stat.val}%`, backgroundColor: w.accentCss }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {codexView === 'intel' && (
              <div key="codex-intel" className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-panel-in">
                {WASTELAND_HOLOTAPES.map((tape) => (
                  <div
                    key={tape.id}
                    className="tactical-card p-3.5"
                    style={{ borderLeft: '2px solid rgba(245, 179, 66, 0.7)' }}
                  >
                    <div className="flex items-center justify-between text-[10px] font-tactical text-[#f6b75e] mb-1">
                      <span className="font-bold">{tape.code}</span>
                      <span className="text-[#94a3b8]">{tape.speaker}</span>
                    </div>
                    <div className="text-xs font-bold text-[#f5f7fb] mb-1.5">{tape.title}</div>
                    <p className="text-[11.5px] text-[#cbd5e1] leading-relaxed break-keep">
                      “{tape.logText}”
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'theater' && (
          <div className="w-full max-w-5xl mx-auto game-plaque tac-corners surface-grain p-5 sm:p-7 max-h-[72vh] overflow-y-auto overflow-x-hidden animate-panel-in">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-white/[0.09]">
              <div>
                <div className="text-[11px] font-tactical font-semibold tracking-[0.18em] text-[#38d9ff] uppercase mb-1">
                  DIRECTOR&apos;S CUT // REAL-TIME 3D ENGINE REELS
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#f5f7fb] tracking-tight">
                  시네마틱 극장 (실시간 3D 컷신 즉시 재생)
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-[3px] bg-[#38d9ff]/10 border border-[#38d9ff]/30 text-[10.5px] font-tactical text-[#7ee6ff]">
                7 SEQUENCES · REAL-TIME WEBGL
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {THEATER_REELS.map((reel) => (
                <button
                  key={reel.id}
                  type="button"
                  data-testid={`theater-play-${reel.id}`}
                  onClick={() => onPlayTheater(reel.id)}
                  className="group text-left tactical-card overflow-hidden flex flex-col cursor-pointer"
                >
                  <div className="relative h-28 w-full overflow-hidden bg-[#07090d]">
                    <img
                      src={reel.thumb}
                      alt={reel.title}
                      className="w-full h-full object-cover object-center opacity-85 group-hover:scale-108 group-hover:opacity-100 transition-all duration-500"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(7,9,14,0.16) 0%, rgba(10,13,20,0.92) 100%)',
                      }}
                    />
                    <span
                      className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[9.5px] font-tactical font-bold rounded-[3px] bg-[#07090d]/88 border backdrop-blur-sm"
                      style={{ color: reel.accentCss, borderColor: `${reel.accentCss}77` }}
                    >
                      {reel.code}
                    </span>
                    {/* Subtle Hover Play Emblem */}
                    <span
                      className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-full flex items-center justify-center bg-[#07090d]/85 border transition-all duration-200 group-hover:scale-110"
                      style={{
                        borderColor: `${reel.accentCss}aa`,
                        color: reel.accentCss,
                        boxShadow: `0 0 14px ${reel.accentCss}44`,
                      }}
                    >
                      <HudGlyphIcon kind="play" size={12} />
                    </span>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-1.5">
                    <div className="text-xs font-bold text-[#f5f7fb] leading-snug group-hover:text-white">
                      {reel.title}
                    </div>
                    <div className="text-[11px] text-[#9aa8bd] leading-snug break-keep">
                      {reel.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ultra-Minimal CoD / Overwatch Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 pt-2 text-[10.5px] font-tactical text-[#9aa8bd] game-text-outline">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Keycap size="xs">WASD</Keycap>
            <span>이동</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Keycap size="xs" tone="cyan">
              우클릭
            </Keycap>
            <span>투명 스코프</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Keycap size="xs" tone="amber">
              1-6
            </Keycap>
            <span>무기</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Keycap size="xs">T</Keycap>
            <span>살펴보기</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <Keycap size="xs">ESC</Keycap>
          <span>전체 조작법 · 설정</span>
        </span>
      </footer>
    </div>
  );
};
