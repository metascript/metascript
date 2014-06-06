; mjs: es5Generators, runtime
'''
yield: 3
yield: 2
yield: 1
return: end
'''

var gen = (x) ->
  while true
    yield x
    x = x - 1
    if (x == 0) return 'end'

var g = gen(3)
var r
while (!(r = g.next()).done)
  console.log('yield: ' + r.value)
console.log('return: ' + r.value)