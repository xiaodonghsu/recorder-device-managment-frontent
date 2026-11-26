/* ==========================================================================
   应用外壳：导航、路由、页面渲染
   ========================================================================== */
window.SS = window.SS || {};

/** 页面注册表（页面脚本在自身加载时写入） */
SS.pages = SS.pages || {};

SS.app = (function () {
  const cfg = SS.config;
  const pages = SS.pages;
  let current = null;
  let currentRoute = '';

  /* ---------------------------------------------------------- 页面注册 */
  function register(name, definition) {
    pages[name] = definition;
  }

  /* ------------------------------------------------------------- 导航 */
  const NAV_GROUPS = [
    { label: '', keys: ['dashboard'] },
    { label: '设备资产', keys: ['devices', 'statuses'] },
    { label: '使用关系', keys: ['assignments', 'bindings'] },
    { label: '安全与审计', keys: ['credentials', 'events'] }
  ];

  function buildNav() {
    const nav = document.getElementById('nav');
    UI.clear(nav);

    NAV_GROUPS.forEach(function (group) {
      const items = group.keys.filter(function (key) { return pages[key]; });
      if (!items.length) return;
      if (group.label) {
        nav.appendChild(UI.el('div', { class: 'nav-group-label', text: group.label }));
      }
      items.forEach(function (key) {
        const page = pages[key];
        const button = UI.el('button', {
          class: 'nav-item',
          type: 'button',
          dataset: { route: key },
          onclick: function () { navigate('#/' + key); }
        }, [
          page.icon ? UI.el('span', { html: page.icon, style: 'display:flex' }) : null,
          UI.el('span', { text: page.title })
        ]);
        nav.appendChild(button);
      });
    });
  }

  function markActive(route) {
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('is-active', item.dataset.route === route);
    });
  }

  /* ------------------------------------------------------------- 渲染 */
  function renderRoute() {
    const hash = location.hash || '#/dashboard';
    const route = hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    const page = pages[route] || pages.dashboard;

    currentRoute = route;
    markActive(route);

    document.getElementById('page-title').textContent = page.title || '';
    document.getElementById('page-desc').textContent = page.desc || '';

    const container = document.getElementById('page-container');
    UI.clear(container);

    // 离开上一个页面时释放资源（定时器等）
    if (current && typeof current.destroy === 'function') {
      try { current.destroy(); } catch (e) { /* ignore */ }
    }

    current = page;
    try {
      page.render(container);
    } catch (err) {
      container.appendChild(UI.el('div', { class: 'card' }, [
        UI.el('div', { class: 'card-body' }, [
          UI.el('div', { class: 'notice is-warn' }, [
            UI.el('span', { class: 'notice-icon', text: '!' }),
            UI.el('div', { text: '页面渲染失败：' + ((err && err.message) || err) })
          ])
        ])
      ]));
    }
  }

  function navigate(hash) {
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  }

  function refresh() {
    renderRoute();
  }

  /* ------------------------------------------------------- 进入 / 退出 */
  function enterApp(profile) {
    document.getElementById('login-view').hidden = true;
    document.getElementById('app-view').hidden = false;

    const user = profile || SS.auth.getProfile() || {};
    const displayName = user.display_name || user.username || '管理员';

    const avatar = document.getElementById('top-avatar');
    if (avatar) avatar.textContent = displayName.slice(0, 1);
    document.getElementById('top-username').textContent = displayName;
    document.getElementById('top-tenant').textContent =
      (user.tenant_id || '-') + (user.is_global_admin ? ' · 跨组织管理员' : '');

    const sidebarUser = document.getElementById('sidebar-user');
    UI.clear(sidebarUser);
    sidebarUser.appendChild(UI.el('strong', { text: displayName }));
    sidebarUser.appendChild(UI.el('span', {
      text: '企业 ' + (user.tenant_id || '-') + ' · ' + (user.username || '')
    }));

    buildNav();
    if (!location.hash) location.hash = '#/dashboard';
    renderRoute();
  }

  function showLogin(message) {
    document.getElementById('app-view').hidden = true;
    document.getElementById('login-view').hidden = false;
    if (message) SS.auth.showLoginError(message);
    const baseInput = document.getElementById('input-api-base');
    if (baseInput) baseInput.value = SS.api.getBaseUrl();
  }

  /* ------------------------------------------------------------- 启动 */
  async function boot() {
    await SS.auth.init();

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        SS.auth.logout();
        showLogin('已退出登录');
      });
    }

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { refresh(); });
    }

    window.addEventListener('hashchange', renderRoute);

    window.addEventListener('ss:unauthorized', function () {
      SS.auth.logout();
      showLogin('登录状态已失效，请重新登录。');
    });

    // 1) Casdoor 回调
    try {
      const handled = await SS.auth.handleCasdoorCallback();
      if (handled) { enterApp(handled); return; }
    } catch (err) {
      showLogin((err && err.message) || 'Casdoor 登录失败');
      return;
    }

    // 2) 已有令牌：静默校验
    if (SS.api.getToken()) {
      try {
        const profile = await SS.api.auth.profile();
        if (!profile.is_admin) {
          SS.auth.logout();
          showLogin('当前账号不是管理员，无法进入管理后台。');
          return;
        }
        SS.auth.saveProfile(profile);
        enterApp(profile);
        return;
      } catch (err) {
        SS.auth.logout();
        showLogin((err && err.message) ? '登录状态校验失败：' + err.message : '登录状态校验失败');
        return;
      }
    }

    showLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    register: register,
    enterApp: enterApp,
    showLogin: showLogin,
    navigate: navigate,
    refresh: refresh,
    renderRoute: renderRoute,
    getCurrentRoute: function () { return currentRoute; }
  };
})();
