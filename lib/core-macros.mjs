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
        postCombine: (ast) ->
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
        postCombine: (ast) ->
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
        postCombine: (ast) ->
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
        postCombine: (ast) ->
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
  postCombine: moduleNames ->
    var moduleStrings = moduleNames.asTuple().map
      moduleName ->
        var moduleString = moduleName.getSimpleValue()
        if (typeof moduleString != 'string') do
          moduleName.error 'Invalid module name'
          moduleName
        else
          moduleName.newValue moduleString
    moduleNames.newMeta
      `
        try
          var metaRequire = (require 'require-like')(ast.compiler.parser.source)
          [~`moduleStrings].forEach
            m -> (metaRequire m) (ast)
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
    else if (member.placeholder?() && member.get-simple-value() == null)
      `this
    else
      `this[~`member]

#keepmacro #->
  unary
  LOW
  expand: (body) ->
    if (typeof body == 'undefined' || (body.isPlaceholder() && body.getSimpleValue() == null))
      body = ast.newTag 'undefined'
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
            if (node.isPlaceholder() && (node.getSimpleValue() == current-id || (n == 1 && node.getSimpleValue() == '#it')))
              if (!process-next)
                process-next = true;
                args.push((ast.newTag current-arg-name).handleAsFunctionArgument())
              node.replaceWith(node.newTag current-arg-name)
        next! n + 1
    `(~` args) -> (~` body)


; Fat arrow, binds `this` to the function's lexical context
#keepmacro =>
  arity: binary
  precedence: FUNCTION
  left-precedence: 'FUNCTION-LEFT'
  expand: (lhs, rhs) ->
    var traverser = #-> do!
      if (#it.isTag() && #it.getTag() == 'this')
        #it.replaceWith ` \captured-this
      if (! #it.function-definition?())
        #it.for-each #-> traverser #it
    traverser rhs
    var result = ` do
      var \captured-this = this
      (~` lhs) -> (~` rhs)
    result.resolveVirtual()
    result

#keepmacro #js
'''
  Same as eval but for literal values allows to directly embed it in the
  generated javascript code.

  Usage: js'bar ? 1 : -1'
'''
  unary
  HIGH
  expand: (expr) ->
    var code = ` (#external eval)( ~`(expr) )
    if (expr.value?())
      code.set('js', expr.get-value())
    code

#keepmacro #no-new-scope
  unary
  LOW
  expand: (expr) ->
    expr.set('no-new-scope', true)
    expr

#keepmacro ?
  arity: post
  precedence: MEMBER
  expand: (val) ->
    var result = `do
      var \val = ~`val
      if (typeof \val != 'undefined')
        true
      else
        false
    result.resolveVirtual()
    result

#keepmacro ??
  arity: binary
  precedence: LOGICAL-OR
  expand: (val, other) ->
    var result = `do
      var \val = ~`val
      if (typeof \val != 'undefined')
        \val
      else
        ~` other
    result.resolveVirtual()
    result

#keepmacro .?
  arity: binary
  precedence: MEMBER
  expand: (val, tag) ->
    if (! tag.tag?()) do
      tag.error 'Member name expected'
      return undefined
    var result = `do
      var \val = ~`val
      if (typeof \val != 'undefined' && \val != null)
        \val . ~`tag
      else
        \val
    result.resolveVirtual()
    result

null

#keepmacro |:
  arity: binary
  precedence: LOW
  left-precedence: 'CALL'
  expand: (start, exprs) ->
    var
      previous-shortcut = '#'
      previous-symbol = '#previous'
      next-symbol = '#next'
    var named-exprs = Object.create(null)
    var exprs-data = []

    var new-data = (expr, name) -> {
        expr: expr
        name: name
        first-occurrences: []
        occurrences: []
        previous: null
        next: null
      }

    var get-leftmost = (root) ->
      while (root.isCall() || root.isMember())
        root = root.at 0
      root

    var replace-placeholder = (expr, ph-name, replacement) -> do!
      expr.for-each-recursive
        ph -> do!
          if (ph.placeholder?() && ph.get-simple-value() == ph-name)
            ph.replace-with replacement

    var analyze-expr = (expr) -> do!
      var data =
        if (expr.property?())
          if ((expr.at 0).tag?()) do
            var property-name = (expr.at 0).getTag()
            if (named-exprs[property-name]?) do
              var property-data = named-exprs[property-name]
              if (property-data.expr != null)
                expr.error 'Redefined named expression'
              else
                property-data.expr = expr.at 1
              property-data
            else do
              expr.error 'Named expression defined before use'
              new-data(expr.at 1, null)
          else do
            (expr.at 0).error 'Invalid expression name'
            new-data(expr.at 1, null)
        else
          new-data(expr, null)
      data.expr.for-each-recursive
        ph -> do!
          if (ph.placeholder?())
            var ph-value = ph.get-simple-value()
            if (ph-value == null && ph.parent.property?() && (ph.parent.at 1) == ph) do!
              var ph-property = ph.parent
              var name = (ph-property.at 0).get-tag()
              if (name != null)
                var named-data =
                  if (named-exprs[name]?)
                    named-exprs[name]
                  else do
                    var d = new-data(null, name)
                    data.first-occurrences.push name
                    named-exprs[name] = d
                named-data.occurrences.push ph-property
              else
                ph-property.error 'Invalid expression name'
              ph-value = undefined
            if (ph-value == null || ph-value == previous-shortcut || ph-value == previous-symbol)
              if (data.previous == null)
                data.previous = ph
              else
                ph.error 'More than one previous reference specified'
            else if (ph-value == next-symbol)
              if (data.next == null)
                data.next = ph
              else
                ph.error 'More than one next reference specified'
      if (data.name == null)
        exprs-data.push data

    if (!start.placeholder?())
      analyze-expr start
    if (exprs.tuple?())
      exprs.for-each analyze-expr
    else
      analyze-expr exprs

    var has-forward-declarations = false
    exprs-data.for-each
      data -> do!
        var declaration =
          (name, expr) -> ` (var (~` (expr.newTag name).handle-as-tag-declaration()) = ~` expr)
        if (data.first-occurrences.length > 0)
          has-forward-declarations = true
          var expr = data.expr
          data.expr = ` #no-new-scope do
            ~` data.first-occurrences.map
              name ->
                if (named-exprs[name]? && named-exprs[name].expr != null) do
                  var named-expr = named-exprs[name]
                  named-expr.occurrences.for-each
                    occurrence -> occurrence.replace-with <- occurrence.newTag name
                  declaration(name, named-expr.expr)
                else do
                  data.expr.error <- 'Undefined named expression ' + name
                  data.expr.newTag undefined
            ~` expr.newTag '$$dataExpr$$'
          data.expr.replace-tag('$$dataExpr$$', expr)

    var previous = null
    var next-reference = null
    var last = null
    while (exprs-data.length > 0)
      var current = exprs-data.shift()
      if (previous != null && previous.next != null)
        if (current.previous != null)
          current.previous.error 'Cannot have a previous reference if the previous expression has a next reference'
        replace-placeholder(previous.expr, previous.next.get-simple-value(), current.expr)
        last = previous
      else
        if (current.previous != null)
          if (last != null)
            replace-placeholder(current.expr, current.previous.get-simple-value(), last.expr)
          else
            current.previous.error 'Cannot have a previous reference with no previous expression'
        else
          if (previous != null)
            if (!current.expr.call?())
              current.expr = `((~`current.expr) ())
            var leftmost = get-leftmost <- current.expr
            var leftmost-parent = leftmost.parent
            leftmost-parent.shift()
            leftmost-parent.unshift(` (~`last.expr).(~`leftmost))
        last = current
      previous = last

    if has-forward-declarations
      last.expr = ` do
        ~` last.expr
    last.expr

)
