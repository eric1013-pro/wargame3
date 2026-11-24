# IRON ASH III: ZERO HOUR

> **2099 네오-서울을 배경으로 펼쳐지는 Three.js + React + TypeScript 3D 시네마틱 밀리터리 워존 FPS**

🌐 **Live Play (GitHub Pages)**: https://eric1013-pro.github.io/wargame3/

---

## 주요 특징 (V7.5 AAA Pipeline)

### 1. 4부작 시네마틱 리니어 캠페인 & 멀티 엔딩
- **MISSION 01 — 한강변 강습 상륙**: 대한민국해군 LCAC-655 공기부양정 상륙 · K-808 장갑차 피격 · 연막 속 교두보 확보
- **MISSION 02 — 을지로 시가전 & 브리칭**: 폐허가 된 서울 도심 골목 돌파 · 0.2x 슬로모션 C4 방폭문 브리칭 · 생존자 구출 & 고스트-9 대면
- **MISSION 03 — UH-60K 헬기 강습 & AC-130 FLIR**: 무장 헬기 측문 6연장 M134 회전 미니건 저공 소사 → 상공 AC-130 열화상(25mm / 40mm / 105mm · WHOT/BHOT) 폭격 지원
- **MISSION 04 — K2-X 흑표 전차 돌파 & 타워 결전**: 실제 탑승·조종 가능한 K2-X 흑표 주력전차(120mm L/55 주포 · 12.7mm 동축 기관총 · 360° 독립 포탑 · 열화상 조준경)로 OMNI-TITAN 격파 및 3가지 분기 엔딩(DAWN / SYMBIOSIS / ASCENSION)

### 2. 스튜디오 에셋 & 리얼리즘 엔진
- **13종 바이너리 glTF 2.0 (`.glb`) 하이폴리 모델**:
  - 1인칭 무기 5종 (`M41-X`, `DOOM-99`, `RAIL-X9`, `HYDRA-7`, `ZEUS-MK7`) + 전술 부착물 (건스미스)
  - 기갑·항공·전장 프롭 5종 (`K2-X 흑표 주력전차`, `UH-60K 무장 헬기`, `K-808 차륜형 장갑차`, `파손 국산 세단`, `모래주머니 진지`)
  - 2관절 아티큘레이션 적 캐릭터 3종 (`enemy_trooper.glb`, `enemy_mech.glb`, `enemy_drone.glb`) — 무릎·팔꿈치 2관절 보행/조준 애니메이션 및 부위별 정밀 피격·파괴 지원
- **실사 4채널 PBR 머티리얼 파이프라인**: Albedo + Normal + Roughness + AO 맵 20종 (`seoul_asphalt_wet`, `military_gunmetal`, `rok_tactical_camo`, `sandbag_burlap`, `euljiro_facade`)
- **32종 멀티 레이어 밀리터리 WAV 효과음**: 근·원거리 총성, 120mm 전차포·터빈, M134 회전 미니건, UH-60K 로터, AC-130 화포, VHF 군용 무전 비프음
- **전술 건플레이 & HUD**: 자동 엄폐 마운팅, Q/E 피킹, [H] 세라믹 방탄판 교체, [B] 전술 연막탄, [Q] V.A.T.S., [C] 엑소 대시, 투명 광학 스코프, 5성 위협 경보

---

## 조작법

| 입력 | 기능 |
| --- | --- |
| `W A S D` | 이동 / 전차 차체 주행 |
| `마우스` / `좌클릭` / `우클릭` | 시점·포탑 조준 / 사격(120mm 주포·M134) / 정밀 조준(열화상 FCS) |
| `1 ~ 6` | 무기 전환 (AC-130 구간: `1` 25mm · `2` 40mm · `3` 105mm) |
| `F` | K2-X 흑표 전차 탑승·하차 / C4 방폭문 브리칭 / 오브젝트 상호작용 |
| `SPACE` | 점프 / 전차 12.7mm 동축 기관총 사격 / 시네마틱 스킵 |
| `R` / `H` / `B` | 전술 재장전 / 세라믹 방탄판 교체(전차 수리) / 연막탄 투척 |
| `Q` / `E` / `C` / `G` | V.A.T.S. (좌우 피킹) / 엑소 대시 / EMP 수류탄 |
| `V` / `X` / `T` | 궤도 보급 / 궤도 폭격 / AC-130 WHOT·BHOT 열화상 전환 |
| `P` / `ESC` | 일시정지 & 설정 |

---

## 로컬 실행 및 빌드

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint       # TypeScript 타입 검증
npm run build      # dist/ 프로덕션 번들 빌드
```
