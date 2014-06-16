'''
verbatim:30
eval:40
'''

var foo = 10
console.log( 'verbatim:' + #js'foo + 20' )

var code = 'foo + 30'
console.log( 'eval:' + #js code)
