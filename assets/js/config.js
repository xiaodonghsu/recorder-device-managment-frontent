/* ==========================================================================
   全局配置与业务字典
   所有页面共享 window.SS 命名空间，避免构建步骤。
   ========================================================================== */
window.SS = window.SS || {};

/** 页面注册表：各页面脚本在加载时挂到此处 */
SS.pages = SS.pages || {};

SS.config = {
  appName: '嘉环声枢',
  appSubtitle: '录音卡设备管理后台',

  /** 默认分页条数（后端上限 200） */
  pageSize: 20,
  pageSizeOptions: [20, 50, 100, 200],

  /** localStorage 键名 */
  keys: {
    token: 'ss.token',
    apiBase: 'ss.apiBase',
    profile: 'ss.profile',
    detectedBase: 'ss.detectedBase'
  },

  /**
   * 后端 API 基址候选（按优先级排列）。
   *
   * 前端启动时依次探测每个候选（GET {base}/auth/config），
   * 取首个响应成功者作为当前 API 基址，并缓存到 localStorage。
   *
   * - `/voicehub-api`  nginx 同源反向代理（生产部署走这条）
   * - `/api`           后端自带静态托管时的默认前缀（本地开发）
   * - 直连地址         file:// 打开或跨机调试时使用
   */
  apiCandidates: [
    '/voicehub-api',
    '/api',
    'http://127.0.0.1:8040/voicehub-api'
  ],

  /** 部署信息（登录页提示与文档用） */
  deploy: {
    adminEntry: 'https://office.uassist.cn:40000/voicehub/',
    backendApi: 'http://127.0.0.1:8040/voicehub-api',
    fileProtocolApiBase: 'http://127.0.0.1:8040/voicehub-api'
  },

  /** 生命周期状态字典（README §3.1） */
  lifecycle: {
    registered: { label: '已登记', tone: 'muted' },
    active:    { label: '正常可用', tone: 'ok' },
    disabled:  { label: '已禁用', tone: 'err' },
    lost:      { label: '已挂失', tone: 'err' },
    repair:    { label: '维修中', tone: 'warn' },
    retired:   { label: '已报废', tone: 'muted' }
  },

  /** APP 绑定状态字典（README §3.4） */
  bindingStatus: {
    active:  { label: '绑定中', tone: 'ok' },
    unbound: { label: '已解绑', tone: 'muted' },
    revoked: { label: '已撤销', tone: 'err' }
  },

  /** 设备凭证状态字典（README §3.2） */
  credentialStatus: {
    active:  { label: '有效', tone: 'ok' },
    revoked: { label: '已撤销', tone: 'muted' }
  },

  /** 事件类型字典（README §3.6 + 扩展） */
  eventTypes: {
    device_registered:     { label: '设备入库', tone: 'info' },
    device_activated:     { label: '设备激活', tone: 'ok' },
    device_assigned:      { label: '分配领用', tone: 'info' },
    device_returned:      { label: '设备归还', tone: 'muted' },
    device_bound:         { label: 'APP 绑定', tone: 'ok' },
    device_unbound:       { label: 'APP 解绑', tone: 'muted' },
    binding_revoked:      { label: '撤销绑定', tone: 'warn' },
    nickname_updated:     { label: '修改昵称', tone: 'muted' },
    credential_rotated:   { label: '凭证轮换', tone: 'purple' },
    credential_revoked:   { label: '凭证撤销', tone: 'warn' },
    device_disabled:      { label: '设备禁用', tone: 'err' },
    device_enabled:       { label: '设备启用', tone: 'ok' },
    device_lost:          { label: '设备挂失', tone: 'err' },
    device_repaired:      { label: '转入维修', tone: 'warn' },
    device_retired:       { label: '设备报废', tone: 'muted' },
    device_profile_updated: { label: '档案更新', tone: 'muted' },
    device_status_changed:  { label: '状态上报', tone: 'info' }
  },

  /** 设备状态：固件不联网，由员工 APP 在蓝牙同步时代报 */
  statusNote: '录音卡固件不与后端通信，电量 / 充电 / 录音 / 容量 / 实测固件 / 增益均由员工 APP 上报。' +
              'online 由服务端按最近通信时间判定（默认超过 300 秒未心跳即离线），' +
              '未接入 APP 上报的设备仍显示初始的离线与空值。' +
              '「固件」列是 APP 实测版本，设备档案里的固件版本仍由管理员维护。'
};
