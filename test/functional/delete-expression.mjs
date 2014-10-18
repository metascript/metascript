'''
true
false
'''
var log = f ->
  console.log f()

var obj = {x: 1}
log #-> delete obj.x
log #-> delete obj
