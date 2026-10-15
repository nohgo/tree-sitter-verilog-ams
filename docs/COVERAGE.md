# Language coverage

Reference: [Accellera Verilog-AMS 2.4 LRM](https://accellera.org/images/downloads/standards/v-ams/VAMS-LRM-2-4.pdf).
The parser targets editor use and core modeling constructs; it is not an LRM
conformance implementation. All examples here are original test models, not
simulator-qualified device models or redistributed PDK sources.

| Area / LRM clause | Implemented syntax | Verification |
| --- | --- | --- |
| Lexical conventions, §2 | Integer/real literals, engineering suffixes, escaped names, strings, comments | Upstream number/identifier corpus; Unicode/CRLF and string rejection tests |
| Parameters, §3.4 / A.2.1 | Types, arrays, string sets, `from`, `exclude`, mixed open/closed ranges, `inf`, `aliasparam` | `ams_declarations.txt` |
| Natures/disciplines, §3 / A.1.6–7 | Attributes, inheritance including discipline nature references, domain, potential/flow bindings and overrides | `ams_natures.txt` |
| Analog connectivity, §3 / A.2 | Discipline nets, ground, `wreal`, ANSI/non-ANSI ports, buses, named/port branches | `ams_declarations.txt`; resistor example |
| Expressions, §4 | Verilog arithmetic/logic/conditional precedence, access calls, system/math/analog/filter/noise calls, optional call arguments | `ams_analog.txt`; diode/capacitor examples |
| Analog behavior, §5 | Blocks, initialization, assignments, contributions, if/else, case, repeat/while/for, named blocks | `ams_analog.txt` |
| Analog functions, §5 / A.2.6 | Real/integer/default return types, legacy argument declarations, local declarations, control flow | `ams_analog.txt`; sample/hold example |
| Events, §5 / A.6.5 | Initial/final step including analysis names, cross/above/timer-style calls, edge events, event unions and null bodies | `ams_analog.txt` |
| Hierarchy, §6 | Module instances, parameter overrides, generate regions/loops, analog genvar loops | Upstream instance corpus; `ams_mixed_signal.txt` |
| Mixed-signal connectivity, A.1.8 | `connectmodule`, basic insertion modes/parameters/port overrides, discipline resolution/exclusion | `ams_mixed_signal.txt` |
| Compiler directives | Includes, definitions/continuations, object/function macro uses, common conditionals | `ams_macros.txt`; upstream directive corpus |
| Digital baseline | Traditional module ports, nets, assignments, procedural blocks and expression forms | 57 compatible cases adapted from upstream; originals retained in vendor directory |

## Deliberate limits

- **No preprocessing or semantic analysis.** Unexpanded token-splicing macros,
  conditionals that split a construct, generated names, vendor directives, and
  encrypted sources may produce recovery nodes. Conditional directives are
  preserved individually; their nesting and active branches are not evaluated.
- **No strict signature checking.** Analog operators and event functions use normal
  call syntax. Arity, argument types, legal analog context, nature/branch lookup,
  and operator placement are compiler responsibilities. For example, an analog
  initial block's legal operations are not fully enforced here.
- **Incomplete language coverage.** Paramsets, indirect contributions, specialized
  branch arrays, advanced array operations, configuration blocks, and complete
  connect-rule constraints remain deferred. Some inherited peripheral Verilog
  productions (e.g. UDP/specify forms) are permissive and less exercised.
- **Not SystemVerilog support.** Classes, packages, interfaces, modern data types,
  and assertion constructs are outside the target. A word such as `logic` can
  legitimately name a discipline or identifier in AMS, so a syntax tree alone
  cannot distinguish every SV declaration from an AMS discipline declaration.
- **Source fidelity needs source bytes.** Comments and directives have source
  ranges; whitespace gaps must still be copied from the original text. A
  formatter must reject both `ERROR` and missing-token nodes and must not infer
  semantic safety from a successful parse alone.

## Verification baseline

- Original upstream grammar: **70/70** corpus tests before extension.
- AMS grammar: **74** structural corpus tests (17 AMS + 57 digital regressions).
- Native Neovim: six model/header fixtures, 18 malformed/unsupported inputs,
  missing-token recovery, Unicode/CRLF, macro/comment ranges, query captures,
  incremental repair, extension detection, and repeated enable/disable checks.
- Rust: parser loading, representative model parsing, invalid-source rejection,
  and a usage doctest.

No Cadence compile, large proprietary model-library benchmark, or licensed
simulation validation has been performed. The editor tests use an isolated
`-u NONE -i NONE` session and do not inspect or modify personal Neovim files.
