'''
Enumerations of keywords and predefined symbols 
'''

#external exports

; List of reserved JavaScript identifiers
exports.RESERVED = [
  'abstract'
  'as'
  'boolean'
  'break'
  'byte'
  'case'
  'catch'
  'char'
  'class'
  'continue'
  'const'
  'debugger'
  'default'
  'delete'
  'do'
  'double'
  'else'
  'enum'
  'export'
  'extends'
  'false'
  'final'
  'finally'
  'float'
  'for'
  'function'
  'goto'
  'if'
  'implements'
  'import'
  'in'
  'instanceof'
  'int'
  'interface'
  'is'
  'long'
  'namespace'
  'native'
  'new'
  'null'
  'package'
  'private'
  'protected'
  'public'
  'return'
  'short'
  'static'
  'super'
  'switch'
  'synchronized'
  'this'
  'throw'
  'throws'
  'transient'
  'true'
  'try'
  'typeof'
  'use'
  'var'
  'void'
  'volatile'
  'while'
  'with'
  'yield'
]

; List of predefined external symbols in JavaScript
; (just a joke for now, we need to have presets like jshint)
; (eventually we will also parse typescript definitions)
exports.PREDEFINED = [
  'Object'
  'String'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-8.5
  'Number'
  'Infinity'
  ; https://github.com/joyent/node/wiki/ECMA-5-Mozilla-Features-Implemented-in-V8
  'JSON'
  'Boolean'
  'Date'
  'Array'
  'Function'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-15.11.1
  'Error'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-4.3.25
  'parseInt'
  'Math'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-15.10
  'RegExp'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-B.2.1
  'escape'
  ; http://www.ecma-international.org/ecma-262/5.1/#sec-B.2.2
  'unescape'
  
  'window'
  'console'
  'require'

  'this'
  'NaN'
  'true'
  'false'
  'undefined'
  'null'
]