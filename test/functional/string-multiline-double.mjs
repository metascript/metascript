'''
<this text will be trimmed>
Length: 2
multiline inside an array
another one with lines folded
a multiline inside a function
'''

var a = """
  this text will be trimmed  
"""
console.log('<' + a + '>')

var b = [
  """
    multiline inside an array
  """
  """"
    another one
    with lines folded
  """"
]

console.log('Length: ' + b.length)
console.log(b[0])
console.log(b[1])

var fn = () ->
  """
  a multiline inside a function
  """

console.log(fn())