import { useState, useEffect, useMemo, type FC } from 'react';
import type { Paper } from '@/types';
import { getScoreColor, fetchStats } from '@/utils';
import { ChartComponent } from '@/components/charts';
import { ScoreBreakdownChips } from '@/components/ui';

interface TrendsPageProps {
  papers: Paper[];
}

const chartColors = {
  amber: 'rgb(217, 119, 6)',
  teal: 'rgb(15, 118, 110)',
  stone: 'rgb(120, 113, 108)',
  red: 'rgb(220, 38, 38)',
  blue: 'rgb(37, 99, 235)',
  green: 'rgb(22, 163, 74)',
  purple: 'rgb(147, 51, 234)',
  orange: 'rgb(234, 88, 12)',
};

const tierScoreColors = [
  '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
  '#f59e0b', '#d97706', '#b45309', '#92400e',
];

const categoryColors = [
  chartColors.amber, chartColors.teal, chartColors.blue, chartColors.purple,
  chartColors.green, chartColors.orange, chartColors.red, chartColors.stone,
];

export const TrendsPage: FC<TrendsPageProps> = ({ papers: initialPapers }) => {
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(data => {
        setAllPapers(data.papers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stats:', err);
        setAllPapers(initialPapers);
        setLoading(false);
      });
  }, [initialPapers]);

  const papers = allPapers.length > 0 ? allPapers : initialPapers;

  const stats = useMemo(() => {
    if (!papers.length) return null;

    const scored = papers.filter(p => p.excitement_score > 0);
    const avgScore = scored.length
      ? (scored.reduce((sum, p) => sum + p.excitement_score, 0) / scored.length).toFixed(1)
      : '0';

    const categories: Record<string, number> = {};
    const validCategories = ['Reasoning', 'Agents', 'Multimodal', 'Alignment', 'Benchmarks', '3D/Spatial', 'Vision', 'NLP', 'RL', 'Other'];
    papers.forEach(p => {
      if (p.reasoning_category) {
        const cat = validCategories.includes(p.reasoning_category) ? p.reasoning_category : 'Other';
        categories[cat] = (categories[cat] || 0) + 1;
      }
    });
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const scoreDistribution = [0, 0, 0, 0, 0, 0, 0, 0];
    scored.forEach(p => {
      scoreDistribution[p.excitement_score]++;
    });

    const papersByWeek: Record<string, number> = {};
    papers.forEach(p => {
      if (p.date) {
        const date = new Date(p.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);
        papersByWeek[weekKey] = (papersByWeek[weekKey] || 0) + 1;
      }
    });
    const timelineData = Object.entries(papersByWeek)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12);

    const authorCounts: Record<string, number> = {};
    papers.forEach(p => {
      if (p.authors) {
        const firstAuthor = p.authors.split(',')[0].trim();
        if (firstAuthor && !firstAuthor.includes('et al')) {
          authorCounts[firstAuthor] = (authorCounts[firstAuthor] || 0) + 1;
        }
      }
    });
    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const hotPapers = papers
      .filter(p => p.excitement_score >= 5)
      .sort((a, b) => b.excitement_score - a.excitement_score)
      .slice(0, 5);

    const tierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    scored.forEach(p => {
      const score = p.excitement_score;
      if (score >= 7) tierDistribution.S++;
      else if (score >= 5) tierDistribution.A++;
      else if (score === 4) tierDistribution.B++;
      else if (score >= 2) tierDistribution.C++;
      else tierDistribution.D++;
    });

    const breakdownTotals = { Novelty: 0, Utility: 0, Results: 0, Access: 0 };
    let breakdownCount = 0;
    scored.forEach(p => {
      if (p.score_breakdown) {
        const parts = p.score_breakdown.split(',').map(s => s.trim());
        parts.forEach(part => {
          const [key, val] = part.split(':');
          if (key && val && key.trim() in breakdownTotals) {
            breakdownTotals[key.trim() as keyof typeof breakdownTotals] += parseInt(val) || 0;
          }
        });
        breakdownCount++;
      }
    });
    const breakdownAvg = breakdownCount > 0 ? {
      Novelty: (breakdownTotals.Novelty / breakdownCount).toFixed(1),
      Utility: (breakdownTotals.Utility / breakdownCount).toFixed(1),
      Results: (breakdownTotals.Results / breakdownCount).toFixed(1),
      Access: (breakdownTotals.Access / breakdownCount).toFixed(1),
    } : null;

    return {
      avgScore,
      topCategories,
      scoreDistribution,
      totalPapers: papers.length,
      scoredPapers: scored.length,
      timelineData,
      topAuthors,
      hotPapers,
      categories,
      tierDistribution,
      breakdownAvg,
    };
  }, [papers]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-500">{loading ? 'Loading all papers...' : 'Loading trends...'}</p>
      </div>
    );
  }

  const scoreChartData = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7'],
    datasets: [{
      label: 'Papers',
      data: stats.scoreDistribution,
      backgroundColor: tierScoreColors,
      borderRadius: 4,
    }],
  };

  const timelineChartData = {
    labels: stats.timelineData.map(([date]) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Papers',
      data: stats.timelineData.map(([, count]) => count),
      borderColor: chartColors.amber,
      backgroundColor: 'rgba(217, 119, 6, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  const categoryChartData = {
    labels: stats.topCategories.map(([cat]) => cat),
    datasets: [{
      data: stats.topCategories.map(([, count]) => count),
      backgroundColor: categoryColors.slice(0, stats.topCategories.length),
      borderWidth: 0,
    }],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">
        Trends & Insights
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Total Papers</p>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stats.totalPapers}</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Avg Score</p>
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.avgScore}<span className="text-sm text-stone-400">/7</span></p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">A-Tier or Higher</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.tierDistribution.S + stats.tierDistribution.A}</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Categories</p>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{Object.keys(stats.categories).length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
          <span className="text-sm font-bold text-purple-700 dark:text-purple-400">S</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{stats.tierDistribution.S} Groundbreaking</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800">
          <span className="text-sm font-bold text-teal-700 dark:text-teal-400">A</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{stats.tierDistribution.A} Strong</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">B</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{stats.tierDistribution.B} Solid</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800/50 border border-stone-300 dark:border-stone-700">
          <span className="text-sm font-bold text-stone-600 dark:text-stone-400">C</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{stats.tierDistribution.C} Narrow</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <span className="text-sm font-bold text-red-700 dark:text-red-400">D</span>
          <span className="text-xs text-stone-600 dark:text-stone-400">{stats.tierDistribution.D} Weak</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Score Distribution</h2>
          <div className="h-48">
            <ChartComponent
              type="bar"
              data={scoreChartData}
              options={{
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Papers Over Time (Weekly)</h2>
          <div className="h-48">
            <ChartComponent
              type="line"
              data={timelineChartData}
              options={{
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Score Breakdown Avg</h2>
          {stats.breakdownAvg ? (
            <div className="space-y-3">
              {[
                { key: 'Novelty', max: 3, barColor: '#0f766e', textColor: 'text-teal-600 dark:text-teal-400' },
                { key: 'Utility', max: 1, barColor: '#d97706', textColor: 'text-amber-600 dark:text-amber-400' },
                { key: 'Results', max: 2, barColor: '#059669', textColor: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'Access', max: 1, barColor: '#2563eb', textColor: 'text-blue-600 dark:text-blue-400' },
              ].map(({ key, max, barColor, textColor }) => {
                const val = parseFloat(stats.breakdownAvg![key as keyof typeof stats.breakdownAvg]);
                const pct = (val / max) * 100;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-stone-600 dark:text-stone-400">{key}</span>
                      <span className={`font-medium ${textColor}`}>{val}/{max}</span>
                    </div>
                    <div className="h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-400 text-center py-8">No breakdown data</p>
          )}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Categories</h2>
          <div className="h-48">
            <ChartComponent
              type="doughnut"
              data={categoryChartData}
              options={{
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { boxWidth: 10, font: { size: 9 } },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Top Authors</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hidden">
            {stats.topAuthors.slice(0, 6).map(([author, count], i) => (
              <div key={author} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-stone-700 dark:text-stone-300 truncate">{author}</div>
                </div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">
            A-Tier Papers
            <span className="ml-2 text-xs font-normal text-stone-400">(5+)</span>
          </h2>
          {stats.hotPapers.length > 0 ? (
            <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-hidden">
              {stats.hotPapers.map(paper => (
                <a
                  key={paper.id}
                  href={paper.arxiv_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`text-sm font-bold ${getScoreColor(paper.excitement_score)}`}>
                      {paper.excitement_score}
                    </span>
                    <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2 leading-tight flex-1">
                      {paper.title}
                    </p>
                  </div>
                  {paper.score_breakdown && (
                    <div className="ml-6">
                      <ScoreBreakdownChips breakdownString={paper.score_breakdown} compact />
                    </div>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 text-center py-8">No A-tier papers yet</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-lg p-4 border border-stone-200 dark:border-stone-800">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">All Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.topCategories.map(([category, count], i) => (
            <div key={category} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryColors[i % categoryColors.length] }}
              />
              <span className="text-xs text-stone-600 dark:text-stone-400 truncate flex-1">{category}</span>
              <span className="text-xs font-medium text-stone-500">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
