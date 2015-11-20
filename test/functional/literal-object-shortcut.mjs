'''
foo: foo
bar: bar
baz: baz
item: item
subitem: subitem
nested: nested
'''

var foo = 'foo'
var bar = 'bar'
var obj = {
  item: 'item'
  subobj: { subitem: 'subitem' }
  subarr: [ {nested: 'nested'} ]
}

var o = {foo, bar, baz: 'baz', obj.item, obj.subobj.subitem, obj.subarr[0].nested}

Object.keys(o).forEach
  (k) ->
    console.log(k + ': ' + o[k])
