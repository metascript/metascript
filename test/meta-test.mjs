#external
  describe
  it

require 'should'

#defmacro 'describe'
  binaryKeyword
  KEY
  expand: () ->
    var code = #quote describe
      item
      () -> body
    code.replaceTag('item', ast.at 0)
    code.replaceTag('body', ast.at 1)
    code

#defmacro 'it'
  binaryKeyword
  KEY
  expand: () ->
    var code = #quote it
      item
      () -> body
    code.replaceTag('item', ast.at 0)
    code.replaceTag('body', ast.at 1)
    code

describe 'Metascript' (

it 'Should evaluate simple expression'
  (if true 1 else 2).should.equal 1

it 'Should evaluate modulus'
  (5 % 2).should.equal 1

it 'Should handle tuple assignments'
  var (a, b) = if true (1, 2) else (2, 1)
  a.should.equal(1)
  b.should.equal(2)
  (a, b) = (b, a)
  a.should.equal(2)
  b.should.equal(1)

it 'Should handle operator precedences'
  var obj = {
    nested : {
      m: () -> 'b'
    }
    m: () -> this.nested
  }
  var b = obj.m().m()
  b.should.equal 'b'
  ('a' + obj.m().m()).should.equal 'ab'

it 'Should handle loops'
  var f = (x) ->
    loop (var r = 1, x)
      if (x > 0)
        next (r * x, x - 1)
      else
        r
  f(1).should.equal(1)
  f(2).should.equal(2)
  f(3).should.equal(6)
  f(6).should.equal(6 * 5 * 4 * 3 * 2)


it 'Should handle nested do and if'
  var g = (x, y) -> do
    var (a, b) = do
      if (x > 0)
        give (1, 2)
      if (y > 0)
        give (3, 6)
      if (x + y < 0)
        give (4, 8)
      give (5, 10)
    return (b - a)

  g(1, 2).should.equal(1)
  g(-1, 2).should.equal(3)
  g(-1, -2).should.equal(4)
  g(NaN, -2).should.equal(5)


it 'Should handle object literals'
  var obj = {
    a: 1
    b: 2
  }

  obj.should.have.property('a', 1)
  obj.should.have.property('b', 2)

it 'Should handle array literals'
  var arr = [ 1, 2, 3 ]
  arr.should.have.property(0, 1)
  arr.should.have.property(1, 2)
  arr.should.have.property(2, 3)
  arr.should.have.lengthOf(3)
  (arr[0], arr[2]) = (arr[2], arr[0])
  arr.should.have.property(0, 3)
  arr.should.have.property(2, 1)

it 'Should handle method calls'
  var obj = {
    a: 1
    b: 2
  }
  obj.m = () ->
    this.a + this.b
  obj.m().should.equal(3)

it 'Should handle do blocks returning undefined'
  var obj = {
    m1: ()->1
    m2: ()->()
    m3: ()->
      this.m1()
      this.m2()
  }
  (typeof obj.m1()).should.equal('number')
  (typeof obj.m2()).should.equal('undefined')
  (typeof obj.m3()).should.equal('undefined')
  obj.m1().should.equal 1
  (obj.m2() == ()).should.equal(true)
  (obj.m3() == ()).should.equal(true)

it 'Should handle string concatenation'
  var obj = {}
  obj.world = ()->"world!"
  ("Hello "+ obj.world()).should.equal('Hello world!')
  obj = {
    world: ()->"world!"
  }
  ("Hello "+ obj.world()).should.equal('Hello world!')

it 'Should handle constructors'
  var C = (a) ->
    this.if = a
  var c = new C (4)
  c.should.have.property('if', 4)


it 'Should handle a simple macro'
  #defmacro "moo"
    unary
    KEY
    expand: () ->
      var code = #quote ('moo ' + (arg))
      code.replaceTag('arg', ast.at 0)
      code

  (moo 42).should.equal('moo 42')
  (moo 69).should.equal('moo 69')
  (moo ('Hello '+ 'meta!')).should.equal('moo Hello meta!')


it 'Should handle a macro involving \"this\"'
  #defmacro "@@@"
    unary
    HIGH
    expand: () ->
      var code = #quote this.arg
      code.replaceTag('arg', ast.at 0)
      code
  var obj = {
    a: 1
    b: 2
    m: () -> (@@@a + @@@b)
  }
  obj.m().should.equal 3

it 'Should have a proper \"@\" operator'
  #defmacro '@'
    unary
    HIGH
    expand: () ->
      var member = ast.at 0
      var code =
        if (member.isTag())
          #quote this.member
        else
          #quote this[member]
      code.replaceTag('member', member)
      code
  var obj = {
    a: 1
    b: 2
  }
  obj['aaa'] = 42
  obj.m1 = () -> (@a + @b)
  obj.m2 = (x, y) -> @(x + y)
  obj.m1().should.equal 3
  obj.m2('a', 'aa').should.equal 42

it 'Should have macros that rename variables'
  #defmacro 'vTagTest'
    unary
    KEY
    expand: () ->
      var count = ast.at 0
      var code = #quote do
        var \result = []
        loop (var \i = 0)
          if (\i < count)
            \result.push(\i)
            next (\i + 1)
          else \result
      code.replaceTag('count', count)
      code.resolveVirtual()
      code
  var vTagTestN = vTagTest 3
  vTagTestN.should.have.length(3)
  vTagTestN.should.have.property(0, 0)
  vTagTestN.should.have.property(1, 1)
  vTagTestN.should.have.property(2, 2)
  vTagTestN = vTagTest 2
  vTagTestN.should.have.length(2)
  vTagTestN.should.have.property(0, 0)
  vTagTestN.should.have.property(1, 1)

it 'Should handle the void operator'
  void (var a = 1)
  a.should.equal 1

it 'Should handle external symbols'
  #external myExternal
  (typeof myExternal == 'undefined').should.equal true

it 'Should handle try catch statements'
  var
    o = null
    c = false
    f = false
  try
    o.a = o.b.c
  catch var e
    c = true
  finally
    f = true
  c.should.equal true
  f.should.equal true

it 'Should handle try catch expressions'
  var
    o = null
    f = false
    c = false
    r =
      try
        o.a = o.b.c
      catch var e do
        c = true
        true
      finally
        f = true
  c.should.equal true
  r.should.equal true
  f.should.equal true
  r =
    try
      false
    catch var e
      true
  r.should.equal false

it 'Should handle giving void do invocations'
  var v = 0
  var f = () -> do
    v = 1
    give do
      v = 2
  f()
  v.should.equal 2

it 'Should handle || short circuit'
  var v = 1
  var t = (true || do (v = 2, give false))
  v.should.equal 1
  t.should.equal true

it 'Should handle && short circuit'
  var v = 1
  var t = (false && do (v = 2, give true))
  v.should.equal 1
  t.should.equal false

it 'Can replace tags with arrays inside code'
  #defmacro 'addTwice'
    binary
    expand: () ->
      var left = ast.at 0
      var right = ast.at 1
      var code = #quote (left += right)
      code.replaceTag('left', left)
      code.replaceTag('right', right)
      var result = #quote (do code)
      result.replaceTag('code', [code, code])
      result
  var a = 0
  a addTwice 1
  a.should.equal 2


#defmacro when
  binaryKeyword
  LOW
  expand: () -> ()

#defmacro then
  unary
  LOW
  expand: () -> ()

#defmacro async
  optional
  KEY
  expand: () -> ()

#defmacro now
  unary
  LOW
  dependent: ['when', 'then']
  expand: () ->
      var declarations = []
      var callbacksTagMap = new Object(null)
      var callbacksCodeMap = new Object(null)
      var thenCallbackTag = null
      var thenCallbackCode = null
      var body = ast.at 0
      loop (var i = 0)
        if (i >= ast.count) end
        var arg = ast.at i
        if (arg.id == 'when')
          var whenTag = arg.at(0)
          var whenTagName = arg.at(0).getTag()
          var whenTagCode = arg.at(1)
          if (callbacksTagMap[whenTagName])
            arg.error('Callback \"' + whenTagName + '\" already declared')
          var declaration = `(var (~` (whenTag.copy().handleAsTagDeclaration())) = null)
          declarations.push declaration
          callbacksTagMap[whenTagName] = whenTag
          callbacksCodeMap[whenTagName] = whenTagCode
          ast.remove(arg)
          next (i)
        else if (arg.id == 'then')
          if (thenCallbackTag != null)
            arg.error('Callback \"then\" already declared')
          else do!
            thenCallbackTag = #quote \thenCallback
            thenCallbackCode = arg.at(0)
            var thenDclaration = #quote (var \thenCallback = null)
            declarations.push thenDclaration
          ast.remove(arg)
          next (i)
        else
          next (i + 1)
      var processAsync = (e) -> do!
        if (e.id == 'async')
          if (e.count == 0)
            var tExp =
              if (thenCallbackTag != null)
                `(\thenCallback = ~`thenCallbackCode)
              else do
                e.error('Callback \"then\" not declared')
                give #quote null
            tExp.forEachRecursive processAsync
            e.replaceWith tExp
          else
            var wName = e.at(0).getTag()
            var wExp =
              if (callbacksTagMap[wName])
                `((~`callbacksTagMap[wName]) = (~`callbacksCodeMap[wName]))
              else do
                e.error('Callback \"' + wName + '\" not declared')
                give #quote null
            wExp.forEachRecursive processAsync
            e.replaceWith wExp
      body.forEachRecursive processAsync
      var result = `do
        ~`declarations
        do
          ~`body
      result.resolveVirtual()
      result


it 'Gives a way out of callback hell'
  var caller = (f) -> f()
  var activityLog = []
  var log = (x) -> activityLog.push x
  now
    log 0
    caller(async log1)
  when log1 () ->
    log 1
    caller(async log2)
  when log2 () ->
    log 2
    caller(async)
  then () -> do
  log 3
  now
    log 4
    caller(async)
  then () -> do
  log 5
  activityLog.should.have.length 6
  loop (var i = 0)
    if (i < activityLog.length)
      activityLog[i].should.equal i
      next (i + 1)
    else end


#defmacro "while"
  binaryKeyword
  LOW
  expand: () ->
    var code = #quote loop ()
      if (!(condition))
        end
      else
        body
        next ()
    code.replaceTag('condition', ast.at 0)
    code.replaceTag('body', ast.at 1)
    code

it 'Even has a while statement!'
  var (c = 1, r = '')
  while (c <= 3)
    r += c
    c = c + 1
  r.should.equal '123'

it 'Still supports simple expressions'
  (1 + 2 * 3).should.equal 7
  ('a' + 'b' + 'c').should.equal "abc"
  (typeof (1 + 2)).should.equal 'number'
  (typeof {}).should.equal 'object'
  (do (var a = 'a', a = a + a, a)).should.equal "aa"

it 'Can write macros better'
  #defmacro "@@@"
    unary
    HIGH
    expand: () ->
      `this. ~`ast.at 0
  var obj = {
    a: 1
    b: 2
    m: () -> (@@@a + @@@b)
  }
  obj.m().should.equal 3

it 'Supports readable identifiers'
  #defmacro '@'
    unary
    HIGH
    expand: () ->
      var member = ast.at 0
      if (member.isTag())
        `this. ~`member
      else
        ` this[~`member]
  var obj = {
    a: false
    b: false
    ok? : () -> (@a && @b)
    ok! : () -> do ((this.a, this.b) = (true, true), ())
  }
  obj.ok?().should.equal false
  obj.isOk().should.equal false
  obj.ok!()
  obj.ok?().should.equal true
  obj.isOk().should.equal true

it 'Handles binary keywords properly'
  var result =
    if 1 + 1 == 2 true
    else false
  result.should.equal true

#defmacro 'yield'
  unary
  LOW
  expand: () -> ()

#defmacro 'foreach'
  ternaryKeyword
  LOW
  expand: () ->
    var declaration = ast.at 0
    var assignable = declaration.getAssignable().copy().handleAsTagUse()
    var yielder = ast.at 1
    var body = ast.at 2
    var yieldCount = 0
    yielder.forEachRecursive
      (e) -> do!
        if (e.id == 'yield')
          yieldCount += 1
    if (yieldCount != 1) do
      yielder.error('Found ' + yieldCount + ' yield occurrences instead of 1')
      return ()
    yielder.forEachRecursive
      (e) -> do!
        if (e.id == 'yield')
          var value = e.at(0)
          var assignment = `do
            (~`assignable) = (~`value)
            ~`body
          e.replaceWith assignment
    `do
      ~`declaration
      ~`yielder

#defmacro 'indexesOf'
  unary
  LOW
  expand: () ->
    var result = `loop (var \i = 0)
      if (\i < (~`ast.at 0).length)
        yield \i
        next (\i + 1)
      else
        end
    result.resolveVirtual()
    result

#defmacro '..'
  binary
  LOW
  expand: () ->
    var result = `loop (var \i = (~`ast.at 0))
      if (\i <= (~`ast.at 1))
        yield \i
        next (\i + 1)
      else
        end
    result.resolveVirtual()
    result


it 'Has a prototype of foreach'
  var c
  var a = [1, 2, 3]
  var r = 0
  foreach (var idx) (indexesOf a)
    r += a[idx]
  r.should.equal(1 + 2 + 3)
  r = 0
  foreach (var v) (3 .. 5)
    r += v
  r.should.equal(3 + 4 + 5)


it 'Applies element and call precedences correctly'
  var o = {
    p: {a: [s -> s], f: () -> ( this.a ), m: ()->( this.p.a[0]('Hi!').length )}
  }
  o.p.f()[0]('Hi!').should.equal 'Hi!'
  o['p']['a'][0]('Hola!').should.equal 'Hola!'

it 'Handles call associativity correctly'
  var o = {
    f1: v ->
      v.should.equal 1
      o.f2
    f2: v ->
      v.should.equal 2
      o.f3
    f3: v ->
      v.should.equal 3
      4
  }
  o.f1(1)(2)(3).should.equal 4

it 'Supports callable macros'
  #meta
    do
      var concat = ast.createMacro('#concat', 'zero', 'NONE', {
        expandCall: (ast) ->
          ast.at(1).asTuple()
          `''.concat(~`ast.at(1))
      })
      ast.keyScope.set(concat.id, concat)
      null
  #concat('a', 'b', 'c').should.equal('abc')

it 'Handles do blocks with a single value correctly'
  var f = (v) -> do
    v
  f(true).should.equal true
  var v = do
    42
  v.should.equal 42

'''SKIP-ME
meta
  macro '<-'
    precedence: LOW
    arity: binary
    expand:
      var tuple = ast.newTuple()
      var right = ast.at 1
      loop (right) do
        if (right == ())
          end
        else if (right.isCall())
          tuple.push(right.at 0)
          next(right.at 0)
        else
          tuple.push(right)
          end
      if (tuple.argCount == 1)
        tuple.transformInto(tuple.at 0)
      var result = ast.newCall()
      result.push(ast.at 0)
      result.push tuple
      result

it 'Can simplify function calls'
  var f = (a, b, c) -> a + b + c
  (f <- 'a' 'b' 'c').should.equal('abc')
SKIP-ME
