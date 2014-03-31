#external module
module.exports = (ast) -> do (
#meta
  ast.defineSymbol
    ast.createMacro('~`', 'unary', 'LOW', {})
  ast.defineSymbol
    ast.createMacro
      '`'
      'unary'
      'LOW'
      {
        ;subordinate: [ast.createMacro('~`', 'unary', 'LOW', {})]
        expand: (ast) ->
          var code = ast.at 0
          var result = #quote do
            var \codeTag = #quote code
            tagReplacements
            \codeTag
          var tagReplacements = []
          var unquoteIndex = 1
          code.forEachRecursive
            (child) -> do
              if (child.id == '~`')
                var
                  replacement = child.at 0
                  replacementName = 'unquote' + unquoteIndex;
                  replacementNameVal = child.newValue replacementName
                  replacementNameTag = child.newTag replacementName
                  tagReplacement = #quote (\codeTag.replaceTag(quotedTagName, replacement))
                child.replaceWith replacementNameTag
                tagReplacement.replaceTag('quotedTagName', replacementNameVal)
                tagReplacement.replaceTag('replacement', replacement)
                tagReplacements.push tagReplacement
                unquoteIndex += 1
          result.replaceTag('code', code)
          result.replaceTag('tagReplacements', tagReplacements)
          result
      }
  do ((ast.at 0).pop(), (ast.at 0).push(ast.newTag 'null'), ast.at 0)


#meta
  ast.defineSymbol
    ast.createMacro
      '@'
      'unary'
      'HIGH'
      {
        expand: (ast) ->
          `this. ~`ast.at 0
      }
  do ((ast.at 0).pop(), (ast.at 0).push(ast.newTag 'null'), ast.at 0)

var obj = {
  a: 1
  b: 2
  m: () -> (@a + @b)
}
console.log(obj.m() == 3)

null

; Trick to compile the code twice: in this compilation context and for the generated JS.
; It removes this last statement from the compiled (Javascript) version of the file but makes
; so that the top level #meta puts the code in the Javascript AST (by returning ast.at 0).
;do ((ast.at 0).pop(), ast.at 0)

)
