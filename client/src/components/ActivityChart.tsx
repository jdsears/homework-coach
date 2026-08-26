import { useState } from 'react';
import { useI18n } from '../i18n';

// 14-day stacked bar chart: messages + practice per day.
// Palette (validated for CVD separation on white): indigo = messages, pink = practice.
const SERIES = [
  { key: 'messages' as const, labelKey: 'chart.messages', color: '#6366f1' },
  { key: 'practice' as const, labelKey: 'chart.practice', color: '#f472b6' },
];

const WIDTH = 560;
const HEIGHT = 150;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 128; // leaves room for weekday labels
const GAP = 2; // surface gap between stacked segments

interface Day {
  date: string;
  messages: number;
  practice: number;
}

function weekdayLetter(dateStr: string): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

function niceDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ActivityChart({ days }: { days: Day[] }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...days.map(day => day.messages + day.practice));
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const slot = WIDTH / Math.max(days.length, 1);
  const barWidth = Math.min(24, slot - 8);

  const yFor = (value: number) => (value / max) * plotHeight;

  return (
    <div className="activity-chart">
      <div className="chart-legend">
        {SERIES.map(series => (
          <span key={series.key} className="legend-item">
            <span className="legend-swatch" style={{ background: series.color }} />
            {t(series.labelKey)}
          </span>
        ))}
      </div>

      <div className="chart-holder">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t('chart.caption')}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* recessive grid */}
          {[0.5, 1].map(fraction => (
            <line
              key={fraction}
              x1={0}
              x2={WIDTH}
              y1={PLOT_BOTTOM - plotHeight * fraction}
              y2={PLOT_BOTTOM - plotHeight * fraction}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}
          <line
            x1={0}
            x2={WIDTH}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {days.map((day, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            const messagesH = yFor(day.messages);
            const practiceH = yFor(day.practice);
            const practiceY =
              PLOT_BOTTOM - messagesH - (messagesH > 0 && practiceH > 0 ? GAP : 0) - practiceH;
            const isHover = hover === index;
            return (
              <g key={day.date} opacity={hover === null || isHover ? 1 : 0.45}>
                {messagesH > 0 && (
                  <rect
                    x={x}
                    y={PLOT_BOTTOM - messagesH}
                    width={barWidth}
                    height={messagesH}
                    fill={SERIES[0].color}
                    rx={practiceH > 0 ? 0 : 4}
                  />
                )}
                {practiceH > 0 && (
                  <rect
                    x={x}
                    y={practiceY}
                    width={barWidth}
                    height={practiceH}
                    fill={SERIES[1].color}
                    rx={4}
                  />
                )}
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="chart-day-label"
                >
                  {weekdayLetter(day.date)}
                </text>
                {/* full-height hover target, larger than the marks */}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>

        {hover !== null && days[hover] && (
          <div
            className="chart-tooltip"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
          >
            <strong>{niceDate(days[hover].date)}</strong>
            <div>
              {days[hover].messages} {t('chart.messages').toLowerCase()}
            </div>
            <div>
              {days[hover].practice} {t('chart.practice').toLowerCase()}
            </div>
          </div>
        )}
      </div>

      {/* Accessible data table (also the low-contrast relief for the pink series) */}
      <table className="sr-only">
        <caption>{t('chart.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('chart.date')}</th>
            <th scope="col">{t('chart.messages')}</th>
            <th scope="col">{t('chart.practice')}</th>
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day.date}>
              <th scope="row">{day.date}</th>
              <td>{day.messages}</td>
              <td>{day.practice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ActivityChart;
