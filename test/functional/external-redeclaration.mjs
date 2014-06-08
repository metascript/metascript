'''
external-redeclaration.mjs
true
'''

var first = (#external __filename)
var second = (#external __filename)

console.log first
console.log (first == second)
