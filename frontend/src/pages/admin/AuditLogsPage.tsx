import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import type { AuditLogEntry } from '../../types';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.auditLogs().then(({ data }) => setLogs(data.data.logs)).finally(() => setLoading(false));
  }, []);

  const actionLabel: Record<string, string> = {
    register: '註冊',
    login: '登入',
    login_failed: '登入失敗',
    change_password: '變更密碼',
    issue_temp_password: '發放臨時密碼',
    approve_user: '核准',
    reject_user: '拒絕',
    update_user: '更新',
    update_self: '更新自身',
    delete_user: '刪除',
    forgot_password_request: '忘記密碼請求',
    forgot_password_approved: '重設密碼核准',
    forgot_password_rejected: '重設密碼拒絕',
  };

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">稽核日誌</h1>
      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400">暫無稽核記錄。</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">操作</th>
                <th className="px-4 py-3">操作者</th>
                <th className="px-4 py-3">目標</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">時間</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{actionLabel[l.action] || l.action}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.actor_id?.slice(0, 8) || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.target_user_id?.slice(0, 8) || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.ip_address || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : '-'}
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
