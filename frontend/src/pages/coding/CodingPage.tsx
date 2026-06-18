import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { ruleTreeApi, encodeApi, autoEncodeApi } from '../../api/client';
import type { RuleTreeCategory, RuleTreeNode } from '../../types';

function walkToFields(node: RuleTreeNode): { path: RuleTreeNode[]; fields: RuleTreeNode[] } {
  const path = [node];
  let current = node;
  while (current.children.length > 0 && current.children.every((c) => c.sort_order === 0)) {
    current = current.children[0];
    path.push(current);
  }
  const fields = [...current.children]
    .filter((c) => c.sort_order > 0 || c.field_type !== 'option')
    .sort((a, b) => a.sort_order - b.sort_order);
  return { path, fields };
}

function buildPartNo(
  cat: RuleTreeCategory | null,
  pathNodes: RuleTreeNode[],
  fields: RuleTreeNode[],
  fieldValues: Record<string, string>,
): string {
  if (!cat || pathNodes.length === 0) return '';
  const parts: string[] = [];
  if (cat.prefix) parts.push(cat.prefix);
  for (const p of pathNodes) {
    if (p.code_segment) parts.push(p.code_segment);
  }
  for (const f of fields) {
    if (f.field_type === 'option' || f.field_type === 'options') {
      const cid = fieldValues[f.id];
      if (cid) {
        const c = f.children.find((x) => x.id === cid);
        if (c) parts.push(c.code_segment);
      }
    } else if (f.field_type === 'input') {
      const v = fieldValues[f.id];
      if (v) parts.push(v);
    } else if (f.field_type === 'fixed' && f.fixed_value) {
      parts.push(f.fixed_value);
    }
  }
  return parts.join('');
}

function confidenceColor(score: number) {
  if (score >= 0.95) return 'bg-green-100 text-green-700 border-green-200';
  if (score >= 0.8) return 'bg-yellow-50 text-yellow-600 border-yellow-200';
  if (score >= 0.6) return 'bg-orange-50 text-orange-500 border-orange-200';
  return 'bg-red-50 text-red-500 border-red-200';
}

function FieldOption({ field, selected, onSelect, confidence }: { field: RuleTreeNode; selected: string; onSelect: (id: string) => void; confidence?: number }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-2">
        {field.label}
        {confidence !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${confidenceColor(confidence)}`}>
            {Math.round(confidence * 100)}%
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {field.children.sort((a, b) => a.sort_order - b.sort_order).map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-all ${
              selected === opt.id
                ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="font-mono mr-1">{opt.code_segment}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PartNoPreview({ partNo, materialLabel }: { partNo: string; materialLabel: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
      <div className="text-[10px] text-gray-400 mb-1.5">{materialLabel}</div>
      <div className="font-mono text-lg tracking-widest font-bold">
        {partNo.split('').map((ch, i) => (
          <span key={i} className="text-blue-600">{ch}</span>
        ))}
        {!partNo && <span className="text-gray-300">請選擇欄位</span>}
      </div>
      <div className="text-[10px] text-gray-400 mt-1 font-mono">{partNo || '-'}</div>
    </div>
  );
}

export function CodingPage() {
  const [categories, setCategories] = useState<RuleTreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [catId, setCatId] = useState('');
  const [matId, setMatId] = useState<string | null>(null);
  const [childMatId, setChildMatId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoError, setAutoError] = useState('');
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, number>>({});
  const [exists, setExists] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [designNo, setDesignNo] = useState('');
  const [qpa, setQpa] = useState('');
  const [partType, setPartType] = useState('');
  const [description, setDescription] = useState('');
  const [mfgPart, setMfgPart] = useState('');
  const [vendorPn, setVendorPn] = useState('');
  const [itemText, setItemText] = useState('');

  useEffect(() => { ruleTreeApi.getTree().then(({ data }) => setCategories(data.data.categories)).finally(() => setLoading(false)); }, []);

  const cat = categories.find((c) => c.id === catId) || null;
  const matNode = cat?.nodes.find((n) => n.id === matId) || null;

  // If current node has 'fixed' children → these are sub-materials to choose from
  const subMaterials = useMemo(() => {
    if (!matNode) return [];
    return matNode.children
      .filter((c) => c.field_type === 'fixed')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [matNode]);

  // Actual node to walk fields from (sub-material or the group itself)
  const activeNode = useMemo(() => {
    if (!matNode) return null;
    if (childMatId) {
      // walkToFields from the child sub-material
      const find = (nodes: RuleTreeNode[]): RuleTreeNode | null => {
        for (const n of nodes) {
          if (n.id === childMatId) return n;
          const r = find(n.children);
          if (r) return r;
        }
        return null;
      };
      return find(matNode.children);
    }
    return matNode;
  }, [matNode, childMatId]);

  // Path includes group node + child node (if selected)
  const { path: pathNodes, fields } = useMemo(() => {
    if (!matNode) return { path: [], fields: [] };
    // If sub-material is selected, path = [group, child], walk fields from child
    if (childMatId && activeNode) {
      const r = walkToFields(activeNode);
      return { path: [matNode, ...r.path], fields: r.fields };
    }
    // If group has fixed children → show them as sub-material buttons, no fields yet
    if (subMaterials.length > 0) {
      // Don't auto-descend into fixed children, let user choose
      // But walk from group itself if it has non-fixed children (legacy)
      if (matNode.children.some((c) => c.field_type !== 'fixed')) {
        return walkToFields(matNode);
      }
      return { path: [], fields: [] };
    }
    return walkToFields(matNode);
  }, [matNode, childMatId, activeNode, subMaterials.length]);

  const partNo = useMemo(() => buildPartNo(cat, pathNodes, fields, fieldValues), [cat, pathNodes, fields, fieldValues]);

  useEffect(() => {
    if (partNo) {
      encodeApi.check(partNo).then(({ data }) => setExists(data.data.exists));
    } else {
      setExists(false);
    }
  }, [partNo]);

  const handleFieldSelect = (fieldId: string, value: string) => {
    setAutoError('');
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setFieldConfidences((prev) => ({ ...prev, [fieldId]: 0 }));
  };

  const handleAutoFill = async () => {
    setAutoFilling(true);
    setAutoError('');
    try {
      const { data } = await autoEncodeApi.predict({
        material_node_id: (activeNode ?? matNode)?.id,
        part_type: partType,
        description,
        mfg_part: mfgPart,
        vendor_pn: vendorPn,
        item_text: itemText,
      });
      if (data.data?.field_predictions) {
        setFieldValues((prev) => ({ ...prev, ...data.data.field_predictions }));
        setFieldConfidences(data.data.field_confidences || {});
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'AI填充失敗';
      setAutoError(msg);
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSelectMaterial = (id: string) => {
    setMatId(id);
    setChildMatId(null);
    setFieldValues({});
    setResult(null);
  };

  const handleSelectChild = (id: string) => {
    setChildMatId(id);
    setFieldValues({});
    setResult(null);
  };

  const handleClear = () => {
    setMatId(null);
    setChildMatId(null);
    setFieldValues({});
    setFieldConfidences({});
    setResult(null);
  };

  const handleBack = () => {
    if (childMatId) {
      setChildMatId(null);
      setFieldValues({});
      setFieldConfidences({});
      setResult(null);
    } else {
      handleClear();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await encodeApi.encode({
        part_no: partNo,
        design_no: designNo || null,
        qpa: qpa ? parseFloat(qpa) : null,
        part_type: partType || null,
        description: description || null,
        mfg_part: mfgPart || null,
        vendor_pn: vendorPn || null,
        item_text: itemText || null,
        material_node_id: (activeNode ?? matNode)?.id || null,
        encoding_fields: Object.keys(fieldValues).length > 0 ? fieldValues : null,
      });
      setResult(data.data.part_no);
      setMatId(null);
      setChildMatId(null);
      setFieldValues({});
    } catch {
      // error handled by interceptor
    }
  };

  const allFieldsComplete = fields.every((f) => {
    if (f.field_type === 'fixed') return true;
    if (f.field_type === 'option' || f.field_type === 'options') return !!fieldValues[f.id];
    if (f.field_type === 'input') return (fieldValues[f.id] || '').length > 0;
    return false;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">料號編碼</h1>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">選擇分類</label>
        <select
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white"
          value={catId}
          onChange={(e) => { setCatId(e.target.value); setMatId(null); setChildMatId(null); setFieldValues({}); setResult(null); }}
        >
          <option value="">-- 請選擇 --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.prefix ? ` (prefix: ${c.prefix})` : ''}</option>
          ))}
        </select>
      </div>

      {cat && !matId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">選擇材料類別</h2>
          <div className="flex flex-wrap gap-2">
            {cat.nodes.sort((a, b) => a.sort_order - b.sort_order).map((n) => (
              <button
                key={n.id}
                onClick={() => handleSelectMaterial(n.id)}
                className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <span className="font-mono text-blue-600 font-bold mr-1.5">{n.code_segment}</span>
                <span className="text-gray-800">{n.label}</span>
                {n.description && <span className="block text-[10px] text-gray-400 mt-0.5">{n.description}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {cat && matNode && !childMatId && subMaterials.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleClear} className="text-xs text-gray-400 hover:text-blue-600 cursor-pointer">&larr; 返回材料選擇</button>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-500">{cat.name} &gt; {matNode.label}</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">選擇物料</h2>
            <div className="flex flex-wrap gap-2">
              {subMaterials.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSelectChild(n.id)}
                  className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                >
                  <span className="font-mono text-blue-600 font-bold mr-1.5">{n.code_segment}</span>
                  <span className="text-gray-800">{n.label}</span>
                  {n.description && <span className="block text-[10px] text-gray-400 mt-0.5">{n.description}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {cat && matNode && (childMatId || subMaterials.length === 0) && fields.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleBack} className="text-xs text-gray-400 hover:text-blue-600 cursor-pointer">&larr; 返回</button>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-500">
              {cat.name}
              {pathNodes.length > 0 && ` > ${pathNodes.map((n) => n.label).join(' / ')}`}
            </span>
          </div>

          <PartNoPreview partNo={partNo} materialLabel={pathNodes.map((n) => n.label).join(' / ')} />

          <div className="flex flex-col items-end gap-2 mb-3">
            {autoError && <div className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">{autoError}</div>}
            <button
              onClick={handleAutoFill}
              disabled={autoFilling}
              className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg hover:from-purple-700 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {autoFilling ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {autoFilling ? 'AI分析中...' : 'AI Auto Fill'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            {fields.map((f) => {
              if (f.field_type === 'option' || f.field_type === 'options') {
                return <FieldOption key={f.id} field={f} selected={fieldValues[f.id] || ''} onSelect={(cid) => handleFieldSelect(f.id, cid)} confidence={fieldConfidences[f.id]} />;
              }
              if (f.field_type === 'input') {
                const conf = fieldConfidences[f.id];
                return (
                  <div key={f.id} className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-2">
                      {f.label}
                      {conf !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${confidenceColor(conf)}`}>
                          {Math.round(conf * 100)}%
                        </span>
                      )}
                    </label>
                    <input
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                      value={fieldValues[f.id] || ''}
                      onChange={(e) => handleFieldSelect(f.id, e.target.value)}
                      placeholder={f.description || '請輸入...'}
                      maxLength={f.code_segment === 'X' ? undefined : parseInt(f.code_segment) || undefined}
                    />
                    {f.description && <p className="text-[10px] text-gray-400 mt-0.5">{f.description}</p>}
                  </div>
                );
              }
              if (f.field_type === 'fixed') {
                return (
                  <div key={f.id} className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-500">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      {f.fixed_value}
                      {f.description && <span className="text-[10px] text-gray-400 ml-2">({f.description})</span>}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>

          {partNo && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-mono font-bold ${exists ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              PART NO.: {partNo}
              {exists && <span className="ml-2 text-xs font-normal">(已存在)</span>}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">物料資訊 (選填)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Design No.</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={designNo} onChange={(e) => setDesignNo(e.target.value)} placeholder="e.g. 4PCS/箱" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">QPA</label>
                  <input type="number" step="0.0001" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={qpa} onChange={(e) => setQpa(e.target.value)} placeholder="e.g. 0.25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Part Type</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={partType} onChange={(e) => setPartType(e.target.value)} placeholder="e.g. 電容" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">MFG Part</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={mfgPart} onChange={(e) => setMfgPart(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 電容 10uF ±10% 50V" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vendor PN</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={vendorPn} onChange={(e) => setVendorPn(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ITEM TEXT</label>
                  <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={itemText} onChange={(e) => setItemText(e.target.value)} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!partNo || exists || !allFieldsComplete}
              className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              產生 PART NO.
            </button>
          </form>

          {result && (
            <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <span className="font-medium text-blue-700">成功產生：</span>
              <code className="text-blue-900 font-mono bg-blue-100 px-2 py-0.5 rounded">{result}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
