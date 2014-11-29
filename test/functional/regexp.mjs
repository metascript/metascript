'''
simple: /[a-z]+/
multi: /(?:)[a-z]+(?:)/
no-comment: /\d   #comment/
modifiers head: /\d+/gi
modifiers tail: /\d+/gi
test: true
replace: f00
'''

console.log <- 'simple: ' + #r'[a-z]+'

console.log <- 'multi: ' + #r'''
    [a-z]+     # regexp comment
'''

console.log <- 'no-comment: ' + #r'\d   #comment'

console.log <- 'modifiers head: ' + #r'(?ig)\d+'
console.log <- 'modifiers tail: ' + #r'''\d+ (?ig)'''

console.log <- 'test: ' + #r'\d'.test 10

console.log <- 'replace: ' + 'foo'.replace(#r'(?g)[o]', '0')
