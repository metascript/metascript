require('source-map-support').install()

#metaimport './lib/testing'

var
  should = require 'should'
  Meta = require '..'
  mjs = Meta()

describe '#compilerFromString'

  it 'should produce an ast from valid code'
    var compiler = mjs.compiler-from-string 'var a = 42'
    var ast = compiler.produce-ast()
    ast.type.should.equal 'Program'

  it 'should report errors for invalid code'
    var compiler = mjs.compiler-from-string 'ff'
    var ast = compiler.produce-ast()
    should.not.exist ast
    compiler.errors.map(e -> e.message).should.eql
      ['Undeclared identifier "ff"']

  it 'should inherit options set at the meta level'
    var custom-mjs = Meta()
    custom-mjs.options.full-macro-errors = true
    custom-mjs.options.emit-identifier-statements = true
    var compiler = custom-mjs.compiler-from-string ''
    compiler.options.full-macro-errors.should.equal true
    compiler.options.emit-identifier-statements.should.equal true

  describe 'options.allowUndeclaredIdentifiers'

    it 'causes the compiler to not emit errors for undeclared identifiers'
      var custom-mjs = Meta()
      custom-mjs.options.allow-undeclared-identifiers = true
      var compiler = custom-mjs.compiler-from-string 'value = 42'
      var ast = compiler.produce-ast()
      var javascript = compiler.generate(ast).code

      var value = 0
      #external eval javascript
      value.should.equal 42
