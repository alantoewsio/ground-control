"""Rewrite FastAPI injectors to ``typing.Annotated`` (Sonar python:S8410).

Transforms:

- ``name: T = Depends(...)`` → ``name: Annotated[T, Depends(...)]``
- ``name: T = Query(...)`` / ``Form`` / ``Body`` → ``name: Annotated[T, Query(...)] = <default>``
  when a Python default exists (including ``None``), or no ``=`` when the parameter is required
  (e.g. first argument to ``Query`` is ``...``).

Parameters are **reordered** when needed so non-defaulted parameters precede defaulted ones.
FastAPI resolves by name, so reordering is safe.

After running:

  uv run python scripts/annotate_fastapi_injection.py app/main.py
  uvx ruff format app/main.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import libcst as cst

_DEPENDS_ONLY = frozenset({"Depends"})
_SPLIT_DEFAULT = frozenset({"Query", "Form", "Body", "File", "Path"})
_ALL_INJECT = _DEPENDS_ONLY | _SPLIT_DEFAULT


def _call_name(node: cst.BaseExpression) -> str | None:
    if isinstance(node, cst.Call):
        f = node.func
        if isinstance(f, cst.Name):
            return f.value
    return None


def _split_fastapi_default_wrapper(call: cst.Call) -> tuple[cst.Call, cst.BaseExpression | None] | None:
    """Extract Python default from Query/Form/Body/File/Path call for Annotated style.

    Returns ``(inner_call, None)`` if the parameter has no outer default (required).
    Returns ``(inner_call, expr)`` if the parameter should be ``= expr``.
    Returns ``None`` if the call should not be transformed (e.g. ``*args``).
    """
    for a in call.args:
        if a.star:  # '*', '**', or kwarg splat — skip transform
            return None

    args = list(call.args)
    pos_indices: list[int] = []
    for i, a in enumerate(args):
        if a.keyword is None:
            pos_indices.append(i)

    if pos_indices:
        first_i = pos_indices[0]
        first_val = args[first_i].value
        if isinstance(first_val, cst.Ellipsis):
            return call, None
        new_args = [a for j, a in enumerate(args) if j != first_i]
        inner = call.with_changes(args=new_args)
        return inner, first_val

    default_i: int | None = None
    for i, a in enumerate(args):
        if a.keyword is not None and a.keyword.value == "default":
            default_i = i
            break
    if default_i is not None:
        val = args[default_i].value
        new_args = [a for j, a in enumerate(args) if j != default_i]
        inner = call.with_changes(args=new_args)
        return inner, val

    return call, None


def _transform_param_if_eligible(node: cst.Param) -> cst.Param:
    if node.star in ("*", "**"):
        return node
    default = node.default
    if default is None or not isinstance(default, cst.Call):
        return node
    cn = _call_name(default)
    if cn not in _ALL_INJECT:
        return node
    ann = node.annotation
    if ann is None:
        return node
    inner = ann.annotation

    if cn in _DEPENDS_ONLY:
        meta: cst.BaseExpression = default
        outer: cst.BaseExpression | None = None
    elif cn in _SPLIT_DEFAULT:
        split = _split_fastapi_default_wrapper(default)
        if split is None:
            return node
        meta_call, outer = split
        meta = meta_call
    else:
        return node

    new_annotation = cst.Annotation(
        annotation=cst.Subscript(
            value=cst.Name("Annotated"),
            slice=[
                cst.SubscriptElement(slice=cst.Index(value=inner)),
                cst.SubscriptElement(slice=cst.Index(value=meta)),
            ],
        )
    )
    if outer is None:
        return node.with_changes(annotation=new_annotation, default=None, equal=None)
    eq = cst.AssignEqual(
        whitespace_before=cst.SimpleWhitespace(" "),
        whitespace_after=cst.SimpleWhitespace(" "),
    )
    return node.with_changes(annotation=new_annotation, default=outer, equal=eq)


def _param_has_python_default(param: cst.Param) -> bool:
    return param.default is not None


def _stable_partition_no_default_first(
    group: tuple[cst.Param | cst.MaybeSentinel, ...],
) -> tuple[cst.Param | cst.MaybeSentinel, ...]:
    leading: list[cst.Param | cst.MaybeSentinel] = []
    no_def: list[cst.Param] = []
    with_def: list[cst.Param] = []
    for item in group:
        if not isinstance(item, cst.Param):
            leading.append(item)
            continue
        if _param_has_python_default(item):
            with_def.append(item)
        else:
            no_def.append(item)
    return tuple(leading + no_def + with_def)


def _maybe_transform_parameters(parameters: cst.Parameters) -> cst.Parameters:
    def map_and_partition(
        group: tuple[cst.Param | cst.MaybeSentinel, ...],
    ) -> tuple[tuple, bool]:
        transformed: list = []
        changed = False
        for item in group:
            if isinstance(item, cst.Param):
                nu = _transform_param_if_eligible(item)
                if nu is not item:
                    changed = True
                transformed.append(nu)
            else:
                transformed.append(item)
        t = tuple(transformed)
        reordered = _stable_partition_no_default_first(t)
        if reordered != t:
            changed = True
        return reordered, changed

    po, c1 = map_and_partition(parameters.posonly_params)
    pa, c2 = map_and_partition(parameters.params)
    kw, c3 = map_and_partition(parameters.kwonly_params)
    if not (c1 or c2 or c3):
        return parameters

    return parameters.with_changes(posonly_params=po, params=pa, kwonly_params=kw)


def _leave_func_params(
    updated: cst.FunctionDef | cst.AsyncFunctionDef,
) -> cst.FunctionDef | cst.AsyncFunctionDef:
    np = _maybe_transform_parameters(updated.params)
    return updated.with_changes(params=np)


class _InjectToAnnotated(cst.CSTTransformer):
    def leave_FunctionDef(
        self, _o: cst.FunctionDef, updated: cst.FunctionDef
    ) -> cst.FunctionDef:
        return _leave_func_params(updated)  # type: ignore[return-value]

    def leave_AsyncFunctionDef(
        self, _o: cst.AsyncFunctionDef, updated: cst.AsyncFunctionDef
    ) -> cst.AsyncFunctionDef:
        return _leave_func_params(updated)  # type: ignore[return-value]


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] or [Path("app/main.py")]
    for path in paths:
        src = path.read_text(encoding="utf-8")
        mod = cst.parse_module(src)
        out = mod.visit(_InjectToAnnotated())
        path.write_text(out.code, encoding="utf-8")
        print(f"updated {path}")
    print("Tip: run `uvx ruff format <paths>` to normalize indentation after reordering.")


if __name__ == "__main__":
    main()
