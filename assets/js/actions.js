/* ==========================================================================
   设备操作（跨页面复用）
   分配 / 归还 / 解绑 / 档案编辑 / 生命周期流转 / 凭证轮换 / 设备详情抽屉
   ========================================================================== */
window.SS = window.SS || {};

SS.actions = (function () {
  const cfg = SS.config;

  /** 生命周期状态机（与后端 app/core/enums.py 保持一致） */
  const TRANSITIONS = {
    registered: ['active', 'disabled', 'lost', 'repair', 'retired'],
    active:    ['disabled', 'lost', 'repair', 'retired'],
    disabled:  ['active', 'lost', 'repair', 'retired'],
    lost:      ['active', 'repair', 'retired'],
    repair:    ['active', 'disabled', 'lost', 'retired'],
    retired:   []
  };

  const ACTION_LABELS = {
    active:   '启用设备',
    disabled: '禁用设备',
    lost:     '标记挂失',
    repair:   '转入维修',
    retired:  '设备报废'
  };

  /* ------------------------------------------------------------ 分配 */
  function assignDevice(device, onDone) {
    const employees = { items: [] };

    UI.formModal({
      title: '分配设备给员工',
      desc: '设备 ' + device.sn + ' · 当前状态 ' + (SS.config.lifecycle[device.lifecycle_status] || {}).label,
      submitText: '确认分配',
      fields: [
        {
          name: 'employee', label: '从已知员工中选择', type: 'select', span: 2,
          value: '', options: [{ value: '', label: '— 手动输入员工标识 —' }]
        },
        {
          name: 'user_id', label: '员工工号', type: 'text', span: 2, required: true,
          placeholder: '例如 JH000059',
          tip: '填 Casdoor 的 preferred_username（工号），它会写入领用记录并与员工登录身份匹配；不要填姓名（name）或用户 UUID。提交时会向 Casdoor 校验该工号在本组织内存在且账号可用。'
        },
        { name: 'note', label: '领用备注', type: 'text', span: 2, placeholder: '选填' }
      ],
      onSubmit: function (values) {
        return SS.api.devices.assign(device.id, {
          user_id: values.user_id,
          note: values.note || undefined
        }).then(function (result) {
          UI.toast('已分配给 ' + result.user_id, 'ok');
          if (onDone) onDone(result);
        });
      }
    });

    // 异步填充员工下拉
    SS.api.tables.employees({ page: 1, page_size: 100 })
      .then(function (result) {
        const modalSelect = Array.prototype.slice
          .call(document.querySelectorAll('.modal select'))
          .filter(function (node) { return node.name === 'employee'; })[0];
        if (!modalSelect) return;
        employees.items = result.items || [];
        employees.items.forEach(function (item) {
          const option = UI.el('option', {
            value: item.user_id,
            text: item.user_id + '（现领用 ' + item.device_count + ' 台）'
          });
          modalSelect.appendChild(option);
        });
        modalSelect.addEventListener('change', function () {
          const input = document.querySelector('.modal input[name="user_id"]');
          if (input && modalSelect.value) input.value = modalSelect.value;
        });
      })
      .catch(function () { /* 员工清单不可用时仍可手动输入 */ });
  }

  /* ------------------------------------------------------------ 归还 */
  function returnDevice(device, onDone) {
    UI.formModal({
      title: '设备归还',
      desc: '设备 ' + device.sn + ' · 归还后原员工立即失去操作权限',
      submitText: '确认归还',
      fields: [
        {
          name: 'reason', label: '归还原因', type: 'textarea', span: 2, rows: 3,
          placeholder: '例如：离职回收、设备送修、损坏退库',
          tip: '归还不删除领用历史，仅关闭当前领用记录。'
        },
        {
          name: 'revoke_binding', label: '是否同时解除 APP 绑定', type: 'select', span: 2,
          value: 'true',
          options: [
            { value: 'true', label: '是（默认，推荐）' },
            { value: 'false', label: '否，保留绑定' }
          ]
        }
      ],
      onSubmit: function (values) {
        return SS.api.devices.returnBack(device.id, {
          reason: values.reason || undefined,
          revoke_binding: values.revoke_binding === 'true'
        }).then(function () {
          UI.toast('设备已归还', 'ok');
          if (onDone) onDone();
        });
      }
    });
  }

  /* ------------------------------------------------------------ 解绑 */
  function unbindDevice(device, onDone) {
    UI.formModal({
      title: '解除 APP 绑定',
      desc: '设备 ' + device.sn + (device.nickname ? ' · 昵称「' + device.nickname + '」' : ''),
      submitText: '确认解绑',
      fields: [
        {
          name: 'reason', label: '解绑原因', type: 'text', span: 2,
          placeholder: '例如：员工离职、管理员撤销',
          tip: '解绑只终止 APP 操作权限，不影响录音数据。'
        }
      ],
      onSubmit: function (values) {
        return SS.api.devices.unbind(device.id, values.reason || undefined).then(function () {
          UI.toast('已解除绑定', 'ok');
          if (onDone) onDone();
        });
      }
    });
  }

  /* -------------------------------------------------------- 档案编辑 */
  function editDevice(device, onDone) {
    UI.formModal({
      title: '编辑设备档案',
      desc: '设备 ' + device.sn + ' · SN 不允许修改',
      submitText: '保存',
      fields: [
        { name: 'bluetooth_name', label: '蓝牙广播名称', type: 'text', value: device.bluetooth_name || '' },
        { name: 'model', label: '设备型号', type: 'text', value: device.model || '' },
        { name: 'manufacturer', label: '厂商', type: 'text', value: device.manufacturer || '' },
        { name: 'hardware_version', label: '硬件版本', type: 'text', value: device.hardware_version || '' },
        { name: 'firmware_version', label: '固件版本', type: 'text', value: device.firmware_version || '' },
        { name: 'production_batch', label: '生产批次', type: 'text', value: device.production_batch || '' }
      ],
      onSubmit: function (values) {
        return SS.api.devices.update(device.id, values).then(function () {
          UI.toast('档案已更新', 'ok');
          if (onDone) onDone();
        });
      }
    });
  }

  /* ---------------------------------------------------- 生命周期流转 */
  function changeLifecycle(device, target, onDone) {
    UI.formModal({
      title: ACTION_LABELS[target] || '变更设备状态',
      desc: '设备 ' + device.sn + ' · 当前状态 ' + ((SS.config.lifecycle[device.lifecycle_status] || {}).label || device.lifecycle_status),
      submitText: '确认变更',
      fields: [
        {
          name: 'reason', label: '变更原因', type: 'textarea', span: 2, rows: 3,
          placeholder: '例如：设备送修、员工报失、达到报废标准'
        }
      ],
      onSubmit: function (values) {
        return SS.api.devices.lifecycle(device.id, target, values.reason || undefined).then(function () {
          UI.toast('设备状态已变更为「' + ((SS.config.lifecycle[target] || {}).label || target) + '」', 'ok');
          if (onDone) onDone();
        });
      }
    });
  }

  /** 弹出生命周期流转选择菜单 */
  function lifecycleMenu(device, onDone) {
    const allowed = TRANSITIONS[device.lifecycle_status] || [];
    if (!allowed.length) {
      UI.alertBox({
        title: '无法继续流转',
        message: '设备已处于「' + ((SS.config.lifecycle[device.lifecycle_status] || {}).label || device.lifecycle_status) + '」终态，档案与状态均已锁定。'
      });
      return;
    }

    const buttons = allowed.map(function (target) {
      return UI.el('button', {
        class: 'btn btn-block' + (target === 'retired' ? ' btn-danger' : ''),
        type: 'button',
        text: ACTION_LABELS[target] || target,
        style: 'justify-content:flex-start;margin-bottom:8px',
        onclick: function () {
          modal.close();
          changeLifecycle(device, target, onDone);
        }
      });
    });

    const modal = UI.modal({
      title: '变更设备生命周期状态',
      desc: '设备 ' + device.sn,
      size: 'narrow',
      content: UI.el('div', {}, buttons)
    });
    modal.foot.appendChild(UI.el('button', {
      class: 'btn btn-ghost', type: 'button', text: '取消', onclick: function () { modal.close(); }
    }));
  }

  /* -------------------------------------------------------- 凭证轮换 */
  function rotateCredential(device, onDone) {
    UI.confirm({
      title: '轮换 AuthKey',
      message: '将撤销当前有效凭证并签发新版本。旧 AuthKey 立即失效，设备需使用新密钥重新认证。',
      confirmText: '确认轮换'
    }).then(function (ok) {
      if (!ok) return;
      return SS.api.devices.rotateCredential(device.id).then(function (result) {
        showAuthKey(result, device);
        if (onDone) onDone();
      });
    }).catch(function (err) {
      UI.toast((err && err.message) || '轮换失败', 'err');
    });
  }

  function revokeCredential(device, onDone) {
    UI.confirm({
      title: '撤销设备凭证',
      message: '撤销后该设备不再持有有效凭证，设备将无法通过身份认证。',
      confirmText: '确认撤销',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      return SS.api.devices.revokeCredential(device.id).then(function () {
        UI.toast('凭证已撤销', 'ok');
        if (onDone) onDone();
      });
    }).catch(function (err) {
      UI.toast((err && err.message) || '撤销失败', 'err');
    });
  }

  /** 一次性 AuthKey 明文展示 */
  function showAuthKey(result, device) {
    const modal = UI.modal({
      title: 'AuthKey 已签发',
      desc: '设备 ' + ((device && device.sn) || ('#' + result.device_id)) + ' · 版本 v' + result.auth_key_version,
      size: 'narrow',
      content: UI.el('div', {}, [
        UI.notice('AuthKey 明文仅此一次可见。数据库只保存 HMAC-SHA256 摘要，关闭本窗口后无法再次查看，请立即交付给设备持有方并妥善保存。', 'warn'),
        UI.el('div', { style: 'margin-top:14px' }, [
          UI.secretBox(result.auth_key, '设备凭证（AuthKey）')
        ]),
        UI.el('p', {
          class: 'field-tip',
          text: '签发时间：' + UI.formatDate(result.issued_at) +
                (result.expires_at ? '　·　过期时间：' + UI.formatDate(result.expires_at) : '　·　长期有效')
        })
      ])
    });
    modal.foot.appendChild(UI.el('button', {
      class: 'btn btn-primary', type: 'button', text: '我已保存',
      onclick: function () { modal.close(); }
    }));
  }

  /** 依据设备对象刷新抽屉标题与副标题 */
  function syncDrawerHead(drawer, device) {
    if (!device) return;
    drawer.setTitle('设备 ' + device.sn);
    const life = (SS.config.lifecycle[device.lifecycle_status] || {}).label || device.lifecycle_status;
    drawer.setDesc([
      'ID ' + device.id,
      device.model || '未知型号',
      '状态 ' + life,
      device.assigned ? ('领用中 · ' + device.assigned_user_id) : '在库'
    ].join('　·　'));
  }

  /* ------------------------------------------------------ 设备详情抽屉 */
  function openDeviceDrawer(deviceId, onChanged) {
    const drawer = UI.drawer({
      title: '设备详情',
      desc: '加载中…',
      footHidden: false
    });

    const body = drawer.body;
    const tabsHost = UI.el('div', { class: 'tabs' });
    const panel = UI.el('div');
    body.appendChild(tabsHost);
    body.appendChild(panel);

    let device = null;

    const TABS = [
      { key: 'overview', label: '概览' },
      { key: 'assignments', label: '领用记录' },
      { key: 'bindings', label: 'APP 绑定' },
      { key: 'credential', label: '设备凭证' },
      { key: 'events', label: '生命周期事件' }
    ];

    function renderTabs() {
      UI.clear(tabsHost);
      TABS.forEach(function (tab) {
        tabsHost.appendChild(UI.el('button', {
          class: 'tab' + (tab.key === activeTab ? ' is-active' : ''),
          type: 'button', text: tab.label,
          onclick: function () { activeTab = tab.key; renderTabs(); renderPanel(); }
        }));
      });
    }

    let activeTab = 'overview';

    function renderPanel() {
      UI.clear(panel);
      panel.appendChild(UI.el('div', { class: 'loading' }, [
        UI.el('span', { class: 'spinner' }), UI.el('span', { text: '加载中…' })
      ]));

      const reload = function () {
        if (onChanged) onChanged();
        SS.api.devices.get(deviceId).then(function (fresh) {
          device = fresh;
          syncDrawerHead(drawer, fresh);
          renderPanel();
        });
      };

      if (activeTab === 'overview') {
        SS.api.devices.get(deviceId).then(function (fresh) {
          device = fresh;
          const statusSnapshot = fresh.status;
          const formatSize = function (v) {
            if (v === null || v === undefined) return '—';
            const n = Number(v);
            if (!isFinite(n) || n < 0) return '—';
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let size = n, i = 0;
            while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
            return (i === 0 ? String(Math.round(size)) : size.toFixed(size >= 100 ? 0 : 1)) + ' ' + units[i];
          };
          syncDrawerHead(drawer, fresh);
          UI.clear(panel);
          panel.appendChild(UI.descList([
            { label: '设备 ID', value: String(fresh.id) },
            { label: 'SN', value: fresh.sn },
            { label: '所属企业', value: fresh.tenant_id },
            { label: '生命周期状态', value: UI.dictBadge(SS.config.lifecycle, fresh.lifecycle_status) },
            { label: '蓝牙广播名称', value: fresh.bluetooth_name },
            { label: '设备型号', value: fresh.model },
            { label: '厂商', value: fresh.manufacturer },
            { label: '硬件版本', value: fresh.hardware_version },
            { label: '固件版本', value: fresh.firmware_version },
            { label: '生产批次', value: fresh.production_batch },
            { label: '激活时间', value: fresh.activated_at ? UI.formatDate(fresh.activated_at) : null },
            { label: '入库时间', value: UI.formatDate(fresh.created_at) },
            { label: '更新时间', value: UI.formatDate(fresh.updated_at) },
            { label: '当前领用', value: fresh.assigned ? ('是 · ' + fresh.assigned_user_id) : '否（在库）' },
            { label: 'APP 绑定', value: fresh.bound ? ('是 · ' + (fresh.nickname || fresh.bound_user_id)) : '否' },
            { label: '在线状态', value: statusSnapshot ? (statusSnapshot.online ? '在线' : '离线') : '无状态记录' },
            { label: '电量', value: statusSnapshot && statusSnapshot.battery_level !== null && statusSnapshot.battery_level !== undefined ? (statusSnapshot.battery_level + '%') : null },
            { label: '实测固件（APP）', value: statusSnapshot ? statusSnapshot.firmware_version : null },
            { label: '存储容量（剩余 / 总）', value: statusSnapshot && statusSnapshot.storage_free_bytes !== null && statusSnapshot.storage_free_bytes !== undefined
              ? (formatSize(statusSnapshot.storage_free_bytes) + ' / ' + formatSize(statusSnapshot.storage_total_bytes)) : null },
            { label: '录音增益', value: statusSnapshot && statusSnapshot.gain !== null && statusSnapshot.gain !== undefined
              ? ('G' + statusSnapshot.gain + '（1-3 档）') : null }
          ]));
        });
        return;
      }

      if (activeTab === 'assignments') {
        SS.api.devices.assignments(deviceId, { page: 1, page_size: 50 }).then(function (result) {
          UI.clear(panel);
          panel.appendChild(UI.buildTable([
            { key: 'id', title: 'ID', width: '60px' },
            { key: 'user_id', title: '领用员工' },
            { key: 'assigned_by', title: '分配人' },
            { key: 'assigned_at', title: '领用时间', render: function (row) { return UI.formatDate(row.assigned_at); } },
            { key: 'returned_at', title: '归还时间', render: function (row) { return row.returned_at ? UI.formatDate(row.returned_at) : null; } },
            { key: 'return_reason', title: '归还原因' },
            {
              key: 'state', title: '状态', width: '90px',
              render: function (row) {
                return UI.badge(row.returned_at ? '已归还' : '领用中', row.returned_at ? 'muted' : 'ok');
              }
            }
          ], result.items, { emptyTitle: '暂无领用记录' }));
        });
        return;
      }

      if (activeTab === 'bindings') {
        SS.api.devices.bindings(deviceId, { page: 1, page_size: 50 }).then(function (result) {
          UI.clear(panel);
          panel.appendChild(UI.buildTable([
            { key: 'id', title: 'ID', width: '60px' },
            { key: 'user_id', title: '员工' },
            { key: 'nickname', title: '昵称' },
            {
              key: 'status', title: '状态', width: '90px',
              render: function (row) { return UI.dictBadge(SS.config.bindingStatus, row.status); }
            },
            { key: 'bound_at', title: '绑定时间', render: function (row) { return UI.formatDate(row.bound_at); } },
            { key: 'unbound_at', title: '解绑时间', render: function (row) { return row.unbound_at ? UI.formatDate(row.unbound_at) : null; } }
          ], result.items, { emptyTitle: '暂无绑定记录' }));
        });
        return;
      }

      if (activeTab === 'credential') {
        SS.api.devices.credential(deviceId).then(function (rows) {
          UI.clear(panel);
          panel.appendChild(UI.el('div', { style: 'margin-bottom:14px' }, [
            UI.el('div', { class: 'btn-row' }, [
              UI.el('button', {
                class: 'btn btn-primary btn-sm', type: 'button', text: '轮换 AuthKey',
                onclick: function () { rotateCredential({ id: deviceId, sn: device ? device.sn : '' }, reload); }
              }),
              UI.el('button', {
                class: 'btn btn-sm', type: 'button', text: '撤销当前凭证',
                onclick: function () { revokeCredential({ id: deviceId, sn: device ? device.sn : '' }, reload); }
              })
            ])
          ]));
          panel.appendChild(UI.buildTable([
            { key: 'auth_key_version', title: '版本', width: '70px', render: function (row) { return 'v' + row.auth_key_version; } },
            {
              key: 'status', title: '状态', width: '90px',
              render: function (row) { return UI.dictBadge(SS.config.credentialStatus, row.status); }
            },
            { key: 'issued_at', title: '签发时间', render: function (row) { return UI.formatDate(row.issued_at); } },
            { key: 'expires_at', title: '过期时间', render: function (row) { return row.expires_at ? UI.formatDate(row.expires_at) : '长期有效'; } },
            { key: 'revoked_at', title: '撤销时间', render: function (row) { return row.revoked_at ? UI.formatDate(row.revoked_at) : null; } }
          ], rows, { emptyTitle: '暂无凭证记录' }));
        });
        return;
      }

      if (activeTab === 'events') {
        SS.api.devices.history(deviceId, { page: 1, page_size: 50 }).then(function (result) {
          UI.clear(panel);
          panel.appendChild(UI.buildTable([
            { key: 'id', title: 'ID', width: '60px' },
            {
              key: 'event_type', title: '事件', width: '130px',
              render: function (row) { return UI.dictBadge(SS.config.eventTypes, row.event_type, row.event_type); }
            },
            { key: 'operator_id', title: '操作人' },
            { key: 'created_at', title: '发生时间', render: function (row) { return UI.formatDate(row.created_at); } },
            {
              key: 'event_data', title: '详情', width: '110px',
              render: function (row) {
                if (!row.event_data) return null;
                return UI.el('button', {
                  class: 'btn-link', type: 'button', text: '查看',
                  onclick: function () {
                    const modal = UI.modal({
                      title: '事件详情',
                      desc: row.event_type + ' · ' + UI.formatDate(row.created_at),
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
          ], result.items, { emptyTitle: '暂无事件记录' }));
        });
      }
    }

    renderTabs();
    renderPanel();

    // 底部操作区
    SS.api.devices.get(deviceId).then(function (fresh) {
      device = fresh;
      syncDrawerHead(drawer, fresh);
      const foot = drawer.foot;
      UI.clear(foot);
      foot.style.display = '';
      foot.appendChild(UI.el('button', {
        class: 'btn btn-sm', type: 'button', text: '分配给员工',
        onclick: function () { assignDevice(device, reload); }
      }));
      foot.appendChild(UI.el('button', {
        class: 'btn btn-sm', type: 'button', text: '归还',
        onclick: function () { returnDevice(device, reload); }
      }));
      foot.appendChild(UI.el('button', {
        class: 'btn btn-sm', type: 'button', text: '解除绑定',
        onclick: function () { unbindDevice(device, reload); }
      }));
      foot.appendChild(UI.el('button', {
        class: 'btn btn-sm', type: 'button', text: '编辑档案',
        onclick: function () { editDevice(device, reload); }
      }));
      foot.appendChild(UI.el('button', {
        class: 'btn btn-sm', type: 'button', text: '变更状态',
        onclick: function () { lifecycleMenu(device, reload); }
      }));
    });

    return drawer;
  }

  return {
    TRANSITIONS: TRANSITIONS,
    assignDevice: assignDevice,
    returnDevice: returnDevice,
    unbindDevice: unbindDevice,
    editDevice: editDevice,
    changeLifecycle: changeLifecycle,
    lifecycleMenu: lifecycleMenu,
    rotateCredential: rotateCredential,
    revokeCredential: revokeCredential,
    showAuthKey: showAuthKey,
    openDeviceDrawer: openDeviceDrawer
  };
})();
