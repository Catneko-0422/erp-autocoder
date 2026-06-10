# API 端點文件 (API Reference)

Base URL: `http://localhost:5000/api`

所有需要認證的端點需在 Header 帶入：

```
Authorization: Bearer <access_token>
```

---

## 認證 (Auth)

### POST /api/auth/register

一般使用者註冊。

**Request Body:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "secure_password_123"
}
```

**Response (201):**

```json
{
  "message": "註冊成功，請等待管理員審核。",
  "user_id": "uuid-here"
}
```

**Response (409):**

```json
{
  "error": "username 或 email 已被使用"
}
```

---

### POST /api/auth/login

使用 username 或 email 登入。

**Request Body:**

```json
{
  "login": "john_doe",
  "password": "secure_password_123"
}
```

`login` 欄位接受 username 或 email，自動判別。

**Response (200):**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "User",
    "status": "active"
  },
  "must_change_password": false
}
```

**Error Responses:**

| 狀態碼 | 情境 |
|---|---|
| 401 | 帳號不存在或密碼錯誤 |
| 403 | 帳號為 `pending` / `locked` 狀態 |
| 429 | 超過速率限制 |

---

### POST /api/auth/refresh

刷新 Access Token。

**Request Body:**

```json
{
  "refresh_token": "eyJ..."
}
```

**Response (200):**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

---

### POST /api/auth/change-password

修改密碼（可用於首次強制改密碼或自願改密碼）。

**Request Body:**

```json
{
  "current_password": "old_password",
  "new_password": "new_secure_password",
  "confirm_password": "new_secure_password"
}
```

**Response (200):**

```json
{
  "message": "密碼修改成功"
}
```

---

### GET /api/auth/me

取得目前登入使用者資訊。

**Response (200):**

```json
{
  "id": "uuid",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "User",
  "status": "active",
  "created_at": "2026-01-01T00:00:00+00:00"
}
```

---

## 管理員 (Admin)

所有 Admin 端點需要 `Admin` 角色。

### GET /api/admin/pending-users

取得待審核使用者列表。

**Response (200):**

```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "created_at": "2026-01-01T00:00:00+00:00"
    }
  ]
}
```

---

### POST /api/admin/approve-user/:id

核准使用者。

**Response (200):**

```json
{
  "message": "使用者已核准，角色為 User"
}
```

---

### POST /api/admin/reject-user/:id

拒絕使用者。

**Response (200):**

```json
{
  "message": "使用者已拒絕"
}
```

---

### POST /api/admin/issue-temp-password

管理員為使用者發送臨時密碼。

**Request Body:**

```json
{
  "user_id": "uuid",
  "temp_password": "TempPass_001"
}
```

**Response (200):**

```json
{
  "message": "臨時密碼已設定，使用者下次登入後須修改密碼"
}
```

---

### GET /api/admin/users

取得所有使用者列表（含狀態）。

**Response (200):**

```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "status": "active",
      "role": "User",
      "created_at": "2026-01-01T00:00:00+00:00",
      "last_login_at": "2026-06-01T00:00:00+00:00"
    }
  ]
}
```

---

### GET /api/admin/audit-logs

取得稽核日誌。

**Query Parameters:**

| 參數 | 型別 | 說明 |
|---|---|---|
| page | int | 頁碼 (預設 1) |
| per_page | int | 每頁筆數 (預設 20) |
| action | string | 過濾動作代碼 |

**Response (200):**

```json
{
  "logs": [
    {
      "id": 1,
      "actor": "admin",
      "action": "APPROVE_USER",
      "target_user": "john_doe",
      "ip_address": "192.168.1.100",
      "details": {},
      "created_at": "2026-06-01T00:00:00+00:00"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 20
}
```

---

## 規則樹 (Rule Tree)

需要 `RuleMaker` 或 `Admin` 角色。

### GET /api/rule-tree

取得完整的規則樹（所有分類 + 巢狀節點）。

**Response (200):**

```json
{
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "2025電子機構料號編碼原則",
        "prefix": "1",
        "description": "...",
        "sort_order": 1,
        "nodes": [
          {
            "id": "uuid",
            "category_id": "uuid",
            "parent_id": null,
            "label": "電子材料",
            "code_segment": "1",
            "field_type": "options",
            "fixed_value": null,
            "description": "...",
            "sort_order": 1,
            "children": [...]
          }
        ]
      }
    ]
  }
}
```

---

### POST /api/rule-tree/categories

新增分類。

**Request Body:**

```json
{
  "name": "2026新版編碼原則",
  "prefix": "2",
  "description": "新版編碼規則",
  "sort_order": 2
}
```

### PUT /api/rule-tree/categories/:id

更新分類。

### DELETE /api/rule-tree/categories/:id

刪除分類（連同所有節點）。

### POST /api/rule-tree/nodes

新增節點。

**Request Body:**

```json
{
  "category_id": "uuid",
  "parent_id": null,
  "label": "PCB板",
  "code_segment": "01",
  "field_type": "fixed",
  "fixed_value": null,
  "description": "印刷電路板",
  "sort_order": 1
}
```

`field_type` 可選值: `options`（選擇集）、`option`（選項）、`input`（輸入）、`fixed`（固定值）

### PUT /api/rule-tree/nodes/:id

更新節點。

### DELETE /api/rule-tree/nodes/:id

刪除節點（連同子節點）。

---

## 編碼 (Encode)

需要登入。

### POST /api/encode

產生料號。

**Request Body:**

```json
{
  "category_id": "uuid",
  "part_no": "1010302321305HF0",
  "description": "FR-4 雙面板 1.6mm"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "uuid",
    "part_no": "1010302321305HF0",
    "description": "FR-4 雙面板 1.6mm"
  }
}
```

### POST /api/encode/check

檢查料號是否已存在。

**Request Body:**

```json
{
  "part_no": "1010302321305HF0"
}
```

**Response (200):**

```json
{
  "exists": false
}
```

---

## 通用錯誤回應格式

```json
{
  "error": "錯誤訊息",
  "details": {}
}
```
