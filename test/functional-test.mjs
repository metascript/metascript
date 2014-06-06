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
  var code = fs.readFileSync(fname).toString()
  var compiler = Meta.compilerFromString(code, fname)
  compiler.options.fullMacroErrors = true

  ; Extract options from modeline
  if (code.substring(0, 6) == '; mjs:') do
    var line = code.substr(6, code.indexOf '\n')
    var modearg = new RegExp('\\s*([\\w\\d]+)(\\s*=\\s*[\\w\\d]+)?\\s*,?', 'g')
    line.replace
      modearg
      (m0, m1, m2) ->
        if (m2 == undefined || m2 == 'true' || m2 == 'on' || m2 == 'yes')
          m2 = true
        else
          if (m2 == 'false' || m2 == 'off' || m2 == 'no') do
            m2 = false

        compiler.options[m1] = m2

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
      if (#it.substr(#it.length-4) == '.mjs') return
      
      var fpath = path + #it
      it(#it.substr(0, #it.length - 4), #->
        compileAndAssert fpath
      )
