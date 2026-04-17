"""Repo-tracked JSON: display and navigation hints per cached config entity type."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app import config

PROPERTIES_FILE_RELATIVE = Path("data") / "designer_entity_type_navigation.json"
SCHEMA_VERSION = 1

_FIELD_MAX = 512
_ENTITY_TYPE_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,127}$")
_ICON_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def properties_file_path() -> Path:
    return (config.BASE_DIR / PROPERTIES_FILE_RELATIVE).resolve()


def default_document() -> dict[str, Any]:
    return {
        "version": SCHEMA_VERSION,
        "entries": {},
        "facet_orders": _default_facet_orders(),
        "page_icons": {},
    }


def _default_facet_orders() -> dict[str, Any]:
    return {"sections": [], "pagesBySection": {}, "tabsBySectionPage": {}}


def load_document() -> dict[str, Any]:
    path = properties_file_path()
    if not path.is_file():
        return default_document()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_document()
    if not isinstance(raw, dict):
        return default_document()
    return raw


def _clip_str(s: Any, max_len: int) -> str:
    t = str(s) if s is not None else ""
    if len(t) > max_len:
        return t[:max_len]
    return t


def _normalize_kind(raw: Any) -> str:
    t = _clip_str(raw.get("kind") if isinstance(raw, dict) else raw, _FIELD_MAX).strip().casefold()
    if t == "settings":
        return "Settings"
    return "Objects"


def _normalize_icon_name(raw: Any) -> str:
    t = _clip_str(raw, _FIELD_MAX).strip().replace("-", "_").replace(" ", "_").casefold()
    if not t:
        return ""
    if not _ICON_NAME_RE.match(t):
        return ""
    return t


def _normalize_hidden_flag(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw != 0
    t = _clip_str(raw, _FIELD_MAX).strip().casefold()
    return t in {"1", "true", "yes", "on"}


def _normalize_entry(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        raw = {}
    return {
        "kind": _normalize_kind(raw),
        "display_name": _clip_str(raw.get("display_name"), _FIELD_MAX).strip(),
        "nav_section": _clip_str(raw.get("nav_section"), _FIELD_MAX).strip(),
        "nav_order": _clip_str(raw.get("nav_order"), _FIELD_MAX).strip(),
        "nav_page": _clip_str(raw.get("nav_page"), _FIELD_MAX).strip(),
        "tab": _clip_str(raw.get("tab"), _FIELD_MAX).strip(),
        "nav_icon": _normalize_icon_name(raw.get("nav_icon")),
    }


def _nav_order_sort_tuple(raw: str | None) -> tuple[int, int, str]:
    """Sort key for nav_order: integers first (numeric), then non-numeric strings, empty last."""
    t = (raw or "").strip()
    if not t:
        return (2, 0, "")
    try:
        n = int(t)
        if str(n) == t:
            return (0, n, "")
    except ValueError:
        pass
    return (1, 0, t.casefold())


def _facet_rank(order_list: list[str] | None, value: str) -> tuple[int, str]:
    """Primary index in order_list (case-insensitive match), then tie-breaker string."""
    if not order_list:
        return (1_000_000, (value or "").casefold())
    vk = (value or "").strip().casefold()
    for i, item in enumerate(order_list):
        if (item or "").strip().casefold() == vk:
            return (i, "")
    return (1_000_000 + 1, (value or "").casefold())


def _nav_sort_key(
    entity_type: str,
    ent: dict[str, str],
    facet_orders: dict[str, Any],
) -> tuple:
    """Section → page → tab (facet order lists), nav order, kind, entity type."""
    sec = ent.get("nav_section") or ""
    page = ent.get("nav_page") or ""
    tab = ent.get("tab") or ""
    sk = sec.casefold()
    pk = page.casefold()

    sections = facet_orders.get("sections") if isinstance(facet_orders.get("sections"), list) else []
    pbs = facet_orders.get("pagesBySection") if isinstance(facet_orders.get("pagesBySection"), dict) else {}
    tbm = facet_orders.get("tabsBySectionPage") if isinstance(facet_orders.get("tabsBySectionPage"), dict) else {}

    pr_sec = _facet_rank([str(x) for x in sections], sec)
    page_list = pbs.get(sk)
    pl = [str(x) for x in page_list] if isinstance(page_list, list) else None
    pr_page = _facet_rank(pl, page)
    tab_key = f"{sk}|{pk}"
    tab_list = tbm.get(tab_key)
    tl = [str(x) for x in tab_list] if isinstance(tab_list, list) else None
    pr_tab = _facet_rank(tl, tab)

    return (
        pr_sec,
        pr_page,
        pr_tab,
        _nav_order_sort_tuple(ent.get("nav_order")),
        (ent.get("kind") or "Objects").casefold(),
        entity_type.casefold(),
    )


def _entries_sorted_by_nav(
    entries: dict[str, dict[str, str]],
    facet_orders: dict[str, Any],
) -> dict[str, dict[str, str]]:
    ordered: dict[str, dict[str, str]] = {}
    for et in sorted(entries.keys(), key=lambda k: _nav_sort_key(k, entries[k], facet_orders)):
        ordered[et] = entries[et]
    return ordered


def _seen_labels_from_entries(
    entries: dict[str, dict[str, str]],
) -> tuple[dict[str, str], dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    """section_key -> label, section_key -> page_key -> label, 'sk|pk' -> tab_key -> label."""
    sec_map: dict[str, str] = {}
    page_maps: dict[str, dict[str, str]] = {}
    tab_maps: dict[str, dict[str, str]] = {}
    for ent in entries.values():
        s = (ent.get("nav_section") or "").strip()
        p = (ent.get("nav_page") or "").strip()
        t = (ent.get("tab") or "").strip()
        sk = s.casefold()
        pk = p.casefold()
        if sk not in sec_map:
            sec_map[sk] = s
        page_maps.setdefault(sk, {})
        if pk not in page_maps[sk]:
            page_maps[sk][pk] = p
        tk = f"{sk}|{pk}"
        tab_maps.setdefault(tk, {})
        tk2 = t.casefold()
        if tk2 not in tab_maps[tk]:
            tab_maps[tk][tk2] = t
    return sec_map, page_maps, tab_maps


def _merge_facet_orders_with_entries(
    raw_fo: Any,
    entries: dict[str, dict[str, str]],
) -> dict[str, Any]:
    """Ensure facet lists include every value present in entries; trim extras."""
    fo = _default_facet_orders()
    if isinstance(raw_fo, dict):
        if isinstance(raw_fo.get("sections"), list):
            fo["sections"] = [_clip_str(x, _FIELD_MAX).strip() for x in raw_fo["sections"]]
        pbs_in = raw_fo.get("pagesBySection")
        if isinstance(pbs_in, dict):
            for k, v in pbs_in.items():
                kk = str(k).strip().casefold()
                if isinstance(v, list):
                    fo["pagesBySection"][kk] = [_clip_str(x, _FIELD_MAX).strip() for x in v]
        tbm_in = raw_fo.get("tabsBySectionPage")
        if isinstance(tbm_in, dict):
            for k, v in tbm_in.items():
                kk = str(k).strip().casefold()
                if "|" in kk and isinstance(v, list):
                    fo["tabsBySectionPage"][kk] = [_clip_str(x, _FIELD_MAX).strip() for x in v]

    sec_map, page_maps, tab_maps = _seen_labels_from_entries(entries)

    # Sections: keep order, add missing (sorted by label)
    seen_sk = set(sec_map.keys())
    out_sections: list[str] = []
    for s in fo["sections"]:
        sk = s.strip().casefold()
        if sk in seen_sk:
            out_sections.append(sec_map[sk])
            seen_sk.discard(sk)
    missing_sec = sorted((sec_map[sk] for sk in seen_sk), key=lambda x: x.casefold())
    out_sections.extend(missing_sec)
    fo["sections"] = out_sections

    # Pages per section
    new_pbs: dict[str, list[str]] = {}
    for sk, pmap in page_maps.items():
        cur = fo["pagesBySection"].get(sk)
        ordered: list[str] = []
        seen_pk = set(pmap.keys())
        if isinstance(cur, list):
            for p in cur:
                pk = p.strip().casefold()
                if pk in seen_pk:
                    ordered.append(pmap[pk])
                    seen_pk.discard(pk)
        ordered.extend(sorted((pmap[pk] for pk in seen_pk), key=lambda x: x.casefold()))
        new_pbs[sk] = ordered
    fo["pagesBySection"] = new_pbs

    # Tabs per section|page
    new_tbm: dict[str, list[str]] = {}
    for tk, tmap in tab_maps.items():
        cur = fo["tabsBySectionPage"].get(tk)
        ordered_t: list[str] = []
        seen_tk2 = set(tmap.keys())
        if isinstance(cur, list):
            for t in cur:
                t2 = t.strip().casefold()
                if t2 in seen_tk2:
                    ordered_t.append(tmap[t2])
                    seen_tk2.discard(t2)
        ordered_t.extend(sorted((tmap[k2] for k2 in seen_tk2), key=lambda x: x.casefold()))
        new_tbm[tk] = ordered_t
    fo["tabsBySectionPage"] = new_tbm

    return fo


def _collect_unique_nav_pages(
    entries: dict[str, dict[str, str]],
) -> dict[str, tuple[str, str]]:
    """section_key|page_key -> (section_label, page_label)."""
    out: dict[str, tuple[str, str]] = {}
    for ent in entries.values():
        sec = (ent.get("nav_section") or "").strip()
        page = (ent.get("nav_page") or "").strip()
        if not sec or not page:
            continue
        sk = sec.casefold()
        pk = page.casefold()
        key = f"{sk}|{pk}"
        if key not in out:
            out[key] = (sec, page)
    return out


def _merge_page_icons_with_entries(
    raw_page_icons: Any,
    entries: dict[str, dict[str, str]],
    facet_orders: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """Keep only section/page pairs currently present in entries; normalize icon names."""
    page_pairs = _collect_unique_nav_pages(entries)
    incoming = raw_page_icons if isinstance(raw_page_icons, dict) else {}
    sections = (
        facet_orders.get("sections") if isinstance(facet_orders.get("sections"), list) else []
    )
    pbs = (
        facet_orders.get("pagesBySection")
        if isinstance(facet_orders.get("pagesBySection"), dict)
        else {}
    )

    def sort_key(pair_key: str) -> tuple:
        sk, _ = pair_key.split("|", 1)
        sec_label, page_label = page_pairs[pair_key]
        sec_rank = _facet_rank([str(x) for x in sections], sec_label)
        pages = pbs.get(sk)
        page_rank = _facet_rank([str(x) for x in pages] if isinstance(pages, list) else None, page_label)
        return (sec_rank, page_rank, page_label.casefold())

    out: dict[str, dict[str, Any]] = {}
    for pair_key in sorted(page_pairs.keys(), key=sort_key):
        sec_label, page_label = page_pairs[pair_key]
        raw_item = incoming.get(pair_key)
        icon = _normalize_icon_name(raw_item.get("icon") if isinstance(raw_item, dict) else "")
        hidden = _normalize_hidden_flag(
            raw_item.get("hidden") if isinstance(raw_item, dict) else False
        )
        out[pair_key] = {
            "nav_section": sec_label,
            "nav_page": page_label,
            "icon": icon,
            "hidden": hidden,
        }
    return out


def entity_type_nav_icons_map() -> dict[str, str]:
    """Map ``entity_type`` → ``nav_icon`` for entries with a non-empty icon.

    Used by Firewalls v2 object UI (embedded JSON) so list rows can match the
    object navigator without calling the designer-only navigation API.
    """
    data = get_navigation_entries()
    entries_in = data.get("entries")
    if not isinstance(entries_in, dict):
        return {}
    out: dict[str, str] = {}
    for et_key, row in entries_in.items():
        et = str(et_key).strip() if et_key is not None else ""
        if not et or not isinstance(row, dict):
            continue
        icon = _normalize_icon_name(row.get("nav_icon"))
        if icon:
            out[et] = icon
    return out


def get_navigation_entries() -> dict[str, Any]:
    doc = load_document()
    entries_in = doc.get("entries")
    if not isinstance(entries_in, dict):
        entries_in = {}
    tmp: dict[str, dict[str, str]] = {}
    for k, v in entries_in.items():
        et = str(k).strip() if k is not None else ""
        if not et or not _ENTITY_TYPE_RE.match(et):
            continue
        tmp[et] = _normalize_entry(v)
    raw_fo = doc.get("facet_orders")
    facet_orders = _merge_facet_orders_with_entries(raw_fo, tmp)
    out = _entries_sorted_by_nav(tmp, facet_orders)
    page_icons = _merge_page_icons_with_entries(doc.get("page_icons"), out, facet_orders)
    return {
        "version": SCHEMA_VERSION,
        "entries": out,
        "facet_orders": facet_orders,
        "page_icons": page_icons,
    }


def _parse_entries_payload(raw_entries: Any) -> dict[str, dict[str, str]]:
    if raw_entries is None:
        return {}
    if not isinstance(raw_entries, dict):
        raise ValueError("entries must be an object")
    normalized: dict[str, dict[str, str]] = {}
    for k, v in raw_entries.items():
        et = str(k).strip() if k is not None else ""
        if not et:
            continue
        if not _ENTITY_TYPE_RE.match(et):
            raise ValueError(f"Invalid entity_type key: {et!r}")
        normalized[et] = _normalize_entry(v)
    return normalized


def _write_navigation_document(
    entries: dict[str, dict[str, str]],
    facet_orders: dict[str, Any],
    page_icons: dict[str, dict[str, Any]],
) -> None:
    path = properties_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = default_document()
    doc["entries"] = entries
    doc["facet_orders"] = facet_orders
    doc["page_icons"] = page_icons
    text = json.dumps(doc, indent=2, sort_keys=False) + "\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def save_navigation_entries(body: dict[str, Any] | None) -> dict[str, Any]:
    payload = body if isinstance(body, dict) else {}
    normalized = _parse_entries_payload(payload.get("entries"))
    if "facet_orders" in payload:
        facet_orders = _merge_facet_orders_with_entries(payload.get("facet_orders"), normalized)
    else:
        existing = load_document()
        raw_fo = existing.get("facet_orders")
        facet_orders = _merge_facet_orders_with_entries(raw_fo, normalized)
    if "page_icons" in payload:
        page_icons = _merge_page_icons_with_entries(
            payload.get("page_icons"),
            normalized,
            facet_orders,
        )
    else:
        existing = load_document()
        page_icons = _merge_page_icons_with_entries(
            existing.get("page_icons"),
            normalized,
            facet_orders,
        )
    ordered = _entries_sorted_by_nav(normalized, facet_orders)
    _write_navigation_document(ordered, facet_orders, page_icons)
    return {
        "version": SCHEMA_VERSION,
        "entries": ordered,
        "facet_orders": facet_orders,
        "page_icons": page_icons,
    }


_FW_V2_SLUG_RE = re.compile(r"[^a-zA-Z0-9]+")


def _fw_v2_label_slug(label: str) -> str:
    t = _FW_V2_SLUG_RE.sub("-", (label or "").strip().lower()).strip("-")
    return t or "item"


def _fw_v2_unique_slugs(labels: list[str]) -> list[tuple[str, str]]:
    """Return ``(label, slug)`` pairs; slugs are unique within this list."""
    used: dict[str, bool] = {}
    out: list[tuple[str, str]] = []
    for raw in labels:
        lab = raw.strip()
        if not lab:
            continue
        base = _fw_v2_label_slug(lab)
        slug = base
        n = 2
        while slug in used:
            slug = f"{base}-{n}"
            n += 1
        used[slug] = True
        out.append((lab, slug))
    return out


def build_firewalls_v2_object_nav_tree() -> list[dict[str, Any]]:
    """Sidebar + URL structure for Firewalls v2 object navigator pages."""
    data = get_navigation_entries()
    fo = data.get("facet_orders")
    if not isinstance(fo, dict):
        return []
    page_icons = data.get("page_icons") if isinstance(data.get("page_icons"), dict) else {}
    sections_in = fo.get("sections")
    if not isinstance(sections_in, list):
        return []
    pbs = fo.get("pagesBySection") if isinstance(fo.get("pagesBySection"), dict) else {}
    tbm = fo.get("tabsBySectionPage") if isinstance(fo.get("tabsBySectionPage"), dict) else {}
    tree: list[dict[str, Any]] = []
    for sec_label, sec_slug in _fw_v2_unique_slugs(
        [str(s).strip() for s in sections_in if str(s).strip()]
    ):
        sk = sec_label.casefold()
        pages_raw = pbs.get(sk)
        if not isinstance(pages_raw, list):
            pages_raw = []
        page_labels = [str(p).strip() for p in pages_raw if isinstance(p, str) and str(p).strip()]
        pages_out: list[dict[str, Any]] = []
        for page_label, page_slug in _fw_v2_unique_slugs(page_labels):
            pk = page_label.casefold()
            tab_key = f"{sk}|{pk}"
            icon_row = page_icons.get(tab_key)
            icon_name = (
                _normalize_icon_name(icon_row.get("icon"))
                if isinstance(icon_row, dict)
                else ""
            )
            hidden = (
                _normalize_hidden_flag(icon_row.get("hidden"))
                if isinstance(icon_row, dict)
                else False
            )
            if hidden:
                continue
            tabs_raw = tbm.get(tab_key)
            if not isinstance(tabs_raw, list):
                tabs_raw = []
            tab_labels = [str(t).strip() for t in tabs_raw if isinstance(t, str) and str(t).strip()]
            tab_pairs = _fw_v2_unique_slugs(tab_labels)
            tabs_out = [{"label": lab, "slug": sl} for lab, sl in tab_pairs]
            pages_out.append(
                {
                    "label": page_label,
                    "slug": page_slug,
                    "page_key": pk,
                    "icon": icon_name,
                    "tabs": tabs_out,
                }
            )
        if not pages_out:
            continue
        tree.append(
            {
                "label": sec_label,
                "slug": sec_slug,
                "section_key": sk,
                "pages": pages_out,
            }
        )
    return tree


def resolve_firewalls_v2_object_page(
    tree: list[dict[str, Any]],
    section_slug: str,
    page_slug: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    want_sec = (section_slug or "").strip().casefold()
    want_page = (page_slug or "").strip().casefold()
    for sec in tree:
        if not isinstance(sec, dict):
            continue
        if str(sec.get("slug") or "").strip().casefold() != want_sec:
            continue
        for page in sec.get("pages") or []:
            if not isinstance(page, dict):
                continue
            if str(page.get("slug") or "").strip().casefold() != want_page:
                continue
            return sec, page
    return None, None


def resolve_firewalls_v2_active_tab(
    page: dict[str, Any],
    tab_query: str | None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Pick active tab from ``?tab=`` (slug or label) or default to the first tab."""
    raw = page.get("tabs")
    tabs = [t for t in raw if isinstance(t, dict)] if isinstance(raw, list) else []
    if not tabs:
        return None, []
    q = (tab_query or "").strip().casefold()
    if q:
        for t in tabs:
            sl = str(t.get("slug") or "").strip().casefold()
            lb = str(t.get("label") or "").strip().casefold()
            if q == sl or q == lb:
                return t, tabs
    return tabs[0], tabs


def list_object_entity_types_for_nav_page(
    *,
    entries: dict[str, dict[str, str]],
    section_key: str,
    page_key: str,
) -> list[str]:
    """Entity type ids with kind *Objects* on this navigator page (all tabs)."""
    sk = (section_key or "").strip().casefold()
    pk = (page_key or "").strip().casefold()
    out: list[str] = []
    for et, ent in entries.items():
        if not isinstance(ent, dict):
            continue
        if (ent.get("kind") or "").strip() != "Objects":
            continue
        if (ent.get("nav_section") or "").strip().casefold() != sk:
            continue
        if (ent.get("nav_page") or "").strip().casefold() != pk:
            continue
        out.append(str(et))
    out.sort(key=lambda x: x.casefold())
    return out


def list_entity_types_for_nav_cell(
    *,
    entries: dict[str, dict[str, str]],
    section_key: str,
    page_key: str,
    tab_label: str,
) -> list[tuple[str, str]]:
    """Entity types whose navigator metadata matches the given section, page, and tab."""
    sk = (section_key or "").strip().casefold()
    pk = (page_key or "").strip().casefold()
    tk = (tab_label or "").strip().casefold()
    out: list[tuple[str, str]] = []
    for et, ent in entries.items():
        if not isinstance(ent, dict):
            continue
        if (ent.get("nav_section") or "").strip().casefold() != sk:
            continue
        if (ent.get("nav_page") or "").strip().casefold() != pk:
            continue
        if (ent.get("tab") or "").strip().casefold() != tk:
            continue
        name = (ent.get("display_name") or "").strip() or str(et)
        out.append((str(et), name))
    out.sort(key=lambda x: (x[1].casefold(), x[0].casefold()))
    return out


def list_object_entity_types_for_nav_tab(
    *,
    entries: dict[str, dict[str, str]],
    section_key: str,
    page_key: str,
    tab_label: str,
) -> list[str]:
    """Entity type ids with kind *Objects* for one (section, page, tab) cell."""
    sk = (section_key or "").strip().casefold()
    pk = (page_key or "").strip().casefold()
    tk = (tab_label or "").strip().casefold()
    out: list[str] = []
    for et, ent in entries.items():
        if not isinstance(ent, dict):
            continue
        if (ent.get("kind") or "").strip() != "Objects":
            continue
        if (ent.get("nav_section") or "").strip().casefold() != sk:
            continue
        if (ent.get("nav_page") or "").strip().casefold() != pk:
            continue
        if (ent.get("tab") or "").strip().casefold() != tk:
            continue
        out.append(str(et))
    out.sort(key=lambda x: x.casefold())
    return out


def list_settings_entities_for_nav_tab(
    *,
    entries: dict[str, dict[str, str]],
    section_key: str,
    page_key: str,
    tab_label: str,
) -> list[tuple[str, str]]:
    """(entity_type, display_name) for kind *Settings* in this tab cell."""
    sk = (section_key or "").strip().casefold()
    pk = (page_key or "").strip().casefold()
    tk = (tab_label or "").strip().casefold()
    out: list[tuple[str, str]] = []
    for et, ent in entries.items():
        if not isinstance(ent, dict):
            continue
        if (ent.get("kind") or "").strip() != "Settings":
            continue
        if (ent.get("nav_section") or "").strip().casefold() != sk:
            continue
        if (ent.get("nav_page") or "").strip().casefold() != pk:
            continue
        if (ent.get("tab") or "").strip().casefold() != tk:
            continue
        name = (ent.get("display_name") or "").strip() or str(et)
        out.append((str(et), name))
    out.sort(key=lambda x: (x[1].casefold(), x[0].casefold()))
    return out
