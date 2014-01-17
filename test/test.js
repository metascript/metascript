require('should');

var Meta = (require('../lib/meta'))();

var parseString = function (s) {
  var compiler = Meta.compilerFromString(s);
  compiler.parse();
  return compiler;
};

var parseArray = function (a) {
  return parseString(a.join('\n'));
};

var combineArray = function (a) {
  var compiler = parseString(a.join('\n'));
  compiler.combine();

  var json = compiler.root.toJsonString();
  var fromJson = compiler.root.fromJsonString(json);
  compiler.root.toExpressionString().should.equal(fromJson.toExpressionString());

  compiler.checkArity();
  return compiler;
};

var resolveArray = function (a) {
  var compiler = parseString(a.join('\n'));
  compiler.combine();

  var json = compiler.root.toJsonString();
  var fromJson = compiler.root.fromJsonString(json);
  compiler.root.toExpressionString().should.equal(fromJson.toExpressionString());

  compiler.resolve();
  compiler.checkArity();
  return compiler;
};


var compareArray = function (printer, compiler, expected, errors) {
  if (typeof errors === 'undefined') { errors = []; }
  compiler.should.have.property('errors').with.lengthOf(errors.length);
  compiler.should.have.property('root');
  if (expected !== null) {
    var dump = compiler.root[printer]();
    dump.should.equal(expected);
  }
  for (var i = 0; i < compiler.errors.length; i++) {
    var e = compiler.errors[i];
    var found = false;
    for (var j = 0; j < errors.length; j++) {
      var current = errors[j];
      if (e.line === current.line &&
          e.column === current.column &&
          e.message.indexOf(current.message) >= 0) {
        found = true;
        break;
      }
    }
    found.should.equal(true);
  }
};

var compareArrayToTokenDump = function (compiler, expected, errors) {
  compareArray('tokenDump', compiler, expected, errors);
};

var compareArrayToExpressionString = function (compiler, expected, errors) {
  compareArray('toExpressionString', compiler, expected, errors);
};

describe('Meta.Compiler', function () {
  describe('#parse()', function () {
    it('Should parse symbols and values', function () {
      compareArrayToTokenDump(parseArray([
        'print "Hello!"'
      ]), '(b (l id:"print" val:"Hello!"))');

      compareArrayToTokenDump(parseArray([
        'print 42'
      ]), '(b (l id:"print" val:42))');

      compareArrayToTokenDump(parseArray([
        'print 42.0 .42 -42 4.2e12 2.4e-12'
      ]), '(b (l id:"print" val:42 val:0.42 op:"-" val:42 val:4200000000000 val:2.4e-12))');

      compareArrayToTokenDump(parseArray([
        'print _12312 $_q12'
      ]), '(b (l id:"print" id:"_12312" id:"$_q12"))');

      compareArrayToTokenDump(parseArray([
        'print "a\\x20\\040z"'
      ]), '(b (l id:"print" val:"a  z"))');

      compareArrayToTokenDump(parseArray([
        'print "\\n\\t" "xy\\uaBcDz" ""'
      ]), '(b (l id:"print" val:"\n\t" val:"xy\uaBcDz" val:""))');

      compareArrayToTokenDump(parseArray([
        'print """END\n1\n2\n3\nEND\nok'
      ]), '(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');

      compareArrayToTokenDump(parseArray([
        'print """\n1\n2\n3\n"""\nok'
      ]), '(b (l id:"print" val:"123") (l id:"ok"))');

      compareArrayToTokenDump(parseArray([
        'print \'\'\'END\n1\n2\n3\nEND\nok'
      ]), '(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');

      compareArrayToTokenDump(parseArray([
        'print \'\'\'\n1\n2\n3\n\'\'\'\nok'
      ]), '(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');
    });

    it('Should parse symbols and operators', function () {
      compareArrayToTokenDump(parseArray([
        'a + b *** !@# @$d.k.abc'
      ]), '(b (l id:"a" op:"+" id:"b" op:"***" op:"!@#" op:"@" id:"$d" op:"." id:"k" op:"." id:"abc"))');

      compareArrayToTokenDump(parseArray([
        'a <== b <!> -> _\\$/z'
      ]), '(b (l id:"a" op:"<==" id:"b" op:"<!>" op:"->" id:"_" op:"\\" id:"$" op:"/" id:"z"))');
    });

    it('Should parse blocks', function () {
      compareArrayToTokenDump(parseArray([
        'a (b c)'
      ]), '(b (l id:"a" ((c id:"b" id:"c"))))');

      compareArrayToTokenDump(parseArray([
        'a {b [d e] c}'
      ]), '(b (l id:"a" {(c id:"b" [(c id:"d" id:"e")] id:"c")}))');

      compareArrayToTokenDump(parseArray([
        'a (',
        '  b',
        '  c',
        ')'
      ]), '(b (l id:"a" ((b (l id:"b") (l id:"c")))))');

      compareArrayToTokenDump(parseArray([
        'l1a',
        '  l2a',
        '    l3a',
        '    l3b1 l3b2',
        '  l2b',
        '    l3a',
        '    l3b',
        'l1b'
      ]), '(b (l id:"l1a" (b (l id:"l2a" (b (l id:"l3a") ' +
        '(l id:"l3b1" id:"l3b2"))) (l id:"l2b" (b (l id:"l3a") (l id:"l3b"))))) (l id:"l1b"))');

      compareArrayToTokenDump(parseArray([
        'l1a',
        '  l2a',
        '  l2b',
        'l1b',
        '  l2c',
        '  l2d'
      ]), '(b (l id:"l1a" (b (l id:"l2a") (l id:"l2b"))) (l id:"l1b" (b (l id:"l2c") (l id:"l2d"))))');
    });

    it('Should ignore comments and literate strings', function () {
      compareArrayToTokenDump(parseArray([
        'a (b c) ; Hello!'
      ]), '(b (l id:"a" ((c id:"b" id:"c"))))');

      compareArrayToTokenDump(parseArray([
        'a {b [d e] c};;;'
      ]), '(b (l id:"a" {(c id:"b" [(c id:"d" id:"e")] id:"c")}))');

      compareArrayToTokenDump(parseArray([
        '; Comment...',
        'a (',
        '; Comment...',
        '  b',
        '; Comment...',
        '  c',
        '; Comment...',
        ')',
        '; Comment...'
      ]), '(b (l id:"a" ((b (l id:"b") (l id:"c")))))');

      compareArrayToTokenDump(parseArray([
        'l1a ;...',
        '  l2a',
        '    l3a',
        '    l3b1 l3b2;...',
        '  l2b',
        '"""',
        '1\n2\n3',
        '"""',
        '    l3a',
        '"""END',
        '1\n2\n3',
        'END',
        '    l3b',
        'l1b'
      ]), '(b (l id:"l1a" (b (l id:"l2a" (b (l id:"l3a") ' +
        '(l id:"l3b1" id:"l3b2"))) (l id:"l2b" (b (l id:"l3a") (l id:"l3b"))))) (l id:"l1b"))');

      compareArrayToTokenDump(parseArray([
        'l1a',
        '  l2a',
        '  l2b',
        'l1b',
        '  l2c',
        '  l2d'
      ]), '(b (l id:"l1a" (b (l id:"l2a") (l id:"l2b"))) (l id:"l1b" (b (l id:"l2c") (l id:"l2d"))))');
    });
    
    it('Should parse commas', function () {
      compareArrayToTokenDump(parseArray([
        'a (b c, d e, f g)'
      ]), '(b (l id:"a" ((c id:"b" id:"c") (c id:"d" id:"e") (c id:"f" id:"g"))))');

      compareArrayToTokenDump(parseArray([
        'a [b \nc,\n d\n e\n]'
      ]), '(b (l id:"a" [(c id:"b" id:"c") (c id:"d" id:"e")]))');

      compareArrayToTokenDump(parseArray([
        'a (b\n \nc\n,\n\n \nd\n \ne\n)'
      ]), '(b (l id:"a" ((c id:"b" id:"c") (c id:"d" id:"e"))))');
    });

    it('Should emit parse errors', function () {
      compareArrayToTokenDump(parseArray([
        'a (b c))'
      ]),
      '(b (l id:"a" ((c id:"b" id:"c"))))',
      [
        {
          line: 1,
          column: 7,
          message: 'Misplaced close'
        },
        {
          line: 1,
          column: 7,
          message: 'Closing root'
        }
      ]);

      compareArrayToTokenDump(parseArray([
        'a (b) c)'
      ]),
      '(b (l id:"a" ((c id:"b")) id:"c"))',
      [
        {
          line: 1,
          column: 7,
          message: 'Misplaced close'
        },
        {
          line: 1,
          column: 7,
          message: 'Closing root'
        }
      ]);
      
      compareArrayToTokenDump(parseArray([
        'a (b] c)'
      ]),
      '(b (l id:"a" ((c id:"b") id:"c")))',
      [
        {
          line: 1,
          column: 4,
          message: 'Mismatched close'
        }
      ]);
      
      compareArrayToTokenDump(parseArray([
        'a b, c'
      ]),
      '(b (l id:"a" id:"b" id:"c"))',
      [
        {
          line: 1,
          column: 3,
          message: 'Misplaced ","'
        }
      ]);
      
      compareArrayToTokenDump(parseArray([
        'a (',
        '  b',
        '  c',
        ' d )'
      ]),
      '(b (l id:"a" ((b (l id:"b") (l id:"c")) id:"d")))',
      [
        {
          line: 4,
          column: 1,
          message: 'Indentation is less than enclosing block level'
        }
      ]);

      compareArrayToTokenDump(parseArray([
        'print "a\\xK0z" "a\\u0K20z" "a\\090z" "az'
      ]),
      '(b (l id:"print" val:"a?z" val:"a?z" val:"a?z"))',
      [
        {
          line: 1,
          column: 12,
          message: 'Unrecognized hex escape'
        },
        {
          line: 1,
          column: 23,
          message: 'Unrecognized unicode escape'
        },
        {
          line: 1,
          column: 32,
          message: 'Unrecognized octal escape'
        },
        {
          line: 1,
          column: 38,
          message: 'Unterminated string literal'
        }
      ]);
    });
    
    it('Should parse do blocks', function () {
      compareArrayToTokenDump(parseArray([
        'do',
        'a',
        'b'
      ]), '(b (l (d (b (l id:"a") (l id:"b")))))');

      compareArrayToTokenDump(parseArray([
        'a do',
        '  b',
        '  c',
        'd'
      ]), '(b (l id:"a" (d (b (l id:"b") (l id:"c")))) (l id:"d"))');

      compareArrayToTokenDump(parseArray([
        'a do k',
        '  b',
        '  c',
        'd'
      ]), '(b (l id:"a" (d id:"k" (b (l id:"b") (l id:"c")))) (l id:"d"))');

      compareArrayToTokenDump(parseArray([
        'a do k',
        'b',
        'c',
        'd'
      ]), '(b (l id:"a" (d id:"k" (b (l id:"b") (l id:"c") (l id:"d")))))');

      compareArrayToTokenDump(parseArray([
        'a do k',
        'b',
        'do',
        'c',
        'd'
      ]), '(b (l id:"a" (d id:"k" (b (l id:"b") (l (d (b (l id:"c") (l id:"d"))))))))');
    });
  });
    
  describe('#combine()', function () {
    it('Should combine symbols', function () {
      compareArrayToExpressionString(combineArray([
        '4 * 3'
      ]), '*(4, 3)');

      compareArrayToExpressionString(combineArray([
        'x + 3 * 5'
      ]), '+(x, *(3, 5))');

      compareArrayToExpressionString(combineArray([
        'x + y + z'
      ]), '+(+(x, y), z)');

      compareArrayToExpressionString(combineArray([
        'x + - y - + z'
      ]), '-(+(x, -x(y)), +x(z))');

      compareArrayToExpressionString(combineArray([
        'x * - y / + z'
      ]), '/(*(x, -x(y)), +x(z))');

      compareArrayToExpressionString(combineArray([
        '-x * - y / + z'
      ]), '/(*(-x(x), -x(y)), +x(z))');

      compareArrayToExpressionString(combineArray([
        '+ a * b'
      ]), '*(+x(a), b)');

      compareArrayToExpressionString(combineArray([
        'a b'
      ]), '<call>(a, b)');

      compareArrayToExpressionString(combineArray([
        'a(b)'
      ]), '<call>(a, b)');

      compareArrayToExpressionString(combineArray([
        'a(b, c)'
      ]), '<call>(a, <tuple>(b, c))');

      compareArrayToExpressionString(combineArray([
        'a[b]'
      ]), '<element>(a, b)');

      compareArrayToExpressionString(combineArray([
        'a([b, c])'
      ]), '<call>(a, <array>(b, c))');

      compareArrayToExpressionString(combineArray([
        'a.b'
      ]), '.(a, b)');

      compareArrayToExpressionString(combineArray([
        'a.b.c'
      ]), '.(.(a, b), c)');

      compareArrayToExpressionString(combineArray([
        'a.b[c]'
      ]), '<element>(.(a, b), c)');

      compareArrayToExpressionString(combineArray([
        'a[b].c'
      ]), '.(<element>(a, b), c)');

      compareArrayToExpressionString(combineArray([
        '++a'
      ]), '++x(a)');

      compareArrayToExpressionString(combineArray([
        'a--'
      ]), 'x--(a)');

      compareArrayToExpressionString(combineArray([
        '++a--'
      ]), '++x(x--(a))');

      compareArrayToExpressionString(combineArray([
        'f(a--)'
      ]), '<call>(f, x--(a))');

      compareArrayToExpressionString(combineArray([
        'if a b'
      ]), 'if(a, b)');

      compareArrayToExpressionString(combineArray([
        'if a if b c'
      ]), 'if(a, if(b, c))');

      compareArrayToExpressionString(combineArray([
        'if (if a (b + c) else x) d else y'
      ]), 'if(if(a, +(b, c), x), d, y)');

      compareArrayToExpressionString(combineArray([
        'if a do', '  b', '  c'
      ]), 'if(a, <do>(b, c))');

      compareArrayToExpressionString(combineArray([
        'if a do k', '  b p', '  c q'
      ]), 'if(a, <do>(<call>(k, <tuple>(<call>(b, p), <call>(c, q)))))');

      compareArrayToExpressionString(combineArray([
        'a do k', 'b', 'do', 'c', 'd'
      ]), '<call>(a, <do>(<call>(k, <tuple>(b, <do>(c, d)))))');

      compareArrayToExpressionString(combineArray([
        'x = y = z'
      ]), '=(x, =(y, z))');

      compareArrayToExpressionString(combineArray([
        'if a b else c'
      ]), 'if(a, b, c)');

      compareArrayToExpressionString(combineArray([
        'if a (b, c)'
      ]), 'if(a, <do>(b, c))');

      compareArrayToExpressionString(combineArray([
        'if a b', 'else c'
      ]), 'if(a, b, c)');

      compareArrayToExpressionString(combineArray([
        'if a do', '  t1', '  t2', 'else do', '  t3', '  t4'
      ]), 'if(a, <do>(t1, t2), <do>(t3, t4))');

      compareArrayToExpressionString(combineArray([
        '(a, b) -> b'
      ]), '->(<tuple>(a, b), b)');

      compareArrayToExpressionString(combineArray([
        '(a) -> (a a)'
      ]), '->(a, <call>(a, a))');

      compareArrayToExpressionString(combineArray([
        'a->a+b'
      ]), '->(a, +(a, b))');

      compareArrayToExpressionString(combineArray([
        '(a, b) -> do', '  a', '  b'
      ]), '->(<tuple>(a, b), <do>(a, b))');

      compareArrayToExpressionString(combineArray([
        '(a, b) -> return do', '  a', '  give b'
      ]), '->(<tuple>(a, b), return(<do>(a, give(b))))');

      compareArrayToExpressionString(combineArray([
        'do', 'a', 'b'
      ]), '<do>(a, b)');

    });
  });

  describe('#checkArity()', function () {
    it('Should detect arity errors', function () {
      compareArrayToExpressionString(combineArray([
        'if if a b c'
      ]), 'if(if(a, b), c)', [
        {
          line: 1,
          column: 3,
          message: 'branch cannot produce a value'
        },
        {
          line: 1,
          column: 3,
          message: 'Void expression'
        }
      ]);

      compareArrayToExpressionString(combineArray([
        '(a, b) ->', '  a', '  b'
      ]), '->(<tuple>(a, b), <tuple>(a, b))', [
        {
          line: 2,
          column: 2,
          message: 'should produce a simple value'
        }
      ]);
    });
  });

  describe('#resolve()', function () {
    it('Should resolve symbols', function () {
      compareArrayToExpressionString(resolveArray([
        'do',  'var (a = 0, b = 0)', 'a b'
      ]), '<do>(<do>(=(a, 0), =(b, 0)), <call>(a, b))');

      compareArrayToExpressionString(resolveArray([
        '(a, b) -> (a b)'
      ]), '->(<tuple>(a, b), <call>(a, b))');

      compareArrayToExpressionString(resolveArray([
        'var f = (a, b) -> (a b)'
      ]), '=(f, ->(<tuple>(a, b), <call>(a, b)))');

      compareArrayToExpressionString(resolveArray([
        '(a, b) -> (a.c + b.c)'
      ]), '->(<tuple>(a, b), +(.(a, c), .(b, c)))');
    });

    it('Should detect unresolved symbols', function () {
      compareArrayToExpressionString(resolveArray([
        'do', 'var (a, b)', 'c d'
      ]),
      '<do>(<tuple>(a, b), <call>(c, d))', [
        {
          line: 3,
          column: 0,
          message: 'Undeclared identifier "c"'
        },
        {
          line: 3,
          column: 2,
          message: 'Undeclared identifier "d"'
        }
      ]);

      compareArrayToExpressionString(resolveArray([
        'var f = (a, b) -> (c d)'
      ]),
      '=(f, ->(<tuple>(a, b), <call>(c, d)))', [
        {
          line: 1,
          column: 19,
          message: 'Undeclared identifier "c"'
        },
        {
          line: 1,
          column: 21,
          message: 'Undeclared identifier "d"'
        }
      ]);
    });

    it('Should detect illegal assignments', function () {
      compareArrayToExpressionString(resolveArray([
        'do', 'const (a = 0, b = 1)', 'a = b'
      ]),
      '<do>(<do>(=(a, 0), =(b, 1)), =(a, b))', [
        {
          line: 3,
          column: 0,
          message: 'not assignable'
        }
      ]);
    });

  });
});

