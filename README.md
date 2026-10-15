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

## Neovim: install from GitHub

Add this specification to your `lazy.nvim` plugins. No workspace path is needed:

```lua
return {
  'nohgo/tree-sitter-verilog-ams',
  branch = 'main',
  version = false,
  enabled = vim.g.enable_verilog_ams ~= false,
  lazy = false,
  build = 'make build',
  main = 'verilog_ams',
  opts = {
    highlight = true,
    diagnostics = true, -- optional; false by default
    debounce_ms = 100,
  },
}
```

Run `:Lazy sync` to install. Lazy clones the repository, puts it on Neovim's
runtimepath, and runs `make build` on installation and updates. Each machine needs
`make`, a C compiler, and Tree-sitter CLI 0.27.0 on `$PATH`. Node.js is needed only
to regenerate the grammar, not to build the included parser sources. Restart
Neovim after updating an already loaded parser library.

The explicit `main = 'verilog_ams'` selects the Lua setup module; `branch = 'main'`
and `version = false` select this grammar's branch rather than a release tag.
Set `vim.g.enable_verilog_ams = false` **before Lazy setup** to disable the plugin
on a machine. Consult the [Lazy specification](https://lazy.folke.io/spec) for
repository sources, build hooks, and enablement options.

This uses Neovim's native Tree-sitter API and works alongside `nvim-treesitter`.
It registers `.va`, `.vams`, and `.vah` as `verilogams`, mapped to parser
`verilog_ams`. It leaves `.v` and `.sv` associations alone. No personal editor
files are written by this repository's build or tests.

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

## Local development setup

To work directly on a checkout instead of the published version, clone it and
build locally:

```sh
git clone https://github.com/nohgo/tree-sitter-verilog-ams.git
cd tree-sitter-verilog-ams
make build
```

Replace the repository string in the Lazy specification with
`dir = vim.fn.expand('~/src/tree-sitter-verilog-ams')`, adjusting that development
path to your checkout. Alternatively, prepend that checkout to `runtimepath` and
call `require('verilog_ams').setup({ diagnostics = true })` directly.

## Using nvim-treesitter as the parser installer

Use the API matching your installed branch; the plugin's `main` and legacy
`master` branches have different registration interfaces. These examples follow
[main's custom-language API](https://github.com/nvim-treesitter/nvim-treesitter#adding-custom-languages)
and [master's parser API](https://github.com/nvim-treesitter/nvim-treesitter/blob/master/README.md#adding-parsers).
The native setup above is the locally tested path and needs no parser installer.

For current `main`, register immediately and again on `TSUpdate`:

```lua
local function register()
  require('nvim-treesitter.parsers').verilog_ams = {
    install_info = {
      url = 'https://github.com/nohgo/tree-sitter-verilog-ams',
      branch = 'main',
      queries = 'queries',
    },
  }
end
register()
vim.api.nvim_create_autocmd('User', { pattern = 'TSUpdate', callback = register })
vim.treesitter.language.register('verilog_ams', 'verilogams')
vim.filetype.add({ extension = { va = 'verilogams', vams = 'verilogams', vah = 'verilogams' } })
-- One-time installation: require('nvim-treesitter').install({ 'verilog_ams' })
```

For legacy `master`, keep this repository on `runtimepath` (for example via
Lazy) because that installer does not copy the grammar queries:

```lua
require('nvim-treesitter.parsers').get_parser_configs().verilog_ams = {
  install_info = {
    url = 'https://github.com/nohgo/tree-sitter-verilog-ams',
    branch = 'main',
    files = { 'src/parser.c' },
    generate_requires_npm = false,
    requires_generate_from_grammar = false,
  },
  filetype = 'verilogams',
}
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
