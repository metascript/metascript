'''
<  this text will not be trimmed but will have no new lines  >
Length: 2
    multiline inside an array
    another one
    with two lines
  a multiline inside a function
'''

var a = '''
  this text will not be trimmed but will have no new lines  
'''
console.log('<' + a + '>')

var b = [
  '''
    multiline inside an array
  '''
  ''''
    another one
    with two lines
  ''''
]

console.log('Length: ' + b.length)
console.log(b[0])
console.log(b[1])

var fn = () ->
  '''
  a multiline inside a function
  '''

console.log(fn())