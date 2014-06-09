'''
obj
global
'''

this.property = 'global'
var makefn = () =>
  () -> this.property

var obj = {
  property: 'obj'
  fn: makefn()
}
console.log(obj.fn())
console.log(obj.fn.call(this))
