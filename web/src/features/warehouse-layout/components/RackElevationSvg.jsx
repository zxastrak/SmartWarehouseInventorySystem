/**
 * Interactive SVG Rack Elevation Component (Tampak Depan Rak)
 * Renders upright columns, horizontal beams, bay divisions, and bin slot compartments.
 * Styled with Susuno Modern Industrial Forest aesthetic.
 */

import React from 'react';

export default function RackElevationSvg({
  rack,
  bays = [],
  levels = [],
  configs = [],
  highlightedBay = null,
  highlightedLevel = null,
  onSelectSlot,
}) {
  if (!rack) return null;

  const rackLength = rack.length_mm || 2400;
  const rackHeight = rack.height_mm || 4000;

  // ViewBox margins for dimension annotations
  const marginLeft = 180;
  const marginRight = 60;
  const marginTop = 80;
  const marginBottom = 120;

  const vbMinX = -marginLeft;
  const vbMinY = -marginTop;
  const vbWidth = rackLength + marginLeft + marginRight;
  const vbHeight = rackHeight + marginTop + marginBottom;

  // 1. Calculate Bay Horizontal Positions
  const bayOffsets = [];
  let currentX = 0;
  for (const b of bays) {
    bayOffsets.push({
      ...b,
      startX: currentX,
      width: b.width_mm,
    });
    currentX += b.width_mm;
  }

  // 2. Sort Levels by height from floor
  const sortedLevels = [...levels].sort((a, b) => a.level_number - b.level_number);

  // Helper map for position counts
  const configMap = new Map();
  for (const c of configs) {
    configMap.set(`${c.bay_number}:${c.level_number}`, c.position_count);
  }

  // Upright column width in mm
  const uprightWidth = 60;
  const beamHeight = 40;

  return (
    <div className="rack-elevation-svg-container">
      <svg
        className="rack-elevation-svg"
        viewBox={`${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Steel Beam Linear Gradient */}
          <linearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#737b6c" />
            <stop offset="50%" stopColor="#525c48" />
            <stop offset="100%" stopColor="#3e5510" />
          </linearGradient>

          {/* Upright Column Gradient */}
          <linearGradient id="uprightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2e3527" />
            <stop offset="40%" stopColor="#525c48" />
            <stop offset="100%" stopColor="#191d17" />
          </linearGradient>

          {/* Bin Compartment Pattern */}
          <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#e2e5dc" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Floor Line */}
        <line
          x1={-100}
          y1={rackHeight}
          x2={rackLength + 100}
          y2={rackHeight}
          stroke="#191d17"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <text
          x={-40}
          y={rackHeight + 35}
          fill="#737b6c"
          fontSize="36"
          fontWeight="600"
          textAnchor="end"
        >
          Lantai (0 mm)
        </text>

        {/* Outer Frame Backing */}
        <rect
          x={0}
          y={0}
          width={rackLength}
          height={rackHeight}
          fill="#f8f9f5"
          stroke="#d0d7c7"
          strokeWidth="2"
        />

        {/* Bay Vertical Background Guides & Top Labels */}
        {bayOffsets.map((bay, idx) => (
          <g key={`bay-guide-${bay.bay_number}`}>
            {/* Bay Column Highlight */}
            {highlightedBay === bay.bay_number && (
              <rect
                x={bay.startX}
                y={0}
                width={bay.width}
                height={rackHeight}
                fill="rgba(92, 115, 43, 0.08)"
              />
            )}

            {/* Bottom Dimension Line for Bay */}
            <line
              x1={bay.startX + 6}
              y1={rackHeight + 50}
              x2={bay.startX + bay.width - 6}
              y2={rackHeight + 50}
              stroke="#5c732b"
              strokeWidth="3"
            />
            <circle cx={bay.startX + 6} cy={rackHeight + 50} r="4" fill="#5c732b" />
            <circle cx={bay.startX + bay.width - 6} cy={rackHeight + 50} r="4" fill="#5c732b" />
            <text
              x={bay.startX + bay.width / 2}
              y={rackHeight + 85}
              fill="#3e5510"
              fontSize="38"
              fontWeight="700"
              textAnchor="middle"
            >
              Bay {bay.bay_number} ({bay.width} mm)
            </text>
          </g>
        ))}

        {/* Compartments & Bins (Bay x Level) */}
        {bayOffsets.map((bay) => {
          return sortedLevels.map((lvl, lIdx) => {
            const posCount = configMap.get(`${bay.bay_number}:${lvl.level_number}`) || 1;
            const levelFloorY = rackHeight - lvl.height_from_floor_mm;

            // Height of this shelf compartment
            const nextLvl = sortedLevels[lIdx + 1];
            const compTopY = nextLvl
              ? rackHeight - nextLvl.height_from_floor_mm
              : 0;
            const compHeight = levelFloorY - compTopY - beamHeight;

            if (compHeight <= 0) return null;

            const slotWidth = (bay.width - uprightWidth) / posCount;

            return (
              <g key={`comp-${bay.bay_number}-${lvl.level_number}`}>
                {/* Render Slot Bins */}
                {Array.from({ length: posCount }).map((_, slotIdx) => {
                  const slotX = bay.startX + uprightWidth / 2 + slotIdx * slotWidth + 8;
                  const actualSlotW = slotWidth - 16;
                  const actualSlotH = compHeight - 16;
                  const slotY = compTopY + 8;

                  return (
                    <g
                      key={`slot-${bay.bay_number}-${lvl.level_number}-${slotIdx + 1}`}
                      className="elevation-slot-group"
                      onClick={() =>
                        onSelectSlot &&
                        onSelectSlot({
                          bay_number: bay.bay_number,
                          level_number: lvl.level_number,
                          position: slotIdx + 1,
                        })
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x={slotX}
                        y={slotY}
                        width={actualSlotW}
                        height={actualSlotH}
                        rx="8"
                        fill="#ffffff"
                        stroke="#c5cdbb"
                        strokeWidth="2.5"
                        className="elevation-bin-box"
                      />
                      <text
                        x={slotX + actualSlotW / 2}
                        y={slotY + actualSlotH / 2 + 10}
                        fill="#525c48"
                        fontSize={Math.min(32, actualSlotW / 2.5)}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        P{slotIdx + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          });
        })}

        {/* Upright Columns (Vertical Steel Pillars) */}
        {/* Leftmost Upright */}
        <rect
          x={0}
          y={0}
          width={uprightWidth}
          height={rackHeight}
          fill="url(#uprightGradient)"
          rx="4"
        />

        {/* Interior Uprights at each bay boundary */}
        {bayOffsets.map((bay, idx) => (
          <rect
            key={`upright-${idx}`}
            x={bay.startX + bay.width - uprightWidth / 2}
            y={0}
            width={uprightWidth}
            height={rackHeight}
            fill="url(#uprightGradient)"
            rx="4"
          />
        ))}

        {/* Rightmost Upright */}
        <rect
          x={rackLength - uprightWidth}
          y={0}
          width={uprightWidth}
          height={rackHeight}
          fill="url(#uprightGradient)"
          rx="4"
        />

        {/* Horizontal Beams at each Level */}
        {sortedLevels.map((lvl) => {
          const beamY = rackHeight - lvl.height_from_floor_mm - beamHeight;
          const isHighlighted = highlightedLevel === lvl.level_number;

          return (
            <g key={`beam-${lvl.level_number}`}>
              {/* Horizontal Beam Bar */}
              <rect
                x={0}
                y={beamY}
                width={rackLength}
                height={beamHeight}
                fill={isHighlighted ? '#5c732b' : 'url(#beamGradient)'}
                stroke="#191d17"
                strokeWidth="1.5"
                rx="3"
              />

              {/* Level Height Annotation on Left Margin */}
              <line
                x1={-110}
                y1={beamY + beamHeight / 2}
                x2={-10}
                y2={beamY + beamHeight / 2}
                stroke="#737b6c"
                strokeWidth="2.5"
                strokeDasharray="6,4"
              />
              <text
                x={-120}
                y={beamY + beamHeight / 2 + 10}
                fill="#191d17"
                fontSize="36"
                fontWeight="700"
                textAnchor="end"
              >
                L{lvl.level_number} ({lvl.height_from_floor_mm} mm)
              </text>

              {/* Max Weight Capacity Badge (if configured) */}
              {lvl.max_weight_kg && (
                <text
                  x={rackLength + 15}
                  y={beamY + beamHeight / 2 + 10}
                  fill="#737b6c"
                  fontSize="32"
                  fontWeight="600"
                  textAnchor="start"
                >
                  Max {lvl.max_weight_kg} kg
                </text>
              )}
            </g>
          );
        })}

        {/* Top Header Label */}
        <text
          x={rackLength / 2}
          y={-30}
          fill="#191d17"
          fontSize="48"
          fontWeight="800"
          textAnchor="middle"
        >
          {rack.rack_code} — {rackLength / 1000}m Panjang × {rackHeight / 1000}m Tinggi
        </text>
      </svg>
    </div>
  );
}
