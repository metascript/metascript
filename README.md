Metascript
==========

This is an attempt at creating a new language that compiles to Javascript.
The main goal is to have a language that can have a readable syntax, and at the same time allow lisp-style metaprogramming (macros that can manipulate the AST).
Another goal is to have a type system, for optionally performing static type checking (with type inference).


Project status
--------------

There is a library (npm module) implementing the compiler, and everything described below already works.
Have a look at the TODO list at the end to see what's coming next.


A quick taste of the language
-----------------------------

Our favorite first statement:

```
console.log 'Hello, Metascript!'
```

An 'if' expression:

```
require 'should'
(if true 1 else 2).should.equal 1
```

A concise definition of a function that returns the factorial of its argument (note that the syntax looks like a tail recursive definition but it is compiled into a plain loop):

```
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
```

Metascript supports real macros! Here is how we could define an '@' operator that behaves like the Coffeescript one:

```
meta
  macro "@"
    predecence: KEY
    expand: do
      var code = \<- this.arg
      code.replaceTag('arg', expr.argAt(0))
      give code
var obj = {
  a: 1
  b: 2
  m: () -> (@a + @b)
}
obj.m().should.equal(3)
```

More generally, the core Metascript language is relatively small and every advanced construct can be implemented with macros.


Motivation
---------------------

The fact that Javascript  is a "problematic" language is well known.
Somebody takes it as it is, while others have implemented transpilers that translate arguably better languages into Javascript.

I have examined several of those projects but none of them is ideal for me.
[Coffeescript](http://coffeescript.org/) is really nice, probably the only issue I have with it is that its syntax is a bit irregular. Other than that I like how it encourages a more functional coding style, how it fixes comparison operators and in general the readability of Coffeescript code.
Then [Typescript](http://www.typescriptlang.org/) adds a type system that can be useful for large projects. However as a language it is still plain Javascript, with all its problems.
Having a mix of Coffescript and Typescript would be nice but they cannot be "merged": one has to choose.
And finally, the thing I am missing the most is language extensibility, in the form of [Metaprogramming](http://en.wikipedia.org/wiki/Metaprogramming) as you can do with Lisp and Scheme macros. There is a nice language, [Lispyscript](http://lispyscript.com/), that tries to bring this to Javascript, but it is a Lisp, with its syntax full of parenthesis which for me is not ideal...

Several other languages have inspired me in various ways:
 - [Boo](http://boo.codehaus.org/) is simply amazing, but it is designed with a CLI runtime environment in mind and not a Javascript one.
 - [Roy](http://roy.brianmckenna.org/) is an interesting attempt at providing a [Haskell](http://www.haskell.org/haskellwiki/Haskell)-like language.
 - [Clojurescript](https://github.com/clojure/clojurescript) also provides metaptogramming, with the issue that macros must be written in [Clojure](http://clojure.org/) instead...

In the end I decided that none of them fits my bill completely, and I implemented Metascript.

Basic syntax
------------

The goal is to have a language that can have a readable syntax (inspired by Coffeescript), and at the same time allow lisp-style metaprogramming (macros that can manipulate the AST).

Lisp-like languages have a "clean" syntax because, in a sense, they have no syntax at all: they explicitly use parenthesis everywhere to express the grouping of expressions.
Metascript uses a combination of parenthesis, indentation and infix operators so that the syntax is more "comfortable" and similar to the one used in mainstream programming languages.

### Expressions

Simple expressions are intuitive to read:

```
(1 + 2 * 3).should.equal 7
```

In Metascript there is no real distinction between expression and statement: almost every construct is an expression.
Particularly, 'if', 'loop' and 'do' (_do_ is the equivalent of code blocks) are expressions that produce values and can be freely nested inside other expressions:

```
var mood = if happy ':-)' else ':-('
```

In general this reduces the need for temporary variables and encourages (or at least allows) a more 'functional' coding style.

### Grouping

Of course more complex expressions will need some form of grouping.
In general expressions can be grouped for two reasons:
- to evaluate all of them and pass the results to another expression (like in the case of the arguments of a function call), or
- simply to evaluate all of them sequentially discarding the values (like in a code block).
In both cases the developer can choose to group expression with parenthesis or indentation.
When parenthesis are used the subexpressions must be separated by commas ',':

```
functionCall(1, 2, 3)
```

while when indentation is used the separators are the line breaks:
```
functionCall
  1
  2
  3
```

The idea is that indentation levels add nested parenthesized expressions to the parent expression. Every newline can do one of three things:
- be _more_ indented: it adds a nested subexpressions as an operand of the current one,
- be _less_ indented: it closes all the expressions (or blocks) that are more indented and resumes adding operands to the current level
- be at the _same_ level as the previous line: it adds another subexpression to the current block
Note that the indentation rules are simple and they do not depend on operator precedence at all. Inside each line of code, however, standard Javascript operator precedence rules are applied.

Since with these rules the semicolon delimiter ';' is totally useless (commas work just fine) in Metascript it starts a comment:

```
; Here is a comment!
console log 'The above line is a comment.'
```

which means that ending lines with semicolons is harmless but useless :-)

### Control flow expressions

#### if

An _if_ expression works mostly as expected.
It can have only one consequent, like here:

```
if problem
  console.log error
```

or it can have an else branch:

```
if ok
  activate engine
else
  stop
```

If it is complete (it has both a consequent and an else branch) it can be used as a nested expression similarly to the Javascript ternary 'c ? x : y' operator.
Note that the "natural" Metascript _if_ should be written with in a 'Lisp style', with a condition and a tuple containing the two branches:

```
if ok
  activate engine
  stop
```

However the _else_ keyword is provided to enhance the readability of _if_ expressions.
This is relevant when writing macros because the _else_ keywords are stripped away during the parse phase and are not present in the AST used for macro expansion.

#### do

To understand the need for _do_ blocks we should have a look at tuple assignments first.
In Metascript one can write

```
var (a, b) = (1, 2)
a.should.equal 1
b.should.equal 2
```

and even

```
var (a, b) = if true (1, 2) else (3, 4)
a.should.equal 1
b.should.equal 2
(a, b) = (b, a)
a.should.equal 2
b.should.equal 1
```

In other words, a sequence of expressions is just that: a sequence of values (or, better, a _tuple_).
_if_, _do_, _loop_ and all the assignment operators can deal with tuples, and technically every function invocation uses a tuple as arguments.

Now consider the following two _if_ expressions:

```
; A tuple evaluation
var (a, b) = if condition (f 1, f 2) else (f 3, f 4)

; Imperative execution of expressions, discarding their values
if condition do
  f 1
  f 2
else do
  f 3
  f 4
```

It should be clear that in the second one _f_ is invoked discarding its return value, only for its eventual side effects, and the _if_ expression executes one of the two _do_ blocks according to the value of _condition_.

However, _do_ expression **can** return a value!
Consider the following:

```
var status =
  if ok do
    console.log 'Starting up'
    engine.power 100
    give 'moving'
  else do
    console.log 'Stopping'
    engine.power 0
    give 'stopped'
```

The meaning should be clear: status will be either 'moving' or 'stopped', the _if_ works like an expression selecting one of the two values, and the two _do_ code blocks execute 'statements' (they evaluate expressions but discard their values) but they also 'return' values so that the _if_ expression can use them.

#### loop

Metascript has only one kind of _loop_ expression, and it tries to mimic the syntax of tail recursive invocations (but it generates plain loops in Javascript). Just like in Lisp-like languages, other looping constructs can be defined with macros.

Let's write the 'factorial' computation of a number _x_ that we get from some _input_ function:

```
var x = input()
var r = loop (r = 1, x)
  if (x > 0)
    next (r * x, x - 1)
  else
    give r
console.log('The factorial of ' + x + ' is ' + r)
```

A _loop_ expression has two arguments:
- a tuple of assignable expressions (with optional initializers), and
- one expression which is the loop body.
Just like a _do_, it can be terminated with a _give_ statement which provides the result of the _loop_ expression.
However it also allows the use of a _next_ statement, which:
- needs a tuple of values, of the same length of the _loop_ tuple,
- provides one new value for each element of the _loop_ tuple, and
- jumps to the beginning of the loop.
This final 'jump' performed by _next_ is what makes _loop_ work like a tail recursive function, and the _loop_ tuple acts like the arguments of this imaginary function.
The _next_ and _give_ keywords are one of the few Metascript constructs that are not expressions: they cannot "provide a value" because they are like jump statements.

_TODO_ Explain better why I choose this as the only looping primitive and how every other loop construct can be implemented as a macro (and there will be a standard library of such macros).

### Function definitions

Functions are defined as expressions using the '->' operator (the resulting value must be used or assigned somwehere), with a syntax just like the Cofeescript one:

```
square = (x) -> x * x
cube = (x) -> square(x) * x
square(2).should.equal 4
cube(2).should.equal 8
```

To remind the grouping syntax, the following definitions do the same thing as the above ones:

```
square = (x) ->
  x * x
cube = (x) ->
  square(x) * x
```

### _TODO:_ try, catch, finally

I have wired them in the parser but I still do not generate code for them.

### _TODO:_ switch, case

Technically, a _switch_ could be implemented with a sequence of chained _if...else_ expressions, so it could be implemented as a macro.
However there is one special case where being able to emit a real Javascript _switch_ statement would have a small performance advantage: if the _case_ arguments are all integers, a smart virtual machine can emit a very fast jump table.

I plan to implement a _switch_ expression that
- can detect this basic case and emit a Javascript switch, and
- can be easily extended with various matching patterns in case statements
but I still have to do it :-)


Metaprogramming
---------------

_TODO:_ Explain macros

TODO list
---------

- Organize the todo list as issues that can be tracked on Github
- Publish the module on npm
- Implement a proper command line compiler
- Write more useful macros
    - looping ones
    - generators
    - array comprehension
    - destructuring assignments and structure matchers
    - switch
    - small useful operators
    - 'double arrow' functions
- Settle on an API for a module system for macros (meta-modules!)
- Implement the type system
- Finish this TODO list :-)
