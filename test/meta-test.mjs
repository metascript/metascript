require 'should'

meta
  macro 'describe'
    predecence: KEY
    arity: binaryKeyword
    expand: do
      var code = \<- describe
        item
        () -> body
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
        () -> body
      code.replaceTag('item', expr.argAt(0))
      code.replaceTag('body', expr.argAt(1))
      give code

describe 'Metascript' do

it 'Should work' do


(if true 1 else 2).should.equal 1

var test = () -> do
  var (a, b) = if true (1, 2) else (2, 1)
  a.should.equal(1)
  b.should.equal(2)
  (a, b) = (b, a)
  a.should.equal(2)
  b.should.equal(1)
test()

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

var obj = {
  a: 1
  b: 2
}
obj.should.have.property('a', 1);
obj.should.have.property('b', 2);

var arr = [ 1, 2, 3 ]
arr.should.have.property(0, 1);
arr.should.have.property(1, 2);
arr.should.have.property(2, 3);
arr.should.have.lengthOf(3);

(arr[0], arr[2]) = (arr[2], arr[0])
arr.should.have.property(0, 3);
arr.should.have.property(2, 1);

obj.m = () ->
  this.a + this.b
obj.m().should.equal(3)

var voidFunction = () -> do
  ( (typeof voidFunction())
    .should.equal('undefined')  )

obj.world = ()->"world!"
("Hello "+ obj.world()).should.equal('Hello world!')

obj = {
  world: ()->"world!"
}
("Hello "+ obj.world()).should.equal('Hello world!')

(() -> do
  var C = (a) -> do
    this.if = a
  var c = new C (4)
  c.should.have.property('if', 4);
)()

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

meta
  macro "@@@"
    predecence: KEY
    expand: do
      var code = \<- this.arg
      code.replaceTag('arg', expr.argAt(0))
      give code

obj = {
  a: 1
  b: 2
  m: () -> (@@@a + @@@b)
}
(obj.m()).should.equal(3)

meta
  macro '@'
    predecence: KEY
    expand: do
      var member = expr.argAt(0)
      var code = if (member.isTag())
        \<- this.member
        \<- this[member]
      code.replaceTag('member', member)
      give code
obj['aaa'] = 42
obj.m1 = () -> (@a + @b)
obj.m2 = (x, y) -> @(x + y)

(obj.m1()).should.equal(3)
(obj.m2('a', 'aa')).should.equal(42)

require 'should'
var util = require 'util'

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
vTagTestN.should.have.property(0, 0);
vTagTestN.should.have.property(1, 1);
vTagTestN.should.have.property(2, 2);
vTagTestN = vTagTest 2
vTagTestN.should.have.length(2)
vTagTestN.should.have.property(0, 0);
vTagTestN.should.have.property(1, 1);

