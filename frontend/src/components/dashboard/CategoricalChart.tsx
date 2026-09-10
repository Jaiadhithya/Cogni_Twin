'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';

const COLORS = ['#00F0FF', '#00E599', '#FFB020', '#38BDF8', '#FF4466', '#A78BFA'];

interface DataPoint {
  [key: string]: any;
}

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(6, 9, 14, 0.95)',
  borderColor: 'rgba(0, 240, 255, 0.3)',
  borderRadius: '12px',
  borderWidth: '1px',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(0,240,255,0.2)',
  color: '#FFFFFF',
  padding: '12px 16px',
  fontFamily: 'var(--font-jetbrains-mono), monospace',
};

function CategoricalChartInner({
  data,
  width,
  height,
  categoryKey,
  valueKey,
  metricName,
}: {
  data: DataPoint[];
  width: number;
  height: number;
  categoryKey: string;
  valueKey: string;
  metricName?: string;
}) {
  const margin = { top: 20, right: 20, bottom: 50, left: 65 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
  } = useTooltip<DataPoint>();

  const isCurrency = /revenue|price|sales|cost|flow/i.test(metricName || '');

  const formatDynamic = (val: number) => {
    if (isCurrency) return formatCurrency(val);
    return Number(val).toLocaleString('en-US');
  };

  const formatDynamicCompact = (val: number) => {
    if (isCurrency) return formatCurrencyCompact(val);
    return Number(val).toLocaleString('en-US', { notation: 'compact' });
  };

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        round: true,
        domain: data.map((d) => String(d[categoryKey] || 'Unknown')),
        padding: 0.35,
      }),
    [innerWidth, data, categoryKey]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        round: true,
        domain: [0, Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1) * 1.15],
      }),
    [innerHeight, data, valueKey]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div className="relative w-full h-full">
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {/* Grid lines */}
          {yScale.ticks(4).map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Glowing Bars */}
          {data.map((d, index) => {
            const category = String(d[categoryKey] || 'Unknown');
            const value = Number(d[valueKey]) || 0;
            const barWidth = xScale.bandwidth();
            const barHeight = Math.max(0, innerHeight - yScale(value));
            const barX = xScale(category) || 0;
            const barY = yScale(value);
            const color = COLORS[index % COLORS.length];

            return (
              <Group key={`bar-${category}-${index}`}>
                {/* Translucent Fill Bar */}
                <motion.rect
                  x={barX}
                  width={barWidth}
                  fill={color}
                  fillOpacity={0.22}
                  rx={6}
                  initial={{ y: innerHeight, height: 0 }}
                  animate={{ y: barY, height: barHeight }}
                  transition={{
                    type: 'spring',
                    damping: 24,
                    stiffness: 120,
                    delay: index * 0.04,
                  }}
                  onMouseMove={(event) => {
                    const coords = localPoint(event) || { x: 0, y: 0 };
                    showTooltip({
                      tooltipData: d,
                      tooltipLeft: coords.x + margin.left,
                      tooltipTop: coords.y + margin.top,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                  className="cursor-pointer hover:fill-opacity-40 transition-all"
                />

                {/* Radiant Solid Top Cap */}
                <motion.rect
                  x={barX}
                  width={barWidth}
                  fill={color}
                  rx={3}
                  initial={{ y: innerHeight, height: 3 }}
                  animate={{ y: barY, height: 3 }}
                  transition={{
                    type: 'spring',
                    damping: 24,
                    stiffness: 120,
                    delay: index * 0.04,
                  }}
                  style={{
                    pointerEvents: 'none',
                    filter: `drop-shadow(0 0 8px ${color})`,
                  }}
                />
              </Group>
            );
          })}

          {/* X Axis */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke="rgba(255,255,255,0.08)"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              textAnchor: 'end',
              angle: -25,
              dy: 6,
              dx: -4,
            })}
          />

          {/* Y Axis */}
          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={4}
            tickLabelProps={() => ({
              fill: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              textAnchor: 'end',
              dx: -10,
            })}
            tickFormat={(val) => formatDynamicCompact(Number(val))}
          />
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={tooltipStyles}>
          <div className="space-y-1 font-mono">
            <span className="text-xs font-semibold text-white block">
              {tooltipData[categoryKey]}
            </span>
            <div className="text-base font-bold text-[#00F0FF] tabular-nums">
              {formatDynamic(Number(tooltipData[valueKey]))}
            </div>
            {tooltipData.share !== undefined && (
              <div className="text-[10px] text-white/50 border-t border-white/10 pt-1 mt-1">
                Share: {tooltipData.share}% of total volume
              </div>
            )}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export default function CategoricalChart({
  data,
  categoryKey = 'category',
  valueKey = 'value',
  metricName = 'Revenue',
}: {
  data: any[];
  categoryKey?: string;
  valueKey?: string;
  metricName?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full py-12 text-zinc-500 text-xs font-mono">
        No dimensional records available
      </div>
    );
  }

  return (
    <div className="h-full w-full relative z-10 min-h-[280px]">
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <CategoricalChartInner
            data={data}
            width={width}
            height={height}
            categoryKey={categoryKey}
            valueKey={valueKey}
            metricName={metricName}
          />
        )}
      </ParentSize>
    </div>
  );
}
