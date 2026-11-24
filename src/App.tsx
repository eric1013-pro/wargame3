import { useCallback, useEffect, useRef, useState } from 'react';
import { BattlefieldAnalyticsModal } from './components/BattlefieldAnalyticsModal';
import { CinematicOverlay } from './components/CinematicOverlay';
import { GameHud } from './components/GameHud';
import { DeathModal, PauseModal, VictoryModal } from './components/StatusModals';
import { StoryPrologue } from './components/StoryPrologue';
import { TitleScreen, TitleTab } from './components/TitleScreen';
import { createEmptyAnalytics } from './game/analytics';
import { createInitialCinematicState } from './game/cinematicDirector';
import { IronAshEngine } from './game/engine';
import { WASTELAND_HOLOTAPES } from './game/story';
import { BodyPart, GraphicsQuality, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  wave: 1,
  actNumber: 1,
  actTitle: '최후의 맥박',
  objectiveText: '붉은 방화벽 릴레이 파일런 파괴 (0/3) → 중앙 AI 서버 방어막 해제',
  objectiveProgressPct: 0,
  holotapesFound: 0,
  holotapesTotal: WASTELAND_HOLOTAPES.length,
  relaysDestroyed: 0,
  relaysTotal: 3,
  coreShieldDown: false,
  coreHp: 600,
  coreMaxHp: 600,
  canShutdownCore: false,
  coreDistance: 57,
  serverShutdownActive: false,
  kills: 0,
  dismembers: 0,
  executions: 0,
  survivalTime: 0,
  hp: 100,
  maxHp: 100,
  armor: 100,
  maxArmor: 100,
  weaponIdx: 0,
  ammo: 32,
  mag: 32,
  reloading: false,
  reloadPct: 100,
  reloadPhase: 'idle',
  reloadStageGroup: 'idle',
  reloadPhaseLabel: '',
  reloadStageBadge: '',
  reloadPhasePct: 0,
  reloadEmptyThreshold: 0.38,
  reloadAccentCss: '#f59e0b',
  reloadIsTactical: false,
  reloadSpeedBonusPct: 0,
  reloadDurationSec: 0,
  grenades: 3,
  ads: false,
  sprinting: false,
  crosshairGap: 16,
  vatsEnergy: 100,
  vatsActive: false,
  vatsTargets: [],
  killstreak: 0,
  airstrikeReady: false,
  gloryKillTargetName: null,
  alertBanner: null,
  calloutText: null,
  calloutColor: '#ef4444',
  comms: null,
  cinematic: createInitialCinematicState(),
  ttsEnabled: false,
  playerYawDeg: 0,
  playerX: 0,
  playerZ: 32,
  compassContacts: [],
  minimapWalls: [],
  minimapDots: [],
  floatingDamages: [],
  hitmarkerSeq: 0,
  hitmarkerCrit: false,
  damageFlashSeq: 0,
  damageDirDeg: 0,
  blastFlashSeq: 0,
  empFlashSeq: 0,
  lowHpIntensity: 0,
  muted: false,
  pointerLocked: false,
  causeOfDeath: '',
  bossName: null,
  bossHpPct: 0,
  killFeed: [],
  analytics: createEmptyAnalytics(WASTELAND_HOLOTAPES.length),
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<IronAshEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [quality, setQuality] = useState<GraphicsQuality>('ultra');
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [titleTab, setTitleTab] = useState<TitleTab>('deploy');
  const [prologueOpen, setPrologueOpen] = useState<boolean>(false);
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new IronAshEngine(container, (snap) => {
      setHud(snap);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startGame(params.get('skipintro') === '1');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Only allow engine's Enter/Space instant-start hotkey on the main Deploy screen when no modal is open
  useEffect(() => {
    engineRef.current?.setTitleHotkeyEnabled(
      titleTab === 'deploy' && !prologueOpen && !analyticsOpen
    );
  }, [titleTab, prologueOpen, analyticsOpen]);

  const handleStart = useCallback(() => {
    setPrologueOpen(false);
    setAnalyticsOpen(false);
    setTitleTab('deploy');
    engineRef.current?.startGame();
  }, []);

  const handleResume = useCallback(() => {
    setAnalyticsOpen(false);
    engineRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleTitle = useCallback(() => {
    setPrologueOpen(false);
    setAnalyticsOpen(false);
    setTitleTab('deploy');
    engineRef.current?.returnToTitle();
  }, []);

  const handleQualityChange = useCallback((q: GraphicsQuality) => {
    setQuality(q);
    engineRef.current?.setGraphicsQuality(q);
  }, []);

  const handleSensitivityChange = useCallback((v: number) => {
    setSensitivity(v);
    engineRef.current?.setSensitivity(v);
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleToggleTts = useCallback(() => {
    engineRef.current?.toggleTts();
  }, []);

  const handleSkipCinematic = useCallback(() => {
    engineRef.current?.skipCinematic();
  }, []);

  const handleSelectWeapon = useCallback((idx: number) => {
    engineRef.current?.selectWeapon(idx);
  }, []);

  const handleVatsTargetClick = useCallback((unitId: number, part: BodyPart) => {
    engineRef.current?.triggerVatsShot(unitId, part);
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0a0d13]">
      {/* Isolated WebGL canvas container — Opening wakeup blur clears smoothly without backdrop-filter */}
      <div
        ref={mountRef}
        className="fixed inset-0 z-0"
        style={{
          filter: hud.cinematic.blurPx > 0 ? `blur(${hud.cinematic.blurPx}px)` : undefined,
        }}
      />

      {hud.phase === 'title' && !prologueOpen && (
        <TitleScreen
          activeTab={titleTab}
          quality={quality}
          sensitivity={sensitivity}
          muted={hud.muted}
          onTabChange={setTitleTab}
          onStart={handleStart}
          onOpenPrologue={() => setPrologueOpen(true)}
          onQualityChange={handleQualityChange}
          onSensitivityChange={handleSensitivityChange}
          onToggleMute={handleToggleMute}
        />
      )}

      {hud.phase === 'title' && prologueOpen && (
        <StoryPrologue
          onDeploy={handleStart}
          onClose={() => setPrologueOpen(false)}
        />
      )}

      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <>
          <GameHud
            hud={hud}
            onSelectWeapon={handleSelectWeapon}
            onToggleMute={handleToggleMute}
            onToggleTts={handleToggleTts}
            onPause={handlePause}
            onVatsTargetClick={handleVatsTargetClick}
          />
          <CinematicOverlay
            phase={hud.phase}
            cinematic={hud.cinematic}
            comms={hud.comms}
            onSkip={handleSkipCinematic}
          />
        </>
      )}

      {hud.phase === 'paused' && !analyticsOpen && (
        <PauseModal
          quality={quality}
          sensitivity={sensitivity}
          muted={hud.muted}
          ttsEnabled={hud.ttsEnabled}
          onResume={handleResume}
          onOpenAnalytics={() => setAnalyticsOpen(true)}
          onRestart={handleStart}
          onTitle={handleTitle}
          onQualityChange={handleQualityChange}
          onSensitivityChange={handleSensitivityChange}
          onToggleMute={handleToggleMute}
          onToggleTts={handleToggleTts}
        />
      )}

      {hud.phase === 'gameover' && !analyticsOpen && (
        <DeathModal
          hud={hud}
          onOpenAnalytics={() => setAnalyticsOpen(true)}
          onRedeploy={handleStart}
          onTitle={handleTitle}
        />
      )}

      {hud.phase === 'victory' && !analyticsOpen && (
        <VictoryModal
          hud={hud}
          onOpenAnalytics={() => setAnalyticsOpen(true)}
          onRedeploy={handleStart}
          onTitle={handleTitle}
        />
      )}

      {(hud.phase === 'gameover' || hud.phase === 'victory' || hud.phase === 'paused') &&
        analyticsOpen && (
          <BattlefieldAnalyticsModal
            hud={hud}
            isPostCombat={hud.phase === 'gameover' || hud.phase === 'victory'}
            onClose={() => setAnalyticsOpen(false)}
            onRedeploy={
              hud.phase === 'gameover' || hud.phase === 'victory' ? handleStart : undefined
            }
          />
        )}
    </main>
  );
}
