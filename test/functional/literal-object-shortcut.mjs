'''
foo: foo
bar: bar
baz: baz
item: item
subitem: subitem
'''

var foo = 'foo'
var bar = 'bar'
var obj = {
  item: 'item'
  subobj: { subitem: 'subitem' }
}

var o = {foo, bar, baz: 'baz', obj.item, obj.subobj.subitem}

Object.keys(o).forEach
  (k) ->
    console.log(k + ': ' + o[k])
