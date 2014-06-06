// Dumps an escodegen AST for the regenerator minified runtime.
// It allows to merge it directly into the generated program
// to avoid breaking source maps.

var fs = require('fs');

var regenerator = require('regenerator');
// HACK: Use recast from regenerator's deps
var recast = require('regenerator/node_modules/recast');

var runtime = fs.readFileSync(regenerator.runtime.min, "utf-8");
var body = recast.parse(runtime, {
  sourceFileName: regenerator.runtime.min,
}).program.body;

// Reduce source maps size by removing location information
var StripLoc = recast.Visitor.extend({
  visit: function (node) {
    this.genericVisit(node);
    console.log(node.type);
    node.loc = null;
    return node;
  }
});
(new StripLoc).visit(body);

fs.writeFileSync('./lib/regenerator-runtime.json', JSON.stringify(body[0]))
