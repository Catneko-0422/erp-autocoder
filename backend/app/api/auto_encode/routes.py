import re
import difflib
from flask import Blueprint, request, g
from ...decorators import jwt_required
from ...models.rule_tree import RuleTreeNode
from ...models.part_number import PartNumber
from ...utils.helpers import success_response, error_response
from ...services.llm_service import predict_fields

auto_encode_bp = Blueprint('auto_encode', __name__)


def _walk_fields(node: RuleTreeNode):
    path = [node]
    cur = node
    children = sorted(cur.children, key=lambda x: x.sort_order)
    while children and all(c.sort_order == 0 for c in children):
        cur = children[0]
        path.append(cur)
        children = sorted(cur.children, key=lambda x: x.sort_order)
    fields = [c for c in children if c.sort_order > 0 or c.field_type != 'option']
    fields.sort(key=lambda x: x.sort_order)
    return fields


def _find_child_by_id(node: RuleTreeNode, child_id: str):
    for c in node.children:
        if str(c.id) == child_id:
            return c
        r = _find_child_by_id(c, child_id)
        if r:
            return r
    return None


def _fuzzy_best(text: str, candidates: list[dict[str, str]], threshold: float = 0.6):
    best = None
    best_score = 0.0
    text_lower = text.lower().strip()
    for c in candidates:
        for field in ('code_segment', 'label', 'description'):
            val = c.get(field, '') or ''
            if not val:
                continue
            if val.lower() == text_lower:
                return c, 1.0
            ratio = difflib.SequenceMatcher(None, text_lower, val.lower()).ratio()
            if ratio > best_score:
                best_score = ratio
                best = c
    if best and best_score >= threshold:
        return best, round(best_score, 2)
    return None, 0.0


@auto_encode_bp.route('', methods=['POST'])
@jwt_required
def auto_encode():
    body = request.get_json() or {}
    node_id = body.get('material_node_id')
    if not node_id:
        return error_response('material_node_id is required', 422)

    node = RuleTreeNode.query.get(node_id)
    if not node:
        return error_response('Node not found', 404)

    fields = _walk_fields(node)

    field_info = []
    for f in fields:
        info = {
            'id': str(f.id),
            'label': f.label,
            'field_type': f.field_type,
            'code_segment': f.code_segment or '',
            'fixed_value': f.fixed_value or '',
            'children': [
                {'id': str(c.id), 'label': c.label, 'code_segment': c.code_segment, 'description': c.description or ''}
                for c in sorted(f.children, key=lambda x: x.sort_order)
            ],
        }
        field_info.append(info)

    inputs = {
        'part_type': body.get('part_type', ''),
        'description': body.get('description', ''),
        'mfg_part': body.get('mfg_part', ''),
        'vendor_pn': body.get('vendor_pn', ''),
        'item_text': body.get('item_text', ''),
    }

    # RAG: fetch recent history (same material first, then broader pool for pattern learning)
    history = []
    recent = PartNumber.query.filter_by(material_node_id=node_id).order_by(PartNumber.created_at.desc()).limit(25).all()
    if len(recent) < 8:
        broader = PartNumber.query.filter(
            PartNumber.material_node_id.is_(None),
            PartNumber.mfg_part != None,
        ).order_by(PartNumber.created_at.desc()).limit(25 - len(recent)).all()
        recent.extend(broader)
    if len(recent) < 8:
        broader = PartNumber.query.order_by(PartNumber.created_at.desc()).limit(25 - len(recent)).all()
        recent.extend(broader)
    for pn in recent:
        ef = pn.encoding_fields or {}
        decoded = {}
        for f in fields:
            val = ef.get(str(f.id))
            if val:
                if f.field_type in ('option', 'options'):
                    child = _find_child_by_id(f, val)
                    if child:
                        decoded[f.label] = child.code_segment
                    else:
                        decoded[f.label] = val
                else:
                    decoded[f.label] = val
        history.append({
            'part_no': pn.part_no,
            'description': pn.description,
            'mfg_part': pn.mfg_part,
            'vendor_pn': pn.vendor_pn,
            'field_values': decoded,
        })

    try:
        raw = predict_fields(node.label, field_info, inputs, history)
    except RuntimeError as e:
        return error_response(str(e), 503)

    mapped: dict[str, str] = {}
    confidences: dict[str, float] = {}
    for i, f in enumerate(fields):
        key = f"field_{i}"
        val = raw.get(key, '')
        if not val:
            confidences[str(f.id)] = 0.0
            continue
        if f.field_type in ('option', 'options'):
            candidates = [{'code_segment': c.code_segment, 'label': c.label, 'description': c.description or '', 'id': str(c.id)} for c in f.children]
            # 1) exact code_segment
            child = next((c for c in f.children if c.code_segment == val), None)
            if child:
                mapped[str(f.id)] = str(child.id)
                confidences[str(f.id)] = 1.0
                continue
            # 2) exact label
            child = next((c for c in f.children if c.label == val), None)
            if child:
                mapped[str(f.id)] = str(child.id)
                confidences[str(f.id)] = 0.95
                continue
            # 3) [code] label format
            m = re.match(r'^\[(.+?)\]\s*(.*)', val)
            if m:
                child = next((c for c in f.children if c.code_segment == m.group(1)), None)
                if child:
                    mapped[str(f.id)] = str(child.id)
                    confidences[str(f.id)] = 0.9
                    continue
                child = next((c for c in f.children if c.label == m.group(2)), None)
                if child:
                    mapped[str(f.id)] = str(child.id)
                    confidences[str(f.id)] = 0.85
                    continue
            # 4) fuzzy match
            child, score = _fuzzy_best(val, candidates)
            if child:
                mapped[str(f.id)] = child['id']
                confidences[str(f.id)] = score
                continue
            confidences[str(f.id)] = 0.0
        elif f.field_type == 'input':
            processed = val
            if val and val.isdigit() and "(CM)" in (f.label or ''):
                num = int(val)
                if num > 100:
                    num = round(num / 10)
                processed = str(num).zfill(len(f.code_segment or '0'))
            mapped[str(f.id)] = processed
            confidences[str(f.id)] = 1.0

    return success_response({
        'field_predictions': mapped,
        'field_confidences': confidences,
    })
