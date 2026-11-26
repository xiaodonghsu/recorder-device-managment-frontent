/* ==========================================================================
   领用记录页：device_assignment 表
   跨设备浏览领用关系，支持按状态 / 员工筛选与归还操作
   ========================================================================== */
SS.pages.assignments = {
  title: '领用记录',
  desc: 'device_assignment 表 · 设备与员工的领用关系',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5.5" r="2.5"/><path d="M1.8 13c.5-2.2 2.2-3.5 4.2-3.5s3.7 1.3 4.2 3.5M11 3.5h3.5M12.75 2.25v2.5M10.5 10.5h4"/></svg>',

  render: function (container) {
    const filters = { state: '', user_id: '', keyword: '' };

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: 'SN / 员工 ID',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const state = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部状态' }),
          UI.el('option', { value: 'current', text: '领用中' }),
          UI.el('option', { value: 'returned', text: '已归还' })
        ]);
        const userId = UI.el('input', {
          class: 'input', type: 'search', placeholder: '按员工 ID 精确筛选',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.state = state.value;
          filters.user_id = userId.value.trim();
          controller.setFilters(filters);
        }
        function resetFilters() {
          keyword.value = ''; state.value = ''; userId.value = '';
          applyFilters();
        }
        state.addEventListener('change', applyFilters);

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '关键字' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '领用状态' }), state
          ]),
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '员工 ID' }), userId
          ]),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', { class: 'btn btn-primary', type: 'button', text: '查询', onclick: applyFilters }),
            UI.el('button', { class: 'btn btn-ghost', type: 'button', text: '重置', onclick: resetFilters })
          ])
        ]);
      },

      fetch: function (page, pageSize, state) {
        const query = { page: page, page_size: pageSize };
        if (state.state) query.state = state.state;
        if (state.user_id) query.user_id = state.user_id;
        if (state.keyword) query.keyword = state.keyword;
        return SS.api.tables.assignments(query);
      },

      columns: [
        { key: 'id', title: 'ID', width: '62px', className: 'mono' },
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
        { key: 'user_id', title: '领用员工', render: function (row) { return UI.idCell(row.user_id); } },
        { key: 'assigned_by', title: '分配人', render: function (row) { return UI.idCell(row.assigned_by); } },
        { key: 'assigned_at', title: '领用时间', width: '150px', render: function (row) { return UI.formatDate(row.assigned_at); } },
        { key: 'returned_at', title: '归还时间', width: '150px', render: function (row) { return row.returned_at ? UI.formatDate(row.returned_at) : null; } },
        { key: 'return_reason', title: '归还原因', className: 'wrap' },
        {
          key: 'is_current', title: '状态', width: '92px',
          render: function (row) {
            return row.is_current
              ? UI.badge('领用中', 'ok')
              : UI.badge('已归还', 'muted');
          }
        },
        {
          key: 'actions', title: '操作', className: 'col-actions',
          render: function (row) {
            const actions = UI.el('div', { class: 'btn-row' });
            if (row.is_current) {
              actions.appendChild(UI.el('button', {
                class: 'btn-link is-danger', type: 'button', text: '归还',
                onclick: function () {
                  SS.actions.returnDevice({ id: row.device_id, sn: row.device_sn }, function () { controller.reload(); });
                }
              }));
            }
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '设备详情',
              onclick: function () { SS.actions.openDeviceDrawer(row.device_id, function () { controller.reload(); }); }
            }));
            return actions;
          }
        }
      ],

      emptyTitle: '没有匹配的领用记录',
      emptyText: '设备分配后会在此形成领用记录，归还后记录保留'
    });
  }
};
