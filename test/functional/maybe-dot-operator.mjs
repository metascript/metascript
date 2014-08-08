'''
true
true
false
true
true
false
42
true
true
true
true
true
true
true
42
42
true
true
42
true
42
'''

var o = {
  p42: 42
  p-null: null
  f: #-> 42
  o: {
    p42: 42
    p-null: null
    f: #-> 42
  }
}

console.log(o.p42 ?)
console.log(o.p-null ?)
console.log(o.k ?)

console.log(o.o.p42 ?)
console.log(o.o.p-null ?)
console.log(o.o.k ?)

console.log(o.?p42)
console.log(o.?k == undefined)

console.log(o.?k.?p42 == undefined)
console.log(o.?k.?p-null == undefined)
console.log(o.?k.?k == undefined)

console.log(o.?p-null.?p42 == null)
console.log(o.?p-null.?p-null == null)
console.log(o.?p-null.?k == null)

console.log(o.p42 ?? false)
console.log(o.k ?? 42)
console.log((o.p-null ?? 42) == null)

console.log((o.?p-null<-?()) == undefined)
console.log(o.?f<-?())
console.log((o.?k<-?()) == undefined)
console.log(o.?o.?f<-?())
