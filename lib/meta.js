require('source-map-support').install();

var functionBuilder = function (jsCode) {
  var __$result__function$__ = null;
  eval(jsCode);
  return __$result__function$__;
};

// The public entry point for the metascript compiler.
function Meta() {
  if (!(this instanceof Meta)) {
    return new Meta();
  }

  var util = require('util');
  var fs = require('fs');
  var path = require('path');
  var escodegen = require('escodegen');

  var constants = require('./compiler/constants');


  var debug = function () {
    console.log(util.format.apply(null, arguments));
  };

  // Container for private functions and properties
  var meta = {};
  meta.Meta = this;

  this.options = {};

  meta.emptyFunction = function () {};
  meta.trueFunction = function () {
    return true;
  };
  meta.falseFunction = function () {
    return false;
  };
  meta.nullFunction = function () {
    return null;
  };
  meta.undefinedFunction = function () {
    return undefined;
  };
  meta.existsOr = function (value, alternative) {
    return typeof value === 'undefined' ? alternative : value;
  };
  meta.existsOrNull = function (value) {
    return meta.existsOr(value, null);
  };
  meta.existsOrFalse = function (value) {
    return meta.existsOr(value, false);
    return typeof value === 'undefined' ? false : value;
  };
  meta.existsOrEmptyFunction = function (value) {
    return meta.existsOr(value, meta.emptyFunction);
    return typeof value === 'undefined' ? meta.emptyFunction : value;
  };
  meta.existsOrFalseFunction = function (value) {
    return meta.existsOr(value, meta.falseFunction);
  };
  meta.existsOrTrueFunction = function (value) {
    return meta.existsOr(value, meta.trueFunction);
  };
  meta.existsOrNullFunction = function (value) {
    return meta.existsOr(value, meta.nullFunction);
  };
  meta.existsOrUndefinedFunction = function (value) {
    return meta.existsOr(value, meta.undefinedFunction);
  };

  meta.ScopeMap = function (expr, scopeGetter, scopeTester, root, subordinateGetter, isKeyCapturer) {
    this.expr = meta.existsOrNull(expr);
    this.scopeGetter = meta.existsOrNullFunction(scopeGetter);
    this.scopeTester = meta.existsOrTrueFunction(scopeTester);
    this.root = meta.existsOrNull(root);
    this.subordinateGetter = meta.existsOrNullFunction(subordinateGetter);
    this.isKeyCapturer = meta.existsOrFalseFunction(isKeyCapturer);

    this.values = Object.create(null);
    // This only tracks the current map end not its parent.
    this.empty = true;
    this.nextSuffix = 1;
  };
  meta.ScopeMap.prototype.prefix = '_$';
  meta.ScopeMap.prototype.parent = function () {
    if (this.expr !== null && this.expr.parent !== null) {
      return this.scopeGetter(this.expr.parent);
    } else {
      return this.root;
    }
  };
  meta.ScopeMap.prototype.extend = function () {
    var result = new meta.ScopeMap();
    result.values = Object.create(this.values);
    return result;
  };
  meta.ScopeMap.prototype.get = function (key) {
    for (var current = this; current != null; current = current.parent()) {
      if (typeof current.values[key] !== 'undefined') {
        return current.values[key];
      }
      var subordinate = current.subordinateGetter(key);
      if (subordinate !== null) {
        return subordinate;
      }
    }
    return null;
  };
  meta.ScopeMap.prototype.has = function (key) {
    return this.get(key) !== null;
  };
  meta.ScopeMap.prototype.set = function (key, value) {
    var current = this;
    while (current !== null && !current.scopeTester()) {
      if (current.isKeyCapturer()) {
        current.empty = false;
        current.values[key] = value;
      }
      current = current.parent();
    }
    current.empty = false;
    current.values[key] = value;
  };
  meta.ScopeMap.prototype.newUniqueKey = function (value, prefix) {
    if (typeof value === 'undefined') value = true;
    if (typeof prefix === 'undefined') prefix = this.prefix;
    var suffix = 0;
    var baseKey = prefix;
    var key = baseKey + suffix;
    while (this.has(key)) {
      suffix++;
      key = baseKey + suffix;
    }
    this.set(key, value);
    return key;
  };

  meta.ScopeMap.prototype.forEach = function (f) {
    for (var key in this.values) {
      f(key, this.values[key]);
    }
  };
  meta.ScopeMap.prototype.absorb = function (other) {
    var me = this;
    other.forEach(function(k, v) {
      me.set(k, v);
    });
  };
  meta.ScopeMap.prototype.addAllKeysWithValue = function (keys, value) {
    if (typeof value === 'undefined') { value = true; }
    for (var i = 0; i < keys.length; i++) {
      this.values[keys[i]] = value;
    }
  };
  meta.ScopeMap.prototype.addAllObjects = function (key, values) {
    for (var i = 0; i < values.length; i++) {
      this.values[key(values[i])] = values[i];
    }
  };

  meta.ScopeMap.prototype.debugCheckKey = function (key) {
    console.log('[ScopeMap] key search: ' + key);
    for (var current = this; current != null; current = current.parent()) {
      if (typeof current.values[key] !== 'undefined') {
        console.log('[ScopeMap] key found in: ' + current.expr);
        return;
      } else {
        console.log('[ScopeMap] -- not found: ' + key);
        if (current.expr !== null) {
          console.log('[ScopeMap] -- expr : ' + current.expr);
        }
        var keys = '[ ';
        current.forEach(function(k, v) {
          keys += k;
          keys += ' ';
        });
        keys += ']';
        console.log('[ScopeMap] -- : ' + keys);
      }
    }
    console.log('[ScopeMap] search failed: ' + key);
  };

  meta.isArray = function (obj) {
    //return toString.call(obj) === '[object Array]';
    return util.isArray(obj);
  };

  meta.copy = function (obj) {
    var target = {};
    for (var i in obj) {
      if (obj.hasOwnProperty(i)) {
        target[i] = obj[i];
      }
    }
    return obj;
  };

  meta.firstToUpper = function (s, prependUnderscore) {
    if (s.length > 0) {
      var first = s.substring(0, 1);
      if (first.match(/[a-z]/)) {
        return first.toUpperCase() + s.substring(1);
      }
    }
    if (prependUnderscore) {
      return '_' + s;
    } else {
      return s;
    }
  };
  meta.normalizeTag = function (tag) {
    var i;
    while (tag[tag.length - 1] === '!' || tag[tag.length - 1] === '?') {
      var prefix = tag[tag.length - 1] === '!' ? 'do' : 'is';
      var body = tag.substring(0, tag.length - 1);
      body = meta.firstToUpper(body, false);
      tag = prefix + body;
    }
    while ((i = tag.indexOf('->')) >= 0) {
      var before = tag.substring(0, i);
      var after = tag.substring(i + 2);
      var middle = before.length > 0 ? 'To' : 'to';
      tag = before + middle + meta.firstToUpper(after, true);
    }
    while ((i = tag.indexOf('-')) >= 0) {
      var before = tag.substring(0, i);
      var after = tag.substring(i + 1);
      tag = before + meta.firstToUpper(after, true);
    }
    return tag;
  };

  meta.codegenProgram = function (body) {
    return {
      type: 'Program',
      loc: null,
      body: body,
    };
  };
  meta.codegenExpressionStatement = function (loc, expression) {
    return {
      type: 'ExpressionStatement',
      loc: loc,
      expression: expression,
    };
  };
  meta.codegenIdentifier = function (loc, name) {
    if (name !== 'this') {
      return {
        type: 'Identifier',
        loc: loc,
        name: name
      };
    } else {
      return meta.codegenThis(loc);
    }
  };
  meta.codegenLiteral = function (loc, value) {
    return {
      type: 'Literal',
      loc: loc,
      value: value
    };
  };
  meta.codegenFunction = function (loc, parameters, body, generator) {
    return {
      type: 'FunctionExpression',
      loc: loc,
      id: null,
      params: parameters,
      defaults: [],
      rest: null,
      body: body,
      generator: generator || false,
      expression: false
    };
  };
  meta.codegenBlock = function (loc, body) {
    return {
      type: 'BlockStatement',
      loc: loc,
      body: body
    };
  };
  meta.codegenLabeledStatement = function (loc, statement, label) {
    var id = meta.codegenIdentifier(loc, label);
    return {
      type: 'LabeledStatement',
      loc: loc,
      label: id,
      body: statement
    };
  };
  meta.codegenLabeledBlock = function (loc, body, label) {
    var block = meta.codegenBlock(loc, body);
    return meta.codegenLabeledStatement(loc, block, label);
  };
  meta.codegenIf = function (loc, test, consequent, alternate) {
    if (typeof alternate === 'undefined') alternate = null;
    return {
      type: 'IfStatement',
      loc: loc,
      test: test,
      consequent: consequent,
      alternate: alternate
    };
  };
  meta.codegenConditional = function (loc, test, consequent, alternate) {
    return {
      type: 'ConditionalExpression',
      loc: loc,
      test: test,
      consequent: consequent,
      alternate: alternate
    };
  };
  meta.codegenBreak = function (loc, label) {
    if (typeof label === 'undefined') {
      label = null;
    } else {
      label = meta.codegenIdentifier(loc, label);
    }
    return {
      type: 'BreakStatement',
      loc: loc,
      label: label
    };
  };
  meta.codegenContinue = function (loc) {
    return {
      type: 'ContinueStatement',
      loc: loc
    };
  };
  meta.codegenReturn = function (loc, value) {
    if (typeof value === 'undefined') value = null;
    return {
      type: 'ReturnStatement',
      loc: loc,
      argument: value
    };
  };
  meta.codegenThrow = function (loc, value) {
    return {
      type: 'ThrowStatement',
      loc: loc,
      argument: value
    };
  };
  meta.codegenTry = function (loc, body, catchId, catchBody, finallyBody) {
    if (typeof catchId === 'undefined') catchId = null;
    if (typeof catchBody === 'undefined') catchBody = null;
    if (typeof finallyBody === 'undefined') finallyBody = null;
    return {
      type: 'TryStatement',
      loc: loc,
      block: body,
      handler: catchBody === null ? null : {
        type: 'CatchClause',
        loc: catchBody.loc,
        param: catchId,
        guard: null,
        body: catchBody
      },
      guardedHandlers: [],
      finalizer: finallyBody
    };
  };
  meta.codegenLoop = function (loc, body, label) {
    body.push(meta.codegenBreak(loc, label));
    var block = meta.codegenBlock(loc, body);
    var condition = meta.codegenIdentifier(loc, 'true');
    var loop = {
      type: 'WhileStatement',
      loc: loc,
      test: condition,
      body: block
    };
    return meta.codegenLabeledStatement(loc, loop, label);
  };
  meta.codegenForIn = function (loc, varExpr, objExpr, body) {
    return {
      type: 'ForInStatement',
      loc: loc,
      left: varExpr,
      right: objExpr,
      body: body
    };
  };
  meta.codegenVariableDeclarator = function (loc, name) {
    return {
      type: 'VariableDeclarator',
      loc: loc,
      id: meta.codegenIdentifier(loc, name),
      init: null
    };
  };
  meta.codegenVariableDeclaration = function (loc, name) {
    return {
      type: 'VariableDeclaration',
      loc: loc,
      declarations: [
        meta.codegenVariableDeclarator(loc, name)
      ],
      kind: 'var'
    };
  };
  meta.codegenVariableDeclarations = function (loc, declarations) {
    return {
      type: 'VariableDeclaration',
      loc: loc,
      declarations: declarations,
      kind: 'var'
    };
  };
  meta.codegenThis = function (loc) {
    return {
      type: 'ThisExpression',
      loc: loc
    };
  };
  meta.codegenArray = function (loc, elements) {
    return {
      type: 'ArrayExpression',
      loc: loc,
      elements: elements
    };
  };
  meta.codegenObjectProperty = function (key, value, kind) {
    if (typeof kind === 'undefined') kind = 'init';
    return {
      key: meta.codegenLiteral(value.loc, key),
      value: value,
      kind: kind
    };
  };
  meta.codegenObject = function (loc, properties) {
    return {
      type: 'ObjectExpression',
      loc: loc,
      properties: properties
    };
  };
  meta.codegenBinaryOp = function (loc, op, left, right) {
    return {
      type: 'BinaryExpression',
      operator: op,
      loc: loc,
      left: left,
      right: right
    };
  };
  meta.codegenUnaryOp = function (loc, op, arg, prefix) {
    if (typeof prefix === 'undefined') prefix = true;
    return {
      type: 'UnaryExpression',
      operator: op,
      loc: loc,
      prefix: prefix,
      argument: arg
    };
  };
  meta.codegenAssignment = function (loc, op, left, right) {
    return {
      type: 'AssignmentExpression',
      operator: op,
      loc: loc,
      left: left,
      right: right
    };
  };
  meta.codegenAssignmentStatement = function (loc, op, left, right) {
    var expression = meta.codegenAssignment(loc, op, left, right);
    return meta.codegenExpressionStatement(loc, expression);
  };
  meta.codegenUpdate = function (loc, op, arg, prefix) {
    if (typeof prefix === 'undefined') prefix = true;
    return {
      type: 'UpdateExpression',
      operator: op,
      loc: loc,
      prefix: prefix,
      argument: arg
    };
  };
  meta.codegenLogicalOp = function (loc, op, left, right) {
    return {
      type: 'LogicalExpression',
      operator: op,
      loc: loc,
      left: left,
      right: right
    };
  };
  meta.codegenCall = function (loc, callee, args, verbatim) {
    var node = {
      type: 'CallExpression',
      loc: loc,
      callee: callee,
      arguments: args
    };
    if (typeof verbatim === 'string') {
      node['x-verbatim'] = verbatim;
    }
    return node;
  };
  meta.codegenNew = function (loc, callee, args) {
    return {
      type: 'NewExpression',
      loc: loc,
      callee: callee,
      arguments: args
    };
  };
  meta.codegenElement = function (loc, obj, key) {
    return {
      type: 'MemberExpression',
      loc: loc,
      object: obj,
      property: key,
      computed: true
    };
  };
  meta.codegenMember = function (loc, obj, name, nameLoc) {
    if (typeof nameLoc === 'undefined') nameLoc = loc;
    if (meta.isReserved(name)) {
      return meta.codegenElement(loc, obj, meta.codegenLiteral(nameLoc, name));
    } else {
      return {
        type: 'MemberExpression',
        loc: loc,
        object: obj,
        property: meta.codegenIdentifier(nameLoc, name),
        computed: false
      };
    }
  };
  meta.codegenDebugger = function (loc) {
    return {
      type: 'DebuggerStatement',
      loc: loc
    }
  };
  meta.codegenYield = function (loc, value, delegate) {
    return {
      type: 'YieldExpression',
      loc: loc,
      argument: value,
      delegate: delegate || false
    };
  };


  meta.RESERVED = new meta.ScopeMap();
  meta.PRECEDENCES = new meta.ScopeMap();
  meta.TOKENS = new meta.ScopeMap();
  meta.KEY_ROOT_SCOPE = new meta.ScopeMap();
  meta.VAR_ROOT_SCOPE = new meta.ScopeMap();

  meta.isReserved = function (s) {
    return meta.RESERVED.has(s);
  };

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
      // Note: We should never reach this point, the comma block takes care of it
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
      expr.set('had-parens', true)
    }
  );
  var blockSymbolSquare = new meta.BlockData(
    '[]', '[', ']', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine,
    function (expr) {
      if (expr.argCount() === 1 && expr.argAt(0).sym === meta.tupleSymbol) {
        expr.transformInto(expr.argAt(0));
      }
      expr.sym = expr.keyScope.get(meta.arraySymbol.id);
    }
  );
  var blockSymbolCurly = new meta.BlockData(
    '{}', '{', '}', true,
    blockSymbolPar.handleClose,
    blockSymbolPar.handleComma,
    blockSymbolPar.handleNewLine,
    function (expr) {
      if (expr.argCount() === 1 && expr.argAt(0).sym === meta.tupleSymbol) {
        expr.transformInto(expr.argAt(0));
      }
      expr.sym = expr.keyScope.get(meta.objectSymbol.id);
    }
  );
  var blockSymbolBlock = new meta.BlockData(
    '<block>', '(b', ')', true,
    function (parser, closingToken) {
      var block = parser.currentBlock;
      if (0 === parser.countNonIgnored(block)) {
        parser.removeCurrentBlock();
      } else {
        parser.closeBlock(true);
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
      if (parser.currentLineNumber >= block.loc.start.line + 1 && !block.get('do-initialized')) {
        block.set('do-initialized', true);
        var blockLevel = parser.currentColumnNumber;
        var doLevel = blockLevel;
        var count = parser.countNonIgnored(block);
        if (count > 0 && block.parent !== null && block.parent.id === '<line>') {
          var lineLevel = block.parent.block.level;
          if (blockLevel < lineLevel) {
            block.block.level = lineLevel;
            blockSymbolBlock.handleNewLine(parser, firstChar);
            return;
          }
        }
        block.block.level = doLevel;
        parser.openBlock('<block>');
        parser.currentBlock.block.level = blockLevel;
        parser.openBlock('<line>');
      } else {
        blockSymbolBlock.handleNewLine(parser, firstChar);
      }
    },
    function (expr, resultReceiver) {
      expr.combineArguments(resultReceiver);
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
        if (0 === parser.countNonIgnored(block)) {
          parser.removeCurrentBlock();
        } else {
          parser.closeBlock(true);
        }
        parser.currentBlock.sym.blockData.handleNewLine(parser, firstChar);
      }
    },
    function (expr, resultReceiver) {
      expr.combineArguments(resultReceiver);
    }
  );
  var blockSymbolComma = new meta.BlockData(
    '<comma>', '(c', ')', false,
    function (parser, closingToken) {
      // Handle tailing commas
      var block = parser.currentBlock;
      var parent = block.parent;
      if (0 === parser.countNonIgnored(block) && parser.countNonIgnored(parent) > 1) {
        // In arrays convert tailing commas to undefined
        if (parent.sym.id === '[]') {
          parser.addIdentifier('undefined');
        } else {
          block.error('Misplaced ","');
        }
      }

      blockSymbolBlock.handleClose.call(this, parser, closingToken);
    },
    function (parser) {
      var block = parser.currentBlock;
      if (0 === parser.countNonIgnored(block)) {
        // In arrays allow to skip values
        if (block.parent.sym.id === '[]') {
          parser.addIdentifier('undefined');
        } else {
          parser.error('Misplaced ","')
        }
      }
      parser.closeBlock(true);
      parser.openBlock('<comma>');
    },
    function (parser) {
      var block = parser.currentBlock;
      if (0 === parser.countNonIgnored(block)) {
        var parent = block.parent;
        if (1 === parser.countNonIgnored(parent)) {
          parser.removeCurrentBlock();
          parser.openBlock('<block>');
          parser.openBlock('<line>');
          // Migrate any existing CST tags
          parser.currentBlock.setArgs(block.args);
          parent.block.level = parser.currentColumnNumber;
        }
      }
    },
    blockSymbolLine.combine
  );

  meta.arityMap = new Object(null);
  meta.addArity = function (needsLeft, canHaveLeft, needsRight, canHaveRight,
        minOperandCount, maxOperandCount, maxOperandCountWithDependencies,
        isRightAssociative, isSequence, key, name) {
    var arity = {
      needsLeft: needsLeft,
      canHaveLeft: canHaveLeft,
      needsRight: needsRight,
      canHaveRight: canHaveRight,
      minOperandCount: minOperandCount,
      maxOperandCount : maxOperandCount,
      maxOperandCountWithDependencies : maxOperandCountWithDependencies,
      isRightAssociative: isRightAssociative,
      isSequence: isSequence
    };
    meta[key] = arity;
    meta.arityMap[name] = arity;
  };
  meta.getArity = function (name) {
    var arity = meta.arityMap[name];
    if (typeof arity === 'undefined') arity = null;
    return arity;
  };
  meta.addArity(false, false, false, false, 0, 0, 0, false, true,
      'aritySequence',      'sequence');
  meta.addArity(false, false, true,  true,  2, 2, 2, true,  false,
      'arityBinaryKeyword', 'binaryKeyword');
  meta.addArity(false, false, true,  true,  3, 3, 3, true,  false,
      'arityTernaryKeyword', 'ternaryKeyword');
  meta.addArity(false, false, true,  true,  2, 2, 3, true,  false,
      'arityIfKeyword', 'binaryIf');
  meta.addArity(false, false, false, false, 0, 0, 0, false, false,
      'arityZero',          'zero');
  meta.addArity(false, false, false, true,  0, 1, 1, true,  false,
      'arityOptional',      'optional');
  meta.addArity(false, false, true,  true,  1, 1, 1, true,  false,
      'arityUnary',         'unary');
  meta.addArity(true,  true,  true,  true,  2, 2, 2, false, false,
      'arityBinary',        'binary');
  meta.addArity(true,  true,  true,  true,  2, 2, 2, true,  false,
      'arityBinaryRight',   'binaryRight');
  meta.addArity(true,  true,  false, false, 1, 1, 1, false, false,
      'arityPostfix',       'post');

  meta.addArity(false, true,  true,  true,  1, 2, 2, false, false,
      'aritySum',           '<sum>');
  meta.addArity(false, true,  false, true,  1, 1, 1, false, false,
      'arityIncrement',     '<inc>');
  meta.addArity(false, false, true,  true,  1, 1, 1, true,  false,
      'arityPreIncrement',  '<preinc>');
  meta.addArity(true,  true,  false, false, 1, 1, 1, false, false,
      'arityPostIncrement', '<postinc>');

  meta.CodegenContext = function (expr, block, tupleTmp, jumpTmp,
      nextLabel, endLabel, nextArgs, blockLabel) {
    if (typeof block === 'undefined') block = [];
    if (typeof tupleTmp === 'undefined') tupleTmp = null;
    if (typeof jumpTmp === 'undefined') jumpTmp = null;
    if (typeof nextLabel === 'undefined') nextLabel = null;
    if (typeof endLabel === 'undefined') endLabel = null;
    if (typeof nextArgs === 'undefined') nextArgs = null;
    if (typeof blockLabel === 'undefined') blockLabel = null;
    this.expr = expr;
    this.block = block;
    this.tupleTmp = tupleTmp;
    this.jumpTmp = jumpTmp;
    this.nextLabel = nextLabel;
    this.endLabel = endLabel;
    this.nextArgs = nextArgs;
    this.blockLabel = blockLabel;
  };
  meta.newRootCodegenContext = function (expr) {
    return new meta.CodegenContext(expr);
  };
  meta.newBranchCodegenContext = function (expr, parentContext) {
    return new meta.CodegenContext(
      expr, [], parentContext.tupleTmp,
      parentContext.jumpTmp, parentContext.nextLabel, parentContext.endLabel,
      parentContext.nextArgs, false);
  };
  meta.newAssignmentCodegenContext = function (expr, parentContext, tupleTmp) {
    return new meta.CodegenContext(
      expr, parentContext.block, tupleTmp,
      parentContext.jumpTmp, parentContext.nextLabel, parentContext.endLabel,
      parentContext.nextArgs);
  };
  meta.newDoCodegenContext = function (expr, parentContext, tmp) {
    var jumpTmp, endLabel, blockLabel;
    if (parentContext.expr.sym.id === 'loop') {
      blockLabel = null;
      jumpTmp = parentContext.jumpTmp;
      endLabel = parentContext.endLabel;
    } else {
      blockLabel = expr.createJumpLabel();
      jumpTmp = expr.createJumpTmp(parentContext, tmp);
      endLabel = blockLabel;
    }
    return new meta.CodegenContext(
      expr, [], null, jumpTmp, parentContext.nextLabel, endLabel,
      parentContext.nextArgs, blockLabel);
  };
  meta.newLoopCodegenContext = function (expr, parentContext, tmp) {
    var jumpTmp = expr.createJumpTmp(parentContext, tmp);
    var blockLabel = expr.createJumpLabel();
    var nextArgs;
    if (expr.sym.id !== 'loop') {
      expr.error('Cannot create loop context in expression ' + expr.sym.id);
      nextArgs = null;
    } else {
      nextArgs = expr.argAt(0);
    }
    return new meta.CodegenContext(
        expr, [], null, jumpTmp, blockLabel, blockLabel, nextArgs, blockLabel);
  };

  meta.missingCodegen = function (expr) {
    return meta.codegenIdentifier(expr.loc, 'undefined');
  };
  meta.defaultCodegenAsExpression = function (expr, context) {
    var tmp = expr.createCodegenTemporary();
    expr.sym.symbolData.codegenToTemporary(expr, context, tmp);
    return meta.codegenIdentifier(expr.loc, tmp);
  };
  meta.defaultCodegenToTemporary = function (expr, context, tmp) {
    var expression = expr.sym.symbolData.codegenAsExpression(expr, context);
    if (tmp !== null) {
      if (expr.resultCount !== 1) {
        expr.error('Only one result expected');
        return;
      }
      var destination = meta.codegenIdentifier(expr.loc, tmp);
      var assignment = meta.codegenAssignmentStatement(expr.loc, '=', destination, expression);
      context.block.push(assignment);
    } else {
      var statement = meta.codegenExpressionStatement(expr.loc, expression);
      context.block.push(statement);
    }
  };

  meta.SymbolData = function (arity, precedence, options) {
    this.arity = arity;
    this.precedence = precedence;

    if (typeof options === 'undefined') options = {};
    this.resolve = typeof options.resolve !== 'undefined' ? options.resolve :
        function (expr, vTagMap) {
          expr.resolveAllArguments(vTagMap);
        };

    this.leftPrecedence = (typeof options.leftPrecedence === 'undefined') ?
        this.precedence : options.leftPrecedence;

    this.dependent = meta.existsOrNull(options.dependent);
    this.fixDependent = meta.existsOrEmptyFunction(options.fixDependent);
    this.subordinate = meta.existsOrNull(options.subordinate);
    this.preExpand = meta.existsOrEmptyFunction(options.preExpand);
    this.expand = meta.existsOrEmptyFunction(options.expand);
    this.preCombine = meta.existsOrUndefinedFunction(options.preCombine);
    this.postCombine = meta.existsOrUndefinedFunction(options.postCombine);
    this.expandCall = meta.existsOrUndefinedFunction(options.expandCall);

    this.doNotExpandChildren = meta.existsOrFalse(options.doNotExpandChildren);
    this.capturesKeyScope = meta.existsOrFalse(options.capturesKeyScope);

    var missingCodegenAsExpression = typeof options.codegenAsExpression === 'undefined';
    var missingCodegenToTemporary = typeof options.codegenToTemporary === 'undefined';
    if (missingCodegenAsExpression && missingCodegenToTemporary) {
      this.codegenAsExpression = meta.missingCodegen;
      this.codegenToTemporary = meta.missingCodegen;
      this.isStatement = false;
    } else {
      this.codegenAsExpression = missingCodegenAsExpression ?
          meta.defaultCodegenAsExpression : options.codegenAsExpression;
      this.codegenToTemporary = missingCodegenToTemporary ?
          meta.defaultCodegenToTemporary : options.codegenToTemporary;
      this.hasCodegenAsExpression = missingCodegenAsExpression ? false : true;
      this.hasCodegenToTemporary = missingCodegenToTemporary ? false : true;
    }

    this.data = meta.existsOrNull(options.data);
    this.opensNewScope = meta.existsOrFalse(options.opensNewScope);
    this.canHostDeclarations = meta.existsOrFalse(options.canHostDeclarations);
    this.isAssignable = meta.existsOrFalse(options.isAssignable);

    this.creationAst = meta.existsOrNull(options.creationAst);

    this.controlFlowSplitter = meta.existsOrNullFunction(options.controlFlowSplitter);

    this.fixTagKind = (typeof options.fixTagKind !== 'undefined') ? options.fixTagKind :
        function (expr) {
          for (var i = 0; i < expr.argCount(); i++) {
            expr.argAt(i).fixTagKind();
          }
        };
    this.toConstantTag = null;
    this.toVirtualTag = null;
    this.toExternalTag = null;
    this.toTagDeclaration = null;
    this.toTagUse = null;

    this.isJumpStatement = meta.existsOrFalse(options.isJumpStatement);

    // Should return the result count for expr, this is the default implementation.
    // Actual signature is (expr, expectedResultCount, endArity, loopArity).
    this.checkArity = typeof options.checkArity !== 'undefined' ?
        options.checkArity : function (expr, expectedResultCount) {
      if (expectedResultCount > 1) {
        expr.error('Expression cannot produce a tuple');
      }
      expr.checkArgsArity(true, -1, -1);
      return 1;
    };
  };

  meta.SymbolDescriptionNeedsValue = {
    // Parser symbol kinds (tokens)
    block: false,
    value: true,
    token: true,
    none: false,
    ignored: false,
    // Compiler symbol kinds (includes value)
    builtin: false,
    macro: false,
    tag: true
  };

  meta.Symbol = function (id, kind, symbolData, options) {
    this.id = id;
    // One of 'block', 'value', 'token', 'none' for tokens.
    // One of 'builtin', 'macro', for resolved symbols,
    // otherwise 'tag' or 'value'.
    this.kind = kind;
    this.symbolData = meta.existsOrNull(symbolData);

    options = typeof options === 'undefined' ? {} : options;
    // type, def, blockData
    this.blockData = meta.existsOrNull(options.blockData);
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
  meta.TOKENS.set('<sp>', new meta.Symbol('<sp>', 'ignored'));
  meta.TOKENS.set('<nl>', new meta.Symbol('<nl>', 'ignored'));
  meta.TOKENS.set('<comment>', new meta.Symbol('<comment>', 'ignored'));
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
    'HIGH',
    'VAR',          // var, let, const
    'FUNCTION-LEFT',// left side of -> => (function definition)
    'CALL',         // function call (the same precedence as MEMBER)
    'IMPLICIT',     // implicit function call (space operator)
    'NEW',          // new
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
    'MEDIUM',
    'TYPE',         // :: (type annotation)
    'FUNCTION',     // -> => (function definition)
    'PROPERTY',     // : (property definition)
    'LOW',
    'KEY',          // keyword (if, try...)
    'ASSIGNMENT',   // = += -+ *= /= %= <<= >>= >>>= &= |= ^=
    'LOWEST',
    'NONE'
  ];

  for (var idx = 0; idx < precedences_list.length; idx++) {
    meta.PRECEDENCES.set(precedences_list[idx], idx);
  }
  // MEMBER needs to have the same precedence as CALL
  meta.PRECEDENCES.set('MEMBER', meta.PRECEDENCES.get('CALL'));

  meta.checkPrecedence = function (name) {
    return meta.PRECEDENCES.get(name) !== null;
  };

  meta.Declaration = function (name, tag, isAssignable) {
    if (typeof tag === 'undefined') tag = null;
    if (typeof isAssignable === 'undefined') isAssignable = true;

    this.name = name;
    this.tag = tag;
    this.isAssignable = isAssignable;
  };
  meta.newDeclaration = function (tag) {
    return new meta.Declaration(tag.val, tag, tag.isAssignable());
  };
  meta.newAssignableDeclaration = function (name) {
    return new meta.Declaration(name);
  };
  meta.newReadonlyDeclaration = function (name) {
    return new meta.Declaration(name, null, false);
  };
  meta.Declaration.prototype.error = function (message) {
    if (this.tag !== null) {
      this.tag.error(message);
    }
  };

  // Root scope setup.

  constants.PREDEFINED.forEach(function (predefined) {
    meta.VAR_ROOT_SCOPE.set(predefined, meta.newReadonlyDeclaration(predefined));
  });

  meta.addBuiltinKeySymbol = function (symbol) {
    meta.KEY_ROOT_SCOPE.set(symbol.id, symbol);
  };

  // Builtins with a token that cannot be found in symbol tables.
  meta.valueSymbol = new meta.Symbol('<value>', 'value',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      codegenAsExpression: function (expr) {
        return meta.codegenLiteral(expr.loc, expr.val);
      }
    }));
  meta.addBuiltinKeySymbol(meta.valueSymbol);

  function redeclaredIdentifier(kind, name, expr, originalDeclaration) {
    expr.error('Redeclared ' + kind + ' "' + name + '"',
               (originalDeclaration && originalDeclaration.tag)
               ? [originalDeclaration.tag.createError('(previous declaration was here)')]
               : undefined);
  };

  meta.codegenTag = function (expr) {
    return meta.codegenIdentifier(expr.loc, expr.resolvedVal());
  };
  meta.addTagSymbol = function (name, key, isAssignable) {
    if (typeof isAssignable === 'undefined') isAssignable = true;
    var tagSymbol = new meta.Symbol(key, 'tag',
      new meta.SymbolData(meta.arityZero, 'NONE', {
        isAssignable: isAssignable,
        codegenAsExpression: meta.codegenTag,
        resolve: function (expr, vTagMap) {
          var name = expr.val;
          if (meta.isReserved(name) && expr.isName()) {
            expr.error('Identifier \"' + name + '\" is reserved');
          }

          var declaration;
          if (vTagMap === null) {
            if (!expr.isVirtualTag()) {
              expr.val = meta.normalizeTag(expr.val);
              name = expr.val;
              if (!expr.isName()) {
                if (expr.isTagDeclaration() || expr.isExternalTag()) {
                  if (meta.isReserved(name) && !expr.isExternalTag()) {
                    expr.error('Reserved identifier \"' + name + '\"');
                  } else if (expr.varScope.has(name) && !expr.isFunctionArgument()) {
                    declaration = expr.varScope.get(name);
                    // Allow redeclaration for external tags only
                    if (!(expr.isExternalTag() && declaration.tag.isExternalTag())) {
                      redeclaredIdentifier('identifier', name, expr, declaration);
                    }
                  } else {
                    declaration = meta.newDeclaration(expr);
                    expr.varScope.set(name, declaration);
                    if (expr.isTagAndNeedsDeclaration()) {
                      expr.declarations.set(name, declaration);
                    }
                  }
                } else {
                  if (!expr.varScope.has(name)) {
                    if (!expr.compiler.options.allowUndeclaredIdentifiers) {
                      expr.error('Undeclared identifier "' + expr.val + '"');
                    }
                  } else {
                    declaration = expr.varScope.get(name);
                    var isAssignable = declaration.isAssignable;
                    if (declaration.tag !== null) {
                      isAssignable = !declaration.tag.isConstantTag();
                    }
                    if (!isAssignable) {
                      expr.handleAsConstantTag();
                    }
                  }
                }
              }
              expr.isResolved = true;
            } else if (!expr.isResolved){
              expr.error('Unresolved virtual identifier "' + expr.val + '"');
            }
          } else {
            if (expr.isVirtualTag()) {
              if (!expr.isResolved) {
                expr.val = meta.normalizeTag(expr.val);
                name = expr.val;
                if (expr.isTagDeclaration()) {
                  if (meta.isReserved(name)) {
                    expr.error('Reserved identifier \"' + name + '\"');
                  } else if (vTagMap.has(name)) {
                    declaration = vTagMap.get(name);
                    redeclaredIdentifier('virtual identifier', name, expr, declaration);
                  } else {
                    var virtualName = expr.compiler.virtualTags.newUniqueKey(name);
                    expr.val = virtualName;
                    vTagMap.set(name, expr);
                  }
                  expr.isResolved = true;
                } else {
                  if (vTagMap.has(name)) {
                    expr.val = vTagMap.get(name).val;
                    if (vTagMap.get(name).isConstantTag()) {
                      expr.handleAsConstantTag();
                    }
                    expr.isResolved = true;
                  }
                }
              }
            }
          }
        }
      }));
    meta[name] = tagSymbol;
    meta.KEY_ROOT_SCOPE.set(key, tagSymbol);
  };

  meta.addTagSymbol('tagSymbol', '<tag>');
  meta.addTagSymbol('tagDeclarationSymbol', '<tagDeclaration>');
  meta.addTagSymbol('cTagSymbol', '<cTag>', false);
  meta.addTagSymbol('cTagDeclarationSymbol', '<cTagDeclaration>');
  meta.addTagSymbol('nameSymbol', '<name>', false);
  meta.addTagSymbol('argumentSymbol', '<argument>', true);

  meta.addTagSymbol('vTagSymbol', '<vTag>');
  meta.addTagSymbol('vTagDeclarationSymbol', '<vTagDeclaration>');
  meta.addTagSymbol('vcTagSymbol', '<vcTag>', false);
  meta.addTagSymbol('vcTagDeclarationSymbol', '<vcTagDeclaration>');

  meta.addTagSymbol('xTagSymbol', '<xTag>');
  meta.addTagSymbol('xcTagSymbol', '<xcTag>', false);

  meta.describeTagSymbol = function (symbol, toConstant, toDeclaration, toUse, toVirtual, toExternal) {
    meta[symbol].symbolData.toConstantTag = toConstant;
    meta[symbol].symbolData.toTagDeclaration = toDeclaration;
    meta[symbol].symbolData.toTagUse = toUse;
    meta[symbol].symbolData.toVirtualTag = toVirtual;
    meta[symbol].symbolData.toExternalTag = toExternal;
  };

  meta.describeTagSymbol('tagSymbol',
    meta.cTagSymbol,
    meta.tagDeclarationSymbol,
    meta.tagSymbol,
    meta.vTagSymbol,
    meta.xTagSymbol);
  meta.describeTagSymbol('tagDeclarationSymbol',
    meta.cTagDeclarationSymbol,
    meta.tagDeclarationSymbol,
    meta.tagSymbol,
    meta.vTagDeclarationSymbol,
    meta.xTagSymbol);
  meta.describeTagSymbol('cTagSymbol',
    meta.cTagSymbol,
    meta.cTagDeclarationSymbol,
    meta.cTagSymbol,
    meta.vcTagSymbol,
    meta.xcTagSymbol);
  meta.describeTagSymbol('cTagDeclarationSymbol',
    meta.cTagDeclarationSymbol,
    meta.cTagDeclarationSymbol,
    meta.cTagSymbol,
    meta.vcTagDeclarationSymbol,
    meta.xcTagSymbol);

  meta.describeTagSymbol('xTagSymbol',
    meta.xcTagSymbol,
    meta.xTagSymbol,
    meta.xTagSymbol,
    null,
    meta.xTagSymbol);
  meta.describeTagSymbol('xcTagSymbol',
    meta.xcTagSymbol,
    meta.xcTagSymbol,
    meta.xcTagSymbol,
    null,
    meta.xcTagSymbol);

  meta.describeTagSymbol('vTagSymbol',
    meta.vcTagSymbol,
    meta.vTagDeclarationSymbol,
    meta.vTagSymbol,
    meta.vTagSymbol,
    null);
  meta.describeTagSymbol('vTagDeclarationSymbol',
    meta.vcTagDeclarationSymbol,
    meta.vTagDeclarationSymbol,
    meta.vTagSymbol,
    meta.vTagDeclarationSymbol,
    null);
  meta.describeTagSymbol('vcTagSymbol',
    meta.vcTagSymbol,
    meta.vcTagDeclarationSymbol,
    meta.vcTagSymbol,
    meta.vcTagSymbol,
    null);
  meta.describeTagSymbol('vcTagDeclarationSymbol',
    meta.vcTagDeclarationSymbol,
    meta.vcTagDeclarationSymbol,
    meta.vcTagSymbol,
    meta.vcTagDeclarationSymbol,
    null);

  meta.codegenVTag = function (expr) {
    return meta.codegenIdentifier(expr.loc, expr.compiler.virtualTags.get(expr.val));
  };
  meta.vTagSymbol.symbolData.codegenAsExpression = meta.codegenVTag;
  meta.vcTagSymbol.symbolData.codegenAsExpression = meta.codegenVTag;

  meta.codegenVTagDeclaration = function (expr, toSym) {
    var realName = expr.compiler.virtualTags.get(expr.val);
    var name = expr.createCodegenTemporary(realName);
    expr.compiler.virtualTags.set(expr.val, name);
    expr.sym = toSym;
    return meta.codegenIdentifier(expr.loc, name);
  };
  meta.vTagDeclarationSymbol.symbolData.codegenAsExpression = function (expr) {
    return meta.codegenVTagDeclaration(expr, meta.vTagSymbol);
  };
  meta.vcTagDeclarationSymbol.symbolData.codegenAsExpression = function (expr) {
    return meta.codegenVTagDeclaration(expr, meta.cvTagSymbol);
  };

  // Builtins with an irregular token.
  meta.tupleSymbol = new meta.Symbol('<tuple>', 'builtin',
    new meta.SymbolData(meta.aritySequence, 'NONE', {
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        if (expectedResultCount === 1 && expr.argCount() === 0) {
          expr.transformInto(expr.undefinedExpression());
          return 1;
        } else if (expectedResultCount === 0 && expr.argCount() > 0) {
          expr.sym = meta.doSymbol;
          expr.checkArgsArity(false, expectedResultCount, loopArity);
          return expectedResultCount;
        } else {
          expr.checkArgsArity(true, -1, -1);
          return expr.argCount();
        }
      },
      codegenToTemporary: function (expr, context, tmp) {
        if (tmp !== null) {
          if (expr.argCount() !== 1) {
            expr.error('Exactly one value is required');
            return;
          }
          meta.pushAssignment(context.block, expr.loc,
              meta.codegenIdentifier(expr.loc, tmp),
              expr.argAt(0).codegenAsExpression(context));
        } else if (context.tupleTmp !== null) {
          if (expr.argCount() !== context.tupleTmp.length) {
            expr.error('Argument count mismatch: ' + expr.argCount() +
                ' vs ' + context.tupleTmp.length);
          }
          for (var i = 0; i < expr.argCount(); i++) {
            meta.pushAssignment(context.block, expr.loc,
                meta.codegenIdentifier(expr.loc, context.tupleTmp[i]),
                expr.argAt(i).codegenAsExpression(context));
          }
        } else {
          expr.error('No destination for assignment');
        }
      }
    }));
  meta.addBuiltinKeySymbol(meta.tupleSymbol);
  meta.doSymbol = new meta.Symbol('<do>', 'builtin',
    new meta.SymbolData(meta.aritySequence, 'NONE', {
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        if (expr.argCount() === 1 && expr.argAt(0).isTuple()) {
          expr.transformInto(expr.argAt(0));
          expr.sym = meta.doSymbol;
        }
        if (expectedResultCount > 0 && expr.argCount() > 0) {
          var lastArgument = expr.argAt(-1);
          if (!lastArgument.isJumpStatement()) {
            var give = expr.newAtThisLocation(meta.KEY_ROOT_SCOPE.get('give!'));
            lastArgument.replaceWith(give);
            give.push(lastArgument);
          }
        }
        expr.checkArgsArity(false, expectedResultCount, loopArity);
        return expectedResultCount;
      },
      codegenToTemporary: function (expr, context, tmp) {
        var doContext = meta.newDoCodegenContext(expr, context, tmp);
        for (var i = 0; i < expr.argCount(); i++) {
          expr.argAt(i).codegenAsStatement(doContext);
        }
        var block = doContext.blockLabel !== null ?
            meta.codegenLabeledBlock(expr.loc, doContext.block, doContext.endLabel) :
            meta.codegenBlock(expr.loc, doContext.block);
        context.block.push(block);
      },
      opensNewScope: true
    }));
  meta.addBuiltinKeySymbol(meta.doSymbol);
  meta.objectSymbol = new meta.Symbol('<object>', 'builtin',
    new meta.SymbolData(meta.aritySequence, 'NONE', {
      checkArity: function (expr) {
        for (var i = 0; i < expr.argCount(); i++) {
          var arg = expr.argAt(i);
          if (arg.sym.id !== ':') {
            arg.error('Property definition expected');
          }
          arg.checkArity(0, -1, -1);
        }
        return 1;
      },
      codegenAsExpression: function (expr, context) {
        var members = [];
        for (var i = 0; i < expr.argCount(); i++) {
          var prop = expr.argAt(i);
          var key = prop.argAt(0).val;
          var value = prop.argAt(1).codegenAsExpression(context);
          members.push(meta.codegenObjectProperty(key, value));
        }
        return meta.codegenObject(expr.loc, members);
      }
    }));
  meta.addBuiltinKeySymbol(meta.objectSymbol);
  meta.arraySymbol = new meta.Symbol('<array>', 'builtin',
    new meta.SymbolData(meta.aritySequence, 'NONE', {
      checkArity: function (expr) {
        expr.checkArgsArity(true, -1, -1);
        return 1;
      },
      codegenAsExpression: function (expr, context) {
        var members = [];
        for (var i = 0; i < expr.argCount(); i++) {
          var element = expr.argAt(i);
          var value = element.codegenAsExpression(context);
          members.push(value);
        }
        return meta.codegenArray(expr.loc, members);
      }
    }));
  meta.addBuiltinKeySymbol(meta.arraySymbol);
  meta.callSymbol = new meta.Symbol('<call>', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'CALL', {
      expand: function (expr, env) {
        return expr.argAt(0).sym.symbolData.expandCall(expr, env);
      },
      checkArity: function (expr) {
        expr.argAt(0).checkArity(1, -1, -1);
        if (expr.argAt(1).sym === meta.tupleSymbol) {
          expr.argAt(1).checkArgsArity(true, -1, -1);
        } else {
          expr.argAt(1).checkArity(1, -1, -1);
        }
        return 1;
      },
      codegenAsExpression: function (expr, context) {
        var parameters = [];
        var args = expr.argAt(1);
        if (args.sym === meta.tupleSymbol) {
          for (var i = 0; i < args.argCount(); i++) {
            var arg = args.argAt(i);
            parameters.push(arg.codegenAsExpression(context));
          }
        } else {
          parameters.push(args.codegenAsExpression(context));
        }
        var callee = expr.argAt(0).codegenAsExpression(context);
        return meta.codegenCall(expr.loc, callee, parameters, expr.get('js'));
      }
    }));
  meta.addBuiltinKeySymbol(meta.callSymbol);

  // Duplicate the call symbol to customize it for implicit applications
  meta.implicitSymbol = new meta.Symbol('<call>', 'builtin',
    new meta.SymbolData(meta.arityBinaryRight, 'IMPLICIT', {
      expand: meta.callSymbol.symbolData.expand,
      checkArity: meta.callSymbol.symbolData.checkArity,
      codegenAsExpression: meta.callSymbol.symbolData.codegenAsExpression
    }));

  meta.elementSymbol = new meta.Symbol('<element>', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'MEMBER', {
      codegenAsExpression: function (expr, context) {
        var keyExpr = expr.argAt(1).codegenAsExpression(context);
        var objExpr = expr.argAt(0).codegenAsExpression(context);
        return meta.codegenElement(expr.loc, objExpr, keyExpr);
      },
      isAssignable: true
    }));
  meta.addBuiltinKeySymbol(meta.elementSymbol);
  meta.placeholderSymbol = new meta.Symbol('<placeholder>', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      checkArity: function (expr) {
        expr.error('Missing expression');
        return 0;
      },
      codegenAsExpression: function (expr) {
        expr.error('Cannot generate code for missing expression');
        return meta.codegenIdentifier(expr.loc, 'undefined');
      },
      isAssignable: true
    }));
  meta.addBuiltinKeySymbol(meta.placeholderSymbol);


  meta.binaryOpMap = {};
  meta.binaryOpMap['=='] = '===';
  meta.binaryOpMap['!='] = '!==';
  meta.codegenBinaryOpAsExpression = function (expr, context) {
    var op = meta.binaryOpMap[expr.sym.id];
    if (typeof op === 'undefined') op = expr.sym.id;
    return meta.codegenBinaryOp(expr.loc, op,
        expr.argAt(0).codegenAsExpression(context),
        expr.argAt(1).codegenAsExpression(context));
  };
  meta.defineBinaryOp = function (op, precedence) {
    meta.KEY_ROOT_SCOPE.set(op, new meta.Symbol(op, 'builtin',
      new meta.SymbolData(meta.arityBinary, precedence, {
        codegenAsExpression: meta.codegenBinaryOpAsExpression
      })));
  };

  meta.unaryOpMap = {};
  meta.unaryOpMap['+x'] = '+';
  meta.unaryOpMap['-x'] = '-';
  meta.unaryOpMap['++x'] = '++';
  meta.unaryOpMap['--x'] = '--';
  meta.unaryOpMap['x++'] = '++';
  meta.unaryOpMap['x--'] = '--';
  meta.unaryOpPrefixMap = {};
  meta.unaryOpPrefixMap['+x'] = true;
  meta.unaryOpPrefixMap['-x'] = true;
  meta.unaryOpPrefixMap['++x'] = true;
  meta.unaryOpPrefixMap['--x'] = true;
  meta.unaryOpPrefixMap['x++'] = false;
  meta.unaryOpPrefixMap['x--'] = false;
  meta.codegenUnaryOpAsExpression = function (expr, context) {
    var op = meta.unaryOpMap[expr.sym.id];
    if (typeof op === 'undefined') op = expr.sym.id;
    var prefix = meta.unaryOpPrefixMap[expr.sym.id];
    if (typeof prefix === 'undefined') prefix = true;
    return meta.codegenUnaryOp(expr.loc, op,
        expr.argAt(0).codegenAsExpression(context),
        prefix);
  };
  meta.defineUnaryOp = function (op, precedence) {
    meta.KEY_ROOT_SCOPE.set(op, new meta.Symbol(op, 'builtin',
      new meta.SymbolData(meta.arityUnary, precedence, {
        codegenAsExpression: meta.codegenUnaryOpAsExpression
      })));
  };

  // Irregular operator variants
  meta.defineUnaryOp('+x', 'UNARY');
  meta.defineUnaryOp('-x', 'UNARY');
  meta.defineUnaryOp('++x', 'INC');
  meta.defineUnaryOp('--x', 'INC');
  meta.defineUnaryOp('x++', 'INC');
  meta.defineUnaryOp('x--', 'INC');

  meta.checkAssignmentArity = function (expr) {
    var leftArity = expr.argAt(0).checkAssignability(true);
    expr.argAt(0).checkArity(leftArity, -1, -1);
    expr.argAt(1).checkArity(leftArity, -1, -1);
    if (leftArity > 1) {
      // For now we disallow cascading tuple assignments...
      return 0;
    } else if (leftArity === 1) {
      // Should be 1, but could, patologically, be zero...
      return 1;
    } else {
      expr.error('Assignable expression required');
      return 1;
    }
  };
  meta.pushAssignment = function (block, loc, left, right, op) {
    if (typeof op === 'undefined') op = '=';
    var statement = meta.codegenAssignmentStatement(loc, op, left, right);
    block.push(statement);
  };
  meta.codegenAssignmentAsExpression = function (expr, context) {
    var op = expr.sym.id;
    var left = expr.argAt(0);
    var right = expr.argAt(1);
    var leftArity = left.resultCount;
    if (leftArity === 1) {
      var r = right.codegenAsExpression(context);
      var l = left.codegenAsExpression(context);
      return meta.codegenAssignment(expr.loc, op, l, r);
    } else {
      expr.error('Only a simple assignment can produce a value');
      return meta.codegenIdentifier(expr.loc, 'false');
    }
  };
  meta.codegenAssignmentToTemporary = function (expr, context, tmp) {
    var op = expr.sym.id;
    var left = expr.argAt(0);
    var right = expr.argAt(1);
    var leftArity = left.resultCount;

    if (tmp !== null) {
      var tmpR = this.codegenAsExpression(expr, context);
      var tmpL = meta.codegenIdentifier(expr.loc, tmp);
      var tmpA = meta.codegenAssignmentStatement(expr.loc, op, tmpL, tmpR);
      context.block.push(tmpA);
    } else {
      if (context.tupleTmp !== null) {
        expr.error('Tuple context not allowed in assignment statement');
      }

      if (leftArity === 1) {
        var argR = right.codegenAsExpression(context);
        var argL = left.codegenAsExpression(context);
        var argA = meta.codegenAssignmentStatement(expr.loc, op, argL, argR);
        context.block.push(argA);
      } else {
        if (left.sym !== meta.tupleSymbol) {
          left.error('Expected tuple with arity ' + leftArity);
          return;
        }
        var tupleTmp = expr.createResultVariables(leftArity);
        var myContext = meta.newAssignmentCodegenContext(expr, context, tupleTmp);
        right.codegenToTemporary(myContext, null);
        for (var i = 0; i < leftArity; i++) {
          var r = meta.codegenIdentifier(expr.loc, tupleTmp[i]);
          var l = left.argAt(i).codegenAsExpression(context);
          var a = meta.codegenAssignmentStatement(expr.loc, op, l, r);
          context.block.push(a);
        }
      }
    }
  };
  meta.defineAssignmentOp = function (op) {
    meta.KEY_ROOT_SCOPE.set(op, new meta.Symbol(op, 'builtin',
      new meta.SymbolData(meta.arityBinaryRight, 'ASSIGNMENT', {
        checkArity: meta.checkAssignmentArity,
        codegenAsExpression: meta.codegenAssignmentAsExpression,
        codegenToTemporary: meta.codegenAssignmentToTemporary
      })));
  };

  meta.defineAssignmentOp('=');
  meta.defineAssignmentOp('+=');
  meta.defineAssignmentOp('-=');
  meta.defineAssignmentOp('*=');
  meta.defineAssignmentOp('/=');
  meta.defineAssignmentOp('%=');
  meta.defineAssignmentOp('<<=');
  meta.defineAssignmentOp('>>=');
  meta.defineAssignmentOp('>>>=');
  meta.defineAssignmentOp('&=');
  meta.defineAssignmentOp('^=');
  meta.defineAssignmentOp('|=');

  meta.KEY_ROOT_SCOPE.set('.', new meta.Symbol('.', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'MEMBER', {
      checkArity: function (expr) {
        expr.args[0].checkArity(1, -1, -1);
        if (expr.argAt(1).sym !== meta.nameSymbol) {
          expr.argAt(1).error('Property name expected');
        }
        return 1;
      },
      codegenAsExpression: function (expr, context) {
        var objExpr = expr.argAt(0).codegenAsExpression(context);
        var name = expr.argAt(1).val;
        return meta.codegenMember(expr.loc, objExpr, name, expr.argAt(1).loc);
      },
      resolve: function (expr, vTagMap) {
        expr.args[0].resolve(vTagMap);
        var name = expr.args[1];
        if (name.isTag()) {
          name.sym = meta.nameSymbol;
          name.val = meta.normalizeTag(name.val);
        } else if (vTagMap === null) {
          name.error('Property name expected');
        }
      },
      isAssignable: true
    })));
  meta.KEY_ROOT_SCOPE.set(':', new meta.Symbol(':', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'PROPERTY', {
      checkArity: function (expr) {
        var key = expr.argAt(0);
        var value = expr.argAt(1);
        if (!(key.isTag() || key.isValue())) {
          key.error('Invalid key expression');
        }
        value.checkArity(1, -1, -1);
        return 0;
      },
      resolve: function (expr, vTagMap) {
        if (vTagMap === null && !expr.args[0].isValue()) {
          if (expr.args[0].isTag()) {
            expr.args[0].sym = meta.nameSymbol;
            expr.args[0].val = meta.normalizeTag(expr.args[0].val);
          } else {
            expr.args[1].error('Invalid property key');
          }
        }
        expr.args[1].resolve(vTagMap);
      }
    })));

  meta.KEY_ROOT_SCOPE.set('+', new meta.Symbol('+', 'builtin',
    new meta.SymbolData(meta.aritySum, 'ADD', {
      codegenAsExpression: meta.codegenBinaryOpAsExpression
    })));
  meta.KEY_ROOT_SCOPE.set('-', new meta.Symbol('-', 'builtin',
    new meta.SymbolData(meta.aritySum, 'ADD', {
      codegenAsExpression: meta.codegenBinaryOpAsExpression
    })));

  meta.defineUnaryOp('!', 'UNARY');
  meta.defineUnaryOp('~', 'UNARY');
  meta.defineUnaryOp('typeof', 'UNARY');
  meta.defineUnaryOp('void', 'UNARY');

  meta.KEY_ROOT_SCOPE.set('delete', new meta.Symbol('delete', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'UNARY', {
      checkArity: function (expr) {
        expr.argAt(0).checkArity(1, -1, -1);
        expr.argAt(0).checkAssignability(false);
        return 1;
      },
      codegenAsExpression: meta.codegenUnaryOpAsExpression
    })));

  meta.defineBinaryOp('*', 'MUL');
  meta.defineBinaryOp('/', 'MUL');
  meta.defineBinaryOp('%', 'MUL');

  meta.defineBinaryOp('<<', 'SHIFT');
  meta.defineBinaryOp('>>', 'SHIFT');
  meta.defineBinaryOp('>>>', 'SHIFT');

  meta.defineBinaryOp('<', 'REL');
  meta.defineBinaryOp('<=', 'REL');
  meta.defineBinaryOp('>', 'REL');
  meta.defineBinaryOp('>=', 'REL');
  meta.defineBinaryOp('instanceof', 'REL');

  meta.defineBinaryOp('==', 'EQ');
  meta.defineBinaryOp('!=', 'EQ');

  meta.defineBinaryOp('&', 'BITWISE-AND');
  meta.defineBinaryOp('|', 'BITWISE-OR');
  meta.defineBinaryOp('^', 'BITWISE-XOR');

  meta.KEY_ROOT_SCOPE.set('||', new meta.Symbol('||', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'LOGICAL-OR', {
      codegenAsExpression: function (expr, context) {
        var arg0 = expr.argAt(0).codegenAsExpression(context);
        var argContext = meta.newBranchCodegenContext(expr, context);
        var arg1 = expr.argAt(1).codegenAsExpression(argContext);
        if (argContext.block.length > 0) {
          var test = meta.codegenUnaryOp(expr.loc, '!', arg0);
          var consequent = meta.codegenBlock(expr.loc, argContext.block);
          var alternate = meta.codegenAssignmentStatement(
              expr.loc, '=', arg1, meta.codegenIdentifier(expr.loc, 'true'));
          context.block.push(meta.codegenIf(expr.loc, test, consequent, alternate));
          return arg1;
        } else {
          return meta.codegenBinaryOp(expr.loc, '||', arg0, arg1);
        }
      }
    })));
  meta.KEY_ROOT_SCOPE.set('&&', new meta.Symbol('&&', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'LOGICAL-AND', {
      codegenAsExpression: function (expr, context) {
        var arg0 = expr.argAt(0).codegenAsExpression(context);
        var argContext = meta.newBranchCodegenContext(expr, context);
        var arg1 = expr.argAt(1).codegenAsExpression(argContext);
        if (argContext.block.length > 0) {
          var consequent = meta.codegenBlock(expr.loc, argContext.block);
          var alternate = meta.codegenAssignmentStatement(
              expr.loc, '=', arg1, meta.codegenIdentifier(expr.loc, 'false'));
          context.block.push(meta.codegenIf(expr.loc, arg0, consequent, alternate));
          return arg1;
        } else {
          return meta.codegenBinaryOp(expr.loc, '&&', arg0, arg1);
        }
      }
    })));

  // meta.defineBinaryOp('::', 'TYPE');

  meta.KEY_ROOT_SCOPE.set('++', new meta.Symbol('++', 'builtin',
    new meta.SymbolData(meta.arityIncrement, 'INC', {})));
  meta.KEY_ROOT_SCOPE.set('--', new meta.Symbol('--', 'builtin',
    new meta.SymbolData(meta.arityIncrement, 'INC', {})));

  meta.KEY_ROOT_SCOPE.set('if', new meta.Symbol('if', 'builtin',
    new meta.SymbolData(meta.arityIfKeyword, 'KEY', {
      dependent: ['else'],
      fixDependent: function (expr) {
        while (expr.argCount() > 3) {
          var lastElse = expr.pop();

          var previousElse = expr.argAt(-1);
          if (previousElse.id !== 'else') {
            previousElse.error('Invalid token: "else" expected.');
            break;
          }
          if (previousElse.argCount() !== 1) {
            previousElse.error('Invalid expressions after "else".');
            break;
          }
          if (previousElse.argAt(0).id !== 'if') {
            previousElse.argAt(0).error('Invalid token: "if" expected.');
            break;
          }
          var lastIf = previousElse.argAt(0);
          if (lastIf.argCount() !== 2) {
            lastIf.error('Inner "if" expression cannot have an \"else\"" branch.');
            break;
          }
          lastIf.push(lastElse.pop());
        }
        if (expr.argCount() === 3) {
          if (expr.argAt(2).id == 'else') {
            var myElse = expr.pop();
            expr.push(myElse.pop());
          }
        }
      },
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        var condition = expr.argAt(0);
        condition.checkArity(1, -1, -1);
        var consequent = expr.argAt(1);
        if (expr.argCount() == 3) {
          var alternate = expr.argAt(2);
          var consequentArity = consequent.checkArity(expectedResultCount, endArity, loopArity);
          var alternateArity = alternate.checkArity(expectedResultCount, endArity, loopArity);
          if (consequentArity == alternateArity) {
            // This could be > 0 even if expectedResultCount is zero.
            return consequentArity;
          } else {
            if (consequent.isJumpStatement()) {
              return alternate.isJumpStatement() ? 0 : alternateArity;
            } else if (alternate.isJumpStatement()) {
              return consequentArity;
            } else {
              // This can only happen if expectedResultCount is zero anyway.
              return 0;
            }
          }
          return 0;
        } else {
          // Since the if lacks an alternate branch it cannot produce a value.
          if (expectedResultCount > 0) {
            expr.error('\"if\" expression without \"else\" branch cannot produce a value');
          }
          consequent.checkArity(0, endArity, loopArity);
          return 0;
        }
      },
      codegenToTemporary: function (expr, context, tmp) {
        var test = expr.argAt(0).codegenAsExpression(context);

        var ifbranch = expr.argAt(1);
        var elseBranch = expr.argCount() == 3 ? expr.argAt(2) : null;

        var branchTmp = ifbranch.resultCount > 0 ? tmp : null;
        var branchContext = meta.newBranchCodegenContext(expr, context);
        ifbranch.codegenToTemporary(branchContext, branchTmp);
        var consequent = meta.codegenBlock(ifbranch.loc, branchContext.block);

        var alternate = null;
        if (elseBranch !== null) {
          branchTmp = elseBranch.resultCount > 0 ? tmp : null;
          branchContext = meta.newBranchCodegenContext(expr, context);
          elseBranch.codegenToTemporary(branchContext, branchTmp);
          alternate = meta.codegenBlock(elseBranch.loc, branchContext.block);
        }

        var ifStatement = meta.codegenIf(expr.loc, test, consequent, alternate);
        context.block.push(ifStatement);
      }
    })));
  meta.KEY_ROOT_SCOPE.set('else', new meta.Symbol('else', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {})));
  meta.KEY_ROOT_SCOPE.set('loop', new meta.Symbol('loop', 'builtin',
    new meta.SymbolData(meta.arityBinaryKeyword, 'NONE', {
      checkArity: function (expr, expectedResultCount) {
        var iterationVariables = expr.argAt(0);
        var body = expr.argAt(1);
        var thisLoopArity = iterationVariables.checkAssignability(true, true);
        if (expectedResultCount > 0 && body.argCount() > 1) {
          var lastArgument = body.argAt(-1);
          if (!lastArgument.isJumpStatement()) {
            var give = body.newAtThisLocation(meta.KEY_ROOT_SCOPE.get('give!'));
            lastArgument.replaceWith(give);
            give.push(lastArgument);
          }
        }
        body.checkArity(0, expectedResultCount, thisLoopArity);
        return expectedResultCount;
      },
      codegenToTemporary: function (expr, context, tmp) {
        var next = expr.argAt(0);
        next.codegenEmitAssignments(context);
        var loopContext = meta.newLoopCodegenContext(expr, context, tmp);
        expr.argAt(1).codegenAsStatement(loopContext);
        var loop = meta.codegenLoop(expr.loc, loopContext.block, loopContext.nextLabel);
        context.block.push(loop);
      },
      opensNewScope: true
    })));

  meta.KEY_ROOT_SCOPE.set('end!', new meta.Symbol('end!', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      isJumpStatement: true,
      checkArity: function (expr, expectedResultCount, endArity) {
        if (endArity === -1) {
          expr.error('Cannot use \"end!\" out of \"do\" context');
          endArity = 0;
        }
        return 0;
      },
      codegenToTemporary: function (expr, context) {
        if (context.endLabel === null) {
          expr.error('End statement out of do context');
          return;
        }
        context.block.push(meta.codegenBreak(expr.loc, context.endLabel));
      }
    })));
  meta.KEY_ROOT_SCOPE.set('give!', new meta.Symbol('give!', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      isJumpStatement: true,
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        if (endArity === -1) {
          expr.error('Cannot give a value out of \"do\" context');
          endArity = 0;
        }
        expr.argAt(0).checkArity(endArity, -1, loopArity);
        return 0;
      },
      codegenToTemporary: function (expr, context) {
        if (context.endLabel === null) {
          expr.error('Give statement out of do context');
          return;
        }
        expr.argAt(0).codegenAssignArgsToTemps(context, context.jumpTmp);
        context.block.push(meta.codegenBreak(expr.loc, context.endLabel));
      }
    })));
  meta.KEY_ROOT_SCOPE.set('next!', new meta.Symbol('next!', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      isJumpStatement: true,
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        if (loopArity === -1) {
          expr.error('Cannot use \"next!\" out of \"loop\" context');
          loopArity = 0;
        }
        expr.argAt(0).checkArity(loopArity, -1, -1);
        return 0;
      },
      codegenToTemporary: function (expr, context) {
        if (context.nextLabel === null || context.nextArgs === null) {
          expr.error('\"next!\" statement out of loop context');
          return;
        }
        context.nextArgs.codegenParallelAssignments(context, expr.argAt(0), true);
        context.block.push(meta.codegenContinue(expr.loc));
      }
    })));
  meta.nextSymbol = meta.KEY_ROOT_SCOPE.get('next!');
  meta.KEY_ROOT_SCOPE.set('return', new meta.Symbol('return', 'builtin',
    new meta.SymbolData(meta.arityOptional, 'KEY', {
      isJumpStatement: true,
      checkArity: function (expr) {
        if (expr.argCount() === 1) {
          expr.argAt(0).checkArity(1, -1, -1);
        }
        return 0;
      },
      codegenToTemporary: function (expr, context, tmp) {
        if (tmp !== null) {
          expr.error('Statement cannot produce a value');
        }
        var returnValue = expr.argCount() === 1 ?
            expr.argAt(0).codegenAsExpression(context) : null;
        var statement = meta.codegenReturn(expr.loc, returnValue);
        context.block.push(statement);
      }
    })));
  meta.KEY_ROOT_SCOPE.set('new', new meta.Symbol('new', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'NEW', {
      checkArity: function (expr) {
        if (!expr.at(0).isCall()) {
          this.error('Call expected after new operator');
        }
        expr.argAt(0).checkArity(1, -1, -1);
        return 1;
      },
      codegenAsExpression: function (expr, context) {
        var call = expr.argAt(0).codegenAsExpression(context);
        return meta.codegenNew(expr.loc, call.callee, call.arguments);
      }
    })));
  meta.KEY_ROOT_SCOPE.set('throw', new meta.Symbol('throw', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      isJumpStatement: true,
      codegenToTemporary: function (expr, context) {
        var thrownValue = expr.argAt(0).codegenAsExpression(context);
        var statement = meta.codegenThrow(expr.loc, thrownValue);
        context.block.push(statement);
      }
    })));
  meta.KEY_ROOT_SCOPE.set('try', new meta.Symbol('try', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      dependent: ['catch', 'finally'],
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        var catchFound = false;
        var finallyFound = false;

        for (var i = 0; i < expr.argCount(); i++) {
          var arg = expr.argAt(i);

          if (arg.id === 'catch') {
            if (!catchFound) {
              if (arg.argAt(0).isTag()) {
                arg.argAt(1).checkArity(expectedResultCount, endArity, loopArity);
              } else {
                arg.argAt(0).error('Invalid catch variable');
              }
              catchFound = true;
            } else {
              arg.error('Multiple catch clauses are not allowed');
            }
          } else if (arg.id === 'finally') {
            if (!finallyFound) {
              arg.argAt(0).checkArity(0, -1, -1);
              finallyFound = true;
            } else {
              arg.error('Multiple finally clauses are not allowed');
            }
          } else {
            if (i === 0) {
              arg.checkArity(expectedResultCount, endArity, loopArity);
            } else {
              arg.error('Malformed try statement');
            }
          }
        }

        if (expectedResultCount > 0 && !catchFound) {
          expr.error('Cannot produce a value without a catch clause');
        }

        return expectedResultCount;
      },
      codegenToTemporary: function (expr, context, resultTemporary) {
        var body = null;
        var catchId = null;
        var catchBody = null;
        var finallyBody = null;
        var subContext = null;

        for (var i = 0; i < expr.argCount(); i++) {
          var arg = expr.argAt(i);
          if (arg.id === 'catch') {
            if (catchBody === null) {
              if (arg.argAt(0).isTag()) {
                catchId = meta.codegenIdentifier(arg.argAt(0).loc, arg.argAt(0).val);
              } else {
                arg.argAt(0).error('Invalid catch variable');
              }
              if (catchId !== null) {
                subContext = meta.newBranchCodegenContext(expr, context);
                arg.argAt(1).codegenToTemporary(subContext, resultTemporary);
                catchBody = meta.codegenBlock(arg.argAt(1).loc, subContext.block);
              }
            } else {
              arg.error('Multiple catch clauses are not allowed');
            }
          } else if (arg.id === 'finally') {
            if (finallyBody === null) {
              subContext = meta.newBranchCodegenContext(expr, context);
              arg.argAt(0).codegenAsStatement(subContext);
              finallyBody = meta.codegenBlock(arg.argAt(0).loc, subContext.block);
            } else {
              arg.error('Multiple finally clauses are not allowed');
            }
          } else {
            if (i === 0) {
              subContext = meta.newBranchCodegenContext(expr, context);
              arg.codegenToTemporary(subContext, resultTemporary);
              body = meta.codegenBlock(arg.loc, subContext.block);
            } else {
              arg.error('Malformed try statement');
            }
          }
        }

        if (body !== null) {
          var statement = meta.codegenTry(expr.loc, body, catchId, catchBody, finallyBody);
          context.block.push(statement);
        }
      },
      opensNewScope: true
    })));
  meta.KEY_ROOT_SCOPE.set('catch', new meta.Symbol('catch', 'builtin',
    new meta.SymbolData(meta.arityBinaryKeyword, 'NONE', {
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        var catchExpressionArity = expr.argAt(0).checkAssignability(true);
        if (catchExpressionArity > 1) {
          expr.argAt(0).error('Only one catch expression is allowed');
        }
        expr.argAt(1).checkArity(0, endArity, loopArity);
        return 0;
      },
    })));
  meta.KEY_ROOT_SCOPE.set('finally', new meta.Symbol('finally', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      checkArity: function (expr, expectedResultCount, endArity, loopArity) {
        expr.argAt(0).checkArity(0, endArity, loopArity);
        return 0;
      },
    })));

  meta.KEY_ROOT_SCOPE.set('var', new meta.Symbol('var', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'VAR', {
      isAssignable: true,
      checkArity: function (expr, expectedResultCount) {
        expr.error('Operator should have been removed.');
        return expectedResultCount;
      },
      fixTagKind: function (expr) {
        expr.args[0].handleAsTagDeclaration();
        expr.transformInto(expr.args[0]);
      },
      resolve: function (expr, vTagMap) {
        if (vTagMap !== null) {
          this.fixTagKind(expr);
          expr.resolve(vTagMap);
        } else {
          expr.error('Symbol "var" should not reach the resolve stage');
        }
      }
    })));
  meta.KEY_ROOT_SCOPE.set('const', new meta.Symbol('const', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'VAR', {
      checkArity: function (expr, expectedResultCount) {
        expr.error('Operator should have been removed.');
        return expectedResultCount;
      },
      fixTagKind: function (expr) {
        expr.args[0].handleAsTagDeclaration();
        expr.args[0].handleAsConstantTag();
        expr.transformInto(expr.args[0]);
      },
      resolve: function (expr, vTagMap) {
        if (vTagMap !== null) {
          this.fixTagKind(expr);
          expr.resolve(vTagMap);
        } else {
          expr.error('Symbol "const" should not reach the resolve stage');
        }
      }
    })));
  meta.KEY_ROOT_SCOPE.set('debugger', new meta.Symbol('debugger', 'builtin',
    new meta.SymbolData(meta.arityZero, 'NONE', {
      checkArity: function (expr, expectedResultCount) {
        return 0;
      },
      codegenToTemporary: function (expr, context) {
        context.block.push(meta.codegenDebugger(expr.loc));
      }
    })));
  meta.fromSymbol = new meta.Symbol('from', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      checkArity: function (expr) {
        if (expr.argCount() === 1) {
          return expr.argAt(0).checkArity(1, -1, -1);
        }
        return 0;
      },
    }));
  meta.KEY_ROOT_SCOPE.set('yield', new meta.Symbol('yield', 'builtin',
    new meta.SymbolData(meta.arityOptional, 'KEY', {
      isJumpStatement: true,
      dependent: ['from'],
      subordinate: [meta.fromSymbol],
      checkArity: function (expr) {
        if (expr.argCount() === 1) {
          expr.argAt(0).checkArity(1, -1, -1);
        }
        return 1;
      },
      fixDependent: function (expr) {
        if (expr.argCount() == 1 && expr.at(0).sym.id == 'from') {
          expr.set('delegate', true)
          var from = expr.at(0);
          if (from.checkArity())
            expr.replaceArg(from, from.at(0));
          else
            expr.remove(0);
        }
      },
      codegenAsExpression: function (expr, context) {
        var parent = expr.findParent(function (o) {
          return o.isFunctionDefinition();
        });
        if (!parent) {
          expr.error('Yield is only allowed inside functions');
          return null;
        }
        parent.set('generator', true);

        var vExpr = expr.argAt(0);
        var delegate = expr.get('delegate');
        var value = vExpr ? vExpr.codegenAsExpression(context) : null;

        if (delegate && !vExpr) {
          expr.error('Delegated yield requires an argument');
        }

        return meta.codegenYield(expr.loc, value, delegate);
      }
    })));
  meta.KEY_ROOT_SCOPE.set('#external', new meta.Symbol('#external', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'VAR', {
      checkArity: function (expr, expectedResultCount) {
        expr.error('Operator should have been removed.');
        return expectedResultCount;
      },
      fixTagKind: function (expr) {
        expr.args[0].handleAsExternalTag();
        expr.transformInto(expr.args[0]);
      },
      resolve: function (expr, vTagMap) {
        if (vTagMap !== null) {
          this.fixTagKind(expr);
          expr.resolve(vTagMap);
        } else {
          expr.error('Symbol "#external" should not reach the resolve stage');
        }
      }
    })));
  meta.quoteTagSymbol = new meta.Symbol('\\', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'VAR', {
      checkArity: function (expr, expectedResultCount) {
        expr.error('Operator should have been removed.');
        return expectedResultCount;
      },
      fixTagKind: function (expr) {
        expr.args[0].handleAsVirtualTag();
        expr.transformInto(expr.args[0]);
      },
      resolve: function (expr, vTagMap) {
        if (vTagMap !== null) {
          this.fixTagKind(expr);
          expr.resolve(vTagMap);
        } else {
          expr.error('Symbol "\\" should not reach the resolve stage');
        }
      }
    }));
  meta.addBuiltinKeySymbol(meta.quoteTagSymbol);


  meta.functionSymbol = new meta.Symbol('->', 'builtin',
    new meta.SymbolData(meta.arityBinary, 'FUNCTION', {
      leftPrecedence: 'LEFT-FUNCTION',
      checkArity: function (expr) {
        var body = expr.argAt(1);
        body.checkArity(body.id === 'return' ? 0 : 1, -1, -1);
        return 1;
      },
      expand: function (expr) {
        if (!expr.argAt(0).isTuple()) {
          expr.argAt(0).asTuple();
          return expr;
        } else if (expr.argAt(0).count === 1 && expr.argAt(0).argAt(0).isTuple()) {
          expr.argAt(0).transformInto(expr.argAt(0).argAt(0));
          return expr;
        }
        if (expr.argAt(1).isTuple()) {
          if (expr.argAt(1).argCount() > 1) {
            expr.argAt(1).sym = meta.doSymbol;
            return expr;
          } else if (expr.argAt(1).argCount() === 1) {
            var body = expr.argAt(1).pop();
            expr.pop();
            expr.push(body);
            return expr;
          }
        } else if (expr.argAt(1).isPlaceholder() && expr.argAt(1).getSimpleValue() === null) {
          expr.pop();
          expr.push(expr.newTag('undefined'))
        }
        return undefined;
      },
      codegenAsExpression: function (expr) {
        var parameters = [];
        var args = expr.argAt(0);
        if (args.sym === meta.tupleSymbol) {
          for (var i = 0; i < args.argCount(); i++) {
            var arg = args.argAt(i);
            if (!arg.isFunctionArgument()) {
              expr.error('Parameter name expected');
            }
            parameters.push(meta.codegenIdentifier(arg.loc, arg.val));
          }
        } else {
          if (!args.isFunctionArgument()) {
            expr.error('Parameter name expected');
          }
          parameters.push(meta.codegenIdentifier(args.loc, args.val));
        }

        var bodyContext = meta.newRootCodegenContext(expr);
        var code = expr.argAt(1);
        if (code.sym.id === 'return') {
          code.codegenAsStatement(bodyContext);
        } else if (code.sym.id === 'yield') {
          var yieldValue = code.codegenAsExpression(bodyContext);
          var yieldStatement = meta.codegenExpressionStatement(code.loc, yieldValue);
          bodyContext.block.push(yieldStatement);
        } else {
          var returnValue = code.codegenAsExpression(bodyContext);
          var returnStatement = meta.codegenReturn(expr.loc, returnValue);
          bodyContext.block.push(returnStatement);
        }
        expr.codegenAddDeclarations(bodyContext.block);
        var body = meta.codegenBlock(expr.loc, bodyContext.block);

        return meta.codegenFunction(expr.loc, parameters, body, expr.get('generator'));
      },
      fixTagKind: function (expr) {
        if (expr.args.length !== 2) {
          expr.error('Function definition is binary.');
          return;
        }
        expr.args[0].handleAsFunctionArgument();
      },
      resolve: function (expr, vTagMap) {
        if (expr.args.length !== 2) {
          expr.error('Function definition is binary.');
          return;
        }
        expr.args[0].resolve(vTagMap);
        expr.args[1].resolve(vTagMap);
      },
      opensNewScope: true,
      canHostDeclarations: true
    }));
  meta.addBuiltinKeySymbol(meta.functionSymbol);

  meta.metaSymbol = new meta.Symbol('#meta', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'KEY', {
      capturesKeyScope: true,
      postCombine: function (expr) {
        var expander = expr.argAt(0).asEvalFunction(['ast']);
        return expander(expr);
      },
      checkArity: function () {
        return 0;
      },
      resolve: function () {}
    }));
  meta.addBuiltinKeySymbol(meta.metaSymbol);

  meta.quoteSymbol = new meta.Symbol('#quote', 'builtin',
    new meta.SymbolData(meta.arityUnary, 'ASSIGNMENT', {
      doNotExpandChildren: true,
      checkArity: function () {
        return 1;
      },
      resolve: function () {},
      codegenAsExpression: function (expr) {
        var obj = meta.codegenIdentifier(expr.loc, 'ast');
        var callee = meta.codegenMember(expr.loc, obj, 'fromJsonString');
        var quoted = expr.argAt(0).toJsonString();
        var parameters = [];
        parameters.push(meta.codegenLiteral(expr.loc, quoted));
        return meta.codegenCall(expr.loc, callee, parameters);
      }
    }));
  meta.addBuiltinKeySymbol(meta.quoteSymbol);


  meta.RESERVED.addAllKeysWithValue(constants.RESERVED);


  meta.Error = function (
      message,
      line, column, originalLine, originalColumn,
      originalSource, nestedErrors,
      lineTo, columnTo, originalLineTo, originalColumnTo) {
    if (typeof originalLine === 'undefined') originalLine = null;
    if (typeof originalColumn === 'undefined') originalColumn = null;
    if (typeof originalSource === 'undefined') originalSource = null;
    if (typeof nestedErrors === 'undefined') nestedErrors = [];
    if (typeof lineTo === 'undefined' || lineTo === null) lineTo = line;
    if (typeof columnTo === 'undefined' || columnTo === null) columnTo = column;
    if (typeof originalLineTo === 'undefined') originalLineTo = originalLine;
    if (typeof originalColumnTo === 'undefined') originalColumnTo =
      originalColumn === null ? originalColumn : originalColumn + 1;
    this.message = message;
    this.line = line;
    this.column = column;
    this.originalLine = originalLine;
    this.originalColumn = originalColumn;
    this.originalSource = originalSource;
    this.nestedErrors = nestedErrors;
    this.lineTo = lineTo;
    this.columnTo = columnTo;
    this.originalLineTo = originalLineTo;
    this.originalColumnTo = originalColumnTo;
  };
  meta.Error.prototype.locationToString = function (line, column, source) {
    if ((typeof source === 'undefined') || (source === null)) {
      return '[' + line + ',' + column + ']';
    } else {
      return '[' + line + ',' + column + ' "' + source + '"]';
    }
  };
  meta.Error.prototype.toString = function () {
    var result = 'error ';
    if (this.line !== null) {
      result += this.locationToString(this.line, this.column);
    }
    if (this.originalLine !== null) {
      result += ' (origin: ';
      result += this.locationToString(this.originalLine, this.originalColumn, this.originalSource);
      result += ')';
    }
    result += ': ';
    result += this.message;
    if (this.nestedErrors.length > 0) {
      result += " [";
      result += this.nestedErrors.join(", ");
      result += "]";
    }
    return result;
  };



  meta.Parser = function () {};

  meta.Parser.prototype.initialize = function (compiler, e) {
    this.compiler = compiler;
    this.Expr = e;
    this.reader = compiler.reader;
    if (!this.reader) {
      this.error('Invalid reader');
      this.reader = new StringReader('');
    }
    if (this.reader.error) {
      this.error(this.reader.error);
    }

    this.source = this.reader.name;
    this.currentLineNumber = 0;
    this.currentColumnNumber = 0;
    this.tokenInitialColumnNumber = 0;
    this.indentedBlockLastLine = 0;
    this.indentedBlockLastColumn = 0;
    this.currentBlock = null;
    this.root = this.openBlock('<block>');
    this.currentBlock = this.root;

    this.multilineStringIsLiterate = false;
    this.multilineStringContents = null;
    this.multilineStringTerminator = null;

    this.sourceText = compiler.options.sourceInMap ? '' : null;
  };

  function loadCoreMacros(compiler) {
    if (!compiler.options.skipCore) {
      try {
        return require('./core-macros.js');
      } catch (e) {
        compiler.error('Error loading core macros: ' + e.toString());
      }
    }
    return function() { return null; };
  };

  function Compiler(r, options) {
    if (!(this instanceof Compiler)) {
      return new Compiler(r, options);
    }

    this.reader = r;
    this.errors = [];
    this.root = null;

    var compiler = this;
    var parser = new meta.Parser(this, Expr);
    this.parser = parser;
    this.macroBasePath = '.';
    this.metaEnv = {};
    this.metaEnv.util = util;

    this.options = options || meta.copy(meta.Meta.options);
    if (typeof this.options.escodegen === 'undefined') {
      this.options.escodegen = {
         verbatim: 'x-verbatim'
      };
    }
    if (typeof this.options.source !== 'undefined') {
      if (typeof this.options.map !== 'undefined') {
        this.options.escodegen.sourceMap = this.options.source;
        this.options.escodegen.sourceMapWithCode = true;
        this.options.escodegen.sourceMapRoot = this.options.mapRoot || null;
      }
    }
    this.options.fullMacroErrors =
        (typeof this.options.fullMacroErrors !== 'undefined' && this.options.fullMacroErrors !== false);

    this.coreMacros = loadCoreMacros(this);

    this.virtualTags = new meta.ScopeMap();

    this.varRootScope = meta.VAR_ROOT_SCOPE.extend();
    this.keyRootScope = meta.KEY_ROOT_SCOPE.extend();

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
      if (typeof args !== 'undefined' && meta.isArray(args)) {
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
      this.origin = null;

      if (this.isBlock()) {
        this.block = {
          level: this.loc.start.column,
          expr: this
        };
      } else {
        this.block = null;
      }

      this.data = null;

      this.declarations = new meta.ScopeMap(
        this,
        function (expr) {
          return expr.declarations;
        },
        function () {
          return this.expr.canHostDeclarations();
        },
        null
      );
      this.keyScope = new meta.ScopeMap(
        this,
        function (expr) {
          return expr.keyScope;
        },
        function () {
          return this.expr.isBlock() || this.expr.opensNewScope();
        },
        meta.KEY_ROOT_SCOPE,
        function (key) {
          if (this.expr.sym.symbolData !== null && this.expr.sym.symbolData.subordinate !== null) {
            var subordinate = this.expr.sym.symbolData.subordinate;
            for (var i = 0; i < subordinate.length; i++) {
              if (subordinate[i].id === key) {
                return subordinate[i];
              }
            }
          }
          return null;
        },
        function () {
          return this.expr !== null && this.expr.sym.symbolData.capturesKeyScope;
        }
      );
      this.varScope = new meta.ScopeMap(
        this,
        function (expr) {
          return expr.varScope;
        },
        function () {
          return this.expr.opensNewScope();
        },
        meta.VAR_ROOT_SCOPE
      );

      this.isResolved = false;

      this.resultCount = 0;
      this.needsResultTemporary = false;
    };

    this.Expr = Expr;

    Expr.prototype.compiler = compiler;
    Expr.prototype.parser = parser;

    Expr.prototype.isBlock = function () {
      if (this.sym === null) return false;
      return this.parser.isBlock(this.sym.id);
    };

    Expr.prototype.canHostDeclarations = function () {
      return this.sym.symbolData.canHostDeclarations || this.parent === null;
    };
    Expr.prototype.opensNewScope = function () {
      return (this.sym.symbolData.opensNewScope && this.get('no-new-scope') !== true) ||
          this.parent === null;
    };

    Expr.prototype.toJsonObject = function () {
      var result = {
        id: this.sym.id,
        kind: this.sym.kind,
        val: this.val,
        loc: this.copyBestLoc(),
        args: []
      };
      for (var i = 0; i < this.argCount(); i++) {
        result.args.push(this.argAt(i).toJsonObject());
      }
      return result;
    };
    Expr.prototype.toJsonString = function () {
      return JSON.stringify(this.toJsonObject());
    };
    Expr.prototype.fromJsonObject = function (json, resolutionRoot, locationRoot, parent) {
      if (typeof resolutionRoot === 'undefined') resolutionRoot = this;
      if (typeof locationRoot === 'undefined') locationRoot = this;
      if (typeof parent === 'undefined') parent = null;
      var creationAst = resolutionRoot.creationAst();
      var sym;
      switch (json.kind) {
        case 'builtin':
          sym = meta.KEY_ROOT_SCOPE.get(json.id);
          if (sym === null) {
            this.error('Unrecognized builtin symbol in macro expansion: ' + json.id);
            return this.undefinedExpression();
          }
          break;
        case 'macro':
          sym = creationAst.getKeyInScope(json.id);
          if (sym === null && creationAst !== this) {
            sym = this.getKeyInScope(json.id);
          }
          if (sym === null) {
            this.error('Unrecognized macro symbol in macro expansion: ' + json.id);
            return this.undefinedExpression();
          }
          break;
        case 'value':
          sym = meta.valueSymbol;
          break;
        case 'tag':
          sym = meta.KEY_ROOT_SCOPE.get(json.id);
          if (sym === null) {
            this.error('Unrecognized tag symbol in macro expansion: ' + json.id);
            return this.undefinedExpression();
          }
          break;
        default:
          this.error('Invalid symbol kind in macro expansion: ' + json.kind);
          return this.undefinedExpression();
      }
      var result = new Expr(sym, json.val, [], parent);
      result.loc = this.copyLoc();
      result.origin = json.loc;
      for (var i = 0; i < json.args.length; i++) {
        this.fromJsonObject(json.args[i], resolutionRoot, locationRoot, result);
      }
      return result;
    };
    Expr.prototype.fromJsonString = function (jsonString, resolutionRoot, locationRoot, parent) {
      var json = JSON.parse(jsonString);
      var  result = this.fromJsonObject(json, resolutionRoot, locationRoot, parent);
      return result;
    };

    Expr.prototype.copyLoc = function () {
      if (this.loc !== null) {
        return {
          source: this.loc.source,
          start: {line: this.loc.start.line, column: this.loc.start.column},
          end: {line: this.loc.end.line, column: this.loc.end.column}
        };
      } else {
        return null;
      }
    };
    Expr.prototype.copyOrigin = function () {
      if (this.origin !== null) {
        return {
          source: this.origin.source,
          start: {line: this.origin.start.line, column: this.origin.start.column},
          end: {line: this.origin.end.line, column: this.origin.end.column}
        };
      } else {
        return null;
      }
    };
    Expr.prototype.bestLoc = function () {
      return this.origin !== null ? this.origin : this.loc;
    };
    Expr.prototype.copyBestLoc = function () {
      return this.origin !== null ? this.copyOrigin() : this.copyLoc();
    };

    Expr.prototype.undefinedExpression = function () {
      var json = {
        id: meta.tagSymbol.id,
        kind: 'tag',
        val: 'undefined',
        loc: this.copyLoc(),
        origin: this.copyOrigin(),
        args: []
      };
      return this.fromJsonObject(json, this, this, null);
    };

    Expr.prototype.disconnect = function () {
      if (this.parent) {
        this.parent.remove(this);
      }
    };
    Expr.prototype.push = function (arg) {
      if (meta.isArray(arg)) {
        for (var i = 0; i < arg.length; i++) {
          this.push(arg[i]);
        }
      } else {
        arg.disconnect();
        arg.parent = this;
        this.args.push(arg);
      }
    };
    Expr.prototype.unshift = function (arg) {
      if (meta.isArray(arg)) {
        for (var i = 0; i < arg.length; i++) {
          this.unshift(arg[i]);
        }
      } else {
        arg.disconnect();
        arg.parent = this;
        this.args.unshift(arg);
      }
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
    Expr.prototype.doEmpty = function () {
      while (this.argCount() > 0) {
        this.pop();
      }
    };

    Expr.prototype.indexOf = function (expr) {
      return this.args.indexOf(expr);
    };
    Expr.prototype.index = function () {
      if (this.parent !== null) {
        return this.parent.indexOf(this);
      } else {
        this.error('Cannot get index of expression with no parent');
        return -1;
      }
    };
    Expr.prototype.insertAt = function (index, expr) {
      expr.disconnect();
      expr.parent = this;
      return this.args.splice(index, 0, expr);
    };
    Expr.prototype.remove = function (index) {
      if (typeof index === 'undefined') {
        if (this.parent !== null) {
          this.parent.keyScope.absorb(this.keyScope);
          index = this.parent.args.indexOf(this);
          this.parent.args.splice(index, 1);
          this.parent = null;
          return this;
        } else {
          this.error('Remove requested to an expression without parent');
          return null;
        }
      } else {
        if (typeof index !== 'number') {
          index = this.args.indexOf(index);
          if (index < 0) { return null; }
        }
        var result = this.args[index];
        result.parent.keyScope.absorb(result.keyScope);
        result.parent = null;
        this.args.splice(index, 1);
        return result;
      }
    };
    Expr.prototype.replaceArg = function (argument, replacement) {
      var index = this.args.indexOf(argument);
      if (index < 0) {
        return null;
      } else {
        var removed = this.args[index];
        if (replacement !== removed) {
          replacement.disconnect();
          removed.parent = null;
          replacement.parent = this;
          this.args[index] = replacement;
        }
        return removed;
      }
    };
    Expr.prototype.replaceWith = function (replacement) {
      if (this.parent !== null) {
        return this.parent.replaceArg(this, replacement);
      } else {
        this.error('Replacement requested to an expression without parent');
        return null;
      }
    };
    Expr.prototype.setArgs = function (args) {
      this.doEmpty();
      this.push(args);
      return this;
    };
    Expr.prototype.forEach = function (f) {
      for (var i = 0; i < this.argCount(); i++) {
        f(this.argAt(i), i);
      }
      return this;
    };
    Expr.prototype.map = function (f) {
      var result = [];
      for (var i = 0; i < this.args.length; i++) {
        result.push(f(this.argAt(i)));
      }
      return result;
    };
    Expr.prototype.mapPair = function (other, f) {
      var result = [];
      for (var i = 0; i < this.argCount() && i < other.argCount(); i++) {
        result.push(f(this.argAt(i), other.argAt(i)));
      }
      return result;
    };
    Expr.prototype.filter = function (f) {
      var result = [];
      for (var i = 0; i < this.args.length; i++) {
        if (f(this.argAt(i))) {
          result.push(this.argAt(i));
        }
      }
      return result;
    };
    Expr.prototype.reduce = function (f, initial) {
      var index = 0;
      var result = undefined;

      if (typeof initial === undefined) {
        if (index < this.argCount()) {
          initial = this.argAt(index);
          index++;
        } else {
          result = undefined;
        }
      } else {
        result = initial;
      }

      while (index < this.argCount()) {
        result = f(result, this.argAt(index));
        index++;
      }

      return result;
    };

    Expr.prototype.forEachRecursive = function (f, includeThis, postOrder) {
      if (typeof includeThis === 'undefined') includeThis = false;
      if (typeof postOrder === 'undefined') postOrder = false;

      var result;
      if (includeThis && !postOrder) {
        result = f(this);
      }
      var i = 0;
      while (i < this.args.length) {
        i += this.argAt(i).forEachRecursive(f, true, postOrder);
      }
      if (includeThis && postOrder) {
        result = f(this);
      }
      if (typeof result !== 'number') result = 1;
      return result;
    };
    Expr.prototype.replaceTag = function (name, replacement) {
      this.forEachRecursive(function (expr) {
        if (expr.isTag() && expr.getTag() === name) {
          if (typeof replacement !== 'object') {
            expr.error('Invalid tag replacement');
            return 1;
          } else if (util.isArray(replacement)) {
            if (expr.parent !== null) {
              var parent = expr.parent;
              var exprIndex = parent.indexOf(expr);
              parent.remove(exprIndex);
              for (var i = 0; i < replacement.length; i++) {
                parent.insertAt(exprIndex + i, replacement[i].copy());
              }
              return replacement.length;
            } else {
              expr.error('Multiple replacement requested of a tag with no parent');
              return 1;
            }
          } else {
            var copy = replacement.copy();
            if (expr.parent !== null) {
              expr.parent.replaceArg(expr, copy);
            } else {
              expr.transformInto(copy);
            }
            return 1;
          }
        }
      }, true, true);
    };

    Expr.prototype.isReserved = function () {
      return meta.isReserved(this.sym.id);
    };
    Expr.prototype.isEmpty = function () {
      return this.args.length === 0;
    };
    Expr.prototype.doNotExpandChildren = function () {
      return this.sym !== null &&
          this.sym.symbolData !== null &&
          this.sym.symbolData.doNotExpandChildren;
    };
    Expr.prototype.isTag = function () {
      return this.sym.kind === 'tag';
    };
    Expr.prototype.isVirtualTag = function () {
      return this.sym === meta.vTagSymbol ||
          this.sym === meta.vTagDeclarationSymbol ||
          this.sym === meta.vcTagSymbol ||
          this.sym === meta.vcTagDeclarationSymbol;
    };
    Expr.prototype.isExternalTag = function () {
      return this.sym === meta.xTagSymbol ||
          this.sym === meta.xcTagSymbol;
    };
    Expr.prototype.isTagDeclaration = function () {
      return this.sym === meta.tagDeclarationSymbol ||
          this.sym === meta.cTagDeclarationSymbol ||
          this.sym === meta.vTagDeclarationSymbol ||
          this.sym === meta.vcTagDeclarationSymbol ||
          this.sym === meta.argumentSymbol;
    };
    Expr.prototype.isTagAndNeedsDeclaration = function () {
      return this.sym === meta.tagDeclarationSymbol ||
          this.sym === meta.cTagDeclarationSymbol ||
          this.sym === meta.vTagDeclarationSymbol ||
          this.sym === meta.vcTagDeclarationSymbol;
    };
    Expr.prototype.isConstantTag = function () {
      return this.sym === meta.cTagSymbol ||
          this.sym === meta.cTagDeclarationSymbol ||
          this.sym === meta.vcTagSymbol ||
          this.sym === meta.vcTagDeclarationSymbol;
    };
    Expr.prototype.isName = function () {
      return this.sym === meta.nameSymbol;
    };
    Expr.prototype.isFunctionArgument = function () {
      return this.sym === meta.argumentSymbol;
    };
    Expr.prototype.isValue = function () {
      return this.sym.kind === 'value';
    };
    Expr.prototype.isString = function () {
      return this.isValue() && typeof this.val === 'string';
    };
    Expr.prototype.isNumber = function () {
      return this.isValue() && typeof this.val === 'number';
    };
    Expr.prototype.isBoolean = function () {
      return this.isValue() && typeof this.val === 'boolean';
    };
    Expr.prototype.resolvedVal = function () {
      if (this.isVirtualTag()) {
        if (this.val === null) {
          return null;
        } else if (this.isResolved) {
          return this.compiler.virtualTags.get(this.val);
        } else {
          return this.val;
        }
      } else {
        return this.val;
      }
      return this.sym.kind === 'value';
    };
    Expr.prototype.isPlaceholder = function () {
      return this.sym.id === '<placeholder>';
    };
    Expr.prototype.isTuple = function () {
      return this.sym.id === '<tuple>';
    };
    Expr.prototype.isObject = function () {
      return this.sym.id === '<object>';
    };
    Expr.prototype.isArray = function () {
      return this.sym.id === '<array>';
    };
    Expr.prototype.isDo = function () {
      return this.sym.id === '<do>';
    };
    Expr.prototype.isCall = function () {
      return this.sym.id === '<call>';
    };
    Expr.prototype.isFunctionDefinition = function () {
      return this.sym === meta.functionSymbol;
    };
    Expr.prototype.isElement = function () {
      return this.sym.id === '<element>';
    };
    Expr.prototype.isMember = function () {
      return this.sym.id === '.';
    };
    Expr.prototype.isProperty = function () {
      return this.sym.id === ':';
    };
    Expr.prototype.isQuoteTag = function () {
      return this.sym.id === '\\';
    };
    Expr.prototype.isJumpStatement = function () {
      return this.sym.symbolData.isJumpStatement;
    };
    Expr.prototype.isIgnored = function () {
      return this.sym.kind === 'ignored';
    };
    Object.defineProperty(Expr.prototype, 'id', {
      get: function () { return this.sym.id; }
    });
    Expr.prototype.getValue = function () {
      if (this.isValue() || this.isPlaceholder()) {
        return this.val;
      } else {
        return undefined;
      }
    };
    Expr.prototype.getTag = function () {
      if (this.isTag()) {
        return this.resolvedVal();
      } else {
        return undefined;
      }
    };
    Expr.prototype.getSimpleValue = function () {
      if (this.isValue() || this.isPlaceholder()) {
        return this.getValue();
      } else if (this.isTag()) {
        return this.getTag();
      } else {
        return null;
      }
    };
    Expr.prototype.getObjectValue = function (transformation) {
      if (typeof transformation === 'undefined') {
        transformation = function(v) {return v;};
      }
      var result = {};
      var ok = true;
      if (this.isObject()) {
        for (var i = 0; i < this.count; i++) {
          var child = this.at(i);
          if (child.isProperty()) {
            var key = child.at(0).getSimpleValue();
            if (key !== null) {
              result[key] = transformation(child.at(1));
            } else {
              child.at(0).error('Invalid property key');
              ok = false;
            }
          } else {
            child.error('Property definition expected');
            ok = false;
          }
        }
      } else {
        this.error('Object definition expected');
        ok = false;
      }
      return ok ? result : null;
    };
    Expr.prototype.getArrayValue = function (transformation) {
      if (typeof transformation === 'undefined') {
        transformation = function(v) {return v;};
      }
      if (this.isArray()) {
        var result = [];
        for (var i = 0; i < this.count; i++) {
          result.push(transformation(this.at(i)));
        }
        return result;
      } else {
        this.error('Array definition expected');
        null;
      }
    };
    Expr.prototype.getLiteralValue = function () {
      var transformation = function(v) {
        if (v.isObject()) {
          return v.getObjectValue(transformation);
        } else if (v.isArray()) {
          return v.getArrayValue(transformation);
        } else if (v.isFunctionDefinition()) {
          return v.asFunctionLiteral();
        } else {
          var value = v.getSimpleValue();
          if (value === null) {
            this.error('Invalid value');
          }
          return value;
        }
      };
      var result = transformation(this);
      return (this.compiler.errors.length > 0) ? null : result;
    };
    Expr.prototype.getPropertyValue = function () {
      if (this.isProperty()) {
        var key = this.at(0).getSimpleValue();
        if (key !== null) {
          return {
            key: key,
            value: this.at(1).getLiteralValue()
          };
        } else {
          child.at(0).error('Invalid property key');
          ok = false;
        }
      } else {
        this.error('Expected property definition');
        return null;
      }
    };
    Expr.prototype.set = function (key, value) {
      if (this.data === null) {
        this.data = new Object(null);
      }
      this.data[key] = value;
    };
    Expr.prototype.get = function (key) {
      if (this.data === null) {
        return undefined;
      } else {
        return this.data[key];
      }
    };

    Expr.prototype.handleTag = function (transformation) {
      if (this.isTuple()) {
        for (var i = 0; i < this.argCount(); i++) {
          this.argAt(i).handleTag(transformation);
        }
      } else if (this.isQuoteTag()) {
        this.argAt(0).handleTag(transformation);
      } else if (this.id === '=') {
        this.argAt(0).handleTag(transformation);
      } else if (this.isTag()) {
        transformation(this);
      }
      return this;
    };

    Expr.prototype.fixTagKind = function () {
      this.sym.symbolData.fixTagKind(this);
    };
    Expr.prototype.handleAsTag = function () {
      return this.handleTag(function () {});
    };
    Expr.prototype.handleAsConstantTag = function () {
      return this.handleTag(function (tag) {
        var newSymbol = tag.sym.symbolData.toConstantTag;
        if (newSymbol === null) {
          tag.error('Cannot handle tag as constant');
        } else {
          tag.sym = newSymbol;
        }
      });
    };
    Expr.prototype.copyToConstantTag = function () {
      return this.copy().handleAsConstantTag();
    };
    Expr.prototype.handleAsVirtualTag = function () {
      return this.handleTag(function (tag) {
        var newSymbol = tag.sym.symbolData.toVirtualTag;
        if (newSymbol === null) {
          tag.error('Cannot handle tag as virtual');
        } else {
          tag.sym = newSymbol;
        }
      });
    };
    Expr.prototype.copyToVirtualTag = function () {
      return this.copy().handleAsVirtualTag();
    };
    Expr.prototype.handleAsTagDeclaration = function () {
      return this.handleTag(function (tag) {
        var newSymbol = tag.sym.symbolData.toTagDeclaration;
        if (newSymbol === null) {
          tag.error('Cannot handle tag as declaration');
        } else {
          tag.sym = newSymbol;
        }
      });
    };
    Expr.prototype.copyToTagDeclaration = function () {
      return this.copy().handleAsTagDeclaration();
    };
    Expr.prototype.handleAsTagUse = function () {
      return this.handleTag(function (tag) {
        var newSymbol = tag.sym.symbolData.toTagUse;
        if (newSymbol === null) {
          tag.error('Cannot handle tag as use');
        } else {
          tag.sym = newSymbol;
        }
      });
    };
    Expr.prototype.copyToTagUse = function () {
      return this.copy().handleAsTagUse();
    };
    Expr.prototype.handleAsExternalTag = function () {
      return this.handleTag(function (tag) {
        var newSymbol = tag.sym.symbolData.toExternalTag;
        if (newSymbol === null) {
          tag.error('Cannot handle tag as external');
        } else {
          tag.sym = newSymbol;
        }
      });
    };
    Expr.prototype.copyToExternalTag = function () {
      return this.copy().handleAsExternalTag();
    };
    Expr.prototype.handleAsFunctionArgument = function () {
      return this.handleTag(function (tag) {
        tag.sym = meta.argumentSymbol;
      });
    };
    Expr.prototype.copyToFunctionArgument = function () {
      return this.copy().handleAsFunctionArgument();
    };

    Expr.prototype.asTuple = function () {
      var result = this;
      if (!this.isTuple()) {
        if (this.parent !== null) {
          var parent = this.parent;
          var index = this.index();
          result = this.newTuple(this);
          parent.insertAt(index, result);
        } else {
          result = this.newTuple(this);
        }
      }
      return result;
    };

    Expr.prototype.takeLocationFrom = function (other) {
      this.loc = other.loc === null ? null : {
        source: other.loc.source,
        start: {line: other.loc.start.line, column: other.loc.start.column},
        end: {line: other.loc.end.line, column: other.loc.end.column}
      };
      this.origin = other.origin === null ? null : {
        source: other.origin.source,
        start: {line: other.origin.start.line, column: other.origin.start.column},
        end: {line: other.origin.end.line, column: other.origin.end.column}
      };
    };
    Expr.prototype.mergeLoc = function (otherExpr) {
      if (this.loc.start.line >= otherExpr.loc.start.line) {
        this.loc.start.line = otherExpr.loc.start.line;
        if (this.loc.start.column >= otherExpr.loc.start.column) {
          this.loc.start.column = otherExpr.loc.start.column;
        }
      }
      if (this.loc.end.line <= otherExpr.loc.end.line) {
        this.loc.end.line = otherExpr.loc.end.line;
        if (this.loc.end.column <= otherExpr.loc.end.column) {
          this.loc.end.column = otherExpr.loc.end.column;
        }
      }
    };
    Expr.prototype.newAtThisLocation = function (sym) {
      if (typeof sym === 'string') {
        var symbol = this.keyScope.get(sym);
        if (symbol === null) {
          this.error('Unknown symbol ' + sym);
          sym = meta.placeholderSymbol;
        } else {
          sym = symbol;
        }
      } else if (typeof sym === 'undefined') {
        sym = this.sym;
      }
      var result = new Expr(sym, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newTag = function (value) {
      var result = new Expr(meta.tagSymbol, value.toString(), [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newVirtualTag = function (value) {
      var result = new Expr(meta.vTagSymbol, value.toString(), [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newValue = function (value) {
      switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
          break;
        default:
          value = value.toString();
          this.error('Value should be a primitive: ' + value);
      }
      var result = new Expr(meta.valueSymbol, value, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newPlaceholder = function (value) {
      var result = new Expr(meta.placeholderSymbol, value, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newTuple = function (args) {
      var result = new Expr(meta.tupleSymbol, null, [], null);
      result.takeLocationFrom(this);
      if (typeof args !== 'undefined') {
        result.push(args);
      }
      return result;
    };
    Expr.prototype.newDo = function (args) {
      var result = new Expr(meta.doSymbol, null, [], null);
      result.takeLocationFrom(this);
      if (typeof args !== 'undefined') {
        result.push(args);
      }
      return result;
    };
    Expr.prototype.newObjectLiteral = function () {
      var objectSymbol = this.keyScope.get('<object>');
      var result = new Expr(objectSymbol, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newArrayLiteral = function () {
      var result = new Expr(meta.arraySymbol, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newCall = function () {
      var result = new Expr(meta.callSymbol, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newImplicit = function () {
      var result = new Expr(meta.implicitSymbol, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newFunction = function () {
      var result = new Expr(meta.functionSymbol, null, [], null);
      result.takeLocationFrom(this);
      return result;
    };
    Expr.prototype.newMeta = function (ast) {
      var result = new Expr(meta.metaSymbol, null, [], null);
      result.takeLocationFrom(this);
      result.push(ast);
      return result;
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
    Expr.prototype.leftPrecedence = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol left precedence');
        return meta.PRECEDENCES.get('NONE');
      }
      var result = meta.PRECEDENCES.get(this.sym.symbolData.leftPrecedence);
      if (typeof result === 'undefined') {
        this.error('Undefined symbol left precedence');
        return meta.PRECEDENCES.get('NONE');
      }
      return result;
    };
    Expr.prototype.isRightAssociative = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol associativity');
        return 0;
      } else {
        return this.sym.symbolData.arity.isRightAssociative;
      }
    };

    Expr.prototype.dependent = function () {
      if (this.sym === null || this.sym.symbolData === null) {
        this.error('Cannot compute symbol dependency');
        return null;
      } else {
        return this.sym.symbolData.dependent;
      }
    };
    Expr.prototype.canAcceptDependency = function (other) {
      if (this.dependent() === null) {
        return false;
      } else {
        var dependent = this.dependent();
        for (var i = 0; i < dependent.length; i++) {
          if (dependent[i] === other.sym.id) {
            return true;
          }
        }
        return false;
      }
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
        current.sym.symbolData.fixDependent(current);
      }
      this.turnIntoTuple();
    };

    Expr.prototype.resolveInParentKeyScope = function (name) {
      var scope = this.parent !== null ? this.parent.keyScope : this.compiler.keyRootScope;
      return scope.get(name);
    };

    Expr.prototype.setupDeclaration = function (makeAssignable, skipDeclaration) {
      if (typeof makeAssignable === 'undefined') makeAssignable = true;
      if (typeof skipDeclaration === 'undefined') skipDeclaration = false;
      if (!this.isTag()) {
        this.error('Expected identifier');
        return;
      } else if (!makeAssignable) {
        this.sym = meta.cTagSymbol;
      }

      var name = this.val;
      if (meta.isReserved(name)) {
        this.error('Reserved identifier \"' + name + '\"');
      } else if (this.varScope.has(name)) {
        redeclaredIdentifier('identifier', name, this, this.varScope.get(name));
      } else {
        var declaration = meta.newDeclaration(this);
        this.varScope.set(name, declaration);
        if (!skipDeclaration) {
          this.declarations.set(name, declaration);
        }
      }
    };
    Expr.prototype.processDeclarations = function (makeAssignable, skipDeclaration) {
      if (typeof makeAssignable === 'undefined') makeAssignable = true;
      if (this.sym === meta.tupleSymbol) {
        for (var i = 0; i < this.args.length; i++) {
          this.args[i].setupDeclaration(makeAssignable, skipDeclaration);
        }
      } else {
        this.setupDeclaration(makeAssignable, skipDeclaration);
      }
    };

    Expr.prototype.createCodegenTemporary = function (basename) {
      var declaration = meta.newAssignableDeclaration('tmp');
      var name = this.declarations.newUniqueKey(declaration, basename);
      declaration.name = name;
      this.declarations.set(name, declaration);
      return name;
    };
    Expr.prototype.createResultVariables = function (count) {
      var result = [];
      for (var i = 0; i < count; i++) {
        result.push(this.createCodegenTemporary());
      }
      return result;
    };

    Expr.prototype.createJumpLabel = function () {
      var declaration = meta.newReadonlyDeclaration('tmp');
      var name = this.declarations.newUniqueKey(declaration);
      declaration.name = name;
      return name;
    };

    Expr.prototype.createError = function (message, nestedErrors) {
      return new meta.Error(
        message, this.loc.start.line, this.loc.start.column,
        this.origin !== null ? this.origin.start.line : null,
        this.origin !== null ? this.origin.start.column : null,
        this.origin !== null ? this.origin.source : null,
        nestedErrors,
        this.loc.end ? this.loc.end.line : null,
        this.loc.end ? this.loc.end.column : null,
        (this.origin !== null && this.origin.end) ? this.origin.end.line : null,
        (this.origin !== null && this.origin.end) ? this.origin.end.column : null
      );
    };

    Expr.prototype.error = function (message, nestedErrors) {
      compiler.errors.push(this.createError(message, nestedErrors));
    };

    Expr.prototype.getKeyInScope = function (key) {
      return this.keyScope.get(key);
    };

    Expr.prototype.canTakeMoreOperands = function () {
      return this.sym.symbolData.arity.maxOperandCount > this.args.length;
    };
    Expr.prototype.needsMoreOperands = function () {
      return this.canTakeMoreOperands() &&
          this.sym.symbolData.arity.minOperandCount > this.args.length;
    };
    Expr.prototype.canTakeLeftOperand = function () {
      return this.canTakeMoreOperands() &&
          this.sym.symbolData.arity.canHaveLeft;
    };
    Expr.prototype.needsLeftOperand = function () {
      return this.needsMoreOperands() && this.sym.symbolData.arity.needsLeft;
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

    Expr.prototype.absorbScope = function (other) {
      this.declarations.absorb(other.declarations);
      this.keyScope.absorb(other.keyScope);
      this.varScope.absorb(other.varScope);
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
      this.mergeLoc(replacement);

      this.isResolved = replacement.isResolved;
    };

    Expr.prototype.turnIntoTuple = function () {
      if (this.sym === meta.doSymbol) {
        return;
      } else if (this.args.length === 1 && this.args[0].sym.id !== '<array>') {
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

      if ((next.isTag() && !next.isName()) || next.isPlaceholder()) {
        var dependent = this.keyScope.get(next.val);
        if (dependent !== null) {
          next.sym = dependent;
        }
      }

      var extension = this.contextExtensionThatTakesRightOperand(context, next);
      if (this.canTakeRightOperand()) {
        if (next.needsLeftOperand()) {
          next.push(next.newPlaceholder());
        }
        this.push(next);
        context.precedence = this.precedence();
        this.handleExtended(context);
      } else if (next.canTakeLeftOperand()) {
        var rightPrecedence = next.leftPrecedence();
        var leftPrecedence = context.precedence;
        var leftCandidate = this;
        var currentCandidate = this;
        while (leftCandidate !== null) {
          if (leftPrecedence > rightPrecedence ||
              (leftPrecedence === rightPrecedence &&
              next.isRightAssociative())) {
            break;
          } else {
            currentCandidate = leftCandidate;
            leftCandidate = leftCandidate.parent;
            if (leftCandidate !== null) {
              leftPrecedence = leftCandidate.precedence();
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
      } else if (extension !== null) {
        extension.current.push(next);
        context.precedence = extension.current.precedence();
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
          if (next && next.get('had-parens')) {
            call = this.newCall();
          } else {
            call = this.newImplicit();
          }
        }
        call.takeLocationFrom(next);

        var candidateCaller = this;
        var nextCandidateCaller = this;
        var candidatePrecedence = context.precedence;
        while (nextCandidateCaller !== null) {
          if (candidatePrecedence < call.precedence() || (
                candidatePrecedence === call.precedence() &&
                // Go to parent if it's right assoc or was originally wrapped in parens
                // Solves the use case: a(b c)(d)
                (!candidateCaller.isRightAssociative() || candidateCaller.get('had-parens'))
          )) {
            nextCandidateCaller = nextCandidateCaller.parent;
            if (nextCandidateCaller !== null) {
              candidatePrecedence = nextCandidateCaller.precedence();
              if (candidatePrecedence > call.precedence() || (
                    candidatePrecedence === call.precedence() &&
                    nextCandidateCaller.isRightAssociative() &&
                    !candidateCaller.get('had-parens')
              )) {
                break;
              }
              candidateCaller = nextCandidateCaller;
            }
          } else {
            break;
          }
        }

        if (candidateCaller.parent !== null) {
          candidateCaller.replaceWith(call);
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

    Expr.prototype.combineArguments = function (resultReceiver) {
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
        current.push(current.newPlaceholder());
      }
      for (i = 1; i < args.length; i++) {
        next = args[i];
        next.parent = null;

        next = current.combineOperands(context, previous, next);

        previous = current;
        current = next;
      }

      while (current.needsMoreOperands()) {
        current.push(current.newPlaceholder());
      }

      var combined = current;
      while (combined.parent !== null) {
        combined = combined.parent;
      }

      if (this.parent !== null && this.sym.id !== '<do>') {
        this.parent.replaceArg(this, combined);
      } else {
        this.push(combined);
      }

      combined.postCombine(resultReceiver);
    };

    Expr.prototype.combine = function (nameExpected, resultReceiver) {
      if (typeof nameExpected === undefined) nameExpected = false;

      var finalExpr = this;
      if (this.sym.isToken()) {
        if (this.sym.kind === 'token') {
          var resolved = null;
          if (nameExpected && this.sym.id === '<id>') {
            resolved = meta.nameSymbol;
            this.val = meta.normalizeTag(this.val);
          }
          if (resolved === null) {
            resolved = this.resolveInParentKeyScope(this.val);
          }
          if (resolved !== null) {
            this.sym = resolved;
          } else {
            if (this.sym.id === '<id>') {
              this.sym = meta.tagSymbol;
            } else {
              if (this.sym.id !== '<op>') {
                this.error('Unrecognized symbol "' + this.val + '" of kind \"' + this.sym.id + '\"');
              }
              this.sym = meta.placeholderSymbol;
            }
          }
        } else if (this.sym.kind === 'value') {
          this.sym = meta.valueSymbol;
        } else {
          this.error('Invalid token kind "' + this.sym.kind + '"" in keyword resolution phase');
        }
        if (!this.isEmpty()) {
          this.error('Token should not have arguments');
        }

        this.preCombine(function (expr) { finalExpr = expr; });
      } else if (this.sym.isBlock()) {
        var nextIsName = false;

        for (var i = 0; i < this.argCount(); i++) {
          // Remove CST nodes
          if (this.at(i).isIgnored()) {
            this.remove(i--);
            continue;
          }

          var currentArgCount = this.argCount();
          this.argAt(i).combine(nextIsName);

          if (currentArgCount !== this.argCount()) i--;

          if (i >= 0 && this.argAt(i).id === '.') {
            nextIsName = true;
          } else {
            nextIsName = false;
          }
        }
        this.sym.blockData.combine(this, function (expr) { finalExpr = expr; });
        if (finalExpr.sym.id === '<do>') {
          if (finalExpr.args.length === 1 && finalExpr.args[0].sym === meta.tupleSymbol) {
            finalExpr.transformInto(finalExpr.args[0]);
          }
          finalExpr.sym = meta.doSymbol;
        }
      } else {
        this.error('Invalid symbol kind "' + this.sym.kind + '"" in keyword resolution phase');
      }
    };

    Expr.prototype.applyCoreMacros = function () {
      this.compiler.coreMacros(this);
    };

    Expr.prototype.resolveAllArguments = function (vTagMap) {
      for (var i = 0; i < this.args.length; i++) {
        this.args[i].resolve(vTagMap);
      }
    };
    Expr.prototype.resolveVirtual = function () {
      var vTagMap = new meta.ScopeMap();
      this.resolve(vTagMap);
      return this;
    };
    Expr.prototype.resolve = function (vTagMap) {
      if (typeof vTagMap === 'undefined') vTagMap = null;
      if (vTagMap !== null &&
          this.sym.symbolData.opensNewScope &&
          (this.parent == null || this.parent.id !== '#no-new-scope')) {
        vTagMap = vTagMap.extend();
      }
      this.sym.symbolData.resolve(this, vTagMap);
    };

    Expr.prototype.defineSymbol = function (expr) {
      this.keyScope.set(expr.id, expr);
    };
    Expr.prototype.overrideSymbol = function (expr) {
      if (this.keyScope.has(expr.id)) {
        this.keyScope.set(expr.id, expr);
      } else {
        this.error('Cannot override undefined symbol ' + expr.id);
      }
    };

    Expr.prototype.toSimpleString = function () {
      if (meta.SymbolDescriptionNeedsValue[this.sym.kind]) {
        return this.resolvedVal();
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

    Expr.prototype.toString = function () {
      return util.format('sym "%s", val "%s", loc %d:%d [%s]',
                         this.sym.id, this.val, this.loc.start.line, this.loc.start.column, this.loc.source);
    };

    Expr.prototype.argCount = function () {
      return this.count;
    };
    Expr.prototype.argAt = function (index) {
      return this.at(index);
    };

    Object.defineProperty(Expr.prototype, 'count', {
      get: function () { return this.args.length; }
    });
    Expr.prototype.at = function (index) {
      if (index < 0) index += this.args.length;
      return this.args[index];
    };

    Expr.prototype.copy = function () {
      var result = new Expr(this.sym, this.val, [], null);
      result.takeLocationFrom(this);
      result.isResolved = this.isResolved;
      for (var i = 0; i < this.argCount(); i++) {
        result.push(this.argAt(i).copy());
      }
      if (this.data != null) {
        result.data = meta.copy(this.data);
      }
      return result;
    };
    Expr.prototype.findAll = function (condition, result) {
      if (typeof result === 'undefined') result = [];
      if (condition(this)) result.push(this);
      for (var i = 0; i < this.argCount(); i++) {
        this.argAt(i).find(condition, result);
      }
      return result;
    };
    Expr.prototype.findOne = function (condition, message) {
      var results = this.findAll(condition);
      if (results.length === 0) {
        return null;
      } else if (results.length === 1) {
        return results[0];
      } else {
        this.error('More then one found: ' + message);
        return results[0];
      }
    };
    Expr.prototype.findParent = function (condition) {
      var parent = this.parent;
      while (parent !== null) {
        if (condition(parent)) return parent;
        parent = parent.parent
      }
      return null;
    };

    Expr.prototype.isAssignable = function () {
      return this.sym.symbolData.isAssignable;
    };
    Expr.prototype.getAssignable = function () {
      switch (this.id) {
        case 'var':
        case 'const':
        case 'let':
          return this.argAt(0).getAssignable();
        default:
          if (this.isAssignable()) {
            return this;
          } else {
            return null;
          }
      }
    };

    Expr.prototype.checkAssignability = function (allowTuples, allowAssignments) {
      if (typeof allowTuples === 'undefined') allowTuples = false;
      if (typeof allowAssignments === 'undefined') allowAssignments = false;
      if (this.sym === meta.tupleSymbol) {
        if (! allowTuples) {
          this.error('Multiple values are not allowed in this context');
        }
        for (var i = 0; i < this.argCount(); i++) {
          if (!this.argAt(i).checkAssignability(false, allowAssignments)) {
            this.argAt(i).error('Expression is not assignable');
          }
        }
        this.resultCount = this.argCount();
      } else {
        var toCheck = this;
        if (allowAssignments && this.sym.id === '=') {
          toCheck = this.argAt(0);
          toCheck.checkArity(1, -1, -1);
          this.argAt(1).checkArity(1, -1, -1);
        }
        if (!toCheck.isAssignable()) {
          toCheck.error('Expression is not assignable');
        }
        this.resultCount = 1;
      }
      return this.resultCount;
    };

    Expr.prototype.detectPlaceholders = function () {
      this.forEachRecursive(function (expr) {
        if (expr.isPlaceholder()) {
          if (expr.getSimpleValue() === null) {
            if (expr.parent.isProperty()) {
              expr.error('Missing property value');
              return;
            } else if (expr.parent.sym.id.indexOf('=') !== -1) {
              expr.error('Missing assignment operand');
              return;
            }
          }
          expr.error('Unrecognized symbol ' + expr.getSimpleValue());
        }
      }, true);
    };

    Expr.prototype.checkArity = function (expectedResultCount, endArity, loopArity) {
      if (typeof expectedResultCount === 'undefined') expectedResultCount = 0;
      if (typeof endArity === 'undefined') endArity = -1;
      if (typeof loopArity === 'undefined') loopArity = -1;
      this.resultCount = expectedResultCount;

      if (!this.sym.symbolData.arity.isSequence) {
        if (this.argCount() < this.sym.symbolData.arity.minOperandCount) {
          this.error('Expected at least ' +
              this.sym.symbolData.arity.minOperandCount + ' operands');
        }
        if (this.argCount() > this.sym.symbolData.arity.maxOperandCountWithDependencies) {
          var max = this.sym.symbolData.arity.maxOperandCountWithDependencies;
          var actualArgCount = this.argCount();
          for (var i = max; i < this.argCount(); i++) {
            if (this.canAcceptDependency(this.argAt(i))) {
              actualArgCount--;
            }
          }
          if (actualArgCount > max) {
            this.error('Expected at most ' + max + ' operands');
          }
        }
      }

      var actualResultCount = this.sym.symbolData.checkArity(
          this, expectedResultCount, endArity, loopArity);

      if (expectedResultCount > 0 &&
          actualResultCount !== expectedResultCount &&
          !this.isJumpStatement()) {
        if (actualResultCount === 0) {
          this.error('Void expression used where a value is required');
        } else {
          if (expectedResultCount === 1) {
            this.error('Expression should produce a single value');
          } else {
            this.error('Expression should produce ' + expectedResultCount + ' values');
          }
        }
      }

      return actualResultCount;
    };
    Expr.prototype.checkArgsArity = function (needsResult, endArity, loopArity) {
      var argsNeedTemporary = false;
      var i;
      var arg;
      for (i = 0; i < this.argCount(); i++) {
        arg = this.argAt(i);
        arg.checkArity(needsResult ? 1 : 0, endArity, loopArity);
        if (arg.needsResultTemporary) {
          argsNeedTemporary = true;
        }
      }
      if (needsResult && argsNeedTemporary) {
        for (i = 0; i < this.argCount(); i++) {
          arg = this.argAt(i);
          if (arg.resultCount !== 1) {
            arg.error('Argument should produce a single result');
          }
          this.argAt(i).needsResultTemporary = true;
        }
      }
    };

    Expr.prototype.createJumpTmp = function (context, tmp) {
      var jumpTmp;
      if (this.resultCount === 0) {
        if (tmp !== null) {
          this.error('Expected no result');
        }
        jumpTmp = [];
      } else if (this.resultCount === 1) {
        if (tmp === null) {
          this.error('Expected one result');
        }
        jumpTmp = [tmp];
      } else {
        if (tmp !== null) {
          this.error('Expected a multiple result request');
        }
        jumpTmp = context.tupleTmp;
        if (jumpTmp.length !== this.resultCount) {
          this.error('Expected' + this.resultCount + ' results');
        }
      }
      return jumpTmp;
    };

    Expr.prototype.codegenAssignArgsToTemps = function (context, temps) {
      if (this.isTuple()) {
        if (temps.length !== this.argCount()) {
          this.error('Tuple argument count mismatch');
          return;
        }
        for (var i = 0; i < temps.length; i++) {
          var argExpr = this.argAt(i).codegenAsExpression(context);
          var argDest = meta.codegenIdentifier(this.argAt(i).loc, temps[i]);
          var statement = meta.codegenAssignmentStatement(this.argAt(i).loc, '=', argDest, argExpr);
          context.block.push(statement);
        }
      } else if (this.isDo() && this.resultCount === 0) {
        this.codegenAsStatement(context);
      } else {
        if (temps.length !== 1) {
          this.error('Expected one temporary instead of ' + temps.length);
          return;
        }
        var r = this.codegenAsExpression(context);
        var l = meta.codegenIdentifier(this.loc, temps[0]);
        var a = meta.codegenAssignmentStatement(this.loc, '=', l, r);
        context.block.push(a);
      }
    };
    Expr.prototype.codegenEmitAssignments = function (context) {
      if (this.sym === meta.tupleSymbol) {
        for (var i = 0; i < this.argCount(); i++) {
          var arg = this.argAt(i);
          if (arg.sym.id === '=') {
            var valExpr = arg.argAt(1).codegenAsExpression(context);
            var destExpr = arg.argAt(0).codegenAsExpression(context);
            meta.pushAssignment(context.block, arg.loc, destExpr, valExpr);
          }
        }
      } else {
        if (this.sym.id === '=') {
          var vExpr = this.argAt(1).codegenAsExpression(context);
          var dExpr = this.argAt(0).codegenAsExpression(context);
          meta.pushAssignment(context.block, this.loc, dExpr, vExpr);
        }
      }
    };
    Expr.prototype.codegenParallelAssignments = function (context, values, handleAssignments) {
      if (typeof handleAssignments === 'undefined') handleAssignments = false;
      if (this.sym === meta.tupleSymbol) {
        if (values.sym !== meta.tupleSymbol) {
          values.error('Multiple values expected');
          return;
        }
        if (values.argCount() !== this.argCount()) {
          this.error('Value count mismatch');
          return;
        }
        for (var i = 0; i < values.argCount(); i++) {
          var valueExpr = values.argAt(i).codegenAsExpression(context);
          var dest = this.argAt(i);
          if (handleAssignments && dest.sym.id === '=') {
            dest = dest.argAt(0);
          }
          var destExpr = dest.codegenAsExpression(context);
          var statement = meta.codegenAssignmentStatement(
              values.argAt(i).loc, '=', destExpr, valueExpr);
          context.block.push(statement);
        }
      } else {
        if (values.sym === meta.tupleSymbol) {
          values.error('Single value expected');
          return;
        }
        var vExpr = values.codegenAsExpression(context);
        var d = this;
        if (handleAssignments && d.sym.id === '=') {
          d = d.argAt(0);
        }
        var dExpr = d.codegenAsExpression(context);
        var s = meta.codegenAssignmentStatement(values.loc, '=', dExpr, vExpr);
        context.block.push(s);
      }
    };

    Expr.prototype.codegenAddDeclarations = function (block) {
      if (! this.declarations.empty) {
        var declarations = [];
        this.declarations.forEach(function (k, d) {
          declarations.push(meta.codegenVariableDeclarator(this.loc, d.name));
        });
        var statement = meta.codegenVariableDeclarations(this.loc, declarations);
        block.unshift(statement);
      }
    };
    Expr.prototype.codegenAsExpression = function (context) {
      if (this.resultCount !== 1) {
        this.error('Expression should produce a single result');
      }
      if (this.needsResultTemporary) {
        var resultTemporary = this.createCodegenTemporary();
        this.sym.symbolData.codegenToTemporary(this, context, resultTemporary);
        return meta.codegenIdentifier(this.loc, resultTemporary);
      } else {
        return this.sym.symbolData.codegenAsExpression(this, context);
      }
    };
    Expr.prototype.codegenAsStatement = function (context) {
      if (this.resultCount !== 0) {
        this.error('Expression should not produce a result');
      }
      if (this.sym.symbolData.hasCodegenToTemporary) {
        this.sym.symbolData.codegenToTemporary(this, context, null);
      } else if (this.compiler.options.emitIdentifierStatements || !this.isTag()) {
        var expression = this.sym.symbolData.codegenAsExpression(this, context);
        var statement = meta.codegenExpressionStatement(this.loc, expression);
        context.block.push(statement);
      }
    };
    Expr.prototype.codegenToTemporary = function (context, tmp) {
      if (tmp !== null) {
        if (this.resultCount !== 1) {
          this.error('One result expected');
        }
      } else {
        if (context.tupleTmp !== null) {
          if (context.tupleTmp.length !== this.resultCount) {
            this.error('Tuple context does not match expected result count ' + this.resultCount);
          }
        }
      }
      this.sym.symbolData.codegenToTemporary(this, context, tmp);
    };


    Expr.prototype.asFunctionBody = function (args) {
      var bodyExpr = this.copy();

      if ((bodyExpr.isTuple() && bodyExpr.argCount() > 0)) {
        bodyExpr.sym = meta.doSymbol;
      }
      var expandedBodyExpr;
      bodyExpr.expand(function (result) { expandedBodyExpr = result; });
      if (typeof expandedBodyExpr === 'object') {
        if (expandedBodyExpr !== null) {
          bodyExpr = expandedBodyExpr;
        } else {
          this.error('Function expansion returned null');
        }
      }
      if (this.compiler.errors.length > 0) return null;

      for (var i = 0; i < args.length; i++) {
        bodyExpr.varScope.set(args[i], meta.newReadonlyDeclaration(args[i]));
      }

      bodyExpr.resolve();
      if (this.compiler.errors.length > 0) return meta.undefinedFunction;
      var isVoid = (bodyExpr.sym.id === 'return');
      bodyExpr.checkArity(isVoid ? 0 : 1, -1, -1);
      if (this.compiler.errors.length > 0) return meta.undefinedFunction;

      var context = meta.newRootCodegenContext(bodyExpr);
      if (isVoid) {
        bodyExpr.codegenAsStatement(context);
      } else {
        var returnValue = bodyExpr.codegenAsExpression(context);
        var returnStatement = meta.codegenReturn(this.loc, returnValue);
        context.block.push(returnStatement);
      }
      if (this.compiler.errors.length > 0) return null;
      bodyExpr.codegenAddDeclarations(context.block);
      var bodyCode = meta.codegenBlock(bodyExpr.loc, context.block);
      if (this.compiler.errors.length > 0) return null;

      return bodyCode;
    };

    Expr.prototype.asFunction = function (args) {
      var bodyCode = this.asFunctionBody(args);
      var func = function () {};

      var js = 'return undefined;';
      if (bodyCode != null) {
        try {
          js = escodegen.generate(bodyCode);
        } catch (e) {
          this.error('Error in code generation: ' + e.toString());
        }

        try {
          func = new Function(args, js);
        } catch (e) {
          this.error('Error in function generation: ' + e.toString());
        }
      }
      func.js = js;
      func.mjs = this.printAst();

      return func;
    };

    Expr.prototype.asEvalFunction = function (args) {
      var bodyCode = this.asFunctionBody(args);

      if (bodyCode === null) {
        return function () { return undefined; };
      }

      var func = function () {};
      var argsCode = [];
      for (var i = 0; i < args.length; i++) {
        argsCode.push(meta.codegenIdentifier(this.loc, args[i]));
      }
      var functionCode = meta.codegenFunction(this.loc, argsCode, bodyCode);
      var resultCode = meta.codegenIdentifier(this.loc, '__$result__function$__');
      var assignmentCode = meta.codegenAssignmentStatement(this.loc, '=', resultCode, functionCode);

      var js = '__$result__function$__ = function () { return undefined; };';
      try {
        js = escodegen.generate(assignmentCode);
      } catch (e) {
        this.error('Error in code generation: ' + e.toString());
      }

      try {
        func = functionBuilder(js);
      } catch (e) {
        this.error('Error in function generation: ' + e.toString());
      }
      func.js = js;
      func.mjs = this.printAst();

      return func;
    };

    Expr.prototype.asFunctionLiteral = function () {
      var errorResult = function () { return undefined; };

      if (!this.isFunctionDefinition()) {
        this.error('Function definition expected');
        return errorResult;
      }

      var ok = true;

      var args = this.at(0).copy().asTuple().map(function(arg) {
        if (!arg.isTag()) {
          arg.error('Invalid function argument name');
          ok = false;
        }
        return arg.getTag();
      });
      if (!ok) {
        return errorResult;
      }

      return this.at(1).asEvalFunction(args);
    };

    Expr.prototype.performCompilationPhase = function (phaseName, phaseDescription) {
      if (typeof phaseDescription === 'undefined') {
        phaseDescription = 'perform phase \"' + phaseName + '\"';
      }
      if (this.compiler.errors.length !== 0) {
        return this;
      }
      this[phaseName]();
      return this.compiler.root;
    };


    Expr.prototype.performCombinePhase = function () {
      this.performCompilationPhase('combine', 'combine symbols');
      this.performCompilationPhase('fixDependent', 'fix dependent symbols');
      this.performCompilationPhase('fixTagKind', 'fix tag symbols');
      if (this.parent === null && this.sym === meta.tupleSymbol) {
        this.sym = meta.doSymbol;
      }
      return this;
    };

    Expr.prototype.performApplyCoreMacrosPhase = function () {
      return this.performCompilationPhase('applyCoreMacros', 'apply core macros');
    };

    Expr.prototype.performExpandPhase = function () {
      return this.performCompilationPhase('expand', 'expand macros');
    };

    Expr.prototype.detectPlaceholdersPhase = function () {
      return this.performCompilationPhase('detectPlaceholders', 'detect placeholders');
    };
    Expr.prototype.performResolvePhase = function () {
      return this.performCompilationPhase('resolve', 'resolve symbols');
    };
    Expr.prototype.performCheckArityPhase = function () {
      return this.performCompilationPhase('checkArity', 'check arity');
    };

    Expr.prototype.postExpansionCompilationSteps = function () {
      this
        .detectPlaceholdersPhase()
        .performResolvePhase()
        .performCheckArityPhase();
    };

    Expr.prototype.compilationSteps = function () {
      this
        .performApplyCoreMacrosPhase()
        .performCombinePhase()
        .performExpandPhase()
        .postExpansionCompilationSteps();
    };

    Expr.prototype.codegenAsProgram = function () {
      if (this.compiler.errors.length !== 0) {
        return null;
      }
      var context = meta.newRootCodegenContext(this);
      this.codegenAsStatement(context);
      this.codegenAddDeclarations(context.block);
      var program = meta.codegenProgram(context.block);
      return program;
    };
    Expr.prototype.codegenAsEvalArgument = function () {
      if (this.compiler.errors.length !== 0) {
        return null;
      }
      var context = meta.newRootCodegenContext(this);
      var expression = this.codegenAsExpression(context);
      this.codegenAddDeclarations(context.block);
      var expressionStatement = meta.codegenExpressionStatement(this.loc, expression);
      context.block.push(expressionStatement);
      var program = meta.codegenProgram(context.block);
      return program;
    };
    Expr.prototype.codegenAsModuleExports = function () {
      if (this.compiler.errors.length !== 0) {
        return null;
      }
      var context = meta.newRootCodegenContext(this);
      var expression = this.codegenAsExpression(context);
      this.codegenAddDeclarations(context.block);
      var expressionStatement = meta.codegenExpressionStatement(this.loc, expression);
      context.block.push(expressionStatement);
      var program = meta.codegenProgram(context.block);
      return program;
    };

    Expr.prototype.applyTransformer = function (
        preTransformerProperty, transformerProperty, transformerName, applyFixers, resultReceiver) {
      var expr = this;

      var step = function (isPre, receiver) {
        while (true) {
          var transformer = isPre ?
              expr.sym.symbolData[preTransformerProperty] :
              expr.sym.symbolData[transformerProperty];
          var parent = expr.parent;
          var result = undefined;
          try {
            result = transformer(expr, expr.compiler.metaEnv);
          } catch (e) {
            if (expr.compiler.options.fullMacroErrors) {
              expr.error('Error in symbol ' + transformerName + (isPre ? ' [pre phase]' : ''));
              expr.error('error:\n' + e);
              expr.error('stack:\n' + e.stack);
              expr.error('JS:\n' + transformer.js);
              expr.error('MJS:\n' + transformer.mjs);
            } else {
              expr.error('Error in symbol ' + transformerName  + (isPre ? ' [pre phase]' : '') + ': ' + e);
            }
          }
          if (typeof result === 'undefined') {
            if (applyFixers && !isPre) {
              expr.fixTagKind();
            }
            return true;
          } else if (result === null) {
            expr.disconnect();
            return false;
          } else {
            if (applyFixers && !isPre) {
              result.fixDependent();
              result.fixTagKind();
            }
            if (parent !== null) {
              parent.replaceArg(expr, result);
              // Trigger expansion of macros introduced by this expansion
              return result.applyTransformer(preTransformerProperty, transformerProperty, transformerName, applyFixers);
            } else {
              if (typeof receiver === 'function') {
                receiver(result);
                return false;
              } else {
                if (expr === expr.compiler.root) {
                  expr.compiler.root = result;
                } else {
                  expr.error('Expansion returned an AST but the expression has no parent');
                }
              }
            }
            return true;
          }
        }
      };

      if (preTransformerProperty != null) {
        var preResultReceiver = function(r) {
          expr = r;
        };
        if (!step(true, preResultReceiver)) {
          return false;
        }
      }

      if (!expr.doNotExpandChildren()) {
        var i = 0;
        while (i < expr.argCount()) {
          var arg = expr.argAt(i);
          var incrementIndex = arg.applyTransformer(
              preTransformerProperty, transformerProperty, transformerName, applyFixers);
          if (incrementIndex) i++;
        }
      }

      return step(false, resultReceiver);
    };
    Expr.prototype.preCombine = function (resultReceiver) {
      return this.applyTransformer(null, 'preCombine', 'precombination', false, resultReceiver);
    };
    Expr.prototype.postCombine = function (resultReceiver) {
      return this.applyTransformer(null, 'postCombine', 'postcombination', false, resultReceiver);
    };
    Expr.prototype.expand = function (resultReceiver) {
      return this.applyTransformer('preExpand', 'expand', 'expansion', true, resultReceiver);
    };

    function AstPrinter(expr, level, lineLengthLimit, indentationStep) {
      if (!(this instanceof AstPrinter)) {
        return new AstPrinter(expr, level, lineLengthLimit, indentationStep);
      }

      this.expr = expr;
      this.level = typeof level !== 'undefined' ? level : 0;
      this.lineLengthLimit = typeof lineLengthLimit !== 'undefined' ? lineLengthLimit : 60;
      this.indentationStep = typeof indentationStep !== 'undefined' ? indentationStep : '  ';
      this.children = [];
      for (var i = 0; i < expr.argCount(); i++) {
        this.children.push(
          new AstPrinter(expr.argAt(i), this.level + 1, this.lineLengthLimit, this.indentationStep));
      }

      this.estimatedSize = 0;
      this.fitsLine = true;
      this.parentFitsLine = true;

      this.result = '';
    }
    AstPrinter.prototype.estimateSize = function () {
      var expr = this.expr;
      var result = 0;
      if (expr.isTag()) {
        result = expr.getTag().length;
      } else if (expr.isValue()) {
        result = expr.getValue().toString().length;
      } else {
        result = expr.id.length;
        for (var i = 0; i < this.children.length; i++) {
          result += this.children[i].estimateSize();
        }
      }
      this.estimatedSize = result;
      this.fitsLine = this.estimatedSize < this.lineLengthLimit;
      this.parentFitsLine = this.fitsLine;
      return result;
    };
    AstPrinter.prototype.propagateFitsLine = function () {
      for (var i = 0; i < this.children.length; i++) {
        this.children[i].parentFitsLine = this.fitsLine;
        this.children[i].propagateFitsLine();
      }
    };
    AstPrinter.prototype.append = function (text) {
      this.result += text;
    };
    AstPrinter.prototype.prepend = function (text) {
      this.result = text + this.result;
    };
    AstPrinter.prototype.becomeIndented = function (index) {
      for (var i = 0; i < this.level; i++) {
        this.prepend(this.indentationStep);
      }
      this.prepend('\n');
    };
    AstPrinter.prototype.appendChild = function (index) {
      this.result += this.children[index].result;
    };
    AstPrinter.prototype.appendChildren = function () {
      var junction = this.fitsLine ? ', ' : '';
      var result = '';
      for (var i = 0; i < this.children.length; i++) {
        if (i > 0) {
          result += junction;
        }
        result += this.children[i].result;
      }
      this.append(result);
    };
    AstPrinter.prototype.computeResult = function (decorator, mark) {
      if (typeof decorator === 'undefined') decorator = function() { return ''; };
      if (typeof mark === 'undefined') mark = '';
      var needsWrapping = false;
      var expr = this.expr;
      var isAlreadyIndented = false;

      if (expr.id === 'if') {
        this.children[0].computeResult(decorator, this.fitsLine ? '' : '#cond ');
        this.children[1].computeResult(decorator);
        if (this.children.length > 2) {
          this.children[2].computeResult(decorator, 'else ');
        }
      } else if (expr.isCall() && !this.fitsLine) {
        var levelFixer = function (child) {
          child.level--;
          for (var i = 0; i < child.children.length; i++) {
            levelFixer(child.children[i]);
          }
        };
        levelFixer (this.children[0]);
        if (this.children[1].expr.isTuple) {
          levelFixer (this.children[1]);
        }
        this.children[0].computeResult(decorator, '#call ');
        this.children[1].computeResult(decorator);
      } else {
        for (var i = 0; i < this.children.length; i++) {
          this.children[i].computeResult(decorator);
        }
      }

      if (expr.isName()) {
        this.result = expr.val;
      } else if (expr.isTag()) {
        this.result = expr.getTag();
        if (expr.isVirtualTag()) {
          if (expr.isResolved) {
            this.result = '\\[R]' + this.result;
          } else {
            this.result = '\\' + this.result;
          }
          needsWrapping = true;
        }
        if (expr.isConstantTag()) {
          this.result = 'const ' + this.result;
          needsWrapping = true;
        }
        if (expr.isTagDeclaration()) {
          this.result = (expr.isFunctionArgument() ? 'arg ' : 'var ') + this.result;
          needsWrapping = true;
        }
        if (expr.isExternalTag()) {
          this.result = '#external ' + this.result;
          needsWrapping = true;
        }
      } else if (expr.isValue()) {
        var v = expr.getValue();
        if (typeof v === 'string') {
          var complex = ['\b', '\f', '\n', '\r', '\t', '\v'];
          var hasComplex = false;
          for (var complexIndex = 0; complexIndex < complex.length; complexIndex++) {
            if (v.indexOf(complex[complexIndex]) !== -1) {
              hasComplex = true;
              break;
            }
          }
          if (hasComplex) {
            this.result = '\'<complex string>\'';
          } else {
            this.result = '#str ' + v;
            needsWrapping = true;
          }
        } else {
          this.result = '#val ' + v.toString();
          needsWrapping = true;
        }
      } else if (expr.isPlaceholder()) {
        this.result = '#placeholder ' + expr.getValue();
        needsWrapping = true;
      } else {
        var id = expr.id;
        if (expr.isDo()) {
          id = 'do';
        } else if (id === '+x') {
          id = '+';
        } else if (id === '-x') {
          id = '-';
        } else if (id === '++x' || id === 'x++') {
          id = '++';
        } else if (id === '--x' || id === 'x--') {
          id = '--';
        } else if (expr.isArray()) {
          id = this.fitsLine ? '' : '#[]';
        } else if (expr.isObject()) {
          id = this.fitsLine ? '' : '#{}';
        } else if (expr.isTuple()) {
          id = this.fitsLine ? '' : '#()';
        } else if (expr.isCall()) {
          id = '';
        }

        this.result = '';

        if (this.fitsLine) {
          if (id === '.' ||
              id === ':' ||
             id === '==' ||
             id === '!=' ||
             id === '>' ||
             id === '<' ||
             id === '>=' ||
             id === '<=' ||
             id === '=') {
            this.appendChild(0);
            var op = id === '.' ? id : (' ' + id + ' ');
            this.append(op);
            this.appendChild(1);
          } else if (expr.isElement()) {
            this.appendChild(0);
            this.append('[');
            this.appendChild(1);
            this.append(']');
          } else if (expr.isCall()) {
            this.appendChild(0);
            this.append('(');
            if (this.children[1].expr.isTuple()) {
              var tupleChild = this.children[1];
              for (var i = 0; i < tupleChild.children.length; i++) {
                this.append(tupleChild.children[i].result);
                if (i < tupleChild.children.length - 1) {
                  this.append(', ')
                }
              }
            } else {
              this.appendChild(1);
            }
            this.append(')');
          } else if (expr.isTuple()) {
            this.append('(');
            this.appendChildren();
            this.append(')');
          } else if (expr.isObject()) {
            this.append('{');
            this.appendChildren();
            this.append('}');
          } else if (expr.isArray()) {
            this.append('[');
            this.appendChildren();
            this.append(']');
          } else {
            this.append(id);
            this.append('(');
            this.appendChildren();
            this.append(')');
          }
        } else {
          if (expr.isCall()) {
            this.appendChild(0);
            if (this.children[1].expr.isTuple) {
              var tupleChild = this.children[1];
              for (var i = 0; i < tupleChild.children.length; i++) {
                this.append(tupleChild.children[i].result);
              }
            } else {
              this.appendChild(1);
            }
            isAlreadyIndented = true;
          } else {
            this.append(id);
            this.appendChildren();
          }
        }
      }

      if (needsWrapping) {
        this.prepend('(');
        this.append(')');
      }

      this.prepend(mark);
      if (!(this.parentFitsLine || isAlreadyIndented)) {
        this.becomeIndented();
      }

      return this.result;
    };
    AstPrinter.prototype.print = function () {
      this.estimateSize();
      this.propagateFitsLine();
      this.computeResult();
      return this.result;
    };
    Expr.prototype.printAst = function () {
      var printer = new AstPrinter(this);
      return printer.print();
    };

    Expr.prototype.clearLocation = function () {
      this.loc = null;
      for (var i = 0; i < this.argCount(); i++) {
        this.argAt(i).clearLocation();
      }
    };
    Expr.prototype.normalizeLocation = function () {
      for (var i = 0; i < this.argCount(); i++) {
        this.argAt(i).normalizeLocation();
        this.mergeLoc(this.argAt(i));
      }
    };
    Expr.prototype.checkLocation = function (line, column, startsBefore, endsAfter) {
      var startsResult = (startsBefore !== undefined) ? (
        startsBefore ? ((this.loc.start.line <= line) && (this.loc.start.column <= column)) :
          ((this.loc.start.line > line) && (this.loc.start.column > column))
      ) : true;
      var endResult = (endsAfter !== undefined) ? (
        endsAfter ? ((this.loc.end.line >= line) && (this.loc.end.column >= column)) :
          ((this.loc.end.line < line) && (this.loc.end.column < column))
      ) : true;
      return startsResult && endResult;
    };
    Expr.prototype.includesLocation = function (line, column) {
      return this.checkLocation(line, column, true, true);
    };
    Expr.prototype.findLocation = function (line, column, startsBefore, endsAfter, firstResult) {
      if (typeof firstResult === 'undefined') firstResult = true;
      var lastFoundChild = null;
      for (var i = 0; i < this.argCount(); i++) {
        var childResult = this.argAt(i).findLocation(line, column, startsBefore, endsAfter);
        if (childResult !== null) {
          if (firstResult) {
            return childResult;
          } else {
            lastFoundChild = childResult;
          }
        }
      }
      if (lastFoundChild !== null) {
        return lastFoundChild;
      }
      if (this.checkLocation(line, column, startsBefore, endsAfter)) {
        return this;
      }
      return null;
    };
    Expr.prototype.findLocationAt = function (line, column) {
      return this.findLocation(line, column, true, true);
    };
    Expr.prototype.findTopLevelAt = function (line, column) {
      var leaf = this.findLocation(line, column, true, undefined, false);
      while (leaf.parent !== null) {
        if (leaf.parent.parent === null) break;
        leaf = leaf.parent;
      }
      return leaf;
    };


    Expr.prototype.createAlias = function (sym, newId) {
      var oldSymbolData = sym.symbolData;
      var newSymbolData = new meta.SymbolData(oldSymbolData.arity, oldSymbolData.precedence, {});

      for (var k in oldSymbolData) {
        if (oldSymbolData.hasOwnProperty(k)) {
          newSymbolData[k] = oldSymbolData[k];
        }
      }

      return new meta.Symbol(newId, 'macro', newSymbolData);
    };

    Expr.prototype.createExtension = function (sym, expander) {
      var expanderBuilder = function(oldExpander, newExpander) {
        return function (expr, env) {
          var result = newExpander(expr, env);
          if (typeof result !== 'undefined') {
            return result;
          } else {
            return oldExpander(expr, env);
          }
        };
      };

      var result = this.createAlias(sym, sym.id);
      result.symbolData.expand = expanderBuilder(this.sym.symbolData.expand, expander);
      return result;
    };

    Expr.prototype.creationAst = function () {
      if (this.sym.symbolData !== null) {
        return this.sym.symbolData.creationAst;
      } else {
        if (this.parent !== null) {
          this.error('Unquote operating on unprocessed token');
        }
        return this;
      }

    };

    Expr.prototype.createMacro = function (id, arityName, precedence, options) {
      var leftPrecedence = meta.existsOr(options.leftPrecedence, precedence);
      var dependent = meta.existsOr(options.dependent, []);
      var subordinate = meta.existsOr(options.subordinate, []);
      var preExpand = meta.existsOrUndefinedFunction(options.preExpand);
      var expand = meta.existsOrUndefinedFunction(options.expand);
      var preCombine = meta.existsOrUndefinedFunction(options.preCombine);
      var postCombine = meta.existsOrUndefinedFunction(options.postCombine);
      var expandCall = meta.existsOrUndefinedFunction(options.expandCall);
      var doNotExpandChildren = meta.existsOrFalse(options.doNotExpandChildren);

      if (typeof id !== 'string') {
        this.error('Invalid symbol id ' + id);
        return null;
      }
      var arity = meta.getArity(arityName);
      if (arity === null) {
        this.error('Invalid symbol arity ' + arityName);
        return null;
      }
      if (meta.checkPrecedence(precedence) === false) {
        this.error('Invalid symbol precedence ' + precedence);
        return null;
      }
      if (meta.checkPrecedence(leftPrecedence) === false) {
        this.error('Invalid symbol left precedence ' + leftPrecedence);
        return null;
      }
      if (!meta.isArray(dependent)) {
        this.error('Invalid symbol dependent');
        return null;
      }
      for (var i = 0; i < dependent.length; i++) {
        if (typeof dependent[i] !== 'string') {
          this.error('Invalid dependent symbol ' + dependent[i]);
          return null;
        }
        if (!this.keyScope.has(dependent[i])) {
          this.error('Undefined dependent symbol ' + dependent[i]);
          return null;
        }
      }
      for (var i = 0; i < subordinate.length; i++) {
        if (typeof subordinate[i] !== 'object' || ! subordinate[i] instanceof Expr) {
          this.error('Invalid subordinate symbol ' + subordinate[i]);
          return null;
        }
      }
      if (typeof preExpand !== 'function') {
        this.error('Invalid symbol pre expander');
        return null;
      }
      if (typeof expand !== 'function') {
        this.error('Invalid symbol expander');
        return null;
      }
      if (typeof preCombine !== 'function') {
        this.error('Invalid symbol precombiner');
        return null;
      }
      if (typeof postCombine !== 'function') {
        this.error('Invalid symbol postcombiner');
        return null;
      }
      if (typeof expandCall !== 'function') {
        this.error('Invalid symbol expandCall');
        return null;
      }

      var data = new meta.SymbolData(arity, precedence, {
        leftPrecedence: leftPrecedence,
        doNotExpandChildren: doNotExpandChildren,
        dependent: dependent,
        subordinate: subordinate,
        preExpand: preExpand,
        expand: expand,
        preCombine: preCombine,
        postCombine: postCombine,
        expandCall: expandCall,
        creationAst: this
      });
      return new meta.Symbol(id, 'macro', data);
    };




    parser.initialize(compiler, Expr);
  }
  this.Compiler = Compiler;

  meta.Parser.prototype.countNonIgnored = function (expr) {
    var count = 0;
    for (var i = 0; i < expr.count; i++) {
      if (!expr.at(i).isIgnored()) {
        count++;
      }
    }
    return count;
  };

  meta.Parser.prototype.recordTokenStart = function () {
    this.tokenInitialColumnNumber = this.currentColumnNumber;
  };
  meta.Parser.prototype.currentLocation = function (c1, c2) {
    var line = this.currentLineNumber;
    if (line === 0) line = 1;
    if (typeof c1 === 'undefined') { c1 = this.tokenInitialColumnNumber; }
    if (typeof c2 === 'undefined') { c2 = this.currentColumnNumber; }
    return {
      source: this.source ? this.source : null,
      start: {line: line, column: c1},
      end: {line: line, column: c2}
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
      start: {line: 1, column: 0},
      end: {line: 1, column: 0}
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

  meta.Parser.prototype.updateBlockEnd = function (kind) {
    this.indentedBlockLastLine = this.currentLineNumber;
    this.indentedBlockLastColumn = this.currentColumnNumber;
  };

  meta.Parser.prototype.openBlock = function (kind) {
    var new_block = this.Expr(kind);
    this.currentBlock = new_block;
    this.updateBlockEnd();
    return new_block;
  };

  meta.Parser.prototype.closeBlock = function (isIndented) {
    if (typeof isIndented === 'undefined') isInIndent = false;
    var result = this.currentBlock;
    if (result !== null) {
      this.setLocationEnd(result.loc);
      if (isIndented) {
        result.loc.end.line = this.indentedBlockLastLine;
        result.loc.end.column = this.indentedBlockLastColumn;
      }
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
  meta.Parser.prototype.closeAllBlocks = function () {
    if (null !== this.multilineStringContents) {
      this.error('Unterminated multiline string');
    }
    while (this.currentBlock.parent !== null) {
      if (this.currentBlock.isEmpty()) {
        this.removeCurrentBlock();
      } else {
        this.closeBlock();
      }
    }
  };

  meta.Parser.prototype.addPrimitive = function (primitive, value) {
    return this.Expr(primitive, value);
  };
  meta.Parser.prototype.addValue = function (value) {
    switch (typeof value) {
    case 'undefined':
    case 'boolean':
    case 'number':
    case 'string':
      return this.addPrimitive('<val>', value);
    case 'object':
      if (value !== null) {
        this.error('Unexpected object value');
      }
      return this.addPrimitive('<val>', null);
    default:
      this.error('Unexpected value type ' + typeof value);
      return this.addPrimitive('<val>', null);
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
  meta.Parser.prototype.addSpace = function (value) {
    this.Expr('<sp>', value);
  };
  meta.Parser.prototype.addNewLine = function () {
    this.Expr('<nl>', null);
  };
  meta.Parser.prototype.addComment = function (value) {
    this.Expr('<comment>', value);
  };

  meta.Parser.prototype.error = function (message, line, column) {
    if (typeof line === 'undefined') line = this.currentLineNumber;
    if (typeof column === 'undefined') column = this.currentColumnNumber;
    this.compiler.errors.push(new meta.Error(message, line, column));
  };

  meta.Parser.prototype.isReserved = function (s) {
    return meta.isReserved(s);
  };
  meta.Parser.prototype.isBlock = function (s) {
    return meta.TOKENS.has(s) && meta.TOKENS.get(s).blockData !== null;
  };
  meta.Parser.prototype.isBlockWithNewScope = function (s) {
    return this.isBlock(s) && meta.TOKENS.get(s).blockData.needsNewScope;
  };

  meta.Parser.prototype.processLine = function (line, isCst) {
    if (typeof isCst === 'undefined') isCst = false;

    this.currentLineNumber++;

    if (this.sourceText !== null) {
      this.sourceText += line;
      this.sourceText += '\n';
    }

    if (isCst && this.currentBlock !== this.root && !this.currentBlock.isEmpty()) {
      this.addNewLine();
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
      var delimiter;

      if (null !== me.multilineStringContents) {
        delimiter = me.multilineStringTerminator.charAt(0);
      } else {
        delimiter = remaining.charAt(0);

        // Check if we are at a multiline delimiter
        var multilineDelimiter = delimiter;
        for (var i = 1; remaining.charAt(i) === delimiter; i++) {
          multilineDelimiter += delimiter;
        }
        if (multilineDelimiter.length >= 3) {
          me.multilineStringTerminator = multilineDelimiter;
          me.multilineStringContents = '';
          me.multilineStringIsLiterate = (me.currentColumnNumber === 0);
          remaining = remaining.substring(multilineDelimiter.length);
          me.currentColumnNumber += multilineDelimiter.length;
        } else {
          consumeChar();
        }
      }

      var token = '';
      while (remaining !== null && remaining.length > 0) {
        var current = remaining.charAt(0);
        if (current === delimiter) {
          if (null === me.multilineStringContents) {
            me.addValue(token).set('quote', delimiter);
            consumeChar();
            return;
          }

          // Have we found the end of a multiline string?
          if (0 === remaining.indexOf(me.multilineStringTerminator)) {
            token = me.multilineStringContents + token;

            if (delimiter === '\'') {
              // Single quoted are trimmed up to and including the first new line
              token = token.replace(/^[ \t]*\n?/, '').replace(/\n?[ \t]*$/, '');
            } else {
              // Double quoted are just trimmed, folding already happens while parsing
              token = token.replace(/^[ ]/, '').replace(/[ ]$/, '');
            }

            if (me.multilineStringIsLiterate) {
              if (me.currentBlock === me.root && me.root.isEmpty()) {
                me.root.set('doc', token);
              }
            } else {
              me.addValue(token).set('quote', me.multilineStringTerminator);
            }

            remaining = remaining.substring(me.multilineStringTerminator.length);
            me.currentColumnNumber += me.multilineStringTerminator.length;

            me.multilineStringContents = null;
            return;
          }

          token += delimiter;
          consumeChar();
        } else if (current === ' ' || current === '\t') {

          // Trim double quotes multiline
          if (null !== me.multilineStringContents && delimiter === '"') {
            if (token === '') {
              consumeChar();
              continue;
            } else if (/^\s+$/.test(remaining)) {
              me.currentColumnNumber += remaining.length;
              remaining = '';
              continue
            }
          }

          consumeChar();
          token += current;

        } else if (current === '\\') {
          consumeChar();

          // Single quotes do not interpret escape codes
          if (delimiter === '\'') {
            token += current;
            continue;
          }

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

      if (null === me.multilineStringContents) {
        me.error('Unterminated string literal');
        remaining = null;
      } else {
        me.multilineStringContents += token;
      }
    };

    this.currentColumnNumber = 0;

    var applyIndentation = true;
    var isInIndent = true;
    var indentToken = '';

    if (null !== this.multilineStringContents) {
      this.multilineStringContents += this.multilineStringTerminator.charAt(0) === '"' ? ' ' : '\n';
      consumeStringLiteral();
      if (null !== this.multilineStringContents) {
        return;
      }
      applyIndentation = false;
      isInIndent = false;
    } else {
      // Empty or pure comment lines do not affect indentation blocks.
      if (remaining.length === 0 || remaining.charAt(0) === ';') {
        applyIndentation = false;
      }

      // Ignore multiline strings starting at column 0
      // (they can be used for literate programming).
      if (this.currentColumnNumber === 0 &&
          (remaining.indexOf('"""') === 0 || remaining.indexOf('\'\'\'') === 0)) {
        applyIndentation = false;
      }
    }

    while (isInIndent) {
      var current = remaining.charAt(0);
      if (current === ' ') {
        consumeChar();
        indentToken += current;
      } else if (current === '\t') {
        consumeChar();
        indentToken += current;
        if (meta.TAB_SIZE > 0) {
          meta.currentColumnNumber += (meta.TAB_SIZE - 1);
        } else {
          this.error('No tabs allowed for indentation', 0);
        }
      } else {
        isInIndent = false;
      }
    }

    // Handle block structure
    if (applyIndentation) {
      this.recordTokenStart();
      this.currentBlock.sym.blockData.handleNewLine(this, remaining.charAt(0));
    }

    if (isCst && indentToken.length > 0) {
      this.addSpace(indentToken);
    }

    while (remaining !== null && remaining.length > 0) {
      this.recordTokenStart();
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
        var token = '', next;
        do {
          token += remaining.charAt(0);
          consumeChar();
          next = remaining.charAt(0);
        } while (next === ' ' || next === '\t');
        if (isCst) {
          this.addSpace(token);
        }
        break;
      case ';':
        if (isCst) {
          this.addComment(remaining);
        }
        remaining = null;
        break;
      case '"':
      case '\'':
        consumeStringLiteral();
        break;
      default:
        var token;
        token = tryMatch(/^([-][\>]?)*[_$a-zA-Z\xA0-\uFFFF]([_$a-zA-Z0-9\xA0-\uFFFF]|([-][\>]?))*[\!\?]*/);
        if (token !== null) {
          if (token === 'do') {
            this.openBlock('<do>');
          } else {
            this.addIdentifier(token);
          }
          afterMatch(token);
          break;
        }
        token = tryMatch(/^[0-9]*\.?[0-9]+/);
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
        token = tryMatch(/^\#([-][\>]?)*([\#_$a-zA-Z0-9\xA0-\uFFFF]|([-][\>]?))*[\!\?]*/);
        if (token !== null) {
          this.addOperator(token);
          afterMatch(token);
          break;
        }
        token = tryMatch(/^[\\\+\*\-\/<>\:\~\|\^\#\@\!\?\&\.\=\~\`\%]+/);
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
      me.updateBlockEnd();
    }
  };

  Compiler.prototype.logErrors = function () {
    for (var i = 0; i < this.errors.length; i++) {
      console.log(this.errors[i].toString());
    }
  };

  Compiler.prototype.parse = function (isCst) {
    var parser = this.parser;
    parser.reader.start(function (line) {
      parser.processLine(line, !!isCst);
    });
    this.doneWithParsing();
  };

  Compiler.prototype.doneWithParsing = function () {
    this.parser.closeAllBlocks();
    this.root = this.parser.root;
    if (this.parser.sourceText !== null) {
      this.options.escodegen.sourceContent = this.parser.sourceText;
    }
  };

  Compiler.prototype.error = function (message) {
    if (this.parser.compiler !== null) {
      this.parser.error(message);
    } else {
      this.errors.push(new meta.Error(message, 1, 0));
    }
  };

  Compiler.prototype.performPhase = function (expressionCompilationStep) {
    if (this.errors.length !== 0) {
      return this;
    }
    if (this.root === null) {
      this.error('Cannot perform step ' + expressionCompilationStep +
          ' because parse phase did not happen');
      return this;
    }

    this.root.performCompilationPhase(expressionCompilationStep);
    return this;
  };


  Compiler.prototype.combine = function () {
    return this.performPhase('performCombinePhase');
  };

  Compiler.prototype.applyCoreMacros = function () {
    return this.performPhase('applyCoreMacros');
  };

  Compiler.prototype.expand = function () {
    return this.performPhase('performExpandPhase');
  };

  Compiler.prototype.detectPlaceholders = function () {
    return this.performPhase('detectPlaceholdersPhase');
  };
  Compiler.prototype.resolve = function () {
    return this.performPhase('performResolvePhase');
  };
  Compiler.prototype.checkArity = function () {
    return this.performPhase('performCheckArityPhase');
  };

  Compiler.prototype.postExpansionPipeline = function () {
    return this.performPhase('postExpansionCompilationSteps');
  };

  Compiler.prototype.pipeline = function () {
    // This is an ugly hack, and is likely to break with future node versions :-/
    // However for now I see no other way of loading macro modules as npm modules.
    var NODE_PATH = process.env.NODE_PATH;

    process.env.NODE_PATH = this.macroBasePath + path.delimiter + NODE_PATH;
    module.constructor._initPaths();

    var result = this.performPhase('compilationSteps');

    process.env.NODE_PATH = NODE_PATH;
    module.constructor._initPaths();

    return result;
  };

  Compiler.prototype.jsAstFor = function (expr) {
    var context = meta.newRootCodegenContext(expr);
    expr.codegenAsStatement(context);
    expr.codegenAddDeclarations(context.block);
    return meta.codegenProgram(context.block);
  };

  Compiler.prototype.codegen = function () {
    if (this.errors.length !== 0) {
      return null;
    }
    if (this.root === null) {
      this.parser.error('Cannot genetate code because parse phase did not happen', 0, 0);
      return null;
    }

    var program = this.jsAstFor(this.root);
    return program;
  };

  Compiler.prototype.ensureRoot = function () {
    if (this.root === null) {
      this.parse();
    }
    this.pipeline();
  }

  Compiler.prototype.produceAst = function () {
    this.ensureRoot();
    var result = this.codegen();
    return this.errors.length > 0 ? null : result;
  };

  Compiler.prototype.generate = function (jsAst, escodegenOptions) {
    escodegenOptions = escodegenOptions || this.options.escodegen || {};

    if (this.options.es5Generators) {
      this.es5Generators(jsAst, this.options.runtime);
    }

    var generated = escodegen.generate(jsAst, escodegenOptions);
    var code = escodegenOptions.sourceMapWithCode ? generated.code : generated;
    var map = escodegenOptions.sourceMapWithCode ? generated.map.toString() : null;
    return {code: code, map: map};
  };

  Compiler.prototype.es5Generators = function (jsAst, embedRuntime) {
      // HACK: Use recast from regenerator deps
      var recast = require('regenerator/node_modules/recast');

      var hasGenerators = false;
      recast.visit(jsAst, {
        visitFunctionExpression: function(path) {
          var node = path.node;
          hasGenerators |= node.generator;
          this.traverse(path);
        }
      });

      if (hasGenerators) {
        var regenerator = require('regenerator');
        regenerator.transform(jsAst);

        if (embedRuntime) {
          var runtime = fs.readFileSync(__dirname + '/regenerator-runtime.json');
          jsAst.body.unshift(JSON.parse(runtime));
        }
      }
  };

  Compiler.prototype.compile = function (jsAst, options) {
    if (typeof jsAst === 'undefined') {
      jsAst = this.produceAst();
    }

    if (jsAst === null) {
      return null;
    }

    try {
      options = options || this.options;

      var generated = this.generate(jsAst, options.escodegen);

      if (generated.map && typeof options.map !== 'undefined') {
        try {
          if (options.mapEmbed || options.map === '-') {
            var datauri = '\n//# sourceMappingURL=data:application/json;base64,';
            datauri += new Buffer(generated.map).toString('base64');
            generated.code += datauri;
          }

          if (options.map && options.map !== '-') {
            fs.writeFileSync(options.map, generated.map);
          }
        } catch (e) {
          this.root.error('Error writing map file: ', e.toString());
        }
      }

      if (typeof options.output !== 'undefined') {
        try {
          fs.writeFileSync(options.output, generated.code);
        } catch (e) {
          this.root.error('Error writing output file: ', e.toString());
        }
      }

      return generated.code;
    } catch (e) {
      this.root.error('Error in code generation: ' + e.toString());
      return null;
    }
  };

  Compiler.prototype.isExpr = function (expr) {
    return expr instanceof this.Expr;
  };
  Compiler.prototype.isSymbol = function (expr) {
    return expr instanceof meta.Symbol;
  };
}

Object.defineProperty(Meta, 'VERSION', {
  get: function () {
    return require('../package.json').version;
  }
});
Object.defineProperty(Meta.prototype, 'version', {
  get: function () {
    return Meta.VERSION;
  }
});

Meta.prototype.clearOptions = function () {
  this.options = {};
};
Meta.prototype.setOptions = function (options) {
  this.options = { emitIdentifierStatements: false };

  var result = null;
  var pushMessage = function (message) {
    if (result === null) {
      result = [];
    }
    result.push(message);
  };

  var currentOptions = this.options;
  var checkOption = function (optName, optValue, expectedType) {
    if (typeof optValue === expectedType) {
      currentOptions[optName] = optValue;
    } else {
      pushMessage('Invalid option ' + optName + ': ' + optValue.toString());
    }
  };

  for (var optName in options) {
    if (options.hasOwnProperty(optName)) {
      switch (optName) {
        case 'source':
        case 'output':
        case 'map':
        case 'mapRoot':
          checkOption(optName, options[optName], 'string');
          break;
        case 'escodegen':
          checkOption(optName, options[optName], 'object');
          break;
        case 'sourceInMap':
        case 'mapEmbed':
        case 'skipCore':
        case 'fullMacroErrors':
        case 'emitIdentifierStatements':
        case 'es5Generators':
        case 'runtime':
          checkOption(optName, options[optName], 'boolean');
          break;
        default:
          pushMessage('Unknown option ' + optName);
      }
    }
  }

  return result;
};

Meta.prototype.compilerFromString = function (s, name, emitIdentifierStatements) {
  var result = this.Compiler(this.StringReader(s, name));
  if (typeof emitIdentifierStatements !== 'undefined') {
    result.options.emitIdentifierStatements = emitIdentifierStatements;
  }
  return result;
};

Meta.prototype.compilerFromFile = function (f) {
  return this.Compiler(this.FileReader(f));
};

function LineStreamCompiler(compiler) {
  this.compiler = compiler;
}

LineStreamCompiler.prototype.onLine = function (line) {
  this.compiler.parser.processLine(line);
};

LineStreamCompiler.prototype.done = function () {
  var compiler = this.compiler;
  compiler.doneWithParsing();
  var ast = compiler.produceAst();
  return ast ? compiler.generate(ast) : {errors: compiler.errors};
};

Meta.prototype.createLineStreamCompiler = function (streamName, options) {
  return new LineStreamCompiler(this.Compiler({name: streamName}, options));
};

module.exports = Meta;
