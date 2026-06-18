import json
import requests

from ..config import Config

OLLAMA_BASE = Config.OLLAMA_BASE_URL
MODEL = Config.OLLAMA_MODEL
TIMEOUT = int(Config.OLLAMA_TIMEOUT or 120)


def _build_material_rules(fields: list[dict]) -> str:
    parts = []
    for f in fields:
        seg = f.get('code_segment', '')
        label = f.get('label', '')
        if f.get('field_type') in ('option', 'options'):
            parts.append(f"{label}({len(seg)}碼)")
        elif f.get('field_type') == 'input':
            parts.append(f"{label}({len(seg)}碼)")
        elif f.get('field_type') == 'fixed':
            parts.append(f"{label}({len(seg)}碼,固定)")
    return " + ".join(parts)


def _build_domain_hints(fields: list[dict]) -> str:
    hints = []
    for f in fields:
        label = f.get('label', '')
        if '(CM)' in label:
            hints.append(f"- {label}: convert mm→cm (÷10, round, zero-pad {len(f.get('code_segment',''))} digits)")
    return "\n".join(hints)


def _build_fields_section(fields: list[dict]) -> str:
    lines = []
    for i, f in enumerate(fields):
        label = f.get('label', f'Field {i}')
        ftype = f.get('field_type', 'input')
        code_seg = f.get('code_segment', '')
        if ftype in ('option', 'options') and f.get('children'):
            opts = [f"    [{c['code_segment']}] {c['label']}" for c in f['children']]
            lines.append(f"Field {i}: {label} (choose one)")
            lines.extend(opts)
        elif ftype == 'input':
            hint = " (mm→cm÷10 zero-pad)" if "(CM)" in label else ""
            lines.append(f"Field {i}: {label} (enter value{hint}, ~{len(code_seg)} chars)")
        elif ftype == 'fixed':
            lines.append(f"Field {i}: {label} (fixed: {f.get('fixed_value', '')})")
        else:
            lines.append(f"Field {i}: {label}")
    return "\n".join(lines)


def _build_product_section(inputs: dict[str, str]) -> str:
    labels = {
        'part_type': 'Part Type',
        'description': 'Description',
        'mfg_part': 'MFG Part',
        'vendor_pn': 'Vendor PN',
        'item_text': 'ITEM TEXT',
    }
    lines = []
    for k, label in labels.items():
        v = inputs.get(k, '')
        if v:
            lines.append(f"- {label}: {v}")
    return "\n".join(lines) if lines else "- (no product info provided)"


def _build_input_pattern_hints(history: list[dict], fields: list[dict], field_labels: dict[str, str]) -> str:
    """Dynamically infer input code patterns from historical data. Not hardcoded rules."""
    input_fields = [f for f in fields if f.get('field_type') == 'input' and f.get('label') not in ('流水號', '流水碼')]
    if not input_fields:
        return ""
    patterns = []
    for f in input_fields:
        examples = []
        seen_codes = set()
        fid = str(f['id'])
        fname = field_labels.get(fid, f.get('label', 'Field'))
        for h in history:
            val = h.get('field_values', {}).get(fname)
            desc = h.get('description', '') or ''
            mfg = h.get('mfg_part', '') or ''
            vpn = h.get('vendor_pn', '') or ''
            if val and val not in seen_codes:
                # Extract relevant snippet from description
                snippet = desc[:60] if desc else (mfg[:40] if mfg else vpn[:30])
                examples.append(f"    \"{snippet}\" → [{val}] ({len(val)} chars)")
                seen_codes.add(val)
                if len(examples) >= 8:
                    break
        if examples:
            patterns.append(f"  {fname} patterns:")
            patterns.extend(examples)
    return "\n" + "\n".join(patterns) if patterns else ""


def _build_history_section(history: list[dict], field_labels: dict[str, str], fields: list[dict]) -> str:
    if not history:
        return ""
    lines = ["Previously encoded parts (for reference):"]
    for h in history:
        desc = h.get('description', '') or ''
        mfg = h.get('mfg_part', '') or ''
        vpn = h.get('vendor_pn', '') or ''
        pn = h.get('part_no', '')
        field_vals = h.get('field_values', {})
        parts = [f"  {pn} | {desc[:50]}{' | '+mfg[:30] if mfg else ''}{' | '+vpn[:20] if vpn else ''}"]
        for fname, fval in field_vals.items():
            label = field_labels.get(fname, fname)
            parts.append(f"    {label}={fval}")
        lines.append("\n".join(parts))

    pattern_hints = _build_input_pattern_hints(history, fields, field_labels)
    if pattern_hints:
        lines.append(pattern_hints)

    return "\n\n" + "\n".join(lines)


def predict_fields(
    material_label: str,
    fields: list[dict],
    inputs: dict[str, str],
    history: list[dict] | None = None,
) -> dict[str, str]:
    rules_str = _build_material_rules(fields)
    hints = _build_domain_hints(fields)
    fields_section = _build_fields_section(fields)
    product_section = _build_product_section(inputs)

    field_labels = {str(f['id']): f.get('label', f'Field {i}') for i, f in enumerate(fields)}
    history_section = _build_history_section(history or [], field_labels, fields) if history else ""

    field_count = len(fields)

    system_prompt = f"""You are an ERP part number encoding assistant. Your task is to determine the correct code for each encoding field.

Material: {material_label}
Encoding format: {rules_str}

{hints}

For each numbered field:
- option/options fields: pick the BEST matching code from the list
- input fields labelled (CM): description values are in mm, convert to cm (÷10, round, zero-pad)
- input fields: study the "patterns" section below carefully — encoding follows consistent conventions (e.g., 10uF→10U0, 4.7uF→04U7, 1nF→01N0, 10Ω→10R0, 100KΩ→100K)
- Sequential fields (流水號/流水碼): leave empty

Respond ONLY with valid JSON: {{"field_0":"code","field_1":"code",...}}
Example: {{"field_0":"03","field_1":"043","field_2":""}}"""

    user_prompt = f"""Encoding fields:
{fields_section}

Product information:
{product_section}

{history_section}

Predict ALL {field_count} fields. Output JSON with ALL field_0 through field_{field_count-1} keys. Use "" for uncertain fields.
{{"field_0":"...", "field_1":"...", ...}}"""

    try:
        resp = requests.post(
            f"{OLLAMA_BASE}/api/chat",
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            },
            timeout=(5, TIMEOUT),
        )
        resp.raise_for_status()
        result = resp.json()
        content = result.get("message", {}).get("content", "{}")
        predictions = json.loads(content)
        if not isinstance(predictions, dict):
            return {}
        return predictions
    except requests.ConnectionError:
        raise RuntimeError(f"Cannot connect to Ollama at {OLLAMA_BASE}")
    except requests.Timeout:
        raise RuntimeError("Ollama request timed out")
    except Exception as e:
        raise RuntimeError(f"LLM prediction failed: {e}")
