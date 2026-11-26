/* ==========================================================================
   APP 绑定页：device_binding 表
   员工与设备的 APP 绑定关系、昵称、解绑与撤销
   ========================================================================== */
SS.pages.bindings = {
  title: 'APP 绑定',
  desc: 'device_binding 表 · 员工通过 APP 获得的设备操作权限',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"/></svg>',

  render: function (container) {
    const filters = { status: '', user_id: '', keyword: '' };

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: 'SN / 员工 ID / 昵称',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const status = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部状态' }),
          UI.el('option', { value: 'active', text: '绑定中' }),
          UI.el('option', { value: 'unbound', text: '已解绑' }),
          UI.el('option', { value: 'revoked', text: '已撤销' })
        ]);
        const userId = UI.el('input', {
          class: 'input', type: 'search', placeholder: '按员工 ID 精确筛选',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.status = status.value;
          filters.user_id = userId.value.trim();
          controller.setFilters(filters);
        }
        function resetFilters() {
          keyword.value = ''; status.value = ''; userId.value = '';
          applyFilters();
        }
        status.addEventListener('change', applyFilters);

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '关键字' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '绑定状态' }), status
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
        if (state.status) query.status = state.status;
        if (state.user_id) query.user_id = state.user_id;
        if (state.keyword) query.keyword = state.keyword;
        return SS.api.tables.bindings(query);
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
        { key: 'user_id', title: '员工', render: function (row) { return UI.idCell(row.user_id); } },
        {
          key: 'nickname', title: '昵称', width: '140px',
          render: function (row) {
            return row.nickname
              ? UI.el('span', { class: 'badge badge-purple', text: row.nickname })
              : null;
          }
        },
        {
          key: 'status', title: '状态', width: '92px',
          render: function (row) { return UI.dictBadge(SS.config.bindingStatus, row.status); }
        },
        { key: 'bound_at', title: '绑定时间', width: '150px', render: function (row) { return UI.formatDate(row.bound_at); } },
        { key: 'unbound_at', title: '解绑时间', width: '150px', render: function (row) { return row.unbound_at ? UI.formatDate(row.unbound_at) : null; } },
        {
          key: 'actions', title: '操作', className: 'col-actions',
          render: function (row) {
            const actions = UI.el('div', { class: 'btn-row' });
            if (row.status === 'active') {
              actions.appendChild(UI.el('button', {
                class: 'btn-link is-danger', type: 'button', text: '解除绑定',
                onclick: function () {
                  SS.actions.unbindDevice({ id: row.device_id, sn: row.device_sn, nickname: row.nickname },
                    function () { controller.reload(); });
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

      emptyTitle: '没有匹配的绑定记录',
      emptyText: '员工在 APP 中绑定自己领用的设备后，会在此生成记录'
    });
  }
};
