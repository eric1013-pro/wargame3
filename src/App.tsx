import { useCallback, useEffect, useRef, useState } from 'react';
import { BattlefieldAnalyticsModal } from './components/BattlefieldAnalyticsModal';
import { CinematicOverlay } from './components/CinematicOverlay';
import { GameHud } from './components/GameHud';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { DeathModal, PauseModal, VictoryModal } from './components/StatusModals';
import { StoryPrologue } from './components/StoryPrologue';
import { TheaterSequence, TitleScreen, TitleTab } from './components/TitleScreen';
import { createEmptyAnalytics } from './game/analytics';
import { createInitialCampaignChoices } from './game/campaignMissions';
import { createInitialCinematicState } from './game/cinematicDirector';
import { IronAshEngine } from './game/engine';
import { WASTELAND_HOLOTAPES } from './game/story';
import {
  BodyPart,
  CampaignMissionId,
  EndingId,
  GameMode,
  GraphicsQuality,
  HudSnapshot,
  WeaponAttachmentId,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  gameMode: 'campaign',
  missionId: 1,
  missionStage: 'm1_landing',
  missionTitle: 'MISSION 01 · 한강변 강습 상륙',
  checkpointSeq: 0,
  checkpointLabel: '',
  campaignChoices: createInitialCampaignChoices(),
  campaignPrompt: null,
  autoEndingReason: null,
  ac130: {
    active: false,
    weaponIdx: 1,
    caliber: '40MM',
    weaponName: 'L/60 보포스 자동포',
    reloadPct: 100,
    thermalMode: 'whot',
    zoomed: false,
    altitudeM: 4200,
    headingDeg: 0,
    friendlyStrobes: [],
    hostileMarkers: [],
  },
  tank: {
    available: false,
    driving: false,
    nearPrompt: false,
    hp: 850,
    maxHp: 850,
    cannonReloadPct: 100,
    coaxHeatPct: 0,
    speedKmh: 0,
    hullHeadingDeg: 0,
    turretRelativeDeg: 0,
    gunnerOptic: false,
    apsReady: true,
    distanceM: 99,
  },
  heliRide: {
    active: false,
    progressPct: 0,
    altitudeM: 110,
    speedKts: 118,
    minigunHeatPct: 0,
    minigunOverheated: false,
    targetsDestroyed: 0,
    targetsTotal: 10,
  },
  squadTags: [],
  firstPersonSetpieceActive: false,
  breachPromptVisible: false,
  armorPlates: 2,
  maxArmorPlates: 3,
  platingActive: false,
  platingPct: 0,
  smokeGrenades: 2,
  maxSmokeGrenades: 2,
  inSmokeCover: false,
  squadOrder: 'follow',
  weaponAttachment: 'standard',
  wave: 1,
  actNumber: 1,
  actTitle: '최후의 맥박',
  objectiveText: '붉은 방화벽 릴레이 파일런 파괴 (0/3) → 중앙 AI 서버 방어막 해제',
  objectiveProgressPct: 0,
  holotapesFound: 0,
  holotapesTotal: WASTELAND_HOLOTAPES.length,
  unlockedHolotapeIds: [],
  relaysDestroyed: 0,
  relaysTotal: 3,
  coreShieldDown: false,
  coreHp: 600,
  coreMaxHp: 600,
  canShutdownCore: false,
  coreDistance: 57,
  serverShutdownActive: false,
  choiceActive: false,
  endingId: null,
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
  adsBlend: 0,
  scopedOpticActive: false,
  holdingBreath: false,
  mounted: false,
  leanDir: 0,
  wallBlocked: false,
  isIndoors: false,
  inspectingWeapon: false,
  aimDistanceM: null,
  aimTarget: null,
  waypoints: [],
  medals: [],
  wantedFlashSeq: 0,
  sprinting: false,
  isSliding: false,
  isDashing: false,
  dashCharges: 2,
  dashMaxCharges: 2,
  dashChargePct: 100,
  crosshairGap: 16,
  vatsEnergy: 100,
  vatsActive: false,
  vatsTargets: [],
  killstreak: 0,
  airstrikeReady: false,
  supplyDropReady: true,
  supplyDropCooldownPct: 100,
  overdriveTimer: 0,
  adrenalineActive: false,
  adrenalineUsed: false,
  threatLevel: 1,
  threatLabel: '순찰 경계',
  threatProgressPct: 0,
  comboCount: 0,
  comboTimerPct: 0,
  styleGrade: 'D',
  styleLabel: 'STANDBY',
  turretsHacked: 0,
  turretsTotal: 2,
  nearHackableTurretName: null,
  killCamActive: false,
  killCamBanner: null,
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
  bossPhase: 1,
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
  const [briefingMission, setBriefingMission] = useState<CampaignMissionId | null>(null);
  const [attachment, setAttachment] = useState<WeaponAttachmentId>('standard');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new IronAshEngine(container, (snap) => {
      setHud(snap);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const modeParam = params.get('mode') === 'freeroam' ? 'freeroam' : 'campaign';
      const missionParam = Number(params.get('mission'));
      const startM: CampaignMissionId =
        missionParam === 1 || missionParam === 2 || missionParam === 3 || missionParam === 4
          ? missionParam
          : 1;
      const inTank = params.get('intank') === '1';
      engine.startGame(params.get('skipintro') === '1', modeParam, startM, inTank);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setTitleHotkeyEnabled(
      titleTab === 'deploy' && !prologueOpen && !analyticsOpen && briefingMission === null
    );
  }, [titleTab, prologueOpen, analyticsOpen, briefingMission]);

  const handleStart = useCallback(
    (mode: GameMode = 'campaign', startMission: CampaignMissionId = 1) => {
      setPrologueOpen(false);
      setAnalyticsOpen(false);
      setBriefingMission(null);
      setTitleTab('deploy');
      engineRef.current?.startGame(false, mode, startMission);
    },
    []
  );

  const handleOpenBriefing = useCallback((missionId: CampaignMissionId) => {
    setBriefingMission(missionId);
  }, []);

  const handleSelectAttachment = useCallback((id: WeaponAttachmentId) => {
    setAttachment(id);
    engineRef.current?.setWeaponAttachment(id);
  }, []);

  const handleResolveCampaignChoice = useCallback((option: 'F' | 'G') => {
    engineRef.current?.resolveCampaignPromptChoice(option);
  }, []);

  const handleSelectAc130Weapon = useCallback((idx: 0 | 1 | 2) => {
    engineRef.current?.selectAc130Weapon(idx);
  }, []);

  const handleToggleAc130Thermal = useCallback(() => {
    engineRef.current?.toggleAc130Thermal();
  }, []);

  const handlePlayTheater = useCallback((seq: TheaterSequence) => {
    setPrologueOpen(false);
    setAnalyticsOpen(false);
    setBriefingMission(null);
    engineRef.current?.playTheaterSequence(seq);
  }, []);

  const handleChooseEnding = useCallback((ending: EndingId) => {
    engineRef.current?.chooseEnding(ending);
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
    setBriefingMission(null);
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
      {/* Isolated WebGL canvas container — Opening wakeup blur clears smoothly */}
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
          onOpenBriefing={handleOpenBriefing}
          onOpenPrologue={() => setPrologueOpen(true)}
          onPlayTheater={handlePlayTheater}
          onQualityChange={handleQualityChange}
          onSensitivityChange={handleSensitivityChange}
          onToggleMute={handleToggleMute}
        />
      )}

      {hud.phase === 'title' && briefingMission !== null && (
        <MissionBriefingModal
          missionId={briefingMission}
          attachment={attachment}
          onSelectAttachment={handleSelectAttachment}
          onDeploy={(mid) => handleStart('campaign', mid)}
          onClose={() => setBriefingMission(null)}
        />
      )}

      {hud.phase === 'title' && prologueOpen && (
        <StoryPrologue
          onDeploy={() => handleStart('campaign')}
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
            onResolveCampaignChoice={handleResolveCampaignChoice}
            onSelectAc130Weapon={handleSelectAc130Weapon}
            onToggleAc130Thermal={handleToggleAc130Thermal}
          />
          <CinematicOverlay
            phase={hud.phase}
            cinematic={hud.cinematic}
            comms={hud.comms}
            onSkip={handleSkipCinematic}
            onChooseEnding={handleChooseEnding}
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
          onRestart={() => handleStart(hud.gameMode)}
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
          onRedeploy={() => handleStart(hud.gameMode)}
          onTitle={handleTitle}
        />
      )}

      {hud.phase === 'victory' && !analyticsOpen && (
        <VictoryModal
          hud={hud}
          onOpenAnalytics={() => setAnalyticsOpen(true)}
          onRedeploy={() => handleStart('campaign', 1)}
          onReplayChoice={() => handlePlayTheater('choice')}
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
              hud.phase === 'gameover' || hud.phase === 'victory'
                ? () => handleStart(hud.gameMode)
                : undefined
            }
          />
        )}
    </main>
  );
}
