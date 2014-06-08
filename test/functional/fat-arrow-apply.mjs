'''
global
global
'''

var obj1 = { id: 'obj1' }
var obj2 = { id: 'obj2' }

var id = 'global'
var fn = () => this.id

console.log(fn.apply(obj1, []))
console.log(fn.call(obj2))