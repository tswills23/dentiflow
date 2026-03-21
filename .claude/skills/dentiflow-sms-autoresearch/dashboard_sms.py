#!/usr/bin/env python3
"""
Dentiflow SMS Autoresearch Dashboard -- Live visualization of recall copy optimization.

Reads results.jsonl and serves a live-updating dashboard at http://localhost:8502.

Usage:
    python3 dashboard_sms.py
    python3 dashboard_sms.py --port 8502
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent / "data"
RESULTS_FILE = BASE_DIR / "results.jsonl"
STATE_FILE = BASE_DIR / "state.json"
INSTRUCTIONS_FILE = BASE_DIR / "copy_instructions.txt"
BEST_INSTRUCTIONS_FILE = BASE_DIR / "best_copy_instructions.txt"
VARIANTS_DIR = BASE_DIR / "variants"

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dentiflow SMS Autoresearch</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #faf9f7; color: #2d2a26; padding: 32px; max-width: 1400px; margin: 0 auto; }

  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
  .header h1 { font-size: 28px; font-weight: 700; color: #2d2a26; }
  .badge { background: #2980b9; color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px; letter-spacing: 1px; }
  .subtitle { color: #8a8580; font-size: 14px; margin-top: 4px; }

  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: white; border-radius: 12px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8a8580; margin-bottom: 8px; }
  .stat-value { font-size: 36px; font-weight: 700; }
  .stat-value.green { color: #27ae60; }
  .stat-value.blue { color: #2980b9; }
  .stat-value.neutral { color: #2d2a26; }

  .chart-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 32px; }
  .chart-container canvas { width: 100% !important; height: 300px !important; }

  .criteria-charts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .criteria-charts.row2 { grid-template-columns: repeat(3, 1fr); }
  .criteria-chart { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .criteria-chart h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8a8580; margin-bottom: 8px; }
  .criteria-chart canvas { width: 100% !important; height: 120px !important; }

  .table-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 32px; }
  .table-container h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8a8580; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8a8580; padding: 8px 8px; border-bottom: 1px solid #eee; }
  td { padding: 8px 8px; border-bottom: 1px solid #f5f4f2; }
  .status-keep { color: #27ae60; font-weight: 600; }
  .status-discard { color: #8a8580; }

  .prompt-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .prompt-container h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8a8580; margin-bottom: 12px; }
  .prompt-text { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; color: #4a4540; white-space: pre-wrap; word-break: break-word; background: #faf9f7; padding: 16px; border-radius: 8px; max-height: 400px; overflow-y: auto; }

  @media (max-width: 768px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    .criteria-charts { grid-template-columns: repeat(2, 1fr); }
    .criteria-charts.row2 { grid-template-columns: repeat(2, 1fr); }
    body { padding: 16px; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div style="display:flex;align-items:center;gap:12px;">
      <h1>Dentiflow SMS Autoresearch</h1>
      <span class="badge" id="live-badge">LIVE</span>
    </div>
    <div class="subtitle" id="subtitle">Recall copy optimization -- refreshes every 15s</div>
  </div>
</div>

<div class="stats">
  <div class="stat-card">
    <div class="stat-label">Current Best</div>
    <div class="stat-value blue" id="stat-best">--</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Baseline</div>
    <div class="stat-value neutral" id="stat-baseline">--</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Improvement</div>
    <div class="stat-value green" id="stat-improvement">--</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Runs / Kept</div>
    <div class="stat-value neutral" id="stat-runs">--</div>
  </div>
</div>

<div class="chart-container">
  <canvas id="mainChart"></canvas>
</div>

<div class="criteria-charts">
  <div class="criteria-chart"><h3>Voice Authority</h3><canvas id="voiceChart"></canvas></div>
  <div class="criteria-chart"><h3>No Jargon</h3><canvas id="jargonChart"></canvas></div>
  <div class="criteria-chart"><h3>Binary CTA</h3><canvas id="ctaChart"></canvas></div>
  <div class="criteria-chart"><h3>Human Tone</h3><canvas id="toneChart"></canvas></div>
</div>
<div class="criteria-charts row2" style="margin-bottom:32px;">
  <div class="criteria-chart"><h3>No Pressure</h3><canvas id="pressureChart"></canvas></div>
  <div class="criteria-chart"><h3>Under Length</h3><canvas id="lengthChart"></canvas></div>
  <div class="criteria-chart"><h3>Opens Loop</h3><canvas id="loopChart"></canvas></div>
</div>

<div class="table-container">
  <h3>Run History</h3>
  <table>
    <thead>
      <tr><th>Run</th><th>Status</th><th>Score</th><th>Voice</th><th>Jargon</th><th>CTA</th><th>Tone</th><th>Pressure</th><th>Length</th><th>Loop</th><th>Time</th></tr>
    </thead>
    <tbody id="run-table"></tbody>
  </table>
</div>

<div class="prompt-container">
  <h3>Current Best Copy Instructions</h3>
  <div class="prompt-text" id="best-prompt">Loading...</div>
</div>

<script>
const BLUE = '#2980b9';
const BLUE_LIGHT = 'rgba(41, 128, 185, 0.15)';
const GREEN = '#27ae60';

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#8a8580' } },
    y: { grid: { color: '#f0efed' }, ticks: { font: { size: 10 }, color: '#8a8580' } }
  }
};

const COLORS = ['#8e44ad','#2980b9','#27ae60','#d35400','#c0392b','#16a085','#f39c12'];
let charts = {};

function createChart(id, label, maxY, colorIdx) {
  const c = COLORS[colorIdx % COLORS.length];
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label, data: [], borderColor: c, backgroundColor: c+'22', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: [], pointBorderColor: c, pointBorderWidth: 1.5 }] },
    options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: maxY, ticks: { ...chartDefaults.scales.y.ticks, stepSize: maxY <= 10 ? 2 : 10 } } } }
  });
}

function initCharts() {
  charts.main = createChart('mainChart', 'Score', 70, 1);
  charts.voice = createChart('voiceChart', 'Voice', 10, 0);
  charts.jargon = createChart('jargonChart', 'Jargon', 10, 1);
  charts.cta = createChart('ctaChart', 'CTA', 10, 2);
  charts.tone = createChart('toneChart', 'Tone', 10, 3);
  charts.pressure = createChart('pressureChart', 'Pressure', 10, 4);
  charts.length = createChart('lengthChart', 'Length', 10, 5);
  charts.loop = createChart('loopChart', 'Loop', 10, 6);
}

function updateChart(chart, labels, data) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  let best = -1;
  chart.data.datasets[0].pointBackgroundColor = data.map(v => { if (v > best) { best = v; return chart.data.datasets[0].borderColor; } return '#c4c0bb'; });
  chart.update('none');
}

async function refresh() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (!data.runs || !data.runs.length) return;

    const runs = data.runs;
    const labels = runs.map(r => r.run);
    const scores = runs.map(r => r.score);
    const baseline = scores[0];
    const best = Math.max(...scores);

    document.getElementById('stat-best').textContent = best + '/70';
    document.getElementById('stat-baseline').textContent = baseline + '/70';
    const imp = baseline > 0 ? ((best - baseline) / baseline * 100).toFixed(1) : '--';
    const el = document.getElementById('stat-improvement');
    el.textContent = imp === '--' ? '--' : (imp > 0 ? '+' : '') + imp + '%';
    el.className = 'stat-value ' + (imp > 0 ? 'green' : 'neutral');

    let kept = 0, rb = -1;
    scores.forEach(s => { if (s > rb) { kept++; rb = s; } });
    document.getElementById('stat-runs').textContent = runs.length + ' / ' + kept;

    updateChart(charts.main, labels, scores);
    updateChart(charts.voice, labels, runs.map(r => r.criteria?.voice_authority ?? 0));
    updateChart(charts.jargon, labels, runs.map(r => r.criteria?.no_jargon ?? 0));
    updateChart(charts.cta, labels, runs.map(r => r.criteria?.binary_cta ?? 0));
    updateChart(charts.tone, labels, runs.map(r => r.criteria?.human_tone ?? 0));
    updateChart(charts.pressure, labels, runs.map(r => r.criteria?.no_pressure ?? 0));
    updateChart(charts.length, labels, runs.map(r => r.criteria?.under_length ?? 0));
    updateChart(charts.loop, labels, runs.map(r => r.criteria?.opens_loop ?? 0));

    // Table
    let rb2 = -1;
    const statuses = scores.map(s => { if (s > rb2) { rb2 = s; return 'keep'; } return 'discard'; });
    const tbody = document.getElementById('run-table');
    tbody.innerHTML = runs.map((r, i) => {
      const st = statuses[i];
      const t = r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      const c = r.criteria || {};
      return `<tr><td>${r.run}</td><td class="status-${st}">${st}</td><td><strong>${r.score}/70</strong></td><td>${c.voice_authority??'?'}</td><td>${c.no_jargon??'?'}</td><td>${c.binary_cta??'?'}</td><td>${c.human_tone??'?'}</td><td>${c.no_pressure??'?'}</td><td>${c.under_length??'?'}</td><td>${c.opens_loop??'?'}</td><td>${t}</td></tr>`;
    }).reverse().join('');

    if (data.best_instructions) document.getElementById('best-prompt').textContent = data.best_instructions;
    const last = runs[runs.length-1];
    document.getElementById('subtitle').textContent = `Recall copy optimization -- ${runs.length} runs -- last: ${last?.timestamp ? new Date(last.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}`;
  } catch(e) { console.error(e); }
}

initCharts();
refresh();
setInterval(refresh, 15000);
</script>
</body>
</html>"""


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML.encode())

        elif parsed.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            runs = []
            if RESULTS_FILE.exists():
                for line in RESULTS_FILE.read_text().strip().split("\n"):
                    if line.strip():
                        try:
                            runs.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass

            best_instructions = ""
            if BEST_INSTRUCTIONS_FILE.exists():
                best_instructions = BEST_INSTRUCTIONS_FILE.read_text().strip()

            data = {"runs": runs, "best_instructions": best_instructions}
            self.wfile.write(json.dumps(data).encode())

        elif parsed.path.startswith("/api/variants/"):
            # Serve variant details for a specific run
            run_num = parsed.path.split("/")[-1]
            run_dir = VARIANTS_DIR / f"run_{int(run_num):03d}"
            variants = []
            if run_dir.exists():
                for f in sorted(run_dir.glob("variant_*.json")):
                    try:
                        variants.append(json.loads(f.read_text()))
                    except:
                        pass
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(variants).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Dentiflow SMS Autoresearch Dashboard")
    parser.add_argument("--port", type=int, default=8502)
    args = parser.parse_args()

    server = HTTPServer(("0.0.0.0", args.port), DashboardHandler)
    print(f"Dashboard running at http://localhost:{args.port}")
    print(f"Reading from: {RESULTS_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutdown.")


if __name__ == "__main__":
    main()
