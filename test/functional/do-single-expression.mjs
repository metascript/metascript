'''
true
true
'''

do
  var f = (v) -> do
    v
  console.log(42 == f(42))

do
  var v = do
    42
  console.log(42 == v)
