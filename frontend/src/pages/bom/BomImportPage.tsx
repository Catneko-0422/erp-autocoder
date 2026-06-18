import { useState, useRef, useEffect, type FormEvent } from 'react';
import { encodeApi, ruleTreeApi } from '../../api/client';
import type { RuleTreeCategory, BomImportResponse } from '../../types';

export function BomImportPage() {
  const [_categories, _setCategories] = useState<RuleTreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'json' | 'csv'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BomImportResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ruleTreeApi.getTree().then(({ data }) => _setCategories(data.data.categories)).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setResult(null);
    try {
      let res;
      if (mode === 'json') {
        const rows = JSON.parse(jsonInput);
        res = await encodeApi.bomImport(rows);
      } else {
        if (!file) return;
        res = await encodeApi.bomImportFile(file);
      }
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '匯入失敗';
      alert(msg);
    } finally {
      setImporting(false);
    }
  };

  const sampleJson = JSON.stringify([
    { part_no: 'C001', part_type: '電容', description: '10uF 50V', material_node_id: '' },
    { part_no: 'R001', part_type: '電阻', description: '1K 1%', mfg_part: 'RC1206', qpa: '4' },
  ], null, 2);

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">BOM 批次匯入</h1>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setMode('json')}
              className={`px-4 py-2 text-sm rounded-lg cursor-pointer border ${
                mode === 'json' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              JSON 貼入
            </button>
            <button
              type="button"
              onClick={() => setMode('csv')}
              className={`px-4 py-2 text-sm rounded-lg cursor-pointer border ${
                mode === 'csv' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              CSV 上傳
            </button>
          </div>

          {mode === 'json' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">JSON 資料</label>
              <textarea
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                rows={10}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`貼入 JSON 陣列...\n\n範例：\n${sampleJson}`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                支援欄位：part_no*, part_type, description, mfg_part, vendor_pn, item_text, design_no, qpa, material_node_id, encoding_fields (JSON 字串)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">CSV 檔案</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-[10px] text-gray-400 mt-1">CSV 需包含欄位標題行，支援 UTF-8 BOM</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={importing || (mode === 'csv' && !file)}
          className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {importing ? '匯入中...' : '開始匯入'}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
              <span className="text-green-700 font-medium">成功：{result.imported}</span>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm">
              <span className="text-yellow-700 font-medium">跳過：{result.skipped}</span>
            </div>
          </div>

          {result.results.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Row</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Part No.</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.row} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-400">{r.row}</td>
                      <td className="px-4 py-2 font-mono font-medium">{r.part_no}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === 'imported' ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                          {r.status === 'imported' ? '已匯入' : '已跳過'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400">{r.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <h3 className="text-xs font-medium text-red-700 mb-2">錯誤 ({result.errors.length})</h3>
              <ul className="text-[11px] text-red-600 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="font-mono">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
