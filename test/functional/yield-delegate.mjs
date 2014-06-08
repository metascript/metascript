; mjs: es5Generators, runtime
'''
start
1
2
3
stop
'''

#defmacro 'yield-from'
  unary
  KEY
  expand: (arg) ->
    var code = ` yield ~`arg
    code.set('delegate', true)
    code


var inner = #->
  yield 1
  yield 2
  yield 3

var outer = #->
  yield 'start'
  yield-from inner()
  yield 'stop'


var g = outer()
while (!(var r = g.next()).done)
  console.log(r.value)