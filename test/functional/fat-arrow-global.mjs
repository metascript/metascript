'''
foo
'''

this.foo-property = 'foo'

var fn = () =>
  this.foo-property

console.log(fn())
