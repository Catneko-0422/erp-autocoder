import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../api/client';
import type { User } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface EditData {
  username: string;
  email: string;
  role: string;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editData, setEditData] = useState<EditData>({ username: '', email: '', role: '' });

  const fetch = async (p: number) => {
    setLoading(true);
    try {
      const { data } = await adminApi.users(p);
      setUsers(data.data.users);
      setPage(data.data.page);
      setPages(data.data.pages);
      setTotal(data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(page); }, []);

  const handleApprove = async (id: string) => { await adminApi.approveUser(id); fetch(page); };
  const handleReject = async (id: string) => { await adminApi.rejectUser(id); fetch(page); };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此使用者？')) return;
    try {
      await adminApi.deleteUser(id);
      fetch(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '刪除失敗';
      setError(msg);
    }
  };

  const handleTempPassword = async (id: string) => {
    const { data } = await adminApi.issueTempPassword(id);
    setTempPw(data.data.temp_password);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditData({ username: u.username, email: u.email, role: (u.roles || ['User'])[0] });
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    await adminApi.updateUser(editTarget.id, editData as unknown as Record<string, unknown>);
    setEditTarget(null);
    fetch(page);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-50 text-green-700',
      pending: 'bg-yellow-50 text-yellow-700',
      rejected: 'bg-red-50 text-red-600',
      locked: 'bg-gray-100 text-gray-500',
    };
    return `inline-block px-2 py-0.5 rounded text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-500'}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">使用者 ({total})</h1>
      </div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 text-red-500 hover:text-red-700 cursor-pointer" onClick={() => setError('')}>x</button>
        </div>
      )}

      {tempPw && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
          <span className="font-medium text-blue-700">臨時密碼：</span>
          <code className="text-blue-900 font-mono bg-blue-100 px-2 py-0.5 rounded">{tempPw}</code>
          <div className="mt-2 flex gap-2">
            <button
              className="text-blue-600 hover:underline text-xs cursor-pointer"
              onClick={() => { navigator.clipboard.writeText(tempPw); setTempPw(null); }}
            >
              複製並關閉
            </button>
            <button
              className="text-blue-600 hover:underline text-xs cursor-pointer"
              onClick={() => { setTempPw(null); navigate('/change-password'); }}
            >
              前往變更密碼
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">帳號</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3"><span className={statusBadge(u.status)}>{u.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{u.roles?.join(', ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.status === 'pending' && (
                          <>
                            <button className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-md hover:bg-green-100 cursor-pointer" onClick={() => handleApprove(u.id)}>核准</button>
                            <button className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100 cursor-pointer" onClick={() => handleReject(u.id)}>拒絕</button>
                          </>
                        )}
                        {me?.id !== u.id && <button className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 cursor-pointer" onClick={() => openEdit(u)}>編輯</button>}
                        <button className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 cursor-pointer" onClick={() => handleTempPassword(u.id)}>重設密碼</button>
                        {me?.id !== u.id && <button className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100 cursor-pointer" onClick={() => handleDelete(u.id)}>刪除</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                disabled={page <= 1}
                onClick={() => fetch(page - 1)}
              >
                上一頁
              </button>
              <span className="text-xs text-gray-400">第 {page} / {pages} 頁</span>
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                disabled={page >= pages}
                onClick={() => fetch(page + 1)}
              >
                下一頁
              </button>
            </div>
          )}
        </>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">編輯使用者</h2>
            <form onSubmit={handleEdit}>
              <Input label="帳號" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} required />
              <Input label="Email" type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} required />
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">角色</label>
                  <select
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:border-blue-500"
                    value={editData.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  >
                    <option value="User">User</option>
                    <option value="RuleMaker">RuleMaker</option>
                    <option value="Admin">Admin</option>
                  </select>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer" onClick={() => setEditTarget(null)}>取消</button>
                <Button type="submit">儲存</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
