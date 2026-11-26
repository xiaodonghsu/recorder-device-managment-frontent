# 嘉环声枢 · 录音卡管理后台（frontend）

> 依据根目录 [`README.md`](../README.md)《嘉环声枢：录音卡设备管理系统开发说明》V1.0 开发。
> 面向企业管理员，**按数据表分别管理**录音卡资产的全生命周期。

---

## 1. 部署形态

### 生产：nginx 同源托管（目标形态）

```
浏览器 ──> https://office.uassist.cn:40000
             ├── /voicehub/      → 管理后台静态资源（本目录）
             └── /voicehub-api/  → 后端服务 http://127.0.0.1:8040
```

后端服务配置 `API_PREFIX=/voicehub-api`（见 `backend/.env`），nginx 原样透传路径。
浏览器访问 `https://office.uassist.cn:40000/voicehub/` 即为管理入口。

**nginx 配置样例见 [`nginx.conf.example`](nginx.conf.example)**，要点：

```nginx
location /voicehub/ {            # 管理后台静态资源
    alias /opt/voicehub/frontend/;
    index index.html;
}
location /voicehub-api/ {        # 后端 API，路径原样透传
    proxy_pass http://127.0.0.1:8040;
}
```

> `proxy_pass` **不带 URI 部分**，原始路径才会原样传给后端；
> 若写成 `proxy_pass http://127.0.0.1:8040/voicehub-api/`，前缀会被重复拼一次。

因为 `/voicehub/` 与 `/voicehub-api/` 同源，浏览器不产生跨域请求，**无需 CORS**。

### API 基址自动探测

前端启动时会按优先级依次探测候选基址（`GET {base}/auth/config`），取首个响应成功者：

| 优先级 | 候选 | 适用场景 |
|---|---|---|
| 1 | `/voicehub-api` | nginx 同源代理（生产） |
| 2 | `/api` | 后端自带静态托管（本地开发，`/admin/` 入口） |
| 3 | `http://127.0.0.1:8040/voicehub-api` | `file://` 打开或跨机调试 |

页面路径也会影响排序（在 `/voicehub/` 下优先同源，在 `/admin/` 下优先 `/api`）。
探测结果缓存在 `localStorage`，登录页的「API 基址」可随时手动改写并固定。

### 本地：后端自带托管

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

打开 <http://127.0.0.1:8000/admin/> 即可（此时 `API_PREFIX` 保持默认 `/api`）。

### 本地：独立静态托管

`frontend/` 是纯静态目录，可用任意静态服务器托管：

```bash
cd frontend && python -m http.server 5500
```

打开 <http://127.0.0.1:5500/>，登录页把 **API 基址** 填成
`http://127.0.0.1:8040/voicehub-api`（跨源，需后端 `CORS_ORIGINS` 放行）。

### 直接双击打开

双击 `frontend/index.html` 即可（`file://` 协议），API 基址默认直连后端。

> Casdoor 授权码登录需要 http(s) 回调地址，`file://` 下不可用，请用「粘贴访问令牌」。

---


## 2. 登录方式

| 方式 | 前置条件 | 说明 |
|---|---|---|
| **粘贴访问令牌** | 无 | 从 Casdoor 获取 Access Token 后粘贴。最通用，始终可用 |
| **Casdoor 授权码登录** | Casdoor 应用已登记回调地址 | 跳转 Casdoor 登录，带 **PKCE**（S256）校验 |

已内置的 Casdoor 应用：

| 项 | 值 |
|---|---|
| Casdoor 实例 | `https://uassist.cn/auth`（2026-11-26 起；前端不硬编码，授权端点由后端 `/auth/config` 下发） |
| 应用标识 | `bestlink/voicehub`（组织 owner `bestlink` / 应用 name `voicehub`） |
| clientId | `6932b8ce0b655b9421b5`（公开标识符，已内置默认值） |
| clientSecret | 机密，仅后端使用，由 `backend/.env` 提供 |

> 组织名同时是后端的 `tenant_id`；`/auth/config` 会返回 `organization` 与 `application`，
> 登录页提示中可直接看到当前对接的 Casdoor 组织与应用。应用改名后请核对 clientId 是否变化。

> ⚠️ **Casdoor 后台必须登记「许可跳转列表」（Redirect URLs）**，否则跳转登录页会直接报
> 「重定向 URI 在许可跳转列表中未找到」。前端使用的回调地址是
> `location.origin + location.pathname`，因此需要登记：
>
> - 生产：`https://office.uassist.cn:40000/voicehub/`
> - 本地（后端托管）：`http://127.0.0.1:8000/admin/`

登录时前端会调用 `GET /api/my/profile` 校验身份，**非管理员会被直接拒绝**，
并提示未命中管理员判定的原因（角色 / 用户组 / 权限快照）。

令牌保存在浏览器 `localStorage`，刷新页面自动续用；401 时自动清理并回到登录页。

### 自查令牌

```bash
cd backend
python scripts/whoami.py <access_token>
```

---

## 3. 页面与数据表对应关系

README §3 定义了 6 张核心表，后台为每张表提供独立管理视图：

| 页面 | 对应表 | 主要能力 |
|---|---|---|
| **概览** | 全部（聚合） | 设备总量、生命周期分布、领用排行、事件分布、快捷入口 |
| **设备管理** | `device` | 入库 / 批量入库、档案编辑、生命周期流转、领用、归还、详情抽屉 |
| **设备状态** | `device_status` | 在线、电量、充电、录音、剩余/总容量、实测固件、增益、最近通信与同步时间（只读，数据由 APP 上报） |
| **领用记录** | `device_assignment` | 按状态 / 员工 / SN 筛选，归还操作，历史留痕 |
| **APP 绑定** | `device_binding` | 按状态 / 员工 / 昵称筛选，解除绑定，昵称展示 |
| **设备凭证** | `device_credential` | 版本历史、轮换 AuthKey、撤销凭证 |
| **事件日志** | `device_event` | 按事件类型 / 设备 / 操作人筛选，JSON 详情查看 |

### 设备详情抽屉

在「设备管理」列表点 **详情** 打开右侧抽屉，内含 5 个页签：

- **概览** —— 档案全部字段、当前领用与绑定关系、在线状态
- **领用记录** —— 该设备的全部领用历史
- **APP 绑定** —— 该设备的全部绑定历史（含历史昵称）
- **设备凭证** —— 凭证版本历史，可直接轮换 / 撤销
- **生命周期事件** —— 该设备的完整事件流水

抽屉底部提供分配、归还、解除绑定、编辑档案、变更状态等快捷操作。

---

## 4. 目录结构

```
frontend/
├── index.html                 # 入口（唯一的 HTML）
├── nginx.conf.example         # nginx 反向代理配置样例
├── README.md
└── assets/
    ├── css/
    │   ├── base.css           # 设计令牌（海军蓝色板）、重置、排版、打印样式
    │   ├── layout.css         # 登录页、侧边栏、顶栏、内容区
    │   └── components.css     # 卡片、按钮、表单、徽章、表格、分页、模态框、抽屉、Toast
    └── js/
        ├── config.js          # 运行配置与业务字典（状态 / 事件类型标签、API 基址候选）
        ├── api.js             # API 客户端：基址探测、查询串、Bearer、统一错误结构
        ├── ui.js              # 通用组件：Toast、确认框、模态框、抽屉、表单、表格、分页
        ├── auth.js            # 登录：令牌粘贴、Casdoor + PKCE、身份与管理员判定
        ├── actions.js         # 设备操作：分配 / 归还 / 解绑 / 编辑 / 流转 / 凭证 / 详情抽屉
        ├── app.js             # 应用外壳：导航、哈希路由、页面渲染
        └── pages/
            ├── dashboard.js   # 概览
            ├── devices.js     # 设备管理
            ├── statuses.js    # 设备状态
            ├── assignments.js # 领用记录
            ├── bindings.js    # APP 绑定
            ├── credentials.js # 设备凭证
            └── events.js      # 事件日志
```

### 技术约定

- **无构建步骤、无外部依赖**：不引入 npm 包、不引用 CDN，离线可用。
- **传统 `<script>` 加载**（非 ES Module），因此 `file://` 直接打开也能运行。
- 全局命名空间 `SS`，各模块挂在 `SS.config` / `SS.api` / `SS.ui` / `SS.auth` / `SS.actions` / `SS.app` 上。
- 页面脚本通过 `SS.pages.<名称> = {...}` 自注册，加载顺序无关。
- 样式为纯 CSS 变量主题，改配色只需调整 `base.css` 的 `:root`。

---

## 5. 接口依赖

后台只调用既有 `/api` 接口，另新增一组表格级只读接口。

### 表格级只读接口（本次新增）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tables/assignments` | 领用记录列表（跨设备分页） |
| GET | `/api/tables/bindings` | APP 绑定记录列表 |
| GET | `/api/tables/credentials` | 设备凭证列表 |
| GET | `/api/tables/statuses` | 设备状态列表 |
| GET | `/api/tables/events` | 事件日志列表 |
| GET | `/api/tables/employees` | 员工清单（由领用记录反推，供领用弹窗选人） |
| GET | `/api/tables/overview` | 概览聚合指标 |

写操作全部复用既有设备子资源接口（`/api/devices/{id}/...`），
以保证状态机校验、事务与事件记录不被绕过。

---

## 6. 安全设计

- **不采信客户端提交的 `tenant_id`**：可见范围由服务端从 Token 推导，越权返回 404。
- **AuthKey 明文只出现一次**：入库 / 轮换响应中返回，数据库只存 HMAC-SHA256 摘要；
  后台以醒目提示 + 复制按钮呈现，并可一键导出 CSV。
- **凭证历史不返回明文**：`device_credential` 列表只展示版本号与状态。
- **确认类操作有二次确认**：凭证轮换 / 撤销、解绑、报废均需确认弹窗。
- **管理员前置校验**：登录即校验 `is_admin`，非管理员无法进入任何页面。

---

## 7. 已知限制

1. **设备状态依赖 APP 上报**：录音卡固件不与后端通信，电量 / 充电 / 录音状态，
   以及剩余/总容量、实测固件版本、增益档位（1–3）与 `metrics` 扩展遥测，
   均由员工 APP 通过 `PUT /api/my/devices/{id}/status` 代报（见 `backend/README.md` §5.4.1）。
   状态页展示「存储容量」（带已用比例条）、「固件」、「增益」三列，设备详情抽屉同步展示；
   这里的「固件」是 APP 实测值，档案里的固件版本仍由管理员维护。
   未接入上报的设备仍显示入库时的初始记录；`online` 由服务端按最近通信时间判定，
   默认超过 300 秒未心跳即离线。页面顶部有说明。
2. **员工下拉仅覆盖本企业已领用过设备的人**：Casdoor 未配置 `CASDOOR_CLIENT_ID` 时
   无法列出组织成员，领用弹窗里可以手动填写用户名 / 用户 ID。
3. **分页由服务端驱动**：前端不缓存列表，每次筛选都重新请求。

---

## 8. 本地演示数据

需要在无真实设备的情况下体验界面时，可生成一批演示数据：

```bash
cd backend
python scripts/seed_demo.py --reset --count 24
```

会造出 24 台设备，覆盖入库、领用、绑定、归还、维修、挂失、禁用、报废等状态，
并填充凭证、状态与事件记录。
