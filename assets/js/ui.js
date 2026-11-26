/* ==========================================================================
   通用 UI 组件
   DOM 助手、Toast、确认框、模态框、抽屉、表单模态框、表格渲染、分页器。
   所有函数均返回原生 DOM，便于组合与销毁。
   ========================================================================== */
window.SS = window.SS || {};

SS.ui = (function () {
  const cfg = SS.config;

  /* ------------------------------------------------------------ DOM 助手 */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value === undefined || value === null || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') {
          Object.keys(value).forEach(function (d) { node.dataset[d] = value[d]; });
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
      });
    }
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ------------------------------------------------------------ 格式化 */
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function formatRelative(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const diff = Date.now() - date.getTime();
    const abs = Math.abs(diff);
    const suffix = diff >= 0 ? '前' : '后';
    if (abs < 60 * 1000) return '刚刚';
    if (abs < 3600 * 1000) return Math.floor(abs / 60000) + ' 分钟' + suffix;
    if (abs < 86400 * 1000) return Math.floor(abs / 3600000) + ' 小时' + suffix;
    if (abs < 30 * 86400 * 1000) return Math.floor(abs / 86400000) + ' 天' + suffix;
    return formatDate(value);
  }

  function truncate(value, length) {
    const text = String(value === null || value === undefined ? '' : value);
    const max = length || 40;
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  /* ------------------------------------------------------------- 徽章 */
  function badge(text, tone) {
    return el('span', { class: 'badge badge-' + (tone || 'muted'), text: text });
  }

  /** 按字典渲染状态徽章 */
  function dictBadge(dict, key, fallback) {
    if (key === null || key === undefined || key === '') return el('span', { class: 'muted', text: '—' });
    const item = dict[key] || { label: fallback || key, tone: 'muted' };
    return badge(item.label, item.tone);
  }

  /* ------------------------------------------------------------- Toast */
  const TOAST_ICON = { ok: '✓', err: '✕', warn: '!', info: 'i' };

  function toast(message, type, timeout) {
    const host = document.getElementById('toast-host');
    if (!host) return;
    const kind = type || 'info';
    const node = el('div', { class: 'toast is-' + kind }, [
      el('span', { class: 'toast-icon', text: TOAST_ICON[kind] || 'i' }),
      el('div', { class: 'toast-msg', text: message })
    ]);
    host.appendChild(node);
    const life = timeout || (kind === 'err' ? 6000 : 3200);
    setTimeout(function () {
      node.classList.add('is-out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 200);
    }, life);
  }

  /* ------------------------------------------------------------ 模态框 */
  /** 登记 Esc 关闭处理器，返回取消函数 */
  function bindEscape(close) {
    const handler = function (e) {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return function () { document.removeEventListener('keydown', handler); };
  }

  function openModal(options) {
    const opts = options || {};
    const host = document.getElementById('modal-host');
    const body = el('div', { class: 'modal-body' });
    if (opts.content) body.appendChild(opts.content);

    const foot = el('div', { class: 'modal-foot' });
    const modal = el('div', { class: 'modal' + (opts.size ? ' modal-' + opts.size : '') }, [
      el('div', { class: 'modal-head' }, [
        el('div', {}, [
          el('h3', { text: opts.title || '' }),
          opts.desc ? el('p', { text: opts.desc }) : null
        ]),
        el('button', { class: 'modal-close', type: 'button', text: '×', onclick: function () { api.close(); } })
      ]),
      body,
      foot
    ]);

    const mask = el('div', { class: 'modal-mask', onclick: function (e) {
      if (e.target === mask && opts.maskClosable !== false) api.close();
    } }, [modal]);

    const api = {
      root: mask,
      body: body,
      foot: foot,
      modal: modal,
      close: function () {
        if (api._unbindEscape) api._unbindEscape();
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    };
    api._unbindEscape = bindEscape(function () { api.close(); });

    host.appendChild(mask);
    return api;
  }

  function confirm(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      // Promise 只能兑现一次：确认按钮先兑现 true，关闭回调再兜底为 false
      let settled = false;
      const finish = function (value) {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const modal = openModal({
        title: opts.title || '请确认',
        size: 'narrow',
        onClose: function () { finish(false); },
        content: el('p', { class: 'dim', style: 'line-height:1.7', text: opts.message || '' })
      });

      modal.foot.appendChild(el('button', {
        class: 'btn btn-ghost', type: 'button', text: opts.cancelText || '取消',
        onclick: function () { modal.close(); }
      }));
      modal.foot.appendChild(el('button', {
        class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
        type: 'button', text: opts.confirmText || '确定',
        onclick: function () {
          finish(true);
          modal.close();
        }
      }));
    });
  }

  function alertBox(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      const modal = openModal({
        title: opts.title || '提示',
        size: 'narrow',
        onClose: function () { resolve(); },
        content: el('p', { class: 'dim', style: 'line-height:1.7', text: opts.message || '' })
      });
      modal.foot.appendChild(el('button', {
        class: 'btn btn-primary', type: 'button', text: '知道了',
        onclick: function () { modal.close(); }
      }));
    });
  }

  /* -------------------------------------------------------------- 抽屉 */
  function openDrawer(options) {
    const opts = options || {};
    const host = document.getElementById('drawer-host');
    const body = el('div', { class: 'drawer-body' });
    const foot = el('div', { class: 'drawer-foot' });
    if (!opts.footHidden) foot.style.display = 'none';

    const drawer = el('aside', { class: 'drawer' }, [
      el('div', { class: 'drawer-head' }, [
        el('div', { class: 'grow' }, [
          el('h3', { text: opts.title || '' }),
          opts.desc ? el('p', { text: opts.desc }) : null
        ]),
        el('button', { class: 'modal-close', type: 'button', text: '×', onclick: function () { api.close(); } })
      ]),
      body,
      foot
    ]);

    const mask = el('div', { class: 'drawer-mask', onclick: function () { api.close(); } });

    const api = {
      root: mask, drawer: drawer, body: body, foot: foot,
      setTitle: function (text) {
        const h3 = drawer.querySelector('.drawer-head h3');
        if (h3) h3.textContent = text;
      },
      setDesc: function (text) {
        const p = drawer.querySelector('.drawer-head p');
        if (p) p.textContent = text;
        else {
          const head = drawer.querySelector('.drawer-head .grow');
          if (head) head.appendChild(el('p', { text: text }));
        }
      },
      close: function () {
        if (api._unbindEscape) api._unbindEscape();
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        if (drawer.parentNode) drawer.parentNode.removeChild(drawer);
        if (typeof opts.onClose === 'function') opts.onClose();
      }
    };
    api._unbindEscape = bindEscape(function () { api.close(); });

    host.appendChild(mask);
    host.appendChild(drawer);
    if (opts.content) body.appendChild(opts.content);
    return api;
  }

  /* -------------------------------------------------------- 表单模态框 */
  /**
   * fields: [{ name, label, type, value, options, required, tip, placeholder, span, disabled }]
   * type: text | textarea | select | number | password
   * onSubmit(values) 抛错时保持弹窗打开
   */
  function formModal(options) {
    const opts = options || {};
    const fields = opts.fields || [];
    const inputs = {};

    const form = el('form', { class: 'form-grid', onsubmit: function (e) { e.preventDefault(); submit(); } });

    fields.forEach(function (field) {
      let control;
      if (field.type === 'textarea') {
        control = el('textarea', {
          class: 'input input-area', rows: field.rows || 4, name: field.name,
          placeholder: field.placeholder || '',
          disabled: field.disabled || false
        });
        control.value = field.value === undefined || field.value === null ? '' : field.value;
      } else if (field.type === 'select') {
        control = el('select', { class: 'select', name: field.name, disabled: field.disabled || false });
        (field.options || []).forEach(function (opt) {
          const option = el('option', { value: opt.value, text: opt.label });
          if (String(opt.value) === String(field.value)) option.selected = true;
          control.appendChild(option);
        });
      } else {
        control = el('input', {
          class: 'input', type: field.type || 'text', name: field.name,
          placeholder: field.placeholder || '',
          disabled: field.disabled || false
        });
        control.value = field.value === undefined || field.value === null ? '' : field.value;
      }
      inputs[field.name] = control;

      const wrap = el('label', { class: 'field' + (field.span === 2 ? ' span-2' : '') }, [
        el('span', { class: 'field-label', html: escapeHtml(field.label) + (field.required ? '<span class="req">*</span>' : '') }),
        control,
        field.tip ? el('small', { class: 'field-tip', text: field.tip }) : null
      ]);
      form.appendChild(wrap);
    });

    const errorBox = el('div', { class: 'field-error', hidden: true });
    const modal = openModal({
      title: opts.title || '',
      desc: opts.desc,
      size: opts.size,
      content: form
    });
    form.appendChild(errorBox);

    function collect() {
      const values = {};
      fields.forEach(function (field) {
        const control = inputs[field.name];
        let value = control.value;
        if (typeof value === 'string') value = value.trim();
        if (field.type === 'number' && value !== '') value = Number(value);
        values[field.name] = value;
      });
      return values;
    }

    function submit() {
      const values = collect();
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (field.required && (values[field.name] === '' || values[field.name] === undefined || values[field.name] === null)) {
          errorBox.hidden = false;
          errorBox.textContent = '「' + field.label + '」为必填项';
          inputs[field.name].focus();
          return;
        }
      }
      errorBox.hidden = true;

      const submitBtn = modal.foot.querySelector('[data-role="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '处理中…'; }

      Promise.resolve()
        .then(function () { return opts.onSubmit(values, modal); })
        .then(function () { modal.close(); })
        .catch(function (err) {
          errorBox.hidden = false;
          errorBox.textContent = (err && err.message) ? err.message : '操作失败';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = opts.submitText || '确定'; }
        });
    }

    modal.foot.appendChild(el('button', {
      class: 'btn btn-ghost', type: 'button', text: '取消', onclick: function () { modal.close(); }
    }));
    modal.foot.appendChild(el('button', {
      class: 'btn btn-primary', type: 'button', text: opts.submitText || '确定',
      dataset: { role: 'submit' }, onclick: submit
    }));

    // 回车提交（多行文本框除外）
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        submit();
      }
    });

    setTimeout(function () {
      const first = fields.length ? inputs[fields[0].name] : null;
      if (first) first.focus();
    }, 60);

    return modal;
  }

  /* ------------------------------------------------------------- 表格 */
  /**
   * columns: [{ key, title, width, align, render(row), className }]
   * 返回 <table> 元素
   */
  function buildTable(columns, rows, options) {
    const opts = options || {};
    const table = el('table', { class: 'table' });

    const thead = el('thead');
    const headRow = el('tr');
    if (opts.checkbox) headRow.appendChild(el('th', { class: 'col-check' }));
    columns.forEach(function (col) {
      const th = el('th', {
        class: (col.align === 'right' ? 'col-num' : col.align === 'center' ? 'text-center' : ''),
        style: col.width ? 'width:' + col.width : null,
        text: col.title
      });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    if (!rows || !rows.length) {
      const cell = el('td', { colspan: columns.length + (opts.checkbox ? 1 : 0) });
      cell.appendChild(el('div', { class: 'table-empty' }, [
        el('strong', { text: opts.emptyTitle || '暂无数据' }),
        el('span', { text: opts.emptyText || '当前筛选条件下没有匹配的记录' })
      ]));
      tbody.appendChild(el('tr', {}, [cell]));
    } else {
      rows.forEach(function (row, index) {
        const tr = el('tr', opts.rowClass ? { class: opts.rowClass(row) } : null);
        if (opts.checkbox) {
          const box = el('input', { type: 'checkbox', dataset: { rowIndex: String(index) } });
          tr.appendChild(el('td', { class: 'col-check' }, [box]));
        }
        columns.forEach(function (col) {
          const td = el('td', {
            class: col.className || (col.align === 'right' ? 'col-num' : col.align === 'center' ? 'text-center' : '')
          });
          let content = null;
          if (typeof col.render === 'function') content = col.render(row, index);
          else if (col.key) content = row[col.key];
          if (content === null || content === undefined || content === '') {
            td.appendChild(el('span', { class: 'muted', text: '—' }));
          } else if (typeof content === 'object' && content.nodeType) {
            td.appendChild(content);
          } else {
            td.appendChild(document.createTextNode(String(content)));
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    return table;
  }

  /* ------------------------------------------------------------- 分页 */
  function buildPager(state, onChange) {
    const total = state.total || 0;
    const page = state.page || 1;
    const pageSize = state.pageSize || 20;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    const info = el('div', { class: 'pager-info' });
    info.appendChild(el('span', {
      text: total === 0 ? '共 0 条' : ('第 ' + ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, total) + ' 条，共 ' + total + ' 条')
    }));

    const sizeSelect = el('select', { class: 'select pager-size', title: '每页条数' });
    SS.config.pageSizeOptions.forEach(function (size) {
      const option = el('option', { value: String(size), text: size + ' 条/页' });
      if (size === pageSize) option.selected = true;
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener('change', function () {
      onChange({ page: 1, pageSize: Number(sizeSelect.value) });
    });
    info.appendChild(sizeSelect);

    const nav = el('div', { class: 'pager-pages' });
    const mk = function (label, target, opts) {
      const o = opts || {};
      const btn = el('button', {
        class: 'pager-btn' + (o.active ? ' is-active' : ''),
        type: 'button', text: label,
        disabled: o.disabled || false,
        onclick: function () { if (!o.disabled && !o.active) onChange({ page: target, pageSize: pageSize }); }
      });
      return btn;
    };

    nav.appendChild(mk('‹', page - 1, { disabled: page <= 1 }));

    const window_ = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let i = start; i <= end; i++) window_.push(i);
    if (start > 1) {
      nav.appendChild(mk('1', 1));
      if (start > 2) nav.appendChild(el('span', { class: 'muted', text: '…' }));
    }
    window_.forEach(function (p) {
      nav.appendChild(mk(String(p), p, { active: p === page }));
    });
    if (end < pages) {
      if (end < pages - 1) nav.appendChild(el('span', { class: 'muted', text: '…' }));
      nav.appendChild(mk(String(pages), pages));
    }
    nav.appendChild(mk('›', page + 1, { disabled: page >= pages }));

    return el('div', { class: 'pager' }, [info, nav]);
  }

  /* -------------------------------------------------- 表格页控制器 */
  /**
   * 统一封装「筛选栏 + 表格 + 分页」的页面骨架。
   *
   * options:
   *   toolbar()      -> 筛选栏 DOM（可选）
   *   columns        列定义
   *   fetch(page, pageSize, filters) -> Promise<PageResult>
   *   rowClass(row)  -> 行样式
   *   emptyTitle / emptyText
   *   onLoaded(result) 额外回调
   */
  function TableController(container, options) {
    this.container = container;
    this.options = options || {};
    this.page = 1;
    this.pageSize = this.options.pageSize || SS.config.pageSize;
    this.filters = {};
    this.result = { items: [], total: 0 };
    this._build();
  }

  TableController.prototype._build = function () {
    clear(this.container);

    if (typeof this.options.toolbar === 'function') {
      const bar = this.options.toolbar();
      if (bar) this.container.appendChild(bar);
    }

    this.card = el('div', { class: 'card' });
    this.tableWrap = el('div', { class: 'table-wrap' });
    this.pagerHost = el('div');
    this.card.appendChild(this.tableWrap);
    this.card.appendChild(this.pagerHost);
    this.container.appendChild(this.card);

    this.reload();
  };

  TableController.prototype.setFilters = function (filters) {
    this.filters = filters || {};
    this.page = 1;
    this.reload();
  };

  TableController.prototype.getFilters = function () { return this.filters; };

  TableController.prototype.reload = function () {
    const self = this;
    clear(this.tableWrap);
    this.tableWrap.appendChild(el('div', { class: 'loading' }, [
      el('span', { class: 'spinner' }), el('span', { text: '加载中…' })
    ]));
    clear(this.pagerHost);

    return Promise.resolve()
      .then(function () { return self.options.fetch(self.page, self.pageSize, self.filters); })
      .then(function (result) {
        self.result = result || { items: [], total: 0 };
        clear(self.tableWrap);
        self.tableWrap.appendChild(buildTable(self.options.columns, self.result.items, {
          rowClass: self.options.rowClass,
          emptyTitle: self.options.emptyTitle,
          emptyText: self.options.emptyText,
          checkbox: self.options.checkbox
        }));
        clear(self.pagerHost);
        self.pagerHost.appendChild(buildPager(
          { total: self.result.total, page: self.page, pageSize: self.pageSize },
          function (next) {
            self.page = next.page;
            self.pageSize = next.pageSize;
            self.reload();
          }
        ));
        if (typeof self.options.onLoaded === 'function') self.options.onLoaded(self.result);
      })
      .catch(function (err) {
        clear(self.tableWrap);
        self.tableWrap.appendChild(el('div', { class: 'table-empty' }, [
          el('strong', { text: '加载失败' }),
          el('span', { text: (err && err.message) || '请稍后重试' }),
          el('div', { style: 'margin-top:12px' }, [
            el('button', { class: 'btn btn-sm', type: 'button', text: '重试', onclick: function () { self.reload(); } })
          ])
        ]));
      });
  };

  /* ------------------------------------------------------------- 其它 */
  function copyText(text, label) {
    const value = text || '';
    const done = function () { toast((label || '内容') + '已复制到剪贴板', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(function () { fallbackCopy(value, done); });
    } else {
      fallbackCopy(value, done);
    }
  }

  function fallbackCopy(value, done) {
    const area = el('textarea', { style: 'position:fixed;left:-9999px;top:0' });
    area.value = value;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择文本', 'warn'); }
    document.body.removeChild(area);
  }

  /** 一次性密钥展示块 */
  function secretBox(text, hint) {
    const code = el('code', { text: text });
    const box = el('div', { class: 'secret-box' }, [
      el('span', { class: 'grow' }, [code]),
      el('button', {
        class: 'copy-btn', type: 'button', title: '复制',
        onclick: function () { copyText(text, 'AuthKey'); }
      }, ['复制'])
    ]);
    const wrap = el('div');
    if (hint) wrap.appendChild(el('p', { class: 'field-tip', style: 'margin-bottom:8px', text: hint }));
    wrap.appendChild(box);
    return wrap;
  }

  function notice(text, tone) {
    return el('div', { class: 'notice' + (tone ? ' is-' + tone : '') }, [
      el('span', { class: 'notice-icon', text: tone === 'warn' ? '!' : 'i' }),
      el('div', { text: text })
    ]);
  }

  function descList(pairs) {
    const grid = el('dl', { class: 'desc-grid' });
    pairs.forEach(function (pair) {
      if (!pair) return;
      grid.appendChild(el('div', { class: 'desc-item' }, [
        el('dt', { text: pair.label }),
        el('dd', {}, [pair.value instanceof Node ? pair.value : document.createTextNode(pair.value === null || pair.value === undefined || pair.value === '' ? '—' : String(pair.value))])
      ]));
    });
    return grid;
  }

  /** 标识列：等宽字体 + 截断 + 悬停提示（用于 UUID 这类长标识） */
  function idCell(text, narrow) {
    if (!text) return null;
    return el('span', {
      class: 'truncate' + (narrow ? ' narrow' : ''),
      title: String(text),
      text: String(text)
    });
  }

  return {
    el: el,
    clear: clear,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatRelative: formatRelative,
    truncate: truncate,
    idCell: idCell,
    badge: badge,
    dictBadge: dictBadge,
    toast: toast,
    confirm: confirm,
    alert: alertBox,
    modal: openModal,
    drawer: openDrawer,
    formModal: formModal,
    buildTable: buildTable,
    buildPager: buildPager,
    TableController: TableController,
    copyText: copyText,
    secretBox: secretBox,
    notice: notice,
    descList: descList
  };
})();

/** 全局别名，便于各页面脚本直接使用 UI.el / UI.clear 等 */
window.UI = SS.ui;
