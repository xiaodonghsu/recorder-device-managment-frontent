/* ==========================================================================
   API 客户端
   - 统一拼接基址与查询参数
   - 自动附带 Bearer Token
   - 把后端 {code,message,status,details} 错误结构转成 ApiError
   - 401 自动清理登录态并广播事件
   ========================================================================== */
window.SS = window.SS || {};

SS.ApiError = class ApiError extends Error {
  constructor(message, opts) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = (opts && opts.code) || 'unknown_error';
    this.status = (opts && opts.status) || 0;
    this.details = (opts && opts.details) || null;
  }
};

SS.api = (function () {
  const cfg = SS.config;

  /* ---------------------------------------------------------------- 存储 */
  function getToken() {
    try { return localStorage.getItem(cfg.keys.token) || ''; } catch (e) { return ''; }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(cfg.keys.token, token);
      else localStorage.removeItem(cfg.keys.token);
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function trimSlash(url) {
    return (url || '').replace(/\/+$/, '');
  }

  function readStore(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function writeStore(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------- API 基址解析 */
  /** 当前生效的基址（探测结果或人工指定） */
  let detectedBase = readStore(cfg.keys.detectedBase) || null;

  /** 探测时顺带取到的 Casdoor 登录配置，避免重复请求 */
  let cachedAuthConfig = null;

  /** 人工指定的基址（登录页可改），优先级最高 */
  function getStoredBase() {
    return trimSlash(readStore(cfg.keys.apiBase));
  }

  function setBaseUrl(url) {
    const value = trimSlash((url || '').trim());
    writeStore(cfg.keys.apiBase, value);
    if (value) {
      detectedBase = value;
      cachedAuthConfig = null;
    }
  }

  /**
   * 候选基址：按当前页面路径调整优先级后去重。
   *
   * - 页面在 /voicehub/ 下（nginx 部署）→ 同源 /voicehub-api 优先
   * - 页面在 /admin/ 下（后端自带托管）→ 同源 /api 优先
   */
  function baseCandidates() {
    const list = [];
    const path = location.pathname || '';
    if (/\/voicehub(\/|$)/.test(path)) list.push('/voicehub-api');
    if (/\/admin(\/|$)/.test(path)) list.push('/api');
    (cfg.apiCandidates || []).forEach(function (item) {
      if (list.indexOf(item) === -1) list.push(item);
    });
    return list;
  }

  /**
   * 探测可用的 API 基址：依次请求 {base}/auth/config，首个成功者生效。
   * 探测结果缓存到 localStorage，后续不再重复探测。
   *
   * 探测响应本身就是 Casdoor 登录配置，顺手缓存下来复用，
   * 避免登录页再发一次相同的请求。
   */
  async function detectBaseUrl(force) {
    if (!force && detectedBase) {
      if (!cachedAuthConfig) {
        try {
          const response = await fetch(trimSlash(detectedBase) + '/auth/config', { method: 'GET' });
          if (response.ok) cachedAuthConfig = await response.json();
        } catch (e) { /* 忽略，取不到就下次再拉 */ }
      }
      return detectedBase;
    }

    const candidates = baseCandidates();
    for (let i = 0; i < candidates.length; i++) {
      const base = trimSlash(candidates[i]);
      try {
        const response = await fetch(base + '/auth/config', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          detectedBase = base;
          cachedAuthConfig = await response.json().catch(function () { return null; });
          writeStore(cfg.keys.detectedBase, base);
          return base;
        }
      } catch (e) { /* 试下一个候选 */ }
    }

    // 全部失败：保留第一个候选，后续由用户在登录页手动修正
    detectedBase = trimSlash(candidates[0] || '/api');
    return detectedBase;
  }

  /** 取当前使用的 API 基址 */
  function getBaseUrl() {
    const stored = getStoredBase();
    if (stored) return stored;
    if (detectedBase) return detectedBase;
    if (location.protocol === 'file:') return cfg.deploy.fileProtocolApiBase;
    return trimSlash(baseCandidates()[0]);
  }

  /* ------------------------------------------------------------ 查询参数 */
  function buildQuery(params) {
    if (!params) return '';
    const parts = [];
    Object.keys(params).forEach(function (key) {
      const value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /* -------------------------------------------------------------- 请求 */
  async function request(path, options) {
    const opts = options || {};
    const url = getBaseUrl() + path + buildQuery(opts.query);

    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    if (opts.body !== undefined && opts.body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let response;
    try {
      response = await fetch(url, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body === undefined || opts.body === null ? undefined : JSON.stringify(opts.body)
      });
    } catch (err) {
      throw new SS.ApiError('无法连接后端服务，请检查 API 基址与网络：' + (err && err.message ? err.message : err), {
        code: 'network_error'
      });
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch (e) { payload = null; }
    }

    if (!response.ok) {
      const message = (payload && payload.message) || ('请求失败（HTTP ' + response.status + '）');
      const error = new SS.ApiError(message, {
        code: (payload && payload.code) || 'http_' + response.status,
        status: response.status,
        details: (payload && payload.details) || null
      });
      if (response.status === 401) {
        setToken('');
        window.dispatchEvent(new CustomEvent('ss:unauthorized'));
      }
      throw error;
    }

    return payload;
  }

  return {
    getBaseUrl: getBaseUrl,
    setBaseUrl: setBaseUrl,
    detectBaseUrl: detectBaseUrl,
    baseCandidates: baseCandidates,
    getToken: getToken,
    setToken: setToken,

    request: request,
    get: function (path, query) { return request(path, { method: 'GET', query: query }); },
    post: function (path, body) { return request(path, { method: 'POST', body: body }); },
    put: function (path, body) { return request(path, { method: 'PUT', body: body }); },
    del: function (path) { return request(path, { method: 'DELETE' }); },

    /* -------------------------------------------------------- 业务接口 */
    auth: {
      config: async function () {
        // 探测阶段已经取到过，直接复用
        if (cachedAuthConfig) return cachedAuthConfig;
        const data = await request('/auth/config', { method: 'GET' });
        cachedAuthConfig = data;
        return data;
      },
      profile: function () { return request('/my/profile', { method: 'GET' }); }
    },

    devices: {
      list: function (query) { return request('/devices', { method: 'GET', query: query }); },
      get: function (id) { return request('/devices/' + id, { method: 'GET' }); },
      create: function (body) { return request('/devices', { method: 'POST', body: body }); },
      createBatch: function (body) { return request('/devices/batch', { method: 'POST', body: body }); },
      update: function (id, body) { return request('/devices/' + id, { method: 'PUT', body: body }); },
      assign: function (id, body) { return request('/devices/' + id + '/assign', { method: 'POST', body: body }); },
      returnBack: function (id, body) { return request('/devices/' + id + '/return', { method: 'POST', body: body }); },
      unbind: function (id, reason) { return request('/devices/' + id + '/unbind', { method: 'POST', query: { reason: reason } }); },
      lifecycle: function (id, action, reason) {
        return request('/devices/' + id + '/' + action, { method: 'POST', query: { reason: reason } });
      },
      history: function (id, query) { return request('/devices/' + id + '/history', { method: 'GET', query: query }); },
      assignments: function (id, query) { return request('/devices/' + id + '/assignments', { method: 'GET', query: query }); },
      bindings: function (id, query) { return request('/devices/' + id + '/bindings', { method: 'GET', query: query }); },
      credential: function (id) { return request('/devices/' + id + '/credential', { method: 'GET' }); },
      rotateCredential: function (id) { return request('/devices/' + id + '/credential/rotate', { method: 'POST' }); },
      revokeCredential: function (id) { return request('/devices/' + id + '/credential/revoke', { method: 'POST' }); }
    },

    tables: {
      assignments: function (query) { return request('/tables/assignments', { method: 'GET', query: query }); },
      bindings: function (query) { return request('/tables/bindings', { method: 'GET', query: query }); },
      credentials: function (query) { return request('/tables/credentials', { method: 'GET', query: query }); },
      statuses: function (query) { return request('/tables/statuses', { method: 'GET', query: query }); },
      events: function (query) { return request('/tables/events', { method: 'GET', query: query }); },
      employees: function (query) { return request('/tables/employees', { method: 'GET', query: query }); },
      overview: function () { return request('/tables/overview', { method: 'GET' }); }
    }
  };
})();
