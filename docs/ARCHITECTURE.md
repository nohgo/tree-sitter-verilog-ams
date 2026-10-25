# Grammar architecture

## Language baseline

Target the practical Verilog-A / Verilog-AMS 2.4 core, built on the traditional
IEEE 1364-2005 Verilog language. Verilog-AMS 2.4 describes its digital baseline as
the Verilog subset of IEEE 1800-2012. Do not assume modern SystemVerilog classes,
packages, interfaces, or data types are Verilog-A features.

References:

- [Accellera Verilog-AMS 2.4 LRM](https://accellera.org/images/downloads/standards/v-ams/VAMS-LRM-2-4.pdf),
  especially clauses 2–6 and Annex A.
- [Accellera's baseline explanation](https://accellera.org/news/press-releases/114-accellera-systems-initiative-enhances-mixed-signal-modeling-and-verification-in-verilog-ams-2-4-standard).

## Upstream and extension boundary

Extend the MIT-licensed
[tree-sitter/tree-sitter-verilog](https://github.com/tree-sitter/tree-sitter-verilog)
at `227d277b6a1a5e2bf818d6206935722a7503de08`. Its history is retained in this
repository. Its current grammar targets SystemVerilog 2017, a superset of the
required digital baseline. `vendor/verilog/grammar.js` is an unmodified snapshot;
the root `grammar.js` uses Tree-sitter grammar inheritance.

The extension narrows source/module entry points, declarations, ports, expressions,
and statements to traditional Verilog-compatible forms, then adds AMS productions.
It reuses upstream identifiers, numeric literals, operators and precedence,
selections, concatenations, attributes, directives, module instances, generate
constructs, gates, UDPs, and specify syntax. This is an editor parser, not a strict
language-version conformance checker: inherited peripheral productions can remain
permissive. Test legacy identifiers such as `logic` explicitly.

## Syntax tree and source preservation

Use distinct named nodes for natures, disciplines, branches, analog constructs,
contributions, parameter constraints, functions, and events. Include meaningful
fields where new rules expose names, targets, values, or bodies. Keep comments as
named extras and preserve directives without evaluating them. No macro expansion,
include resolution, symbol table, discipline checking, or simulator behavior belongs
in this grammar.

Whitespace is not necessarily represented as nodes. A future formatter must retain
the complete original source and copy untouched byte spans, including gaps between
nodes. Missing tokens and `ERROR` nodes are both syntax failures for formatting.
Opaque macro definitions retain their text, but arbitrary token-splicing macros
and incomplete conditional branches can still cause parse errors.

## Scope and implementation order

1. Establish the upstream baseline (70 corpus tests pass before extension).
2. Implement natures/disciplines, analog nets/ports, branches, parameter ranges,
   contributions, analog blocks/functions/events, common calls, and control flow.
3. Cover realistic resistor, capacitor, diode, behavioral source, and mixed-signal
   fixtures, including comments and preprocessor text.
4. Add Neovim highlights/folds and an optional syntax diagnostic adapter.
5. Verify generated C, Rust binding, recovery, queries, and editor enable/disable
   behavior. Record actual tested versions in the README.

Connect modules/rules follow the core if practical. Paramsets, indirect
contributions, specialized array forms, and complete version/semantic enforcement
can be deferred and must be documented as gaps.

## Neovim boundary

Export `tree_sitter_verilog_ams`, use parser name `verilog_ams`, and associate it
with filetype `verilogams` for `.va`, `.vams`, and `.vah`. Ship conventional
`queries/` for parser installers and `queries/verilog_ams/` for direct runtimepath
loading. Editor integration must be explicit and toggleable: requiring a module
alone must not register filetypes, start highlighting, or create diagnostics.

Use native Neovim parsing for smoke tests so verification does not depend on the
user's configuration. Document both current and legacy `nvim-treesitter`
registration, since their custom-parser APIs differ. Keep compiled libraries and
scratch caches local to the project.

## Structural recovery and highlight priorities

Structural AMS/Verilog keywords are globally reserved in the lexer. This prevents
missing block endings from being hidden by reinterpreting a new `module`, `begin`
or similar keyword as a user-defined discipline/type name. This is deliberately
the structural keyword set, not a claim of complete keyword-version switching.
SystemVerilog-only names such as `logic` and `always_ff` remain legal AMS
identifiers when used as names, and escaped identifiers remain supported.

Semantic captures use explicit priorities above generic identifiers. Discipline
references are types; standard `electrical` references use `@type.builtin`.
Nature/discipline definitions, functions, module names and parameters retain their
semantic coloring even when their CST nodes wrap a generic identifier. Native
Neovim tests check the winning capture priority rather than mere capture presence.
