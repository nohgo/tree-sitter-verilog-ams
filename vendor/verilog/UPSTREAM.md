# Upstream snapshot

- Repository: https://github.com/tree-sitter/tree-sitter-verilog
- Commit: `227d277b6a1a5e2bf818d6206935722a7503de08`
- License: MIT; see `LICENSE` here and at the repository root.
- Files retained unchanged: `grammar.js`, `LICENSE`, `test/corpus/*.txt`.

The upstream grammar targets IEEE 1800-2017 SystemVerilog. The root grammar uses
Tree-sitter inheritance to adapt its Verilog-compatible subset and add AMS rules.
The original 70 tests passed before modification. Compatible digital cases are
also exercised against the derived grammar with its deliberately updated trees.
