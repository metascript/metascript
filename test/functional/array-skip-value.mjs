'''
[  ]
[ number, number, number ]
[ number, number, undefined ]
[ undefined, undefined, undefined ]
[ undefined, undefined ]
'''

var
  a = []
  b = [10, 20, 30]
  c = [10, 20,]
  d = [,,]
  e = [,]

var dumper = (x) ->
  '[ ' + x.map( #-> typeof #it ).join(', ') + ' ]'

console.log(dumper a)
console.log(dumper b)
console.log(dumper c)
console.log(dumper d)
console.log(dumper e)
