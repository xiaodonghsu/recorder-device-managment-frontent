/* ==========================================================================
   设备凭证页：device_credential 表
   AuthKey 版本历史、轮换与撤销（明文仅在签发时一次性返回）
   ========================================================================== */
SS.pages.credentials = {
  title: '设备凭证',
  desc: 'device_credential 表 · 设备独立身份凭证',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="10.5" r="3"/><path d="M7.6 8.4 13 3M11 5l1.8 1.8M9.4 6.6l1.8 1.8"/></svg>',

  render: function (container) {
    const filters = { status: '', keyword: '' };

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: '设备 SN',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const status = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部状态' }),
          UI.el('option', { value: 'active', text: '有效' }),
          UI.el('option', { value: 'revoked', text: '已撤销' })
        ]);

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.status = status.value;
          controller.setFilters(filters);
        }
        function resetFilters() {
          keyword.value = ''; status.value = '';
          applyFilters();
        }
        status.addEventListener('change', applyFilters);

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '设备 SN' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '凭证状态' }), status
          ]),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', { class: 'btn btn-primary', type: 'button', text: '查询', onclick: applyFilters }),
            UI.el('button', { class: 'btn btn-ghost', type: 'button', text: '重置', onclick: resetFilters })
          ]),
          UI.el('div', { class: 'toolbar-spacer' }),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('span', {
              class: 'field-tip',
              style: 'margin:0',
              text: '每台设备同时最多一个有效凭证'
            })
          ])
        ]);
      },

      fetch: function (page, pageSize, state) {
        const query = { page: page, page_size: pageSize };
        if (state.status) query.status = state.status;
        if (state.keyword) query.keyword = state.keyword;
        return SS.api.tables.credentials(query);
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
        { key: 'auth_key_version', title: '版本', width: '76px', render: function (row) { return 'v' + row.auth_key_version; } },
        {
          key: 'status', title: '状态', width: '92px',
          render: function (row) { return UI.dictBadge(SS.config.credentialStatus, row.status); }
        },
        { key: 'issued_at', title: '签发时间', width: '150px', render: function (row) { return UI.formatDate(row.issued_at); } },
        {
          key: 'expires_at', title: '过期时间', width: '150px',
          render: function (row) { return row.expires_at ? UI.formatDate(row.expires_at) : '长期有效'; }
        },
        {
          key: 'revoked_at', title: '撤销时间', width: '150px',
          render: function (row) { return row.revoked_at ? UI.formatDate(row.revoked_at) : null; }
        },
        {
          key: 'actions', title: '操作', className: 'col-actions',
          render: function (row) {
            const actions = UI.el('div', { class: 'btn-row' });
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '轮换',
              onclick: function () {
                SS.actions.rotateCredential({ id: row.device_id, sn: row.device_sn }, function () { controller.reload(); });
              }
            }));
            if (row.status === 'active') {
              actions.appendChild(UI.el('button', {
                class: 'btn-link is-danger', type: 'button', text: '撤销',
                onclick: function () {
                  SS.actions.revokeCredential({ id: row.device_id, sn: row.device_sn }, function () { controller.reload(); });
                }
              }));
            }
            return actions;
          }
        }
      ],

      emptyTitle: '没有匹配的凭证记录',
      emptyText: '设备入库时会自动签发第一个版本的 AuthKey'
    });
  }
};
