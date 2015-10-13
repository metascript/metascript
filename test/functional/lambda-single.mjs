'''
function
30
100
foobar
x is 10
identity implicit
identity explicit
'''

console.log(typeof \\ 1 + 1)

; placeholder on expressions is autocompleted with argument
var lambda1 = \\ #1 + #2
var lambda2 = \\ *

console.log(lambda1(10, 20))
console.log(lambda2(10))

var caller = fn -> fn()
var caller-with-arg = (x, fn) -> fn(x)

console.log( caller \\ 'foo' + 'bar' )

caller \\
  var x = 10
  console.log <- 'x is ' + x

; empty lambda serves as identity
console.log( caller-with-arg('identity implicit') \\ )

; which is equivalent to this
console.log( caller-with-arg('identity explicit') \\ #it )
