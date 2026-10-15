-- Optional native Neovim integration. Loading this module has no side effects.
local M = {}
local state = { enabled = false, attached = {}, serial = {}, options = {} }
local namespace
local group = 'verilog_ams'

local function ns()
  namespace = namespace or vim.api.nvim_create_namespace('verilog_ams.syntax')
  return namespace
end

local function eligible(buf)
  return state.enabled and vim.api.nvim_buf_is_valid(buf)
    and vim.bo[buf].filetype == 'verilogams'
    and vim.bo[buf].buftype == ''
end

local function syntax_diagnostics(buf)
  if not eligible(buf) or not state.options.diagnostics then return end
  local ok, parser = pcall(vim.treesitter.get_parser, buf, 'verilog_ams')
  if not ok then return end
  local trees = parser:parse()
  if not trees or not trees[1] then return end
  local diagnostics = {}
  local stack = { trees[1]:root() }
  while #stack > 0 do
    local node = table.remove(stack)
    if node:type() == 'ERROR' or node:missing() then
      local row, col, end_row, end_col = node:range()
      diagnostics[#diagnostics + 1] = {
        lnum = row, col = col, end_lnum = end_row, end_col = end_col,
        severity = vim.diagnostic.severity.ERROR,
        source = 'verilog_ams',
        message = node:missing() and ('Missing ' .. node:type()) or 'Unrecognized Verilog-AMS syntax',
      }
      -- A recovery node already covers its children; avoid duplicate diagnostics.
    elseif node:has_error() then
      for child in node:iter_children() do stack[#stack + 1] = child end
    end
  end
  vim.diagnostic.set(ns(), buf, diagnostics)
end

local function schedule(buf)
  state.serial[buf] = (state.serial[buf] or 0) + 1
  local serial = state.serial[buf]
  vim.defer_fn(function()
    if state.serial[buf] == serial then syntax_diagnostics(buf) end
  end, state.options.debounce_ms or 100)
end

local function attach(buf)
  if not eligible(buf) then return end
  if not state.attached[buf] then
    local ok, parser = pcall(vim.treesitter.get_parser, buf, 'verilog_ams')
    if not ok or not parser then
      vim.notify_once('verilog_ams: parser unavailable; run make build in the grammar checkout', vim.log.levels.WARN)
      return
    end
    local owned = false
    if state.options.highlight then
      local was_active = vim.treesitter.highlighter.active[buf] ~= nil
      vim.treesitter.start(buf, 'verilog_ams')
      owned = not was_active
    end
    state.attached[buf] = { highlight_owned = owned }
  end
  if state.options.diagnostics then schedule(buf) end
end

function M.disable()
  state.enabled = false
  pcall(vim.api.nvim_del_augroup_by_name, group)
  for buf, attachment in pairs(state.attached) do
    if vim.api.nvim_buf_is_valid(buf) and attachment.highlight_owned then
      vim.treesitter.stop(buf)
    end
  end
  state.attached = {}
  state.serial = {}
  if namespace then vim.diagnostic.reset(namespace) end
end

function M.enable()
  if state.enabled then return end
  state.enabled = true
  vim.treesitter.language.register('verilog_ams', 'verilogams')
  -- Functions consult the toggle so future buffers fall back when disabled.
  vim.filetype.add({ extension = {
    va = function() if state.enabled then return 'verilogams' end end,
    vams = function() if state.enabled then return 'verilogams' end end,
    vah = function() if state.enabled then return 'verilogams' end end,
  } })
  local id = vim.api.nvim_create_augroup(group, { clear = true })
  vim.api.nvim_create_autocmd({ 'FileType', 'BufEnter' }, {
    group = id,
    callback = function(args)
      if not eligible(args.buf) and state.attached[args.buf] then
        if state.attached[args.buf].highlight_owned then vim.treesitter.stop(args.buf) end
        state.attached[args.buf] = nil
        state.serial[args.buf] = nil
        if namespace then vim.diagnostic.reset(namespace, args.buf) end
      else
        attach(args.buf)
      end
    end,
  })
  if state.options.diagnostics then
    vim.api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI', 'BufWritePost' }, {
      group = id,
      callback = function(args) if eligible(args.buf) then attach(args.buf) end end,
    })
  end
  vim.api.nvim_create_autocmd('BufWipeout', {
    group = id,
    callback = function(args)
      state.attached[args.buf] = nil
      state.serial[args.buf] = nil
    end,
  })
  -- Also handle buffers already open when the integration is enabled.
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) then
      if vim.bo[buf].filetype ~= 'verilogams' then
        local name = vim.api.nvim_buf_get_name(buf)
        if name:match('%.va$') or name:match('%.vams$') or name:match('%.vah$') then
          vim.bo[buf].filetype = 'verilogams'
        end
      end
      attach(buf)
    end
  end
end

function M.setup(options)
  M.disable()
  state.options = vim.tbl_extend('force', { highlight = true, diagnostics = false, debounce_ms = 100 }, options or {})
  if state.options.enabled ~= false then M.enable() end
end

return M
