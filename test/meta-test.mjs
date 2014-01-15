require 'should'

meta
  macro 'describe'
    predecence: KEY
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
    predecence: KEY
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
  var C = (a) -> do
    this.if = a
  var c = new C (4)
  c.should.have.property('if', 4)

it 'Should handle a simple macro'
  meta
    macro "moo"
      predecence: KEY
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
      predecence: KEY
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
      predecence: KEY
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
      predecence: KEY
      expand: do
        var count = expr.argAt(0)
        var code = \<- do
          var \result = []
          loop (var \i = 0) do
            if (\i < count) do
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
    predecence: LOW
    arity: binary
    expand: do
      console.log('\\->')
      var replacements = expr.argAt(0)
      if (!replacements.isObject()) do
        expr.error('Object literal expected')
        give ()
      var code = expr.argAt(1)
      var codeTag = \<- \codeTag
      var result = \<- do
        var codeTag = code
        tagReplacements
        give codeTag
      var tagReplacements = []
      var ok = true
      replacements.forEach
        (replacement) -> do
          if (! (replacement.isProperty() && replacement.argAt(0).isTag())) do
            replacement.error('Tag definition expected')
            ok = false
          var replacementTag = replacement.argAt(0)
          console.log('  replacement   : ' + replacement.toExpressionString())
          console.log('  replacementTag: ' + replacementTag.toExpressionString())
          console.log('  replacementTag.val: ' + replacementTag.val)
          console.log('  replacementTag.getTag(): ' + replacementTag.getTag())
          console.log('  replacement.argAt(0).getTag()   : ' + replacement.argAt(0).getTag())
          ; var tagName = replacement.argAt(0).getTag()
          var tagName = replacement.argAt(0).val
          var quotedTagName = \<- 'name'
          console.log('  quotedTagName: ' + quotedTagName.toExpressionString())
          quotedTagName.val = tagName
          console.log('  quotedTagName: ' + quotedTagName.toExpressionString())
          var tagReplacement = \<- (codeTag.replageTag(quotedTagName, replacement))
          tagReplacement.replaceTag('codeTag', codeTag)
          tagReplacement.replaceTag('quotedTagName', quotedTagName)
          tagReplacement.replaceTag('replacement', replacement.argAt(1))
          tagReplacements.push tagReplacement
          console.log('  REPLACEMENT: ' + tagReplacement.toExpressionString())
      give \<- null





meta
  macro 'async'
    predecence: KEY
    arity: zero
    expand: ()

meta
  macro 'now'
    predecence: KEY
    arity: unary
    expand: do
      var body = expr.argAt(0)
      console.log('BODY START: ' + body.toExpressionString())
      var whenMap = new Object(null)
      loop (var i = 0) do
        if (i >= body.argCount()) end
        var arg = body.argAt(i)
        if (arg.id() == 'when') do
          console.log('  WHEN: ' + arg.toExpressionString())
          body.remove(arg)
          next (i)
        else if (arg.id() == 'then') do
          console.log('  THEN: ' + arg.toExpressionString())
          body.remove(arg)
          next (i)
        else
          next (i + 1)
      console.log('BODY END:   ' + body.toExpressionString())
      give null

;var test = { foo: null } \->
;  console.log('Meta')


meta
  macro 'when'
    predecence: KEY
    arity: binaryKeyword
    dependsFrom: 'now'
    expand: ()

meta
  macro 'then'
    predecence: KEY
    arity: unary
    dependsFrom: 'now'
    expand: ()


now
  console.log 'Now 1'
when foo
  () -> (console.log 'Foo')
when bar
  () -> (console.log 'Bar')
then
  () -> (console.log 'now then')


)
