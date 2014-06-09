'''
global
'''

var id = 'global'
var fn = () => this.id

var obj1 = {
  id: 'obj1'
  fn: fn
}

console.log( obj1.fn() )