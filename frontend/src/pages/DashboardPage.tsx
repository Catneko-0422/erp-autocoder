import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.must_change_password) {
      navigate('/change-password', { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-gray-900">歡迎, {user.username}！</h2>
        <p className="text-sm text-gray-500 mt-2">請選擇以下功能開始作業。</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          className="bg-white rounded-2xl border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => navigate('/coding')}
        >
          <h3 className="text-base font-medium text-gray-900">料號編碼</h3>
          <p className="text-sm text-gray-400 mt-1">依規則樹點選產生 PART NO.</p>
        </button>

        <button
          className="bg-white rounded-2xl border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => navigate('/part-numbers')}
        >
          <h3 className="text-base font-medium text-gray-900">已編碼料號</h3>
          <p className="text-sm text-gray-400 mt-1">檢視所有已產生的料號</p>
        </button>

        {(user.roles?.some((r) => r === 'Admin' || r === 'RuleMaker') || user.role === 'Admin' || user.role === 'RuleMaker') && (
          <button
            className="bg-white rounded-2xl border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => navigate('/rule-tree')}
          >
            <h3 className="text-base font-medium text-gray-900">規則樹編輯</h3>
            <p className="text-sm text-gray-400 mt-1">管理編碼規則樹</p>
          </button>
        )}

        {(user.roles?.includes('Admin') || user.role === 'Admin') && (
          <button
            className="bg-white rounded-2xl border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => navigate('/admin/users')}
          >
            <h3 className="text-base font-medium text-gray-900">管理後台</h3>
            <p className="text-sm text-gray-400 mt-1">使用者管理、稽核日誌</p>
          </button>
        )}
      </div>
    </div>
  );
}
