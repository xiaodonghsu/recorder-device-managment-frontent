/* ==========================================================================
   设备管理页：device 表
   档案入库 / 批量入库 / 档案编辑 / 生命周期流转 / 领用 / 归还 / 详情
   ========================================================================== */
SS.pages.devices = {
  title: '设备管理',
  desc: 'device 表 · 设备档案与生命周期',
  icon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="11" height="8" rx="1.6"/><path d="M6 4V2.6h4V4M6 8h4"/></svg>',

  render: function (container) {
    const filters = {
      keyword: '',
      lifecycle_status: '',
      assigned: '',
      bound: '',
      model: ''
    };

    const controller = new UI.TableController(container, {
      toolbar: function () {
        const keyword = UI.el('input', {
          class: 'input', type: 'search', placeholder: 'SN / 蓝牙名 / 型号',
          onkeydown: function (e) { if (e.key === 'Enter') applyFilters(); }
        });
        const lifecycle = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '全部生命周期状态' })
        ].concat(Object.keys(SS.config.lifecycle).map(function (key) {
          return UI.el('option', { value: key, text: SS.config.lifecycle[key].label });
        })));
        const assigned = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '领用情况：全部' }),
          UI.el('option', { value: 'true', text: '领用情况：领用中' }),
          UI.el('option', { value: 'false', text: '领用情况：在库' })
        ]);
        const bound = UI.el('select', { class: 'select' }, [
          UI.el('option', { value: '', text: '绑定情况：全部' }),
          UI.el('option', { value: 'true', text: '绑定情况：已绑定' }),
          UI.el('option', { value: 'false', text: '绑定情况：未绑定' })
        ]);

        function applyFilters() {
          filters.keyword = keyword.value.trim();
          filters.lifecycle_status = lifecycle.value;
          filters.assigned = assigned.value;
          filters.bound = bound.value;
          controller.setFilters(filters);
        }

        function resetFilters() {
          keyword.value = '';
          lifecycle.value = '';
          assigned.value = '';
          bound.value = '';
          applyFilters();
        }

        [lifecycle, assigned, bound].forEach(function (node) {
          node.addEventListener('change', applyFilters);
        });

        return UI.el('div', { class: 'toolbar' }, [
          UI.el('div', { class: 'toolbar-field wide' }, [
            UI.el('span', { class: 'field-label', text: '关键字' }), keyword
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '生命周期' }), lifecycle
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '领用情况' }), assigned
          ]),
          UI.el('div', { class: 'toolbar-field' }, [
            UI.el('span', { class: 'field-label', text: '绑定情况' }), bound
          ]),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', { class: 'btn btn-primary', type: 'button', text: '查询', onclick: applyFilters }),
            UI.el('button', { class: 'btn btn-ghost', type: 'button', text: '重置', onclick: resetFilters })
          ]),
          UI.el('div', { class: 'toolbar-spacer' }),
          UI.el('div', { class: 'toolbar-actions' }, [
            UI.el('button', {
              class: 'btn', type: 'button', text: '批量入库',
              onclick: function () { openBatchDialog(controller); }
            }),
            UI.el('button', {
              class: 'btn btn-primary', type: 'button', text: '登记设备',
              onclick: function () { openCreateDialog(controller); }
            })
          ])
        ]);
      },

      fetch: function (page, pageSize, state) {
        const query = { page: page, page_size: pageSize };
        if (state.keyword) query.keyword = state.keyword;
        if (state.lifecycle_status) query.lifecycle_status = state.lifecycle_status;
        if (state.assigned) query.assigned = state.assigned;
        if (state.bound) query.bound = state.bound;
        return SS.api.devices.list(query);
      },

      columns: [
        { key: 'id', title: 'ID', width: '62px', className: 'mono' },
        {
          key: 'sn', title: 'SN', width: '150px', className: 'mono strong',
          render: function (row) {
            return UI.el('span', { class: 'nowrap', text: row.sn });
          }
        },
        { key: 'bluetooth_name', title: '蓝牙名', render: function (row) {
          return row.bluetooth_name
            ? UI.el('span', { class: 'truncate narrow', title: row.bluetooth_name, text: row.bluetooth_name })
            : null;
        } },
        { key: 'model', title: '型号' },
        { key: 'manufacturer', title: '厂商' },
        {
          key: 'lifecycle_status', title: '生命周期', width: '96px',
          render: function (row) { return UI.dictBadge(SS.config.lifecycle, row.lifecycle_status); }
        },
        {
          key: 'assigned_user_id', title: '领用员工', width: '170px',
          render: function (row) {
            if (!row.assigned) return UI.el('span', { class: 'badge badge-muted', text: '在库' });
            return UI.idCell(row.assigned_user_id);
          }
        },
        {
          key: 'nickname', title: 'APP 绑定', width: '140px',
          render: function (row) {
            if (!row.bound) return UI.el('span', { class: 'muted', text: '未绑定' });
            return UI.el('span', {
              class: 'badge badge-purple', title: row.bound_user_id || '',
              text: UI.truncate(row.nickname || row.bound_user_id || '已绑定', 14)
            });
          }
        },
        { key: 'created_at', title: '入库时间', width: '150px', render: function (row) { return UI.formatDate(row.created_at); } },
        {
          key: 'actions', title: '操作', className: 'col-actions',
          render: function (row) {
            const actions = UI.el('div', { class: 'btn-row' });
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '详情',
              onclick: function () { SS.actions.openDeviceDrawer(row.id, function () { controller.reload(); }); }
            }));
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '分配',
              onclick: function () { SS.actions.assignDevice(row, function () { controller.reload(); }); }
            }));
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '归还',
              onclick: function () { SS.actions.returnDevice(row, function () { controller.reload(); }); }
            }));
            actions.appendChild(UI.el('button', {
              class: 'btn-link', type: 'button', text: '状态',
              onclick: function () { SS.actions.lifecycleMenu(row, function () { controller.reload(); }); }
            }));
            return actions;
          }
        }
      ],

      emptyTitle: '没有匹配的设备',
      emptyText: '调整筛选条件，或点击右上角「登记设备」录入新设备'
    });
  }
};

/* ------------------------------------------------------------ 登记设备 */
function openCreateDialog(controller) {
  UI.formModal({
    title: '设备入库',
    desc: '登记设备档案并签发 AuthKey',
    submitText: '入库并生成 AuthKey',
    fields: [
      { name: 'sn', label: '设备 SN', type: 'text', required: true, placeholder: '全局唯一，不允许修改' },
      { name: 'bluetooth_name', label: '蓝牙广播名称', type: 'text', placeholder: '可与其它设备重复' },
      { name: 'model', label: '设备型号', type: 'text', placeholder: '例如 VH-1' },
      { name: 'manufacturer', label: '厂商', type: 'text', placeholder: '例如 嘉环声枢' },
      { name: 'hardware_version', label: '硬件版本', type: 'text' },
      { name: 'firmware_version', label: '固件版本', type: 'text' },
      { name: 'production_batch', label: '生产批次', type: 'text' },
      {
        name: 'auth_key', label: '导入已有 AuthKey（选填）', type: 'text', span: 2,
        placeholder: '留空则由系统生成高强度随机值',
        tip: '填写则导入该密钥且不再回显；留空则系统生成并在入库后一次性返回明文。'
      }
    ],
    onSubmit: function (values) {
      const payload = {};
      Object.keys(values).forEach(function (key) {
        if (values[key] !== '' && values[key] !== undefined && values[key] !== null) payload[key] = values[key];
      });
      return SS.api.devices.create(payload).then(function (result) {
        SS.actions.showAuthKey(result, { sn: result.sn });
        if (controller) controller.reload();
      });
    }
  });
}

/* ------------------------------------------------------------ 批量入库 */
function openBatchDialog(controller) {
  const input = UI.el('textarea', {
    class: 'input input-area', rows: 12, spellcheck: 'false',
    placeholder: '每行一台设备，字段以逗号分隔：\nSN,型号,厂商,蓝牙广播名称\nVH-2026-0001,VH-1,嘉环声枢,VoiceHub\nVH-2026-0002,VH-1,嘉环声枢,VoiceHub'
  });
  const preview = UI.el('div', { style: 'margin-top:12px' });

  function parse() {
    const text = (input.value || '').trim();
    if (!text) return [];
    if (text.charAt(0) === '[' || text.charAt(0) === '{') {
      try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [data];
      } catch (e) {
        return null;
      }
    }
    return text.split(/\r?\n/).map(function (line) {
      const parts = line.split(',').map(function (part) { return part.trim(); });
      return {
        sn: parts[0] || '',
        model: parts[1] || undefined,
        manufacturer: parts[2] || undefined,
        bluetooth_name: parts[3] || undefined
      };
    }).filter(function (item) { return item.sn; });
  }

  input.addEventListener('input', function () {
    const items = parse();
    UI.clear(preview);
    if (items === null) {
      preview.appendChild(UI.el('p', { class: 'field-error', text: 'JSON 格式解析失败' }));
      return;
    }
    const valid = items.filter(function (item) { return item && item.sn; });
    preview.appendChild(UI.el('p', {
      class: 'field-tip',
      text: valid.length ? ('解析出 ' + valid.length + ' 台设备，可提交入库') : '请至少填写一行 SN'
    }));
  });

  const modal = UI.modal({
    title: '批量设备入库',
    desc: '支持 CSV（每行 SN,型号,厂商,蓝牙名）或 JSON 数组，单次最多 1000 条',
    size: 'wide',
    content: UI.el('div', {}, [
      UI.el('label', { class: 'field' }, [
        UI.el('span', { class: 'field-label', text: '设备清单' }), input
      ]),
      preview
    ])
  });

  modal.foot.appendChild(UI.el('button', {
    class: 'btn btn-ghost', type: 'button', text: '取消', onclick: function () { modal.close(); }
  }));
  modal.foot.appendChild(UI.el('button', {
    class: 'btn btn-primary', type: 'button', text: '提交入库',
    onclick: function () {
      const items = parse();
      if (items === null) { UI.toast('清单格式无法解析', 'err'); return; }
      const valid = items.filter(function (item) { return item && item.sn; });
      if (!valid.length) { UI.toast('清单为空', 'warn'); return; }
      if (valid.length > 1000) { UI.toast('单次最多 1000 条', 'err'); return; }

      const button = modal.foot.querySelector('.btn-primary');
      button.disabled = true;
      button.textContent = '入库中…';

      SS.api.devices.createBatch({ items: valid, continue_on_error: true })
        .then(function (result) {
          modal.close();
          showBatchResult(result);
          if (controller) controller.reload();
        })
        .catch(function (err) {
          button.disabled = false;
          button.textContent = '提交入库';
          UI.toast((err && err.message) || '批量入库失败', 'err');
        });
    }
  }));
}

/* ------------------------------------------------------ 批量结果展示 */
function showBatchResult(result) {
  const rows = (result.items || []).map(function (item) {
    return {
      sn: item.sn,
      success: item.success,
      device_id: item.device_id,
      auth_key: item.auth_key,
      error: item.error
    };
  });

  const modal = UI.modal({
    title: '批量入库结果',
    desc: '成功 ' + result.succeeded + ' 条，失败 ' + result.failed + ' 条',
    size: 'wide',
    content: UI.el('div', {}, [
      UI.notice('系统生成的 AuthKey 明文仅在本次响应中返回，请及时导出保存。', 'warn'),
      UI.el('div', { style: 'margin-top:14px' }, [
        UI.buildTable([
          { key: 'sn', title: 'SN', className: 'mono' },
          {
            key: 'success', title: '结果', width: '90px',
            render: function (row) { return UI.badge(row.success ? '成功' : '失败', row.success ? 'ok' : 'err'); }
          },
          { key: 'device_id', title: '设备 ID', width: '80px' },
          { key: 'auth_key', title: 'AuthKey（仅本次可见）', className: 'mono' },
          { key: 'error', title: '错误信息', className: 'wrap' }
        ], rows, { emptyTitle: '没有处理任何设备' })
      ])
    ])
  });

  modal.foot.appendChild(UI.el('button', {
    class: 'btn btn-ghost', type: 'button', text: '关闭', onclick: function () { modal.close(); }
  }));
  modal.foot.appendChild(UI.el('button', {
    class: 'btn btn-primary', type: 'button', text: '导出 CSV',
    onclick: function () {
      const header = 'SN,设备ID,AuthKey,结果,错误\n';
      const body = rows.map(function (row) {
        return [row.sn, row.device_id || '', row.auth_key || '', row.success ? '成功' : '失败', row.error || '']
          .map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = UI.el('a', { href: url, download: 'device-batch-' + Date.now() + '.csv' });
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
  }));
}
