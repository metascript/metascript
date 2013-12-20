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
    this.nextSuffix = 1;
  };
  meta.ExtensibleMap.prototype.prefix = '_$';
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
  meta.ExtensibleMap.prototype.newUniqueKey = function (value) {
    if (typeof value === 'undefined') value = true;
    var key = this.prefix + this.nextSuffix;
    while (this.has(key)) this.nextSuffix++;
    this.nextSuffix++;
    this.set(key, value);
    return key;
  };

  meta.ExtensibleMap.prototype.forEach = function (f) {
    for (var key in this.values) {
      f(key, this.values[key]);
    }
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
  meta.KEY_ROOT_SCOPE = new meta.ExtensibleMap();
  meta.VAR_ROOT_SCOPE = new meta.ExtensibleMap();

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

  meta.BlockData = function (id, openMarker, closeMarker,
      newScope, close, comma, new_line, combine) {
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
    // (expr)
    this.combine = combine;
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
    },
    function (expr) {
      expr.turnIntoTuple();
    }
  );
  var blockSymbolSquare = new meta.BlockData(
    '[]', '[', ']', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine,
    function (expr) {
      expr.sym = meta.arraySymbol;
    }
  );
  var blockSymbolCurly = new meta.BlockData(
    '{}', '{', '}', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine,
    function (expr) {
      expr.sym = meta.objectSymbol;
    }
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
    },
    function (expr) {
      expr.turnIntoTuple();
      expr.combineDependent();
    }
  );
  var blockSymbolDo = new meta.BlockData(
    '<do>', '(d', ')', true,
    blockSymbolBlock.handleClose,
    blockSymbolBlock.handleComma,
    function (parser, firstChar) {
      var block = parser.currentBlock;
      if (parser.currentLineNumber === block.loc.start.line + 1) {
        var doLevel = parser.currentColumnNumber;
        parser.openBlock('<block>');
        parser.currentBlock.block.level === doLevel;
        parser.openBlock('<line>');
      } else {
        blockSymbolBlock.handleNewLine(parser, firstChar);
      }
    },
    function (expr) {
      expr.combineArguments();
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
    },
    function (expr) {
      expr.combineArguments();
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
          parent.block.level = parser.currentColumnNumber;
        }
      }
    },
    blockSymbolLine.combine
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

  meta.arityZero = {
    needsLeft: false,
    canHaveLeft: false,
    needsRight: false,
    canHaveRight: false,
    minOperandCount: 0,
    maxOperandCount : 0
  };
  meta.arityUnary = {
    needsLeft: false,
    canHaveLeft: false,
    needsRight: true,
    canHaveRight: true,
    minOperandCount : 1,
    maxOperandCount : 1
  };
  meta.arityBinary = {
    needsLeft: true,
    canHaveLeft: true,
    needsRight: true,
    canHaveRight: true,
    minOperandCount : 2,
    maxOperandCount : 2
  };
  meta.aritySum = {
    needsLeft: false,
    canHaveLeft: true,
    needsRight: true,
    canHaveRight: true,
    minOperandCount : 1,
    maxOperandCount : 2
  };
  meta.arityIncrement = {
    needsLeft: false,
    canHaveLeft: true,
    needsRight: false,
    canHaveRight: true,
    minOperandCount : 1,
    maxOperandCount : 1
  };
  meta.arityPreIncrement = {
    needsLeft: false,
    canHaveLeft: false,
    needsRight: true,
    canHaveRight: true,
    minOperandCount : 1,
    maxOperandCount : 1
  };
  meta.arityPostIncrement = {
    needsLeft: true,
    canHaveLeft: true,
    needsRight: false,
    canHaveRight: false,
    minOperandCount : 1,
    maxOperandCount : 1
  };
  meta.arityIf = {
    needsLeft: false,
    canHaveLeft: false,
    needsRight: true,
    canHaveRight: true,
    minOperandCount : 2,
    maxOperandCount : 2
  };

  meta.SymbolData = function (arity, precedence, options) {
    this.arity = arity;
    this.precedence = precedence;

    if (typeof options === 'undefined') options = {};
    this.isRightAssociative = meta.existsOrFalse(options.isRightAssociative);
    this.resolve = typeof options.resolve !== 'undefined' ? options.resolve : function (expr) {
      if (expr.sym === meta.tagSymbol &&
          ! expr.varScope.has(expr.val)) {
        expr.error('Undeclared symbol "' + expr.val + '"');
      }
      expr.resolveAllArguments();
    };
    this.dependsFrom = meta.existsOrNull(options.dependsFrom);
    this.fixDependent = meta.existsOrEmptyFunction(options.fixDependent);
    this.define = meta.existsOrEmptyFunction(options.define);
    this.transform = meta.existsOrEmptyFunction(options.transform);
    this.compile = meta.existsOrEmptyFunction(options.compile);
    this.data = meta.existsOrNull(options.data);
    this.opensNewScope = meta.existsOrFalse(options.opensNewScope);
    this.canHostDeclarations = meta.existsOrFalse(options.canHostDeclarations);
  };

  meta.SymbolDescriptionNeedsValue = {
    // Parser symbol kinds (tokens)
    block: false,
    value: true,
    token: true,
    none: false,
    // Compiler symbol kinds (includes value)
    builtin: false,
    external: false,
    local: false,
    argument: false,
    tag: true
  };

  meta.Symbol = function (id, kind, symbolData, options) {
    this.id = id;
    // One of 'block', 'value', 'token', 'none' for tokens.
    // One of 'builtin', external', 'local', 'argument' for resolved
    // symbols, otherwise 'tag' or 'value'.
    this.kind = kind;
    this.symbolData = meta.existsOrNull(symbolData);

    options = typeof options === 'undefined' ? {} : options;
    // type, def, blockData
    this.blockData = meta.existsOrNull(options.blockData);
    this.type = meta.existsOrNull(options.type);
    this.def = meta.existsOrNull(options.def);
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
  meta.TOKENS.set('()', new meta.Symbol('()', 'block', null, {blockData: blockSymbolPar}));
  meta.TOKENS.set('[]', new meta.Symbol('[]', 'block', null, {blockData: blockSymbolSquare}));
  meta.TOKENS.set('{}', new meta.Symbol('{}', 'block', null, {blockData: blockSymbolCurly}));
  meta.TOKENS.set('<block>',
      new meta.Symbol('<block>', 'block', null, {blockData: blockSymbolBlock}));
  meta.TOKENS.set('<do>', new meta.Symbol('<do>', 'block', null, {blockData: blockSymbolDo}));
  meta.TOKENS.set('<line>', new meta.Symbol('<line>', 'block', null, {blockData: blockSymbolLine}));
  meta.TOKENS.set('<comma>',
      new meta.Symbol('<comma>', 'block', null, {blockData: blockSymbolComma}));

  // New intermediate precedences could be added.
  var precedences_list = [
    'TOP',
    'KEY',          // keyword (if, try...)
    'VAR',          // var, let, const
    'MEMBER',       // . []
    'NEW',          // new
    'CALL',         // function call
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
    'NONE'
  ];
  for (var precedence_index = 0;
       precedence_index < precedences_list.length;
       precedence_index++) {
    meta.PRECEDENCES.set(precedences_list[precedence_index], precedence_index);
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
    meta.VAR_ROOT_SCOPE.set(current_predefined, new meta.Symbol(
        current_predefined, 'external',
        new meta.SymbolData(meta.arityZero, 'NONE')));
  }

  // Builtins with a token that cannot be found in symbol tables.
  meta.valueSymbol = new meta.Symbol('<value>', 'value',
    new meta.SymbolData(meta.arityZero, 'NONE', {}));
  meta.tagSymbol = new meta.Symbol('<tag>', 'tag',
    new meta.SymbolData(meta.arityZero, 'NONE', {}));

  // Builtins with an irregular token.
  meta.tupleSymbol = new meta.Symbol('<tuple>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {}));
  meta.doSymbol = new meta.Symbol('<do>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {}));
  meta.objectSymbol = new meta.Symbol('<object>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      opensNewScope: true
    }));
  meta.arraySymbol = new meta.Symbol('<array>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      opensNewScope: true
    }));
  meta.rootSymbol = new meta.Symbol('<root>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      opensNewScope: true,
      canHostDeclarations: true
    }));
  meta.callSymbol = new meta.Symbol('<call>', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'CALL', {}));
  meta.elementSymbol = new meta.Symbol('<element>', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'MEMBER', {}));

  // Irregular operator variants
  meta.KEY_ROOT_SCOPE.set('+x', new meta.Symbol('+x', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'UNARY', {})));
  meta.KEY_ROOT_SCOPE.set('-x', new meta.Symbol('-x', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'UNARY', {})));
  meta.KEY_ROOT_SCOPE.set('++x', new meta.Symbol('++x', 'builtin',
    new meta.SymbolData(meta.arityPreIncrement, 'INC', {})));
  meta.KEY_ROOT_SCOPE.set('--x', new meta.Symbol('--x', 'builtin',
    new meta.SymbolData(meta.arityIncrement, 'INC', {})));
  meta.KEY_ROOT_SCOPE.set('x++', new meta.Symbol('x++', 'builtin',
    new meta.SymbolData(meta.arityPostIncrement, 'INC', {})));
  meta.KEY_ROOT_SCOPE.set('x--', new meta.Symbol('x--', 'builtin',
    new meta.SymbolData(meta.arityPostIncrement, 'INC', {})));

  // Builtins.
  meta.KEY_ROOT_SCOPE.set('=', new meta.Symbol('=', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'ASSIGNMENT', {
      isRightAssociative: true
    })));
  meta.KEY_ROOT_SCOPE.set('.', new meta.Symbol('.', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'MEMBER', {})));
  meta.KEY_ROOT_SCOPE.set('+', new meta.Symbol('+', 'builtin',
    new meta.SymbolData(meta.aritySum, 'ADD', {})));
  meta.KEY_ROOT_SCOPE.set('-', new meta.Symbol('-', 'builtin',
    new meta.SymbolData(meta.aritySum, 'ADD', {})));
  meta.KEY_ROOT_SCOPE.set('*', new meta.Symbol('*', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'MUL', {})));
  meta.KEY_ROOT_SCOPE.set('/', new meta.Symbol('/', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'MUL', {})));
  meta.KEY_ROOT_SCOPE.set('++', new meta.Symbol('++', 'builtin',
    new meta.SymbolData(meta.arityIncrement, 'INC', {})));
  meta.KEY_ROOT_SCOPE.set('--', new meta.Symbol('--', 'builtin',
    new meta.SymbolData(meta.arityIncrement, 'INC', {})));

  meta.KEY_ROOT_SCOPE.set('if', new meta.Symbol('if', 'builtin',
    new meta.SymbolData(meta.arityIf, 'KEY', {
      fixDependent: function (expr) {
        while (expr.args.length > 2) {
          var lastElse = expr.pop();
          var lastIf;

          if (expr.args.length === 2) {
            lastIf = expr;
          } else {
            var previousElse = expr.args[expr.args.length - 1];
            if (previousElse.sym.id !== 'else') {
              previousElse.error('Invalid token: "else" expected.');
              break;
            }
            if (previousElse.args.length !== 1) {
              previousElse.error('Invalid expressions after "else".');
              break;
            }
            if (previousElse.args[0].sym.id !== 'if') {
              previousElse.args[0].error('Invalid token: "if" expected.');
              break;
            }
            lastIf = previousElse.args[0];
          }
          if (lastIf.args.length !== 2) {
            lastIf.error('"if" expression needs two operands.');
            break;
          }
          var lastThen = lastIf.pop();
          var newThen = lastThen.newAtThisLocation(meta.tupleSymbol);
          newThen.push(lastThen);
          newThen.push(lastElse.pop());
          lastIf.push(newThen);
        }
      }
    })));
  meta.KEY_ROOT_SCOPE.set('else', new meta.Symbol('else', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      dependsFrom: 'if'
    })));
  meta.KEY_ROOT_SCOPE.set('var', new meta.Symbol('var', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'VAR', {
      resolve: function (expr) {
        if (expr.args.length !== 1) {
          expr.error('var is unary');
          return;
        }
        var tags = expr.args[0];
        if (tags.sym === meta.tagSymbol) {
          meta.declareTag(tags, expr);
        } else if (tags.sym === meta.tupleSymbol) {
          for (var i = 0; i < tags.args.length; i++) {
            var tag = tags.args[i];
            if (tag.sym === meta.tagSymbol) {
              meta.declareTag(tag, expr);
            } else {
              tag.error('Expected identifier');
            }
          }
        } else {
          tags.error('Expected identifier');
        }
      }
    })));
  meta.KEY_ROOT_SCOPE.set('->', new meta.Symbol('->', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'FUNCTION', {
      define: meta.emptyFunction,
      opensNewScope: true,
      canHostDeclarations: true
    })));
  // More builtins will follow...

  meta.declareTag = function (tag, declaration) {
    if (declaration.varScope.has(tag.val)) {
      var previousDeclaration = declaration.varScope.get(tag.val);
      tag.error('Redeclared identifier.');
      previousDeclaration.error('(previous declaration was here)');
    } else {
      declaration.varScope.set(tag.val, declaration);
      declaration.declarations.set(tag.val, declaration);
    }
  };

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
        // Use the provided parent, if any.
        this.loc = parser.unknownLocation();
        if (parent !== null) {
          parent.push(this);
        }
        this.parent = parent;
      }

      if (this.isBlock()) {
        this.block = {
          level: this.loc.start.column,
          expr: this
        };
      } else {
        this.block = null;
      }

      this.declarations = null;
      this.keyScope = null;
      this.varScope = null;

      this.js = null;
    }

    Expr.prototype.compiler = compiler;
    Expr.prototype.parser = parser;

    Expr.prototype.disconnect = function () {
      if (this.parent) {
        this.parent.remove(this);
      }
    };
    Expr.prototype.push = function (arg) {
      arg.disconnect();
      arg.parent = this;
      this.args.push(arg);
    };
    Expr.prototype.unshift = function (arg) {
      arg.disconnect();
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
    Expr.prototype.replace = function (argument, replacement) {
      var index = this.args.indexOf(argument);
      if (index < 0) {
        return null;
      } else {
        replacement.disconnect();
        var removed = this.args[index];
        removed.parent = null;
        replacement.parent = this;
        this.args[index] = replacement;
        return removed;
      }
    };
    Expr.prototype.forEach = function (f) {
      for (var i = 0; i < this.args.length; i++) {
        f(this.values[i], i);
      }
    };
    Expr.prototype.newAtThisLocation = function (sym) {
      var result = new Expr(sym, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };

    Expr.prototype.isReserved = function () {
      return meta.isReserved(this.sym.id);
    };
    Expr.prototype.isBlock = function () {
      return this.parser.isBlock(this.sym.id);
    };
    Expr.prototype.isEmpty = function () {
      return this.args.length === 0;
    };

    Expr.prototype.takeLocationFrom = function (other) {
      this.loc = {
        source: other.loc.source,
        start: {line: other.loc.start.line, column: other.loc.start.column},
        end: {line: other.loc.end.line, column: other.loc.end.column}
      };
    };

    Expr.prototype.precedence = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol precedence');
        return meta.PRECEDENCES.get('NONE');
      }
      var result = meta.PRECEDENCES.get(this.sym.symbolData.precedence);
      if (typeof result === 'undefined') {
        this.error('Undefined symbol precedence');
        return meta.PRECEDENCES.get('NONE');
      }
      return result;
    };
    Expr.prototype.isRightAssociative = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol associativity');
        return 0;
      } else {
        return this.sym.symbolData.isRightAssociative;
      }
    };

    Expr.prototype.dependsFrom = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol dependency');
        return null;
      } else {
        return this.sym.symbolData.dependsFrom;
      }
    };
    Expr.prototype.canAcceptDependency = function (other) {
      return other.dependsFrom() === this.sym.id;
    };
    Expr.prototype.fixDependent = function () {
      for (var i = 0; i < this.args.length; i++) {
        this.args[i].fixDependent();
      }
      this.sym.symbolData.fixDependent(this);
    };
    Expr.prototype.combineDependent = function () {
      if (this.sym !== meta.tupleSymbol &&
          this.sym.id !== '<do>') return;
      for (var i = 0; i < this.args.length; i++) {
        var current = this.args[i];
        while (i + 1 < this.args.length) {
          var next = this.args[i + 1];
          if (current.canAcceptDependency(next)) {
            this.remove(i + 1);
            current.push(next);
          } else {
            break;
          }
        }
      }
      this.turnIntoTuple();
    };

    Expr.prototype.setupScopes = function () {
      this.declarations = this.parent !== null ? this.parent.declarations : null;
      this.keyScope = this.parent !== null ? this.parent.keyScope : meta.KEY_ROOT_SCOPE.extend();
      this.varScope = this.parent !== null ? this.parent.varScope : meta.VAR_ROOT_SCOPE.extend();
      if (this.sym === null) {
        this.error('Cannot setup scopes');
      } else {
        if (this.sym.canHostDeclarations || this.declarations === null) {
          this.declarations = new meta.ExtensibleMap();
        }
        if (this.sym.opensNewScope) {
          this.keyScope = this.keyScope.extend();
          this.varScope = this.varScope.extend();
        }
      }
    };

    Expr.prototype.error = function (message) {
      compiler.errors.push(new meta.Error(message, this.loc.start.line, this.loc.start.column));
    };

    Expr.prototype.resolveKeySymbol = function () {
      // 'block', 'value', 'token', 'none'
      if (this.sym.isToken()) {
        if (this.sym.kind === 'token') {
          var resolved = this.keyScope.get(this.val);
          if (resolved !== null) {
            this.sym = resolved;
          } else {
            if (this.sym.id == '<id>') {
              this.sym = meta.tagSymbol;
            }
            this.error('Undefined symbol "' + this.val + '"');
          }
        } else if (this.sym.kind === 'value') {
          this.sym = meta.valueSymbol;
        } else {
          this.error('Invalid token kind "' + this.sym.kind + '"" in keyword resolution phase.');
        }
      }
    };

    Expr.prototype.canTakeMoreOperands = function () {
      return this.sym.symbolData.arity.maxOperandCount > this.args.length;
    };
    Expr.prototype.needsMoreOperands = function () {
      return this.canTakeMoreOperands() &&
          this.sym.symbolData.arity.minOperandCount < this.args.length;
    };
    Expr.prototype.canTakeLeftOperand = function () {
      return this.canTakeMoreOperands() &&
          this.sym.symbolData.arity.canHaveLeft;
    };
    Expr.prototype.needsLeftOperand = function () {
      return this.sym.symbolData.arity.needsLeft;
    };
    Expr.prototype.canTakeRightOperand = function () {
      return this.canTakeMoreOperands() &&
          this.sym.symbolData.arity.canHaveRight;
    };
    Expr.prototype.contextExtensionThatTakesRightOperand = function (context, next) {
      var currentExtended = context.extended;
      while (currentExtended !== null) {
        if (currentExtended.current.canTakeRightOperand() ||
            currentExtended.current.canAcceptDependency(next)) {
          return currentExtended;
        } else {
          currentExtended = currentExtended.previous;
        }
      }
      context.extended = null;
      return null;
    };

    Expr.prototype.handleExtended = function (context) {
      if (this.canTakeMoreOperands()) {
        context.extended = {
          previous: context.extended,
          current: this
        };
      }
    };

    Expr.prototype.transformInto = function (replacement) {
      replacement.disconnect();
      while (this.args.length > 0) {
        this.pop();
      }
      while (replacement.args.length > 0) {
        this.push(replacement.shift());
      }
      this.sym = replacement.sym;
      this.val = replacement.val;
      this.loc = replacement.loc;
      this.block = replacement.block;
      this.declarations = replacement.declarations;
      this.keyScope = replacement.keyScope;
      this.varScope = replacement.varScope;
      this.js = replacement.js;
    };

    Expr.prototype.turnIntoTuple = function () {
      if (this.args.length === 1 && this.args[0].sym.id !== '<array>') {
        this.transformInto(this.args[0]);
      } else {
        this.sym = meta.tupleSymbol;
      }
    };

    Expr.prototype.combineOperands = function (context, previous, next) {

      if (this.sym.symbolData.arity === meta.aritySum && this.isEmpty()) {
        this.sym = meta.KEY_ROOT_SCOPE.get(this.sym.id + 'x');
      } else if (this.sym.symbolData.arity === meta.arityIncrement) {
        if (this.isEmpty()) {
          this.sym = meta.KEY_ROOT_SCOPE.get(this.sym.id + 'x');
        }
      }
      var extension = this.contextExtensionThatTakesRightOperand(context, next);
      if (this.canTakeRightOperand()) {
        if (next.needsLeftOperand()) {
          this.error('Invalid operator combination');
        }
        this.push(next);
        context.precedence = this.precedence();
        this.handleExtended(context);
      } else if (extension !== null) {
        extension.current.push(next);
        context.precedence = extension.current.precedence();
      } else if (next.canTakeLeftOperand()) {
        var rightPrecedence = next.precedence();
        var leftPrecedence = context.precedence;
        var leftCandidate = this;
        var currentCandidate = this;
        while (leftCandidate !== null) {
          if (leftPrecedence > rightPrecedence ||
              (leftPrecedence === rightPrecedence &&
              next.isRightAssociative())) {
            currentCandidate = leftCandidate;
            break;
          } else {
            leftCandidate = leftCandidate.parent;
            if (leftCandidate !== null) {
              currentCandidate = leftCandidate;
              leftPrecedence = currentCandidate.precedence();
            }
          }
        }

        if (currentCandidate.parent !== null) {
          var parent = currentCandidate.parent;
          var replacedOperand = parent.pop();
          if (replacedOperand !== currentCandidate) {
            currentCandidate.error(
                'Right operand is ' + replacedOperand.sym.id + 'instead of this');
            replacedOperand.error(
                'Left operand is ' + currentCandidate.sym.id + 'instead of this');
          }
          parent.push(next);
        }
        next.push(currentCandidate);
        if (next.sym.symbolData.arity === meta.arityIncrement) {
          next.sym = meta.KEY_ROOT_SCOPE.get('x' + next.sym.id);
        }
      } else {
        var parameters = null;
        var call = null;

        if (next.sym.id == '<array>') {
          if (next.args.length !== 1) {
            next.error('Array subscript expression must have exactly one index');
          }
          parameters = next.args.length > 0 ? next.args[0] : next;
          next = parameters;
          call = new Expr(meta.elementSymbol, null, [], null);
        } else {
          parameters = next;
          call = new Expr(meta.callSymbol, null, [], null);
        }
        call.takeLocationFrom(next);

        var candidateCaller = this;
        var nextCandidateCaller = this;
        var candidatePrecedence = context.precedence;
        while (nextCandidateCaller !== null) {
          if (candidatePrecedence <= call.precedence()) {
            nextCandidateCaller = nextCandidateCaller.parent;
            if (nextCandidateCaller !== null) {
              candidateCaller = nextCandidateCaller;
              candidatePrecedence = candidateCaller.precedence();
            }
          } else {
            break;
          }
        }
        if (candidateCaller.parent !== null) {
          candidateCaller.parent.replace(candidateCaller, call);
        }
        call.push(candidateCaller);
        if (parameters.sym === meta.tupleSymbol && parameters.args.length === 1) {
          parameters.transformInto(parameters.args[0]);
        }
        call.push(parameters);
        context.precedence = call.precedence();
      }
      return next;
    };

    Expr.prototype.combineArguments = function () {
      if (this.args.length <= 1) {
        if (this.sym.id !== '<do>') {
          if (this.args.length === 1) {
            this.transformInto(this.args[0]);
          } else {
            this.turnIntoTuple();
          }
        }
        return;
      }

      var args = this.args;
      this.args = [];
      var i;
      var previous = null;
      var current = args[0];
      var context = {
        precedence: meta.PRECEDENCES.get('NONE'),
        extended: null
      };
      current.parent = null;
      var next = null;

      if (current.needsLeftOperand()) {
        current.error('Missing left operand');
      }
      for (i = 1; i < args.length; i++) {
        next = args[i];
        next.parent = null;

        next = current.combineOperands(context, previous, next);

        previous = current;
        current = next;
      }

      if (current.needsMoreOperands()) {
        current.error('Missing right operand');
      }

      var combined = current;
      while (combined.parent !== null) {
        combined = combined.parent;
      }

      if (this.parent !== null && this.sym.id !== '<do>') {
        this.parent.replace(this, combined);
      } else {
        this.push(combined);
      }
    };

    Expr.prototype.combine = function () {
      this.setupScopes();
      if (this.sym.isToken()) {
        if (this.sym.kind === 'token') {
          var resolved = this.keyScope.get(this.val);
          if (resolved !== null) {
            this.sym = resolved;
          } else {
            if (this.sym.id !== '<id>') {
              this.error('Expected identifier instead of "' + this.sym.id + '"');
            }
            this.sym = meta.tagSymbol;
          }
        } else if (this.sym.kind === 'value') {
          this.sym = meta.valueSymbol;
        } else {
          this.error('Invalid token kind "' + this.sym.kind + '"" in keyword resolution phase.');
        }
        if (!this.isEmpty()) {
          this.error('Token should not have arguments');
        }
      } else if (this.sym.isBlock()) {
        for (var i = 0; i < this.args.length; i++) {
          this.args[i].combine();
        }
        this.sym.blockData.combine(this);
        if (this.sym.id === '<do>') {
          if (this.args.length === 1 && this.args[0].sym === meta.tupleSymbol) {
            this.transformInto(this.args[0]);
          }
          this.sym = meta.doSymbol;
        }
      } else {
        this.error('Invalid symbol kind "' + this.sym.kind + '"" in keyword resolution phase.');
      }
    };

    Expr.prototype.resolveAllArguments = function () {
      for (var i = 0; i < this.args.length; i++) {
        this.args[i].resolve();
      }
    };
    Expr.prototype.resolve = function () {
      this.sym.symbolData.resolve(this);
    };

    Expr.prototype.toSimpleString = function () {
      if (meta.SymbolDescriptionNeedsValue[this.sym.kind]) {
        return this.val;
      } else {
        return this.sym.id;
      }
    };

    Expr.prototype.toExpressionString = function () {
      if (this.args.length > 0) {
        var result = this.toSimpleString() + '(';
        for (var i = 0; i < this.args.length; i++) {
          result += this.args[i].toExpressionString();
          if (i < this.args.length - 1) {
            result += ', ';
          }
        }
        result += ')';
        return result;
      } else {
        return this.toSimpleString();
      }
    };

    Expr.prototype.tokenDump = function () {
      var result = '';
      if (this.sym.blockData !== null) {
        result += this.sym.blockData.openMarker;
        if (this.sym.blockData.openMarker.length > 1) { result += ' '; }
        for (var i = 0; i < this.args.length; i++) {
          if (i > 0) { result += ' '; }
          result += this.args[i].tokenDump();
        }
        result += this.sym.blockData.closeMarker;
      } else if (this.sym.symbolData !== null) {
        if (meta.SymbolDescriptionNeedsValue[this.sym.kind]) {
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
            result += this.args[j].tokenDump();
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

  Compiler.prototype.combine = function () {
    if (this.errors.length !== 0) {
      return this;
    }
    if (this.root === null) {
      this.parser.error('Cannot combine symbols because parse phase did not happen', 0, 0);
      return this;
    }
    this.root.combine();
    this.root.fixDependent();
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
