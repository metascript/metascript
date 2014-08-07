'''
42
true
true
true
true
true
'''

var o = {
  p40: 40
  p2: 2
  42: true
  m1: #-> @p40 + @p2
  m2: #-> @[42]
  m3: #-> @[40 + 2]
  m4: #-> @42
  m5: #-> @[]
  m6: #-> (@)
}

console.log(o.m1())
console.log(o.m2())
console.log(o.m3())
console.log(o.m4())
console.log(o.m5() == o)
console.log(o.m6() == o)
