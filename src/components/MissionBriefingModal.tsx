import React, { useEffect } from 'react';
import {
  getMissionProfile,
  WEAPON_ATTACHMENTS,
} from '../game/campaignMissions';
import { CampaignMissionId, WeaponAttachmentId } from '../game/types';
import { GameButton, HudGlyphIcon, Keycap } from './GameUiKit';

interface MissionBriefingModalProps {
  missionId: CampaignMissionId;
  attachment: WeaponAttachmentId;
  onSelectAttachment: (id: WeaponAttachmentId) => void;
  onDeploy: (missionId: CampaignMissionId) => void;
  onClose: () => void;
}

const BRIEFING_ROSTER = [
  {
    name: '강서연 대위',
    role: '발키리-01 궤도지휘',
    img: './src/assets/images/portrait_captain_kang.jpg',
    accent: '#60a5fa',
  },
  {
    name: '천사-01 항공대',
    role: 'UH-60K / AC-130',
    img: './src/assets/images/portrait_gunship.jpg',
    accent: '#38d9ff',
  },
  {
    name: '고스트-9',
    role: '탈영 신스 해커',
    img: './src/assets/images/portrait_ghost9.jpg',
    accent: '#2dd4bf',
  },
  {
    name: '아키텍트',
    role: 'OMNI-CORE 중추',
    img: './src/assets/images/portrait_arcadia.jpg',
    accent: '#ff4422',
  },
];

export const MissionBriefingModal: React.FC<MissionBriefingModalProps> = ({
  missionId,
  attachment,
  onSelectAttachment,
  onDeploy,
  onClose,
}) => {
  const mission = getMissionProfile(missionId);
  const activeSpec =
    WEAPON_ATTACHMENTS.find((a) => a.id === attachment) ?? WEAPON_ATTACHMENTS[0];
  const statBars = [
    {
      label: '반동 제어',
      pct: Math.min(100, Math.round((2 - activeSpec.recoilMult) * 68)),
      delta: Math.round((1 - activeSpec.recoilMult) * 100),
    },
    {
      label: '명중 정밀',
      pct: Math.min(100, Math.round((2 - activeSpec.spreadMult) * 68)),
      delta: Math.round((1 - activeSpec.spreadMult) * 100),
    },
    {
      label: '탄창 용량',
      pct: Math.min(100, Math.round(activeSpec.magMult * 66)),
      delta: Math.round((activeSpec.magMult - 1) * 100),
    },
    {
      label: '관통 화력',
      pct: Math.min(100, Math.round(activeSpec.damageMult * 70)),
      delta: Math.round((activeSpec.damageMult - 1) * 100),
    },
  ];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#05080f]/82 backdrop-blur-xl animate-panel-in overflow-y-auto"
      data-testid="mission-briefing-modal"
    >
      <div className="relative my-auto w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-[20px] border border-white/[0.12] bg-[#0c111c]/92 backdrop-blur-2xl shadow-[0_36px_100px_rgba(0,0,0,0.9)]">
        {/* Full-Bleed Cinematic Mission Key Art Header (compact height so 1280x720 fits without scroll) */}
        <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-[#060910]">
          <img
            src={mission.keyArtUrl}
            alt={mission.title}
            className="w-full h-full object-cover object-center opacity-92"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(6,9,16,0.18) 0%, rgba(12,17,28,0.68) 62%, rgba(12,17,28,1) 100%)',
            }}
          />
          <div className="absolute top-3.5 left-5 right-5 flex items-center justify-between">
            <span
              className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 font-tactical text-[10px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: mission.accentCss }}
            >
              {mission.numberLabel} · {mission.code}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-full bg-black/55 hover:bg-white/15 backdrop-blur-md border border-white/15 text-[11px] font-medium text-[#e2e8f0] cursor-pointer transition-colors"
            >
              닫기 [ESC]
            </button>
          </div>
          <div className="absolute bottom-3.5 left-5 right-5">
            <div className="font-tactical text-[10.5px] tracking-[0.14em] text-[#cbd5e1]/90 uppercase">
              {mission.location}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f8fafc] tracking-tight mt-0.5 game-text-outline">
              {mission.title}
            </h2>
          </div>
        </div>

        {/* Briefing Intel + Squad Portraits + Gunsmith Attachment Selector */}
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 7 cols: Lore + Tactical Intel + Squad Roster */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.08em] text-[#94a3b8] uppercase mb-1">
                작전 브리핑
              </div>
              <p className="text-xs sm:text-[13px] text-[#e2e8f0] leading-relaxed break-keep">
                {mission.briefingLore}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-[10px] font-semibold tracking-[0.08em] text-[#f5b342] uppercase mb-1.5">
                핵심 전술 지침
              </div>
              <ul className="space-y-1">
                {mission.tacticalTips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-[11.5px] text-[#cbd5e1] leading-snug break-keep"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#38d9ff] shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Real Photorealistic Character Comms Roster */}
            <div>
              <div className="text-[10px] font-semibold tracking-[0.08em] text-[#94a3b8] uppercase mb-1.5">
                작전 교신 채널
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BRIEFING_ROSTER.map((member) => (
                  <div
                    key={member.name}
                    className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.035] border border-white/[0.07]"
                  >
                    <img
                      src={member.img}
                      alt={member.name}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/15"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#f8fafc] truncate">
                        {member.name}
                      </div>
                      <div
                        className="text-[9.5px] font-medium truncate opacity-90"
                        style={{ color: member.accent }}
                      >
                        {member.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: CoD Gunsmith-Lite Primary Weapon Attachment Loadout */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.08em] text-[#38d9ff] uppercase mb-1.5">
                주무기 전술 부착물 (GUNSMITH)
              </div>
              <div className="space-y-1">
                {WEAPON_ATTACHMENTS.map((att) => {
                  const selected = attachment === att.id;
                  return (
                    <button
                      key={att.id}
                      type="button"
                      data-testid={`attachment-${att.id}`}
                      onClick={() => onSelectAttachment(att.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? 'bg-white/[0.11] border-white/55 shadow-[0_8px_24px_rgba(0,0,0,0.38)]'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold text-[#f8fafc]">{att.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8.5px] font-tactical font-bold ${
                            selected
                              ? 'bg-white text-[#090d16]'
                              : 'bg-white/10 text-[#94a3b8]'
                          }`}
                        >
                          {att.tag}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#cbd5e1] mt-0.5">{att.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* CoD Gunsmith Live Weapon Telemetry Stat Bars */}
              <div
                className="mt-2 p-2.5 rounded-xl bg-white/[0.035] border border-white/[0.08] space-y-1.5"
                data-testid="gunsmith-stat-bars"
              >
                {statBars.map((st) => (
                  <div key={st.label} className="flex items-center gap-2.5 text-[10.5px] font-tactical">
                    <span className="w-16 text-[#94a3b8] shrink-0">{st.label}</span>
                    <div className="flex-1 h-[5px] bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${st.pct}%`,
                          backgroundColor:
                            st.delta > 0 ? '#2ee6a6' : st.delta < 0 ? '#f59e0b' : '#38d9ff',
                        }}
                      />
                    </div>
                    <span
                      className={`w-10 text-right font-bold tabular-nums ${
                        st.delta > 0
                          ? 'text-[#2ee6a6]'
                          : st.delta < 0
                            ? 'text-[#f59e0b]'
                            : 'text-[#cbd5e1]'
                      }`}
                    >
                      {st.delta > 0 ? `+${st.delta}%` : st.delta < 0 ? `${st.delta}%` : 'STD'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <GameButton
                variant="primary"
                fullWidth
                data-testid="briefing-deploy-btn"
                onClick={() => onDeploy(missionId)}
                className="h-12 justify-between px-5"
              >
                <span className="inline-flex items-center gap-2 font-bold tracking-wide">
                  <HudGlyphIcon kind="play" size={14} />
                  <span>{mission.numberLabel} 작전 투입</span>
                </span>
                <Keycap size="xs">DEPLOY</Keycap>
              </GameButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
