import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';

interface ResetRequest {
  id: string;
  user_id: string;
  username: string | null;
  identifier: string;
  status: string;
  created_at: string;
  handled_at: string | null;
}

export function PasswordResetsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.passwordResets();
      setRequests(data.data.requests);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleApprove = async (id: string) => {
    const { data } = await adminApi.approvePasswordReset(id);
    setTempPw(data.data.temp_password);
    fetch();
  };

  const handleReject = async (id: string) => {
    await adminApi.rejectPasswordReset(id);
    fetch();
  };

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">重設密碼請求</h1>

      {tempPw && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
          <span className="font-medium text-blue-700">臨時密碼：</span>
          <code className="text-blue-900 font-mono bg-blue-100 px-2 py-0.5 rounded">{tempPw}</code>
          <button
            className="ml-3 text-blue-600 hover:underline text-xs cursor-pointer"
            onClick={() => { navigator.clipboard.writeText(tempPw); setTempPw(null); }}
          >
            複製並關閉
          </button>
        </div>
      )}

      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400">暫無重設密碼請求。</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">使用者</th>
                <th className="px-4 py-3">帳號 / Email</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3">申請時間</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{r.username || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.identifier}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                      r.status === 'approved' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {r.status === 'pending' ? '待處理' : r.status === 'approved' ? '已核准' : '已拒絕'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-md hover:bg-green-100 cursor-pointer"
                          onClick={() => handleApprove(r.id)}
                        >
                          核准
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100 cursor-pointer"
                          onClick={() => handleReject(r.id)}
                        >
                          拒絕
                        </button>
                      </div>
                    )}
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
