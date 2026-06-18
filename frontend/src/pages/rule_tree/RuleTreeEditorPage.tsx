import { useEffect, useState, type FormEvent, useCallback } from 'react';
import { ruleTreeApi } from '../../api/client';
import type { RuleTreeCategory, RuleTreeNode } from '../../types';

interface EditCategory {
  id?: string
  name: string
  description: string
  prefix: string
  sort_order: number
}

interface EditNode {
  id?: string
  category_id: string
  parent_id: string | null
  label: string
  code_segment: string
  description: string | null
  field_type: string
  fixed_value: string | null
  sort_order: number
}

const FIELD_TYPES = [
  { value: 'options', label: '選擇集', desc: '從子節點選擇(欄位用)' },
  { value: 'option', label: '選項', desc: '子節點選項值' },
  { value: 'input', label: '輸入', desc: '使用者自行輸入文字' },
  { value: 'fixed', label: '固定值', desc: '自動帶入固定值' },
];

interface FlatNode { id: string; label: string; code_segment: string; depth: number }
function flattenNodes(nodes: RuleTreeNode[], depth = 0): FlatNode[] {
  const result: FlatNode[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, label: n.label, code_segment: n.code_segment, depth });
    result.push(...flattenNodes(n.children, depth + 1));
  }
  return result;
}

function updateNodeInTree(nodes: RuleTreeNode[], id: string, updates: Partial<RuleTreeNode>): RuleTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...updates, children: n.children };
    return { ...n, children: updateNodeInTree(n.children, id, updates) };
  });
}

function removeNodeFromTree(nodes: RuleTreeNode[], id: string): RuleTreeNode[] {
  return nodes.reduce<RuleTreeNode[]>((acc, n) => {
    if (n.id === id) return acc;
    acc.push({ ...n, children: removeNodeFromTree(n.children, id) });
    return acc;
  }, []);
}

function addNodeToTree(nodes: RuleTreeNode[], parentId: string | null, newNode: RuleTreeNode): RuleTreeNode[] {
  if (parentId === null) return [...nodes, newNode];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addNodeToTree(n.children, parentId, newNode) };
  });
}

function swapSortInTree(
  nodes: RuleTreeNode[],
  id: string,
  direction: 1 | -1
): { updated: RuleTreeNode[]; pair: { id1: string; id2: string; order1: number; order2: number } | null } {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      const j = i + direction;
      if (j < 0 || j >= nodes.length) return { updated: nodes, pair: null };
      const updated = [...nodes];
      updated[i] = { ...updated[i], sort_order: updated[j].sort_order };
      updated[j] = { ...updated[j], sort_order: nodes[i].sort_order };
      return { updated, pair: { id1: id, id2: updated[j].id, order1: updated[i].sort_order, order2: updated[j].sort_order } };
    }
    const result = swapSortInTree(nodes[i].children, id, direction);
    if (result.updated !== nodes[i].children) {
      const updated = [...nodes];
      updated[i] = { ...updated[i], children: result.updated };
      return { updated, pair: result.pair };
    }
  }
  return { updated: nodes, pair: null };
}

function TreeNodeRow({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
}: {
  node: RuleTreeNode
  depth: number
  onEdit: (n: EditNode) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, categoryId: string) => void
  onMove: (id: string, direction: 1 | -1) => void
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const collapsible = hasChildren;

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 group">
        <td className="px-4 py-2 text-xs text-gray-400" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          {collapsible ? (
            <button className="mr-1 text-gray-400 hover:text-gray-600 cursor-pointer text-[10px]" onClick={() => setOpen(!open)}>
              {open ? '▼' : '▶'}
            </button>
          ) : (
            <span className="mr-1 text-gray-200 text-[10px]">{hasChildren ? '▶' : ''}</span>
          )}
          {node.label}
        </td>
        <td className="px-4 py-2 font-mono text-xs text-blue-700">{node.code_segment}</td>
        <td className="px-4 py-2 text-xs text-gray-500">{node.field_type}</td>
        <td className="px-4 py-2 text-xs text-gray-500">{node.fixed_value || '-'}</td>
        <td className="px-4 py-2 text-xs text-gray-500">{node.description || '-'}</td>
        <td className="px-4 py-2 text-xs text-gray-400">{node.sort_order}</td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            {node.field_type !== 'option' && (
              <button className="text-xs text-green-600 hover:text-green-700 opacity-0 group-hover:opacity-100 cursor-pointer" title="新增子節點" onClick={() => onAddChild(node.id, node.category_id)}>＋</button>
            )}
            <button className="text-xs text-blue-600 hover:underline cursor-pointer" onClick={() => onEdit({ id: node.id, category_id: node.category_id, parent_id: node.parent_id, label: node.label, code_segment: node.code_segment, description: node.description, field_type: node.field_type, fixed_value: node.fixed_value, sort_order: node.sort_order })}>編輯</button>
            <button className="text-xs text-red-500 hover:underline cursor-pointer" onClick={() => onDelete(node.id)}>刪除</button>
            <button className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer" title="上移" onClick={() => onMove(node.id, -1)}>▲</button>
            <button className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer" title="下移" onClick={() => onMove(node.id, 1)}>▼</button>
          </div>
        </td>
      </tr>
      {(!collapsible || open) && node.children.map((c) => (
        <TreeNodeRow key={c.id} node={c} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} onMove={onMove} />
      ))}
    </>
  );
}

export function RuleTreeEditorPage() {
  const [categories, setCategories] = useState<RuleTreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const [editCat, setEditCat] = useState<EditCategory | null>(null);
  const [editNode, setEditNode] = useState<EditNode | null>(null);
  const [activeCatId, setActiveCatId] = useState<string>('');

  const fetchTreeAsync = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ruleTreeApi.getTree();
      setCategories(data.data.categories);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTreeAsync(); }, [fetchTreeAsync]);

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCat) return;
    const prev = editCat;
    setEditCat(null);
    if (editCat.id) {
      setCategories((prevCats) =>
        prevCats.map((c) => (c.id === editCat.id ? { ...c, name: editCat.name, description: editCat.description, prefix: editCat.prefix, sort_order: editCat.sort_order } : c))
      );
      try {
        await ruleTreeApi.updateCategory(editCat.id, editCat as unknown as Record<string, unknown>);
      } catch {
        setCategories((prevCats) =>
          prevCats.map((c) => (c.id === editCat.id ? { ...c, name: prev.name, description: prev.description, prefix: prev.prefix, sort_order: prev.sort_order } : c))
        );
      }
    } else {
      const tempId = '__temp__' + Date.now();
      setCategories((prevCats) => [...prevCats, { id: tempId, name: editCat.name, description: editCat.description, prefix: editCat.prefix, sort_order: editCat.sort_order, nodes: [] }]);
      try {
        const { data } = await ruleTreeApi.createCategory(editCat as unknown as Record<string, unknown>);
        const savedCat: RuleTreeCategory = data.data;
        setCategories((prevCats) => prevCats.map((c) => (c.id === tempId ? savedCat : c)));
      } catch {
        setCategories((prevCats) => prevCats.filter((c) => c.id !== tempId));
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('確定刪除此分類及其所有節點？')) return;
    const deletedCat = categories.find((c) => c.id === id);
    setCategories((prevCats) => prevCats.filter((c) => c.id !== id));
    try {
      await ruleTreeApi.deleteCategory(id);
    } catch {
      if (deletedCat) setCategories((prevCats) => [...prevCats, deletedCat]);
    }
  };

  const handleSaveNode = async (e: FormEvent) => {
    e.preventDefault();
    if (!editNode) return;
    const prev = editNode;
    const catId = prev.category_id;
    setEditNode(null);
    const tempId = prev.id ? '' : '__temp__' + Date.now();
    const optimisticNode: RuleTreeNode = prev.id
      ? (null as unknown as RuleTreeNode)
      : { id: tempId, category_id: prev.category_id, parent_id: prev.parent_id, label: prev.label, code_segment: prev.code_segment, description: prev.description, field_type: prev.field_type as RuleTreeNode['field_type'], fixed_value: prev.fixed_value, validation_rules: null, sort_order: prev.sort_order, children: [] };

    setCategories((prevCats) =>
      prevCats.map((c) => {
        if (c.id !== catId) return c;
        if (prev.id) return { ...c, nodes: updateNodeInTree(c.nodes, prev.id, { label: prev.label, code_segment: prev.code_segment, description: prev.description, field_type: prev.field_type, fixed_value: prev.fixed_value, sort_order: prev.sort_order } as Partial<RuleTreeNode>) };
        return { ...c, nodes: prev.parent_id ? addNodeToTree(c.nodes, prev.parent_id, optimisticNode) : [...c.nodes, optimisticNode] };
      })
    );

    try {
      if (prev.id) {
        await ruleTreeApi.updateNode(prev.id, prev as unknown as Record<string, unknown>);
      } else {
        const { data } = await ruleTreeApi.createNode(prev as unknown as Record<string, unknown>);
        const savedNode: RuleTreeNode = data.data;
        setCategories((prevCats) =>
          prevCats.map((c) => {
            if (c.id !== catId) return c;
            return { ...c, nodes: c.nodes.map((n) => (n.id === tempId ? { ...n, id: savedNode.id } : n)) };
          })
        );
      }
    } catch {
      fetchTreeAsync();
    }
  };

  const handleDeleteNode = async (id: string) => {
    if (!confirm('確定刪除此節點？')) return;
    let restored: { catId: string; nodes: RuleTreeNode[] } | null = null;
    setCategories((prevCats) =>
      prevCats.map((c) => {
        const before = c.nodes;
        const after = removeNodeFromTree(before, id);
        if (before !== after) restored = { catId: c.id, nodes: before };
        return { ...c, nodes: after };
      })
    );
    try {
      await ruleTreeApi.deleteNode(id);
    } catch {
      if (restored) {
        setCategories((prevCats) =>
          prevCats.map((c) => (c.id === restored!.catId ? { ...c, nodes: restored!.nodes } : c))
        );
      }
    }
  };

  const handleMoveNode = (id: string, direction: 1 | -1) => {
    setCategories((prevCats) =>
      prevCats.map((c) => {
        const result = swapSortInTree(c.nodes, id, direction);
        return { ...c, nodes: result.updated };
      })
    );
    for (const cat of categories) {
      const result = swapSortInTree(cat.nodes, id, direction);
      if (result.pair) {
        ruleTreeApi.updateNode(result.pair.id1, { sort_order: result.pair.order1 } as unknown as Record<string, unknown>).catch(() => fetchTreeAsync());
        ruleTreeApi.updateNode(result.pair.id2, { sort_order: result.pair.order2 } as unknown as Record<string, unknown>).catch(() => fetchTreeAsync());
        break;
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">規則樹編輯</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 cursor-pointer"
            onClick={() => setEditCat({ name: '', description: '', prefix: '', sort_order: 0 })}
          >
            + 新增分類
          </button>
          {activeCatId && (
            <button
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer"
              onClick={() => setEditNode({ category_id: activeCatId, parent_id: null, label: '', code_segment: '', description: '', field_type: 'option', fixed_value: '', sort_order: 0 })}
            >
              + 新增節點
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      ) : categories.length === 0 ? (
        <p className="text-sm text-gray-400">暫無規則樹分類，請先新增。</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                  {cat.prefix && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">prefix: {cat.prefix}</span>}
                  {cat.description && <span className="text-xs text-gray-400">{cat.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setActiveCatId(cat.id); setEditCat({ id: cat.id, name: cat.name, description: cat.description || '', prefix: cat.prefix || '', sort_order: cat.sort_order }); }}
                  >
                    編輯
                  </button>
                  <button
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                  >
                    刪除
                  </button>
                  <span className="text-xs text-gray-400 ml-2">{expandedCat === cat.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedCat === cat.id && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase sticky top-0">
                      <th className="px-4 py-2">名稱</th>
                      <th className="px-4 py-2">編碼段</th>
                      <th className="px-4 py-2">類型</th>
                      <th className="px-4 py-2">固定值</th>
                      <th className="px-4 py-2">說明</th>
                      <th className="px-4 py-2">排序</th>
                      <th className="px-4 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.nodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-xs text-gray-400 text-center">暫無節點</td>
                      </tr>
                    ) : (
                      cat.nodes.map((node) => (
                        <TreeNodeRow
                          key={node.id}
                          node={node}
                          depth={0}
                          onEdit={(n) => setEditNode({ ...n, category_id: cat.id })}
                          onDelete={handleDeleteNode}
                          onAddChild={(parentId, _categoryId) => setEditNode({ category_id: cat.id, parent_id: parentId, label: '', code_segment: '', description: '', field_type: 'option', fixed_value: '', sort_order: 0 })}
                          onMove={handleMoveNode}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {editCat && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">{editCat.id ? '編輯分類' : '新增分類'}</h2>
            <form onSubmit={handleSaveCategory}>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">名稱</label>
                <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">前綴 (prefix)</label>
                <input className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editCat.prefix} onChange={(e) => setEditCat({ ...editCat, prefix: e.target.value })} placeholder="e.g. 1" />
                <p className="text-[10px] text-gray-400 mt-0.5">此分類下所有料號自動帶入的前綴碼</p>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">說明</label>
                <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editCat.description} onChange={(e) => setEditCat({ ...editCat, description: e.target.value })} />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">排序</label>
                <input type="number" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editCat.sort_order} onChange={(e) => setEditCat({ ...editCat, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer" onClick={() => setEditCat(null)}>取消</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editNode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">{editNode.id ? '編輯節點' : '新增節點'}</h2>
            <form onSubmit={handleSaveNode}>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">名稱</label>
                <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editNode.label} onChange={(e) => setEditNode({ ...editNode, label: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">編碼段</label>
                <input className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editNode.code_segment} onChange={(e) => setEditNode({ ...editNode, code_segment: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">欄位類型</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                  value={editNode.field_type}
                  onChange={(e) => setEditNode({ ...editNode, field_type: e.target.value })}
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label} - {ft.desc}</option>
                  ))}
                </select>
              </div>
              {editNode.field_type === 'fixed' && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">固定值</label>
                  <input className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editNode.fixed_value ?? ''} onChange={(e) => setEditNode({ ...editNode, fixed_value: e.target.value })} required />
                </div>
              )}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">父節點 (空白=頂層)</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                  value={editNode.parent_id || ''}
                  onChange={(e) => setEditNode({ ...editNode, parent_id: e.target.value || null })}
                >
                  <option value="">(無 - 頂層)</option>
                  {(() => {
                    const cat = categories.find((c) => c.id === editNode.category_id);
                    if (!cat) return null;
                    return flattenNodes(cat.nodes).filter((fn) => fn.id !== editNode.id).map((fn) => (
                      <option key={fn.id} value={fn.id}>
                        {'　'.repeat(fn.depth)}{fn.label} ({fn.code_segment})
                      </option>
                    ));
                  })()}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">說明</label>
                <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editNode.description ?? ''} onChange={(e) => setEditNode({ ...editNode, description: e.target.value })} />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">排序</label>
                <input type="number" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" value={editNode.sort_order} onChange={(e) => setEditNode({ ...editNode, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer" onClick={() => setEditNode(null)}>取消</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
