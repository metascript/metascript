'''
global
global
'''

var obj1 = { property: 'obj1' }
var obj2 = { property: 'obj2' }

this.property = 'global'
var fn = () => this.property

console.log(fn.apply(obj1, []))
console.log(fn.call(obj2))
