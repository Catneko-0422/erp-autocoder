import { useEffect, useRef, useState } from 'react';
import { encodeApi } from '../../api/client';
import type { PartNumber } from '../../types';

export function PartNumbersPage() {
  const [items, setItems] = useState<PartNumber[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此料號？')) return;
    setDeleting(id);
    try {
      await encodeApi.deletePartNumber(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch {
      alert('刪除失敗');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((p) => p.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`確定要刪除選取的 ${selected.size} 筆料號？`)) return;
    setBatchDeleting(true);
    try {
      await encodeApi.batchDeletePartNumber([...selected]);
      setSelected(new Set());
      await fetch(page);
    } catch {
      alert('批量刪除失敗');
    } finally {
      setBatchDeleting(false);
    }
  };

  useEffect(() => { fetch(1); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">已編碼料號 ({total})</h1>
        {selected.size > 0 && (
          <button
            className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-30 cursor-pointer"
            disabled={batchDeleting}
            onClick={handleBatchDelete}
          >
            {batchDeleting ? '刪除中...' : `刪除選取 (${selected.size})`}
          </button>
        )}
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
                  <th className="px-4 py-3 w-8">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="cursor-pointer"
                      checked={items.length > 0 && selected.size === items.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3">PART NO.</th>
                  <th className="px-4 py-3">Part Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Design No.</th>
                  <th className="px-4 py-3">QPA</th>
                  <th className="px-4 py-3">建立時間</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((pn) => (
                  <tr key={pn.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={selected.has(pn.id)}
                        onChange={() => toggleSelect(pn.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{pn.part_no}</td>
                    <td className="px-4 py-3 text-gray-600">{pn.part_type || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{pn.description || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{pn.design_no || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{pn.qpa != null ? pn.qpa : '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(pn.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                        disabled={deleting === pn.id}
                        onClick={() => handleDelete(pn.id)}
                      >
                        {deleting === pn.id ? '刪除中...' : '刪除'}
                      </button>
                    </td>
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
