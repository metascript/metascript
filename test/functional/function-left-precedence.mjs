'''
42
42
42
42
'''

var logger = f -> console.log f (42, 1)

logger it -> it
logger (a, b) -> (a * b)
logger it => it
logger (a, b) => (a * b)
