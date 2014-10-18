'''
42
42
42
42
42
42
42
42
'''

var o = {
  p42: 42
  m42: #-> @p42
  mo: #-> @o
  o: {
    p42: 42
    m42: #-> @p42
    mo: #-> @o
    o: {
      p42: 42
      m42: #-> @p42
      mo: #-> @o
      o: {}
    }
  }
}

console.log o |:
  m42

console.log o |:
  mo
  mo
  m42

console.log o |:
  .mo()
  .mo()
  m42

console.log <- |:
  o
  mo
  mo
  m42

console.log <- |:
  o
  mo()
  mo()
  m42()


console.log
  |:
    20
    # * 2
    # + 2

console.log
  |:
    2 * #twenty
    # + #two
    #where
      #twenty = 20
      #two = 2

console.log
  |:
    #two * #twenty
    # + #two
    #where
      #twenty = 20
      #two = 2
