//! This crate provides Verilog-AMS language support for the [tree-sitter][] parsing library.
//!
//! Typically, you will use the [LANGUAGE][] constant to add this language to a
//! tree-sitter [Parser][], and then use the parser to parse some code:
//!
//! ```
//! let code = r#"
//! module Adder (input a, input b, output sum);
//!     assign sum = a + b;
//!     initial $display("Hello, Verilog!");
//!     initial $finish;
//! endmodule
//! "#;
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_verilog_ams::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Verilog-AMS parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [Parser]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_verilog_ams() -> *const ();
}

/// The tree-sitter [`LanguageFn`][LanguageFn] for this grammar.
///
/// [LanguageFn]: https://docs.rs/tree-sitter-language/*/tree_sitter_language/struct.LanguageFn.html
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_verilog_ams) };

/// The content of the [`node-types.json`][] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// Neovim-compatible highlighting query.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// Folding query for structural blocks.
pub const FOLDS_QUERY: &str = include_str!("../../queries/folds.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Verilog-AMS parser");
    }

    #[test]
    fn parses_analog_models_and_rejects_broken_source() {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&super::LANGUAGE.into()).unwrap();
        for source in [
            include_str!("../../examples/resistor.va"),
            include_str!("../../examples/diode.va"),
            include_str!("../../examples/sample_hold.va"),
        ] {
            let tree = parser.parse(source, None).unwrap();
            assert!(
                !tree.root_node().has_error(),
                "{}",
                tree.root_node().to_sexp()
            );
        }
        let broken = parser
            .parse("module m; analog V(p) <+ ; endmodule", None)
            .unwrap();
        assert!(broken.root_node().has_error());
    }
}
