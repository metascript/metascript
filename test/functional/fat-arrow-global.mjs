'''
foo
'''

var foo = 'foo'

var fn = () =>
  this.foo

console.log(fn())