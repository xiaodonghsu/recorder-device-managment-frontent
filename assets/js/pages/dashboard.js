/* ==========================================================================
   概览页：资产总量、生命周期分布、领用排行、事件动态
   ========================================================================== */
SS.pages.dashboard = {
  title: '概览',
  desc: '设备资产、领用绑定与操作事件的整体视图',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="2" width="5.5" height="5.5" rx="1"/><rect x="2" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>',

  render: function (container) {
    const wrap = UI.el('div');
    container.appendChild(wrap);

    wrap.appendChild(UI.el('div', { class: 'loading' }, [
      UI.el('span', { class: 'spinner' }), UI.el('span', { text: '正在汇总资产数据…' })
    ]));

    SS.api.tables.overview()
      .then(function (stats) {
        UI.clear(wrap);
        wrap.appendChild(buildStatCards(stats));
        wrap.appendChild(buildMainGrid(stats));
      })
      .catch(function (err) {
        UI.clear(wrap);
        wrap.appendChild(UI.el('div', { class: 'card' }, [
          UI.el('div', { class: 'card-body' }, [
            UI.el('div', { class: 'notice is-warn' }, [
              UI.el('span', { class: 'notice-icon', text: '!' }),
              UI.el('div', { text: '概览数据加载失败：' + ((err && err.message) || err) })
            ])
          ])
        ]));
      });
  }
};

/* ------------------------------------------------------------------ 指标卡 */
function buildStatCards(stats) {
  const grid = UI.el('div', { class: 'stat-grid' });

  const card = function (label, value, unit, foot, tone) {
    return UI.el('div', { class: 'stat' + (tone ? ' is-' + tone : '') }, [
      UI.el('div', { class: 'stat-label', text: label }),
      UI.el('div', { class: 'stat-value' }, [
        document.createTextNode(String(value)),
        unit ? UI.el('small', { text: unit }) : null
      ]),
      foot ? UI.el('div', { class: 'stat-foot', text: foot }) : null
    ]);
  };

  const lifecycle = stats.lifecycle || {};
  grid.appendChild(card('设备总数', stats.total_devices, '台',
    '在库 ' + (stats.idle_devices || 0) + ' · 领用中 ' + (stats.assigned_devices || 0)));
  grid.appendChild(card('领用中设备', stats.assigned_devices, '台',
    '涉及员工 ' + (stats.unassigned_employee_count || 0) + ' 人', 'info'));
  grid.appendChild(card('APP 绑定中', stats.bound_devices, '台',
    '历史绑定 ' + (stats.total_bindings || 0) + ' 条', 'purple'));
  grid.appendChild(card('在线设备', stats.online_devices, '台',
    '离线 ' + (stats.offline_devices || 0) + ' 台' +
    (stats.avg_battery !== null && stats.avg_battery !== undefined
      ? ' · 平均电量 ' + stats.avg_battery + '%' : ''),
    stats.online_devices > 0 ? 'ok' : 'muted'));
  grid.appendChild(card('有效凭证', stats.active_credentials, '个',
    '凭证版本累计 ' + (stats.total_credentials || 0) + ' 个', 'ok'));
  grid.appendChild(card('今日事件', stats.events_today, '条',
    '近 7 日 ' + (stats.events_7d || 0) + ' 条', 'warn'));

  return grid;
}

/* ------------------------------------------------------------------ 主栅格 */
function buildMainGrid(stats) {
  const grid = UI.el('div', { class: 'grid-2' });

  /* 生命周期分布 */
  const lifecycle = stats.lifecycle || {};
  const labels = SS.config.lifecycle;
  const total = stats.total_devices || 0;
  const lifeBody = UI.el('div', { class: 'card-body' });
  if (!total) {
    lifeBody.appendChild(UI.el('p', { class: 'muted', text: '尚未登记任何设备。' }));
  } else {
    Object.keys(labels).forEach(function (key) {
      const count = lifecycle[key] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      lifeBody.appendChild(UI.el('div', { class: 'bar-row' }, [
        UI.el('span', { class: 'bar-label', text: labels[key].label }),
        UI.el('span', { class: 'bar-track' }, [
          UI.el('span', { class: 'bar-fill', style: 'width:' + percent + '%;background:' + toneColor(labels[key].tone) })
        ]),
        UI.el('span', { class: 'bar-value', text: count + ' / ' + percent + '%' })
      ]));
    });
  }

  grid.appendChild(UI.el('div', { class: 'card' }, [
    UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: '生命周期分布' }),
        UI.el('p', { text: '设备档案当前状态构成' })
      ])
    ]),
    lifeBody
  ]));

  /* 领用排行 */
  const assigneeBody = UI.el('div', { class: 'card-body' });
  const top = stats.top_assignees || [];
  if (!top.length) {
    assigneeBody.appendChild(UI.el('p', { class: 'muted', text: '当前没有员工领用设备。' }));
  } else {
    const list = UI.el('div', { class: 'row-list' });
    top.forEach(function (item, index) {
      list.appendChild(UI.el('div', { class: 'row-item' }, [
        UI.el('span', { class: 'row-rank', text: String(index + 1) }),
        UI.el('div', { class: 'row-main' }, [
          UI.el('strong', { class: 'truncate', text: item.user_id })
        ]),
        UI.el('span', { class: 'badge badge-info', text: item.device_count + ' 台' })
      ]));
    });
    assigneeBody.appendChild(list);
  }

  grid.appendChild(UI.el('div', { class: 'card' }, [
    UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: '领用设备数排行' }),
        UI.el('p', { text: '当前领用中的员工（TOP 10）' })
      ])
    ]),
    assigneeBody
  ]));

  /* 事件类型分布 */
  const eventBody = UI.el('div', { class: 'card-body' });
  const types = stats.event_types || {};
  const typeKeys = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 8);
  if (!typeKeys.length) {
    eventBody.appendChild(UI.el('p', { class: 'muted', text: '暂无事件记录。' }));
  } else {
    const max = typeKeys.reduce(function (acc, key) { return Math.max(acc, types[key]); }, 0);
    typeKeys.forEach(function (key) {
      const meta = SS.config.eventTypes[key] || { label: key, tone: 'muted' };
      const percent = max ? Math.round((types[key] / max) * 100) : 0;
      eventBody.appendChild(UI.el('div', { class: 'bar-row' }, [
        UI.el('span', { class: 'bar-label', text: meta.label }),
        UI.el('span', { class: 'bar-track' }, [
          UI.el('span', { class: 'bar-fill', style: 'width:' + percent + '%;background:' + toneColor(meta.tone) })
        ]),
        UI.el('span', { class: 'bar-value', text: String(types[key]) })
      ]));
    });
  }

  grid.appendChild(UI.el('div', { class: 'card' }, [
    UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: '事件类型分布' }),
        UI.el('p', { text: '全量生命周期事件累计计数' })
      ])
    ]),
    eventBody
  ]));

  /* 快捷入口 */
  const quickBody = UI.el('div', { class: 'card-body' });
  const quick = UI.el('div', { class: 'chip-row' });
  [
    { route: 'devices', label: '设备管理' },
    { route: 'assignments', label: '领用记录' },
    { route: 'bindings', label: 'APP 绑定' },
    { route: 'credentials', label: '设备凭证' },
    { route: 'statuses', label: '设备状态' },
    { route: 'events', label: '事件日志' }
  ].forEach(function (item) {
    quick.appendChild(UI.el('button', {
      class: 'chip', type: 'button', text: item.label,
      onclick: function () { SS.app.navigate('#/' + item.route); }
    }));
  });
  quickBody.appendChild(quick);
  quickBody.appendChild(UI.el('p', {
    class: 'field-tip', style: 'margin-top:14px',
    text: '数据范围由服务端依据访问令牌推导，跨企业数据一律不可见。'
  }));

  grid.appendChild(UI.el('div', { class: 'card' }, [
    UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: '快捷入口' }),
        UI.el('p', { text: '按表格进入管理视图' })
      ])
    ]),
    quickBody
  ]));

  return grid;
}

/** 语义色 → 十六进制，用于分布条着色 */
function toneColor(tone) {
  switch (tone) {
    case 'ok': return '#157F5B';
    case 'warn': return '#A85B06';
    case 'err': return '#BE3A2B';
    case 'info': return '#2E6BD6';
    case 'purple': return '#6D43B8';
    default: return '#8A99AC';
  }
}
