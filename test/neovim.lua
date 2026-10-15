-- Runs with -u NONE -i NONE; no user configuration or plugin installation needed.
vim.opt.runtimepath:prepend(vim.fn.getcwd())
assert(vim.treesitter.language.add('verilog_ams'))
local info = vim.treesitter.language.inspect('verilog_ams')
assert(info.abi_version == 15, 'Unexpected parser ABI')

local function tree(source)
  local parser = vim.treesitter.get_string_parser(source, 'verilog_ams')
  return parser:parse()[1]:root(), parser
end

local function walk(node, callback)
  callback(node)
  for child in node:iter_children() do walk(child, callback) end
end

local function assert_valid(source, name)
  local root = tree(source)
  assert(not root:has_error(), (name or 'source') .. ': ' .. root:sexpr())
  return root
end

local fixture_count = 0
for _, path in ipairs(vim.fn.glob('examples/*', false, true)) do
  local file = assert(io.open(path, 'rb'))
  local source = file:read('*a')
  file:close()
  assert_valid(source, path)
  fixture_count = fixture_count + 1
end

local invalid = {
  ['missing semicolon'] = 'module m; electrical p analog V(p) <+ 1; endmodule',
  ['unclosed analog block'] = 'module m; analog begin V(p) <+ 1; endmodule',
  ['missing endmodule'] = 'module m; analog V(p) <+ 1;',
  ['missing nature terminator'] = 'nature Voltage; units = "V";',
  ['incomplete contribution'] = 'module m; analog V(p) <+ ; endmodule',
  ['invalid branch terminals'] = 'module m; branch (p,n,g) b; endmodule',
  ['malformed parameter range'] = 'module m; parameter real r=1 from (0:); endmodule',
  ['missing parameter value'] = 'module m; parameter real r; endmodule',
  ['digital contribution'] = 'module m; always V(p) <+ 1; endmodule',
  ['nonblocking analog assignment'] = 'module m; analog x <= 1; endmodule',
  ['contribution in analog function'] = 'module m; analog function real f; input x; real x; begin V(p) <+ x; end endfunction endmodule',
  ['SystemVerilog package'] = 'package p; endpackage',
  ['SystemVerilog class'] = 'class c; endclass',
  ['broken function call'] = 'module m; analog V(p) <+ sin(1; endmodule',
  ['invalid scale suffix'] = 'module m; parameter real r = 1meg; endmodule',
  ['SystemVerilog unbased literal'] = "module m; assign a = '0; endmodule",
  ['unescaped string newline'] = 'module m; parameter string s = "broken\nstring"; endmodule',
  ['unterminated comment'] = 'module m; /* never closed',
}
local invalid_count = 0
for name, source in pairs(invalid) do
  assert(tree(source):has_error(), 'Expected syntax error: ' .. name)
  invalid_count = invalid_count + 1
end

-- Verify zero-width recovery is visible independently of ERROR nodes.
local recovered = tree('module m; analog begin x = 1 end endmodule')
local missing = false
walk(recovered, function(node) if node:missing() then missing = true end end)
assert(missing, 'Missing token recovery must be exposed')

-- Comments, directives, and opaque macro bodies retain exact source ranges.
local preserved = '// μ comment\r\n`define SCALE(x) ((x) * 2)\r\nmodule m; /* body */ analog V(p) <+ `SCALE(1.0); endmodule'
local root = assert_valid(preserved, 'CRLF / Unicode / no final newline')
local comments, macros = 0, 0
walk(root, function(node)
  local kind = node:type()
  if kind == 'comment' then
    comments = comments + 1
    local text = vim.treesitter.get_node_text(node, preserved)
    assert(text == '// μ comment\r' or text == '// μ comment' or text == '/* body */')
  elseif kind == 'macro_text' then
    macros = macros + 1
    assert(vim.treesitter.get_node_text(node, preserved):find('((x) * 2)', 1, true))
  end
end)
assert(comments == 2 and macros == 1, 'Comments and macro body must be retained')

-- Exercise actual query compilation and captures, not just syntax trees.
local highlights = assert(vim.treesitter.query.get('verilog_ams', 'highlights'))
local folds = assert(vim.treesitter.query.get('verilog_ams', 'folds'))
local sample = 'module m; electrical p; analog begin I(p) <+ ddt(V(p)); end endmodule'
local sample_root = assert_valid(sample)
local captures = {}
for id, node in highlights:iter_captures(sample_root, sample) do
  local name = highlights.captures[id]
  local text = vim.treesitter.get_node_text(node, sample)
  captures[name .. ':' .. text] = true
end
assert(captures['keyword:analog'])
assert(captures['operator:<+'])
assert(captures['function.builtin:ddt'])
assert(captures['type:electrical'])
assert(captures['function.call:I'])
assert(folds:iter_captures(sample_root, sample)() ~= nil, 'Fold query must match')

-- Check incremental reparsing after changing a syntax error to valid source.
local buf = vim.api.nvim_create_buf(true, false)
vim.api.nvim_set_current_buf(buf)
vim.api.nvim_buf_set_name(buf, vim.fn.getcwd() .. '/build/toggle.va')
vim.api.nvim_buf_set_lines(buf, 0, -1, false, { 'module m;', '  analog begin x = 1 end', 'endmodule' })
local integration = require('verilog_ams')
assert(vim.treesitter.highlighter.active[buf] == nil, 'require must have no side effects')
integration.setup({ enabled = false, diagnostics = true, debounce_ms = 0 })
assert(vim.treesitter.highlighter.active[buf] == nil)
integration.enable()
assert(vim.bo[buf].filetype == 'verilogams')
assert(vim.treesitter.highlighter.active[buf] ~= nil)
local namespace = vim.api.nvim_get_namespaces()['verilog_ams.syntax']
-- The namespace is created only when the first diagnostics are published.
assert(vim.wait(1000, function()
  namespace = vim.api.nvim_get_namespaces()['verilog_ams.syntax']
  return namespace and #vim.diagnostic.get(buf, { namespace = namespace }) > 0
end), 'Expected missing-token diagnostic')
vim.api.nvim_buf_set_lines(buf, 1, 2, false, { '  analog begin x = 1; end' })
vim.api.nvim_exec_autocmds('TextChanged', { buffer = buf })
assert(vim.wait(1000, function()
  return #vim.diagnostic.get(buf, { namespace = namespace }) == 0
end), 'Diagnostics should clear after repair')
assert(not vim.treesitter.get_parser(buf, 'verilog_ams'):parse()[1]:root():has_error())
assert(vim.filetype.match({ filename = 'model.va' }) == 'verilogams')
assert(vim.filetype.match({ filename = 'model.vams' }) == 'verilogams')
assert(vim.filetype.match({ filename = 'model.vah' }) == 'verilogams')
assert(vim.filetype.match({ filename = 'rtl.v' }) ~= 'verilogams')
integration.disable()
assert(vim.treesitter.highlighter.active[buf] == nil)
assert(#vim.diagnostic.get(buf, { namespace = namespace }) == 0)
assert(vim.filetype.match({ filename = 'model.va' }) ~= 'verilogams')
assert(not pcall(vim.api.nvim_get_autocmds, { group = 'verilog_ams' }))
-- Repeated setup and toggles must not accumulate handlers or revive old jobs.
integration.setup({ diagnostics = true, debounce_ms = 0 })
integration.setup({ diagnostics = true, debounce_ms = 0 })
assert(#vim.api.nvim_get_autocmds({ group = 'verilog_ams' }) == 6)
vim.api.nvim_exec_autocmds('TextChanged', { buffer = buf })
integration.disable()
vim.wait(50, function() return false end)
assert(#vim.diagnostic.get(buf, { namespace = namespace }) == 0)
print(string.format('Neovim: %d realistic fixtures, %d invalid inputs, recovery, source preservation, queries, incremental parsing, and toggles passed', fixture_count, invalid_count))
vim.cmd('qa!')
