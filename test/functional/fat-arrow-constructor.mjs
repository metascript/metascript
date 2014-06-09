'''
foo
foo
'''

var O = () ->
  this.foo = 'foo'
  this.fn = () =>
    this.foo
  this

var o = new O()

console.log( o.fn() )

var fn = o.fn
console.log( fn() )