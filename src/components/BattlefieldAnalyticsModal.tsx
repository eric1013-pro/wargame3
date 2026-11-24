import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { computeBattleAnalytics } from '../game/analytics';
import { formatClock } from '../game/rules';
import { computeCombatRank } from '../game/story';
import { Faction, HudSnapshot } from '../game/types';
import { FactionCrest, GameButton, RankShieldCrest } from './GameUiKit';

interface BattlefieldAnalyticsModalProps {
  hud: HudSnapshot;
  isPostCombat: boolean;
  onClose: () => void;
  onRedeploy?: () => void;
}

export const BattlefieldAnalyticsModal: React.FC<BattlefieldAnalyticsModalProps> = ({
  hud,
  isPostCombat,
  onClose,
  onRedeploy,
}) => {
  const donutRef = useRef<SVGSVGElement | null>(null);
  const barRef = useRef<SVGSVGElement | null>(null);
  const timelineRef = useRef<SVGSVGElement | null>(null);

  const [hoveredFaction, setHoveredFaction] = useState<{
    label: string;
    kills: number;
    pct: number;
    color: string;
  } | null>(null);
  const [hoveredPart, setHoveredPart] = useState<{
    label: string;
    count: number;
    color: string;
  } | null>(null);

  const metrics = useMemo(
    () => computeBattleAnalytics(hud.kills, hud.dismembers, hud.analytics),
    [hud.kills, hud.dismembers, hud.analytics]
  );

  const rank = useMemo(
    () => computeCombatRank(hud.kills, hud.dismembers, hud.executions, hud.survivalTime),
    [hud.kills, hud.dismembers, hud.executions, hud.survivalTime]
  );

  const timelinePoints = useMemo(() => {
    const base =
      hud.analytics.timeline.length > 0
        ? [...hud.analytics.timeline]
        : [{ timeSec: 0, label: '00:00', kills: 0, dismembers: 0 }];
    const nowSec = Math.max(1, Math.round(hud.survivalTime));
    const last = base[base.length - 1];
    if (!last || last.timeSec < nowSec) {
      base.push({
        timeSec: nowSec,
        label: formatClock(nowSec),
        kills: hud.kills,
        dismembers: hud.dismembers,
      });
    }
    if (base.length === 1) {
      base.push({
        timeSec: Math.max(10, base[0].timeSec + 10),
        label: formatClock(Math.max(10, base[0].timeSec + 10)),
        kills: hud.kills,
        dismembers: hud.dismembers,
      });
    }
    return base;
  }, [hud.analytics.timeline, hud.survivalTime, hud.kills, hud.dismembers]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 1) D3 Faction Contribution Donut Chart
  useEffect(() => {
    const svgEl = donutRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 220;
    const height = 220;
    const radius = 84;
    const innerRadius = 54;

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Precision outer telemetry ticks
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const r1 = radius + 7;
      const r2 = radius + (i % 6 === 0 ? 13 : 10);
      g.append('line')
        .attr('x1', Math.cos(ang) * r1)
        .attr('y1', Math.sin(ang) * r1)
        .attr('x2', Math.cos(ang) * r2)
        .attr('y2', Math.sin(ang) * r2)
        .attr('stroke', i % 6 === 0 ? '#e89b3c' : 'rgba(255,255,255,0.14)')
        .attr('stroke-width', i % 6 === 0 ? 1.5 : 1);
    }

    const activeData =
      metrics.totalFactionKills > 0
        ? metrics.factionShares.filter((f) => f.kills > 0)
        : [
            {
              key: 'raider' as const,
              label: '교전 기록 대기',
              kills: 1,
              pct: 0,
              color: '#1d2533',
            },
          ];

    const pie = d3
      .pie<(typeof activeData)[number]>()
      .value((d) => d.kills)
      .sort(null)
      .padAngle(metrics.totalFactionKills > 0 ? 0.032 : 0);

    const arc = d3
      .arc<d3.PieArcDatum<(typeof activeData)[number]>>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcHover = d3
      .arc<d3.PieArcDatum<(typeof activeData)[number]>>()
      .innerRadius(innerRadius - 2)
      .outerRadius(radius + 5);

    g.selectAll('path')
      .data(pie(activeData))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#0e131b')
      .attr('stroke-width', 2)
      .style('cursor', metrics.totalFactionKills > 0 ? 'pointer' : 'default')
      .on('mouseenter', function (_event, d) {
        if (metrics.totalFactionKills <= 0) return;
        d3.select(this).transition().duration(150).attr('d', arcHover(d) ?? '');
        setHoveredFaction({
          label: d.data.label,
          kills: d.data.kills,
          pct: d.data.pct,
          color: d.data.color,
        });
      })
      .on('mouseleave', function (_event, d) {
        if (metrics.totalFactionKills <= 0) return;
        d3.select(this).transition().duration(150).attr('d', arc(d) ?? '');
        setHoveredFaction(null);
      });
  }, [metrics]);

  // 2) D3 Body-Part Dismemberment Horizontal Bar Chart
  useEffect(() => {
    const svgEl = barRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 166;
    const margin = { top: 8, right: 44, bottom: 10, left: 118 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const maxVal = Math.max(4, d3.max(metrics.partBars, (d) => d.count) ?? 4);

    const y = d3
      .scaleBand()
      .domain(metrics.partBars.map((d) => d.label))
      .range([0, innerH])
      .padding(0.36);

    const x = d3.scaleLinear().domain([0, maxVal]).range([0, innerW]);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const ticks = x.ticks(4);
    g.selectAll('.grid-line')
      .data(ticks)
      .join('line')
      .attr('x1', (d) => x(d))
      .attr('x2', (d) => x(d))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', 'rgba(255,255,255,0.06)')
      .attr('stroke-dasharray', '3 3');

    g.selectAll('.bar-track')
      .data(metrics.partBars)
      .join('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.label) ?? 0)
      .attr('width', innerW)
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('fill', 'rgba(255,255,255,0.045)');

    g.selectAll('.bar-fill')
      .data(metrics.partBars)
      .join('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.label) ?? 0)
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('width', (d) => (d.count > 0 ? Math.max(6, x(d.count)) : 0))
      .attr('fill', (d) => d.color)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('opacity', 0.85);
        setHoveredPart({ label: d.label, count: d.count, color: d.color });
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
        setHoveredPart(null);
      });

    g.selectAll('.bar-label')
      .data(metrics.partBars)
      .join('text')
      .attr('x', -12)
      .attr('y', (d) => (y(d.label) ?? 0) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#cbd3df')
      .attr('font-size', '11px')
      .attr('font-family', "'Noto Sans KR', sans-serif")
      .text((d) => d.label);

    g.selectAll('.bar-val')
      .data(metrics.partBars)
      .join('text')
      .attr('x', (d) => Math.max(8, x(d.count) + 8))
      .attr('y', (d) => (y(d.label) ?? 0) + y.bandwidth() / 2 + 4)
      .attr('fill', (d) => (d.count > 0 ? '#f3f5f8' : '#647084'))
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text((d) => `${d.count}회`);
  }, [metrics]);

  // 3) D3 Combat Momentum Area + Line Timeline Chart
  useEffect(() => {
    const svgEl = timelineRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 760;
    const height = 110;
    const margin = { top: 10, right: 20, bottom: 22, left: 34 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const maxTime = Math.max(10, d3.max(timelinePoints, (d) => d.timeSec) ?? 10);
    const maxY = Math.max(
      4,
      d3.max(timelinePoints, (d) => Math.max(d.kills, d.dismembers)) ?? 4
    );

    const x = d3.scaleLinear().domain([0, maxTime]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

    const defs = svg.append('defs');
    const killGrad = defs
      .append('linearGradient')
      .attr('id', 'killAreaGrad')
      .attr('x1', '0')
      .attr('y1', '0')
      .attr('x2', '0')
      .attr('y2', '1');
    killGrad.append('stop').attr('offset', '0%').attr('stop-color', '#dc4c4c').attr('stop-opacity', 0.32);
    killGrad.append('stop').attr('offset', '100%').attr('stop-color', '#dc4c4c').attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const yTicks = y.ticks(4);
    g.selectAll('.h-grid')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(255,255,255,0.06)');

    g.selectAll('.y-label')
      .data(yTicks)
      .join('text')
      .attr('x', -8)
      .attr('y', (d) => y(d) + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#748094')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text((d) => String(d));

    const xTicks = x.ticks(5);
    g.selectAll('.x-label')
      .data(xTicks)
      .join('text')
      .attr('x', (d) => x(d))
      .attr('y', innerH + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#748094')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text((d) => formatClock(d));

    const killArea = d3
      .area<(typeof timelinePoints)[number]>()
      .x((d) => x(d.timeSec))
      .y0(innerH)
      .y1((d) => y(d.kills))
      .curve(d3.curveMonotoneX);

    const killLine = d3
      .line<(typeof timelinePoints)[number]>()
      .x((d) => x(d.timeSec))
      .y((d) => y(d.kills))
      .curve(d3.curveMonotoneX);

    const dismemberLine = d3
      .line<(typeof timelinePoints)[number]>()
      .x((d) => x(d.timeSec))
      .y((d) => y(d.dismembers))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(timelinePoints).attr('fill', 'url(#killAreaGrad)').attr('d', killArea);

    g.append('path')
      .datum(timelinePoints)
      .attr('fill', 'none')
      .attr('stroke', '#dc4c4c')
      .attr('stroke-width', 2.2)
      .attr('d', killLine);

    g.append('path')
      .datum(timelinePoints)
      .attr('fill', 'none')
      .attr('stroke', '#e89b3c')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '5 3')
      .attr('d', dismemberLine);

    g.selectAll('.kill-dot')
      .data(timelinePoints)
      .join('circle')
      .attr('cx', (d) => x(d.timeSec))
      .attr('cy', (d) => y(d.kills))
      .attr('r', 3)
      .attr('fill', '#f3f5f8')
      .attr('stroke', '#dc4c4c')
      .attr('stroke-width', 1.5);
  }, [timelinePoints]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-ambient-backdrop pointer-events-auto p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-modal-title"
      data-testid="battlefield-analytics-modal"
    >
      <div className="w-full max-w-4xl game-plaque surface-grain p-4 sm:p-5 animate-panel-in my-auto">
        {/* Header with Sculpted Rank Shield Crest */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <RankShieldCrest grade={rank.grade} size={52} />
            <div>
              <div className="text-[10px] font-tactical font-bold tracking-[0.22em] text-[#56c2ff]">
                VAULT-00 // OMNI-CORE COMBAT TELEMETRY
              </div>
              <h2
                id="analytics-modal-title"
                className="text-xl sm:text-2xl font-black tracking-tight text-[#f3f5f8] mt-0.5"
              >
                전장 분석 차트 · 섹터 제로 교전 보고서
              </h2>
              <p className="text-[11px] font-tactical text-[#8c98ab] mt-0.5 tabular-nums">
                ACT 0{hud.actNumber} ({hud.actTitle}) · WAVE {String(hud.wave).padStart(2, '0')} · 생존{' '}
                {formatClock(hud.survivalTime)}
              </p>
            </div>
          </div>

          <GameButton variant="ghost" size="sm" onClick={onClose}>
            닫기 [ESC]
          </GameButton>
        </div>

        {/* 5-KPI Unified Telemetry Ribbon (hairline divided, zero nested boxes) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] py-3.5 border-b border-white/[0.08] tabular-nums">
          <div className="pr-3 py-1 sm:py-0">
            <div className="text-[10px] font-tactical tracking-[0.14em] text-[#8490a3]">K/D 비율</div>
            <div className="font-display text-2xl font-bold text-[#dc4c4c] mt-1 leading-none">
              {metrics.kdRatio.toFixed(2)}
            </div>
            <div className="text-[10px] font-tactical text-[#6e7b8f] mt-1.5">
              {hud.kills} 처치 / {Math.max(0, hud.analytics.deaths)} 전사
            </div>
          </div>

          <div className="sm:px-4 py-1 sm:py-0">
            <div className="text-[10px] font-tactical tracking-[0.14em] text-[#8490a3]">부위 파괴 효율</div>
            <div className="font-display text-2xl font-bold text-[#e89b3c] mt-1 leading-none">
              {metrics.dismemberEfficiencyPct}%
            </div>
            <div className="text-[10px] font-tactical text-[#6e7b8f] mt-1.5">
              총 {hud.dismembers}건 절단/파쇄
            </div>
          </div>

          <div className="sm:px-4 py-1 sm:py-0">
            <div className="text-[10px] font-tactical tracking-[0.14em] text-[#8490a3]">사격 명중률</div>
            <div className="font-display text-2xl font-bold text-[#34d399] mt-1 leading-none">
              {metrics.accuracyPct}%
            </div>
            <div className="text-[10px] font-tactical text-[#6e7b8f] mt-1.5">
              {hud.analytics.shotsHit} / {hud.analytics.shotsFired} 발
            </div>
          </div>

          <div className="sm:px-4 py-1 sm:py-0">
            <div className="text-[10px] font-tactical tracking-[0.14em] text-[#8490a3]">헤드샷 비율</div>
            <div className="font-display text-2xl font-bold text-[#56c2ff] mt-1 leading-none">
              {metrics.headshotRatePct}%
            </div>
            <div className="text-[10px] font-tactical text-[#6e7b8f] mt-1.5">
              두부 파괴 {hud.analytics.partBreakdown.head}회
            </div>
          </div>

          <div className="sm:pl-4 py-1 sm:py-0 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-tactical tracking-[0.14em] text-[#8490a3]">인류 블랙박스</div>
            <div className="font-display text-2xl font-bold text-[#f6b75e] mt-1 leading-none">
              {hud.holotapesFound} / {hud.holotapesTotal}
            </div>
            <div className="text-[10px] font-tactical text-[#6e7b8f] mt-1.5">인류 최후 기록</div>
          </div>
        </div>

        {/* Middle Row: Donut (Faction Contribution) + Horizontal Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-3.5 border-b border-white/[0.08]">
          <div className="lg:col-span-5 flex flex-col justify-between lg:pr-5 lg:border-r lg:border-white/[0.08]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold tracking-[0.04em] text-[#f3f5f8]">
                AI 군단별 처치 기여도 (3파전)
              </h3>
              <span className="text-[10px] font-tactical tracking-[0.14em] text-[#748094]">
                D3 DONUT
              </span>
            </div>

            <div className="relative flex items-center justify-center my-0.5">
              <svg
                ref={donutRef}
                viewBox="0 0 220 220"
                className="w-[146px] h-[146px]"
                role="img"
                aria-label="세력별 처치 기여도 도넛 차트"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center tabular-nums">
                {hoveredFaction ? (
                  <>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: hoveredFaction.color }}
                    >
                      {hoveredFaction.label}
                    </span>
                    <span className="font-display text-2xl font-bold text-[#f3f5f8] leading-tight">
                      {hoveredFaction.pct}%
                    </span>
                    <span className="text-[10px] font-tactical text-[#8490a3]">
                      {hoveredFaction.kills} 처치
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-tactical text-[#8490a3]">총 처치</span>
                    <span className="font-display text-3xl font-bold text-[#f3f5f8] leading-tight">
                      {hud.kills}
                    </span>
                    <span className="text-[10px] font-tactical font-bold tracking-[0.16em] text-[#e89b3c]">
                      HOSTILES
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.07] text-[11px] tabular-nums">
              {metrics.factionShares.map((f) => {
                const fEnum =
                  f.key === 'raider'
                    ? Faction.RAIDER
                    : f.key === 'syndicate'
                      ? Faction.SYNDICATE
                      : Faction.ROBOT;
                const shortLabel =
                  f.key === 'raider'
                    ? '폐철 약탈기'
                    : f.key === 'syndicate'
                      ? '이지스 신스'
                      : '에이펙스';
                return (
                  <div key={f.key} className="flex items-center gap-1.5">
                    <FactionCrest faction={fEnum} size={24} />
                    <div className="min-w-0">
                      <div className="text-[10px] text-[#9aa6b8] whitespace-nowrap font-medium">
                        {shortLabel}
                      </div>
                      <div className="font-tactical text-[#f3f5f8] font-bold leading-tight whitespace-nowrap">
                        {f.kills} ({f.pct}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold tracking-[0.04em] text-[#f3f5f8]">
                부위 파괴 및 처형 효율 분석
              </h3>
              <span className="text-[10px] font-tactical tracking-[0.12em] text-[#748094] tabular-nums">
                {hoveredPart ? `${hoveredPart.label}: ${hoveredPart.count}회` : 'D3 BAR MATRIX'}
              </span>
            </div>

            <svg
              ref={barRef}
              viewBox="0 0 420 166"
              className="w-full h-auto"
              role="img"
              aria-label="부위 파괴 효율 가로 막대 차트"
            />
          </div>
        </div>

        {/* Bottom Row: Combat Momentum Timeline */}
        <div className="pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-xs font-bold tracking-[0.04em] text-[#f3f5f8]">
              시간대별 교전 모멘텀 (누적 처치 · 부위 파괴)
            </h3>
            <div className="flex items-center gap-4 text-[11px] font-tactical">
              <span className="flex items-center gap-1.5 text-[#f19999]">
                <span className="w-3 h-[2px] bg-[#dc4c4c]" />
                누적 처치
              </span>
              <span className="flex items-center gap-1.5 text-[#f6b75e]">
                <span className="w-3 h-[2px] bg-[#e89b3c]" />
                부위 파괴
              </span>
            </div>
          </div>

          <svg
            ref={timelineRef}
            viewBox="0 0 760 110"
            className="w-full h-auto"
            role="img"
            aria-label="시간대별 누적 처치 및 부위 파괴 곡선"
          />
        </div>

        {/* Footer Actions */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
          <span className="text-xs text-[#94a0b2]">
            평가 요약: <strong className="text-[#f3f5f8]">{rank.title}</strong> — {rank.summary}
          </span>
          <div className="flex items-center gap-2.5">
            <GameButton variant="secondary" size="sm" onClick={onClose}>
              {isPostCombat ? '결과 요약으로' : '일시정지로 복귀'}
            </GameButton>
            {isPostCombat && onRedeploy && (
              <GameButton variant="primary" size="sm" onClick={onRedeploy}>
                전장 재투입
              </GameButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
