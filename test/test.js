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
          e.columnNumber === current.columnNumber &&
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
      ]), '(b (l id:"print" val:42 val:0.42 val:-42 val:4200000000000 val:2.4e-12))');

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
          lineNumber: 1,
          columnNumber: 7,
          message: 'Misplaced close'
        },
        {
          lineNumber: 1,
          columnNumber: 7,
          message: 'Closing root'
        }
      ]);

      compareArrayToTokenDump(parseArray([
        'a (b) c)'
      ]),
      '(b (l id:"a" ((c id:"b")) id:"c"))',
      [
        {
          lineNumber: 1,
          columnNumber: 7,
          message: 'Misplaced close'
        },
        {
          lineNumber: 1,
          columnNumber: 7,
          message: 'Closing root'
        }
      ]);
      
      compareArrayToTokenDump(parseArray([
        'a (b] c)'
      ]),
      '(b (l id:"a" ((c id:"b") id:"c")))',
      [
        {
          lineNumber: 1,
          columnNumber: 4,
          message: 'Mismatched close'
        }
      ]);
      
      compareArrayToTokenDump(parseArray([
        'a b, c'
      ]),
      '(b (l id:"a" id:"b" id:"c"))',
      [
        {
          lineNumber: 1,
          columnNumber: 3,
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
          lineNumber: 4,
          columnNumber: 1,
          message: 'Indentation is less than enclosing block level'
        }
      ]);

      compareArrayToTokenDump(parseArray([
        'print "a\\xK0z" "a\\u0K20z" "a\\090z" "az'
      ]),
      '(b (l id:"print" val:"a?z" val:"a?z" val:"a?z"))',
      [
        {
          lineNumber: 1,
          columnNumber: 12,
          message: 'Unrecognized hex escape'
        },
        {
          lineNumber: 1,
          columnNumber: 23,
          message: 'Unrecognized unicode escape'
        },
        {
          lineNumber: 1,
          columnNumber: 32,
          message: 'Unrecognized octal escape'
        },
        {
          lineNumber: 1,
          columnNumber: 38,
          message: 'Unterminated string literal'
        }
      ]);
    });
    
    it('Should parse do blocks', function () {
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
      compareArrayToExpressionString(parseArray([
        '4 * 3'
      ]).combine(), '*(4, 3)');

      compareArrayToExpressionString(parseArray([
        'x + 3 * 5'
      ]).combine(), '+(x, *(3, 5))');

      compareArrayToExpressionString(parseArray([
        'x + y + z'
      ]).combine(), '+(+(x, y), z)');

      compareArrayToExpressionString(parseArray([
        'x + - y - + z'
      ]).combine(), '-(+(x, -x(y)), +x(z))');

      compareArrayToExpressionString(parseArray([
        'x * - y / + z'
      ]).combine(), '/(*(x, -x(y)), +x(z))');

      compareArrayToExpressionString(parseArray([
        '-x * - y / + z'
      ]).combine(), '/(*(-x(x), -x(y)), +x(z))');

      compareArrayToExpressionString(parseArray([
        '+ a * b'
      ]).combine(), '*(+x(a), b)');

      compareArrayToExpressionString(parseArray([
        'a b'
      ]).combine(), '<call>(a, b)');

      compareArrayToExpressionString(parseArray([
        'a(b)'
      ]).combine(), '<call>(a, b)');

      compareArrayToExpressionString(parseArray([
        'a(b, c)'
      ]).combine(), '<call>(a, <tuple>(b, c))');

      compareArrayToExpressionString(parseArray([
        'a[b]'
      ]).combine(), '<element>(a, b)');

      compareArrayToExpressionString(parseArray([
        'a([b, c])'
      ]).combine(), '<call>(a, <array>(b, c))');

      compareArrayToExpressionString(parseArray([
        'a.b'
      ]).combine(), '.(a, b)');

      compareArrayToExpressionString(parseArray([
        'a.b.c'
      ]).combine(), '.(.(a, b), c)');

      compareArrayToExpressionString(parseArray([
        'a.b[c]'
      ]).combine(), '<element>(.(a, b), c)');

      compareArrayToExpressionString(parseArray([
        'a[b].c'
      ]).combine(), '.(<element>(a, b), c)');

      compareArrayToExpressionString(parseArray([
        '++a'
      ]).combine(), '++x(a)');

      compareArrayToExpressionString(parseArray([
        'a--'
      ]).combine(), 'x--(a)');

      compareArrayToExpressionString(parseArray([
        '++a--'
      ]).combine(), 'x--(++x(a))');

      compareArrayToExpressionString(parseArray([
        'f(a--)'
      ]).combine(), '<call>(f, x--(a))');

      compareArrayToExpressionString(parseArray([
        'if a b'
      ]).combine(), 'if(a, b)');

      compareArrayToExpressionString(parseArray([
        'if a if b c'
      ]).combine(), 'if(a, if(b, c))');

      compareArrayToExpressionString(parseArray([
        'if if a b c'
      ]).combine(), 'if(if(a, b), c)');

      compareArrayToExpressionString(parseArray([
        'if a do', '  b', '  c'
      ]).combine(), 'if(a, <do>(b, c))');

      compareArrayToExpressionString(parseArray([
        'if a do k', '  b p', '  c q'
      ]).combine(), 'if(a, <do>(<call>(k, <tuple>(<call>(b, p), <call>(c, q)))))');

      compareArrayToExpressionString(parseArray([
        'a do k', 'b', 'do', 'c', 'd'
      ]).combine(), '<call>(a, <do>(<call>(k, <tuple>(b, <do>(c, d)))))');

      compareArrayToExpressionString(parseArray([
        'x = y = z'
      ]).combine(), '=(x, =(y, z))');

      compareArrayToExpressionString(parseArray([
        'if a b else c'
      ]).combine(), 'if(a, <tuple>(b, c))');

      compareArrayToExpressionString(parseArray([
        'if a (b, c)'
      ]).combine(), 'if(a, <tuple>(b, c))');

      compareArrayToExpressionString(parseArray([
        'if a b', 'else c'
      ]).combine(), 'if(a, <tuple>(b, c))');

      compareArrayToExpressionString(parseArray([
        'if a do', '  t1', '  t2', 'else do', '  t3', '  t4'
      ]).combine(), 'if(a, <tuple>(<do>(t1, t2), <do>(t3, t4)))');

      compareArrayToExpressionString(parseArray([
        '(a, b) -> b'
      ]).combine(), '->(<tuple>(a, b), b)');

      compareArrayToExpressionString(parseArray([
        '(a) -> (a a)'
      ]).combine(), '->(a, <call>(a, a))');

      compareArrayToExpressionString(parseArray([
        'a->a+b'
      ]).combine(), '->(a, +(a, b))');
    });
  });

  describe('#resolve()', function () {
    it('Should resolve symbols', function () {
      compareArrayToExpressionString(parseArray([
        'var (a, b)', 'a b'
      ]).combine().resolve(),
      '<tuple>(var(<tuple>(a, b)), <call>(a, b))');

      compareArrayToExpressionString(parseArray([
        '(a, b) -> (a b)'
      ]).combine().resolve(),
      '->(<tuple>(a, b), <call>(a, b))');

      compareArrayToExpressionString(parseArray([
        'var f = (a, b) -> (a b)'
      ]).combine().resolve(),
      '=(var(f), ->(<tuple>(a, b), <call>(a, b)))');

      compareArrayToExpressionString(parseArray([
        '(a, b) -> (a.c + b.c)'
      ]).combine().resolve(),
      '->(<tuple>(a, b), +(.(a, c), .(b, c)))');
    });

    it('Should detect unresolved symbols', function () {
      compareArrayToExpressionString(parseArray([
        'var (a, b)', 'c d'
      ]).combine().resolve(),
      '<tuple>(var(<tuple>(a, b)), <call>(c, d))', [
        {
          lineNumber: 2,
          columnNumber: 0,
          message: 'Undeclared symbol "c"'
        },
        {
          lineNumber: 2,
          columnNumber: 2,
          message: 'Undeclared symbol "d"'
        }
      ]);

      compareArrayToExpressionString(parseArray([
        'var f = (a, b) -> (c d)'
      ]).combine().resolve(),
      '=(var(f), ->(<tuple>(a, b), <call>(c, d)))', [
        {
          lineNumber: 1,
          columnNumber: 19,
          message: 'Undeclared symbol "c"'
        },
        {
          lineNumber: 1,
          columnNumber: 21,
          message: 'Undeclared symbol "d"'
        }
      ]);
    });
  });
});

