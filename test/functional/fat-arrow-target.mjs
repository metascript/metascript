'''
global
'''

this.property = 'global'
var fn = () => this.property

var obj1 = {
  property: 'obj1'
  fn: fn
}

console.log( obj1.fn() )
