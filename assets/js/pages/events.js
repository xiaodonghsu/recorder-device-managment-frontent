/* ==========================================================================
   事件日志页：device_event 表
   全生命周期操作审计，支持按事件类型、设备与操作人筛选
   ========================================================================== */
SS.pages.events = {
  title: '事件日志',
  desc: 'device_event 表 · 设备全生命周期留痕',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13.5h10M4.5 11V6.5M7.5 11V3.5M10.5 11V8M13.5 11V5"/></svg>',

  render: function (container) {
    const filters = { event_type: '', device_id: '', operator_id: '', keyword: '' };

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: 'SN / 操作人',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const eventType = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部事件类型' })
        ].concat(Object.keys(SS.config.eventTypes).map(function (key) {
          return UI.el('option', { value: key, text: SS.config.eventTypes[key].label });
        })));
        const deviceId = UI.el('input', {
          class: 'input', type: 'number', placeholder: '设备 ID', min: '1',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const operator = UI.el('input', {
          class: 'input', type: 'search', placeholder: '操作人 ID',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.event_type = eventType.value;
          filters.device_id = deviceId.value.trim();
          filters.operator_id = operator.value.trim();
          controller.setFilters(filters);
        }
        function resetFilters() {
          keyword.value = ''; eventType.value = ''; deviceId.value = ''; operator.value = '';
          applyFilters();
        }
        eventType.addEventListener('change', applyFilters);

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '关键字' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '事件类型' }), eventType
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '设备 ID' }), deviceId
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '操作人' }), operator
          ]),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', { class: 'btn btn-primary', type: 'button', text: '查询', onclick: applyFilters }),
            UI.el('button', { class: 'btn btn-ghost', type: 'button', text: '重置', onclick: resetFilters })
          ])
        ]);
      },

      fetch: function (page, pageSize, state) {
        const query = { page: page, page_size: pageSize };
        if (state.event_type) query.event_type = state.event_type;
        if (state.device_id) query.device_id = state.device_id;
        if (state.operator_id) query.operator_id = state.operator_id;
        if (state.keyword) query.keyword = state.keyword;
        return SS.api.tables.events(query);
      },

      columns: [
        { key: 'id', title: 'ID', width: '70px', className: 'mono' },
        {
          key: 'device_sn', title: '设备 SN', width: '150px', className: 'mono strong',
          render: function (row) {
            return UI.el('button', {
              class: 'btn-link', type: 'button', text: row.device_sn || ('#' + row.device_id),
              onclick: function () { SS.actions.openDeviceDrawer(row.device_id, function () { controller.reload(); }); }
            });
          }
        },
        {
          key: 'event_type', title: '事件', width: '132px',
          render: function (row) { return UI.dictBadge(SS.config.eventTypes, row.event_type, row.event_type); }
        },
        { key: 'operator_id', title: '操作人', render: function (row) { return UI.idCell(row.operator_id); } },
        { key: 'created_at', title: '发生时间', width: '160px', render: function (row) { return UI.formatDate(row.created_at); } },
        {
          key: 'event_data', title: '详情', width: '110px',
          render: function (row) {
            if (!row.event_data) return null;
            const summary = Object.keys(row.event_data)
              .slice(0, 3)
              .map(function (key) { return key + '=' + JSON.stringify(row.event_data[key]); })
              .join('  ');
            return UI.el('button', {
              class: 'btn-link', type: 'button', text: '查看',
              title: summary,
              onclick: function () {
                const modal = UI.modal({
                  title: '事件详情',
                  desc: (row.device_sn || ('设备 #' + row.device_id)) + ' · ' +
                        ((SS.config.eventTypes[row.event_type] || {}).label || row.event_type),
                  size: 'narrow',
                  content: UI.el('pre', { class: 'json-view', text: JSON.stringify(row.event_data, null, 2) })
                });
                modal.foot.appendChild(UI.el('button', {
                  class: 'btn btn-primary', type: 'button', text: '关闭', onclick: function () { modal.close(); }
                }));
              }
            });
          }
        }
      ],

      emptyTitle: '没有匹配的事件记录',
      emptyText: '所有管理操作都会写入 device_event 表'
    });
  }
};
