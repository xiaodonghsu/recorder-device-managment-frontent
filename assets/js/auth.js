/* ==========================================================================
   认证模块
   - 令牌粘贴登录（始终可用）
   - Casdoor 授权码 + PKCE 登录（需配置 CASDOOR_CLIENT_ID）
   - 身份与管理员判定来自 /api/my/profile
   ========================================================================== */
window.SS = window.SS || {};

SS.auth = (function () {
  const cfg = SS.config;

  /* ------------------------------------------------------ SHA-256 (PKCE) */
  /**
   * 纯 JS SHA-256。
   * crypto.subtle 仅在安全上下文（https / localhost）可用，
   * 因此内置一份实现作为兜底，保证任意访问方式都能完成 PKCE 挑战。
   */
  function sha256Hex(bytes) {
    if (window.crypto && window.crypto.subtle && window.isSecureContext) {
      return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
        return arrayToHex(new Uint8Array(buf));
      });
    }
    return Promise.resolve(sha256Sync(bytes));
  }

  function arrayToHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += (bytes[i] >>> 4).toString(16) + (bytes[i] & 0x0f).toString(16);
    }
    return out;
  }

  function sha256Sync(bytes) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
               0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

    const length = bytes.length;
    const withPadding = new Uint8Array((((length + 8) >> 6) + 1) * 64);
    withPadding.set(bytes);
    withPadding[length] = 0x80;
    const bitLenHi = Math.floor((length / 0x20000000) >>> 0);
    const bitLenLo = (length << 3) >>> 0;
    const view = new DataView(withPadding.buffer);
    view.setUint32(withPadding.length - 8, bitLenHi, false);
    view.setUint32(withPadding.length - 4, bitLenLo, false);

    const w = new Int32Array(64);
    const rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };

    for (let offset = 0; offset < withPadding.length; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    let out = '';
    for (let i = 0; i < H.length; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  function base64UrlEncode(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomString(length) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const array = new Uint8Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (let i = 0; i < length; i++) out += alphabet.charAt(array[i] % alphabet.length);
    return out;
  }

  function encodeUtf8(text) {
    return new TextEncoder().encode(text);
  }

  /* ------------------------------------------------------------ 状态 */
  let profile = null;

  function getProfile() { return profile; }
  function isAdmin() { return !!(profile && profile.is_admin); }

  function saveProfile(data) {
    profile = data;
    try { localStorage.setItem(cfg.keys.profile, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function loadCachedProfile() {
    try {
      const raw = localStorage.getItem(cfg.keys.profile);
      profile = raw ? JSON.parse(raw) : null;
    } catch (e) { profile = null; }
    return profile;
  }

  /* ------------------------------------------------------------ 登录 */
  function showLoginError(message) {
    const box = document.getElementById('login-error');
    if (!box) return;
    box.hidden = false;
    box.textContent = message;
  }

  function clearLoginError() {
    const box = document.getElementById('login-error');
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  /** 用令牌登录：先落盘，再拉取身份验证有效性 */
  async function loginWithToken(token, apiBase) {
    // 仅当用户显式改了基址时才固定下来，探测结果不写死
    if (apiBase && trimSlash(apiBase) !== SS.api.getBaseUrl()) {
      SS.api.setBaseUrl(apiBase);
    }
    const value = (token || '').trim();
    if (!value) throw new SS.ApiError('请填写 Access Token');

    SS.api.setToken(value);
    try {
      const data = await SS.api.auth.profile();
      if (!data.is_admin) {
        SS.api.setToken('');
        const reason = (data.admin_reason && data.admin_reason.length)
          ? ('当前用户未命中管理员判定条件：' + data.admin_reason.join('；'))
          : '当前用户不是管理员，无法进入管理后台';
        throw new SS.ApiError(reason, { code: 'forbidden', status: 403 });
      }
      saveProfile(data);
      return data;
    } catch (err) {
      SS.api.setToken('');
      throw err;
    }
  }

  function trimSlash(url) {
    return (url || '').replace(/\/+$/, '');
  }

  /** Casdoor 授权码 + PKCE */
  async function startCasdoorLogin() {
    const authConfig = await SS.api.auth.config();
    if (!authConfig.client_id) {
      throw new SS.ApiError('后端未配置 CASDOOR_CLIENT_ID，无法发起 Casdoor 登录；请改用「粘贴访问令牌」方式。');
    }
    if (location.protocol === 'file:') {
      throw new SS.ApiError('Casdoor 回调要求 http(s) 地址，请先通过后端 /admin 路径打开管理后台。');
    }

    const verifier = randomString(64);
    const challenge = await sha256Hex(encodeUtf8(verifier)).then(function (hex) {
      return base64UrlEncode(hexToBytes(hex));
    });

    const state = randomString(24);
    try { sessionStorage.setItem('ss.pkce.verifier', verifier); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem('ss.pkce.state', state); } catch (e) { /* ignore */ }

    const redirectUri = location.origin + location.pathname;
    const params = [
      'client_id=' + encodeURIComponent(authConfig.client_id),
      'response_type=code',
      'redirect_uri=' + encodeURIComponent(redirectUri),
      'scope=' + encodeURIComponent((authConfig.scopes || ['openid', 'profile', 'email']).join(' ')),
      'state=' + encodeURIComponent(state),
      'code_challenge=' + encodeURIComponent(challenge),
      'code_challenge_method=S256'
    ];
    if (authConfig.organization) params.push('organization=' + encodeURIComponent(authConfig.organization));

    location.href = authConfig.authorization_endpoint + '?' + params.join('&');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /** 处理 Casdoor 回调：code → token */
  async function handleCasdoorCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;

    const expectedState = sessionStorage.getItem('ss.pkce.state');
    const returnedState = params.get('state');
    if (expectedState && returnedState !== expectedState) {
      throw new SS.ApiError('登录状态校验失败（state 不匹配），请重试。');
    }

    const verifier = sessionStorage.getItem('ss.pkce.verifier') || '';
    const authConfig = await SS.api.auth.config();
    const redirectUri = location.origin + location.pathname;

    const form = new URLSearchParams();
    form.append('grant_type', 'authorization_code');
    form.append('code', code);
    form.append('redirect_uri', redirectUri);
    form.append('client_id', authConfig.client_id || '');
    if (verifier) form.append('code_verifier', verifier);

    const response = await fetch(authConfig.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const payload = await response.json().catch(function () { return {}; });
    const accessToken = payload.access_token || payload.accessToken;
    if (!accessToken) {
      throw new SS.ApiError('换取访问令牌失败：' + (payload.error_description || payload.error || '未知错误'));
    }

    sessionStorage.removeItem('ss.pkce.state');
    sessionStorage.removeItem('ss.pkce.verifier');

    // 清理地址栏上的 code
    window.history.replaceState({}, document.title, location.pathname + location.hash);

    const data = await loginWithToken(accessToken);
    return data;
  }

  function logout() {
    SS.api.setToken('');
    try { localStorage.removeItem(cfg.keys.profile); } catch (e) { /* ignore */ }
    profile = null;
  }

  /* ------------------------------------------------------------ 初始化 */
  async function init() {
    const tabs = document.querySelectorAll('.login-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        document.querySelectorAll('.login-pane').forEach(function (pane) {
          pane.classList.remove('is-active');
        });
        const target = document.getElementById('form-' + tab.dataset.tab);
        if (target) target.classList.add('is-active');
        clearLoginError();
      });
    });

    const baseInput = document.getElementById('input-api-base');
    if (baseInput) {
      baseInput.value = SS.api.getBaseUrl();
      // 用户手动改过就不再被自动探测覆盖
      baseInput.addEventListener('input', function () { baseInput.dataset.touched = '1'; });
    }

    const tokenForm = document.getElementById('form-token');
    if (tokenForm) {
      tokenForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearLoginError();
        const button = document.getElementById('btn-token-login');
        button.disabled = true;
        button.textContent = '验证中…';
        try {
          const data = await loginWithToken(
            document.getElementById('input-token').value,
            document.getElementById('input-api-base').value
          );
          SS.app.enterApp(data);
        } catch (err) {
          showLoginError((err && err.message) || '登录失败');
        } finally {
          button.disabled = false;
          button.textContent = '进入管理后台';
        }
      });
    }

    const casdoorForm = document.getElementById('form-casdoor');
    if (casdoorForm) {
      casdoorForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearLoginError();
        const button = document.getElementById('btn-casdoor-login');
        button.disabled = true;
        button.textContent = '跳转中…';
        try {
          await startCasdoorLogin();
        } catch (err) {
          showLoginError((err && err.message) || '发起登录失败');
          button.disabled = false;
          button.textContent = '使用 Casdoor 账号登录';
        }
      });
    }

    // 探测可用的 API 基址并回填
    const detected = await SS.api.detectBaseUrl();
    if (baseInput && !baseInput.dataset.touched) baseInput.value = detected;

    // 读取 Casdoor 登录参数并给出可用性提示
    SS.api.auth.config().then(function (authConfig) {
      const hint = document.getElementById('casdoor-hint');
      if (!hint) return;
      if (!authConfig.client_id) {
        hint.textContent = '后端尚未配置 CASDOOR_CLIENT_ID，Casdoor 登录暂不可用，请使用「粘贴访问令牌」。';
        document.getElementById('btn-casdoor-login').disabled = true;
      } else if (location.protocol === 'file:') {
        hint.textContent = '已就绪（应用 ' + (authConfig.application || '默认') +
          '，组织 ' + (authConfig.organization || '默认') +
          '，客户端 ' + authConfig.client_id + '）。Casdoor 回调需 http(s) 地址，建议通过后端 /admin 打开。';
      } else {
        hint.textContent = '将跳转到 Casdoor 完成登录（应用 ' + (authConfig.application || '默认') +
          '，组织 ' + (authConfig.organization || '默认') +
          '，客户端 ' + authConfig.client_id + '）。';
      }
    }).catch(function () {
      const hint = document.getElementById('casdoor-hint');
      if (hint) hint.textContent = '无法读取 Casdoor 登录参数（API 基址 ' + detected + ' 不可达），请检查后端服务或手动填写 API 基址。';
    });

    return detected;
  }

  return {
    init: init,
    loginWithToken: loginWithToken,
    startCasdoorLogin: startCasdoorLogin,
    handleCasdoorCallback: handleCasdoorCallback,
    logout: logout,
    getProfile: getProfile,
    isAdmin: isAdmin,
    saveProfile: saveProfile,
    loadCachedProfile: loadCachedProfile,
    showLoginError: showLoginError,
    clearLoginError: clearLoginError
  };
})();
