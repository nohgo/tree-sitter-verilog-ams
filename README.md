# tree-sitter-verilog-ams

A practical Tree-sitter grammar for **Verilog-A and the core of Verilog-AMS 2.4**,
with Neovim highlighting, folding, and optional syntax diagnostics. It extends
[tree-sitter-verilog](https://github.com/tree-sitter/tree-sitter-verilog), rather
than implementing a new Verilog parser.

The language target is the traditional Verilog / IEEE 1364-2005 baseline used by
Verilog-AMS 2.4, not modern SystemVerilog. The upstream grammar is a SystemVerilog
superset; this extension restricts its main entry points and adds AMS productions.
See [architecture](docs/ARCHITECTURE.md) for the exact upstream revision and
[coverage](docs/COVERAGE.md) for supported syntax and remaining gaps. The upstream
MIT license and Git history are retained.

## What works

- Traditional and ANSI modules/ports, analog nets and buses, `wreal`, ground,
  named branches and port branches.
- Natures, inherited natures, disciplines, domains, and nature attribute overrides.
- Typed parameters, engineering suffixes, `from` / `exclude`, open/closed bounds,
  infinities, string parameters, arrays, and `aliasparam`.
- Analog blocks and initialization, `<+` contributions, assignments, conditions,
  cases, loops, analog functions, and analog events.
- Common analog/math/noise/filter calls, access probes, omitted optional arguments,
  system calls, mixed digital/analog behavior, and basic connect modules/rules.
- Comments, include directives, opaque macro definitions, macro calls, and common
  conditional compilation directives, without running a preprocessor.

This is a syntax parser. It does not resolve includes, expand macros, validate
operator signatures, check disciplines, or simulate a model. Parsing successfully
is not proof that a simulator will accept the source.

## Build and test

Development requires a C compiler, Node.js, GNU-compatible `make`, and
**Tree-sitter CLI 0.27.0** on `$PATH`. Neovim tests require Neovim 0.11 or newer.
Rust tests additionally require Cargo. There are no npm dependencies to install.

```sh
make generate       # regenerate src/ with language ABI 15
make build          # compile parser/verilog_ams.so for local Neovim use
make test           # structural corpus plus clean headless Neovim tests
make test-rust      # Rust binding tests and doctest (first run downloads crates)
```

`npm run generate`, `npm run build`, and `npm test` are equivalent entry points.
Generated parser sources are included; consumers compiling those sources do not
need Node.js or the generator. No external scanner is required. Build outputs,
compiler caches, and Rust downloads stay in ignored project directories.

Locally verified with Tree-sitter CLI 0.27.0, parser ABI 15, Node.js 23.9.0,
Neovim 0.11.5 and 0.12.5, and Rust Tree-sitter runtime 0.26.13. CI regenerates the parser and
runs corpus/editor/binding checks; it uses Node.js 22 and Neovim 0.11.5.

## Neovim: simplest local setup

Run `make build`, then add this checkout to your runtimepath and opt in:

```lua
vim.opt.runtimepath:prepend(vim.fn.expand(
  '~/hardware-github/vams-suite/tree-sitter-verilog-ams'
))
require('verilog_ams').setup({
  enabled = true,
  highlight = true,
  diagnostics = true, -- optional; false by default
  debounce_ms = 100,
})
```

This uses Neovim's native Tree-sitter API and works alongside `nvim-treesitter`.
It registers `.va`, `.vams`, and `.vah` as `verilogams`, mapped to parser
`verilog_ams`. It leaves `.v` and `.sv` associations alone. No personal editor
files are written by this repository's build or tests.

For a toggleable local `lazy.nvim` specification:

```lua
return {
  dir = vim.fn.expand('~/hardware-github/vams-suite/tree-sitter-verilog-ams'),
  name = 'tree-sitter-verilog-ams',
  enabled = vim.g.enable_verilog_ams ~= false,
  lazy = false,
  build = 'make build',
  config = function()
    require('verilog_ams').setup({ diagnostics = true })
  end,
}
```

Use `require('verilog_ams').disable()` / `.enable()` during a session, or
`.setup({ enabled = false })` to leave the integration disabled. Disabling clears
its diagnostics, removes its autocommands, and stops highlighting it started.
Existing buffers keep their filetype, and highlighters owned by other integrations
are left to their owners. Future filetype detection falls back while disabled.
Rebuild after grammar changes, then restart Neovim to load the new library.

Optional native folding, set in your own `FileType verilogams` callback:

```lua
vim.wo.foldmethod = 'expr'
vim.wo.foldexpr = 'v:lua.vim.treesitter.foldexpr()'
```

## Using nvim-treesitter as the parser installer

Use the API matching your installed branch; the plugin's `main` and legacy
`master` branches have different registration interfaces. These examples follow
[main's custom-language API](https://github.com/nvim-treesitter/nvim-treesitter#adding-custom-languages)
and [master's parser API](https://github.com/nvim-treesitter/nvim-treesitter/blob/master/README.md#adding-parsers).
The native setup above is the locally tested path and needs no parser installer.

For current `main`, register immediately and again on `TSUpdate`:

```lua
local checkout = vim.fn.expand('~/hardware-github/vams-suite/tree-sitter-verilog-ams')
local function register()
  require('nvim-treesitter.parsers').verilog_ams = {
    install_info = { path = checkout, queries = 'queries' },
  }
end
register()
vim.api.nvim_create_autocmd('User', { pattern = 'TSUpdate', callback = register })
vim.treesitter.language.register('verilog_ams', 'verilogams')
vim.filetype.add({ extension = { va = 'verilogams', vams = 'verilogams', vah = 'verilogams' } })
-- One-time installation: require('nvim-treesitter').install({ 'verilog_ams' })
```

For legacy `master`:

```lua
local checkout = vim.fn.expand('~/hardware-github/vams-suite/tree-sitter-verilog-ams')
require('nvim-treesitter.parsers').get_parser_configs().verilog_ams = {
  install_info = {
    url = checkout,
    files = { 'src/parser.c' },
    generate_requires_npm = false,
    requires_generate_from_grammar = false,
  },
  filetype = 'verilogams',
}
vim.opt.runtimepath:prepend(checkout) -- master does not install grammar queries
vim.treesitter.language.register('verilog_ams', 'verilogams')
vim.filetype.add({ extension = { va = 'verilogams', vams = 'verilogams', vah = 'verilogams' } })
-- One-time installation: :TSInstall verilog_ams
```

The installer configurations install/register a parser; enable highlighting with
`vim.treesitter.start()` in a `FileType` callback, your existing highlighting setup,
or the optional `verilog_ams` module. Choose one owner for automatic highlighting.
For a strict on/off switch, guard installer registration, filetype mapping, and
highlighting with the same boolean; the native module handles those hooks for you.

## Contributing

Keep the vendored grammar unchanged; add extensions in `grammar.js`. Add corpus
cases for every new production and regression cases for bugs, then run generation,
`make test`, and `make test-rust`. Review expected tree changes before accepting
`tree-sitter test --update`. Keep `src/parser.c`, `src/grammar.json`, and
`src/node-types.json` synchronized with the grammar.

Queries live in `queries/*.scm`; the `queries/verilog_ams/` symlinks expose them on
Neovim's runtimepath. The C symbol is `tree_sitter_verilog_ams`; the Rust crate
exports `LANGUAGE`, `NODE_TYPES`, `HIGHLIGHTS_QUERY`, and `FOLDS_QUERY` for consumers
such as the future formatter. C and Rust bindings are supported; inherited
wrappers and publishing configuration for other languages were removed rather
than shipping wrappers for the wrong parser.
