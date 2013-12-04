var util = require('util');
var fs = require('fs');
//var escodegen = require('escodegen');


// The public entry point for the metascript compiler.
function Meta() {
  if (!(this instanceof Meta)) {
    return new Meta();
  }

  // Container for private functions and properties
  var meta = {};

  meta.ExtensibleMap = function () {
    this.values = Object.create(null);
  };
  meta.ExtensibleMap.prototype.has = function (key) {
    return typeof this.values[key] !== 'undefined';
  };
  meta.ExtensibleMap.prototype.get = function (key) {
    return this.has(key) ? this.values[key] : null;
  };
  meta.ExtensibleMap.prototype.set = function (key, value) {
    this.values[key] = value;
  };
  meta.ExtensibleMap.prototype.extend = function () {
    var result = new meta.ExtensibleMap();
    result.values = Object.create(this.values);
    return result;
  };
  meta.ExtensibleMap.prototype.addAllKeysWithValue = function (keys, value) {
    if (typeof value === 'undefined') { value = true; }
    for (var i = 0; i < keys.length; i++) {
      this.values[keys[i]] = value;
    }
  };
  meta.ExtensibleMap.prototype.addAllObjects = function (key, values) {
    for (var i = 0; i < values.length; i++) {
      this.values[key(values[i])] = values[i];
    }
  };

  meta.RESERVED = new meta.ExtensibleMap();
  meta.PRECEDENCES = new meta.ExtensibleMap();
  meta.TOKENS = new meta.ExtensibleMap();
  meta.ROOT_SCOPE = new meta.ExtensibleMap();

  meta.processString = function (s, lineHandler) {
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      lineHandler(lines[i]);
    }
  };

  function StringReader(s, name) {
    if (!(this instanceof  StringReader)) {
      return new StringReader(s, name);
    }
    this.name = typeof name === 'string' ? name : 'memory';
    this.error = null;
    this.value = s;
    this.start = function (lineHandler) {
      meta.processString(this.value, lineHandler);
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
    this.start = function (lineHandler) {
      meta.processString(this.value, lineHandler);
    };
  }
  this.FileReader = FileReader;

  this.TAB_SIZE = -1;

  meta.BlockData = function (id, openMarker, closeMarker, newScope, close, comma, new_line) {
    // key in symbol table
    this.id = id;
    // small string used when printing block starts
    this.openMarker = openMarker;
    // small string used when printing block ends
    this.closeMarker = closeMarker;
    // true if the block needs a new scope when created
    this.needsNewScope = newScope;
    // (parser, closingToken)
    this.handleClose = close;
    // (parser)
    this.handleComma = comma;
    // (parser, firstChar)
    this.handleNewLine = new_line;
  };

  var blockSymbolPar = new meta.BlockData(
    '()', '(', ')', true,
    function (parser, closingToken) {
      var myClosing = this.id.charAt(1);
      if (myClosing === closingToken) {
        parser.closeBlock();
      } else {
        parser.error('Mismatched closed block: "' + closingToken + '"');
      }
    },
    function (parser) {
      parser.error('Misplaced ","');
    },
    function (parser, firstChar) {
      if (parser.currentColumnNumber >= parser.currentBlock.block.level) {
        parser.openBlock('<block>');
        parser.openBlock('<line>');
      } else {
        var myClosing = this.id.charAt(1);
        if (myClosing !== firstChar) {
          parser.error('Indentation is less than enclosing block level');
        }
      }
    }
  );
  var blockSymbolSquare = new meta.BlockData(
    '[]', '[', ']', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine
  );
  var block_symbol_curly = new meta.BlockData(
    '{}', '{', '}', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine
  );
  var blockSymbolBlock = new meta.BlockData(
    '<block>', '(b', ')', true,
    function (parser, closingToken) {
      var block = parser.currentBlock;
      if (block.isEmpty()) {
        parser.removeCurrentBlock();
      } else {
        parser.closeBlock();
      }
      if (parser.currentBlock !== block) {
        parser.currentBlock.sym.blockData.handleClose(parser, closingToken);
      } else {
        parser.error('Misplaced close symbol: "' + closingToken + '"');
      }
    },
    function (parser) {
      parser.error('Misplaced ","');
    },
    function (parser, firstChar) {
      var block = parser.currentBlock;
      if (parser.currentColumnNumber > block.block.level) {
        parser.openBlock('<block>');
        parser.openBlock('<line>');
      } else if (parser.currentColumnNumber === block.block.level) {
        parser.openBlock('<line>');
      } else {
        parser.closeBlock();
        parser.currentBlock.sym.blockData.handleNewLine(parser, firstChar);
      }
    }
  );
  var blockSymbolDo = new meta.BlockData(
    '<do>', '(d', ')', true,
    blockSymbolBlock.handleClose,
    blockSymbolBlock.handleComma,
    function (parser, firstChar) {
      var block = parser.currentBlock;
      if (parser.currentLineNumber === block.loc.start.line + 1) {
        block.block.level = parser.currentColumnNumber;
        parser.openBlock('<line>');
      } else {
        blockSymbolBlock.handleNewLine(parser, firstChar);
      }
    }
  );
  var blockSymbolLine = new meta.BlockData(
    '<line>', '(l', ')', false,
    blockSymbolBlock.handleClose,
    blockSymbolBlock.handleComma,
    function (parser, firstChar) {
      var block = parser.currentBlock;
      if (parser.currentColumnNumber > block.block.level) {
        parser.openBlock('<block>');
        parser.openBlock('<line>');
      } else {
        if (block.isEmpty()) {
          parser.removeCurrentBlock();
        } else {
          parser.closeBlock();
        }
        parser.currentBlock.sym.blockData.handleNewLine(parser, firstChar);
      }
    }
  );
  var blockSymbolComma = new meta.BlockData(
    '<comma>', '(c', ')', false,
    blockSymbolBlock.handleClose,
    function (parser) {
      var block = parser.currentBlock;
      if (block.isEmpty()) {
        parser.Expr('<none>');
      }
      parser.closeBlock();
      parser.openBlock('<comma>');
    },
    function (parser, firstChar) {
      var block = parser.currentBlock;
      if (block.isEmpty()) {
        var parent = block.parent;
        if (parent.args.length === 1) {
          parser.removeCurrentBlock();
          parser.openBlock('<block>');
          parser.openBlock('<line>');
          parent.block.level = firstChar;
        }
      }
    }
  );

  meta.emptyFunction = function () {};
  meta.existsOrNull = function (value) {
    return typeof value === 'undefined' ? null : value;
  };
  meta.existsOrFalse = function (value) {
    return typeof value === 'undefined' ? false : value;
  };
  meta.existsOrEmptyFunction = function (value) {
    return typeof value === 'undefined' ? meta.emptyFunction : value;
  };

  meta.SymbolData = function (leftArity, rightArity, precedence, options) {
    this.leftArity = leftArity;
    this.rightArity = rightArity;
    this.precedence = precedence;

    if (typeof options === 'undefined') options = {};
    this.fromright = meta.existsOrFalse(options.fromright);
    this.resolve = typeof options.resolve !== 'undefined' ? options.resolve : function (expr) {
      expr.resolveAllArguments();
    };
    this.combine = meta.existsOrEmptyFunction(options.combine);
    this.define = meta.existsOrEmptyFunction(options.combine);
    this.transform = meta.existsOrEmptyFunction(options.transform);
    this.compile = meta.existsOrEmptyFunction(options.compile);
    this.data = meta.existsOrNull(options.data);
  };

  meta.SymbolDescriptionNeedsValue = {
    block: false,
    value: true,
    token: true,
    none: false,
    builtin: false,
    external: false,
    local: false,
    argument: false,
    tag: true
  };

  meta.Symbol = function (id, kind, type, def, symbolData, blockData) {
    this.id = id;
    // One of 'block', 'value', 'token', 'none' for tokens.
    // One of 'builtin', external', 'local', 'argument' for resolved
    // symbols, or 'tag' for symbols that do not need resolution
    // (or, better, that cannot be found in scopes).
    this.kind = kind;
    this.type = typeof type === 'undefined' ? 'any' : type;
    this.def = typeof def === 'undefined' ? null : def;
    this.symbolData = typeof symbolData === 'undefined' ? null : symbolData;
    this.blockData = typeof blockData === 'undefined' ? null : blockData;
  };
  meta.Symbol.prototype.isSymbol = function () {
    return this.symbolData !== null;
  };
  meta.Symbol.prototype.isBlock = function () {
    return this.blockData !== null;
  };
  meta.Symbol.prototype.isBlockWithNewScope = function () {
    return this.isBlock() && this.blockData.needsNewScope === true;
  };
  meta.Symbol.prototype.isToken = function () {
    return this.symbolData === null && this.blockData === null;
  };

  meta.TOKENS.set('<val>', new meta.Symbol('<val>', 'value'));
  meta.TOKENS.set('<op>', new meta.Symbol('<op>', 'token'));
  meta.TOKENS.set('<id>', new meta.Symbol('<id>', 'token'));
  meta.TOKENS.set('<none>', new meta.Symbol('<none>', 'none'));
  meta.TOKENS.set('()', new meta.Symbol('()', 'block', undefined,
      null, null, blockSymbolPar));
  meta.TOKENS.set('[]', new meta.Symbol('[]', 'block', undefined,
      null, null, blockSymbolSquare));
  meta.TOKENS.set('{}', new meta.Symbol('{}', 'block', undefined,
      null, null, block_symbol_curly));
  meta.TOKENS.set('<block>', new meta.Symbol('<block>', 'block', undefined,
      null, null, blockSymbolBlock));
  meta.TOKENS.set('<do>', new meta.Symbol('<do>', 'block', undefined,
      null, null, blockSymbolDo));
  meta.TOKENS.set('<line>', new meta.Symbol('<line>', 'block', undefined,
      null, null, blockSymbolLine));
  meta.TOKENS.set('<comma>', new meta.Symbol('<comma>', 'block', undefined,
      null, null, blockSymbolComma));

  // New intermediate precedences could be added.
  var precedences = [
    'TOP',
    'NEW',          // new
    'MEMBER',       // . []
    'INC',          // ++ --
    'UNARY',        // ! ~ + - typeof void delete
    'MUL',          // * / %
    'ADD',          // + -
    'SHIFT',        // << >> >>>
    'REL',          // < <= > >= in instanceof
    'EQ',           // == != === !==
    'BITWISE-AND',  // &
    'BITWISE-OR',   // |
    'BITWISE-XOR',  // ^
    'LOGICAL-AND',  // &&
    'LOGICAL-OR',   // ||
    'ASSIGNMENT',   // = += -+ *= /= %= <<= >>= >>>= &= |= ^=
    'TYPE',         // :: (type annotation)
    'FUNCTION',     // -> => (function definition)
    'CALL',         // function call (should be between NEW and INC)
    'NONE'
  ];
  for (var precedence_index = 0;
       precedence_index < precedences.length;
       precedence_index++) {
    meta.PRECEDENCES.set(precedences[precedence_index], precedence_index);
  }

  // Root scope setup.

  // External symbols.
  // (just a joke for now, we need to have presets like jshint)
  // (eventually we will also parse typescript definitions)
  var predefined = [
    'Object',
    'Math',
    'Window',
    'require',
    'true',
    'false',
    'null'
  ];
  for (var predefined_index = 0;
       predefined_index < predefined.length;
       predefined_index++) {
    var current_predefined = predefined[predefined_index];
    meta.ROOT_SCOPE.set(current_predefined, new meta.Symbol(
        current_predefined, 'external', undefined, null,
        new meta.SymbolData(0, 0, 'NONE')));
  }

  meta.valueSymbol = new meta.Symbol('<value>', 'value', undefined, null,
    new meta.SymbolData(0, 0, 'NONE', {}));
  meta.tagSymbol = new meta.Symbol('<tag>', 'tag', undefined, null,
    new meta.SymbolData(0, 0, 'NONE', {}));

  // Builtins.
  meta.ROOT_SCOPE.set('+', new meta.Symbol('+', 'builtin', undefined, null,
    new meta.SymbolData(1, 1, 'ADD', {})));
  meta.ROOT_SCOPE.set('-', new meta.Symbol('-', 'builtin', undefined, null,
    new meta.SymbolData(1, 1, 'ADD', {})));
  meta.ROOT_SCOPE.set('*', new meta.Symbol('+', 'builtin', undefined, null,
    new meta.SymbolData(1, 1, 'MUL', {})));
  meta.ROOT_SCOPE.set('/', new meta.Symbol('+', 'builtin', undefined, null,
    new meta.SymbolData(1, 1, 'MUL', {})));

  // More builtins will follow...


  meta.RESERVED.addAllKeysWithValue([
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


  meta.Error = function (message, line, columnNumber) {
    this.message = message;
    this.lineNumber = line;
    this.columnNumber = columnNumber;
  };
  meta.Error.prototype.toString = function () {
    return 'error [' + this.lineNumber + ',' + this.columnNumber + ']: ' + this.message;
  };



  meta.Parser = function () {};

  meta.Parser.prototype.initialize = function (compiler, e) {
    this.compiler = compiler;
    this.Expr = e;
    this.reader = compiler.reader;
    if (!(this.reader instanceof StringReader ||
        this.reader instanceof FileReader)) {
      this.error('Invalid reader');
      this.reader = new StringReader('');
    }
    if (this.reader.error) {
      this.error(this.reader.error);
    }

    this.source = this.reader.name;
    this.currentLineNumber = 0;
    this.currentColumnNumber = 0;
    this.currentBlock = null;
    this.root = this.openBlock('<block>');
    this.currentBlock = this.root;

    this.multilineStringIsLiterate = false;
    this.multilineStringContents = null;
    this.multilineStringTerminator = null;
  };

  function Compiler(r) {
    if (!(this instanceof Compiler)) {
      return new Compiler(r);
    }

    this.reader = r;
    this.errors = [];
    this.root = null;

    var compiler = this;
    var parser = new meta.Parser(this, Expr);
    this.parser = parser;

    function Expr(sym, val, args, parent) {
      if (!(this instanceof  Expr)) {
        return new Expr(sym, val, args, parent);
      }

      if (typeof sym === 'string') {
        this.sym = meta.TOKENS.get(sym);
      } else {
        this.sym = sym;
      }

      this.val = typeof val === 'undefined' ? null : val;

      this.args = [];
      if (typeof args !== 'undefined' && util.isArray(args)) {
        for (var i = 0; i < args.length; i++) {
          this.args[i] = args[i];
        }
      }

      if (typeof parent === 'undefined') {
        // No parent provided: assume it is the current block
        // (this works when the constructor is called by the parser).
        this.loc = parser.currentLocation();
        if (parser.currentBlock !== null) {
          parser.currentBlock.push(this);
        }
        this.parent = parser.currentBlock;
      } else {
        // Use the provided parent.
        this.loc = parser.unknownLocation();
        parent.push(this);
        this.parent = parent;
      }

      if (this.shouldBeBlock()) {
        this.block = {
          level: this.loc.start.column,
          scope: parser.newScope(this),
          expr: this
        };
      } else {
        this.block = null;
      }

      this.js = null;
    }

    Expr.prototype.compiler = compiler;
    Expr.prototype.parser = parser;

    Expr.prototype.push = function (arg) {
      arg.parent = this;
      this.args.push(arg);
    };
    Expr.prototype.unshift = function (arg) {
      arg.parent = this;
      this.args.unshift(arg);
    };
    Expr.prototype.pop = function () {
      var result = this.args.pop();
      result.parent = null;
      return result;
    };
    Expr.prototype.shift = function () {
      var result = this.args.shift();
      result.parent = null;
      return result;
    };
    Expr.prototype.remove = function (index) {
      if (typeof index !== 'number') {
        index = this.args.indexOf(index);
        if (index < 0) { return null; }
      }
      var result = this.args[index];
      result.parent = null;
      this.args.splice(index, 1);
      return result;
    };

    Expr.prototype.isReserved = function () {
      return meta.isReserved(this.sym.id);
    };
    Expr.prototype.shouldBeBlock = function () {
      return this.parser.isBlock(this.sym.id);
    };
    Expr.prototype.isBlock = function () {
      return this.block !== null;
    };
    Expr.prototype.isEmpty = function () {
      return this.args.length === 0;
    };

    Expr.prototype.scope = function () {
      if (this.isBlock() &&
          typeof this.block !== 'undefined' &&
          typeof this.block.scope !== 'undefined') {
        return this.block.scope;
      } else if (this.parent !== null) {
        return this.parent.scope();
      } else {
        return null;
      }
    };

    Expr.prototype.error = function (message) {
      compiler.errors.push(new meta.Error(message, this.loc.start.line, this.loc.start.column));
    };

    Expr.prototype.resolveAllArguments = function () {
      for (var i = 0; i < this.args.length; i++) {
        this.args[i].resolve();
      }
    };

    Expr.prototype.resolve = function () {
      // 'block', 'value', 'token', 'none'
      if (this.sym.isToken()) {
        if (this.sym.kind === 'token') {
          var scope = this.scope();
          var resolved = scope.get(this.val);
          if (resolved !== null) {
            this.sym = resolved;
            this.sym.symbolData.resolve(this);
            this.sym.symbolData.define(this);
          } else {
            this.error('Undefined symbol "' + this.val + '"');
          }
        } else if (this.sym.kind == 'value') {
          this.sym = meta.valueSymbol;
        } else {
          this.error('Invalid token kind "' + this.sym.kind + '"" in resolution phase.');
        }
      } else if (this.sym.isBlock()) {
        this.resolveAllArguments();
      } else {
        this.error('Invalid symbol kind "' + this.sym.kind + '"" in resolution phase.');
      }
    };

    Expr.prototype.stringDump = function () {
      var result = '';
      if (this.sym.blockData !== null) {
        result += this.sym.blockData.openMarker;
        if (this.sym.blockData.openMarker.length > 1) { result += ' '; }
        for (var i = 0; i < this.args.length; i++) {
          if (i > 0) { result += ' '; }
          result += this.args[i].stringDump();
        }
        result += this.sym.blockData.closeMarker;
      } else if (this.sym.symbolData !== null) {
        if (meta.SymbolDescriptionNeedsValue[this.kind]) {
          result += this.sym.kind + ':' + this.val;
        } else {
          result += this.sym.kind + ':' + this.sym.id;
        }
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
            result += this.args[j].stringDump();
          }
          result += ')';
        }
      }
      return result;
    };

    function compareForTesting(template, path) {
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
            var arg_result = this.args[i].compareForTesting(template_args[i], path + '/' + i);
            if (arg_result) { return arg_result; }
          }
          return null;
        }
      }
    }
    Expr.prototype.compareForTesting = compareForTesting;

    Expr.prototype.toString = function () {
      return util.format('sym "%s", val "%s"', this.sym.id, this.val);
    };

    //var compile_binary_op = function () {}
    //var compile_unary_op = function () {}
    //var compile_throw = function () {}
    //var compile_try = function () {}
    //var compile_new = function () {}
    //var compile_var = function () {}
    //var compile_assignment = function () {}
    //var compile_update = function () {}
    //var compile_function = function () {}
    //var compile_if = function () {}
    //var compile_do = function () {}
    //var compile_loop = function () {}
    //var compile_switch = function () {}
    //var compile_element = function () {}
    //var compile_member = function () {}
    //var compile_literal = function () {}
    //var compile_array = function () {}
    //var compile_object = function () {}
    //var compile_macro = function () {}
    //var compile_include = function () {}

    //add_builtin('+', compile_binary_op);

    parser.initialize(compiler, Expr);
  }
  this.Compiler = Compiler;

  meta.Parser.prototype.currentLocation = function (c1, c2) {
    var line = this.currentLineNumber;
    if (typeof c1 === 'undefined') { c1 = this.currentColumnNumber; }
    if (typeof c2 === 'undefined') { c2 = this.currentColumnNumber; }
    return {
      source: this.source ? this.source : null,
      start: {line: line, column: c1},
      end: {line: line, column: c1}
    };
  };
  meta.Parser.prototype.setLocationEnd = function (location, column) {
    if (location) {
      if (typeof column === 'undefined') { column = this.currentColumnNumber; }
      location.end.line = this.currentLineNumber;
      location.end.column = column;
    }
  };
  meta.Parser.prototype.enclosingLocation = function (start, end) {
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
  meta.Parser.prototype.unknownLocation = function () {
    return {
      source: 'unknown',
      start: {line: 0, column: 0},
      end: {line: 0, column: 0}
    };
  };

  meta.Parser.prototype.dumpBlockStack = function () {
    var result = '( ';
    var cur = this.currentBlock;
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

  meta.Parser.prototype.openBlock = function (kind) {
    var new_block = this.Expr(kind);
    this.currentBlock = new_block;
    return new_block;
  };

  meta.Parser.prototype.closeBlock = function () {
    var result = this.currentBlock;
    if (result !== null) {
      this.setLocationEnd(result.loc);
      result = result.parent;
      if (result !== null) {
        this.currentBlock = result;
      } else {
        this.error('Closing root block');
      }
    }
    return result;
  };
  meta.Parser.prototype.removeCurrentBlock = function () {
    var current = this.currentBlock;
    this.closeBlock();
    if (current !== null) {
      this.currentBlock.remove(current);
    }
    return this.currentBlock;
  };

  meta.Parser.prototype.addPrimitive = function (primitive, value) {
    this.Expr(primitive, value);
  };
  meta.Parser.prototype.addValue = function (value) {
    switch (typeof value) {
    case 'undefined':
    case 'boolean':
    case 'number':
    case 'string':
      this.addPrimitive('<val>', value);
      break;
    case 'object':
      if (value !== null) {
        this.error('Unexpected object value');
      }
      this.addPrimitive('<val>', null);
      break;
    default:
      this.error('Unexpected value type ' + typeof value);
      this.addPrimitive('<val>', null);
      break;
    }
  };
  meta.Parser.prototype.addOperator = function (value) {
    this.addPrimitive('<op>', value);
  };
  meta.Parser.prototype.addIdentifier = function (value) {
    this.addPrimitive('<id>', value);
  };
  meta.Parser.prototype.addNone = function () {
    this.addPrimitive('<none>', null);
  };

  meta.Parser.prototype.error = function (message, line, columnNumber) {
    if (typeof line === 'undefined') line = this.currentLineNumber;
    if (typeof columnNumber === 'undefined') columnNumber = this.currentColumnNumber;
    this.compiler.errors.push(new meta.Error(message, line, columnNumber));
  };

  meta.Parser.prototype.currentScope = function () {
    if (this.currentBlock !== null) {
      return this.currentBlock.block.scope;
    } else {
      return null;
    }
  };
  meta.Parser.prototype.newScope = function (expr) {
    var startingScope = expr.scope();
    if (startingScope === null) { startingScope = meta.ROOT_SCOPE; }
    if (this.isBlockWithNewScope(expr.sym.id) ||
        startingScope === meta.ROOT_SCOPE) {
      return startingScope.extend();
    } else {
      return startingScope;
    }
  };

  meta.Parser.prototype.isReserved = function (s) {
    return meta.RESERVED.has(s);
  };
  meta.Parser.prototype.isBlock = function (s) {
    return meta.TOKENS.has(s) && meta.TOKENS.get(s).blockData !== null;
  };
  meta.Parser.prototype.isBlockWithNewScope = function (s) {
    return this.isBlock(s) && meta.TOKENS.get(s).blockData.needsNewScope;
  };

  meta.Parser.prototype.processLine = function (line) {
    this.currentLineNumber++;

    if (this.multilineStringContents !== null) {
      if (line === this.multilineStringTerminator) {
        if (!this.multilineStringIsLiterate) {
          this.addValue(this.multilineStringContents);
        }
        this.multilineStringIsLiterate = false;
        this.multilineStringContents = null;
        this.multilineStringTerminator = null;
      } else {
        this.multilineStringContents += line;
        if (this.multilineStringTerminator !== '"""') {
          this.multilineStringContents += '\n';
        }
      }
      return;
    }

    var remaining = line;
    var me = this;
    var hasError = false;

    var tryMatch = function (pattern) {
      var m = remaining.match(pattern);
      if (m !== null) {
        var token = m[0];
        remaining = remaining.substring(token.length);
        return token;
      } else {
        return null;
      }
    };
    var afterMatch = function (token) {
      me.currentColumnNumber += token.length;
    };
    var consumeChar = function () {
      hasError = false;
      remaining = remaining.substring(1);
      if (remaining === null) {
        remaining = '';
      }
      me.currentColumnNumber++;
    };
    var consumeStringLiteral = function () {
      hasError = false;
      var delimiter = remaining.charAt(0);
      var multilineDelimiter = delimiter + delimiter + delimiter;
      if (remaining.indexOf(multilineDelimiter) === 0) {
        if (me.currentColumnNumber === 0) {
          me.multilineStringIsLiterate = true;
        }
        remaining = remaining.substring(3);
        me.multilineStringContents = '';
        me.currentColumnNumber += 3;
        if (remaining === null || remaining.length === 0) {
          me.multilineStringTerminator = multilineDelimiter;
        } else {
          me.multilineStringTerminator = remaining;
        }
        remaining = null;
      } else {
        var token = '';
        consumeChar();
        while (remaining !== null && remaining.length > 0) {
          var current = remaining.charAt(0);
          if (current === delimiter) {
            me.addValue(token);
            consumeChar();
            return;
          } else if (current === '\\') {
            consumeChar();
            var quoted = remaining.charAt(0);
            consumeChar();
            switch (quoted) {
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
              var hexLatin1 = remaining.substring(0, 2);
              remaining = remaining.substring(2);
              me.currentColumnNumber += 2;
              if (/^[0-9a-fA-F][0-9a-fA-F]/.test(hexLatin1)) {
                token += String.fromCharCode(parseInt(hexLatin1, 16));
              } else {
                me.error('Unrecognized hex escape');
                token += '?';
              }
              break;
            case 'u':
              var hexUnicode = remaining.substring(0, 4);
              remaining = remaining.substring(4);
              me.currentColumnNumber += 4;
              if (/^[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/.test(hexUnicode)) {
                token += String.fromCharCode(parseInt(hexUnicode, 16));
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
              var hexOctal = quoted + remaining.substring(0, 2);
              remaining = remaining.substring(2);
              me.currentColumnNumber += 2;
              if (/^[0-7][0-7][0-7]/.test(hexOctal)) {
                token += String.fromCharCode(parseInt(hexOctal, 8));
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
            consumeChar();
          }
        }
        me.error('Unterminated string literal');
        remaining = null;
      }
    };

    this.currentColumnNumber = 0;
    var isInIndent = true;
    while (isInIndent) {
      if (remaining.charAt(0) === ' ') {
        consumeChar();
      } else if (remaining.charAt(0) === '\t') {
        consumeChar();
        if (meta.TAB_SIZE > 0) {
          meta.currentColumnNumber += (meta.TAB_SIZE - 1);
        } else {
          this.error('No tabs allowed for indentation', 0);
        }
      } else {
        isInIndent = false;
      }
    }

    var applyIndentation = true;

    // Pure comment lines do not affect indentation blocks.
    if (remaining.charAt(0) === ';') {
      applyIndentation = false;
    }

    // Ignore multiline strings starting at column 0
    // (they can be used for literate programming).
    if (this.currentColumnNumber === 0 &&
        (remaining.indexOf('"""') === 0 || remaining.indexOf('\'\'\'') === 0)) {
      applyIndentation = false;
    }

    // Handle block structure
    if (applyIndentation) {
      this.currentBlock.sym.blockData.handleNewLine(this, remaining.charAt(0));
    }
    
    while (remaining !== null && remaining.length > 0) {
      switch (remaining.charAt(0)) {
      case '(':
        this.openBlock('()');
        this.openBlock('<comma>');
        consumeChar();
        break;
      case '[':
        this.openBlock('[]');
        this.openBlock('<comma>');
        consumeChar();
        break;
      case '{':
        this.openBlock('{}');
        this.openBlock('<comma>');
        consumeChar();
        break;
      case ')':
        this.currentBlock.sym.blockData.handleClose(this, ')');
        consumeChar();
        break;
      case ']':
        this.currentBlock.sym.blockData.handleClose(this, ']');
        consumeChar();
        break;
      case '}':
        this.currentBlock.sym.blockData.handleClose(this, '}');
        consumeChar();
        break;
      case ',':
        this.currentBlock.sym.blockData.handleComma(this);
        consumeChar();
        break;
      case ' ':
      case '\t':
        consumeChar();
        break;
      case ';':
        remaining = null;
        break;
      case '"':
      case '\'':
        consumeStringLiteral();
        break;
      default:
        var token;
        token = tryMatch(/^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/);
        if (token !== null) {
          if (token === 'do') {
            this.openBlock('<do>');
          } else {
            this.addIdentifier(token);
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
          this.addValue(Number(token));
          if (exponent !== null) {
            afterMatch(exponent);
          }
          afterMatch(token);
          break;
        }
        token = tryMatch(/^[\\\+\*\-\/<>\:\~\|\^\#\@\!\?\&\.\=]+/);
        if (token !== null) {
          this.addOperator(token);
          afterMatch(token);
          break;
        }
        if (!hasError) {
          this.error('Unrecognized character \'' + remaining.charAt(0) + '\'');
          hasError = true;
        }
        remaining = remaining.substring(1);
        me.currentColumnNumber++;
        break;
      }
    }
  };

  Compiler.prototype.parse = function () {
    var me = this;
    this.parser.reader.start(function (line) {
      me.parser.processLine(line);
    });
    this.root = this.parser.root;
    return this;
  };

  Compiler.prototype.resolve = function () {
    if (this.errors.length !== 0) {
      return this;
    }
    if (this.root === null) {
      this.parser.error('Cannot resolve symbols because parse phase did not happen', 0, 0);
      return this;
    }
    this.root.resolve();
    return this;
  };

}


Meta.prototype.compilerFromString = function (s) {
  return this.Compiler(this.StringReader(s));
};

module.exports = Meta;
