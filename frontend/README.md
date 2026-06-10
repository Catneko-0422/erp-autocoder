# Frontend — ERP 自動編碼系統前端

React 19 + TypeScript + Vite 8 + React Router v7

## 目錄結構

```
frontend/src/
├── api/
│   └── client.ts                 # Axios instance + authApi/adminApi 物件
│
├── contexts/
│   └── AuthContext.tsx            # user, loading, login(), register(), logout(), refreshUser()
│
├── guards/
│   ├── ProtectedRoute.tsx         # 未登入 → /login
│   └── AdminRoute.tsx             # 非 Admin → /not-found (隱藏存在)
│
├── pages/
│   ├── LoginPage.tsx              # 帳號/Email + 密碼登入 (已登入自動跳轉, 區分 locked/pending/錯誤)
│   ├── RegisterPage.tsx           # 註冊 → success 頁面 (倒數 5 秒自動跳轉 /login)
│   ├── DashboardPage.tsx          # 登入後首頁 (Admin 顯示 Admin Panel 入口)
│   ├── ChangePasswordPage.tsx     # 改密碼 → 成功提示後倒數跳轉 /login (可取消返回)
│   ├── NotFoundPage.tsx           # 404 頁面
│   └── admin/
│       ├── AdminLayout.tsx        # 側邊欄佈局 (Users/Pending/Audit Logs)
│       ├── UsersPage.tsx          # 翻頁使用者表格 + CRUD modal (不可自刪)
│       ├── PendingPage.tsx        # 待審核使用者清單
│       └── AuditLogsPage.tsx      # 稽核日誌表
│
├── routes/
│   └── index.tsx                  # 集中定義所有路由
│
├── types/
│   └── index.ts                   # User, AuthResponse, ApiResponse, PendingUser 等介面
│
├── components/
│   └── ui/                        # 共用元件
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
│
├── App.tsx                        # BrowserRouter + AuthProvider + AppRoutes
├── main.tsx                       # 應用程式入口
└── index.css                      # Tailwind CSS entry (@import "tailwindcss")
```

## 開發規範

### 新增一個頁面

1. 在 `pages/` 下建立對應的頁面元件
2. 在 `routes/index.tsx` 中註冊路由
3. 視需求加上 `ProtectedRoute` 或 `AdminRoute` 守衛

### 新增一個 API 端點呼叫

1. 在 `api/client.ts` 的 `authApi` 或 `adminApi` 物件中新增方法
2. 使用 `client` Axios instance（會自動帶 JWT + refresh 401）

## 啟動方式

### Docker (容器內執行)

透過 nginx 提供靜態檔案，`/api` 路徑自動代理至後端容器。

```bash
docker compose up -d frontend
```

### 本機開發

```bash
pnpm install
pnpm dev
```

API URL 透過 `VITE_API_URL` 環境變數設定 (預設 `http://localhost:5000/api`)。

## 角色與頁面存取

| 角色 | 可存取頁面 |
|------|-----------|
| 未登入 | `/login`, `/register` |
| User | `/`, `/change-password` |
| Admin | User 所有頁面 + `/admin/*` (Users/Pending/Audit Logs) |

## 相依套件

| 套件 | 用途 |
|------|------|
| react, react-dom | UI 框架 |
| react-router-dom | 路由管理 |
| axios | HTTP 客戶端 |
| @vitejs/plugin-react | Vite React 支援 |
| babel-plugin-react-compiler | React Compiler 最佳化 |
| tailwindcss | Utility-first CSS |
