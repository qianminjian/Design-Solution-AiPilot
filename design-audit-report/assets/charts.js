/* design-audit-report — charts.js
 * Renders three ECharts visualizations for the audit report:
 *   1) chart-completeness       — D01–D46 section completeness (grouped bar)
 *   2) chart-blocker-matrix     — 10 blockers severity scatter (impact × difficulty)
 *   3) chart-iteration-timeline — 4-round iteration Gantt timeline
 * All colors are sourced from CSS variables declared in the report HTML.
 */
(function () {
  'use strict';

  // ---- Read CSS variables for color consistency ---------------------------
  var rootStyle = getComputedStyle(document.documentElement);
  var accent = rootStyle.getPropertyValue('--accent').trim() || '#1e40af';
  var accent2 = rootStyle.getPropertyValue('--accent2').trim() || '#d97706';
  var ink = rootStyle.getPropertyValue('--ink').trim() || '#1a2332';
  var muted = rootStyle.getPropertyValue('--muted').trim() || '#5a6478';
  var rule = rootStyle.getPropertyValue('--rule').trim() || '#e1e5ec';
  var danger = rootStyle.getPropertyValue('--danger').trim() || '#b91c1c';
  var success = rootStyle.getPropertyValue('--success').trim() || '#15803d';
  var warn = rootStyle.getPropertyValue('--warn').trim() || '#b45309';
  var bg2 = rootStyle.getPropertyValue('--bg2').trim() || '#ffffff';

  // Guard against missing ECharts (script load order)
  if (typeof window.echarts === 'undefined') {
    console.warn('[charts.js] echarts not loaded; charts will not render.');
    return;
  }

  // ---- Common typography & theme ------------------------------------------
  var fontFamily =
    "'NotoSansSC','PingFang SC','Microsoft YaHei',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  var baseTextStyle = { color: ink, fontFamily: fontFamily };
  var mutedTextStyle = { color: muted, fontFamily: fontFamily };

  function axisLine(show) {
    return { show: true, lineStyle: { color: rule } };
  }
  function splitLine(show) {
    return {
      show: show,
      lineStyle: { color: rule, type: 'dashed', opacity: 0.6 }
    };
  }

  // =====================================================================
  // Chart 1: D01–D46 Completeness Distribution
  // =====================================================================
  var chart1El = document.getElementById('chart-completeness');
  if (chart1El) {
    var chart1 = echarts.init(chart1El);

    var sectionGroups = [
      'D01–D08\n产品基线',
      'D09–D17\n设计专业',
      'D18–D23\n联邦规范',
      'D24–D28\nAI能力',
      'D29–D33\n桌面连接器',
      'D34–D38\n数据接口',
      'D39–D41\n安全审计',
      'D42–D44\n运营部署',
      'D45–D46\n测试追踪'
    ];

    // All four quality dimensions verified at 100% per the audit
    var seriesData = {
      completeness: [100, 100, 100, 100, 100, 100, 100, 100, 100],
      ears: [100, 100, 100, 100, 100, 100, 100, 100, 100],
      api: [100, 100, 100, 100, 100, 100, 100, 100, 100],
      checklist: [100, 100, 100, 100, 100, 100, 100, 100, 100]
    };

    chart1.setOption({
      backgroundColor: 'transparent',
      color: [accent, accent2, success, warn],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: bg2,
        borderColor: rule,
        borderWidth: 1,
        textStyle: baseTextStyle,
        formatter: function (params) {
          var html =
            '<div style="font-weight:600;margin-bottom:6px;color:' +
            ink +
            '">' +
            params[0].name.replace('\n', ' ') +
            '</div>';
          params.forEach(function (p) {
            html +=
              '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">' +
              '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' +
              p.color +
              '"></span>' +
              '<span style="color:' +
              muted +
              ';font-size:12px;">' +
              p.seriesName +
              '</span>' +
              '<span style="margin-left:auto;font-weight:600;color:' +
              success +
              '">' +
              p.value +
              '%</span></div>';
          });
          return html;
        }
      },
      legend: {
        data: ['完整性', 'EARS 覆盖', '接口/数据模型', '完成检查'],
        top: 4,
        textStyle: baseTextStyle,
        itemGap: 18,
        itemWidth: 14,
        itemHeight: 10
      },
      grid: { left: 50, right: 24, top: 56, bottom: 70 },
      xAxis: {
        type: 'category',
        data: sectionGroups,
        axisLine: axisLine(true),
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontFamily: fontFamily,
          fontSize: 11,
          lineHeight: 15,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: Object.assign({ formatter: '{value}%', fontSize: 11 }, mutedTextStyle),
        splitLine: splitLine(true)
      },
      series: [
        {
          name: '完整性',
          type: 'bar',
          barWidth: '12%',
          barGap: '10%',
          data: seriesData.completeness,
          itemStyle: { borderRadius: [3, 3, 0, 0] },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: success, type: 'dashed', opacity: 0.5 },
            data: [{ yAxis: 100 }],
            label: { show: false }
          }
        },
        {
          name: 'EARS 覆盖',
          type: 'bar',
          barWidth: '12%',
          data: seriesData.ears,
          itemStyle: { borderRadius: [3, 3, 0, 0] }
        },
        {
          name: '接口/数据模型',
          type: 'bar',
          barWidth: '12%',
          data: seriesData.api,
          itemStyle: { borderRadius: [3, 3, 0, 0] }
        },
        {
          name: '完成检查',
          type: 'bar',
          barWidth: '12%',
          data: seriesData.checklist,
          itemStyle: { borderRadius: [3, 3, 0, 0] }
        }
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          bottom: 18,
          style: {
            text: '46 个章节全部达成 100% 完整性 · 7/9 设计质量指标完全通过 · 2/9 部分通过（仅实例级测试物化问题）',
            fill: muted,
            font: '11px ' + fontFamily
          }
        }
      ]
    });

    window.addEventListener('resize', function () { chart1.resize(); });
  }

  // =====================================================================
  // Chart 2: Blocker Severity Matrix (Impact × Difficulty scatter)
  // =====================================================================
  var chart2El = document.getElementById('chart-blocker-matrix');
  if (chart2El) {
    var chart2 = echarts.init(chart2El);

    // Blocker data: [difficulty, impact, id, desc, priority]
    // difficulty (1-10): harder = more engineering/external dependency
    // impact (1-10): higher = more direct block to development start
    // Note: B-09 and B-10 are intentionally separated to avoid coordinate overlap.
    var blockers = [
      { id: 'B-01', desc: 'OD-01–06 业务决策未冻结', diff: 7, impact: 9, pri: 'P0' },
      { id: 'B-02', desc: '外部 AI 工具 ManualHandoff', diff: 8, impact: 7, pri: 'P0' },
      { id: 'B-03', desc: 'Support Matrix 未冻结', diff: 5, impact: 8, pri: 'P0' },
      { id: 'B-04', desc: 'Test 物化未实例化', diff: 6, impact: 8, pri: 'P0' },
      { id: 'B-05', desc: '商用求解器许可未确认', diff: 8, impact: 6, pri: 'P0' },
      { id: 'B-06', desc: '规范 GoldenDataset 未建立', diff: 7, impact: 7, pri: 'P0' },
      { id: 'B-07', desc: 'Pre-Impl Gate 6 项未满足', diff: 6, impact: 10, pri: 'P0' },
      { id: 'B-08', desc: '阈值/SLO 初始设计值', diff: 4, impact: 4, pri: 'P1' },
      { id: 'B-09', desc: '多工具交换损失未金样验证', diff: 5, impact: 6, pri: 'P1' },
      { id: 'B-10', desc: 'Deployment Profile 不预设', diff: 6, impact: 4, pri: 'P1' }
    ];

    var p0Data = blockers
      .filter(function (b) { return b.pri === 'P0'; })
      .map(function (b) {
        return {
          name: b.id,
          value: [b.diff, b.impact, b.desc, b.pri],
          symbolSize: 22 + b.impact * 2.2,
          itemStyle: {
            color: danger,
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: 'rgba(185,28,28,0.25)'
          },
          label: {
            show: true,
            position: 'top',
            formatter: b.id,
            color: danger,
            fontWeight: 700,
            fontSize: 12,
            fontFamily: fontFamily
          }
        };
      });

    var p1Data = blockers
      .filter(function (b) { return b.pri === 'P1'; })
      .map(function (b) {
        return {
          name: b.id,
          value: [b.diff, b.impact, b.desc, b.pri],
          symbolSize: 18 + b.impact * 2,
          itemStyle: {
            color: warn,
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: 'rgba(180,83,9,0.22)'
          },
          label: {
            show: true,
            position: 'top',
            formatter: b.id,
            color: warn,
            fontWeight: 700,
            fontSize: 12,
            fontFamily: fontFamily
          }
        };
      });

    chart2.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: bg2,
        borderColor: rule,
        borderWidth: 1,
        textStyle: baseTextStyle,
        formatter: function (p) {
          var v = p.value;
          return (
            '<div style="font-weight:700;margin-bottom:4px;color:' +
            (v[3] === 'P0' ? danger : warn) +
            '">' +
            p.name +
            ' <span style="font-size:11px;color:' +
            muted +
            ';font-weight:400">(' +
            v[3] +
            ')</span></div>' +
            '<div style="color:' +
            ink +
            ';margin-bottom:4px;">' +
            v[2] +
            '</div>' +
            '<div style="color:' +
            muted +
            ';font-size:12px;">解决难度: <b style="color:' +
            ink +
            '">' +
            v[0] +
            '/10</b> &nbsp;·&nbsp; 影响度: <b style="color:' +
            ink +
            '">' +
            v[1] +
            '/10</b></div>'
          );
        }
      },
      legend: {
        data: ['P0 · 必须解决 (7 项)', 'P1 · 可后置 (3 项)'],
        top: 4,
        textStyle: baseTextStyle,
        itemGap: 18
      },
      grid: { left: 60, right: 32, top: 56, bottom: 70 },
      xAxis: {
        type: 'value',
        name: '解决难度 →',
        nameLocation: 'middle',
        nameGap: 38,
        nameTextStyle: Object.assign({ fontSize: 12, fontWeight: 600 }, baseTextStyle),
        min: 0,
        max: 10,
        interval: 2,
        axisLine: axisLine(true),
        axisTick: { show: false },
        axisLabel: Object.assign({ fontSize: 11 }, mutedTextStyle),
        splitLine: splitLine(true)
      },
      yAxis: {
        type: 'value',
        name: '开发启动影响度 →',
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: Object.assign({ fontSize: 12, fontWeight: 600 }, baseTextStyle),
        min: 0,
        max: 10,
        interval: 2,
        axisLine: axisLine(true),
        axisTick: { show: false },
        axisLabel: Object.assign({ fontSize: 11 }, mutedTextStyle),
        splitLine: splitLine(true)
      },
      series: [
        {
          name: 'P0 · 必须解决 (7 项)',
          type: 'scatter',
          color: danger,
          data: p0Data,
          z: 10
        },
        {
          name: 'P1 · 可后置 (3 项)',
          type: 'scatter',
          color: warn,
          data: p1Data,
          z: 9
        }
      ],
      graphic: [
        // Quadrant labels
        {
          type: 'text',
          right: 80,
          top: 70,
          style: {
            text: '高影响 · 高难度\n业务/采购决策',
            fill: danger,
            opacity: 0.7,
            font: '11px ' + fontFamily,
            textAlign: 'right'
          }
        },
        {
          type: 'text',
          left: 70,
          top: 70,
          style: {
            text: '高影响 · 低难度\n工程化优先',
            fill: success,
            opacity: 0.75,
            font: '11px ' + fontFamily
          }
        },
        {
          type: 'text',
          right: 80,
          bottom: 80,
          style: {
            text: '低影响 · 高难度\n后置或并行',
            fill: muted,
            opacity: 0.7,
            font: '11px ' + fontFamily,
            textAlign: 'right'
          }
        },
        {
          type: 'text',
          left: 70,
          bottom: 80,
          style: {
            text: '低影响 · 低难度\n快速清账',
            fill: accent2,
            opacity: 0.75,
            font: '11px ' + fontFamily
          }
        }
      ]
    });

    window.addEventListener('resize', function () { chart2.resize(); });
  }

  // =====================================================================
  // Chart 3: Iteration Timeline (4 rounds Gantt)
  // =====================================================================
  var chart3El = document.getElementById('chart-iteration-timeline');
  if (chart3El) {
    var chart3 = echarts.init(chart3El);

    // Each task: { name, round, startWeek, endWeek, color, track }
    var tasks = [
      // R1: Business decisions (W1-W4)
      { name: 'OD-01 地区/规范/语言', round: 'R1', track: 1, start: 1, end: 4 },
      { name: 'OD-02 建筑类型', round: 'R1', track: 2, start: 1, end: 3 },
      { name: 'OD-03 专业深度', round: 'R1', track: 3, start: 2, end: 4 },
      { name: 'OD-04 工具版本许可', round: 'R1', track: 4, start: 1, end: 3 },
      { name: 'OD-05 外部 AI 授权', round: 'R1', track: 5, start: 1, end: 4 },
      { name: 'OD-06 部署画像', round: 'R1', track: 6, start: 2, end: 4 },

      // R2: Technical baseline (W3-W8)
      { name: 'Support Matrix 冻结', round: 'R2', track: 7, start: 3, end: 6 },
      { name: '商用求解器资质', round: 'R2', track: 8, start: 3, end: 7 },
      { name: '交换损失金样', round: 'R2', track: 9, start: 4, end: 7 },
      { name: 'Contract Catalog 分配', round: 'R2', track: 10, start: 4, end: 6 },
      { name: 'AI Provider 资质', round: 'R2', track: 11, start: 4, end: 8 },

      // R3: Test materialization (W5-W10)
      { name: 'GoldenDataset 建立', round: 'R3', track: 12, start: 5, end: 8 },
      { name: 'VerificationItem 逐条', round: 'R3', track: 13, start: 6, end: 10 },
      { name: 'TestCaseVersion 物化', round: 'R3', track: 14, start: 7, end: 10 },
      { name: 'TestRun 环境搭建', round: 'R3', track: 15, start: 6, end: 9 },
      { name: 'AI TEVV 物化', round: 'R3', track: 16, start: 7, end: 10 },

      // R4: Gate admission (W9-W12)
      { name: 'Start Gate 6 项核对', round: 'R4', track: 17, start: 9, end: 11 },
      { name: '参数校准计划', round: 'R4', track: 18, start: 9, end: 11 },
      { name: 'Go/No-Go 评审', round: 'R4', track: 19, start: 11, end: 12 }
    ];

    var roundColors = {
      R1: accent2,
      R2: accent,
      R3: success,
      R4: danger
    };

    var yCategories = tasks.map(function (t) { return t.name; }).reverse();

    var seriesData = tasks.map(function (t, idx) {
      var yIndex = tasks.length - 1 - idx;
      return {
        name: t.round,
        value: [t.start, t.end, yIndex, t.round, t.name],
        itemStyle: {
          color: roundColors[t.round],
          borderColor: '#fff',
          borderWidth: 1.5,
          borderRadius: 3,
          shadowBlur: 4,
          shadowColor: 'rgba(30,64,175,0.15)'
        }
      };
    });

    chart3.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: bg2,
        borderColor: rule,
        borderWidth: 1,
        textStyle: baseTextStyle,
        formatter: function (p) {
          var v = p.value;
          return (
            '<div style="font-weight:700;color:' +
            roundColors[v[3]] +
            '">' +
            v[4] +
            '</div>' +
            '<div style="color:' +
            muted +
            ';font-size:12px;margin-top:2px;">' +
            v[3] +
            ' · Week ' +
            v[0] +
            '–' +
            v[1] +
            ' (' +
            (v[1] - v[0] + 1) +
            ' 周)</div>'
          );
        }
      },
      legend: {
        data: [
          { name: 'R1 业务决策', icon: 'roundRect' },
          { name: 'R2 技术基线', icon: 'roundRect' },
          { name: 'R3 测试物化', icon: 'roundRect' },
          { name: 'R4 Gate 准入', icon: 'roundRect' }
        ],
        top: 4,
        textStyle: baseTextStyle,
        itemGap: 14,
        itemWidth: 14,
        itemHeight: 10
      },
      grid: { left: 170, right: 30, top: 56, bottom: 60 },
      xAxis: {
        type: 'value',
        name: '周 (Week)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: Object.assign({ fontSize: 12, fontWeight: 600 }, baseTextStyle),
        min: 1,
        max: 12,
        interval: 1,
        axisLine: axisLine(true),
        axisTick: { show: false },
        axisLabel: Object.assign({ fontSize: 11, formatter: 'W{value}' }, mutedTextStyle),
        splitLine: splitLine(true)
      },
      yAxis: {
        type: 'category',
        data: yCategories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: Object.assign({ fontSize: 11 }, baseTextStyle),
        splitLine: splitLine(false)
      },
      series: [
        {
          name: 'R1 业务决策',
          type: 'custom',
          color: roundColors.R1,
          renderItem: renderGanttItem,
          encode: { x: [0, 1], y: 2 },
          data: seriesData.filter(function (d) { return d.value[3] === 'R1'; }),
          z: 5
        },
        {
          name: 'R2 技术基线',
          type: 'custom',
          color: roundColors.R2,
          renderItem: renderGanttItem,
          encode: { x: [0, 1], y: 2 },
          data: seriesData.filter(function (d) { return d.value[3] === 'R2'; }),
          z: 5
        },
        {
          name: 'R3 测试物化',
          type: 'custom',
          color: roundColors.R3,
          renderItem: renderGanttItem,
          encode: { x: [0, 1], y: 2 },
          data: seriesData.filter(function (d) { return d.value[3] === 'R3'; }),
          z: 5
        },
        {
          name: 'R4 Gate 准入',
          type: 'custom',
          color: roundColors.R4,
          renderItem: renderGanttItem,
          encode: { x: [0, 1], y: 2 },
          data: seriesData.filter(function (d) { return d.value[3] === 'R4'; }),
          z: 5
        }
      ],
      graphic: [
        // Round band labels on left
        {
          type: 'text',
          left: 8,
          top: 80,
          style: {
            text: 'R1\nW1–W4',
            fill: accent2,
            font: 'bold 11px ' + fontFamily,
            lineHeight: 14
          }
        },
        {
          type: 'text',
          left: 8,
          top: 200,
          style: {
            text: 'R2\nW3–W8',
            fill: accent,
            font: 'bold 11px ' + fontFamily,
            lineHeight: 14
          }
        },
        {
          type: 'text',
          left: 8,
          top: 330,
          style: {
            text: 'R3\nW5–W10',
            fill: success,
            font: 'bold 11px ' + fontFamily,
            lineHeight: 14
          }
        },
        {
          type: 'text',
          left: 8,
          top: 460,
          style: {
            text: 'R4\nW9–W12',
            fill: danger,
            font: 'bold 11px ' + fontFamily,
            lineHeight: 14
          }
        }
      ]
    });

    // Custom rendering for Gantt bars
    function renderGanttItem(params, api) {
      var start = api.value(0);
      var end = api.value(1);
      var yIndex = api.value(2);
      var round = api.value(3);

      var startPoint = api.coord([start, yIndex]);
      var endPoint = api.coord([end, yIndex]);

      var barHeight = api.size([0, 1])[1] * 0.55;
      var x = startPoint[0];
      var y = startPoint[1] - barHeight / 2;
      var width = endPoint[0] - startPoint[0];

      var color = roundColors[round];

      var rectShape = {
        type: 'rect',
        shape: {
          x: x,
          y: y,
          width: Math.max(width, 2),
          height: barHeight,
          r: 3
        },
        style: {
          fill: color,
          stroke: '#fff',
          lineWidth: 1.5
        }
      };

      // Label inside bar if width is sufficient
      var labelShape = null;
      if (width > 28) {
        labelShape = {
          type: 'text',
          style: {
            text: 'W' + start + '–' + end,
            x: x + width / 2,
            y: y + barHeight / 2,
            fill: '#fff',
            font: 'bold 10px ' + fontFamily,
            textAlign: 'center',
            textVerticalAlign: 'middle'
          }
        };
      }

      return rectShape;
    }

    window.addEventListener('resize', function () { chart3.resize(); });
  }
})();
