require 'should'

describe
  'Metascript'
  ()->do

it
  'Should work'
  ()->do

(if true 1 else 2).should.equal 1

var test = () -> do
  var a = null
  var b = null
  (a, b) = if true (1, 2) else (2, 1)
  a.should.equal(1)
  b.should.equal(2)
  (a, b) = (b, a)
  a.should.equal(2)
  b.should.equal(1)
test()

var f = (x) -> return do
  var r = 1
  give loop (r, x)
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
g(0/0, -2).should.equal(5)
