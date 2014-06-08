; mjs: es5Generators, runtime
'''
10
'''

var gen = () ->
  yield 10

var g = gen()
while (!(var r = g.next()).done)
  console.log(r.value)
