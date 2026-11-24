import { CombatAnalyticsData } from './types';

export interface DerivedBattleMetrics {
  kdRatio: number;
  dismemberEfficiencyPct: number;
  accuracyPct: number;
  headshotRatePct: number;
  totalFactionKills: number;
  factionShares: Array<{
    key: 'raider' | 'syndicate' | 'robot';
    label: string;
    kills: number;
    pct: number;
    color: string;
  }>;
  partBars: Array<{
    key: string;
    label: string;
    count: number;
    color: string;
  }>;
}

export function createEmptyAnalytics(holotapesTotal = 4): CombatAnalyticsData {
  return {
    deaths: 0,
    shotsFired: 0,
    shotsHit: 0,
    killsByFaction: {
      raider: 0,
      syndicate: 0,
      robot: 0,
    },
    partBreakdown: {
      head: 0,
      arm: 0,
      leg: 0,
      armor: 0,
      gloryKill: 0,
    },
    timeline: [{ timeSec: 0, label: '00:00', kills: 0, dismembers: 0 }],
    holotapesFound: 0,
    holotapesTotal,
  };
}

export function computeBattleAnalytics(
  kills: number,
  dismembers: number,
  data: CombatAnalyticsData
): DerivedBattleMetrics {
  const denomDeaths = Math.max(1, data.deaths);
  const kdRatio = Number((kills / denomDeaths).toFixed(2));
  const dismemberEfficiencyPct =
    kills > 0 ? Math.min(100, Math.round((dismembers / kills) * 100)) : 0;
  const accuracyPct =
    data.shotsFired > 0
      ? Math.min(100, Math.round((data.shotsHit / data.shotsFired) * 100))
      : 0;
  const headshotRatePct =
    kills > 0 ? Math.min(100, Math.round((data.partBreakdown.head / kills) * 100)) : 0;

  const r = data.killsByFaction.raider;
  const s = data.killsByFaction.syndicate;
  const m = data.killsByFaction.robot;
  const totalFactionKills = r + s + m;
  const safeTotal = Math.max(1, totalFactionKills);

  const factionShares: DerivedBattleMetrics['factionShares'] = [
    {
      key: 'raider',
      label: '폐철 약탈기',
      kills: r,
      pct: totalFactionKills > 0 ? Math.round((r / safeTotal) * 100) : 0,
      color: '#e89b3c',
    },
    {
      key: 'syndicate',
      label: '이지스 신스',
      kills: s,
      pct: totalFactionKills > 0 ? Math.round((s / safeTotal) * 100) : 0,
      color: '#7aa2f7',
    },
    {
      key: 'robot',
      label: '에이펙스 수호기',
      kills: m,
      pct: totalFactionKills > 0 ? Math.round((m / safeTotal) * 100) : 0,
      color: '#dc4c4c',
    },
  ];

  const partBars: DerivedBattleMetrics['partBars'] = [
    { key: 'head', label: '두부 파괴 (2.5x)', count: data.partBreakdown.head, color: '#dc4c4c' },
    { key: 'arm', label: '무장 팔 절단', count: data.partBreakdown.arm, color: '#e89b3c' },
    { key: 'leg', label: '다리 붕괴', count: data.partBreakdown.leg, color: '#34d399' },
    { key: 'armor', label: '타이탄 장갑 파쇄', count: data.partBreakdown.armor, color: '#56c2ff' },
    { key: 'gloryKill', label: '글로리 킬 처형', count: data.partBreakdown.gloryKill, color: '#f6b75e' },
  ];

  return {
    kdRatio,
    dismemberEfficiencyPct,
    accuracyPct,
    headshotRatePct,
    totalFactionKills,
    factionShares,
    partBars,
  };
}
