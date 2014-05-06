
#metamodule
  #keepmacro @%^
    unary
    HIGH
    expand: (arg) ->
      if (arg.isTag())
        `this. ~`arg
      else
        `this[~`arg]

  #keepmacro #d-double
    unary
    HIGH
    expand: (arg) -> `2 * ~`arg
