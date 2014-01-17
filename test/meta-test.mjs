require 'should'

meta
  macro 'describe'
    precedence: KEY
    arity: binaryKeyword
    expand: do
      var code = \<- describe
        item
        () -> do
          body
      code.replaceTag('item', expr.argAt(0))
      code.replaceTag('body', expr.argAt(1))
      give code

meta
  macro 'it'
    precedence: KEY
    arity: binaryKeyword
    expand: do
      var code = \<- it
        item
        () -> do
          body
      code.replaceTag('item', expr.argAt(0))
      code.replaceTag('body', expr.argAt(1))
      give code

describe 'Metascript' (

it 'Should evaluate simple expression'
  (if true 1 else 2).should.equal 1

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
        give r
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

it 'Should handle array literals' do
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
    m3: ()->do
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
  meta
    macro "moo"
      precedence: KEY
      expand: do
        var code = \<- ('moo ' + (arg))
        code.replaceTag('arg', expr.argAt(0))
        give code
  (moo 42).should.equal('moo 42')
  (moo 69).should.equal('moo 69')
  (moo ('Hello '+ 'meta!')).should.equal('moo Hello meta!')

it 'Should handle a macro involving \"this\"'
  meta
    macro "@@@"
      precedence: KEY
      expand: do
        var code = \<- this.arg
        code.replaceTag('arg', expr.argAt(0))
        give code
  var obj = {
    a: 1
    b: 2
    m: () -> (@@@a + @@@b)
  }
  (obj.m()).should.equal(3)

it 'Should have a proper \"@\" operator'
  meta
    macro '@'
      precedence: KEY
      expand: do
        var member = expr.argAt(0)
        var code =
          if (member.isTag())
            \<- this.member
          else
            \<- this[member]
        code.replaceTag('member', member)
        give code
  var obj = {
    a: 1
    b: 2
  }
  obj['aaa'] = 42
  obj.m1 = () -> (@a + @b)
  obj.m2 = (x, y) -> @(x + y)
  (obj.m1()).should.equal(3)
  (obj.m2('a', 'aa')).should.equal(42)

it 'Should have macros that rename variables'
  meta
    macro 'vTagTest'
      precedence: KEY
      expand: do
        var count = expr.argAt(0)
        var code = \<- do
          var \result = []
          loop (var \i = 0)
            if (\i < count)
              \result.push(\i)
              next (\i + 1)
            else end
          give \result
        code.replaceTag('count', count)
        give code
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

it 'Should handle giving void do invocations'
  var v = 0
  var f = ()->do
    v = 1
    give do
      v = 2
  f()
  v.should.equal 2

it 'Should handle || short circuit'
  var v = 1;
  var t = (true || do (v = 2, give false))
  v.should.equal 1
  t.should.equal true

it 'Should handle && short circuit'
  var v = 1;
  var t = (false && do (v = 2, give true))
  v.should.equal 1
  t.should.equal false

it 'Can replace tags with arrays inside code'
  meta
    macro 'addTwice'
      arity: binary
      expand: do
        var left = expr.argAt(0)
        var right = expr.argAt(1)
        var code = \<- (left += right)
        code.replaceTag('left', left)
        code.replaceTag('right', right)
        var result = \<- (do code)
        result.replaceTag('code', [code, code])
        give result
  var a = 0
  a addTwice 1
  a.should.equal 2

meta
  macro '\\->'
    precedence: LOW
    arity: binary
    expand: do
      var replacements = expr.argAt(0)
      if (!replacements.isObject())
        expr.error('Object literal expected')
        return ()
      var code = expr.argAt(1)
      var codeTag = \<- \codeTag
      var result = \<- do
        var codeTag = \<- code
        tagReplacements
        give codeTag
      var tagReplacements = []
      var ok = true
      replacements.forEach
        (replacement) -> do
          if (! (replacement.isProperty() && replacement.argAt(0).isTag()))
            replacement.error('Tag definition expected')
            ok = false
          var tagName = replacement.argAt(0).getTag()
          var quotedTagName = \<- 'name'
          quotedTagName.val = tagName
          var tagReplacement = \<- (codeTag.replaceTag(quotedTagName, replacement))
          tagReplacement.replaceTag('codeTag', codeTag)
          tagReplacement.replaceTag('quotedTagName', quotedTagName)
          tagReplacement.replaceTag('replacement', replacement.argAt(1))
          tagReplacements.push tagReplacement
      if (!ok)
        give \<- null
      result.replaceTag('codeTag', codeTag)
      result.replaceTag('code', code)
      result.replaceTag('tagReplacements', tagReplacements)
      give result


meta
  macro 'async'
    precedence: KEY
    arity: optional
    expand: ()

meta
  macro 'now'
    precedence: LOW
    arity: unary
    expand: do
      var declarations = []
      var callbacksTagMap = new Object(null)
      var callbacksCodeMap = new Object(null)
      var thenCallbackTag = null
      var thenCallbackCode = null
      var body = expr.argAt(0)
      loop (var i = 0)
        if (i >= expr.argCount()) end
        var arg = expr.argAt(i)
        if (arg.id() == 'when')
          var whenTag = arg.argAt(0)
          var whenTagName = arg.argAt(0).getTag()
          var whenTagCode = arg.argAt(1)
          if (callbacksTagMap[whenTagName])
            arg.error('Callback \"' + whenTagName + '\" already declared')
          var declaration = {
            whenTag: whenTag
          } \-> (var whenTag = null)
          declarations.push declaration
          callbacksTagMap[whenTagName] = whenTag
          callbacksCodeMap[whenTagName] = whenTagCode
          expr.remove(arg)
          next (i)
        else if (arg.id() == 'then')
          if (thenCallbackTag != null)
            arg.error('Callback \"then\" already declared')
          else do
            thenCallbackTag = \<- \thenCallback
            thenCallbackCode = arg.argAt(0)
            var thenDclaration = \<- (var \thenCallback = null)
            declarations.push thenDclaration
          expr.remove(arg)
          next (i)
        else
          next (i + 1)
      var processAsync = (e) -> do
        if (e.id() == 'async')
          if (e.argCount() == 0)
            var tExp =
              if (thenCallbackTag != null)
                {
                  thenCallbackCode : thenCallbackCode
                } \-> (\thenCallback = thenCallbackCode)
              else do
                e.error('Callback \"then\" not declared')
                give \<- null
            tExp.forEachRecursive processAsync
            e.replaceWith tExp
          else
            var wName = e.argAt(0).getTag()
            var wExp =
              if (callbacksTagMap[wName]) do
                give {
                  whenCallbackTag : callbacksTagMap[wName]
                  whenCallbackCode : callbacksCodeMap[wName]
                } \-> (whenCallbackTag = whenCallbackCode)
              else do
                e.error('Callback \"' + wName + '\" not declared')
                give \<- null
            wExp.forEachRecursive processAsync
            e.replaceWith wExp
      body.forEachRecursive processAsync
      var result = {
        declarations: declarations
        body: body
      } \-> do
        declarations
        body
      give result



meta
  macro 'when'
    precedence: LOW
    arity: binaryKeyword
    dependsFrom: 'now'
    expand: ()

meta
  macro 'then'
    precedence: LOW
    arity: unary
    dependsFrom: 'now'
    expand: ()


it 'Gives a way out of callback hell'
  var caller = (f) -> f()
  var activityLog = []
  var log = (x) -> activityLog.push x
  now
    log 0
    caller(async log1)
  when log1 () -> do
    log 1
    caller(async log2)
  when log2 () -> do
    log 2
    caller(async)
  then () -> do
  log 3
  now do
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

