#metamodule

  #keepmacro 'describe'
    binaryKeyword
    KEY
    expand: (description, body) ->
      `(#external describe)
        ~`description
        () -> ~`body

  #keepmacro 'it'
    binaryKeyword
    KEY
    expand: (description, body) ->
      `(#external it)
        ~`description
        () -> ~`body
