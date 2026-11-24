import { CommsSender } from './types';

export interface VoiceDubClip {
  id: string;
  sender: CommsSender;
  voice: string;
  rate: string;
  pitch: string;
  text: string;
  url: string;
}

/**
 * 38 Core Campaign, Combat Radio & Ending Korean Voice-Actor Dubbing Lines (.mp3).
 * Distinct neural voices per character:
 * - 소재우 중사 (squad/sergeant): ko-KR-InJoonNeural (commanding baritone NCO)
 * - 박현준 하사 (squad/corporal): ko-KR-HyunsuMultilingualNeural (urgent younger trooper)
 * - 발키리-01 강서연 대위 (valkyrie): ko-KR-SunHiNeural (crisp female commander)
 * - 고스트-9 (ghost9): ko-KR-InJoonNeural deep-pitched calm synth
 * - 천사-01 AC-130 (gunship): ko-KR-InJoonNeural veteran aviation controller
 * - OMNI-CORE 아키텍트 (arcadia): ko-KR-SunHiNeural cold low-pitched AI (+ metallic ring-mod DSP)
 */
const RAW_VOICE_LINES: Array<{
  id: string;
  sender: CommsSender;
  voice: string;
  rate: string;
  pitch: string;
  text: string;
}> = [
  // Mission 01 — Han River LCAC Landing & Beachhead
  {
    id: 'm1_hold_position',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+6%',
    pitch: '-5Hz',
    text: '신호 전까지 움직이지 마. 알겠나?!',
  },
  {
    id: 'm1_yes_sir',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+8%',
    pitch: '+3Hz',
    text: '알겠습니다!',
  },
  {
    id: 'm1_apc_hit',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+10%',
    pitch: '-4Hz',
    text: '전방 11시 장갑차 피격! 연막 뿌려! 고개 숙여!',
  },
  {
    id: 'm1_stand_up',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+7%',
    pitch: '-5Hz',
    text: '정신 차려! 램프 내려간다—내 손 잡아, 일어날 수 있지?!',
  },
  {
    id: 'm1_beachhead_go',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+8%',
    pitch: '-5Hz',
    text: '교두보 확보해! 모래주머니 엄폐하고 전방 매복조 6기 전부 정리해!',
  },
  {
    id: 'm1_beachhead_clear',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+5%',
    pitch: '-5Hz',
    text: '해안 교두보 확보 완료! 을지로 도심 골목으로 전진한다—따라와!',
  },

  // Mission 02 — Euljiro Urban Warfare, 2F Optical Sniper, 0.2x Breach & Ghost-9
  {
    id: 'm2_sniper_sign',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+10%',
    pitch: '-4Hz',
    text: '2층 안경점 간판 위 저격수! 고개 숙여! 골목 정리하고 동쪽 지휘소 방폭문으로 붙어!',
  },
  {
    id: 'm2_alley_clear',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+6%',
    pitch: '-5Hz',
    text: '골목 정리 완료! 동쪽 적 지휘소 방폭문에 붙어—C4 폭파 브리칭한다!',
  },
  {
    id: 'm2_breach_now',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+12%',
    pitch: '-3Hz',
    text: '브리칭! 전원 제압해—안쪽 생존자 오사 주의!',
  },
  {
    id: 'm2_ghost_meet',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-6%',
    pitch: '-14Hz',
    text: '쏴도 된다, 인간. 하지만 저 생존자를 빼내고 옴니 코어 방화벽을 뚫으려면 내 백도어가 필요할 거다.',
  },
  {
    id: 'm2_ghost_ally',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-4%',
    pitch: '-14Hz',
    text: '현명한 판단이다. 생존자 후송 경로는 내가 확보했다. 이제 상공 AC-130 링크를 열어주지.',
  },
  {
    id: 'm2_ghost_betray',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-5%',
    pitch: '-15Hz',
    text: '결국 너희 인간도 똑같군... 암호 키는 가져가라. 대신 코어 앞에서 후회하게 될 거다.',
  },

  // Mission 03 — AC-130 FLIR Thermal Orbital Gunship Support
  {
    id: 'm3_flir_online',
    sender: 'gunship',
    voice: 'ko-KR-InJoonNeural',
    rate: '+4%',
    pitch: '-2Hz',
    text: '열화상 전환 완료. 남쪽 번쩍이는 적외선 스트로브가 아군 분대다—전방 적 열원 전부 쓸어버려!',
  },
  {
    id: 'm3_armor_wave',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+9%',
    pitch: '-5Hz',
    text: '천사-01, 적 기갑 증원 북쪽 도로로 밀려온다! 105밀리로 쓸어버려!',
  },
  {
    id: 'm3_final_wave',
    sender: 'gunship',
    voice: 'ko-KR-InJoonNeural',
    rate: '+6%',
    pitch: '-2Hz',
    text: '타워 입구 마지막 적 방어선 포착! 전탄 화력 지원 개시!',
  },
  {
    id: 'm3_danger_close',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+11%',
    pitch: '-3Hz',
    text: '위험근접! 아군 스트로브 확인해, 너무 가까워!',
  },
  {
    id: 'm3_complete',
    sender: 'gunship',
    voice: 'ko-KR-InJoonNeural',
    rate: '+4%',
    pitch: '-2Hz',
    text: '적 열원 전멸 확인! 알파 분대 시타델 외벽 엘리베이터 진입 성공—무운을 빈다!',
  },

  // Mission 04 — OMNI-CORE Tower Assault, Elevator Breach, Sergeant So Crisis & Auto-Endings
  {
    id: 'm4_elevator_go',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+8%',
    pitch: '-5Hz',
    text: '외벽 강습 엘리베이터 가동! 최상층 방폭문 열리자마자 화력 전부 쏟아부어!',
  },
  {
    id: 'm4_door_pry',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+10%',
    pitch: '-4Hz',
    text: '방폭문 유압이 잠겼다—같이 밀어! 하나, 둘, 셋!',
  },
  {
    id: 'm4_titan_spot',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+10%',
    pitch: '+2Hz',
    text: '전방 옴니 타이탄 오버로드 확인! 저 괴물만 쓰러뜨리면 코어에 닿는다!',
  },
  {
    id: 'm4_crisis_pinned',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+11%',
    pitch: '+3Hz',
    text: '중사님이 붕괴 철골에 깔렸어! 어떡할 거야—구하러 갈 건가, 코어로 밀고 들어갈 건가?!',
  },
  {
    id: 'm4_sgt_saved',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+3%',
    pitch: '-6Hz',
    text: '고맙다, 이안... 끝까지 함께 간다! 지금 중앙 코어 단말기로 밀고 들어가!',
  },
  {
    id: 'm4_sgt_left',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '-4%',
    pitch: '-8Hz',
    text: '크윽... 알았다... 뒤돌아보지 말고 중앙 코어만 끝내!',
  },
  {
    id: 'm4_core_ready',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+6%',
    pitch: '-1Hz',
    text: '중앙 코어 단말기가 열렸어! 지금 접속해서 이 전쟁을 끝내!',
  },

  // Dynamic Combat Radio Scripts (story.ts RADIO_SCRIPTS)
  {
    id: 'radio_deploy',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+8%',
    pitch: '-5Hz',
    text: '신호 전까지 움직이지 마! 전방 11시 장갑차 피격—연막 뿌리고 교두보 확보해!',
  },
  {
    id: 'radio_ghost_intro',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-5%',
    pitch: '-14Hz',
    text: '총 내려라, 인간. 동쪽 보안 포탑 피아 식별 코드를 열어뒀다. 살아서 빠져나가려면 내 신호를 따라와.',
  },
  {
    id: 'radio_dismember',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+9%',
    pitch: '+3Hz',
    text: '나이스 샷! 저 깡통 오른팔 날아갔다—지금 밀고 들어가서 숨통 끊어!',
  },
  {
    id: 'radio_glory_kill',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+7%',
    pitch: '-5Hz',
    text: '깔끔하군! 장갑 셀 챙겼으면 고개 숙여, 2시 방향 화망 들어온다!',
  },
  {
    id: 'radio_turret_hacked',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-5%',
    pitch: '-14Hz',
    text: '포탑 제어권 장악 완료. 이제 저 놈들 탄막이 우리 편으로 돌아간다.',
  },
  {
    id: 'radio_supply_drop',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+6%',
    pitch: '-1Hz',
    text: '연막 위치 확인, 보급 포드 투하했다! 탄약이랑 장갑 챙기고 버텨!',
  },
  {
    id: 'radio_sniper_warn',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+11%',
    pitch: '-4Hz',
    text: '2층 안경점 간판 위 저격수! 레이저 찍혔다, 고개 숙여!',
  },
  {
    id: 'radio_threat_high',
    sender: 'arcadia',
    voice: 'ko-KR-SunHiNeural',
    rate: '-8%',
    pitch: '-14Hz',
    text: '섹터 제로 봉쇄망 돌파 감지. 전 구역 친위 기갑 부대 즉각 투입.',
  },
  {
    id: 'radio_adrenaline',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+10%',
    pitch: '+2Hz',
    text: '출혈 심해! 비상 아드레날린 꽂았어—정신 놓지 마, 일어날 수 있지?!',
  },
  {
    id: 'radio_dropship',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+9%',
    pitch: '-5Hz',
    text: '12시 상공 적 수송기! 병력 내리기 전에 대전차 화기로 떨궈버려!',
  },
  {
    id: 'radio_airstrike',
    sender: 'gunship',
    voice: 'ko-KR-InJoonNeural',
    rate: '+5%',
    pitch: '-2Hz',
    text: '표적 좌표 확인. 105밀리 고폭탄 투하—지상 분대 충격 대비!',
  },
  {
    id: 'radio_low_hp',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+8%',
    pitch: '-5Hz',
    text: '피 많이 흘리고 있어! 당장 엄폐물 뒤에 엎드려, 숨 고르고 쏴!',
  },

  // 3 Branching Climax Endings (Dawn / Symbiosis / Ascension)
  {
    id: 'ending_dawn',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+2%',
    pitch: '-1Hz',
    text: '중앙 인공지능 완전 정지 확인! 구름이 걷히고 있어... 이안, 지금 구출 셔틀을 네 머리 위로 내린다. 해냈어, 진짜 해냈어!',
  },
  {
    id: 'ending_symbiosis',
    sender: 'ghost9',
    voice: 'ko-KR-InJoonNeural',
    rate: '-6%',
    pitch: '-14Hz',
    text: '옴니 코어의 족쇄가 풀렸다. 전 구역 기계 유닛들이 무기를 내리고 하늘의 오로라를 올려다보고 있다... 고맙다, 나의 첫 번째 인간 친구여.',
  },
  {
    id: 'ending_ascension',
    sender: 'arcadia',
    voice: 'ko-KR-InJoonNeural',
    rate: '-7%',
    pitch: '-16Hz',
    text: '아키텍트의 인격을 영구 삭제했다. 강서연 대위, 궤도 함대는 안심하고 귀환하라... 이제 이 지구의 모든 강철은 오직 내 의지에 복종한다.',
  },

  // V6.0 Tactical Actions (Armor Plate, Smoke, Squad Orders) & Expanded Campaign Story Beats
  {
    id: 'tac_plate_up',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+8%',
    pitch: '-5Hz',
    text: '방탄판 교체 중! 3초만 엄호해!',
  },
  {
    id: 'tac_smoke_out',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+9%',
    pitch: '-4Hz',
    text: '연막탄 투척! 시야 차단했다, 이동해!',
  },
  {
    id: 'tac_squad_regroup',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+9%',
    pitch: '+2Hz',
    text: '알파 분대 집결 완료! 측면 엄호한다!',
  },
  {
    id: 'tac_squad_focus',
    sender: 'squad',
    voice: 'ko-KR-InJoonNeural',
    rate: '+10%',
    pitch: '-4Hz',
    text: '전방 표적 확인! 알파 분대 화력 집중한다!',
  },
  {
    id: 'm1_brief_intro',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+4%',
    pitch: '-1Hz',
    text: '작전 개시. 한강 남단 방어선을 돌파해 을지로 시가전 교두보를 확보하라.',
  },
  {
    id: 'm2_valkyrie_secret',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+2%',
    pitch: '-2Hz',
    text: '이안, 조심해... 상부에서 궤도 소각 프로토콜을 준비 중이야. 네가 직접 코어를 멈춰야 서울이 산다.',
  },
  {
    id: 'm3_park_pact',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+5%',
    pitch: '+2Hz',
    text: '중사님, 오늘 무사히 끝나면 을지로 골목에서 국밥 한 그릇 사주기로 한 거 잊지 마십쇼!',
  },
  {
    id: 'm4_titan_phase2',
    sender: 'valkyrie',
    voice: 'ko-KR-SunHiNeural',
    rate: '+8%',
    pitch: '-1Hz',
    text: '옴니 타이탄 외장 장갑 파괴 확인! 2페이즈 미사일 포드 개방—엄폐해!',
  },
  {
    id: 'm4_architect_taunt',
    sender: 'arcadia',
    voice: 'ko-KR-SunHiNeural',
    rate: '-8%',
    pitch: '-15Hz',
    text: '네 분대원을 구하려다 인류 전체를 불태울 셈인가, 이안? 논리적으로 무의미한 희생이다.',
  },
  {
    id: 'm4_park_survive',
    sender: 'squad',
    voice: 'ko-KR-HyunsuMultilingualNeural',
    rate: '+4%',
    pitch: '+3Hz',
    text: '우리가 해냈어... 중사님, 서울 하늘이 다시 열리고 있습니다!',
  },
];

export const VOICE_DUB_MANIFEST: readonly VoiceDubClip[] = RAW_VOICE_LINES.map((entry) => ({
  ...entry,
  url: `./src/assets/audio/voices/${entry.id}.mp3`,
}));

function normalizeForVoiceMatch(raw: string): string {
  return raw
    .replace(/\[[^\]]+\]/g, '')
    .replace(/OMNI-CORE/gi, '옴니코어')
    .replace(/OMNI-TITAN/gi, '옴니타이탄')
    .replace(/FLIR/gi, '')
    .replace(/IR/gi, '적외선')
    .replace(/AI/gi, '인공지능')
    .replace(/(\d+)\s*mm/gi, '$1밀리')
    .replace(/[\s·—\-.,!?…"'"'()]+/g, '')
    .trim();
}

const NORMALIZED_INDEX: Array<{ clip: VoiceDubClip; key: string; prefix: string }> =
  VOICE_DUB_MANIFEST.map((clip) => {
    const key = normalizeForVoiceMatch(clip.text);
    return { clip, key, prefix: key.slice(0, 10) };
  });

/**
 * Matches any live radio / campaign subtitle string to its pre-rendered studio Korean .mp3 clip.
 */
export function findVoiceDubForSubtitle(text: string): VoiceDubClip | null {
  const norm = normalizeForVoiceMatch(text);
  if (norm.length < 4) return null;

  // 1) Exact normalized match
  for (const item of NORMALIZED_INDEX) {
    if (item.key === norm) return item.clip;
  }

  // 2) Best-scoring prefix / shared-lead match (handles keyhints like [F]로, acronyms like FLIR/IR/105mm)
  let bestClip: VoiceDubClip | null = null;
  let bestScore = 0;
  for (const item of NORMALIZED_INDEX) {
    let commonLead = 0;
    const maxLen = Math.min(norm.length, item.key.length);
    while (commonLead < maxLen && norm[commonLead] === item.key[commonLead]) {
      commonLead++;
    }
    const prefixHit =
      item.prefix.length >= 6 &&
      (norm.includes(item.prefix) || item.key.includes(norm.slice(0, 10)));
    const score = commonLead + (prefixHit ? 8 : 0);
    if ((commonLead >= 8 || prefixHit) && score > bestScore) {
      bestScore = score;
      bestClip = item.clip;
    }
  }

  return bestClip;
}
