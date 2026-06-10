import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const role = user.role || (user.roles && user.roles[0]) || 'User';
  const isAdmin = user.roles?.includes('Admin') || user.role === 'Admin';
  const isRuleMaker = isAdmin || user.roles?.includes('RuleMaker') || user.role === 'RuleMaker';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600" onClick={() => navigate('/')}>
            ERP 自動編碼系統
          </h1>
          <nav className="flex items-center gap-1">
            <NavBtn to="/coding" label="料號編碼" />
            <NavBtn to="/part-numbers" label="已編碼料號" />
            {isRuleMaker && <NavBtn to="/rule-tree" label="規則樹編輯" />}
            {isAdmin && <NavBtn to="/admin/users" label="管理後台" />}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{user.username} <span className="text-gray-400">({role})</span></span>
          <button
            className="text-xs text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
          >
            登出
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function NavBtn({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  const isActive = location.pathname.startsWith(to);
  return (
    <button
      className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
      }`}
      onClick={() => navigate(to)}
    >
      {label}
    </button>
  );
}
