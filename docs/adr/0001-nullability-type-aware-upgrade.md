# ADR 0001: Upgrade nullability rule when custom plugins can use type information

## Status

Accepted

## Context

The original goal for `@mkaradeniz/oxlint-plugin-nullability` was a type-aware rule:

- report nullable truthiness checks that should use `isNotNullOrUndefined`;
- avoid boolean-typed values and other non-nullish truthiness checks;
- only autofix when the rewrite is semantically equivalent;
- use TypeScript facts to decide when single `null` or `undefined` comparisons are safe to rewrite.

Oxlint's native `--type-aware` mode does not currently expose type information to custom JavaScript plugins. Because of that, the plugin cannot fully implement the original rule contract today.

The current implementation is intentionally annotation-aware instead. It uses syntax and nearby TypeScript annotations where available, reports conservatively, and limits autofixes to cases that are safe without semantic type information.

Upstream tracking:

- Full semantic type-aware support: <https://github.com/oxc-project/oxc/issues/19596>
- Broader JavaScript plugin work: <https://github.com/oxc-project/oxc/issues/19918>

## Decision

Keep `@mkaradeniz/nullability/prefer-is-not-null-or-undefined` as an annotation-aware rule until Oxlint exposes semantic type information to custom JavaScript plugins.

When that capability exists, upgrade this rule instead of creating a second rule. The public rule name should stay:

```text
@mkaradeniz/nullability/prefer-is-not-null-or-undefined
```

## Future Upgrade Plan

When custom plugins can read type information:

1. Replace annotation inference with Oxlint-provided type facts.
2. Preserve existing syntactic detections for explicit nullish comparisons and filter predicates.
3. Add type-aware handling for nullable truthiness guards in condition positions:
   - `if`, `while`, `do while`, and `for` test expressions;
   - ternary tests;
   - logical condition gates;
   - JSX conditional rendering gates.
4. Continue allowing:
   - boolean-typed values;
   - normal comparisons unrelated to nullability;
   - direct JSX rendering and JSX prop values;
   - destructured locals where the nullable source is no longer knowable;
   - nullish coalescing and values normalized through nullish coalescing;
   - `||` fallback/default-value expressions;
   - expressions already guarded with `isNotNullOrUndefined` in the same logical flow.
5. Add autofixes only when the type facts prove equivalence:
   - paired explicit checks such as `value !== null && value !== undefined`;
   - loose nullish checks such as `value != null`;
   - single `null` checks for `T | null`;
   - single `undefined` checks for `T | undefined`;
   - filter predicates that exactly duplicate `isNotNullOrUndefined`;
   - truthiness guards where every non-nullish constituent is always truthy.
6. Keep reporting without a fix for ambiguous truthiness.
7. Keep the existing import rule: autofix only when the exact named import already exists and is not shadowed.

## Consequences

The current package remains useful without pretending to be fully type-aware.

The future work is preserved in a stable repo document, with the upstream trigger and the intended behavior recorded where release and maintenance work can find it.
