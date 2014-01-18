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

#### Data flow considerations

The Metascript compiler performs some basic data flow analysis on the code it processes.
Particularly, it checks the following:
- that every assignment has an assignable expression on its left side,
- that every expression produces the required value (or values),
- that every variable has been declared in the current scope,
- that every variable is not used undefined (this is still unimplemented), and
- that every block is properly terminated (this is also unimplemented and could be made useless by another planned change).

Every expression is evaluated in a context where a certain number of result values is required. For instance, consider the following assignment:

```
var a = b + c
```

Here the expression _b + c_ needs to produce one result because the assignment requires one value. In the following example, however, the expression needs to produce two values:

```
(o.x, o.y) = (x + dx, y + dy)
```

and in fact it is a tuple of length two. And, of course, the following example will cause a compile error:

```
var m = (x, y)
```

The rules are simple:
- Assignable expressions are:
    - variables and function arguments, and
    - the result of _member_ expressions (either _x.y_ or x[y]).
- Assignment operators count the number of expressions on their left, check that they are assignable, and require an equal number of values on the right.
- _if_ and _do_ expressions must produce the number of results required from their context
    - _if_ expressions produce results by simply evaluating them
    - since _do_ expressions already evaluate a sequence of expressions, a _give_ statement is required to specify the result of the _do_
- Function invocations are like a binary operator that requires one value on the left (the callee) and an argument on the right, which can be a tuple (the arguments).
- Every other operator requires exactly one value for each operand.

In Metascript it is necessary to specify the _do_ keyword every time a tuple is provided in a context where values are required but it must not be evaluated as a tuple. In this case the result of the _do_ expression (which _could_ be a tuple!) must be provided by a _give_ expression.
Of course _give_ expressions can be used inside conditional statements (_if_ branches), in any case when "evaluated" they terminate the current _do_ block and provide its result(s).

I am considering making a _give_ at the end of a _do_ optional, assuming that the last expression of the _do_ sequence will be its result, but I have not yet decided about it (the suggestion came from [Bamboo](http://bamboo.github.io/), the desigmer of [Boo](http://boo.codehaus.org/)). This is the change that would make block termination checks useless. With this change the above example could be written like this:

```
var status =
  if ok do
    console.log 'Starting up'
    engine.power 100
    'moving'
  else do
    console.log 'Stopping'
    engine.power 0
    'stopped'
```


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

### Variable declarations

Metascript, like Cofeescript, tries to shield the programmer from subtle errors that can creep into Javascript programs when an undeclared variable is assigned (which causes the creation of a new member of the global object).

However in Metascript the rules are different: the programmer must explicitly declare every variable.
Metascript puts every declaration at the beginning of the local "Javascript scope" in the generated code (which means either the beginning of the compilation unit, or the beginning of the current function), but it handles naming resolution like if the language had block scoping.
Moreover, Metascript does not allow the declaration of a variable with a name already used in the current scope (in this case I mean _block_ scope and not _function_ scope). I made this choice because scoping (and captured variables) are really important in Javascript, and I think that redefined names cause ambiguities reading code and should be avoided. Moreover, with this rule, if one does never relies on the value of undefined variables (note, _undefined_, not just _undeclared_!), for all practical purposes Metascript provides variable declarations with local scoping which IMHO is a very desirable thing to have.
And since the data flow analysis performed by the Metascript compiler disallows uses of undefined variables local (this piece of analysis is still unimplemented) using an undefined variable is not possible anyway.

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

About data flow analysis, the body of a function definition is handled as following:
- if it is:
    - a _do_ expression,
    - an non empty tuple, or
    - a _return_ expression
  it is assumed to provide no return value, otherwise
- the compiler will produce a return statement and will assume that the body expression must produce exactly one value, which will be returned by the function.
This way the programmer can always write very concise code but the compiler will anyway be able to perform data flow analysis with no ambiguities.

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
- Document the AST API that can be used inside macros.
- Wire the code to generate try-catch-finally
- Implement the type system
- Finish this TODO list :-)
