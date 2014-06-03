Metascript
==========

This is yet another programming language that compiles to Javascript.
The main goal is to have a language that can have a readable syntax, and at the same time allow lisp-style metaprogramming (macros that can manipulate the AST).
Another goal is to have a type system, for optionally performing static type checking (with type inference).


Project Status
--------------

[![Build Status](https://travis-ci.org/massimiliano-mantione/metascript.svg?branch=master)](https://travis-ci.org/massimiliano-mantione/metascript)

There a library (npm module) implementing the compiler, with a script to invoke it on from the command line (as 'mjs <input.mjs>').
Everything described below already works, and the compiler generates source maps by default.


To run the tests, do the following:
- clone the repository at "https://github.com/massimiliano-mantione/metascript", then
- run "npm install" and "npm test".

Otherwise, if you only want to try the compiler, just do "npm install meta-script" and have fun running the 'mjs' script. But I'd still suggest to have a look at the tests written in Metascript to see some code samples.

There is [Gulp](http://gulpjs.com/) integration [here](http://github.com/bamboo/gulp-mjs), and a [Lighttable](http://www.lighttable.com/) plugin [here](http://github.com/bamboo/MightTable), thanks to [Bamboo](http://bamboo.github.io/).

There is a Google group (metascript@googlegroups.com), discussion about Metascript is supposed to happen there.

Have a look at the TODO list at the end to see what's coming next.


A Quick Taste of the Language
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
      next! (r * x, x - 1)
    else
      give! r
f(1).should.equal(1)
f(2).should.equal(2)
f(3).should.equal(6)
f(6).should.equal(6 * 5 * 4 * 3 * 2)
```

Metascript supports real macros! Here is how we could define an '@' operator that behaves like the Coffeescript one:

```
#defmacro @
  arity: unary
  precedence: HIGH
  expand: (arg) ->
    `this . ~`arg

var obj = {
  a: 1
  b: 2
  m: () -> (@a + @b)
}

obj.m().should.equal(3)
```

In the above code '`' is the *quote* operator, and '~`' is the *unquote* one.

More generally, the core Metascript language is relatively small and every advanced construct can be implemented with macros (about metaprogramming, the only primitive is a very basic '#quote' operator, everything else is done with macros, including ` and ~`).


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
 - [Clojurescript](https://github.com/clojure/clojurescript) also provides metaprogramming and is _really_ nice, with the issue that it still has a Lisp-plagued syntax and that it feels "closer" to the [Clojure](http://clojure.org/) ecosystem than to the Javascript one...

In the end I decided that none of them fits my bill completely, and I implemented Metascript.

The Metascript Language
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
Particularly, 'if', 'loop', 'do' (_do_ is the equivalent of code blocks) and 'try' are expressions that produce values and can be freely nested inside other expressions:

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

### Control Flow Expressions

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
    give! 'moving'
  else do
    console.log 'Stopping'
    engine.power 0
    give! 'stopped'
```

The meaning should be clear: status will be either 'moving' or 'stopped', the _if_ works like an expression selecting one of the two values, and the two _do_ code blocks execute 'statements' (they evaluate expressions but discard their values) but they also 'return' values so that the _if_ expression can use them.

#### Data flow considerations

The Metascript compiler performs some basic data flow analysis on the code it processes.
Particularly, it checks the following:
- that every assignment has an assignable expression on its left side,
- that every expression produces the required value (or values),
- that every variable has been declared in the current scope, and
- that every variable is not used undefined (this is still unimplemented)

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
    - since _do_ expressions already evaluate a sequence of expressions, if they must produce a value they can be terminated in two ways:
      - with a _give!_ statement that specifies the result of the _do_, or
      - their last expression is assumed to be the result of the _do_.
- Function invocations are like a binary operator that requires one value on the left (the callee) and an argument on the right, which can be a tuple (the arguments).
- Every other operator requires exactly one value for each operand.

In Metascript it is necessary to specify the _do_ keyword every time a tuple is provided in a context where values are required but it must not be evaluated as a tuple. In this case the result of the _do_ expression (which _could_ be a tuple!) must be provided by a _give!_ expression.
Of course _give!_ expressions can be used inside conditional statements (_if_ branches), in any case when "evaluated" they terminate the current _do_ block and provide its result(s).

To keep the code less verbose I also made the _give!_ at the end of a _do_ optional, assuming that the last expression of the _do_ sequence will be its result (the suggestion came from [Bamboo](http://bamboo.github.io/), the desigmer of [Boo](http://boo.codehaus.org/)). Therefore the above example can also be written like this:

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

But note that Metascript encourages a coding style where side effects are condensed in assignment expressions and _do_ sequences can be avoided: the above code snippet can also be written like this (with almost identical results):

```
var (status, message, power) =
  if ok ('moving', 'Starting up', 100)
  else ('stopped', 'Stopping', 0)
console.log message
```

#### loop

Metascript has only one kind of _loop_ expression, and it tries to mimic the syntax of tail recursive invocations (but it generates plain loops in Javascript). Just like in Lisp-like languages, other looping constructs can be defined with macros.

Let's write the 'factorial' computation of a number _x_ that we get from some _input_ function:

```
var x = input()
var r = loop (r = 1, x)
  if (x > 0)
    next! (r * x, x - 1)
  else
    give! r
console.log('The factorial of ' + x + ' is ' + r)
```

A _loop_ expression has two arguments:
- a tuple of assignable expressions (with optional initializers), and
- one expression which is the loop body.
Just like a _do_, it can be terminated with a _give!_ statement which provides the result of the _loop_ expression.
However it also allows the use of a _next!_ statement, which:
- needs a tuple of values, of the same length of the _loop_ tuple,
- provides one new value for each element of the _loop_ tuple, and
- jumps to the beginning of the loop.
This final 'jump' performed by _next!_ is what makes _loop_ work like a tail recursive function, and the _loop_ tuple acts like the arguments of this imaginary function.
The _next!_ and _give!_ keywords are one of the few Metascript constructs that are not expressions: they cannot "provide a value" because they are like jump statements.

_TODO_ Explain better why I choose this as the only looping primitive and how every other loop construct can be implemented as a macro (and there will be a standard library of such macros).
Note that there are already examples of these macros in the tests.

### Variable declarations

Metascript, like Cofeescript, tries to shield the programmer from subtle errors that can creep into Javascript programs when an undeclared variable is assigned (which causes the creation of a new property in the global object).

However in Metascript the rules are different: the programmer must explicitly declare every variable.
Metascript puts every declaration at the beginning of the local "Javascript scope" in the generated code (which means either the beginning of the compilation unit, or the beginning of the current function), but it handles naming resolution like if the language had block scoping.
Moreover, Metascript does not allow the declaration of a variable with a name already used in the current scope (in this case I mean _block_ scope and not _function_ scope). I made this choice because scoping (and captured variables) are really important in Javascript, and I think that redefined names cause ambiguities reading code and should be avoided. Moreover, with this rule, if one never relies on the value of undefined variables (note, _undefined_, not just _undeclared_!), for all practical purposes Metascript provides variable declarations with local scoping which IMHO is a very desirable thing to have.
And since the data flow analysis performed by the Metascript compiler disallows uses of undefined variables local (this piece of analysis is still unimplemented) using an undefined variable is not possible anyway.

### Function Definitions

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

About data flow analysis, in Metascript the assumption is that a function body is an expression that produces exactly one value (it is like a tuple of arity one), which is then returned by the function.
The only exception to this is if the body is a return statement (which is handled in the obvious way).

To clarify, all the following functions return the same value (even if the 3rd causes a side effect before returning it):

```
var f1 = () -> 42
var f2 = () -> return 42
var f3 = () ->
  console.log 'I am returning the answer'
  42
```


### _TODO:_ switch, case

Technically, a _switch_ could be implemented with a sequence of chained _if...else_ expressions, so it could be implemented as a macro.
There is one special case where being able to emit a real Javascript _switch_ statement would have a small performance advantage: if the _case_ arguments are all integers, a smart virtual machine can emit a very fast jump table.

My plan is to implement a _switch_ macro that can be easily extended with various matching patterns in case statements, and eventually handle the "switch to jump table" optimization in the code generation of _if_ expressions.
This will keep the core language smaller which is important for macros that manipulate the control flow in advanced ways.

### Compound Literal Values

Metascript supports array and object literals exactly like Javascript, and uses roughly the same syntax to define them (_[]_ for arrays and _{}_ for objects).
The only difference comes from the fact that indentation rules can be used inside literals, too.

The trick is the following:
- If, after an open _[_ or _{_, something is written on the _same_ line, the parser stays in _()_ mode and expects commas as separators for the value elements (or properties).
- If, on the other hand, a newline is found immediately after the opening of the literal, the following block will be taken as the object content (using newlines as separators and following the indentation rules).

This is best shown with an example, in which we have two identical definitions:

```
var obj1 = {a: 1, b: 2}
var obj2 = {
  a: 1
  b: 2
}
```

I know that Cofeescript allows the programmer to omit _{}_ braces entirely when defining object literals, and I consciously decided to take a different route and make them mandatory. Doing otherwise would have created way too many ambiguities in the parser (and, IMHO, also in reading code). Moreover, it is really easy to write a macro that builds an object literal without requiring braces! (more about this in the _Metaprogramming_ section)

### String Interpolation and "heredoc" Strings

_TODO_: please note that this is still not implemented in the parser, I plan to do it soon.
Metascript does not really provide string interpolation, however it allows to concatenate strings and the results of other expressions very easily.
The trick is the following: even with string interpolation, one usually must introduce some kind of "delimitation character" in the string to separate the expressions from the string literal (something like "The distance is ${speed * time} meters").
Without string interpolation, the above string would need to be written with this expression:

```
var s = "The distance is " + (speed * time) + "  meters"
```

and what is annoying is that the programmer must write both the quotes and the _+_ operators.
However, one can note that the following expression would be illegal

```
var s = "The name is " name
```

because the parser, finding no operator, would attempt to produce a function call where the callee is the string literal, which makes no sense and would cause a runtime error.
Since the expression would be illegal it would be nice to use that kind of construct in a useful way.

Therefore Metascript supports an abbreviated form of string concatenation, like this:

```
var s1 = "The distance is " (speed * time) "  meters"
var s2 = "The full name is " surname " " name
```

which for practical purposes works just like string interpolation, and is translated into the following code:

```
var s1 = "The distance is " + (speed * time) + "  meters"
var s2 = "The full name is " + surname + " " + name
```

Also having a string that "calls a tuple" (another construct that would make no sense) is translated into a repeated concatenation of the string with every element of the tuple, allowing code like this:

```
var longString = ''
  'One string, '
  'another string, '
  'one more string...'
var interpretedAs '' 'One string, ' 'another string, ' 'one more string...'
var whichMeans '' + 'One string, ' + 'another string, ' + 'one more string...'
```

Finally, Metascript supports "heredoc" strings, which start with three consecutive quotes followed by anything (even the empty string) and then a newline, and are closed by a line starting with exactly the same sequence of characters (including the quotes), like this:

```
var longString = '''end
One line,
another line,
one more line...
'''end
```

Note that _end_ in the above example can be anything, even the empty string, it is used only to make it easier for the programmer to produce long strings that contain lines that start with exactly three consecutive quotes...

Metaprogramming
---------------

Metascript supports metaprogramming allowing the developer to write macros that modify the AST at compile time. This makes the language extensible because macros can define new language constructs. It is also practical because new keywords and operators can be added to make code easier to read (and less tedious to write!).

Let's see, as an initial example, how to define an operator that, like Coffescript's _@_, translates into "_this._" in the final program:

```
#defmacro @
  arity: unary
  precedence: HIGH
  expand: (member) ->
    if (member.tag?())
      `this . ~`member
    else if (member.array?())
      if (member.count == 1)
       `this [~`member.at 0]
      else if (member.count == 0)
        `this
      else do
        member.error 'Only one member selector is allowed'
        null
    else do
      member.error 'Invalid object member'
      null
```

This macro could be used in the following way:
```
var obj = {
  a: 1
  b: 2
  aaa: 42
  m1: () -> (@a + @b)
  m2: (x, y) -> @[x + y]
  me: () -> @[]
}
obj.m1().should.equal(3)
obj.m2('a', 'aa').should.equal(42)
obj.me()['aaa'].should.equal(42)
```

In Metascript the #defmacro keyword defines a new macro, and it must be followed by the symbol that is being defined and by a tuple of properties with a syntax like the one used in properties in object literals:
- _arity_ to specify the number of arguments of the operator, it defaults to 'unary', other useful values are 'binary', 'optional' (for as keyword that might or might not have an operand), 'zero', or others that will be documented later.
- _precedence_ defines the operator precedence (_TODO_: document the precedence table), defaults to 'KEY'.
- _dependsFrom_ is for keywords that must work together with others to build more complex constructs (like _catch_ is related to _try_, or _else_ is related to _if_).
- _expand_ is the only mandatory property, it provides the code that implements the macro.

Technically the macro implementation has two variables in its scope:
- _ast_ is the root of the AST tree where the macro must be expanded (in the above example _ast_ will be _@a_, _@b_ and then _@[x + y]_).
- _meta_ is an object that represents the compilation environment (still undocumented, will be useful in complex code generation scenarios, and can be ignored for now).

However the #defmacro construct simplifies this, and allows the programmer to declare arguments to the _expand_ function, which will have the value of the AST children of the _ast_ argument.

In the above example the macro does the following (remember that it runs at _compile_ time, at every use of the defined symbol in the source code):
- it extracts the argument passed to the _@_ operator and assigns it to _member_
- it checks if it is a "tag" (which means an identifier) or not

Now we must explain what _code quoting_ is.
In Metascript the _`_ operator is the _quote_ operator for parse trees, it is the one that provides the macros new pieces of code to put into the final program.
In the above example we have three such snippets of code:
- _this.member_, which makes sense if _member_ is a tag,
- _this[member]_, which must be used otherwise, or
_ _this_ if there is no member.

Then we should introduce the _unquote_ operator: it allows the programmer to put the result of an expression inside quoted code.
Note that the expression must produce a valid AST!

The macro code selects the correct code snippet and returns it.

The Metascript compiler will then replace the _@_ occurrence with the code returned by the _expand_ function in the macro definition.
This will make the method definitions look like this:

```
  m1: () -> (this.a + this.b)
  m2: (x, y) -> this[x + y]
  me: () -> this
```

Of course this is a very simple macro.
More complex ones can accomplish more useful tasks.
For instance in the core macros there is a _while_ statement, implemented like this:

```
#keepmacro while
  arity: binaryKeyword
  precedence: LOW
  expand: (condition, body) ->
    ` loop ()
      if (~` condition) do
        do
          ~` body
        next! ()
```

After this macro we can write something like this:

```
var (c = 1, r = '')
while (c <= 3)
  r += c
  c = c + 1
r.should.equal '123'
```

and of course the test would pass.

How the macro works should be obvious: _expand_ returns the "skeleton" of the code we want to emit, with _condition_ and _body_ inserted in the proper places (using the _unquote_ operator).


Another useful Metascript feature is the ability of producing variables with unique names when expanding macros, without forcing the programmer to explicitly call "gensym"-like functions (for those that know Lisp and Scheme, this means that Metascript makes it easy to write [hygienic macros](http://en.wikipedia.org/wiki/Hygienic_macro)).
To make use of the feature the programmer needs to use the _\\_ operator before identifiers that must be made unique, like this:

```
var code = \<- do
  var \condition = f(g)
  if (\condition) ...
```

Every time a macro containing that quoted code will be expanded, _condition_ will get a unique identifier. Therefore multiple uses of the macro in the same scope will not cause problems with redeclarations of the same variable.

This introduction only scratches the surface of metaprogramming.

I hope that it at least makes it clear why I kept the core of the Metascript language very small: everybody has his opinions about which constructs a programming language should provide, and I am pretty sure that I cannot make everyone happy. At least in this way everybody can  extend the language as he pleases.
Moreover, this will make the implementation of "global" features easier. For instance, think about the introduction of a type system: since there are only a handful of base language constructs, it is easier to implement type checking for them than how it would be for a language that needs to provide more "builtin features" because it cannot be extended.

TODO List
---------

- Organize the todo list as issues that can be tracked on Github
- Expand the [Light Table](http://www.lighttable.com/) [plugin](http://github.com/bamboo/MightTable):
  - at the cursor location, make it possible to inspect:
    - the AST produced by the parser
    - the AST after macro expansion
    - the generated javascript code
    - the arity of the expression as inferred by the compiler
  - it would be nice to have a mode where the editor automatically selects the current expression (AST subtree) at the cursor location, and changes it following the cursor movement
  - maybe implement a ternjs-like code analysis to have member autocompletion
- Document the AST API that can be used inside macros and the existing core macros, especially the ones that implement the meta-module system (libraries of macros).
- Document the [Masakari](https://github.com/bamboo/masakari) library of macros.
- Add more macros, like
    - generators
    - small useful operators
    - 'double arrow' functions
- Implement the trick about string interpolation
- Implement the type system, and expand the lighttable plugin to provide type-assisted autocompletion.
- Finish this TODO list :-)
