(comment) @comment
(simple_identifier) @variable
(escaped_identifier) @variable
((discipline_identifier) @type
 (#set! priority 110))
((discipline_identifier) @type.builtin
 (#eq? @type.builtin "electrical")
 (#set! priority 120))
((nature_declaration name: (_) @type.definition)
 (#set! priority 110))
((discipline_declaration name: (_) @type.definition)
 (#set! priority 110))
((nature_reference) @type
 (#set! priority 110))
((nature_binding nature: (_) @type)
 (#set! priority 110))
(nature_attribute name: (_) @property)
((module_header name: (_) @module)
 (#set! priority 110))
((function_identifier) @function
 (#set! priority 110))
((function_call function: (_) @function.call)
 (#set! priority 110))
((branch_access access: (_) @function.call)
 (#set! priority 110))
((param_assignment name: (_) @constant)
 (#set! priority 110))
(system_tf_identifier) @function.builtin

((function_call function: (_) @function.builtin)
 (#any-of? @function.builtin
   "V" "I" "potential" "flow" "ddt" "idt" "idtmod" "absdelay" "transition"
   "slew" "limexp" "last_crossing" "cross" "above" "timer" "absdelta"
   "laplace_nd" "laplace_np" "laplace_zd" "laplace_zp" "zi_nd" "zi_np" "zi_zd" "zi_zp"
   "white_noise" "flicker_noise" "noise_table" "noise_table_log"
   "sin" "cos" "tan" "asin" "acos" "atan" "atan2" "sinh" "cosh" "tanh"
   "exp" "ln" "log" "sqrt" "pow" "abs" "min" "max" "ceil" "floor" "hypot")
 (#set! priority 120))

(unsigned_number) @number
(binary_number) @number
(octal_number) @number
(hex_number) @number
(real_number) @number.float
(string_literal) @string
(double_quoted_string) @string

(module_keyword) @keyword
(always_keyword) @keyword
["endmodule" "nature" "endnature" "discipline" "enddiscipline"
 "analog" "initial" "function" "endfunction" "task" "endtask"
 "begin" "end" "generate" "endgenerate" "genvar" "branch"
 "connectrules" "endconnectrules" "connect" "resolveto" "merged" "split"
 "aliasparam" "parameter" "localparam" "specparam" "from" "exclude"
 "domain" "potential" "flow" "continuous" "discrete"
 "initial_step" "final_step"] @keyword
["if" "else" "case" "casex" "casez" "endcase" "default"] @keyword.conditional
["for" "while" "repeat" "forever"] @keyword.repeat
["input" "output" "inout"] @keyword.modifier
["integer" "real" "realtime" "time" "reg" "wreal" "ground" "string" "event"] @type.builtin
(net_type) @type.builtin
["posedge" "negedge" "or"] @keyword
["+" "-" "*" "/" "%" "**" "<+" "=" "<=" ">=" "<" ">"
 "==" "!=" "===" "!==" "&&" "||" "!" "~" "&" "|" "^"
 "~&" "~|" "~^" "^~" "<<" ">>" "<<<" ">>>" "?" ":"] @operator
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" "."] @punctuation.delimiter
"@" @punctuation.special

(include_compiler_directive) @keyword.directive
(id_directive) @keyword.directive
(zero_directive) @keyword.directive
(timescale_compiler_directive) @keyword.directive
(default_nettype_compiler_directive) @keyword.directive
(line_compiler_directive) @keyword.directive
(begin_keywords) @keyword.directive
(text_macro_name) @constant.macro
(text_macro_usage) @constant.macro
(macro_text) @string.special
