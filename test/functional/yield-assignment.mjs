; mjs: es5Generators, runtime
'''
init: 3
loop: 2
loop: 1
'''

var gen = (x) ->
  while true
    x = yield x
    if (x == 0) return

var g = gen(3)
var x = g.next().value
console.log('init: ' + x)
while (!(var r = g.next(x - 1)).done)
  console.log('loop: ' + r.value)
  x = r.value