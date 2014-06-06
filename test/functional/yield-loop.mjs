; mjs: es5Generators, runtime
'''
5
4
3
2
1
'''

var gen = (x) ->
  while (x)
    yield x
    x = x - 1

var g = gen(5)
while (!(var r = g.next()).done)
  console.log(r.value)