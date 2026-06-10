import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import type { User } from '../../types';

export function PendingPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.pendingUsers();
      setUsers(data.data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleApprove = async (id: string) => {
    await adminApi.approveUser(id);
    fetch();
  };

  const handleReject = async (id: string) => {
    await adminApi.rejectUser(id);
    fetch();
  };

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">待審核申請</h1>
      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">暫無待審核使用者。</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">帳號</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">註冊時間</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 cursor-pointer"
                      onClick={() => handleApprove(u.id)}
                    >
                      核准
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 cursor-pointer"
                      onClick={() => handleReject(u.id)}
                    >
                      拒絕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
