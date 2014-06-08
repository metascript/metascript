; mjs: es5Generators, runtime
'''
undefined
'''
var gen = () ->
  yield

var g = gen()
while (!(var r = g.next()).done)
  console.log(typeof r.value)

