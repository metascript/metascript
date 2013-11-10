var util = require('util');
var fs = require('fs');
var escodegen = require('escodegen');



function Meta() {
  if (!(this instanceof Meta)) {
    return new Meta();
  }

  function process_string(s, line_handler) {
    var lines = s.split("\n");
    for (var i = 0; i < lines.length; i++) {
      line_handler(lines[i]);
    }
  }

  function StringReader(s, name) {
    if (!(this instanceof  StringReader)) {
      return new StringReader(s, name);
    }
    this.name = typeof name === 'string' ? name : 'memory';
    this.error = null;
    this.value = s;
    this.start = function(line_handler) {
      process_string(this.value, line_handler);
    };
  }
  this.StringReader = StringReader;

  function FileReader(filename) {
    if (!(this instanceof  FileReader)) {
      return new FileReader(filename);
    }
    this.name = filename;
    this.error = null;
    try {
      this.value = fs.readFileSync(filename, {encoding: 'utf8'});
    } catch (e) {
      this.value = '';
      this.error = e.message;
    }
    this.start = function(line_handler) {
      process_string(this.value, line_handler);
    };
  }
  this.FileReader = FileReader;

  this.TAB_SIZE = -1;



  function BlockSymbol(id, open_id, close_id, new_scope, close, comma, new_line) {
    // key in symbol table
    this.id = id;
    // small string used when printing block starts
    this.open_id = open_id;
    // small string used when printing block ends
    this.close_id = close_id;
    // true if the block needs a new scope when created
    this.needs_new_scope = new_scope;
    // (compiler, closing char)
    this.handle_close = close;
    // (compiler)
    this.handle_comma = comma;
    // (compiler, first_char)
    this.handle_new_line = new_line;
  }
  this.BlockSymbol = BlockSymbol;
  BlockSymbol.prototype.meta = this;

  var block_symbol_par = new BlockSymbol(
    '()', '(', ')', true,
    function(compiler, closing) {
      var my_closing = this.id.charAt(1);
      if (my_closing === closing) {
        compiler.close_block();
      } else {
        compiler.error('Mismatched closed block: "' + closing + '"');
      }
    },
    function(compiler) {
      compiler.error('Misplaced ","');
    },
    function(compiler, first_char) {
      if (compiler.current_column_number >= compiler.current_block.block.level) {
        compiler.open_block('<block>');
        compiler.open_block('<line>');
      } else {
        var my_closing = this.id.charAt(1);
        if (my_closing !== first_char) {
          compiler.error('Indentation is less than enclosing block level');
        }
      }
    }
  );
  var block_symbol_square = new BlockSymbol(
    '[]', '[', ']', true,
    block_symbol_par.handle_close,
    block_symbol_par.handle_comma,
    block_symbol_par.handle_new_line
  );
  var block_symbol_curly = new BlockSymbol(
    '{}', '{', '}', true,
    block_symbol_par.handle_close,
    block_symbol_par.handle_comma,
    block_symbol_par.handle_new_line
  );
  var block_symbol_block = new BlockSymbol(
    '<block>', '(b', ')', true,
    function(compiler, closing) {
      var block = compiler.current_block;
      if (block.is_empty()) {
        compiler.remove_current_block();
      } else {
        compiler.close_block();
      }
      if (compiler.current_block !== block) {
        compiler.current_block.sym.block_data.handle_close(compiler, closing);
      } else {
        compiler.error('Misplaced close symbol: "' + closing + '"');
      }
    },
    function(compiler) {
      compiler.error('Misplaced ","');
    },
    function(compiler, first_char) {
      var block = compiler.current_block;
      if (compiler.current_column_number > block.block.level) {
        compiler.open_block('<block>');
        compiler.open_block('<line>');
      } else if (compiler.current_column_number === block.block.level) {
        compiler.open_block('<line>');
      } else {
        compiler.close_block();
        compiler.current_block.sym.block_data.handle_new_line(compiler, first_char);
      }
    }
  );
  var block_symbol_do = new BlockSymbol(
    '<do>', '(d', ')', true,
    block_symbol_block.handle_close,
    block_symbol_block.handle_comma,
    function(compiler, first_char) {
      var block = compiler.current_block;
      if (compiler.current_line_number === block.loc.start.line + 1) {
        block.block.level = compiler.current_column_number;
        compiler.open_block('<line>');
      } else {
        block_symbol_block.handle_new_line(compiler, first_char);
      }
    }
  );
  var block_symbol_line = new BlockSymbol(
    '<line>', '(l', ')', false,
    block_symbol_block.handle_close,
    block_symbol_block.handle_comma,
    function(compiler, first_char) {
      var block = compiler.current_block;
      if (compiler.current_column_number > block.block.level) {
        compiler.open_block('<block>');
        compiler.open_block('<line>');
      } else {
        if (block.is_empty()) {
          compiler.remove_current_block();
        } else {
          compiler.close_block();
        }
        compiler.current_block.sym.block_data.handle_new_line(compiler, first_char);
      }
    }
  );
  var block_symbol_comma = new BlockSymbol(
    '<comma>', '(c', ')', false,
    block_symbol_block.handle_close,
    function(compiler) {
      var block = compiler.current_block;
      if (block.is_empty()) {
        compiler.Expr('<none>');
      }
      compiler.close_block();
      compiler.open_block('<comma>');
    },
    function(compiler, first_char) {
      var block = compiler.current_block;
      if (block.is_empty()) {
        var parent = block.parent;
        if (parent.args.length === 1) {
          compiler.remove_current_block();
          compiler.open_block('<block>');
          compiler.open_block('<line>');
          parent.block.level = first_char;
        }
      }
    }
  );



  function MetaSymbol(shape, precedence, fromright, arity, func, value, bag) {
    // shape is one of 'infix', 'prefix', 'postfix', 'none'
    this.shape = shape;
    this.precedence = precedence;
    // true if it is right associative
    this.fromright = fromright;
    // integer
    this.arity = arity;
    // meta function
    this.func = func;
    this.value = typeof value === 'undefined' ? null : value;
    this.bag = typeof bag === 'undefined' ? null : bag;
  }
  this.MetaSymbol = MetaSymbol;
  MetaSymbol.prototype.meta = this;




  function Symbol(id, kind, type, def, meta_data, block_data) {
    this.id = id;
    // one of 'external', 'local', 'argument', 'builtin', 'meta'
    this.kind = kind;
    this.type = typeof type === 'undefined' ? 'any' : type;
    this.def = typeof def === 'undefined' ? null : def;
    this.meta_data = typeof meta_data === 'undefined' ? null : meta_data;
    this.block_data = typeof block_data === 'undefined' ? null : block_data;
  }
  this.Symbol = Symbol;
  Symbol.prototype.meta = this;
  Symbol.prototype.is_meta = function() {
    return this.meta_data !== null;
  };
  Symbol.prototype.is_block = function() {
    return this.block_data !== null;
  };
  Symbol.prototype.is_block_with_new_scope = function() {
    return this.is_block() && this.block_data.needs_new_scope === true;
  };
  Symbol.prototype.is_builtin = function() {
    return this.kind === 'builtin';
  };

  this.PRIMITIVES.value = new Symbol('<val>', 'builtin');
  this.PRIMITIVES.operator = new Symbol('<op>', 'builtin');
  this.PRIMITIVES.identifier = new Symbol('<id>', 'builtin');
  this.PRIMITIVES.none = new Symbol('<none>', 'builtin');
  this.PRIMITIVES.par = new Symbol('()', 'block', undefined,
                                   null, null, block_symbol_par);
  this.PRIMITIVES.square = new Symbol('[]', 'block', undefined,
                                      null, null, block_symbol_square);
  this.PRIMITIVES.curly = new Symbol('{}', 'block', undefined,
                                     null, null, block_symbol_curly);
  this.PRIMITIVES.block = new Symbol('<block>', 'block', undefined,
                                     null, null, block_symbol_block);
  this.PRIMITIVES.doblock = new Symbol('<do>', 'block', undefined,
                                     null, null, block_symbol_do);
  this.PRIMITIVES.line = new Symbol('<line>', 'block', undefined,
                                     null, null, block_symbol_line);
  this.PRIMITIVES.comma = new Symbol('<comma>', 'block', undefined,
                                     null, null, block_symbol_comma);
  this.PRIMITIVES['<val>'] = this.PRIMITIVES.value;
  this.PRIMITIVES['<op>'] = this.PRIMITIVES.operator;
  this.PRIMITIVES['<id>'] = this.PRIMITIVES.identifier;
  this.PRIMITIVES['<none>'] = this.PRIMITIVES.none;
  this.PRIMITIVES['()'] = this.PRIMITIVES.par;
  this.PRIMITIVES['[]'] = this.PRIMITIVES.square;
  this.PRIMITIVES['{}'] = this.PRIMITIVES.curly;
  this.PRIMITIVES['<block>'] = this.PRIMITIVES.block;
  this.PRIMITIVES['<do>'] = this.PRIMITIVES.doblock;
  this.PRIMITIVES['<line>'] = this.PRIMITIVES.line;
  this.PRIMITIVES['<comma>'] = this.PRIMITIVES.comma;

  this.addall_objects(this.ROOT_SCOPE, function(s) {
    return s.id;
  }, [
    this.PRIMITIVES.value,
    this.PRIMITIVES.operator,
    this.PRIMITIVES.identifier,
    this.PRIMITIVES.none,
    this.PRIMITIVES.par,
    this.PRIMITIVES.square,
    this.PRIMITIVES.curly,
    this.PRIMITIVES.block,
    this.PRIMITIVES.line,
    this.PRIMITIVES.comma
  ]);
  // More root scope filling...


  this.addall(this.RESERVED, [
    'abstract', 'as', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
    'class', 'continue', 'const', 'debugger', 'default', 'delete', 'do',
    'double', 'else', 'enum', 'export', 'extends', 'false', 'final',
    'finally', 'float', 'for', 'function', 'goto', 'if', 'implements',
    'import', 'in', 'instanceof', 'int', 'interface', 'is', 'long',
    'namespace', 'native', 'new', 'null', 'package', 'private', 'protected',
    'public', 'return', 'short', 'static', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'use',
    'var', 'void', 'volatile', 'while', 'with'
  ]);




  function Compiler(r) {
    if (!(this instanceof  Compiler)) {
      return new Compiler(r);
    }

    function ParseError(message, line, column_number) {
      this.message = message;
      this.line_number = typeof line === 'undefined' ?
          this.compiler.current_line_number : line;
      this.column_number = typeof column_number === 'undefined' ?
          this.compiler.current_column_number : column_number;
    }
    this.ParseError = ParseError;
    ParseError.prototype.compiler = this;
    ParseError.prototype.toString = function() {
      return "error [" + this.line_number + "," + this.column_number + "]: " + this.message;
    };

    function Expr(sym, val, args, parent) {
      if (!(this instanceof  Expr)) {
        return new Expr(sym, val, args, parent);
      }

      if (typeof sym === 'string') {
        this.sym = this.compiler.PRIMITIVES[sym];
      } else {
        this.sym = sym;
      }

      this.val = typeof val === 'undefined' ? null : val;

      this.args = [];
      if (typeof args !== 'undefined' && util.isArray(args)) {
        for (var i = 0; i < args.length; i++) {
          this.args[i] = args [i];
        }
      }

      if (typeof parent === 'undefined') {
        // No parent provided: assume it is the current block
        // (this works when the constructor is called by the parser).
        this.loc = this.compiler.current_location();
        if (this.compiler.current_block !== null) {
          this.compiler.current_block.push(this);
        }
        this.parent = this.compiler.current_block;
      } else {
        // Use the provided parent.
        this.loc = this.compiler.unknown_location();
        parent.push(this);
        this.parent = parent;
      }

      if (this.should_be_block()) {
        this.block = {
          level: this.loc.start.column,
          scope: this.compiler.new_scope(this),
          expr: this
        };
      } else {
        this.block = null;
      }

      this.js = null;
    }
    this.Expr = Expr;
    Expr.prototype.compiler = this;

    Expr.prototype.push = function(arg) {
      arg.parent = this;
      this.args.push(arg);
    };
    Expr.prototype.unshift = function(arg) {
      arg.parent = this;
      this.args.unshift(arg);
    };
    Expr.prototype.pop = function() {
      var result = this.args.pop();
      result.parent = null;
      return result;
    };
    Expr.prototype.shift = function() {
      var result = this.args.shift();
      result.parent = null;
      return result;
    };
    Expr.prototype.remove = function(index) {
      if (typeof index !== 'number') {
        index = this.args.indexOf(index);
        if (index < 0) { return null; }
      }
      var result = this.args[index];
      result.parent = null;
      this.args.splice(index, 1);
      return result;
    };

    Expr.prototype.isReserved = function() {
      return this.compiler.is_reserved(this.sym.id);
    };
    Expr.prototype.should_be_block = function() {
      return this.compiler.is_block(this.sym.id);
    };
    Expr.prototype.is_block = function() {
      return this.block !== null;
    };
    Expr.prototype.is_empty = function() {
      return this.args.length === 0;
    };

    Expr.prototype.scope = function() {
      if (this.is_block() &&
          typeof this.block !== 'undefined' &&
          typeof this.block.scope !== 'undefined') {
        return this.block.scope;
      } else if (this.parent !== null) {
        return this.parent.scope();
      } else {
        return null;
      }
    };

    Expr.prototype.string_dump = function() {
      var result = '';
      if (this.sym.block_data !== null) {
        result += this.sym.block_data.open_id;
        if (this.sym.block_data.open_id.length > 1) { result += ' '; }
        for (var i = 0; i < this.args.length; i++) {
          if (i > 0) { result += ' '; }
          result += this.args[i].string_dump();
        }
        result += this.sym.block_data.close_id;
      } else {
        var id = this.sym.id;
        if (id.indexOf('<') === 0) {
          id = id.substring(1, id.length - 1);
        }
        result += id;
        result += ':';
        if (typeof this.val === 'string') {
          result += '"';
          result += this.val;
          result += '"';
        } else {
          result += this.val;
        }

        if (this.args.length > 0) {
          result += ' ( ';
          for (var j = 0; j < this.args.length; j++) {
            if (j > 0) { result += ' '; }
            result += this.args[j].string_dump();
          }
          result += ')';
        }
      }
      return result;
    };

    function compare_for_testing(template, path) {
      if (!path) { path = '.'; }
      if (!template) {
        return util.format('op "%s" but no template at path "%s"',
            this.op, path);
      } else if (this.sym.id !== template[0]) {
        return util.format('sym "%s" but template requires sym "%s" at path "%s"',
            this.sym.id, template[0], path);
      } else if (this.value !== template[1]) {
        return util.format('value "%s" but template requires value "%s" at path "%s"',
            this.value, template[1], path);
      } else {
        var template_args = template[2];
        if ((!template_args) && this.args.length > 0) {
          return util.format('%d args but empty template at path "%s"',
              this.args.length, path);
        } else if (template_args.length !== this.args.length) {
          return util.format('%d args but template has %d path "%s"',
              this.args.length, template_args.length, path);
        } else {
          for (var i = 0; i < this.args.length; i++) {
            var arg_result = this.args[i].compare_for_testing(template_args[i], path + '/' + i);
            if (arg_result) { return arg_result; }
          }
          return null;
        }
      }
    }
    Expr.prototype.compare_for_testing = compare_for_testing;

    Expr.prototype.toString = function() {
      return util.format('sym "%s", val "%s"', this.sym.id, this.val);
    };

    this.errors = [];
    this.reader = r;
    if (!(r instanceof StringReader || r instanceof FileReader)) {
      this.error('Invalid reader');
      this.reader = new StringReader('');
    }
    if (this.reader.error) {
      this.error(this.reader.error);
    }

    this.source = this.reader.name;
    this.current_line_number = 0;
    this.current_column_number = 0;
    this.current_level = 0;
    this.current_block = null;
    this.root = this.open_block('<block>');
    this.current_block = this.root;

    this.multiline_string_is_literate = false;
    this.multiline_string_contents = null;
    this.multiline_string_terminator = null;

    //var compile_binary_op = function() {}
    //var compile_unary_op = function() {}
    //var compile_throw = function() {}
    //var compile_try = function() {}
    //var compile_new = function() {}
    //var compile_var = function() {}
    //var compile_assignment = function() {}
    //var compile_update = function() {}
    //var compile_function = function() {}
    //var compile_if = function() {}
    //var compile_do = function() {}
    //var compile_loop = function() {}
    //var compile_switch = function() {}
    //var compile_element = function() {}
    //var compile_member = function() {}
    //var compile_literal = function() {}
    //var compile_array = function() {}
    //var compile_object = function() {}
    //var compile_macro = function() {}
    //var compile_include = function() {}

    //add_builtin('+', compile_binary_op);



  }
  this.Compiler = Compiler;
  //util.inherits(Compiler, this);
  Compiler.prototype = this;

  Compiler.prototype.current_location = function(c1, c2) {
    var line = this.current_line_number;
    if (!c1) { c1 = this.current_column_number; }
    if (!c2) { c2 = this.current_column_number; }
    return {
      source: this.source ? this.source : null,
      start: {line: line, column: c1},
      end: {line: line, column: c1}
    };
  };
  Compiler.prototype.set_location_end = function(location, column) {
    if (location) {
      if (typeof column === 'undefined') { column = this.current_column_number; }
      location.end.line = this.current_line_number;
      location.end.column = column;
    }
  };
  Compiler.prototype.enclosing_location = function(start, end) {
    if (start && end) {
      return {
        source: start.source,
        start: start.start,
        end: end.end
      };
    } else {
      return null;
    }
  };
  Compiler.prototype.unknown_location = function() {
    return {
      source: 'unknown',
      start: {line: 0, column: 0},
      end: {line: 0, column: 0}
    };
  };

  Compiler.prototype.block_stack = function() {
    var result = '( ';
    var cur = this.current_block;
    while (cur !== null) {
      result += cur.sym.id;
      result += ':';
      result += cur.block.level;
      result += ' ';
      cur = cur.parent;
    }
    result += ')';
    return result;
  };

  Compiler.prototype.open_block = function(kind) {
    var new_block = this.Expr(kind);
    this.current_block = new_block;
    return new_block;
  };

  Compiler.prototype.close_block = function() {
    var result = this.current_block;
    if (result !== null) {
      this.set_location_end(result.loc);
      result = result.parent;
      if (result !== null) {
        this.current_block = result;
      } else {
        this.error("Closing root block");
      }
    }
    return result;
  };
  Compiler.prototype.remove_current_block = function() {
    var current = this.current_block;
    this.close_block();
    if (current !== null) {
      this.current_block.remove(current);
    }
    return this.current_block;
  };

  Compiler.prototype.add_primitive = function(primitive, value) {
    this.Expr(primitive, value);
  };
  Compiler.prototype.add_value = function(value) {
    switch(typeof value) {
      case 'undefined':
      case 'boolean':
      case 'number':
      case 'string':
        this.add_primitive('<val>', value);
        break;
      case 'object':
        if (value !== null) {
          this.error('Unexpected object value');
        }
        this.add_primitive('<val>', null);
        break;
      default:
        this.error('Unexpected value type ' + typeof value);
        this.add_primitive('<val>', null);
        break;
    }
  };
  Compiler.prototype.add_operator = function(value) {
    this.add_primitive('<op>', value);
  };
  Compiler.prototype.add_identifier = function(value) {
    this.add_primitive('<id>', value);
  };
  Compiler.prototype.add_none = function() {
    this.add_primitive('<none>', null);
  };

  Compiler.prototype.error = function(message, line, column_number) {
    this.errors.push(new this.ParseError(message, line, column_number));
  };

  Compiler.prototype.current_scope = function() {
    if (this.current_block !== null) {
      return this.current_block.block.scope;
    } else {
      return null;
    }
  };
  Compiler.prototype.new_scope = function(expr) {
    var starting_scope = expr.scope();
    if (starting_scope === null) { starting_scope = this.ROOT_SCOPE; }
    if (this.is_block_with_new_scope(expr.sym.id) ||
        starting_scope === this.ROOT_SCOPE) {
      return Object.create(starting_scope);
    } else {
      return starting_scope;
    }
  };

  Compiler.prototype.is_reserved = function(s) {
    return this.has(this.RESERVED, s);
  };
  Compiler.prototype.is_block = function(s) {
    return this.has(this.PRIMITIVES, s) && this.PRIMITIVES[s].block_data !== null;
  };
  Compiler.prototype.is_block_with_new_scope = function(s) {
    return this.is_block(s) && this.PRIMITIVES[s].block_data.needs_new_scope;
  };

  Compiler.prototype.process_line = function(line) {
    this.current_line_number++;

    if (this.multiline_string_contents !== null) {
      if (line === this.multiline_string_terminator) {
        if (!this.multiline_string_is_literate) {
          this.add_value(this.multiline_string_contents);
        }
        this.multiline_string_is_literate = false;
        this.multiline_string_contents = null;
        this.multiline_string_terminator = null;
      } else {
        this.multiline_string_contents += line;
        if (this.multiline_string_terminator !== '"""') {
          this.multiline_string_contents += '\n';
        }
      }
      return;
    }

    var remaining = line;
    var me = this;
    var has_error = false;

    var tryMatch = function(pattern) {
      var m = remaining.match(pattern);
      if (m !== null) {
        var token = m[0];
        remaining = remaining.substring(token.length);
        return token;
      } else {
        return null;
      }
    };
    var afterMatch = function(token) {
      me.current_column_number += token.length;
    };
    var consume_char = function() {
      has_error = false;
      remaining = remaining.substring(1);
      if (remaining === null) {
        remaining = '';
      }
      me.current_column_number++;
    };
    var consume_string_literal = function() {
      has_error = false;
      var delimiter = remaining.charAt(0);
      var multiline_delimiter = delimiter + delimiter + delimiter;
      if (remaining.indexOf(multiline_delimiter) === 0) {
        if (me.current_column_number === 0) {
          me.multiline_string_is_literate = true;
        }
        remaining = remaining.substring(3);
        me.multiline_string_contents = '';
        me.current_column_number += 3;
        if (remaining === null || remaining.length === 0) {
          me.multiline_string_terminator = multiline_delimiter;
        } else {
          me.multiline_string_terminator = remaining;
        }
        remaining = null;
      } else {
        var token = '';
        consume_char();
        while (remaining !== null && remaining.length > 0) {
          var current = remaining.charAt(0);
          if (current === delimiter) {
            me.add_value(token);
            consume_char();
            return;
          } else if (current === '\\') {
            consume_char();
            var quoted = remaining.charAt(0);
            consume_char();
            switch(quoted) {
              case 'b':
                token += '\b';
                break;
              case 'f':
                token += '\f';
                break;
              case 'n':
                token += '\n';
                break;
              case 'r':
                token += '\r';
                break;
              case 't':
                token += '\t';
                break;
              case 'v':
                token += '\v';
                break;
              case '\'':
                token += '\'';
                break;
              case '\"':
                token += '\"';
                break;
              case '\\':
                token += '\\';
                break;
              case 'x':
                var hex_latin1 = remaining.substring(0, 2);
                remaining = remaining.substring(2);
                me.current_column_number += 2;
                if (/^[0-9a-fA-F][0-9a-fA-F]/.test(hex_latin1)) {
                  token += String.fromCharCode(parseInt(hex_latin1, 16));
                } else {
                  me.error('Unrecognized hex escape');
                  token += '?';
                }
                break;
              case 'u':
                var hex_unicode = remaining.substring(0, 4);
                remaining = remaining.substring(4);
                me.current_column_number += 4;
                if (/^[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/.test(hex_unicode)) {
                  token += String.fromCharCode(parseInt(hex_unicode, 16));
                } else {
                  me.error('Unrecognized unicode escape');
                  token += '?';
                }
                break;
              case '0':
              case '1':
              case '2':
              case '3':
              case '4':
              case '4':
              case '5':
              case '6':
              case '7':
                var hex_octal = quoted + remaining.substring(0, 2);
                remaining = remaining.substring(2);
                me.current_column_number += 2;
                if (/^[0-7][0-7][0-7]/.test(hex_octal)) {
                  token += String.fromCharCode(parseInt(hex_octal, 8));
                } else {
                  me.error('Unrecognized octal escape');
                  token += '?';
                }
                break;
              default:
                 token += quoted;
                break;
            }
          } else {
            token += current;
            consume_char();
          }
        }
        me.error('Unterminated string literal');
        remaining = null;
      }
    };

    this.current_column_number = 0;
    var is_in_indent = true;
    while (is_in_indent) {
      if (remaining.charAt(0) === ' ') {
        consume_char();
      } else if (remaining.charAt(0) === '\t') {
        consume_char();
        if (this.TAB_SIZE > 0) {
          this.current_column_number += (this.TAB_SIZE - 1);
        } else {
          this.error("No tabs allowed for indentation", 0);
        }
      } else {
        is_in_indent = false;
      }
    }

    var apply_indentation = true;

    // Pure comment lines do not affect indentation blocks.
    if (remaining.charAt(0) === ';') {
      apply_indentation = false;
    }

    // Ignore multiline strings starting at column 0
    // (they can be used for literate programming).
    if (this.current_column_number === 0 &&
        (remaining.indexOf('"""') === 0 || remaining.indexOf("'''") === 0)) {
      apply_indentation = false;
    }

    // Handle block structure
    if (apply_indentation) {
      this.current_block.sym.block_data.handle_new_line(this, remaining.charAt(0));
    }
    
    while (remaining !== null && remaining.length > 0) {
      switch (remaining.charAt(0)) {
        case '(':
          this.open_block('()');
          this.open_block('<comma>');
          consume_char();
          break;
        case '[':
          this.open_block('[]');
          this.open_block('<comma>');
          consume_char();
          break;
        case '{':
          this.open_block('{}');
          this.open_block('<comma>');
          consume_char();
          break;
        case ')':
          this.current_block.sym.block_data.handle_close(this, ')');
          consume_char();
          break;
        case ']':
          this.current_block.sym.block_data.handle_close(this, ']');
          consume_char();
          break;
        case '}':
          this.current_block.sym.block_data.handle_close(this, '}');
          consume_char();
          break;
        case ',':
          this.current_block.sym.block_data.handle_comma(this);
          consume_char();
          break;
        case ' ':
        case '\t':
          consume_char();
          break;
        case ';':
          remaining = null;
          break;
        case '"':
        case "'":
          consume_string_literal();
          break;
        default:
          var token;
          token = tryMatch(/^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/);
          if (token !== null) {
            if (token === 'do') {
              this.open_block('<do>');
            } else {
              this.add_identifier(token);
            }
            afterMatch(token);
            break;
          }
          token = tryMatch(/^-?[0-9]*\.?[0-9]+/);
          if (token !== null) {
            var exponent = tryMatch(/^e[\-+]?[0-9]+/i);
            if (exponent !== null) {
              token += exponent;
            }
            this.add_value(Number(token));
            if (exponent !== null) {
              afterMatch(exponent);
            }
            afterMatch(token);
            break;
          }
          token = tryMatch(/^[\\\+\*\-\/<>\:\~\|\^\#\@\!\?\&\.\=]+/);
          if (token !== null) {
            this.add_operator(token);
            afterMatch(token);
            break;
          }
          if (!has_error) {
            this.error('Unrecognized character \'' + remaining.charAt(0) + '\'');
            has_error = true;
          }
          remaining = remaining.substring(1);
          me.current_column_number++;
          break;
      }
    }
  };

  Compiler.prototype.parse = function() {
    var me = this;
    this.reader.start(function(line) {
      me.process_line(line);
    });
    return me;
  };

}

Meta.prototype.has = function(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
};
Meta.prototype.get = function(map, key) {
  return this.has(map, key) ? map[key] : null;
};
Meta.prototype.newmap = function() {
  return Object.create(null);
};
Meta.prototype.addall = function(map, keys, value) {
  if (typeof value === 'undefined') { value = true; }
  for (var i = 0; i < keys.length; i++) {
    map[keys[i]] = value;
  }
};
Meta.prototype.addall_objects = function(map, key, values) {
  for (var i = 0; i < values.length; i++) {
    map[key(values[i])] = values[i];
  }
};

Meta.prototype.compiler_from_string = function(s) {
  return this.Compiler(this.StringReader(s));
};

Meta.prototype.RESERVED = Meta.prototype.newmap();
Meta.prototype.PRIMITIVES = Meta.prototype.newmap();
Meta.prototype.ROOT_SCOPE = Meta.prototype.newmap();


module.exports = Meta;
