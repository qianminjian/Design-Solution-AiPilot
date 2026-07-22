(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var success = style.getPropertyValue('--success').trim();
  var danger = style.getPropertyValue('--danger').trim();

  function initTimeline() {
    var dom = document.getElementById('chart-timeline');
    if (!dom || typeof echarts === 'undefined') return;
    var chart = echarts.init(dom);

    // y 轴自上而下：R1 → R4（inverse 使 index 0 在顶部）
    var categories = ['R1 业务决策冻结', 'R2 技术基线实例化', 'R3 测试物化', 'R4 Gate 准入'];
    var rounds = [
      {
        cat: 0, name: 'R1 业务决策冻结', start: 1, end: 5, color: danger,
        weeks: 'W1 – W4', duration: '4 周',
        detail: 'OD-01~OD-06 六项业务决策冻结（目标地区、AI 供应商、部署形态等）'
      },
      {
        cat: 1, name: 'R2 技术基线实例化', start: 3, end: 9, color: accent,
        weeks: 'W3 – W8', duration: '6 周',
        detail: 'Support Matrix 冻结 · 求解器资格 · Contract Catalog · AI Provider · DeploymentProfile'
      },
      {
        cat: 2, name: 'R3 测试物化', start: 5, end: 11, color: accent2,
        weeks: 'W5 – W10', duration: '6 周',
        detail: 'GoldenDataset · VerificationItem · TestCaseVersion · TestRun · AI TEVV'
      },
      {
        cat: 3, name: 'R4 Gate 准入', start: 9, end: 13, color: success,
        weeks: 'W9 – W12', duration: '4 周',
        detail: 'Start Gate 6 项检查 · 参数校准 · Go/No-Go 评审'
      }
    ];

    var option = {
      tooltip: {
        trigger: 'item',
        enterable: false,
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: rule,
        borderWidth: 1,
        textStyle: { color: ink, fontSize: 12 },
        extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:6px;padding:10px 14px;',
        formatter: function (params) {
          if (params.componentType !== 'series' || !params.data || !params.data.name) return '';
          var d = params.data;
          var html = '<strong style="font-size:13px;color:' + d.value[3] + '">' + d.name + '</strong><br/>';
          html += '<span style="color:' + muted + '">周期：</span>' + d.weeks + '（' + d.duration + '）<br/>';
          html += '<span style="color:' + muted + '">关键交付：</span>' + d.detail;
          return html;
        }
      },
      grid: { left: 140, right: 36, top: 24, bottom: 38 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 13,
        interval: 1,
        axisLabel: {
          formatter: function (v) { return v === 0 ? '' : 'W' + v; },
          color: muted,
          fontSize: 11
        },
        splitLine: { lineStyle: { color: rule, type: 'dashed', opacity: 0.5 } },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: { color: ink, fontWeight: 600, fontSize: 12 },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      series: [
        {
          name: 'rounds',
          type: 'custom',
          renderItem: function (params, api) {
            var categoryIndex = api.value(0);
            var start = api.coord([api.value(1), categoryIndex]);
            var end = api.coord([api.value(2), categoryIndex]);
            var height = api.size([0, 1])[1] * 0.48;
            var color = api.value(3);
            var label = api.value(4);
            var barWidth = end[0] - start[0];

            var rectShape = echarts.graphic.clipRectByRect(
              { x: start[0], y: start[1] - height / 2, width: barWidth, height: height },
              { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height }
            );

            if (!rectShape) return;

            return {
              type: 'group',
              children: [
                {
                  type: 'rect',
                  transition: ['shape'],
                  shape: rectShape,
                  style: {
                    fill: color,
                    opacity: 0.88,
                    stroke: color,
                    lineWidth: 0
                  }
                },
                {
                  type: 'text',
                  style: {
                    x: start[0] + barWidth / 2,
                    y: start[1],
                    text: label,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    fontSize: 10,
                    fill: '#ffffff',
                    fontWeight: 600,
                    overflow: 'truncate',
                    width: barWidth - 8
                  }
                }
              ]
            };
          },
          encode: { x: [1, 2], y: 0 },
          data: rounds.map(function (r) {
            return {
              name: r.name,
              value: [r.cat, r.start, r.end, r.color, r.weeks],
              start: r.start,
              end: r.end,
              weeks: r.weeks,
              duration: r.duration,
              detail: r.detail
            };
          })
        },
        {
          name: 'milestones',
          type: 'scatter',
          data: [[0, 0]],
          symbolSize: 0,
          silent: true,
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: ink, type: 'dashed', width: 1, opacity: 0.3 },
            label: {
              color: ink,
              fontSize: 10,
              fontWeight: 600,
              position: 'insideEndTop',
              distance: [0, -4]
            },
            data: [
              { xAxis: 5, name: 'R1冻结' },
              { xAxis: 9, name: 'R2完成' },
              { xAxis: 11, name: 'R3完成' },
              { xAxis: 13, name: 'Gate准入' }
            ]
          }
        }
      ]
    };

    chart.setOption(option);
    window.addEventListener('resize', function () { chart.resize(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
  } else {
    initTimeline();
  }
})();
