; mjs: es5Generators, runtime
'''
start
1
2
3
stop
'''

var inner = #->
  yield 1
  yield 2
  yield 3

var outer = #->
  yield 'start'
  yield from inner()
  yield 'stop'


var g = outer()
while (!(var r = g.next()).done)
  console.log(r.value)