var Meta = (require('./meta'))();
var should = require('should');

var parse_string = function(s) {
  var compiler = Meta.compiler_from_string(s);
  compiler.parse();
  return compiler;
}

var parse_array = function(a) {
  return parse_string(a.join('\n'));
}

var compare_array_dump = function(a, expected, errors) {
  var compiler = parse_array(a);
  if (typeof errors == 'undefined') errors = [];
  compiler.should.have.property('errors').with.lengthOf(errors.length);
  compiler.should.have.property('root');
  if (expected != null) {
    var dump = compiler.root.string_dump();
    dump.should.equal(expected);
  }
  for (var i = 0; i < compiler.errors.length; i++) {
    var e = compiler.errors[i];
    var found = false;
    for (var j = 0; j < errors.length; j++) {
      var current = errors[j];
      if (e.line == current.line &&
          e.column_number == current.column_number &&
          e.message.indexOf(current.message) >= 0) {
        found = true;
        break;
      }
    };
    found.should.equal(true);
  }
}

describe("Meta.Compiler", function() {
  describe("#parse()", function() {
    it('Should parse symbols and values', function() {
      compare_array_dump([
        'print "Hello!"'
      ],'(b (l id:"print" val:"Hello!"))');

      compare_array_dump([
        'print 42'
      ],'(b (l id:"print" val:42))');

      compare_array_dump([
        'print 42.0 .42 -42 4.2e12 2.4e-12'
      ],'(b (l id:"print" val:42 val:0.42 val:-42 val:4200000000000 val:2.4e-12))');

      compare_array_dump([
        'print _12312 $_q12'
      ],'(b (l id:"print" id:"_12312" id:"$_q12"))');

      compare_array_dump([
        'print "a\\x20\\040z"'
      ],'(b (l id:"print" val:"a  z"))');

      compare_array_dump([
        'print "\\n\\t" "xy\\uaBcDz" ""'
      ],'(b (l id:"print" val:"\n\t" val:"xy\uaBcDz" val:""))');

      compare_array_dump([
        'print """END\n1\n2\n3\nEND\nok'
      ],'(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');

      compare_array_dump([
        'print """\n1\n2\n3\n"""\nok'
      ],'(b (l id:"print" val:"123") (l id:"ok"))');

      compare_array_dump([
        "print '''END\n1\n2\n3\nEND\nok"
      ],'(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');

      compare_array_dump([
        "print '''\n1\n2\n3\n'''\nok"
      ],'(b (l id:"print" val:"1\n2\n3\n") (l id:"ok"))');
    })

    it('Should parse symbols and operators', function() {
      compare_array_dump([
        'a + b *** !@# @$d.k.abc'
      ],'(b (l id:"a" op:"+" id:"b" op:"***" op:"!@#" op:"@" id:"$d" op:"." id:"k" op:"." id:"abc"))');

      compare_array_dump([
        'a <== b <!> -> _\\$/z'
      ],'(b (l id:"a" op:"<==" id:"b" op:"<!>" op:"->" id:"_" op:"\\" id:"$" op:"/" id:"z"))');
    })

    it('Should parse blocks', function() {
      compare_array_dump([
        'a (b c)'
      ],'(b (l id:"a" (id:"b" id:"c")))');

      compare_array_dump([
        'a {b [d e] c}'
      ],'(b (l id:"a" {id:"b" [id:"d" id:"e"] id:"c"}))');

      compare_array_dump([
        'a (',
        '  b',
        '  c',
        ')'
      ],'(b (l id:"a" ((b (l id:"b") (l id:"c")))))');

      compare_array_dump([
        'l1a',
        '  l2a',
        '    l3a',
        '    l3b1 l3b2',
        '  l2b',
        '    l3a',
        '    l3b',
        'l1b'
      ],'(b (l id:"l1a" (b (l id:"l2a" (b (l id:"l3a") ' +
        '(l id:"l3b1" id:"l3b2"))) (l id:"l2b" (b (l id:"l3a") (l id:"l3b"))))) (l id:"l1b"))');

      compare_array_dump([
        'l1a',
        '  l2a',
        '  l2b',
        'l1b',
        '  l2c',
        '  l2d'
      ],'(b (l id:"l1a" (b (l id:"l2a") (l id:"l2b"))) (l id:"l1b" (b (l id:"l2c") (l id:"l2d"))))');
    })

    it('Should ignore comments and literate strings', function() {
      compare_array_dump([
        'a (b c) ; Hello!'
      ],'(b (l id:"a" (id:"b" id:"c")))');

      compare_array_dump([
        'a {b [d e] c};;;'
      ],'(b (l id:"a" {id:"b" [id:"d" id:"e"] id:"c"}))');

      compare_array_dump([
        '; Comment...',
        'a (',
        '; Comment...',
        '  b',
        '; Comment...',
        '  c',
        '; Comment...',
        ')',
        '; Comment...'
      ],'(b (l id:"a" ((b (l id:"b") (l id:"c")))))');

      compare_array_dump([
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
      ],'(b (l id:"l1a" (b (l id:"l2a" (b (l id:"l3a") ' +
        '(l id:"l3b1" id:"l3b2"))) (l id:"l2b" (b (l id:"l3a") (l id:"l3b"))))) (l id:"l1b"))');

      compare_array_dump([
        'l1a',
        '  l2a',
        '  l2b',
        'l1b',
        '  l2c',
        '  l2d'
      ],'(b (l id:"l1a" (b (l id:"l2a") (l id:"l2b"))) (l id:"l1b" (b (l id:"l2c") (l id:"l2d"))))');
    })
    
    it('Should parse commas', function() {
      compare_array_dump([
        'a (b c, d e, f g)'
      ],'(b (l id:"a" ((c id:"b" id:"c") (c id:"d" id:"e") (c id:"f" id:"g"))))');

      compare_array_dump([
        'a [b \nc,\n d\n e\n]'
      ],'(b (l id:"a" [(c id:"b" id:"c") (c id:"d" id:"e")]))');

      compare_array_dump([
        'a (b\n \nc\n,\n\n \nd\n \ne\n)'
      ],'(b (l id:"a" ((c id:"b" id:"c") (c id:"d" id:"e"))))');
    })

    it('Should emit parse errors', function() {
      compare_array_dump([
        'a (b c))'
      ],
      '(b (l id:"a" (id:"b" id:"c")))',
      [
        {
          line_number: 1,
          column_number: 7,
          message: 'Misplaced close'
        },
        {
          line_number: 1,
          column_number: 7,
          message: 'Closing root'
        }
      ]);

      compare_array_dump([
        'a (b) c)'
      ],
      '(b (l id:"a" (id:"b") id:"c"))',
      [
        {
          line_number: 1,
          column_number: 7,
          message: 'Misplaced close'
        },
        {
          line_number: 1,
          column_number: 7,
          message: 'Closing root'
        }
      ]);
      
      compare_array_dump([
        'a (b] c)'
      ],
      '(b (l id:"a" ((c id:"b") id:"c")))',
      [
        {
          line_number: 1,
          column_number: 4,
          message: 'Mismatched close'
        }
      ]);
      
      compare_array_dump([
        'a b, c'
      ],
      '(b (l id:"a" id:"b" id:"c"))',
      [
        {
          line_number: 1,
          column_number: 3,
          message: 'Misplaced ","'
        }
      ]);
      
      compare_array_dump([
        'a (',
        '  b',
        '  c',
        ' d )'
      ],
      '(b (l id:"a" ((b (l id:"b") (l id:"c")) id:"d")))',
      [
        {
          line_number: 4,
          column_number: 1,
          message: 'Indentation is less than enclosing block level'
        }
      ]);

      compare_array_dump([
        'print "a\\xK0z" "a\\u0K20z" "a\\090z" "az'
      ],
      '(b (l id:"print" val:"a?z" val:"a?z" val:"a?z"))',
      [
        {
          line_number: 1,
          column_number: 12,
          message: 'Unrecognized hex escape'
        },
        {
          line_number: 1,
          column_number: 23,
          message: 'Unrecognized unicode escape'
        },
        {
          line_number: 1,
          column_number: 32,
          message: 'Unrecognized octal escape'
        },
        {
          line_number: 1,
          column_number: 38,
          message: 'Unterminated string literal'
        }
      ]);


    })


  })
})

