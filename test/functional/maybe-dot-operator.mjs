'''
true
true
true
false
false
false
true
true
true
false
false
false
42
true
true
true
true
true
true
true
'''

var o = {
  p42: 42
  p-null: null
  o: {
    p42: 42
    p-null: null
  }
}

console.log(o.p42 ?)
console.log(o.p42 ??)
console.log(o.p-null ?)
console.log(o.p-null ??)
console.log(o.k ?)
console.log(o.k ??)

console.log(o.o.p42 ?)
console.log(o.o.p42 ??)
console.log(o.o.p-null ?)
console.log(o.o.p-null ??)
console.log(o.o.k ?)
console.log(o.o.k ??)

console.log(o.?p42)
console.log(o.?k == undefined)

console.log(o.?k.?p42 == undefined)
console.log(o.?k.?p-null == undefined)
console.log(o.?k.?k == undefined)

console.log(o.?p-null.?p42 == null)
console.log(o.?p-null.?p-null == null)
console.log(o.?p-null.?k == null)
