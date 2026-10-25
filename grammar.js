'use strict';

// The upstream snapshot is unchanged. See docs/ARCHITECTURE.md for the baseline.
const verilog = require('./vendor/verilog/grammar');
const commaSep1 = rule => seq(rule, repeat(seq(',', rule)));
const commaSep = rule => optional(commaSep1(rule));

// Retain upstream precedence while removing SystemVerilog-only alternatives.
function prune(rule, excluded) {
  if ((rule.type === 'SYMBOL' && excluded.has(rule.name)) ||
      (rule.type === 'STRING' && excluded.has(rule.value))) return null;
  if (rule.members) {
    const members = rule.members.map(r => prune(r, excluded));
    if (rule.type === 'CHOICE') {
      const kept = members.filter(Boolean);
      return kept.length ? {...rule, members: kept} : null;
    }
    if (members.some(r => !r)) return null;
    return {...rule, members};
  }
  if (rule.content) {
    const content = prune(rule.content, excluded);
    return content ? {...rule, content} : null;
  }
  return rule;
}

module.exports = grammar(verilog, {
  name: 'verilog_ams',

  // Structural keywords must not turn into discipline/type identifiers when a
  // damaged block changes the lexical context. SV-only names such as `logic`
  // and `always_ff`, and user-defined discipline names, remain ordinary names.
  reserved: {
    global: _ => [
      'module', 'macromodule', 'connectmodule', 'endmodule',
      'nature', 'endnature', 'discipline', 'enddiscipline',
      'analog', 'initial', 'always', 'begin', 'end',
      'function', 'endfunction', 'task', 'endtask',
      'case', 'casex', 'casez', 'endcase', 'if', 'else',
      'for', 'while', 'repeat', 'forever', 'generate', 'endgenerate',
      'fork', 'join', 'specify', 'endspecify', 'table', 'endtable',
      'connectrules', 'endconnectrules',
    ],
  },

  conflicts: $ => [
    [$.delayed_data, $.delayed_reference],
    [$.primary, $.terminal_identifier],
    [$.terminal_identifier, $.function_call],
    [$.scalar_timing_check_condition, $.mintypmax_expression],
    [$.constant_mintypmax_expression, $.range_bound],
    [$.scalar_timing_check_condition, $.unary_operator],
    [$.module_path_primary, $._hierarchical_parameter_identifier],
    [$.module_path_primary, $.primary_literal],
    [$.function_subroutine_call, $.constant_primary],
    [$.path_delay_expression, $.constant_primary],
    [$.primary, $.net_lvalue],
    [$.delay2, $.param_expression],
    [$.input_identifier, $.output_identifier],
    [$.inout_port_identifier, $.input_port_identifier, $.output_port_identifier],
    [$._constant_part_select_range, $._part_select_range],
    [$.select1, $.nonrange_select1],
    [$.unpacked_dimension, $.constant_select1],
    [$.primary, $._hierarchical_parameter_identifier],
    [$.inout_port_identifier, $.output_port_identifier],
    [$.inout_port_identifier, $.input_port_identifier],
    [$.delay3, $.delay_control],
    [$.unpacked_dimension, $._constant_part_select_range],
    [$.variable_lvalue, $.nonrange_variable_lvalue],
    [$.list_of_variable_port_identifiers, $.discipline_identifier],
    [$.list_of_port_identifiers, $.discipline_identifier],
    [$.combinational_entry, $._seq_input_list],
    [$.module_instantiation, $.udp_instantiation, $.discipline_identifier],
    [$.constant_primary, $.primary],
    [$.list_of_port_declarations, $.list_of_ports],
    [$.ansi_port_declaration, $.port_reference],
    [$.net_lvalue, $.variable_lvalue],
    [$.port_reference, $.ansi_port_declaration, $.discipline_identifier],
    [$.ansi_port_declaration, $.discipline_identifier],
    [$.net_decl_assignment, $.discipline_identifier],
  ],

  rules: {
    // Verilog-AMS 2.4 Annex A.1.2: exclude SV packages/classes/interfaces.
    _description: $ => choice(
      $._directives, $.module_declaration, $.udp_declaration,
      $.nature_declaration, $.discipline_declaration, $.connectrules_declaration,
    ),
    module_header: $ => seq(
      repeat($.attribute_instance), $.module_keyword, field('name', $._module_identifier),
    ),
    module_keyword: _ => choice('module', 'macromodule', 'connectmodule'),
    module_nonansi_header: $ => seq(optional($.parameter_port_list), $.list_of_ports),
    module_ansi_header: $ => seq(
      optional($.parameter_port_list), $.list_of_port_declarations,
    ),
    module_declaration: $ => seq(
      $.module_header,
      optional(choice($.module_nonansi_header, $.module_ansi_header, $.parameter_port_list)),
      ';', repeat($._module_item), 'endmodule',
    ),
    _non_port_module_item: $ => choice(
      $._directives, $.generate_region, $.module_or_generate_item, $.specify_block,
      seq(repeat($.attribute_instance), $.specparam_declaration),
    ),
    _module_common_item: $ => choice(
      $._module_or_generate_item_declaration, $.continuous_assign,
      $.initial_construct, $.always_construct, $.loop_generate_construct,
      $._conditional_generate_construct, $.analog_construct,
    ),
    _module_or_generate_item_declaration: $ => choice(
      $.net_declaration, $.data_declaration, $.task_declaration,
      $.function_declaration, $.genvar_declaration,
      seq($._any_parameter_declaration, ';'), $.branch_declaration,
      $.analog_function_declaration, $.aliasparam_declaration,
    ),
    // Upstream generate regions also allow interface/checker items. Restrict them.
    _generate_item: $ => $.module_or_generate_item,

    // A.1.6–7: declarations are syntax only; nature names are user-defined.
    nature_declaration: $ => seq(
      'nature', field('name', $._identifier),
      optional(seq(':', field('parent', $.nature_reference))), optional(';'),
      repeat(choice($.nature_attribute, $._directives)), 'endnature',
    ),
    nature_reference: $ => seq(
      $._identifier, optional(seq('.', choice('potential', 'flow'))),
    ),
    nature_attribute: $ => seq(
      field('name', choice($._identifier, 'access', 'units', 'abstol', 'idt_nature', 'ddt_nature')),
      '=', field('value', $.expression), ';',
    ),
    discipline_declaration: $ => seq(
      'discipline', field('name', $.discipline_identifier), optional(';'),
      repeat(choice($.nature_binding, $.discipline_domain_binding,
        $.nature_attribute_override, $._directives)), 'enddiscipline',
    ),
    discipline_identifier: $ => $._identifier,
    nature_binding: $ => seq(
      choice('potential', 'flow'), field('nature', $._identifier), ';',
    ),
    discipline_domain_binding: _ => seq('domain', choice('continuous', 'discrete'), ';'),
    nature_attribute_override: $ => seq(choice('potential', 'flow'), '.', $.nature_attribute),

    // A.1.8: basic connect module insertion and discipline resolution.
    connectrules_declaration: $ => seq(
      'connectrules', field('name', $._identifier), ';',
      repeat(choice($.connect_insertion, $.connect_resolution, $._directives)),
      'endconnectrules',
    ),
    connect_insertion: $ => seq(
      'connect', field('module', $._identifier), optional(choice('merged', 'split')),
      optional($.parameter_value_assignment),
      optional(seq(optional($.port_direction), $.discipline_identifier, ',',
        optional($.port_direction), $.discipline_identifier)), ';',
    ),
    connect_resolution: $ => seq(
      'connect', commaSep1($.discipline_identifier),
      'resolveto', choice($.discipline_identifier, 'exclude'), ';',
    ),

    // A.2.1–2: keep legacy Verilog types; SV 'logic' remains a valid AMS name.
    integer_atom_type: _ => choice('integer', 'time'),
    integer_vector_type: _ => 'reg',
    non_integer_type: _ => choice('real', 'realtime'),
    data_type: $ => choice(
      seq($.integer_vector_type, optional('signed'), optional($.packed_dimension)),
      $.integer_atom_type, $.non_integer_type, 'event',
    ),
    data_declaration: $ => seq($.data_type, $.list_of_variable_decl_assignments, ';'),
    variable_decl_assignment: $ => seq(
      $._variable_identifier, repeat($.unpacked_dimension),
      optional(seq('=', choice($.expression, $.array_initializer))),
    ),
    array_initializer: $ => seq("'{", commaSep1($.constant_expression), '}'),
    _variable_dimension: $ => $.unpacked_dimension,
    packed_dimension: $ => seq('[', $.constant_range, ']'),
    net_declaration: $ => seq(
      choice(
        seq($.net_type, optional($.discipline_identifier),
          optional(choice($.drive_strength, $.charge_strength)),
          optional(choice('vectored', 'scalared')), optional('signed')),
        seq(choice('wreal', 'ground'), optional($.discipline_identifier)),
        $.discipline_identifier,
      ),
      optional($.packed_dimension), optional($.delay3),
      $.list_of_net_decl_assignments, ';',
    ),
    net_decl_assignment: $ => seq(
      $._net_identifier, repeat($.unpacked_dimension), optional(seq('=', $.expression)),
    ),
    port_direction: _ => choice('input', 'output', 'inout'),
    port_declaration: $ => seq(
      repeat($.attribute_instance),
      choice($.input_declaration, $.output_declaration, $.inout_declaration),
    ),
    _ams_port_type: $ => choice(
      seq($.discipline_identifier, optional(choice($.net_type, 'wreal'))),
      $.net_type, 'wreal', 'reg', 'integer', 'real', 'realtime', 'time',
    ),
    _ams_port_qualifiers: $ => choice(
      seq($._ams_port_type, optional('signed'), optional($.packed_dimension)),
      seq('signed', optional($.packed_dimension)), $.packed_dimension,
    ),
    input_declaration: $ => seq('input', optional($._ams_port_qualifiers), $.list_of_port_identifiers),
    output_declaration: $ => seq('output', optional($._ams_port_qualifiers), $.list_of_variable_port_identifiers),
    inout_declaration: $ => seq('inout', optional($._ams_port_qualifiers), $.list_of_port_identifiers),
    ansi_port_declaration: $ => seq(
      optional($.port_direction), optional($._ams_port_qualifiers), $.port_identifier,
      repeat($.unpacked_dimension),
    ),
    parameter_port_declaration: $ => $._any_parameter_declaration,
    parameter_declaration: $ => seq('parameter', optional($.parameter_type), $.list_of_param_assignments),
    local_parameter_declaration: $ => seq('localparam', optional($.parameter_type), $.list_of_param_assignments),
    parameter_type: $ => choice(
      'integer', 'real', 'realtime', 'time', 'string',
      seq('signed', optional($.packed_dimension)), $.packed_dimension,
    ),
    param_assignment: $ => seq(
      field('name', $.parameter_identifier), repeat($.unpacked_dimension), '=',
      field('value', choice($.constant_mintypmax_expression, $.array_initializer)),
      repeat($.parameter_value_range),
    ),
    parameter_value_range: $ => choice(
      seq(choice('from', 'exclude'), choice('(', '['), $.range_bound, ':',
        $.range_bound, choice(')', ']')),
      seq('exclude', $.constant_expression),
      seq(choice('from', 'exclude'), "'{", commaSep1($.string_literal), '}'),
    ),
    range_bound: $ => choice($.constant_expression, 'inf', seq('-', 'inf')),
    aliasparam_declaration: $ => seq('aliasparam', $._identifier, '=', $._identifier, ';'),
    branch_declaration: $ => seq(
      'branch', '(', choice(
        seq($.branch_terminal, optional(seq(',', $.branch_terminal))), $.port_branch,
      ), ')', commaSep1(field('name', $._identifier)), ';',
    ),
    branch_terminal: $ => seq($.hierarchical_identifier, optional($.constant_select1)),
    port_branch: $ => seq('<', $.hierarchical_identifier, '>'),

    // Analog statements use their own recursion: contributions cannot leak into
    // digital always/initial blocks. More detailed semantic restrictions are left
    // to the compiler (e.g. legal placement of analog operators).
    analog_construct: $ => seq('analog', optional('initial'), field('body', $.analog_statement)),
    analog_statement: $ => seq(repeat($.attribute_instance), choice(
      $.analog_seq_block, $.analog_conditional_statement, $.analog_case_statement,
      $.analog_loop_statement, $.analog_event_control_statement,
      $.contribution_statement, $.analog_procedural_assignment,
      seq($.system_tf_call, ';'), ';',
    )),
    analog_seq_block: $ => seq(
      'begin', optional(seq(':', field('name', $._identifier))),
      repeat(choice($.block_item_declaration, $.analog_statement, $._directives)), 'end',
    ),
    analog_conditional_statement: $ => prec.right(seq(
      'if', '(', field('condition', $.expression), ')',
      field('consequence', $.analog_statement),
      optional(seq('else', field('alternative', $.analog_statement))),
    )),
    analog_case_statement: $ => seq(
      $.case_keyword, '(', $.expression, ')', repeat1($.analog_case_item), 'endcase',
    ),
    analog_case_item: $ => choice(
      seq(commaSep1($.expression), ':', $.analog_statement),
      seq('default', optional(':'), $.analog_statement),
    ),
    analog_loop_statement: $ => choice(
      seq(choice('repeat', 'while'), '(', $.expression, ')', $.analog_statement),
      seq('for', '(', $.variable_assignment, ';', $.expression, ';',
        $.variable_assignment, ')', $.analog_statement),
    ),
    analog_procedural_assignment: $ => seq($.variable_assignment, ';'),
    contribution_statement: $ => seq(
      field('target', $.branch_access), '<+', field('value', $.expression), ';',
    ),
    branch_access: $ => seq(
      field('access', $._identifier), '(', choice(
        seq($.branch_terminal, optional(seq(',', $.branch_terminal))), $.port_branch,
      ), ')',
    ),
    analog_event_control_statement: $ => seq($.analog_event_control, $.analog_statement),
    analog_event_control: $ => seq('@', choice(
      $.hierarchical_identifier, seq('(', $.analog_event_expression, ')'),
    )),
    analog_event_expression: $ => choice(
      $.analog_step_event,
      seq(optional($.edge_identifier), $.expression),
      prec.left(seq($.analog_event_expression, choice('or', ','), $.analog_event_expression)),
    ),
    analog_step_event: $ => seq(
      choice('initial_step', 'final_step'),
      optional(seq('(', commaSep1($.string_literal), ')')),
    ),
    analog_function_declaration: $ => seq(
      'analog', 'function', optional(choice('real', 'integer')),
      field('name', $.function_identifier), ';',
      repeat1(choice($.tf_port_declaration, $.block_item_declaration, $._directives)),
      field('body', $.analog_function_statement), 'endfunction',
    ),
    analog_function_statement: $ => seq(repeat($.attribute_instance), choice(
      $.analog_function_seq_block, $.analog_function_conditional_statement,
      $.analog_function_case_statement, $.analog_function_loop_statement,
      $.analog_procedural_assignment, seq($.system_tf_call, ';'), ';',
    )),
    analog_function_seq_block: $ => seq(
      'begin', optional(seq(':', $._identifier)), repeat($.block_item_declaration),
      repeat($.analog_function_statement), 'end',
    ),
    analog_function_conditional_statement: $ => prec.right(seq(
      'if', '(', $.expression, ')', $.analog_function_statement,
      optional(seq('else', $.analog_function_statement)),
    )),
    analog_function_case_statement: $ => seq(
      'case', '(', $.expression, ')', repeat1(choice(
        seq(commaSep1($.expression), ':', $.analog_function_statement),
        seq('default', optional(':'), $.analog_function_statement),
      )), 'endcase',
    ),
    analog_function_loop_statement: $ => choice(
      seq(choice('repeat', 'while'), '(', $.expression, ')', $.analog_function_statement),
      seq('for', '(', $.variable_assignment, ';', $.expression, ';',
        $.variable_assignment, ')', $.analog_function_statement),
    ),

    // Digital Verilog-2005 adaptation: retain upstream structures, not SV syntax.
    function_body_declaration: $ => seq(
      optional(choice($.data_type, $.implicit_data_type1)), $.function_identifier,
      choice(seq(';', repeat($.tf_item_declaration)),
        seq('(', optional($.tf_port_list), ')', ';', repeat($.block_item_declaration))),
      repeat($.function_statement_or_null), 'endfunction',
    ),
    task_body_declaration: $ => seq(
      $.task_identifier, choice(seq(';', repeat($.tf_item_declaration)),
        seq('(', optional($.tf_port_list), ')', ';', repeat($.block_item_declaration))),
      repeat($.statement_or_null), 'endtask',
    ),
    lifetime: _ => 'automatic',
    tf_port_direction: $ => $.port_direction,
    tf_port_declaration: $ => seq(
      repeat($.attribute_instance), $.port_direction,
      optional(choice($.data_type, $.implicit_data_type1)), $.list_of_tf_variable_identifiers, ';',
    ),
    tf_port_item1: $ => seq(
      repeat($.attribute_instance), optional($.port_direction),
      optional(choice($.data_type, $.implicit_data_type1)), $.port_identifier,
      repeat($.unpacked_dimension),
    ),
    block_item_declaration: $ => seq(repeat($.attribute_instance), choice(
      $.data_declaration, seq($._any_parameter_declaration, ';'),
    )),
    always_keyword: _ => 'always',
    statement_item: $ => choice(
      seq($.blocking_assignment, ';'), seq($.nonblocking_assignment, ';'),
      seq($.procedural_continuous_assignment, ';'), seq($.system_tf_call, ';'),
      seq($.function_call, ';'), $.case_statement, $.conditional_statement,
      $.disable_statement, $.event_trigger, $.loop_statement,
      $.par_block, $.seq_block, $.procedural_timing_control_statement, $.wait_statement,
    ),
    assignment_operator: _ => '=',
    blocking_assignment: $ => prec.left(21, seq(
      $.variable_lvalue, '=', optional($.delay_or_event_control), $.expression,
    )),
    conditional_statement: $ => prec.right(seq(
      'if', '(', $.expression, ')', $.statement_or_null,
      optional(seq('else', $.statement_or_null)),
    )),
    case_statement: $ => seq(
      $.case_keyword, '(', $.case_expression, ')', repeat1($.case_item), 'endcase',
    ),
    loop_statement: $ => choice(
      seq('forever', $.statement_or_null),
      seq(choice('repeat', 'while'), '(', $.expression, ')', $.statement_or_null),
      seq('for', '(', $.variable_assignment, ';', $.expression, ';',
        $.variable_assignment, ')', $.statement_or_null),
    ),
    _procedural_timing_control: $ => choice($.delay_control, $.event_control),
    event_control: $ => choice(
      seq('@', $._hierarchical_event_identifier), seq('@', '(', $.event_expression, ')'),
      '@*', seq('@', '(', '*', ')'),
    ),
    event_expression: ($, original) => choice(original, $.analog_step_event),
    join_keyword: _ => 'join',
    wait_statement: $ => seq('wait', '(', $.expression, ')', $.statement_or_null),
    event_trigger: $ => seq('->', $._hierarchical_event_identifier, ';'),

    expression: (_, original) => prune(original, new Set([
      'inc_or_dec_expression', 'operator_assignment', 'inside_expression',
      'tagged_union_expression', '==?', '!=?', '->', '<->',
    ])),
    constant_expression: (_, original) => prune(original, new Set(['==?', '!=?', '->', '<->'])),
    conditional_expression: $ => prec.right(23, seq(
      $.expression, '?', repeat($.attribute_instance), $.expression, ':', $.expression,
    )),
    primary: $ => choice(
      $.primary_literal, seq($.hierarchical_identifier, optional($.select1)),
      seq($.concatenation, optional(seq('[', $.range_expression, ']'))),
      seq($.multiple_concatenation, optional(seq('[', $.range_expression, ']'))),
      $.function_call, $.system_tf_call, seq('(', $.mintypmax_expression, ')'),
      $.port_branch,
    ),
    constant_primary: $ => choice(
      $.primary_literal, seq($.ps_parameter_identifier, optional($.constant_select1)),
      seq($.constant_concatenation, optional(seq('[', $._constant_range_expression, ']'))),
      seq($.constant_multiple_concatenation, optional(seq('[', $._constant_range_expression, ']'))),
      seq('(', $.constant_mintypmax_expression, ')'), $.function_call, $.system_tf_call,
    ),
    primary_literal: $ => choice($._number, $.string_literal, $.text_macro_usage),
    function_call: $ => seq(
      field('function', $.hierarchical_identifier), repeat($.attribute_instance), $.argument_list,
    ),
    argument_list: $ => seq('(', commaSep(optional($.expression)), ')'),
    system_tf_call: $ => prec.left(seq($.system_tf_identifier, optional($.argument_list))),
    function_subroutine_call: $ => choice($.function_call, $.system_tf_call),
    param_expression: $ => $.mintypmax_expression,
    constant_param_expression: $ => $.constant_mintypmax_expression,
    ps_identifier: $ => $._identifier,
    ps_or_hierarchical_net_identifier: $ => $._hierarchical_net_identifier,
    ps_parameter_identifier: $ => $._hierarchical_parameter_identifier,
    net_lvalue: $ => choice(
      seq($._hierarchical_net_identifier, optional($.constant_select1)),
      prec.left(20, seq('{', commaSep1($.net_lvalue), '}')),
    ),
    variable_lvalue: $ => choice(
      prec.left(37, seq($._hierarchical_variable_identifier, optional($.select1))),
      prec.left(20, seq('{', commaSep1($.variable_lvalue), '}')),
    ),
    nonrange_variable_lvalue: $ => seq(
      $._hierarchical_variable_identifier, optional($.nonrange_select1),
    ),
    hierarchical_identifier: $ => prec.left(seq(
      repeat(seq($._identifier, optional($.constant_bit_select1), '.')), $._identifier,
    )),
    // A.2.6 real literals add engineering suffixes (not SPICE unit words).
    real_number: ($, original) => choice(original, $.scaled_real_number),
    scaled_real_number: _ => token(seq(
      /[0-9][0-9_]*(\.[0-9][0-9_]*)?/, /[TGMKkmunpfa]/,
    )),
    string_literal: _ => seq('"', repeat(choice(
      token.immediate(/[^"\\\r\n]+/), token.immediate(/\\[^\r\n]/),
      token.immediate(/\\\r?\n/),
    )), '"'),
    escaped_identifier: _ => token(seq('\\', /[^\s]+/)),
    // Macro definitions stay opaque; only function-like uses are parsed.
    text_macro_usage: $ => prec.left(seq('`', $.text_macro_identifier, optional($.argument_list))),
    text_macro_name: $ => seq(
      $.text_macro_identifier,
      optional(seq(token.immediate('('), optional($.list_of_formal_arguments), ')')),
    ),
    delay2: $ => seq('#', choice($.delay_value,
      seq('(', $.mintypmax_expression, optional(seq(',', $.mintypmax_expression)), ')'))),
    delay3: $ => seq('#', choice($.delay_value,
      seq('(', $.mintypmax_expression,
        optional(seq(',', $.mintypmax_expression, optional(seq(',', $.mintypmax_expression)))), ')'))),
  },
});
