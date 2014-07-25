#metamodule
  #keepmacro @%^
    unary
    HIGH
    expand: (arg) ->
      if (arg.isTag())
        `this. ~`arg
      else
        `this[~`arg]
