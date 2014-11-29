'''
nested!
qux
3
qux
nested!
'''

var nested = {a: {b: {c: {d: {e: 'nested!' }}}}}
var fluent = {
  foo: () -> this
  bar: () -> this
  ; baz: o  ;; Node avoids creating circular references here
  qux: 'qux'
  nested: nested
}
fluent.baz = fluent  ;; But we can properly reference it outside

console.log nested .
  a
  b
  c
  d
  e

console.log fluent .
  qux

console.log fluent .
  qux
  length

console.log fluent .
  foo()
  bar.bind(fluent) 10
  bar
  bind(fluent) 20
  baz
  qux


console.log fluent .
  nested .
    a
    b
    c
    d
    e

