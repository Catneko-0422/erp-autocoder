# 資料庫設計 (Database Design)

## 資料庫：PostgreSQL 16

初始化腳本位於 `docker/init.sql`，容器首次啟動時自動執行。

## 資料表關係圖

```
┌──────────────┐       ┌──────────────────┐
│    roles     │       │     users        │
├──────────────┤       ├──────────────────┤
│ id (PK)      │◄──────│ id (UUID PK)     │
│ name (UNIQUE)│  ┌────│ username (UNIQUE)│
│ description  │  │    │ email (UNIQUE)   │
└──────────────┘  │    │ password_hash    │
                  │    │ status           │
┌──────────────────┐  ││ must_change_pw   │
│   user_roles     │  ││ failed_attempts  │
├──────────────────┤  ││ last_login_at    │
│ user_id (PK,FK)  │──┘│ created_at       │
│ role_id (PK,FK)  │───└──────────────────┘
└──────────────────┘
       │                      │
       │              ┌───────┴──────────────┐
       │              │                      │
┌──────▼──────┐ ┌─────▼──────────┐  ┌───────▼───────────┐
│ audit_logs  │ │rule_tree_      │  │  rule_tree_nodes  │
├─────────────┤ │categories      │  ├───────────────────┤
│ id (PK)     │ ├────────────────┤  │ id (UUID PK)      │
│ actor_id    │ │ id (UUID PK)   │  │ category_id (FK)  │
│ target_id   │ │ name           │  │ parent_id (FK)→self│
│ action      │ │ prefix         │  │ label             │
│ ip_address  │ │ description    │  │ code_segment      │
│ details     │ │ sort_order     │  │ field_type        │
│ created_at  │ └────────────────┘  │ fixed_value       │
└─────────────┘                     │ description       │
                                    │ sort_order        │
                          ┌─────────┴───────────┐
                          │    part_numbers     │
                          ├─────────────────────┤
                          │ id (UUID PK)        │
                          │ category_id (FK)    │
                          │ part_no             │
                          │ description         │
                          │ created_at          │
                          │ created_by (FK)     │
                          └─────────────────────┘
```

## 資料表說明

### roles

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | SERIAL (PK) | 自動流水號 |
| name | VARCHAR(50) UNIQUE | 角色名稱：`Admin`, `RuleMaker`, `User` |
| description | TEXT | 角色描述 |

預設寫入三筆角色：

| name | description |
|---|---|
| Admin | 資訊管理人員 |
| RuleMaker | 規則制定者 |
| User | 一般審核通過之使用者 |

### users

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | UUID (PK) | 自動產生 UUIDv4 |
| username | VARCHAR(50) UNIQUE | 使用者帳號 |
| email | VARCHAR(255) UNIQUE | 使用者 Email |
| password_hash | TEXT | Argon2 雜湊值 |
| status | VARCHAR(20) | `pending` / `active` / `locked` |
| must_change_password | BOOLEAN | 登入後是否強制跳轉改密碼頁 |
| failed_attempts | INT | 連續登入失敗次數 |
| last_login_at | TIMESTAMPTZ | 最後登入時間 |
| created_at | TIMESTAMPTZ | 建立時間 |

### user_roles

多對多關聯表，連結 users 與 roles。

| 欄位 | 型別 | 說明 |
|---|---|---|
| user_id | UUID (PK, FK→users.id) | 使用者 ID |
| role_id | INT (PK, FK→roles.id) | 角色 ID |

### audit_logs

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | SERIAL (PK) | 自動流水號 |
| actor_id | UUID (FK→users.id) | 操作者（可為 NULL） |
| target_user_id | UUID (FK→users.id) | 被操作對象（可為 NULL） |
| action | VARCHAR(100) | 動作代碼 |
| ip_address | VARCHAR(45) | 操作者 IP |
| details | JSONB | 額外變更資訊 |
| created_at | TIMESTAMPTZ | 建立時間 |

### 常用 Action 代碼

| action | 說明 |
|---|---|
| REGISTER | 使用者註冊 |
| LOGIN_SUCCESS | 登入成功 |
| LOGIN_FAILED | 登入失敗 |
| APPROVE_USER | Admin 核准使用者 |
| REJECT_USER | Admin 拒絕使用者 |
| LOCK_USER | 帳號被鎖定（失敗次數過多） |
| TEMP_PASSWORD_ISSUED | Admin 發送臨時密碼 |
| PASSWORD_CHANGED | 使用者修改密碼 |

### rule_tree_categories

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | UUID (PK) | 自動產生 UUIDv4 |
| name | VARCHAR(200) | 分類名稱（如「2025電子機構料號編碼原則」） |
| prefix | VARCHAR(10) | 前綴碼（如電子材料 = `1`） |
| description | TEXT | 分類說明 |
| sort_order | INT | 排序 |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

### rule_tree_nodes

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | UUID (PK) | 自動產生 UUIDv4 |
| category_id | UUID (FK→rule_tree_categories.id) | 所屬分類 |
| parent_id | UUID (FK→self, nullable) | 父節點（Adjacency List） |
| label | VARCHAR(200) | 節點顯示名稱 |
| code_segment | VARCHAR(10) | 編碼段值 |
| field_type | VARCHAR(20) | 欄位類型: `options` / `option` / `input` / `fixed` |
| fixed_value | VARCHAR(50) | 固定值（僅 field_type=fixed 時使用） |
| description | TEXT | 節點說明 |
| sort_order | INT | 排序 |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

### part_numbers

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | UUID (PK) | 自動產生 UUIDv4 |
| category_id | UUID (FK→rule_tree_categories.id) | 所屬分類 |
| part_no | VARCHAR(50) | 產生的料號 |
| description | TEXT | 料號描述 |
| created_at | TIMESTAMPTZ | 建立時間 |
| created_by | UUID (FK→users.id) | 建立者 |
