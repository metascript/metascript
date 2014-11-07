#external
  __dirname
  process
  global
  describe
  it


var fs = require 'fs'
var vm = require 'vm'
var Meta = require('../')();
require 'should'

var mocked-console = {
  output: []
  log: (ln) -> this.output.push ln
  reset: () ->
    this.output = []
}
global.mocked-console = mocked-console


var compileAndAssert = (fname) ->
  var code = fs.readFileSync(fname).toString()
  var compiler = Meta.compilerFromString(code, fname)
  compiler.options.fullMacroErrors = true

  ; Extract options from modeline
  if (code.substring(0, 6) == '; mjs:') do
    var line = code.substr(6, code.indexOf "\n")
    var modearg = new RegExp('\s*([\w\d]+)(\s*=\s*([\w\d]+))?\s*,?', 'g')
    line.replace
      modearg
      (m0, m1, m2, m3) ->
        if (m3 == undefined || m3 == 'true' || m3 == 'on' || m3 == 'yes')
          m3 = true
        else
          if (m3 == 'false' || m3 == 'off' || m3 == 'no') do
            m3 = false

        compiler.options[m1] = m3

  ; Register our mocked print function in the compiler scope
  ; HACK: varRootScope is initialized but never used :-s
  ;compiler.varRootScope.set('print', {
  ;  name: 'print'
  ;  tag: null
  ;  isAssignable: false
  ;})

  var ast = compiler.produceAst()
  if compiler.errors.length > 0 do
    throw {name: 'CompilerError', message: compiler.errors.join("\n")}
  
  var expected = compiler.root.get('doc')
  console.assert(typeof expected == 'string', 'Testcase does not have a docblock')
  expected = expected.trim()

  var result = compiler.generate ast

  mocked-console.reset()

  try do
    vm.runInThisContext
      "(function (console) {" + result.code + "\n})(mockedConsole)"
      fname

    expected.should.equal( mocked-console.output.join("\n") )
  catch (var e) do
    if process.env.VERBOSE do
      console.log('')
      console.log(fname + "\n" + (new Array(fname.length)).join('=') + "=\n")
      console.log(compiler.root.printAst())
      console.log('')
      console.log(result.code)
    throw e


describe
  'functional'
  #->
    var path = __dirname + '/functional/'
    fs.readdirSync(path).forEach #->
      if (#it.substr(-4) != '.mjs') return
      
      var fpath = path + #it
      it(#it.substr(0, #it.length - 4), #->
        compileAndAssert fpath
      )
