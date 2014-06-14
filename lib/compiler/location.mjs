'''
Tracks source code locations for the compiler.

To avoid creating tons of small objects the information for source
file, line number and column is encoded in a single number value using
bitwise operators (so only 32 bits are used).
The number stores in this order: an index to a source file, the line
and the column. This allows for cheap operations when comparing locations.
'''

var
  SOURCE_BITS = 6
  LINE_BITS   = 16
  COLUMN_BITS = 10
  SOURCE_MASK = (1 << SOURCE_BITS) - 1
  LINE_MASK   = (1 << LINE_BITS) - 1
  COLUMN_MASK = (1 << COLUMN_BITS) - 1

console.assert(SOURCE_BITS + LINE_BITS + COLUMN_BITS <= 32, 'Bits should not add up over 32');

var LocationManager = () ->
  this.sources = ['<unknown>']
  this  ; Force to return the instance

LocationManager.prototype.DEFAULT = 0

LocationManager.prototype.add-source = (source) ->
  var src-idx = this.sources.indexOf(source)
  if (src-idx == -1)
    src-idx = this.sources.length
    this.sources.push(source)

  src-idx

LocationManager.prototype.make-loc = (source, line, column) ->
  var src-idx = this.add-source(source)

  src-idx &= SOURCE_MASK
  line &= LINE_MASK
  column &= COLUMN_MASK

  ;console.log(source, src-idx, line, column, this.sources)

  (src-idx << (LINE_BITS + COLUMN_BITS)) | (line << COLUMN_BITS) | column

LocationManager.prototype.get-source = (loc) ->
  var src-idx = (loc >> (LINE_BITS + COLUMN_BITS)) & SOURCE_MASK
  this.sources[src-idx]

LocationManager.prototype.get-line = (loc) ->
  (loc >> COLUMN_BITS) & LINE_MASK

LocationManager.prototype.get-column = (loc) ->
  loc & COLUMN_MASK

LocationManager.prototype.as-object = (start, end) ->
  {
    source: this.get-source start
    start: {
      line: this.get-line start
      column: this.get-column start
    }
    end: {
      line: this.get-line end
      column: this.get-column end
    }
  } 

LocationManager.prototype.from-object = (obj) ->
  [
    this.make-loc(obj.source, obj.start.line, obj.start.column)
    this.make-loc(obj.source, obj.end.line, obj.end.column)
  ]


#external(exports).LocationManager = LocationManager