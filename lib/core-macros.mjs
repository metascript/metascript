#external module

module.exports = (ast) -> do (

#meta
  var composeMacroArguments = (nameArg, argsTuple) ->
    var nameValue = nameArg.getSimpleValue()
    if (nameValue == null)
      argsTuple.error 'Invalid name argument'
      return null
    if (!(argsTuple.isTuple()))
      argsTuple.error 'Expected tuple argument'
      return null
    var
      ok = true
      name = nameArg.newValue nameValue
      arity = ast.newValue 'unary'
      precedence = ast.newValue 'LOW'
      options = ast.newObjectLiteral()
    loop (var index = 0)
      if (index < argsTuple.count)
        var arg = argsTuple.at index
        var simpleValue = arg.getSimpleValue()
        if (simpleValue != null)
          if (index == 0)
            arity = arg.newValue simpleValue
          else if (index == 1)
            precedence = arg.newValue simpleValue
          else
            arg.error('Invalid simple property')
            ok = false
        else if (arg.isProperty())
          var skip = false
          var property = arg.copy()
          var value = property.at 1
          var propertyName = (property.at 0).getSimpleValue()
          var simplePropertyValue = value.getSimpleValue()
          if (propertyName == 'arity' && simplePropertyValue != null)
            arity = arg.newValue simplePropertyValue
            skip = true
          else if (propertyName == 'precedence' && simplePropertyValue != null)
            precedence = arg.newValue simplePropertyValue
            skip = true
          else if (value.isFunctionDefinition())
            var func = value.copy()
            var macroBody = func.pop().asTuple()
            var macroArgs = func.pop().asTuple()
            func .push(arg.newTag 'ast')
            func.push macroBody
            loop (var argIndex = 0)
              if (argIndex < macroArgs.count)
                var macroArg = macroArgs.at argIndex
                if (macroArg.isTag())
                  var argDeclaration = #quote var __argName = ast.at __argIndex
                  argDeclaration.replaceTag('__argName', (macroArg.newTag(macroArg.getTag())).handleAsTagDeclaration())
                  argDeclaration.replaceTag('__argIndex', macroArg.newValue(argIndex))
                  macroBody.unshift argDeclaration
                else
                  macroArg.error 'Argument name expected'
                  ok = false
                next! argIndex + 1
            if ok
              property.pop()
              property.push func
          if (!skip)
            options.push property
        else
          arg.error('Invalid property')
          ok = false
        next! index + 1
    if ok [name, arity, precedence, options] else null

  ast.defineSymbol
    ast.createMacro
      '#exec-meta'
      'unary'
      'LOW'
      {
        preExpand: (ast) ->
          var code = (ast.at 0).copy()
          var innerDo = ast.newDo([code.copy(), ast.newTag 'null'])
          ast.newMeta innerDo
      }
  ast.defineSymbol
    ast.createMacro
      '#keep-meta'
      'unary'
      'LOW'
      {
        preExpand: (ast) ->
          var code = (ast.at 0).copy()
          var tail = #quote (ast.at(0).at(0).copy())
          var innerDo = ast.newDo([code.copy(), tail])
          ast.newMeta innerDo
      }

  ast.defineSymbol
    ast.createMacro
      '#macro'
      'binaryKeyword'
      'LOW'
      {
        expand: (ast) ->
          if (!ast.count == 2) do
            ast.error('Expected arguments: name and properties')
            return null
          var argsTuple = (ast.at 1).asTuple()
          var args = composeMacroArguments(ast.at 0, argsTuple)
          if (args != null) do
            var result = #quote (ast.createMacro(__arg0, __arg1, __arg2, __arg3))
            result.replaceTag('__arg0', args[0])
            result.replaceTag('__arg1', args[1])
            result.replaceTag('__arg2', args[2])
            result.replaceTag('__arg3', args[3])
            result
          else
            null
      }
  ast.defineSymbol
    ast.createMacro
      '#defmacro'
      'binaryKeyword'
      'LOW'
      {
        preExpand: (ast) ->
          if (!ast.count == 2) do
            ast.error('Expected arguments: name and properties')
            return null
          var argsTuple = (ast.at 1).asTuple()
          var args = composeMacroArguments(ast.at 0, argsTuple)
          if (args != null) do
            var definition = #quote (ast.defineSymbol(ast.createMacro(__arg0, __arg1, __arg2, __arg3)), null)
            definition.replaceTag('__arg0', args[0])
            definition.replaceTag('__arg1', args[1])
            definition.replaceTag('__arg2', args[2])
            definition.replaceTag('__arg3', args[3])
            ast.newMeta(ast.newDo(definition))
          else
            null
      }
  ast.defineSymbol
    ast.createMacro
      '#keepmacro'
      'binaryKeyword'
      'LOW'
      {
        preExpand: (ast) ->
          if (!ast.count == 2) do
            ast.error('Expected arguments: name and properties')
            return null
          var argsTuple = (ast.at 1).asTuple()
          var args = composeMacroArguments(ast.at 0, argsTuple)
          if (args != null) do
            var definition = #quote (ast.defineSymbol(ast.createMacro(__arg0, __arg1, __arg2, __arg3)), null)
            definition.replaceTag('__arg0', args[0])
            definition.replaceTag('__arg1', args[1])
            definition.replaceTag('__arg2', args[2])
            definition.replaceTag('__arg3', args[3])
            var result = ast.newMeta(ast.newDo(definition))
            result.sym = ast.keyScope.get '#keep-meta'
            result
          else
            null
      }

  ; Trick to compile the code twice: in this compilation context and for the generated JS.
  ; It removes this last statement from the code (so that it does not appear in the generated
  ; file) but makes so that the top level #meta keeps the code (by returning ast.at 0).
  do ((ast.at 0).pop(), ast.at 0)

#keepmacro '~`'
  unary
  expand: () -> ()

#keepmacro '`'
  unary
  LOW
  doNotExpandChildren: true
  expand: (code) ->
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

#keepmacro 'do!'
  unary
  LOW
  expand: (body) ->
    var statements = body.copy().asTuple()
    var result = `
      do
        ~` statements.map(arg -> arg)
        undefined
    result

#keepmacro '#metamodule'
  unary
  LOW
  expand: (body) ->
    `
      #external module
      module.exports = (ast) ->
        do
          do
            ~` body
          null

#keepmacro #metaimport
  arity: unary
  precedence: LOW
  preExpand: (moduleName) ->
    var moduleString = moduleName.getSimpleValue()
    if (typeof moduleString != 'string') do
      moduleName.error 'Invalid module name'
      null
    else
      moduleName.newMeta
        `
          try
            var
              path = require 'path'
              sourceName = ast.compiler.parser.source
              sourceDir = path.dirname sourceName
            (require (path.resolve (sourceDir, ~` (moduleName.newValue moduleString)))) (ast)
          catch (var e)
            ast.error('Error importing module: ' + e.toString())
          null

#keepmacro while
  arity: binaryKeyword
  precedence: LOW
  expand: (condition, body) ->
    ` loop ()
      if (~` condition) do
        do
          ~` body
        next! ()

#keepmacro .->
  arity: binary
  precedence: MEMBER
  expand: (start, following) ->
    var
      current = start
      others = following.asTuple()
      get-leftmost = (root) ->
        while (root.isCall() || root.isMember())
          root = root.at 0
        root
    while (others.count > 0)
      var
        other = others.shift()
        other-leftmost = get-leftmost other
      current =
        if (other-leftmost.parent == null)
          ` (~`current).(~`other-leftmost)
        else do
          var other-parent = other-leftmost.parent
          other-parent.shift()
          other-parent.unshift(` (~`current).(~`other-leftmost))
          other
    current

#keepmacro <-
  arity: binary
  precedence: MEDIUM
  expand: (callee, args) ->
    ` (~`callee)(~`args)

'''
#keepmacro @
  unary
  HIGH
  expand: member ->
    if (member.tag?())
      `this. ~`member
    else if (member.array?())
      if (member.count == 0)
        `this
      else if (member.count == 1)
        `this[~`member]
      else do
        member.error 'Member operator accepts only one operand'
        `undefined
    else
      `this[~`member]
'''

#keepmacro #->
  unary
  LOW
  expand: (body) ->
    var args = ast.newTuple()
    var process-next = true
    loop (var n = 1)
      if process-next
        process-next = false
        var
          current-id = '#' + n
          current-arg-name = '__$arg$' + n
        body.forEachRecursive
          node -> do!
            if (node.isPlaceholder() && (node.getSimpleValue() == current-id || (n == 1 && node.getSimpleValue() == '#arg')))
              if (!process-next)
                process-next = true;
                args.push((ast.newTag current-arg-name).handleAsFunctionArgument())
              node.replaceWith(node.newTag current-arg-name)
        next! n + 1
    `(~` args) -> (~` body)

null
)
