# 通知系统 API 文档

## 目录结构

* [认证模块 (auth)](#1-认证模块-auth)
* [通知渠道模块 (channels)](#2-通知渠道模块-channels)
* [通知任务模块 (tasks)](#3-通知任务模块-tasks)
* [执行日志模块 (logs)](#4-执行日志模块-logs)
* [数据库初始化 (init)](#5-数据库初始化-init)
* [通用接口 (common)](#6-通用接口-common)

## 1. 认证模块 (auth)

### 1.1 POST /api/auth/login - 用户登录

**请求参数：**

| 参数名   | 类型   | 必填 | 说明       |
| ---------- | -------- | ------ | ------------ |
| password | string | 是   | 管理员密码 |

**请求示例：**

```
{
  "password": "your_password"
}
```

**响应参数：**

| 参数名        | 类型   | 说明               |
| --------------- | -------- | -------------------- |
| code          | number | 状态码，0 表示成功 |
| message       | string | 响应消息           |
| data.username | string | 用户名             |
| data.role     | string | 用户角色           |

**响应示例：**

```
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "username": "admin",
    "role": "administrator"
  }
}
```

**Cookie：** 登录成功后会设置 `token` cookie，有效期 7 天

### 1.2 POST /api/auth/logout - 退出登录

**请求参数：** 无

**响应参数：**

| 参数名  | 类型   | 说明     |
| --------- | -------- | ---------- |
| code    | number | 状态码   |
| message | string | 响应消息 |

**响应示例：**

```
{
  "code": 0,
  "message": "退出成功",
  "data": null
}
```

## 2. 通知渠道模块 (channels)

### 2.1 GET /api/channels - 获取渠道列表（分页）

**请求参数：**

| 参数名     | 类型   | 必填 | 说明                                            |
| ------------ | -------- | ------ | ------------------------------------------------- |
| page       | number | 否   | 页码，默认 1                                    |
| pageSize   | number | 否   | 每页数量，默认 20，最大 100                     |
| type       | string | 否   | 渠道类型筛选（dingtalk/feishu/telegram/resend） |
| is\_active | number | 否   | 启用状态筛选（1=启用，0=禁用）                  |

**响应参数：**

| 参数名             | 类型   | 说明                    |
| -------------------- | -------- | ------------------------- |
| code               | number | 状态码                  |
| data               | array  | 渠道列表                |
| data[].id          | number | 渠道 ID                 |
| data[].name        | string | 渠道名称                |
| data[].type        | string | 渠道类型                |
| data[].config      | string | 渠道配置（JSON 字符串） |
| data[].is\_active  | number | 启用状态                |
| data[].created\_at | string | 创建时间                |
| data[].updated\_at | string | 更新时间                |
| meta.total         | number | 总记录数                |
| meta.page          | number | 当前页码                |
| meta.pageSize      | number | 每页数量                |
| meta.totalPages    | number | 总页数                  |

### 2.2 GET /api/channels/all - 获取所有渠道（不分页）

**请求参数：**

| 参数名     | 类型   | 必填 | 说明         |
| ------------ | -------- | ------ | -------------- |
| type       | string | 否   | 渠道类型筛选 |
| is\_active | number | 否   | 启用状态筛选 |

**响应参数：** 同 2.1 的 data 部分

### 2.3 GET /api/channels/:id - 获取单个渠道详情

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 渠道 ID |

**响应参数：** 同 2.1 的 data 单个对象

### 2.4 POST /api/channels - 创建渠道

**请求参数：**

| 参数名     | 类型   | 必填 | 说明                                        |
| ------------ | -------- | ------ | --------------------------------------------- |
| name       | string | 是   | 渠道显示名称，最大 50 字符                  |
| type       | string | 是   | 渠道类型（dingtalk/feishu/telegram/resend） |
| config     | string | 是   | 渠道配置 JSON 字符串                        |
| is\_active | number | 否   | 启用状态，默认 1                            |

**请求示例：**

```
{
  "name": "工作群 - 钉钉",
  "type": "dingtalk",
  "config": "{\"webhook\":\"https://oapi.dingtalk.com/robot/send?access_token=xxx\"}",
  "is_active": 1
}
```

**响应参数：**

| 参数名  | 类型   | 说明                 |
| --------- | -------- | ---------------------- |
| code    | number | 状态码               |
| message | string | 响应消息             |
| data    | object | 新创建的渠道完整信息 |

### 2.5 PUT /api/channels/:id - 更新渠道

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 渠道 ID |

**请求参数：** （所有字段可选，只更新传入的字段）

| 参数名     | 类型   | 必填 | 说明                 |
| ------------ | -------- | ------ | ---------------------- |
| name       | string | 否   | 渠道名称             |
| type       | string | 否   | 渠道类型             |
| config     | string | 否   | 渠道配置 JSON 字符串 |
| is\_active | number | 否   | 启用状态             |

**响应参数：** 返回更新后的完整渠道信息

### 2.6 PATCH /api/channels/:id/toggle - 切换渠道启用/禁用状态

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 渠道 ID |

**响应参数：**

| 参数名          | 类型   | 说明         |
| ----------------- | -------- | -------------- |
| code            | number | 状态码       |
| message         | string | 响应消息     |
| data.id         | number | 渠道 ID      |
| data.is\_active | number | 新的启用状态 |

### 2.7 DELETE /api/channels/:id - 删除渠道

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 渠道 ID |

**响应参数：**

| 参数名  | 类型   | 说明            |
| --------- | -------- | ----------------- |
| code    | number | 状态码          |
| message | string | 响应消息        |
| data.id | number | 已删除的渠道 ID |

### 2.8 POST /api/channels/test - 测试渠道

**请求参数：**

| 参数名 | 类型   | 必填 | 说明                 |
| -------- | -------- | ------ | ---------------------- |
| type   | string | 是   | 渠道类型             |
| config | string | 是   | 渠道配置 JSON 字符串 |

**响应参数：**

| 参数名       | 类型    | 说明                     |
| -------------- | --------- | -------------------------- |
| code         | number  | 状态码                   |
| message      | string  | 响应消息                 |
| data.success | boolean | 是否发送成功             |
| data.error   | string  | 失败时的错误信息（可选） |

## 3. 通知任务模块 (tasks)

### 3.1 GET /api/tasks - 获取任务列表（分页）

**请求参数：**

| 参数名      | 类型   | 必填 | 说明                                   |
| ------------- | -------- | ------ | ---------------------------------------- |
| page        | number | 否   | 页码，默认 1                           |
| pageSize    | number | 否   | 每页数量，默认 20                      |
| task\_type  | string | 否   | 任务类型（single/recurring/permanent） |
| status      | string | 否   | 状态（active/inactive/finished）       |
| date\_types | string | 否   | 日期类型（all/workday/holiday）        |
| keyword     | string | 否   | 任务名称关键词模糊搜索                 |

**响应参数：**

| 参数名               | 类型   | 说明                                           |
| ---------------------- | -------- | ------------------------------------------------ |
| code                 | number | 状态码                                         |
| data                 | array  | 任务列表                                       |
| data[].id            | number | 任务 ID                                        |
| data[].name          | string | 任务名称                                       |
| data[].description   | string | 任务描述                                       |
| data[].title         | string | 通知标题                                       |
| data[].content       | string | 通知内容（支持 Markdown）                      |
| data[].task\_type    | string | 任务类型                                       |
| data[].execute\_date | string | 执行日期（单次任务）                           |
| data[].start\_date   | string | 开始日期（周期任务）                           |
| data[].end\_date     | string | 结束日期（周期任务）                           |
| data[].frequency     | string | 执行频率 JSON 数组，如`["08:00", "12:00"]` |
| data[].channel\_ids  | string | 渠道 ID 列表 JSON 数组                         |
| data[].date\_types   | string | 日期类型                                       |
| data[].status        | string | 任务状态                                       |
| data[].created\_at   | string | 创建时间                                       |
| data[].updated\_at   | string | 更新时间                                       |
| meta                 | object | 分页信息（同 channels）                        |

### 3.2 GET /api/tasks/active-count - 获取活跃任务数量

**请求参数：** 无

**响应参数：**

| 参数名           | 类型   | 说明         |
| ------------------ | -------- | -------------- |
| code             | number | 状态码       |
| data.activeCount | number | 活跃任务数量 |
| data.totalCount  | number | 总任务数量   |

### 3.3 GET /api/tasks/:id - 获取单个任务详情

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 任务 ID |

**响应参数：** 同 3.1 的 data 单个对象

### 3.4 POST /api/tasks - 创建任务

**请求参数：**

| 参数名        | 类型   | 必填     | 说明                                           |
| --------------- | -------- | ---------- | ------------------------------------------------ |
| name          | string | 是       | 任务名称，最大 100 字符                        |
| description   | string | 否       | 任务描述                                       |
| title         | string | 是       | 通知标题                                       |
| content       | string | 是       | 通知内容（支持 Markdown）                      |
| task\_type    | string | 是       | 任务类型（single/recurring/permanent）         |
| execute\_date | string | 条件必填 | 执行日期（单次任务必填，格式 YYYY-MM-DD）      |
| start\_date   | string | 条件必填 | 开始日期（周期任务必填）                       |
| end\_date     | string | 条件必填 | 结束日期（周期任务必填）                       |
| frequency     | string | 是       | 执行频率 JSON 数组，如`["08:00", "12:00"]` |
| channel\_ids  | string | 是       | 渠道 ID 列表 JSON 数组，如`[1, 2]`         |
| date\_types   | string | 是       | 日期类型（all/workday/holiday）                |
| status        | string | 否       | 任务状态，默认 active                          |

**请求示例：**

```
{
  "name": "每日站会提醒",
  "description": "提醒团队参加每日站会",
  "title": "站会提醒",
  "content": "请准时参加今天的站会",
  "task_type": "recurring",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "frequency": "[\"09:00\", \"09:30\"]",
  "channel_ids": "[1, 2]",
  "date_types": "workday"
}
```

**响应参数：** 返回新创建的任务完整信息

### 3.5 POST /api/tasks/:id/trigger - 手动触发任务

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 任务 ID |

**请求参数：** 无

**响应参数：**

| 参数名                     | 类型    | 说明               |
| ---------------------------- | --------- | -------------------- |
| code                       | number  | 状态码             |
| message                    | string  | 响应消息           |
| data.total                 | number  | 总渠道数           |
| data.success               | number  | 成功数量           |
| data.failed                | number  | 失败数量           |
| data.results               | array   | 各渠道发送结果     |
| data.results[].channelId   | number  | 渠道 ID            |
| data.results[].channelName | string  | 渠道名称           |
| data.results[].success     | boolean | 是否成功           |
| data.results[].error       | string  | 错误信息（失败时） |

### 3.6 PUT /api/tasks/:id - 更新任务

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 任务 ID |

**请求参数：** （所有字段可选，只更新传入的字段） 同 3.4 创建任务的字段，但都可选

**响应参数：** 返回更新后的完整任务信息

### 3.7 PATCH /api/tasks/:id/status - 切换任务状态

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 任务 ID |

**响应参数：**

| 参数名      | 类型   | 说明         |
| ------------- | -------- | -------------- |
| code        | number | 状态码       |
| message     | string | 响应消息     |
| data.id     | number | 任务 ID      |
| data.status | string | 新的任务状态 |

### 3.8 DELETE /api/tasks/:id - 删除任务

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 任务 ID |

**响应参数：**

| 参数名  | 类型   | 说明            |
| --------- | -------- | ----------------- |
| code    | number | 状态码          |
| message | string | 响应消息        |
| data.id | number | 已删除的任务 ID |

## 4. 执行日志模块 (logs)

### 4.1 GET /api/logs - 获取日志列表（分页）

**请求参数：**

| 参数名      | 类型   | 必填 | 说明                            |
| ------------- | -------- | ------ | --------------------------------- |
| page        | number | 否   | 页码                            |
| pageSize    | number | 否   | 每页数量                        |
| task\_id    | number | 否   | 按任务 ID 筛选                  |
| channel\_id | number | 否   | 按渠道 ID 筛选                  |
| status      | string | 否   | 执行结果（success/failed）      |
| start\_time | string | 否   | 开始时间（YYYY-MM-DD HH:mm:ss） |
| end\_time   | string | 否   | 结束时间                        |

**响应参数：**

| 参数名                 | 类型   | 说明                       |
| ------------------------ | -------- | ---------------------------- |
| code                   | number | 状态码                     |
| data                   | array  | 日志列表                   |
| data[].id              | number | 日志 ID                    |
| data[].task\_id        | number | 任务 ID                    |
| data[].channel\_id     | number | 渠道 ID                    |
| data[].task\_name      | string | 任务名称（关联查询）       |
| data[].channel\_name   | string | 渠道名称（关联查询）       |
| data[].scheduled\_time | string | 计划执行时间               |
| data[].executed\_at    | string | 实际执行时间               |
| data[].status          | string | 执行状态（success/failed） |
| data[].response        | string | 响应内容（JSON 字符串）    |
| data[].error\_message  | string | 错误信息                   |
| meta                   | object | 分页信息                   |

### 4.2 GET /api/logs/:id - 获取单条日志详情

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 日志 ID |

**响应参数：** 同 4.1 的 data 单个对象

### 4.3 POST /api/logs - 创建执行日志

**请求参数：**

| 参数名          | 类型   | 必填 | 说明                            |
| ----------------- | -------- | ------ | --------------------------------- |
| task\_id        | number | 是   | 任务 ID（正整数）               |
| channel\_id     | number | 是   | 渠道 ID（正整数）               |
| scheduled\_time | string | 是   | 计划执行时间                    |
| status          | string | 是   | 执行状态（success/failed）      |
| response        | string | 否   | 成功时的原始响应（JSON 字符串） |
| error\_message  | string | 否   | 失败时的错误信息                |

**响应参数：** 返回新创建的日志完整信息

### 4.4 DELETE /api/logs/:id - 删除单条日志

**路径参数：**

| 参数名 | 类型   | 说明    |
| -------- | -------- | --------- |
| id     | number | 日志 ID |

**响应参数：**

| 参数名  | 类型   | 说明            |
| --------- | -------- | ----------------- |
| code    | number | 状态码          |
| message | string | 响应消息        |
| data.id | number | 已删除的日志 ID |

### 4.5 DELETE /api/logs - 批量清理日志

**请求参数：** （至少提供一个）

| 参数名   | 类型   | 必填     | 说明                   |
| ---------- | -------- | ---------- | ------------------------ |
| task\_id | number | 条件必填 | 清理指定任务的日志     |
| status   | string | 条件必填 | 清理指定状态的日志     |
| before   | string | 条件必填 | 清理指定日期之前的日志 |

**响应参数：**

| 参数名       | 类型   | 说明           |
| -------------- | -------- | ---------------- |
| code         | number | 状态码         |
| message      | string | 响应消息       |
| data.deleted | number | 清理的日志数量 |

## 5. 数据库初始化 (init)

### 5.1 GET /api/init - 初始化数据库表

**请求参数：** 无

**响应参数：**

| 参数名                             | 类型   | 说明                                 |
| ------------------------------------ | -------- | -------------------------------------- |
| code                               | number | 状态码                               |
| message                            | string | 响应消息                             |
| data.notification\_channels        | string | 表状态（created=新建/exists=已存在） |
| data.notification\_tasks           | string | 表状态                               |
| data.notification\_execution\_logs | string | 表状态                               |

**响应示例：**

```
{
  "code": 0,
  "message": "数据库初始化完成",
  "data": {
    "notification_channels": "created",
    "notification_tasks": "created",
    "notification_execution_logs": "exists"
  }
}
```

## 6. 通用接口 (common)

### 6.1 GET/POST /api/common/notice - 发送通知

**GET 请求参数：**

| 参数名   | 类型   | 必填     | 说明                            |
| ---------- | -------- | ---------- | --------------------------------- |
| title    | string | 条件必填 | 通知标题（与 content 至少一个） |
| content  | string | 条件必填 | 通知内容（与 title 至少一个）   |
| channels | string | 否       | 逗号分隔的渠道类型列表          |

**POST 请求参数：**

| 参数名   | 类型         | 必填     | 说明                         |
| ---------- | -------------- | ---------- | ------------------------------ |
| title    | string       | 条件必填 | 通知标题                     |
| content  | string       | 条件必填 | 通知内容                     |
| channels | array/string | 否       | 渠道类型列表或逗号分隔字符串 |

**响应参数：**

| 参数名       | 类型   | 说明           |
| -------------- | -------- | ---------------- |
| code         | number | 状态码         |
| data.results | array  | 各渠道发送结果 |

### 6.2 GET /api/common/notice-detail - 查看通知详情页

**请求参数：**

| 参数名 | 类型   | 必填 | 说明    |
| -------- | -------- | ------ | --------- |
| id     | number | 是   | 任务 ID |

**响应：** 返回 HTML 页面，展示通知详情（Matrix 风格界面）

## 附录：枚举值说明

### 渠道类型 (CHANNEL\_TYPES)

* `dingtalk` - 钉钉
* `feishu` - 飞书
* `telegram` - Telegram
* `resend` - Resend 邮件

### 任务类型

* `single` - 单次任务
* `recurring` - 周期任务
* `permanent` - 永久任务

### 任务状态

* `active` - 活跃
* `inactive` - 未激活
* `finished` - 已完成

### 日期类型

* `all` - 每天
* `workday` - 仅工作日
* `holiday` - 仅节假日

### 执行状态

* `success` - 成功
* `failed` - 失败

## 统一响应格式

### 成功响应

```
{
  "code": 0,
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

### 带分页的成功响应

```
{
  "code": 0,
  "success": true,
  "message": "查询成功",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### 错误响应

```
{
  "code": -1,
  "success": false,
  "message": "错误信息",
  "data": null
}
```

### HTTP 状态码

* `200` - 成功
* `201` - 创建成功
* `400` - 请求参数错误
* `401` - 未授权
* `404` - 资源不存在
* `500` - 服务器内部错误
