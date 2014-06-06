; mjs: es5Generators, runtime
'''
'''
var gen = () ->
  yield

var g = gen()
while (!(var r = g.next()).done)
  console.log(r.value)

