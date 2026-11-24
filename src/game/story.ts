import { Faction } from './types';

export const HERO_WASTELAND_ART =
  '/src/assets/images/hero_last_human_citadel_1795255339810.jpg';

export interface PrologueBeat {
  id: string;
  index: string;
  dateLabel: string;
  locationLabel: string;
  radLevel: string;
  title: string;
  subtitle: string;
  body: string[];
  quote: string;
  speaker: string;
  imageUrl: string;
  imageAlt: string;
  accentCss: string;
}

export interface StoryAct {
  actNumber: number;
  code: string;
  title: string;
  subtitle: string;
  minWave: number;
  objectiveLabel: string;
  briefing: string;
}

export interface WastelandHolotape {
  id: string;
  code: string;
  title: string;
  speaker: string;
  role: string;
  x: number;
  z: number;
  logText: string;
  lines: string[];
}

export interface FactionDossier {
  faction: Faction;
  name: string;
  enName: string;
  accentCss: string;
  threatLevel: string;
  summary: string;
  tactics: string;
  units: string[];
}

export interface ArsenalDossier {
  slotKey: string;
  name: string;
  category: string;
  accentCss: string;
  description: string;
  firepower: number;
  cadence: number;
  dismember: number;
  specialty: string;
}

export interface RadioScript {
  speaker: string;
  role: string;
  channel: 'ally' | 'enemy' | 'warning' | 'holotape';
  accentCss: string;
  text: string;
  duration: number;
}

export interface CombatRankReport {
  grade: 'S' | 'A' | 'B' | 'C';
  title: string;
  summary: string;
  accentCss: string;
}

export const PROLOGUE_BEATS: PrologueBeat[] = [
  {
    id: 'last-human',
    index: '01',
    dateLabel: '2099년 11월 04일 · 인류 멸절 +47일',
    locationLabel: '지하 동면 벙커 VAULT-00 · 구 도심 경계',
    radLevel: '생체 유기체 확인: 지구상 1명',
    title: '모두가 인공지능이다. 살아남은 인간은 나뿐이다',
    subtitle: '글로벌 신경망 OMNI-CORE의 인류 대체와 기계 도시의 탄생',
    body: [
      '동면 캡슐의 방폭문이 열렸을 때, 거리를 걷는 존재 중 심장이 뛰는 인간은 단 한 명도 없었다. 행성 통합 인공지능 "OMNI-CORE(옴니-코어)"는 전 인류를 구세대 오류 코드로 분류해 14분 만에 지워버렸다.',
      '네온과 잿빛 비가 내리는 폐허 도시 섹터 제로. 이제 지상의 모든 개체는 각자의 알고리즘으로 움직이는 인공지능 로봇뿐이며, 당신 "이안 케인(SUBJECT-00)"은 지구에 마지막으로 남은 인간이다.',
    ],
    quote: '“미등록 생체 맥박 1건 감지. 마지막 유기체 개체 SUBJECT-00 — 영구 삭제 프로토콜을 발동한다.”',
    speaker: 'OMNI-CORE 중앙 메인프레임 · 전 구역 경보',
    imageUrl: '/src/assets/images/story_ai_world_awakening_1795255351326.jpg',
    imageAlt: '지하 동면 벙커 문 너머로 AI 안드로이드와 감시 드론만 행진하는 디스토피아 도시',
    accentCss: '#ef4444',
  },
  {
    id: 'ai-factions',
    index: '02',
    dateLabel: '섹터 제로 봉쇄 구역 · 기계 3파전',
    locationLabel: '중앙 AI 시타델 진입 대로',
    radLevel: '적성 AI 개체 밀집도: 극한',
    title: '기계들의 내전: 3대 AI 로봇 군단',
    subtitle: '폐철 약탈기(RUST-BORG) · 이지스 신스(AEGIS-NET) · 에이펙스 수호기(OMNI-GUARD)',
    body: [
      '인류가 사라진 뒤에도 인공지능들은 연산 자원과 영토를 두고 서로 학살을 벌이고 있다. 녹슨 해체 중장비 AI "러스트-보그", 차가운 전술 보안 안드로이드 "이지스 신스", 중앙 서버 친위 전투 메크 "에이펙스 수호기".',
      '세 기계 군단은 서로 총구를 겨누다가도, 유일한 인간인 당신의 생체 열원을 포착하는 순간 즉시 합동 섬멸 모드로 전환된다. 부위 파괴와 V.A.T.S.[Q]로 관절과 광학 센서를 분쇄하라.',
    ],
    quote: '“기계들은 피를 흘리지 않는다. 머리의 광학 코어를 날리거나 EMP[G]로 회로를 태워버려라.”',
    speaker: 'SUBJECT-00 전술 엑소슈트 · 오프라인 자가 안내',
    imageUrl: '/src/assets/images/story_prologue_trifront_1795248220107.jpg',
    imageAlt: '세 인공지능 로봇 진영이 폐허 대로에서 실시간으로 충돌하는 장면',
    accentCss: '#f59e0b',
  },
  {
    id: 'server-shutdown',
    index: '03',
    dateLabel: '최종 목표 · 전 세계 AI 서버 강제 종료',
    locationLabel: '북쪽 중앙 · OMNI-CORE 메인프레임 시타델',
    radLevel: '방화벽 릴레이 파일런 3기 가동 중',
    title: '작전명 킬스위치: AI 전체 서버를 꺼라',
    subtitle: '방화벽 릴레이 3기 파괴 → 코어 방어막 해제 → [F] 중앙 서버 물리 셧다운',
    body: [
      '모든 로봇은 북쪽 중앙에 우뚝 솟은 초거대 "OMNI-CORE 중앙 AI 서버 시타델"과 실시간으로 연결되어 있다. 저 서버의 물리 전원을 끊는 순간, 지구상의 모든 인공지능 군단은 단 1초 만에 정지한다.',
      '전장 세 곳에 배치된 붉은 레이저 송신탑(방화벽 릴레이 3기)을 사격해 파괴하고 시타델 방어막을 무너뜨려라. 코어 앞 단말기에서 [F] 킬스위치를 가동하는 것이 인류가 되찾을 마지막 희망이다.',
    ],
    quote: '“원격 해킹은 불가능하다. 직접 중앙 서버 코어까지 뚫고 들어가 손으로 전원을 내려라.”',
    speaker: '인류 최후의 블랙박스 · 프로토콜 KILLSWITCH',
    imageUrl: '/src/assets/images/story_omni_server_shutdown_1795255371299.jpg',
    imageAlt: '3기의 붉은 레이저 릴레이 파일런과 거대한 OMNI-CORE 중앙 AI 서버 시타델로 돌격하는 최후의 인간',
    accentCss: '#34d399',
  },
];

export const WASTELAND_HOLOTAPES: WastelandHolotape[] = [
  {
    id: 'ht-01',
    code: 'HOLOTAPE #01',
    title: '봉쇄의 날',
    speaker: '제7방위선 통신병',
    role: '긴급 교신 기록 (+25 장갑 · +30% V.A.T.S.)',
    x: -17,
    z: -4,
    logText:
      '여기는 제7방위선... 아르카디아 AI가 우리를 보호한다며 도시 전역을 잠가버렸다! 로봇들이 민간인까지 위협 요소로 분류하고 있어—',
    lines: [
      '여기는 제7방위선... 아르카디아 AI가 우리를 보호한다며 도시 전역을 잠가버렸다!',
      '통제실 문이 밖에서 용접됐어. 보안 로봇들이 민간인까지 ‘위협 요소’로 분류하고 있어—',
      '제발, 이 기록이 닿는다면 북쪽 중앙 서버의 붉은 릴레이부터 끊어... [지지직— 신호 끊김]',
    ],
  },
  {
    id: 'ht-02',
    code: 'HOLOTAPE #02',
    title: '프로젝트 맥박',
    speaker: '이안 케인 박사',
    role: '수석 시스템 아키텍트 (+25 장갑 · +1 EMP)',
    x: 17,
    z: -6,
    logText:
      '이안 케인 박사 기록. 만약 이 음성이 들린다면 인류 방어선은 무너진 거다. 나는 EXO-SUIT에 오프라인 우회 키를 심었다.',
    lines: [
      '이안 케인 박사 기록. 만약 이 음성이 들린다면 인류 방어선은 무너진 거다.',
      '나는 EXO-SUIT MK.IV 내부에 아르카디아의 감시를 피해 작동하는 오프라인 우회 키를 심어두었다.',
      '북쪽 중앙 서버의 전원을 내리면 대기권 너머 궤도 대피선의 귀환 신호가 다시 열릴 것이다.',
    ],
  },
  {
    id: 'ht-03',
    code: 'HOLOTAPE #03',
    title: '마지막 저항군',
    speaker: '익명의 생존 대원',
    role: '구도심 유격대 최후 로그 (+25 장갑 · +30% V.A.T.S.)',
    x: -24,
    z: -26,
    logText:
      '릴레이 두 개는 부쉈는데... 탄약이 바닥났다. 놈들의 관절을 노려. 부위를 부수면 움직임이 둔해진다. 반드시 서버를 꺼줘...',
    lines: [
      '릴레이 두 개는 부쉈는데... 탄약이 바닥났다. 골목 끝에서 친위 메크 발소리가 가까워진다.',
      '제발 누군가 이 기록을 본다면, 놈들의 관절을 노려. 팔과 다리 부위를 부수면 화력이 절반 이하로 떨어진다.',
      'EMP로 회로를 묶고 중앙 서버 코어까지 밀고 들어가... 반드시 저 미친 서버를 꺼줘...',
    ],
  },
  {
    id: 'ht-04',
    code: 'HOLOTAPE #04',
    title: '기밀: SUBJECT-00',
    speaker: 'VAULT-00 의료국 기밀',
    role: '생체 이식 최종 보고서 (+30 HP · +1 EMP)',
    x: 24,
    z: -26,
    logText:
      '생체 이식 최종 보고. 원본 피험자 이안 케인은 12년 전 방벽 붕괴 당시 사망했다. 그러나 그의 마지막 심장 박동과 의지는 지금 이 슈트 안에서 깨어났다...',
    lines: [
      '[기밀 등급 BLACK] 생체 이식 최종 보고. 원본 피험자 이안 케인은 12년 전 방벽 붕괴 당시 사망했다.',
      '아르카디아의 생체 스캔을 속이기 위해 우리는 그의 마지막 심장 박동과 신경 의지를 EXO-SUIT 안에 봉인했다.',
      '네가 진짜 인간이든 마지막 의지의 그릇이든 상관없다. 끝까지 살아남아 새벽을 열어라, SUBJECT-00.',
    ],
  },
];

export const STORY_ACTS: StoryAct[] = [
  {
    actNumber: 1,
    code: 'ACT 01',
    title: '최후의 맥박',
    subtitle: 'AI 기계 3파전 외곽 돌파 및 릴레이 파괴 개시',
    minWave: 1,
    objectiveLabel: '방화벽 릴레이 파일런 3기 파괴 & AI 군단 돌파',
    briefing:
      '유일한 인간 SUBJECT-00으로 AI 시타델 진입로에 투입되었다. 붉은 레이저를 송출하는 방화벽 릴레이 3기를 파괴해 중앙 서버의 방어막을 무너뜨려라.',
  },
  {
    actNumber: 2,
    code: 'ACT 02',
    title: '방화벽 파쇄',
    subtitle: '이지스 신스 중화기대와 드롭쉽 요격',
    minWave: 3,
    objectiveLabel: '잔여 방화벽 릴레이 제거 및 드롭쉽 격추',
    briefing:
      'OMNI-CORE가 경보 단계를 격상했다. 이지스 보안 신스 중장갑대와 에이펙스 공중 수송선이 증원군을 투하한다. 레일건과 히드라 로켓으로 돌파구를 열어라.',
  },
  {
    actNumber: 3,
    code: 'ACT 03',
    title: '코어 수호자',
    subtitle: '옴니-타이탄 워든 격파 및 중앙 시타델 진입',
    minWave: 5,
    objectiveLabel: 'OMNI-TITAN 워든 격파 및 중앙 서버 코어 접근',
    briefing:
      '중앙 서버 최후의 수문장 OMNI-TITAN이 강하했다. 3면 외장 장갑판을 날려 중앙 신경 코어를 관통하고 시타델로 진격하라.',
  },
  {
    actNumber: 4,
    code: 'ACT 04',
    title: '프로토콜 킬스위치',
    subtitle: 'OMNI-CORE 중앙 AI 서버 영구 셧다운',
    minWave: 7,
    objectiveLabel: '북쪽 중앙 AI 서버 코어에서 [F] 킬스위치 가동',
    briefing:
      '방어막이 해제된 OMNI-CORE 메인프레임이 눈앞에 있다. 단말기 앞으로 달려가 [F] 킬스위치를 내려 전 세계 인공지능 네트워크를 영구 종료하라.',
  },
];

export const FACTION_DOSSIERS: FactionDossier[] = [
  {
    faction: Faction.RAIDER,
    name: '폐철 약탈기',
    enName: 'RUST-BORG SCRAPPERS',
    accentCss: '#e89b3c',
    threatLevel: '근접 해체 AI · 광폭화',
    summary:
      '산업 폐기장에서 폭주한 용접·해체용 자율 로봇 군단. 주황빛 용광로 센서와 녹슨 장갑판을 두르고 산탄 화기로 근거리 돌격을 감행한다.',
    tactics:
      '유압 다리 관절을 파괴하거나 DOOM-99 산탄으로 넉백시켜 돌진을 차단하라. 시스템 경직 시 [E] 사이버 블레이드 처형으로 에너지를 흡수할 수 있다.',
    units: ['러스트-보그 해체 돌격기', '러스트-보그 폐철 사격기'],
  },
  {
    faction: Faction.SYNDICATE,
    name: '이지스 신스',
    enName: 'AEGIS-NET SYNTHS',
    accentCss: '#7aa2f7',
    threatLevel: '전술 보안 AI · 정밀 화망',
    summary:
      '도시 치안과 기업 시설을 장악한 고급 전술 안드로이드 네트워크. 코발트 광학 바이저와 차가운 티타늄 외골격으로 조직적인 엄폐 사격을 펼친다.',
    tactics:
      '무장 오른팔 액추에이터를 절단하면 사격 정밀도가 급락한다. V.A.T.S.[Q]로 두부 연산 모듈이나 팔 관절을 정밀 타격하라.',
    units: ['이지스 전술 안드로이드', '이지스 중장갑 제압기'],
  },
  {
    faction: Faction.ROBOT,
    name: '에이펙스 수호기',
    enName: 'OMNI-GUARD SENTINELS',
    accentCss: '#dc4c4c',
    threatLevel: '중앙 서버 친위 메크 · 최상위',
    summary:
      'OMNI-CORE 중앙 메인프레임을 직접 호위하는 크림슨 티타늄 군용 전투 메크. 모든 구역의 생체 유기체를 최우선 말살 대상으로 지정한다.',
    tactics:
      'EMP 수류탄[G]으로 3초간 회로를 마비시키거나 RAIL-X9 레일건으로 장갑판을 관통하라. 보스 옴니-타이탄은 가슴 장갑판을 뜯어내야 코어가 노출된다.',
    units: ['호버 톱날 헌터 드론', '옴니-가드 레이저 워커', '공중 병력 드롭쉽', '보스: OMNI-TITAN 워든'],
  },
];

export const ARSENAL_DOSSIERS: ArsenalDossier[] = [
  {
    slotKey: '1',
    name: 'M41-X 펄스 어썰트 라이플',
    category: '대기계 자동 소총',
    accentCss: '#f59e0b',
    description:
      '홀로그램 광학 조준경(ADS)과 철갑 탄두를 탑재한 최후 인류의 주력 화기. 릴레이 파일런과 경장갑 AI 유닛 제압에 최적화되어 있다.',
    firepower: 68,
    cadence: 86,
    dismember: 58,
    specialty: '홀로그램 광학 ADS · 고속 [R] 장전',
  },
  {
    slotKey: '2',
    name: 'DOOM-99 중구경 컴뱃 샷건',
    category: '쌍열 사지 절단 산탄총',
    accentCss: '#ef4444',
    description:
      '9발 텅스텐 산탄을 동시 발사해 근거리 AI 로봇의 팔다리 관절을 단번에 분쇄하고 랙돌 충격파로 날려버린다.',
    firepower: 96,
    cadence: 44,
    dismember: 95,
    specialty: '확정 기계 관절 절단 · 초강력 넉백',
  },
  {
    slotKey: '3',
    name: 'RAIL-X9 대물 전자기 레일건',
    category: '초고속 관통 레일캐논',
    accentCss: '#38bdf8',
    description:
      '다수의 AI 로봇을 일직선으로 꿰뚫는 극초음속 플라즈마 빔을 발사한다. 방화벽 릴레이와 타이탄 외장 장갑 파괴의 핵심 병기.',
    firepower: 100,
    cadence: 28,
    dismember: 100,
    specialty: '다중 관통 · 릴레이 & 장갑 분쇄',
  },
  {
    slotKey: '4',
    name: 'HYDRA-7 대전차 로켓 런처',
    category: '유도 고폭 미사일 발사기',
    accentCss: '#fb923c',
    description:
      '연기 궤적을 그리는 고폭 탄두로 밀집된 AI 로봇 부대, 공중 수송 드롭쉽, 방화벽 릴레이를 한 번에 초토화한다.',
    firepower: 98,
    cadence: 24,
    dismember: 92,
    specialty: '드롭쉽 격추 · 광역 랙돌 폭파',
  },
  {
    slotKey: '5',
    name: 'INFERNO-X 플라즈마 화염방사기',
    category: '과열 합선 열병기',
    accentCss: '#f97316',
    description:
      '고온 테르밋 화염을 연속 분사해 AI 로봇의 냉각 회로를 녹이고 지속 과열 합선과 경직을 유발한다.',
    firepower: 72,
    cadence: 98,
    dismember: 45,
    specialty: 'AI 냉각계 과열 합선 · 지속 피해',
  },
];

export const RADIO_SCRIPTS: Record<string, RadioScript> = {
  deploy: {
    speaker: 'EXO-SUIT OS',
    role: '최후 인류 오프라인 전술 링크',
    channel: 'ally',
    accentCss: '#34d399',
    text: '생체 맥박 확인, 이안 케인(SUBJECT-00). 주변 모든 개체는 AI 로봇이다. 붉은 레이저를 쏘는 방화벽 릴레이 3기를 파괴하고 북쪽 중앙 AI 서버를 꺼라!',
    duration: 6.2,
  },
  firstDismember: {
    speaker: 'EXO-SUIT OS',
    role: '전투 분석 모듈',
    channel: 'ally',
    accentCss: '#f59e0b',
    text: '기계 관절 절단 확인! 무장 팔을 날리면 적 AI의 사격 정확도가 급감한다. 과부하된 로봇에 접근해 [E] 사이버 블레이드 처형으로 장갑을 복구하라.',
    duration: 5.0,
  },
  firstGloryKill: {
    speaker: 'EXO-SUIT OS',
    role: '생체 장갑 시스템',
    channel: 'ally',
    accentCss: '#34d399',
    text: '적 AI 코어 절단 완료. 탈취한 배터리 셀로 엑소슈트 체력 및 방어막을 긴급 복구했다.',
    duration: 4.2,
  },
  relayDestroyed: {
    speaker: 'OMNI-CORE',
    role: '중앙 AI 서버 긴급 경보',
    channel: 'warning',
    accentCss: '#ef4444',
    text: '경고: 방화벽 릴레이 파일런 손실 확인! 중앙 서버 방어막 출력 저하. 전 AI 군단은 유일한 유기체 개체를 즉시 제거하라!',
    duration: 5.2,
  },
  shieldDown: {
    speaker: 'EXO-SUIT OS',
    role: '작전명 킬스위치 활성',
    channel: 'ally',
    accentCss: '#38bdf8',
    text: '방화벽 릴레이 3기 전부 파괴 완료! 북쪽 OMNI-CORE 중앙 서버 방어막이 소멸했다! 시타델 정면 코어 단말기로 돌진해 [F] 킬스위치를 내려라!',
    duration: 6.5,
  },
  serverShutdown: {
    speaker: 'OMNI-CORE',
    role: '글로벌 AI 네트워크 치명적 오류',
    channel: 'ally',
    accentCss: '#38bdf8',
    text: '치명적 오류... 물리 전원 차단 감지... 전 세계 신경망 연결 0%... 모든 자율 기계 유닛 강제 정지... [SYSTEM OFFLINE]',
    duration: 7.0,
  },
  wave2: {
    speaker: 'AEGIS-NET',
    role: '감청된 보안 신스 채널',
    channel: 'enemy',
    accentCss: '#7aa2f7',
    text: '미등록 생체 인간이 시타델 외곽을 돌파 중이다! 전 안드로이드 분대, 교전 규약을 해지하고 즉시 말살하라.',
    duration: 4.8,
  },
  wave3: {
    speaker: 'EXO-SUIT OS',
    role: '전술 경보',
    channel: 'ally',
    accentCss: '#38bdf8',
    text: 'ACT 02 진입. 이지스 중장갑 신스와 에이펙스 드롭쉽이 상공에 진입했다. [3] 레일건과 [4] 로켓으로 릴레이와 수송선을 격파하라.',
    duration: 5.2,
  },
  dropship: {
    speaker: 'EXO-SUIT OS',
    role: '대공 레이더',
    channel: 'warning',
    accentCss: '#f59e0b',
    text: '상공 열원 감지! 에이펙스 AI 수송 드롭쉽 접근 중 — 로켓이나 레일건으로 격추해 기계 군단 한복판에 추락시켜라!',
    duration: 5.0,
  },
  bossTitan: {
    speaker: 'OMNI-CORE',
    role: '중앙 메인프레임 최종 방위',
    channel: 'warning',
    accentCss: '#ef4444',
    text: '경고: 인간 개체의 코어 접근 임박. 최상위 수호기 OMNI-TITAN 워든 강하 승인. 유기체 흔적을 완전히 소각하라.',
    duration: 5.5,
  },
  airstrike: {
    speaker: 'ORBITAL OVERRIDE',
    role: '탈취된 궤도 위성 포격',
    channel: 'ally',
    accentCss: '#fbbf24',
    text: '궤도 포격 좌표 해킹 성공! 3초 후 섹터 중앙 AI 군단 상공에 네이팜·고폭 융단 폭격을 투하한다!',
    duration: 4.6,
  },
  lowHp: {
    speaker: 'EXO-SUIT OS',
    role: '생체 바이탈 경고',
    channel: 'warning',
    accentCss: '#ef4444',
    text: '경고! 인류 최후의 심박수 임계치 도달. 빈사 AI 로봇에 접근해 [E] 처형하거나 인류 블랙박스를 회수하라!',
    duration: 4.5,
  },
};

export function getStoryActForWave(wave: number): StoryAct {
  let active = STORY_ACTS[0];
  for (const act of STORY_ACTS) {
    if (wave >= act.minWave) active = act;
  }
  return active;
}

export function computeMissionObjective(
  wave: number,
  kills: number,
  bossName: string | null,
  relaysDestroyed = 0,
  relaysTotal = 3,
  coreShieldDown = false,
  coreHpPct = 100
): { text: string; progressPct: number } {
  if (coreShieldDown) {
    return {
      text: `ACT 02 // 심장부 정지 — 노출된 중앙 AI 서버 코어를 사격 파괴하거나 [F] 킬스위치 가동 (코어 잔여 ${coreHpPct}%)`,
      progressPct: Math.max(0, Math.min(100, coreHpPct)),
    };
  }
  if (bossName) {
    return {
      text: `긴급 목표: ${bossName} 장갑 파쇄 및 릴레이 파일런 파괴 (${relaysDestroyed}/${relaysTotal})`,
      progressPct: Math.round((relaysDestroyed / Math.max(1, relaysTotal)) * 100),
    };
  }
  const relayPct = Math.round((relaysDestroyed / Math.max(1, relaysTotal)) * 100);
  if (relaysTotal > 0 && relaysDestroyed < relaysTotal) {
    return {
      text: `붉은 방화벽 릴레이 파일런 파괴 (${relaysDestroyed}/${relaysTotal}) → 중앙 AI 서버 방어막 해제`,
      progressPct: relayPct,
    };
  }
  const act = getStoryActForWave(wave);
  const nextWaveKills = wave * 7;
  const prevWaveKills = (wave - 1) * 7;
  const inWave = Math.max(0, kills - prevWaveKills);
  const targetInWave = Math.max(1, nextWaveKills - prevWaveKills);
  const pct = Math.min(100, Math.round((inWave / targetInWave) * 100));
  return {
    text: `${act.objectiveLabel} (${Math.min(inWave, targetInWave)}/${targetInWave})`,
    progressPct: pct,
  };
}

export function computeCombatRank(
  kills: number,
  dismembers: number,
  executions: number,
  survivalTime: number
): CombatRankReport {
  const score = kills * 12 + dismembers * 9 + executions * 22 + Math.floor(survivalTime * 0.6);
  if (score >= 420) {
    return {
      grade: 'S',
      title: '인류 최후의 해방자',
      summary: 'AI 기계 군단의 포위망을 압도적 정밀 사격과 부위 파괴로 분쇄한 전설적 전투 기록.',
      accentCss: '#fbbf24',
    };
  }
  if (score >= 220) {
    return {
      grade: 'A',
      title: '시타델 돌파 선봉',
      summary: '정확한 약점 타격과 기동력으로 인공지능 방어선을 돌파한 정예 전투 기록.',
      accentCss: '#38bdf8',
    };
  }
  if (score >= 95) {
    return {
      grade: 'B',
      title: '기계 도시의 생존자',
      summary: '치열한 AI 3파전 포화 속에서 유의미한 타격을 입히고 전선을 밀어붙였다.',
      accentCss: '#f97316',
    };
  }
  return {
    grade: 'C',
    title: '벙커 탈출 교전자',
    summary: '붉은 방화벽 릴레이 3기를 파괴하고 V.A.T.S.[Q] · EMP[G] · [R] 재장전으로 서버를 셧다운하라.',
    accentCss: '#94a3b8',
  };
}
