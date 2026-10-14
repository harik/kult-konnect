import React from 'react';
import { ScaleConnectionState } from '@/types';

interface PostureSchematicProps {
  state: ScaleConnectionState;
  hasHandles: boolean;
  heartRateBpm?: number;
}

const PostureSchematicComponent: React.FC<PostureSchematicProps> = ({
  state,
  hasHandles,
  heartRateBpm,
}) => {
  const isMeasuringImpedance = state === 'measuring_impedance';
  const isMeasuringHeartRate = state === 'measuring_heart_rate';
  const isWeightPhase = state === 'measuring_weight';
  const isComplete = state === 'completed';

  const feetActive = isWeightPhase || isMeasuringImpedance || isMeasuringHeartRate || isComplete;
  const handsActive = hasHandles || isMeasuringImpedance || isMeasuringHeartRate || isComplete;

  return (
    <div className="relative w-44 h-56 flex flex-col items-center justify-center my-2 select-none pointer-events-none">
      <svg
        viewBox="0 0 200 240"
        className="w-full h-full drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ground / Scale Platform */}
        <rect
          x="30"
          y="215"
          width="140"
          height="14"
          rx="7"
          fill="#1e293b"
          stroke={feetActive ? '#10b981' : '#334155'}
          strokeWidth="2"
          className="transition-colors duration-300"
        />

        {/* Foot Electrodes on Scale */}
        <rect
          x="55"
          y="217"
          width="24"
          height="8"
          rx="3"
          fill={feetActive ? '#10b981' : '#475569'}
          className="transition-colors duration-300"
        />
        <rect
          x="121"
          y="217"
          width="24"
          height="8"
          rx="3"
          fill={feetActive ? '#10b981' : '#475569'}
          className="transition-colors duration-300"
        />

        {/* Feet */}
        <path
          d="M62 215 L72 215 L70 200 L64 200 Z"
          fill={feetActive ? '#34d399' : '#64748b'}
          className="transition-colors duration-300"
        />
        <path
          d="M128 215 L138 215 L136 200 L130 200 Z"
          fill={feetActive ? '#34d399' : '#64748b'}
          className="transition-colors duration-300"
        />

        {/* Legs (Straight standing posture) */}
        {/* Right Leg */}
        <path
          d="M67 200 L85 140 L93 140 L73 200 Z"
          fill={isMeasuringImpedance ? '#38bdf8' : '#475569'}
          opacity={isMeasuringImpedance ? '0.9' : '0.7'}
          className="transition-all duration-300"
        />
        {/* Left Leg */}
        <path
          d="M133 200 L115 140 L107 140 L127 200 Z"
          fill={isMeasuringImpedance ? '#38bdf8' : '#475569'}
          opacity={isMeasuringImpedance ? '0.9' : '0.7'}
          className="transition-all duration-300"
        />

        {/* Torso / Trunk */}
        <path
          d="M80 82 L120 82 L112 145 L88 145 Z"
          fill={isMeasuringImpedance ? '#818cf8' : '#334155'}
          stroke="#475569"
          strokeWidth="1.5"
          className="transition-colors duration-300"
        />

        {/* Heart Icon on Chest */}
        <g transform="translate(93, 94)">
          <path
            d="M7 2 C4 0, 0 3, 0 7 C0 11, 7 15, 7 15 C7 15, 14 11, 14 7 C14 3, 10 0, 7 2 Z"
            fill={isMeasuringHeartRate ? '#f43f5e' : isComplete && heartRateBpm ? '#e11d48' : '#64748b'}
            className="transition-colors duration-300"
          />
        </g>

        {/* Head */}
        <circle cx="100" cy="55" r="16" fill="#475569" stroke="#64748b" strokeWidth="1.5" />

        {/* Arms Holding Handlebar Forward at 45 degree angle */}
        {/* Right Arm */}
        <path
          d="M82 85 L45 105 L48 113 L85 91 Z"
          fill={isMeasuringImpedance ? '#fb923c' : '#475569'}
          className="transition-colors duration-300"
        />
        {/* Left Arm */}
        <path
          d="M118 85 L155 105 L152 113 L115 91 Z"
          fill={isMeasuringImpedance ? '#fb923c' : '#475569'}
          className="transition-colors duration-300"
        />

        {/* Handlebar Metal Rod with 4 Electrodes */}
        <rect
          x="35"
          y="108"
          width="130"
          height="8"
          rx="4"
          fill="#1e293b"
          stroke={handsActive ? '#f97316' : '#64748b'}
          strokeWidth="2"
          className="transition-colors duration-300"
        />

        {/* Hand Grip Contacts (Orange when held) */}
        {/* Right Hand Contacts */}
        <rect
          x="44"
          y="105"
          width="20"
          height="14"
          rx="5"
          fill={handsActive ? '#f97316' : '#475569'}
          className="transition-colors duration-300"
        />
        {/* Left Hand Contacts */}
        <rect
          x="136"
          y="105"
          width="20"
          height="14"
          rx="5"
          fill={handsActive ? '#f97316' : '#475569'}
          className="transition-colors duration-300"
        />

        {/* Connecting Retractable Cable from Scale Base to Handlebar */}
        <line
          x1="100"
          y1="116"
          x2="100"
          y2="215"
          stroke="#334155"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>

      {/* Posture Guidance Hint */}
      <div className="text-[11px] text-center font-medium tracking-wide mt-1 min-h-[20px]">
        {!handsActive && (
          <span className="text-amber-400">Lift handlebar & hold plates with both hands</span>
        )}
        {handsActive && !isMeasuringHeartRate && !isComplete && (
          <span className="text-emerald-400">Posture correct • Keep arms straight</span>
        )}
        {isMeasuringHeartRate && (
          <span className="text-rose-400">
            Measuring resting pulse ({heartRateBpm ? `${heartRateBpm} BPM` : 'Hold still while spinning...'})
          </span>
        )}
        {isComplete && (
          <span className="text-emerald-400 font-semibold">Measurement complete! Step off</span>
        )}
      </div>
    </div>
  );
};

export const PostureSchematic = React.memo(
  PostureSchematicComponent,
  (prev, next) =>
    prev.state === next.state &&
    prev.hasHandles === next.hasHandles &&
    prev.heartRateBpm === next.heartRateBpm
);
