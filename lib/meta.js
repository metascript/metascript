var util = require('util');
var fs = require('fs');
var escodegen = require('escodegen');


// The public entry point for the metascript compiler.
function Meta() {
  if (!(this instanceof Meta)) {
    return new Meta();
  }

  // Container for private functions and properties
  var meta = {};

  function processString(s, lineHandler) {
    var lines = s.split("\n");
    for (var i = 0; i < lines.length; i++) {
      lineHandler(lines[i]);
    }
  }

  function StringReader(s, name) {
    if (!(this instanceof  StringReader)) {
      return new StringReader(s, name);
    }
    this.name = typeof name === 'string' ? name : 'memory';
    this.error = null;
    this.value = s;
    this.start = function (lineHandler) {
      processString(this.value, lineHandler);
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
      processString(this.value, lineHandler);
    };
  }
  this.FileReader = FileReader;

  this.TAB_SIZE = -1;
  meta.tabSize



  function BlockSymbol(id, openMarker, closeMarker, newScope, close, comma, new_line) {
    // key in symbol table
    this.id = id;
    // small string used when printing block starts
    this.openMarker = openMarker;
    // small string used when printing block ends
    this.closeMarker = closeMarker;
    // true if the block needs a new scope when created
    this.needsNewScope = newScope;
    // (compiler, closingToken)
    this.handleClose = close;
    // (compiler)
    this.handleComma = comma;
    // (compiler, firstChar)
    this.handleNewLine = new_line;
  }
  this.BlockSymbol = BlockSymbol;
  BlockSymbol.prototype.meta = this;

  var blockSymbolPar = new BlockSymbol(
    '()', '(', ')', true,
    function (compiler, closingToken) {
      var myClosing = this.id.charAt(1);
      if (myClosing === closingToken) {
        compiler.closeBlock();
      } else {
        compiler.error('Mismatched closed block: "' + closingToken + '"');
      }
    },
    function (compiler) {
      compiler.error('Misplaced ","');
    },
    function (compiler, firstChar) {
      if (compiler.currentColumnNumber >= compiler.currentBlock.block.level) {
        compiler.openBlock('<block>');
        compiler.openBlock('<line>');
      } else {
        var myClosing = this.id.charAt(1);
        if (myClosing !== firstChar) {
          compiler.error('Indentation is less than enclosing block level');
        }
      }
    }
  );
  var blockSymbolSquare = new BlockSymbol(
    '[]', '[', ']', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine
  );
  var block_symbol_curly = new BlockSymbol(
    '{}', '{', '}', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine
  );
  var blockSymbolBlock = new BlockSymbol(
    '<block>', '(b', ')', true,
    function (compiler, closingToken) {
      var block = compiler.currentBlock;
      if (block.isEmpty()) {
        compiler.removeCurrentBlock();
      } else {
        compiler.closeBlock();
      }
      if (compiler.currentBlock !== block) {
        compiler.currentBlock.sym.blockData.handleClose(compiler, closingToken);
      } else {
        compiler.error('Misplaced close symbol: "' + closingToken + '"');
      }
    },
    function (compiler) {
      compiler.error('Misplaced ","');
    },
    function (compiler, firstChar) {
      var block = compiler.currentBlock;
      if (compiler.currentColumnNumber > block.block.level) {
        compiler.openBlock('<block>');
        compiler.openBlock('<line>');
      } else if (compiler.currentColumnNumber === block.block.level) {
        compiler.openBlock('<line>');
      } else {
        compiler.closeBlock();
        compiler.currentBlock.sym.blockData.handleNewLine(compiler, firstChar);
      }
    }
  );
  var blockSymbolDo = new BlockSymbol(
    '<do>', '(d', ')', true,
    blockSymbolBlock.handleClose,
    blockSymbolBlock.handleComma,
    function (compiler, firstChar) {
      var block = compiler.currentBlock;
      if (compiler.currentLineNumber === block.loc.start.line + 1) {
        block.block.level = compiler.currentColumnNumber;
        compiler.openBlock('<line>');
      } else {
        blockSymbolBlock.handleNewLine(compiler, firstChar);
      }
    }
  );
  var blockSymbolLine = new BlockSymbol(
    '<line>', '(l', ')', false,
    blockSymbolBlock.handleClose,
    blockSymbolBlock.handleComma,
    function (compiler, firstChar) {
      var block = compiler.currentBlock;
      if (compiler.currentColumnNumber > block.block.level) {
        compiler.openBlock('<block>');
        compiler.openBlock('<line>');
      } else {
        if (block.isEmpty()) {
          compiler.removeCurrentBlock();
        } else {
          compiler.closeBlock();
        }
        compiler.currentBlock.sym.blockData.handleNewLine(compiler, firstChar);
      }
    }
  );
  var blockSymbolComma = new BlockSymbol(
    '<comma>', '(c', ')', false,
    blockSymbolBlock.handleClose,
    function (compiler) {
      var block = compiler.currentBlock;
      if (block.isEmpty()) {
        compiler.Expr('<none>');
      }
      compiler.closeBlock();
      compiler.openBlock('<comma>');
    },
    function (compiler, firstChar) {
      var block = compiler.currentBlock;
      if (block.isEmpty()) {
        var parent = block.parent;
        if (parent.args.length === 1) {
          compiler.removeCurrentBlock();
          compiler.openBlock('<block>');
          compiler.openBlock('<line>');
          parent.block.level = firstChar;
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




  function Symbol(id, kind, type, def, metaData, blockData) {
    this.id = id;
    // one of 'external', 'local', 'argument', 'builtin', 'meta'
    this.kind = kind;
    this.type = typeof type === 'undefined' ? 'any' : type;
    this.def = typeof def === 'undefined' ? null : def;
    this.metaData = typeof metaData === 'undefined' ? null : metaData;
    this.blockData = typeof blockData === 'undefined' ? null : blockData;
  }
  this.Symbol = Symbol;
  Symbol.prototype.meta = this;
  Symbol.prototype.isMeta = function () {
    return this.metaData !== null;
  };
  Symbol.prototype.isBlock = function () {
    return this.blockData !== null;
  };
  Symbol.prototype.isBlockWithNewScope = function () {
    return this.isBlock() && this.blockData.needsNewScope === true;
  };
  Symbol.prototype.is_builtin = function () {
    return this.kind === 'builtin';
  };

  this.PRIMITIVES.value = new Symbol('<val>', 'builtin');
  this.PRIMITIVES.operator = new Symbol('<op>', 'builtin');
  this.PRIMITIVES.identifier = new Symbol('<id>', 'builtin');
  this.PRIMITIVES.none = new Symbol('<none>', 'builtin');
  this.PRIMITIVES.par = new Symbol('()', 'block', undefined,
                                   null, null, blockSymbolPar);
  this.PRIMITIVES.square = new Symbol('[]', 'block', undefined,
                                      null, null, blockSymbolSquare);
  this.PRIMITIVES.curly = new Symbol('{}', 'block', undefined,
                                     null, null, block_symbol_curly);
  this.PRIMITIVES.block = new Symbol('<block>', 'block', undefined,
                                     null, null, blockSymbolBlock);
  this.PRIMITIVES.doblock = new Symbol('<do>', 'block', undefined,
                                     null, null, blockSymbolDo);
  this.PRIMITIVES.line = new Symbol('<line>', 'block', undefined,
                                     null, null, blockSymbolLine);
  this.PRIMITIVES.comma = new Symbol('<comma>', 'block', undefined,
                                     null, null, blockSymbolComma);
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

  this.addAllObjectsToMap(this.ROOT_SCOPE, function (s) {
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


  this.addAllToMap(this.RESERVED, [
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

    function ParseError(message, line, columnNumber) {
      this.message = message;
      this.lineNumber = typeof line === 'undefined' ?
          this.compiler.currentLineNumber : line;
      this.columnNumber = typeof columnNumber === 'undefined' ?
          this.compiler.currentColumnNumber : columnNumber;
    }
    this.ParseError = ParseError;
    ParseError.prototype.compiler = this;
    ParseError.prototype.toString = function () {
      return "error [" + this.lineNumber + "," + this.columnNumber + "]: " + this.message;
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
          this.args[i] = args[i];
        }
      }

      if (typeof parent === 'undefined') {
        // No parent provided: assume it is the current block
        // (this works when the constructor is called by the parser).
        this.loc = this.compiler.current_location();
        if (this.compiler.currentBlock !== null) {
          this.compiler.currentBlock.push(this);
        }
        this.parent = this.compiler.currentBlock;
      } else {
        // Use the provided parent.
        this.loc = this.compiler.unknownLocation();
        parent.push(this);
        this.parent = parent;
      }

      if (this.shouldBeBlock()) {
        this.block = {
          level: this.loc.start.column,
          scope: this.compiler.newScope(this),
          expr: this
        };
      } else {
        this.block = null;
      }

      this.js = null;
    }
    this.Expr = Expr;
    Expr.prototype.compiler = this;

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
      return this.compiler.isReserved(this.sym.id);
    };
    Expr.prototype.shouldBeBlock = function () {
      return this.compiler.isBlock(this.sym.id);
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
    this.currentLineNumber = 0;
    this.currentColumnNumber = 0;
    this.current_level = 0;
    this.currentBlock = null;
    this.root = this.openBlock('<block>');
    this.currentBlock = this.root;

    this.multilineStringIsLiterate = false;
    this.multilineStringContents = null;
    this.multilineStringTerminator = null;

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



  }
  this.Compiler = Compiler;
  //util.inherits(Compiler, this);
  Compiler.prototype = this;

  Compiler.prototype.current_location = function (c1, c2) {
    var line = this.currentLineNumber;
    if (!c1) { c1 = this.currentColumnNumber; }
    if (!c2) { c2 = this.currentColumnNumber; }
    return {
      source: this.source ? this.source : null,
      start: {line: line, column: c1},
      end: {line: line, column: c1}
    };
  };
  Compiler.prototype.set_location_end = function (location, column) {
    if (location) {
      if (typeof column === 'undefined') { column = this.currentColumnNumber; }
      location.end.line = this.currentLineNumber;
      location.end.column = column;
    }
  };
  Compiler.prototype.enclosingLocation = function (start, end) {
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
  Compiler.prototype.unknownLocation = function () {
    return {
      source: 'unknown',
      start: {line: 0, column: 0},
      end: {line: 0, column: 0}
    };
  };

  Compiler.prototype.dumpBlockStack = function () {
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

  Compiler.prototype.openBlock = function (kind) {
    var new_block = this.Expr(kind);
    this.currentBlock = new_block;
    return new_block;
  };

  Compiler.prototype.closeBlock = function () {
    var result = this.currentBlock;
    if (result !== null) {
      this.set_location_end(result.loc);
      result = result.parent;
      if (result !== null) {
        this.currentBlock = result;
      } else {
        this.error("Closing root block");
      }
    }
    return result;
  };
  Compiler.prototype.removeCurrentBlock = function () {
    var current = this.currentBlock;
    this.closeBlock();
    if (current !== null) {
      this.currentBlock.remove(current);
    }
    return this.currentBlock;
  };

  Compiler.prototype.addPrimitive = function (primitive, value) {
    this.Expr(primitive, value);
  };
  Compiler.prototype.addValue = function (value) {
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
  Compiler.prototype.addOperator = function (value) {
    this.addPrimitive('<op>', value);
  };
  Compiler.prototype.addIdentifier = function (value) {
    this.addPrimitive('<id>', value);
  };
  Compiler.prototype.addNone = function () {
    this.addPrimitive('<none>', null);
  };

  Compiler.prototype.error = function (message, line, columnNumber) {
    this.errors.push(new this.ParseError(message, line, columnNumber));
  };

  Compiler.prototype.currentScope = function () {
    if (this.currentBlock !== null) {
      return this.currentBlock.block.scope;
    } else {
      return null;
    }
  };
  Compiler.prototype.newScope = function (expr) {
    var startingScope = expr.scope();
    if (startingScope === null) { startingScope = this.ROOT_SCOPE; }
    if (this.isBlockWithNewScope(expr.sym.id) ||
        startingScope === this.ROOT_SCOPE) {
      return Object.create(startingScope);
    } else {
      return startingScope;
    }
  };

  Compiler.prototype.isReserved = function (s) {
    return this.mapHas(this.RESERVED, s);
  };
  Compiler.prototype.isBlock = function (s) {
    return this.mapHas(this.PRIMITIVES, s) && this.PRIMITIVES[s].blockData !== null;
  };
  Compiler.prototype.isBlockWithNewScope = function (s) {
    return this.isBlock(s) && this.PRIMITIVES[s].blockData.needsNewScope;
  };

  Compiler.prototype.processLine = function (line) {
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
        if (this.TAB_SIZE > 0) {
          this.currentColumnNumber += (this.TAB_SIZE - 1);
        } else {
          this.error("No tabs allowed for indentation", 0);
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
        (remaining.indexOf('"""') === 0 || remaining.indexOf("'''") === 0)) {
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
      case "'":
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
    this.reader.start(function (line) {
      me.processLine(line);
    });
    return me;
  };

}

Meta.prototype.mapHas = function (map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
};
Meta.prototype.mapGet = function (map, key) {
  return this.mapHas(map, key) ? map[key] : null;
};
Meta.prototype.newMap = function () {
  return Object.create(null);
};
Meta.prototype.addAllToMap = function (map, keys, value) {
  if (typeof value === 'undefined') { value = true; }
  for (var i = 0; i < keys.length; i++) {
    map[keys[i]] = value;
  }
};
Meta.prototype.addAllObjectsToMap = function (map, key, values) {
  for (var i = 0; i < values.length; i++) {
    map[key(values[i])] = values[i];
  }
};

Meta.prototype.compiler_from_string = function (s) {
  return this.Compiler(this.StringReader(s));
};

Meta.prototype.RESERVED = Meta.prototype.newMap();
Meta.prototype.PRIMITIVES = Meta.prototype.newMap();
Meta.prototype.ROOT_SCOPE = Meta.prototype.newMap();


module.exports = Meta;
