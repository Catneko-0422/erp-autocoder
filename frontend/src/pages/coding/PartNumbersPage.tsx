import { useEffect, useState } from 'react';
import { encodeApi } from '../../api/client';
import type { PartNumber } from '../../types';

export function PartNumbersPage() {
  const [items, setItems] = useState<PartNumber[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = async (p: number) => {
    setLoading(true);
    try {
      const { data } = await encodeApi.list(p);
      setItems(data.data.part_numbers);
      setPage(data.data.page);
      setTotal(data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(1); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">已編碼料號 ({total})</h1>
      </div>

      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">暫無已編碼料號。</p>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3">PART NO.</th>
                  <th className="px-4 py-3">Part Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Design No.</th>
                  <th className="px-4 py-3">QPA</th>
                  <th className="px-4 py-3">建立時間</th>
                </tr>
              </thead>
              <tbody>
                {items.map((pn) => (
                  <tr key={pn.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{pn.part_no}</td>
                    <td className="px-4 py-3 text-gray-600">{pn.part_type || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{pn.description || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{pn.design_no || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{pn.qpa != null ? pn.qpa : '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(pn.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
              disabled={page <= 1}
              onClick={() => fetch(page - 1)}
            >
              上一頁
            </button>
            <span className="text-xs text-gray-400">第 {page} 頁</span>
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
              disabled={items.length < 20}
              onClick={() => fetch(page + 1)}
            >
              下一頁
            </button>
          </div>
        </>
      )}
    </div>
  );
}
