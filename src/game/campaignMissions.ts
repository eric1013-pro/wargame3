import {
  CampaignChoiceState,
  CampaignMissionId,
  CampaignStageId,
  CommsSender,
  EndingId,
  WeaponAttachmentId,
} from './types';

export interface WeaponAttachmentSpec {
  id: WeaponAttachmentId;
  name: string;
  tag: string;
  desc: string;
  recoilMult: number;
  spreadMult: number;
  magMult: number;
  damageMult: number;
  dismemberMult: number;
}

export const WEAPON_ATTACHMENTS: readonly WeaponAttachmentSpec[] = [
  {
    id: 'standard',
    name: 'ROK 표준 전술 구성',
    tag: 'BALANCED',
    desc: '균형 잡힌 반동 제어 · 기동성 유지',
    recoilMult: 1.0,
    spreadMult: 1.0,
    magMult: 1.0,
    damageMult: 1.0,
    dismemberMult: 1.0,
  },
  {
    id: 'suppressor',
    name: 'FSS 전술 소음기 + 포어그립',
    tag: 'STEALTH / LASER',
    desc: '반동 -28% · 정조준 탄착군 -35%',
    recoilMult: 0.72,
    spreadMult: 0.65,
    magMult: 1.0,
    damageMult: 0.98,
    dismemberMult: 1.0,
  },
  {
    id: 'extended_mag',
    name: '45발 폴리머 대용량 탄창',
    tag: 'HIGH CAPACITY',
    desc: '전 무기 탄창 용량 +40% · 지속 화력 극대화',
    recoilMult: 1.06,
    spreadMult: 1.04,
    magMult: 1.4,
    damageMult: 1.0,
    dismemberMult: 1.0,
  },
  {
    id: 'ap_rounds',
    name: '5.56mm 텅스텐 철갑관통탄',
    tag: 'ARMOR PIERCING',
    desc: '공격력 +18% · 보스 장갑판/사지 파쇄력 +32%',
    recoilMult: 1.12,
    spreadMult: 1.02,
    magMult: 0.92,
    damageMult: 1.18,
    dismemberMult: 1.32,
  },
];

export function getWeaponAttachmentSpec(id: WeaponAttachmentId): WeaponAttachmentSpec {
  return WEAPON_ATTACHMENTS.find((a) => a.id === id) ?? WEAPON_ATTACHMENTS[0];
}

export function getPortraitUrlForComms(sender: CommsSender, speaker?: string): string {
  if (speaker) {
    if (speaker.includes('박현준')) return './src/assets/images/portrait_corporal_park.jpg';
    if (speaker.includes('소재우')) return './src/assets/images/portrait_sergeant_so.jpg';
    if (speaker.includes('고스트') || speaker.toUpperCase().includes('GHOST')) {
      return './src/assets/images/portrait_ghost9.jpg';
    }
    if (
      speaker.includes('건쉽') ||
      speaker.includes('리퍼') ||
      speaker.toUpperCase().includes('AC-130')
    ) {
      return './src/assets/images/portrait_gunship.jpg';
    }
    if (speaker.includes('아키텍트') || speaker.toUpperCase().includes('OMNI')) {
      return './src/assets/images/portrait_arcadia.jpg';
    }
    if (speaker.includes('강서연') || speaker.includes('발키리')) {
      return './src/assets/images/portrait_captain_kang.jpg';
    }
  }
  if (sender === 'valkyrie') return './src/assets/images/portrait_captain_kang.jpg';
  if (sender === 'ghost9') return './src/assets/images/portrait_ghost9.jpg';
  if (sender === 'gunship') return './src/assets/images/portrait_gunship.jpg';
  if (sender === 'arcadia') return './src/assets/images/portrait_arcadia.jpg';
  return './src/assets/images/portrait_sergeant_so.jpg';
}

export interface MissionProfile {
  id: CampaignMissionId;
  numberLabel: string;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  accentCss: string;
  summary: string;
  briefingLore: string;
  tacticalTips: string[];
  keyArtUrl: string;
  initialStage: CampaignStageId;
}

export const CAMPAIGN_MISSIONS: MissionProfile[] = [
  {
    id: 1,
    numberLabel: 'MISSION 01',
    code: 'OP // HAN RIVER',
    title: '한강변 강습 상륙',
    subtitle: '대한민국해군 LCAC-655 단독 강습 상륙 · 장갑차 피격 · 연막 교두보 확보',
    location: '한강 이남 강습 해안선 · 04:12 KST',
    accentCss: '#f5b342',
    summary: '해군 공기부양정(LCAC-655)으로 포화를 뚫고 상륙해 피격된 K-808 장갑차 연막 속에서 교두보를 확보한다.',
    briefingLore:
      '2099년 11월 24일 04:12. 서울 방공망이 OMNI-CORE에 함락된 지 14시간 만에 궤도 사령부는 도시 전체를 지워버릴 "소각 프로토콜" 카운트다운을 승인했다. 강서연 대위는 명령에 불복하고 대한민국해군 LCAC-655 상륙정에 단 한 명의 생존 요원—SUBJECT-00 이안 케인을 태워 불타는 한강 남단으로 밀어 넣는다.',
    tacticalTips: [
      '[B] 연막탄으로 적 화망과 저격수 시야를 차단하며 모래주머니 진지로 전진',
      '[H] 세라믹 방탄판 교체로 교전 중 장갑(+45) 즉시 복구',
      '엄폐물 자동 마운팅([우클릭]) + [Q/E] 피킹으로 정밀 제압',
    ],
    keyArtUrl: './src/assets/images/mission01_han_river.jpg',
    initialStage: 'm1_landing',
  },
  {
    id: 2,
    numberLabel: 'MISSION 02',
    code: 'OP // EULJIRO BREACH',
    title: '을지로 시가전 & 브리칭',
    subtitle: '도심 골목 돌파 · 0.2x 슬로모션 문 폭파 브리칭 · 생존자 & 고스트-9 대면',
    location: '을지로4가 폐허 상가 골목 · 04:28 KST',
    accentCss: '#38d9ff',
    summary: '안경점·고기구이 간판 골목의 저격수를 제압하고 C4 슬로모션 브리칭으로 적 지휘소를 급습한다.',
    briefingLore:
      '폐허가 된 을지로4가 상가 골목 깊은 곳에서 민간인 구조 신호와 함께 미등록 암호 패킷이 동시에 잡혔다. 2층 안경점 옥상의 레이저 저격망을 뚫고 동쪽 방폭문을 C4 슬로모션 브리칭으로 날려버리는 순간, 당신은 인간 생존자들과 그들을 지켜내던 탈영 신스 해커 "고스트-9"—그리고 궤도 사령부가 숨겨온 진실과 마주하게 된다.',
    tacticalTips: [
      '2층 안경점 간판 위 레이저 스나이퍼를 우선 제압하거나 [B] 연막으로 시야 차단',
      '골목 소탕 후 동측 방폭문 앞에서 [F] C4 브리칭 실행 → 0.2x 슬로모션 제압',
      '고스트-9와의 신뢰 선택이 최종 엔딩 분기를 직접 결정합니다',
    ],
    keyArtUrl: './src/assets/images/mission02_euljiro_breach.jpg',
    initialStage: 'm2_alley',
  },
  {
    id: 3,
    numberLabel: 'MISSION 03',
    code: 'OP // SKY REAPER',
    title: 'UH-60K 헬기 강습 & AC-130 FLIR',
    subtitle: 'UH-60K 무장 헬기 도어건너 M134 소사 → AC-130 25mm/40mm/105mm 열화상 폭격',
    location: '네오-서울 상공 저공 강습 · 04:41 KST',
    accentCss: '#e2e8f0',
    summary: 'UH-60K 무장 헬기 측문 M134 미니건으로 네오-서울 상공을 저공 돌파한 뒤 AC-130 열화상 함포로 적 기갑 증원을 초토화한다.',
    briefingLore:
      '궤도 소각 카운트다운까지 남은 시간은 단 18분. 천사-01 항공대의 UH-60K 무장 헬기가 불타는 을지로 상공을 저공 선회하며 당신을 싣고 시타델 진입로로 돌파한다. 측문 M134 회전 기관총으로 대공 방어선을 갈아버린 직후, 고스트-9가 열어젖힌 AC-130 열화상(FLIR) 화력 링크로 적 기갑 종대 전체를 잿더미로 만들어라.',
    tacticalTips: [
      '1단계 UH-60K 헬기 탑승: 마우스 조준 + [좌클릭] M134 회전 미니건 연속 사격 (과열 주의)',
      '2단계 AC-130 FLIR: [1] 25mm · [2] 40mm · [3] 105mm 곡사포 · [T] WHOT/BHOT 전환',
      '헬기 패스 중에도 적을 많이 격파할수록 AC-130 화력 지원 구간이 유리해집니다',
    ],
    keyArtUrl: './src/assets/images/mission03_ac130_flir.jpg',
    initialStage: 'm3_heli_insert',
  },
  {
    id: 4,
    numberLabel: 'MISSION 04',
    code: 'OP // IRON SPEARHEAD',
    title: 'K2-X 흑표 전차 돌파 & 타워 결전',
    subtitle: '실제 조종 K2-X 주력전차 120mm 포격 · OMNI-TITAN 보스전 · 멀티 엔딩',
    location: 'OMNI-CORE 중앙 시타델 진입로 · 04:56 KST',
    accentCss: '#ff4422',
    summary: '남측 보급선에 배치된 K2-X 흑표 전차에 탑승해 120mm 주포로 시타델 방어선과 OMNI-TITAN을 격파하고 최후의 결단을 내린다.',
    briefingLore:
      '폭풍과 붉은 번개가 내리꽂히는 네오-서울 최후의 밤. 강서연 대위가 목숨을 걸고 궤도 수송선에서 투하한 K2-X 흑표 주력전차가 시타델 대로를 향해 시동을 건다. 120mm 활강포로 방어선과 1,350 HP 최종 병기 OMNI-TITAN을 분쇄하고 OMNI-CORE 심장부에 도달해 인류와 기계 문명의 운명을 직접 결정하라.',
    tacticalTips: [
      '전차 근처에서 [F] 탑승/하차 · [WASD] 차체 주행 · 마우스로 360° 포탑 독립 조준',
      '[좌클릭] 120mm 주포 · [SPACE] 12.7mm 동축 기관총 · [우클릭] 전차 포수 열화상 조준경',
      '[B] 전차 연막탄 발사 · [H] 현장 긴급 장갑 수리(+220 전차 장갑)',
    ],
    keyArtUrl: './src/assets/images/mission04_omni_tower.jpg',
    initialStage: 'm4_tank_assault',
  },
];

export interface Ac130WeaponSpec {
  id: 0 | 1 | 2;
  key: string;
  caliber: string;
  name: string;
  cooldown: number;
  blastRadius: number;
  damage: number;
  flightSec: number;
  shake: number;
  reticleKind: '25mm' | '40mm' | '105mm';
}

export const AC130_WEAPONS: readonly Ac130WeaponSpec[] = [
  {
    id: 0,
    key: '1',
    caliber: '25MM',
    name: 'GAU-12 개틀링 기관포',
    cooldown: 0.13,
    blastRadius: 4.2,
    damage: 46,
    flightSec: 0.24,
    shake: 0.14,
    reticleKind: '25mm',
  },
  {
    id: 1,
    key: '2',
    caliber: '40MM',
    name: 'L/60 보포스 자동포',
    cooldown: 0.62,
    blastRadius: 7.4,
    damage: 118,
    flightSec: 0.42,
    shake: 0.36,
    reticleKind: '40mm',
  },
  {
    id: 2,
    key: '3',
    caliber: '105MM',
    name: 'M102 곡사포',
    cooldown: 3.1,
    blastRadius: 15.5,
    damage: 310,
    flightSec: 0.72,
    shake: 0.92,
    reticleKind: '105mm',
  },
] as const;

export function createInitialCampaignChoices(): CampaignChoiceState {
  return {
    survivorRescued: null,
    ghostTrust: 0,
    squadmateSaved: null,
  };
}

/**
 * Resolves the dense 3-branch ending automatically from the player's concrete field decisions
 * made during Missions 02–04 (Survivor Rescue, Ghost-9 Trust / Turret Cooperation, Sergeant So Rescue).
 */
export function resolveCampaignAutoEnding(choices: CampaignChoiceState): {
  ending: EndingId;
  reasonKr: string;
} {
  const savedSquad = choices.squadmateSaved === true;
  const savedSurvivor = choices.survivorRescued === true;

  // Ending B (Symbiosis / Blue Horizon): High Ghost-9 trust + compassionate rescue of squadmate/survivor
  if (choices.ghostTrust >= 2 && (savedSquad || savedSurvivor)) {
    return {
      ending: 'symbiosis',
      reasonKr:
        '고스트-9와의 신뢰 구축 및 동료·생존자 구출 결과 → 기계 해방과 인류 공존 [푸른 지평선] 자동 달성',
    };
  }

  // Ending C (Ascension / Iron Sovereign): Cold mission-first ruthlessness (rejected Ghost-9 & survivor/ally)
  if ((choices.squadmateSaved === false || choices.survivorRescued === false) && choices.ghostTrust < 2) {
    return {
      ending: 'ascension',
      reasonKr:
        '구출 포기 및 냉혹한 단독 강행 선택 → 절대 권한 강탈 다크 엔딩 [철의 황제] 자동 달성',
    };
  }

  // Ending A (Dawn of Humanity): Protected humanity & squadmates, pulled the physical killswitch
  return {
    ending: 'dawn',
    reasonKr:
      '생존자와 분대원을 지켜낸 끝에 물리 킬스위치 가동 → 인류 귀환 엔딩 [새벽의 귀환] 자동 달성',
  };
}

export function getMissionProfile(id: CampaignMissionId): MissionProfile {
  return CAMPAIGN_MISSIONS.find((m) => m.id === id) ?? CAMPAIGN_MISSIONS[0];
}

export function computeCampaignObjectiveText(
  missionId: CampaignMissionId,
  stage: CampaignStageId,
  remainingHostiles: number,
  totalHostiles: number,
  coreHpPct: number,
  crisisTimerSec: number
): { title: string; detail: string; progressPct: number } {
  const cleared = Math.max(0, totalHostiles - remainingHostiles);
  const ratioPct =
    totalHostiles > 0 ? Math.min(100, Math.round((cleared / totalHostiles) * 100)) : 0;

  switch (stage) {
    case 'm1_landing':
      return {
        title: 'MISSION 01 · 한강변 강습 상륙',
        detail: '해군 공기부양정 LCAC-655 접안 중 — 충격 대비',
        progressPct: 15,
      };
    case 'm1_beachhead':
      return {
        title: 'MISSION 01 · 한강변 강습 상륙',
        detail: `연막 속 해안 교두보 적 매복조 소탕 (${cleared}/${totalHostiles})`,
        progressPct: Math.max(20, ratioPct),
      };
    case 'm2_alley':
      return {
        title: 'MISSION 02 · 을지로 시가전 & 브리칭',
        detail:
          remainingHostiles > 0
            ? `2층 안경점 저격수 및 골목 매복 제압 (${cleared}/${totalHostiles})`
            : '동측 적 지휘소 방폭문으로 이동해 [F] C4 브리칭',
        progressPct: remainingHostiles > 0 ? Math.min(68, Math.round(ratioPct * 0.7)) : 72,
      };
    case 'm2_breach_slowmo':
      return {
        title: 'MISSION 02 · BREACH & CLEAR (0.2x)',
        detail: `슬로모션 돌입! 지휘소 내부 적 즉각 사살 (${cleared}/${totalHostiles})`,
        progressPct: 82,
      };
    case 'm2_survivor_ghost':
      return {
        title: 'MISSION 02 · 생존자 & 고스트-9 대면',
        detail: '[F] 생존자 구출 · 고스트-9 협력  /  [G] 임무 우선 강행',
        progressPct: 92,
      };
    case 'm3_heli_insert':
      return {
        title: 'MISSION 03 · UH-60K 무장 헬기 강습',
        detail: `측문 M134 미니건으로 지면 대공·매복 표적 소탕 (${cleared}/${totalHostiles})`,
        progressPct: Math.min(48, Math.max(8, Math.round(ratioPct * 0.45))),
      };
    case 'm3_ac130_flir':
      return {
        title: 'MISSION 03 · AC-130 열화상(FLIR) 지원',
        detail: `시타델 외곽 적 기갑 증원 열원 초토화 (${cleared}/${totalHostiles})`,
        progressPct: Math.min(100, 50 + Math.round(ratioPct * 0.5)),
      };
    case 'm4_tank_assault':
      return {
        title: 'MISSION 04 · K2-X 흑표 전차 돌파전',
        detail:
          remainingHostiles > 0
            ? `[F] K2-X 흑표 전차 탑승 · 120mm 주포로 시타델 방어선 & 타이탄 격파 (${cleared}/${totalHostiles})`
            : `방어선 돌파 완료! 노출된 중앙 OMNI-CORE 파괴 또는 [F] 접속 (${coreHpPct}%)`,
        progressPct: remainingHostiles > 0 ? Math.min(82, 16 + Math.round(ratioPct * 0.66)) : 88,
      };
    case 'm4_elevator_breach':
      return {
        title: 'MISSION 04 · OMNI-CORE 타워 돌입',
        detail: '외벽 강습 엘리베이터 상승 · 소재우 중사와 방폭문 강제 개방',
        progressPct: 20,
      };
    case 'm4_tower_assault':
      return {
        title: 'MISSION 04 · OMNI-CORE 타워 최후 결전',
        detail:
          remainingHostiles > 0
            ? `OMNI-TITAN 오버로드 및 친위 메크 격파 (${cleared}/${totalHostiles})`
            : `노출된 중앙 코어 파괴 또는 [F] 접속 (${coreHpPct}%)`,
        progressPct: remainingHostiles > 0 ? Math.min(72, 25 + Math.round(ratioPct * 0.45)) : 80,
      };
    case 'm4_sacrifice_crisis':
      return {
        title: 'MISSION 04 · 긴급 위기: 소재우 중사 매몰',
        detail: `[F] 중사님 구출 (${Math.ceil(crisisTimerSec)}초)  /  [G] 코어로 단독 돌진`,
        progressPct: 90,
      };
    case 'm4_final_core':
      return {
        title: 'MISSION 04 · ZERO HOUR 심장부',
        detail: `OMNI-CORE 단말기 [F] 접속으로 운명의 결말 집행 (코어 ${coreHpPct}%)`,
        progressPct: 96,
      };
    default:
      return {
        title: `MISSION 0${missionId}`,
        detail: '작전 수행 중',
        progressPct: 50,
      };
  }
}
