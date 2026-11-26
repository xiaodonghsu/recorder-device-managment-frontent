/* ==========================================================================
   设备状态页：device_status 表
   电量、充电、录音、在线，以及 APP 实测的容量 / 固件 / 增益
   ========================================================================== */
SS.pages.statuses = {
  title: '设备状态',
  desc: 'device_status 表 · 每台设备的最新状态快照（含容量 / 固件 / 增益）',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5.5" width="10" height="6.5" rx="1.4"/><path d="M13.5 8.5v1M4.5 8.5h4"/></svg>',

  render: function (container) {
    const filters = { online: '', lifecycle_status: '', keyword: '' };

    // 字节数转人类可读单位；后端存的是原始 BIGINT，展示时才换算。
    function formatBytes(value) {
      if (value === null || value === undefined) return '—';
      const n = Number(value);
      if (!isFinite(n) || n < 0) return '—';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = n, i = 0;
      while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
      const text = i === 0 ? String(Math.round(size)) : size.toFixed(size >= 100 ? 0 : 1);
      return text + ' ' + units[i];
    }

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: 'SN / 型号',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const online = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部在线状态' }),
          UI.el('option', { value: 'true', text: '在线' }),
          UI.el('option', { value: 'false', text: '离线' })
        ]);
        const lifecycle = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部生命周期状态' })
        ].concat(Object.keys(SS.config.lifecycle).map(function (key) {
          return UI.el('option', { value: key, text: SS.config.lifecycle[key].label });
        })));

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.online = online.value;
          filters.lifecycle_status = lifecycle.value;
          controller.setFilters(filters);
        }
        function resetFilters() {
          keyword.value = ''; online.value = ''; lifecycle.value = '';
          applyFilters();
        }
        [online, lifecycle].forEach(function (node) {
          node.addEventListener('change', applyFilters);
        });

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '关键字' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '在线状态' }), online
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '生命周期' }), lifecycle
          ]),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', { class: 'btn btn-primary', type: 'button', text: '查询', onclick: applyFilters }),
            UI.el('button', { class: 'btn btn-ghost', type: 'button', text: '重置', onclick: resetFilters })
          ])
        ]);
      },

      fetch: function (page, pageSize, state) {
        const query = { page: page, page_size: pageSize };
        if (state.online) query.online = state.online;
        if (state.lifecycle_status) query.lifecycle_status = state.lifecycle_status;
        if (state.keyword) query.keyword = state.keyword;
        return SS.api.tables.statuses(query);
      },

      columns: [
        {
          key: 'device_sn', title: '设备 SN', width: '150px', className: 'mono strong',
          render: function (row) {
            return UI.el('button', {
              class: 'btn-link', type: 'button', text: row.device_sn,
              onclick: function () { SS.actions.openDeviceDrawer(row.device_id, function () { controller.reload(); }); }
            });
          }
        },
        { key: 'device_model', title: '型号' },
        {
          key: 'lifecycle_status', title: '生命周期', width: '96px',
          render: function (row) { return UI.dictBadge(SS.config.lifecycle, row.lifecycle_status); }
        },
        {
          key: 'online', title: '在线', width: '84px',
          render: function (row) {
            return row.online
              ? UI.el('span', { class: 'badge badge-ok' }, [UI.el('span', { class: 'dot dot-pulse' }), document.createTextNode('在线')])
              : UI.badge('离线', 'muted');
          }
        },
        {
          key: 'battery_level', title: '电量', width: '120px',
          render: function (row) {
            if (row.battery_level === null || row.battery_level === undefined) return null;
            const level = row.battery_level;
            const tone = level <= 20 ? 'err' : level <= 50 ? 'warn' : 'ok';
            const wrap = UI.el('div', { class: 'bar-row', style: 'margin:0' });
            wrap.appendChild(UI.el('span', { class: 'bar-track' }, [
              UI.el('span', { class: 'bar-fill', style: 'width:' + level + '%;background:' +
                (tone === 'err' ? '#BE3A2B' : tone === 'warn' ? '#A85B06' : '#157F5B') })
            ]));
            wrap.appendChild(UI.el('span', { class: 'bar-value', text: level + '%' }));
            return wrap;
          }
        },
        {
          key: 'charging', title: '充电', width: '76px',
          render: function (row) { return row.charging ? UI.badge('充电中', 'info') : UI.el('span', { class: 'muted', text: '否' }); }
        },
        {
          key: 'recording', title: '录音', width: '76px',
          render: function (row) { return row.recording ? UI.badge('录音中', 'err') : UI.el('span', { class: 'muted', text: '否' }); }
        },
        {
          key: 'storage_free_bytes', title: '存储容量', width: '190px',
          render: function (row) {
            const free = row.storage_free_bytes;
            const total = row.storage_total_bytes;
            if (free === null || free === undefined) return null;
            const wrap = UI.el('div', { class: 'bar-row', style: 'margin:0' });
            if (total !== null && total !== undefined && total > 0) {
              const used = Math.max(0, Math.min(100, (total - free) / total * 100));
              const tone = used >= 90 ? 'err' : used >= 70 ? 'warn' : 'ok';
              wrap.appendChild(UI.el('span', { class: 'bar-track' }, [
                UI.el('span', { class: 'bar-fill', style: 'width:' + used + '%;background:' +
                  (tone === 'err' ? '#BE3A2B' : tone === 'warn' ? '#A85B06' : '#157F5B') })
              ]));
            }
            wrap.appendChild(UI.el('span', {
              class: 'bar-value mono',
              text: total ? (formatBytes(free) + ' / ' + formatBytes(total)) : formatBytes(free),
              title: '剩余 ' + free + ' 字节 / 总 ' +
                (total === null || total === undefined ? '未知' : total + ' 字节')
            }));
            return wrap;
          }
        },
        {
          key: 'firmware_version', title: '固件', width: '110px',
          render: function (row) {
            return row.firmware_version
              ? UI.el('span', { class: 'mono', text: row.firmware_version }) : null;
          }
        },
        {
          key: 'gain', title: '增益', width: '76px',
          render: function (row) {
            if (row.gain === null || row.gain === undefined) return null;
            return UI.badge('G' + row.gain, 'info');
          }
        },
        { key: 'last_seen_at', title: '最近通信', width: '150px', render: function (row) { return row.last_seen_at ? UI.formatDate(row.last_seen_at) : null; } },
        { key: 'last_sync_at', title: '最近同步', width: '150px', render: function (row) { return row.last_sync_at ? UI.formatDate(row.last_sync_at) : null; } }
      ],

      emptyTitle: '没有匹配的状态记录',
      emptyText: '设备入库时会自动创建一条状态记录'
    });

    // 顶部提示：固件尚未接入
    const banner = UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'card-body' }, [UI.notice(SS.config.statusNote, 'muted')])
    ]);
    container.insertBefore(banner, container.firstChild);
  }
};
