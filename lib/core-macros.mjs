#meta
  var buildMacroArguments = (nameAst, argsTuple) ->
    if (!(argsTuple.isTuple()))
      argsTuple.error 'Expected tuple argument'
      return null
    var
      ok = true
      name = nameAst.getSimpleValue()
      arity = 'unary'
      precedence = 'LOW'
      options = {}
    if (name == null) do
      nameAst.error 'Invalid name'
      return null
    loop (var index = 0)
      if (index < argsTuple.count)
        var arg = argsTuple.at index
        var simpleValue = arg.getSimpleValue()
        if (simpleValue != null)
          if (index == 0)
            arity = simpleValue
          else if (index == 1)
            precedence = simpleValue
          else
            arg.error('Invalid simple property')
            ok = false
        else if (arg.isProperty())
          var property = arg.getPropertyValue()
          if (property != null)
            options[property.key] = property.value
          else
            arg.error('Malformed property')
            ok = false
        else
          arg.error('Invalid property')
          ok = false
        next index + 1
    if ok [name, arity, precedence, options] else null

  ast.defineSymbol
    ast.createMacro
      '#defmacro'
      'binaryKeyword'
      'LOW'
      {
        preExpand: (ast) ->
          if (!(ast.count == 2 && (ast.at 1).isTuple())) do
            ast.error('Expected arguments: name and properties')
            return null
          var args = buildMacroArguments(ast.at 0, ast.at 1)
          if (args != null)
            ast.defineSymbol
              ast.createMacro(args[0], args[1], args[2], args[3])
          null
      }

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
                  tagReplacement = #quote ((\codeTag).replaceTag(quotedTagName, replacement))
                child.replaceWith replacementNameTag
                tagReplacement.replaceTag('quotedTagName', replacementNameVal)
                tagReplacement.replaceTag('replacement', replacement)
                tagReplacements.push tagReplacement
                unquoteIndex += 1
              ()
          result.replaceTag('code', code)
          result.replaceTag('tagReplacements', tagReplacements)
          result.resolveVirtual()
          result
      }
  ;do ((ast.at 0).pop(), (ast.at 0).push(ast.newTag 'null'), ast.at 0)
  null

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
  ;do ((ast.at 0).pop(), (ast.at 0).push(ast.newTag 'null'), ast.at 0)
  null

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


