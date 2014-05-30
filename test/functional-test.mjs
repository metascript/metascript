#external
  __dirname
  process
  describe
  it



var fs = require 'fs'
var vm = require 'vm'
var Meta = require('../')();
require 'should'


var compileAndAssert = (fname) ->
  var compiler = Meta.compilerFromFile(fname)
  compiler.options.fullMacroErrors = true

  ; Register our mocked print function in the compiler scope
  ; HACK: varRootScope is initialized but never used :-s
  ;compiler.varRootScope.set('print', {
  ;  name: 'print'
  ;  tag: null
  ;  isAssignable: false
  ;})

  var ast = compiler.produceAst()
  if compiler.errors.length > 0 do
    throw {name: 'CompilerError', message: compiler.errors.join('\n')}
  
  var expected = compiler.root.__doc__
  expected.should.be.type('string')
  expected = expected.trim()

  var result = compiler.generate ast

  var output = []
  var sandbox = {
    console: {
      log: (line) -> output.push(line)
    }
  }

  try do
    vm.runInNewContext(result.code, sandbox, fname)
    expected.should.equal( output.join('\n') )
  catch (var e) do
    if process.env.VERBOSE do
      console.log('')
      console.log(fname + '\n' + (new Array(fname.length)).join('=') + '=\n')
      console.log(result.code)
    throw e



describe
  'functional'
  #->
    var path = __dirname + '/functional/'
    fs.readdirSync(path).forEach #->
      var fpath = path + #it
      it(#it, #->
        compileAndAssert fpath
      )