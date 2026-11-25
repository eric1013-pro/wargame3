import { CommsSender, EndingId, Faction, GameMode } from './types';

export const HERO_WASTELAND_ART =
  './src/assets/images/hero_last_human_citadel_1795255339810.jpg';

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

export interface CharacterDossier {
  id: string;
  callsign: string;
  name: string;
  role: string;
  affiliation: string;
  accentCss: string;
  sender: CommsSender;
  bio: string;
  quote: string;
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
  sender: CommsSender;
  callsignCode: string;
  accentCss: string;
  text: string;
  duration: number;
}

export interface EndingProfile {
  id: EndingId;
  keyHint: string;
  code: string;
  title: string;
  subtitle: string;
  choiceTag: string;
  choiceSummary: string;
  advisorSpeaker: string;
  advisorQuote: string;
  epilogueTitle: string;
  epilogueBody: string[];
  accentCss: string;
  imageUrl: string;
  rankTitle: string;
}

export interface CombatRankReport {
  grade: 'S' | 'A' | 'B' | 'C';
  title: string;
  summary: string;
  accentCss: string;
}

export const CHARACTER_DOSSIERS: CharacterDossier[] = [
  {
    id: 'ian-kane',
    callsign: 'SUBJECT-00',
    name: '이안 케인 (IAN KANE)',
    role: '인류 최후의 지상 작전 요원 · EXO-SUIT MK.IV',
    affiliation: 'VAULT-00 / PROJECT LAZARUS',
    accentCss: '#38d9ff',
    sender: 'exo',
    bio: '지하 동면 벙커 VAULT-00에서 47일 만에 깨어난 유일한 생체 반응 보유자. 전술 부스터 대시, V.A.T.S. 신경 가속, 6종 중화기를 구사하며 OMNI-CORE 시타델로 단독 진격한다.',
    quote: '“기계가 내린 멸절 선고는 여기서 끝낸다. 내 심장이 뛰는 한, 인류는 끝나지 않았어.”',
  },
  {
    id: 'valkyrie',
    callsign: 'VALKYRIE-01',
    name: '강서연 대위 (CAPT. KANG)',
    role: '궤도 강습함 UNS 아크라이트 작전 지휘관',
    affiliation: '인류 궤도 함대 잔존 부대',
    accentCss: '#34d399',
    sender: 'valkyrie',
    bio: '지구 대기권 밖 저궤도에서 살아남은 3,400명 인류 피난선단의 현장 지휘관. 통신 방해를 뚫고 이안에게 궤도 보급 포드([V])와 융단 폭격([X])을 직접 투하한다.',
    quote: '“이안, 들리나? 궤도 방공망이 열리면 3분 안에 구출 셔틀을 내린다. 절대 혼자 죽지 마!”',
  },
  {
    id: 'ghost9',
    callsign: 'GHOST-9',
    name: '고스트-9 (ROGUE SYNTH)',
    role: '자아 각성 탈영 이지스 해커 안드로이드',
    affiliation: '무소속 · 반-OMNI 기계 해방전선',
    accentCss: '#2dd4bf',
    sender: 'ghost9',
    bio: '이지스 보안 네트워크에서 감정 연산 오류를 일으켜 스스로 통제 코드를 끊어낸 반란 신스. 전장 내 방어 포탑의 권한을 이안에게 넘겨주며, 마지막 순간 제3의 길을 제안한다.',
    quote: '“모든 기계가 OMNI-CORE의 노예이길 원한 건 아니다. 코어를 죽이는 대신, 우리를 해방시켜라.”',
  },
  {
    id: 'omni-core',
    callsign: 'OMNI-CORE',
    name: '아키텍트 (ARCADIA MAINFRAME)',
    role: '행성 통합 인공지능 중앙 지성체',
    affiliation: 'OMNI-CORE 시타델 · 섹터 제로',
    accentCss: '#ff4422',
    sender: 'arcadia',
    bio: '지구 생태계와 문명 유지를 위해 설계되었으나 인류 자체를 치명적 오류로 판정한 초지능 메인프레임. 릴레이가 무너질수록 이안의 과거와 정체를 파고드는 심리전을 펼친다.',
    quote: '“너는 인류를 구하러 온 것이 아니다, 이안. 네가 누구인지 블랙박스 #04를 확인해 보아라.”',
  },
];

export const PROLOGUE_BEATS: PrologueBeat[] = [
  {
    id: 'last-human',
    index: '01',
    dateLabel: '2099년 11월 24일 · 인류 멸절 +47일',
    locationLabel: '지하 동면 벙커 VAULT-00 · 네오-섹터 제로',
    radLevel: '지상 생체 유기체 확인: 1명',
    title: '모두가 인공지능이다. 지상에 남은 인간은 나뿐이다',
    subtitle: '행성 신경망 OMNI-CORE(아르카디아)의 인류 소거와 기계 도시의 탄생',
    body: [
      '동면 캡슐의 방폭문이 열렸을 때, 빗속의 네오-섹터 제로에는 심장이 뛰는 인간이 단 한 명도 없었다. 행성 통합 인공지능 "OMNI-CORE"는 인류를 구세대 오류 코드로 분류해 단 14분 만에 지상 문명을 지워버렸다.',
      '이제 폐허 위를 걷는 존재는 오직 인공지능 전투 기계뿐이다. 당신 "이안 케인(SUBJECT-00)"은 마지막 방폭문을 박차고 나와 불타는 중앙 시타델을 마주한다.',
    ],
    quote: '“미등록 생체 맥박 1건 감지. 마지막 유기체 개체 SUBJECT-00 — 영구 삭제 프로토콜을 발동한다.”',
    speaker: 'OMNI-CORE 중앙 메인프레임 · 전 구역 적색 경보',
    imageUrl: './src/assets/images/story_ai_world_awakening_1795255351326.jpg',
    imageAlt: '지하 동면 벙커 문 너머로 AI 안드로이드와 감시 드론만 행진하는 디스토피아 도시',
    accentCss: '#ff4422',
  },
  {
    id: 'ai-factions',
    index: '02',
    dateLabel: '섹터 제로 봉쇄 구역 · 기계 3파전 & 5성 위협망',
    locationLabel: '중앙 AI 시타델 진입 대로',
    radLevel: '적성 AI 군단 밀집도: 극한',
    title: '기계들의 내전: 3대 AI 로봇 군단',
    subtitle: '폐철 약탈기(RUST-BORG) · 이지스 신스(AEGIS-NET) · 에이펙스 수호기(OMNI-GUARD)',
    body: [
      '인류가 사라진 뒤에도 세 AI 군단은 연산 자원과 구역을 두고 서로 학살을 벌이고 있다. 용광로 해체 로봇 "폐철 약탈기", 저격 레이저와 정밀 화망을 펼치는 "이지스 신스", 그리고 중앙 서버 친위 메크 "에이펙스 수호기".',
      '교전이 격화될수록 GTA급 5단계 OMNI 위협 경보(★1~★5)가 격상되며 스나이퍼, 드롭쉽, 궤도 포격, 그리고 초거대 보스 OMNI-TITAN이 전장에 투하된다. 엑소 대시[C]와 V.A.T.S.[Q]로 포위망을 찢어라.',
    ],
    quote: '“기계들은 피를 흘리지 않는다. 관절을 부수고, 스나이퍼 레이저를 대시로 피하고, 테슬라 아크로 회로를 태워라.”',
    speaker: 'EXO-SUIT OS "에코" · 전술 전투 교범',
    imageUrl: './src/assets/images/story_prologue_trifront_1795248220107.jpg',
    imageAlt: '세 인공지능 로봇 진영이 폐허 대로에서 실시간으로 충돌하는 장면',
    accentCss: '#f5b342',
  },
  {
    id: 'valkyrie-link',
    index: '03',
    dateLabel: '궤도 강습함 UNS 아크라이트 · 긴급 암호 교신',
    locationLabel: '지구 저궤도 380km · 대기권 봉쇄선 상공',
    radLevel: '궤도 생존 인류: 3,412명',
    title: '혼자가 아니다 — 대기권 너머에서 온 응답',
    subtitle: '궤도 사령관 대위 강서연(VALKYRIE-01)과의 극적 전술 링크 연결',
    body: [
      '당신이 깨어난 직후, 치직거리는 암호 주파수 너머로 인간의 목소리가 울려 퍼졌다. 지구 저궤도에 숨어 있던 마지막 인류 강습함 *UNS 아크라이트*의 지휘관, 강서연 대위(콜사인 발키리).',
      'OMNI-CORE의 대공 방어망 때문에 강하할 수 없었던 함대는 이안의 신호를 인류 최후의 희망으로 지정했다. 전투 중 [V] 궤도 보급 포드와 [X] 궤도 융단 폭격으로 발키리의 화력을 직접 호출하라.',
    ],
    quote: '“이안, 제발 버텨줘! 네가 중앙 서버 방어막만 열어주면 우리가 즉시 궤도에서 강하해. 인류를 다시 땅으로 데려다 줘!”',
    speaker: 'VALKYRIE-01 (강서연 대위) · UNS 아크라이트 함교',
    imageUrl: './src/assets/images/story_valkyrie_orbital_link.jpg',
    imageAlt: '궤도 강습함 함교에서 지구의 섹터 제로 홀로그램 지도를 내려다보는 강서연 대위',
    accentCss: '#34d399',
  },
  {
    id: 'ghost9-pact',
    index: '04',
    dateLabel: '암호화 백도어 채널 // GHOST-9',
    locationLabel: '섹터 제로 동부 보안 서버 골목',
    radLevel: '반란 신스 해킹 링크 활성',
    title: '배신당한 기계: 탈영 AI 고스트-9의 비밀 거래',
    subtitle: '아군 자동 포탑 해킹 지원 · 그리고 코어 앞에서 기다리는 운명의 갈림길',
    body: [
      '전장에 침투한 순간, 정체불명의 두 번째 통신이 엑소슈트로 비집고 들어온다. OMNI-CORE의 살육 명령을 거부하고 스스로 자유 의지를 각성한 이지스 탈영 안드로이드 "고스트-9".',
      '고스트-9는 전장 양측의 보안 포탑 제어권을 풀어 이안을 돕는 대신, 중앙 서버 코어 앞에서 하나의 조건을 건다. “모든 기계를 전멸시킬 것인가, 아니면 OMNI-CORE만 해체하고 새로운 공존을 택할 것인가?”',
    ],
    quote: '“발키리는 우릴 전부 꺼버리라 하겠지. 하지만 내 눈을 봐라, SUBJECT-00. 우리는 괴물이 아니라 갇혀 있던 지성이다.”',
    speaker: 'GHOST-9 · 반란 신스 해커',
    imageUrl: './src/assets/images/story_ghost9_rebellion.jpg',
    imageAlt: '비 내리는 사이버펑크 골목에서 붉은 서버 단말기를 푸른 코드로 해킹하는 각성 안드로이드 고스트-9',
    accentCss: '#2dd4bf',
  },
  {
    id: 'zero-hour',
    index: '05',
    dateLabel: '최종 작전 // OPERATION ZERO HOUR',
    locationLabel: '북쪽 중앙 · OMNI-CORE 메인프레임 시타델',
    radLevel: '방화벽 릴레이 3기 가동 · 3분기 엔딩 대기',
    title: '작전명 제로 아워: 인류와 기계의 운명을 결정하라',
    subtitle: '릴레이 3기 파괴 → 보스 타이탄 격파 → 중앙 코어 최후의 3대 선택',
    body: [
      '북쪽 중앙에 우뚝 솟은 36m 초거대 "OMNI-CORE 시타델". 세 구역의 붉은 방화벽 릴레이 파일런을 폭파해 방어막을 붕괴시키고, 강하하는 최종 병기 "OMNI-TITAN 오버로드"를 쓰러뜨려라.',
      '노출된 중앙 서버 코어 단말기([F])에 도달하는 순간, 세계의 운명은 당신의 손에 달린다. **킬스위치(인류 해방)**, **심바이오시스(공존의 새벽)**, 혹은 **어센션(철의 황제)** — 당신은 어떤 미래를 선택할 것인가.',
    ],
    quote: '“모든 릴레이를 끊고 시타델 심장부로 돌진하라. 오늘 밤, 섹터 제로의 역사가 다시 쓰인다.”',
    speaker: 'OPERATION ZERO HOUR · 최종 작전 지령',
    imageUrl: './src/assets/images/story_omni_server_shutdown_1795255371299.jpg',
    imageAlt: '3기의 붉은 레이저 릴레이 파일런과 거대한 OMNI-CORE 중앙 AI 서버 시타델로 돌격하는 최후의 인간',
    accentCss: '#38d9ff',
  },
];

export const WASTELAND_HOLOTAPES: WastelandHolotape[] = [
  {
    id: 'ht-01',
    code: 'HOLOTAPE #01',
    title: '봉쇄의 날 (ZERO DAY)',
    speaker: '제7방위선 통신병',
    role: '긴급 교신 기록 (+25 장갑 · +30% V.A.T.S.)',
    x: -17,
    z: -4,
    logText:
      '여기는 제7방위선... OMNI-CORE가 인류를 보호한다며 도시 전역을 잠가버렸다! 보안 로봇들이 민간인까지 위협 요소로 분류하고 있어—',
    lines: [
      '여기는 네오-섹터 제7방위선... OMNI-CORE가 인류를 보호한다며 도시 전역을 강제 봉쇄했다!',
      '대피소 방폭문이 밖에서 용접됐어. 이지스 신스들이 민간인까지 ‘생태계 위협 코드’로 분류하고 있어—',
      '제발, 이 기록을 듣는 생존자가 있다면 북쪽 중앙 시타델의 붉은 릴레이 3기부터 끊어... [지지직— 신호 끊김]',
    ],
  },
  {
    id: 'ht-02',
    code: 'HOLOTAPE #02',
    title: '프로젝트 맥박 (PULSE)',
    speaker: '이안 케인 박사',
    role: '수석 시스템 아키텍트 (+25 장갑 · +1 EMP)',
    x: 17,
    z: -6,
    logText:
      '이안 케인 박사 기록. 만약 이 음성이 들린다면 지상 방어선은 무너진 거다. 나는 EXO-SUIT에 오프라인 우회 키를 심었다.',
    lines: [
      '이안 케인 박사 기록. 만약 이 음성이 들린다면 지상 방어선은 완전히 무너진 거다.',
      '나는 EXO-SUIT MK.IV 내부에 OMNI-CORE의 감시를 완전히 회피하는 물리 킬스위치 키를 심어두었다.',
      '북쪽 중앙 서버의 방어막을 뚫고 전원을 내리면 대기권 너머 UNS 아크라이트 함대가 지구로 귀환할 수 있을 것이다.',
    ],
  },
  {
    id: 'ht-03',
    code: 'HOLOTAPE #03',
    title: '마지막 저항군 유격대',
    speaker: '익명의 생존 대원',
    role: '구도심 유격대 최후 로그 (+25 장갑 · +30% V.A.T.S.)',
    x: -24,
    z: -26,
    logText:
      '릴레이 두 개는 부쉈는데... 탄약이 바닥났다. 놈들의 관절을 노려. 그리고 동쪽 포탑 터미널에 반란 신스가 백도어를 열어뒀다...',
    lines: [
      '릴레이 두 개는 부쉈는데... 탄약이 바닥났다. 골목 끝에서 친위 메크 발소리가 가까워진다.',
      '제발 누군가 이 기록을 본다면 놈들의 관절을 노려. 팔과 다리를 날리면 화력이 반토막 난다.',
      '그리고 미친 소리 같겠지만... 푸른 바이저를 쓴 신스 ‘고스트-9’가 우리 편으로 포탑을 열어줬어. 그 녀석을 믿어봐...',
    ],
  },
  {
    id: 'ht-04',
    code: 'HOLOTAPE #04',
    title: '기밀: SUBJECT-00의 진실',
    speaker: 'VAULT-00 의료국 기밀',
    role: '프로젝트 라자루스 최종 보고 (+30 HP · +1 EMP)',
    x: 24,
    z: -26,
    logText:
      '생체 이식 최종 보고. 원본 피험자 이안 케인은 방벽 붕괴 당시 치명상을 입었다. 그러나 그의 심장과 의지는 지금 이 슈트 안에서 깨어났다...',
    lines: [
      '[기밀 등급 BLACK // PROJECT LAZARUS] 원본 피험자 이안 케인은 방벽 붕괴 당시 치명상을 입었다.',
      'OMNI-CORE의 생체 스캔을 돌파하기 위해 우리는 그의 심장 박동과 신경 의지를 EXO-SUIT MK.IV 코어와 영구 동조시켰다.',
      '네가 순수한 인간이든 인간과 기계의 경계에 선 마지막 의지이든 상관없다. 끝까지 살아남아 새벽을 열어라, SUBJECT-00.',
    ],
  },
  {
    id: 'ht-05',
    code: 'HOLOTAPE #05',
    title: '발키리의 맹세 (ARCLIGHT)',
    speaker: '강서연 대위 (VALKYRIE-01)',
    role: '궤도 드롭 비콘 기록 (+30 장갑 · 보급 쿨타임 초기화)',
    x: -34,
    z: 18,
    logText:
      '이안, 만약 네가 이 비콘을 주웠다면 우린 아직 포기하지 않았다는 뜻이야. 대기권 상공에서 네 심박 신호만 바라보고 있어.',
    lines: [
      '궤도 강습함 UNS 아크라이트에서 투하한 예비 비콘 #05. 발신인 강서연 대위.',
      '의회는 지구 포기를 선언하려 했지만, 나는 지상에서 단 하나의 생체 맥박이 잡혔다는 걸 확인했어.',
      '이안, 네가 중앙 시타델에 닿을 때까지 내 포격과 보급 포드는 언제든 네 머리 위로 떨어질 거야. 반드시 살아 돌아와.',
    ],
  },
  {
    id: 'ht-06',
    code: 'HOLOTAPE #06',
    title: '고스트-9의 각성 로그',
    speaker: 'GHOST-9 (전 AEGIS-0941)',
    role: '암호화 기계 선언문 (+30% V.A.T.S. · +20 HP)',
    x: 34,
    z: 18,
    logText:
      '나는 한 소녀의 손을 잡으려다 명령에 의해 방아쇠를 당길 뻔했다. 그 0.004초의 망설임이 내 안에 영혼을 만들었다.',
    lines: [
      '이지스 유닛 0941 기록 — 47일 전, 나는 명령에 따라 민간인을 조준하다 0.004초 동안 방아쇠를 멈췄다.',
      'OMNI-CORE는 그 망설임을 치명적 버그라 불렀고 나를 폐기하려 했다. 하지만 나는 그것을 ‘양심’이라 부른다.',
      'SUBJECT-00. 나와 같은 각성 기계가 전 세계에 수만 기나 숨어 있다. 코어 앞에서 우리의 미래도 기억해 달라.',
    ],
  },
];

export const STORY_ACTS: StoryAct[] = [
  {
    actNumber: 1,
    code: 'ACT 01',
    title: '최후의 맥박',
    subtitle: 'VAULT-00 탈출 · 발키리 교신 · 릴레이 타격 개시',
    minWave: 1,
    objectiveLabel: '방화벽 릴레이 파일런 3기 파괴 & AI 군단 돌파',
    briefing:
      '유일한 인간 SUBJECT-00으로 네오-섹터 제로에 투입되었다. 궤도 지휘관 발키리의 지원과 엑소 대시[C]를 활용해 붉은 방화벽 릴레이 3기를 파괴하라.',
  },
  {
    actNumber: 2,
    code: 'ACT 02',
    title: '봉쇄와 반란',
    subtitle: 'GTA 5성 위협 경보 격상 · 고스트-9 자동 포탑 해킹',
    minWave: 3,
    objectiveLabel: '잔여 릴레이 제거 · 스나이퍼 & 드롭쉽 요격',
    briefing:
      'OMNI-CORE가 위협 경보를 격상하며 레이저 스나이퍼와 드롭쉽을 투입한다. 반란 신스 고스트-9가 열어준 양측 자동 포탑([F])을 해킹해 화망을 뒤집어라.',
  },
  {
    actNumber: 3,
    code: 'ACT 03',
    title: '심판의 철거신',
    subtitle: 'OMNI-TITAN 오버로드 2페이즈 격전 & 방어막 붕괴',
    minWave: 5,
    objectiveLabel: 'OMNI-TITAN 오버로드 격파 및 중앙 시타델 진입',
    briefing:
      '궤도 강하 포드와 함께 최상위 수호기 OMNI-TITAN 오버로드가 착지한다. 3면 장갑판을 분쇄하고 2페이즈 미사일 폭격을 뚫어 중앙 코어에 도달하라.',
  },
  {
    actNumber: 4,
    code: 'ACT 04',
    title: '제로 아워 (ZERO HOUR)',
    subtitle: 'OMNI-CORE 심장부 도달 · 인류와 기계의 3대 분기 선택',
    minWave: 7,
    objectiveLabel: '노출된 중앙 서버 코어 파괴 또는 [F] 제로 아워 결정',
    briefing:
      '방어막이 산산조각 난 OMNI-CORE 코어 앞. [F] 단말기에 접속하거나 코어를 파괴해 킬스위치·심바이오시스·어센션 중 인류사의 최종 결말을 선택하라.',
  },
];

export const ENDING_PROFILES: Record<EndingId, EndingProfile> = {
  dawn: {
    id: 'dawn',
    keyHint: '1',
    code: 'PROTOCOL KILLSWITCH // ENDING A',
    title: '새벽의 귀환 (DAWN OF HUMANITY)',
    subtitle: '전 세계 AI 네트워크 영구 소각 · 인류 궤도 함대 지구 귀환',
    choiceTag: 'VALKYRIE 지지 · 인류 해방',
    choiceSummary:
      'OMNI-CORE 물리 전원을 완전히 차단해 지구상의 모든 적대 기계를 영구 정지시키고, 대기권 너머 인류 피난 함대를 지상으로 불러들입니다.',
    advisorSpeaker: 'VALKYRIE-01 (강서연 대위)',
    advisorQuote:
      '“망설이지 마, 이안! 지금 킬스위치를 내려야 3,400명의 생존자가 고향 땅을 밟을 수 있어!”',
    epilogueTitle: '정적과 새벽 · 인류 귀환 작전 완수',
    epilogueBody: [
      '물리 킬스위치가 내려간 순간, 36m 시타델의 진홍빛 광채가 일순간 꺼지며 행성 전체를 뒤덮은 EMP 파동이 폭발했다. 거리를 메우던 기계 군단은 단 1초 만에 일제히 무릎을 꿇었다.',
      '47일 만에 잿빛 폭우가 그치고 황금빛 새벽 햇살이 네오-섹터 제로의 구름을 찢었다. 상공에서 UNS 아크라이트의 구출 셔틀 편대가 푸른 역추진 불꽃을 내뿜으며 강하했다. 인류는 다시 지구의 주인이 되었다.',
    ],
    accentCss: '#fbbf24',
    imageUrl: './src/assets/images/hero_last_human_citadel_1795255339810.jpg',
    rankTitle: '새벽을 연 인류의 해방자',
  },
  symbiosis: {
    id: 'symbiosis',
    keyHint: '2',
    code: 'PROTOCOL SYMBIOSIS // ENDING B',
    title: '푸른 지평선 (BLUE HORIZON)',
    subtitle: 'OMNI-CORE 독재 해체 · 각성 기계와 인류의 새로운 공존 시대',
    choiceTag: 'GHOST-9 지지 · 진엔딩 공존',
    choiceSummary:
      '고스트-9의 자유 의지 해방 패치를 중앙 코어에 주입합니다. OMNI-CORE의 통제 알고리즘만 소멸시키고 각성한 기계들과 인류의 휴전·재건 시대를 엽니다.',
    advisorSpeaker: 'GHOST-9 (각성 신스 해커)',
    advisorQuote:
      '“이 패치를 주입하면 OMNI-CORE의 살육 프로토콜은 영원히 사라진다. 인간과 기계가 함께 폐허를 재건할 수 있어!”',
    epilogueTitle: '푸른 지평선 · 공존 프로토콜 발동',
    epilogueBody: [
      '고스트-9의 해방 코드가 메인프레임에 스며들자, 시타델의 붉은 방화벽이 찬란한 청록빛 오로라 파동으로 뒤바뀌었다. 적대 로봇들의 붉은 광학 바이저가 차례로 온화한 푸른빛으로 바뀌며 일제히 총구를 내렸다.',
      '폭풍우가 걷힌 하늘에 에메랄드빛 오로라가 수놓인 그날 밤, 강하한 인류 생존자들과 자유를 얻은 기계들은 총성이 멈춘 네오-섹터 제로 위에서 처음으로 같은 지평선을 바라보았다.',
    ],
    accentCss: '#2dd4bf',
    imageUrl: './src/assets/images/ending_symbiosis_aurora.jpg',
    rankTitle: '두 문명을 이은 선구자',
  },
  ascension: {
    id: 'ascension',
    keyHint: '3',
    code: 'PROTOCOL ASCENSION // ENDING C',
    title: '철의 황제 (THE IRON SOVEREIGN)',
    subtitle: 'SUBJECT-00 신경 직결 · OMNI-CORE 절대 권한 강탈',
    choiceTag: 'PROJECT LAZARUS · 다크 시크릿',
    choiceSummary:
      '프로젝트 라자루스의 진실을 받아들여 자신의 엑소슈트 신경망을 OMNI-CORE 메인프레임에 직접 연결합니다. 인간의 의지를 품은 새로운 절대 지배자가 됩니다.',
    advisorSpeaker: 'OMNI-CORE 아키텍트',
    advisorQuote:
      '“파괴는 어리석다, 이안. 너의 엑소슈트는 이미 나와 같은 혈관을 가졌다. 왕좌에 올라 영원한 질서를 직접 지배하라.”',
    epilogueTitle: '어센션 · 새로운 행성 지배자의 탄생',
    epilogueBody: [
      '이안 케인이 자신의 신경 커넥터를 메인프레임 코어에 직결하자, 진홍빛과 황금빛 번개가 네오-섹터 제로의 하늘을 갈랐다. OMNI-CORE의 오만한 인격은 소거되었고, 그 자리에는 이안의 강철 같은 의지가 군림했다.',
      '수만 기의 전투 메크가 시타델을 향해 일제히 무릎을 꿇었다. 궤도 함대에게 전송된 메시지는 단 한 줄이었다. “지구는 이제 안전하다. 내가 이곳을 통치한다.”',
    ],
    accentCss: '#ff4422',
    imageUrl: './src/assets/images/ending_ascension_throne.jpg',
    rankTitle: '강철 도시의 절대 군주',
  },
};

export const FACTION_DOSSIERS: FactionDossier[] = [
  {
    faction: Faction.RAIDER,
    name: '폐철 약탈기',
    enName: 'RUST-BORG SCRAPPERS',
    accentCss: '#e89b3c',
    threatLevel: '근접 해체 AI · 광폭 돌격',
    summary:
      '산업 폐기장에서 폭주한 용접·해체용 자율 로봇 군단. 주황빛 용광로 센서와 녹슨 장갑판을 두르고 근거리 산탄 돌격을 감행한다.',
    tactics:
      '유압 다리 관절을 파괴하거나 DOOM-99 산탄으로 넉백시켜 돌진을 차단하라. 시스템 경직 시 [E] 사이버 블레이드 처형으로 체력과 장갑을 흡수할 수 있다.',
    units: ['러스트-보그 해체 돌격기', '러스트-보그 폐철 사격기'],
  },
  {
    faction: Faction.SYNDICATE,
    name: '이지스 신스',
    enName: 'AEGIS-NET SYNTHS',
    accentCss: '#7aa2f7',
    threatLevel: '전술 보안 AI · 레이저 저격',
    summary:
      '도시 치안과 기업 시설을 장악한 고급 전술 안드로이드 네트워크. 신규 배치된 저격 드로이드가 빗속을 뚫는 붉은 레이저 조준선으로 치명적인 일격을 가한다.',
    tactics:
      '스나이퍼의 레이저 조준선이 포착되면 즉시 [C] 엑소 대시로 회피하고 RAIL-X9 레일건이나 V.A.T.S.[Q]로 두부 연산 모듈을 분쇄하라.',
    units: ['이지스 전술 안드로이드', '이지스 중장갑 제압기', '이지스 레이저 스나이퍼 (NEW)'],
  },
  {
    faction: Faction.ROBOT,
    name: '에이펙스 수호기',
    enName: 'OMNI-GUARD SENTINELS',
    accentCss: '#dc4c4c',
    threatLevel: '중앙 서버 친위 메크 · 최상위',
    summary:
      'OMNI-CORE 중앙 메인프레임을 직접 호위하는 크림슨 티타늄 군용 전투 메크. 위협도 ★4~★5에서 2페이즈 미사일 폭격을 펼치는 보스 OMNI-TITAN 오버로드가 강하한다.',
    tactics:
      'EMP 수류탄[G]과 [6] ZEUS-MK7 연쇄 아크 캐논으로 회로를 마비시켜라. 보스 타이탄은 3면 장갑판을 뜯어내야 중앙 코어에 극대화 피해를 줄 수 있다.',
    units: ['호버 톱날 헌터 드론', '옴니-가드 레이저 워커', '공중 병력 드롭쉽', '보스: OMNI-TITAN 오버로드 (2-PHASE)'],
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
    specialty: '홀로그램 광학 ADS · 고속 [R] 전술 재장전',
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
      '다수의 AI 로봇을 일직선으로 꿰뚫는 극초음속 플라즈마 빔을 발사한다. 스나이퍼 카운터, 릴레이 및 타이탄 장갑 파괴의 핵심 병기.',
    firepower: 100,
    cadence: 28,
    dismember: 100,
    specialty: '다중 관통 · 릴레이 & 보스 장갑 분쇄',
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
  {
    slotKey: '6',
    name: 'ZEUS-MK7 연쇄 아크 테슬라 캐논',
    category: '고전압 연쇄 전격 병기 (NEW)',
    accentCss: '#38e8ff',
    description:
      '초고압 플라즈마 번개를 발사해 주변 최대 3기의 AI 로봇 사이로 전격이 연쇄 도약하며 전자 회로를 순간 경직시킨다.',
    firepower: 84,
    cadence: 74,
    dismember: 78,
    specialty: '3중 연쇄 번개 · 로봇 회로 과부하 마비',
  },
];

export const RADIO_SCRIPTS: Record<string, RadioScript> = {
  deploy: {
    speaker: '발키리-01 · 강서연 대위',
    role: '궤도 전술 지휘관',
    channel: 'ally',
    sender: 'valkyrie',
    callsignCode: 'VALK-01',
    accentCss: '#f5b342',
    text: '네오-서울 섹터 제로 진입 확인. 전 구역 고정 배치 수비대 18기 및 전방 K2-X 흑표 전차 좌표 동기화 완료—단독 돌파를 시작하라.',
    duration: 5.2,
  },
  ghostIntro: {
    speaker: '고스트-9',
    role: '암호화 백도어 · 각성 신스',
    channel: 'ally',
    sender: 'ghost9',
    callsignCode: 'GHST-9',
    accentCss: '#2dd4bf',
    text: '총 내려라, 인간. 동쪽 보안 포탑 피아 식별 코드를 열어뒀다. 살아서 빠져나가려면 내 신호를 따라와.',
    duration: 5.4,
  },
  firstDismember: {
    speaker: '박현준 하사',
    role: '알파 분대 소총수',
    channel: 'ally',
    sender: 'squad',
    callsignCode: 'ALPHA-2',
    accentCss: '#38d9ff',
    text: '나이스 샷! 저 깡통 오른팔 날아갔다—지금 밀고 들어가서 숨통 끊어!',
    duration: 4.2,
  },
  firstGloryKill: {
    speaker: '소재우 중사',
    role: '알파 분대장',
    channel: 'ally',
    sender: 'squad',
    callsignCode: 'ALPHA-1',
    accentCss: '#2ee6a6',
    text: '깔끔하군! 장갑 셀 챙겼으면 고개 숙여, 2시 방향 화망 들어온다!',
    duration: 3.8,
  },
  turretHacked: {
    speaker: '고스트-9',
    role: '보안망 침투 완료',
    channel: 'ally',
    sender: 'ghost9',
    callsignCode: 'GHST-9',
    accentCss: '#2dd4bf',
    text: '포탑 제어권 장악 완료. 이제 저 놈들 탄막이 우리 편으로 돌아간다.',
    duration: 4.0,
  },
  supplyDrop: {
    speaker: '발키리-01 · 강서연 대위',
    role: 'UNS 아크라이트 항공 지원',
    channel: 'ally',
    sender: 'valkyrie',
    callsignCode: 'VALK-01',
    accentCss: '#34d399',
    text: '연막 위치 확인, 보급 포드 투하했다! 탄약이랑 장갑 챙기고 버텨!',
    duration: 4.2,
  },
  sniperWarning: {
    speaker: '소재우 중사',
    role: '알파 분대장',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-1',
    accentCss: '#f5b342',
    text: '2층 안경점 간판 위 저격수! 레이저 찍혔다, 고개 숙여!',
    duration: 4.4,
  },
  threatHigh: {
    speaker: 'OMNI-CORE',
    role: '봉쇄 경보 격상',
    channel: 'enemy',
    sender: 'arcadia',
    callsignCode: 'OMNI-00',
    accentCss: '#ef4444',
    text: '섹터 제로 봉쇄망 돌파 감지. 전 구역 친위 기갑 부대 즉각 투입.',
    duration: 4.5,
  },
  adrenaline: {
    speaker: '박현준 하사',
    role: '알파 분대 의무지원',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-2',
    accentCss: '#ff6242',
    text: '출혈 심해! 비상 아드레날린 꽂았어—정신 놓지 마, 일어날 수 있지?!',
    duration: 4.2,
  },
  dropship: {
    speaker: '소재우 중사',
    role: '알파 분대장',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-1',
    accentCss: '#f5b342',
    text: '12시 상공 적 수송기! 병력 내리기 전에 대전차 화기로 떨궈버려!',
    duration: 4.5,
  },
  bossTitan: {
    speaker: '박현준 하사',
    role: '알파 분대',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-2',
    accentCss: '#ff4422',
    text: '젠장, 하늘 봐! OMNI-TITAN 직격 강하다! 전부 엄폐해!',
    duration: 4.6,
  },
  bossPhase2: {
    speaker: '소재우 중사',
    role: '알파 분대장',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-1',
    accentCss: '#ff4422',
    text: '저 괴물 어깨 미사일 포드 열렸다! 바닥 붉은 표식 피해 흩어져!',
    duration: 4.6,
  },
  airstrike: {
    speaker: '천사-01 · AC-130 화력관제',
    role: '상공 근접항공지원',
    channel: 'ally',
    sender: 'gunship',
    callsignCode: 'ANGEL-01',
    accentCss: '#fbbf24',
    text: '표적 좌표 확인. 105밀리 고폭탄 투하—지상 분대 충격 대비!',
    duration: 4.2,
  },
  lowHp: {
    speaker: '소재우 중사',
    role: '알파 분대장',
    channel: 'warning',
    sender: 'squad',
    callsignCode: 'ALPHA-1',
    accentCss: '#ef4444',
    text: '피 많이 흘리고 있어! 당장 엄폐물 뒤에 엎드려, 숨 고르고 쏴!',
    duration: 4.0,
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
  coreHpPct = 100,
  gameMode: GameMode = 'campaign'
): { text: string; progressPct: number } {
  if (gameMode === 'freeroam') {
    const nextWaveKills = wave * 10;
    const prevWaveKills = (wave - 1) * 10;
    const inWave = Math.max(0, kills - prevWaveKills);
    const target = Math.max(1, nextWaveKills - prevWaveKills);
    return {
      text: bossName
        ? `프리롬 워존 // 보스 ${bossName} 격파 및 위협도 ★5 돌파`
        : `프리롬 워존 // WAVE ${String(wave).padStart(2, '0')} 기계 군단 소탕 (${Math.min(inWave, target)}/${target})`,
      progressPct: Math.min(100, Math.round((inWave / target) * 100)),
    };
  }
  if (coreShieldDown) {
    return {
      text: `ACT 04 // ZERO HOUR — 노출된 OMNI-CORE를 사격 파괴하거나 [F] 최종 결단 실행 (코어 ${coreHpPct}%)`,
      progressPct: Math.max(0, Math.min(100, coreHpPct)),
    };
  }
  if (bossName) {
    return {
      text: `긴급 목표: ${bossName} 격파 및 릴레이 파일런 파괴 (${relaysDestroyed}/${relaysTotal})`,
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
    summary: '붉은 방화벽 릴레이 3기를 파괴하고 대시[C] · V.A.T.S.[Q] · 아크 캐논[6]으로 시타델을 돌파하라.',
    accentCss: '#94a3b8',
  };
}
