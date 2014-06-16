var fs = require('fs');
var util = require('util');


var Meta = require('../meta')();
var lint = require('./lint');
var getConfig = require('./config.js').getConfig;


var DEFAULT_CONFIG = {
  map: true,
  sourceInMap: true,
  mapEmbed: true,
  fullMacroErrors: false,
  emitIdentifierStatements: false,
  skipCore: false,
  es5Generators: false,
  runtime: true
};


var stdout = function (line) { process.stdout.write(line + '\n'); };
var stderr = function (line) { process.stderr.write(line + '\n'); };


function parseArgs(argv) {
  var minimist = require('minimist');
  var minimistOpts = {
    string: ['map-file', 'map-root', 'out'],
    boolean: ['debug', 'help', 'lint', 'map', 'map-embed', 'map-source', 'color', 'es5-generators',
              'parallel', 'runtime', 'skip-core', 'skip-config', 'verbose', 'version'],
    default: {
      'color': process.stdout.isTTY && process.stderr.isTTY,
      'debug': false,
      'help': false,
      'lint': false,
      'parallel': false,
      'skip-config': false,
      'version': false,
    },
    alias: {
      'c': 'color',
      'd': 'debug',
      'h': 'help',
      'l': 'lint',
      'm': 'map',
      'o': 'out',
      'r': 'runtime',
      'v': 'verbose',
    }
  };
  var opts;

  // Parse a first time for non-config related stuff
  opts = minimist(argv, minimistOpts);

  if (opts.help) {
    showHelpAndExit();
  } else if (opts.version) {
    console.log('Metascript compiler version ' + Meta.version);
    process.exit(0);
  }

  ['out', 'map-file', 'map-root'].forEach(function (arg) {
    if (opts[arg] === '') {
      showHelpAndExit('missing argument for option --' + arg, 1);
    }
  });

  if (opts._.length === 0) {
    showHelpAndExit('source file not specified.', 1);
  }

  // Check the source file
  var sources = opts._.map(function (source) {
    if (source !== '-' && !fs.existsSync(source)) {
      showHelpAndExit('Source file "' + source + '" does not exists.');
    }
    return source;
  });

  var config = opts['skip-config'] ? DEFAULT_CONFIG : getConfig(sources[0], DEFAULT_CONFIG);

  if (!opts['out'] && sources.indexOf('<stdin>') !== -1) {
    opts['out'] = '-';
  }
  if (opts['out'] === '-') {
    delete config.output;
    config.mapEmbed = true;
  } 

  // Apply configuration to options parser default values
  var defs = minimistOpts.default;
  // Debug mode forces a specific config
  if (opts['debug']) {
    defs['verbose'] = true;
    config.map = true;
    config.sourceInMap = true;
    config.mapEmbed = true;
    config.fullMacroErrors = true;
    config.emitIdentifierStatements = true;    
  }
  // Enable source maps if any sub-options is given
  if (opts['map-file'] || opts['map-source'] || opts['map-embed'] || opts['map-root']) {
    config.map = true;
  }

  // Apply defaults
  defs['es5-generators'] = config.es5Generators;
  defs['runtime'] = config.runtime;
  defs['map'] = !!config.map;
  defs['map-source'] = config.sourceInMap;
  defs['map-embed'] = config.mapEmbed;
  defs['map-file'] = '';
  defs['skip-core'] = config.skipCore;

  // Parse again with the adjusted default values
  opts = minimist(argv, minimistOpts);

  // Override config values with arguments

  config.es5Generators = opts['es5-generators'];
  config.runtime = opts['runtime'];
  config.skipCore = opts['skip-core'];
  config.mapEmbed = opts['map-embed'];
  config.sourceInMap = opts['map-source'];
  config.mapRoot = opts['map-root'] || '';
  config.sourceInMap = opts['map-source'];
  if (opts['map']) {
    if (opts['map-file']) {
      config.map = opts['map-file'];
    } else if (config.output) {
      config.map = config.output + '.map';
    } else {
      config.map = '';
    }
  } else {
    delete config.map;
  }

  return {sources: sources, config: config, options: opts};
}

function showHelpAndExit(error, exitcode) {
  if (error) {
    stderr('Error: ' + error);
  }
  stdout([
    '',
    'Usage: mjs [options...] <file.mjs|->',
    '',
    '             -c, --color  Color output [default: on]',
    '             -d, --debug  Debug mode code generation [default: off]',
    '              -h, --help  Show this help and exit',
    '              -l, --lint  Check source for common mistakes [defaults: off]',
    '               -m, --map  Source map generation [default: on]',
    '             --map-embed  Embed source map in the javascript [default: on]',
    '       --map-file <file>  Destination source map file',
    '       --map-root <root>  Define a root for source map references',
    '            --map-source  Include original source code in map [default: on]',
    '          --parallel[=n]  Parallelize compilation [default: off]',
    '        --es5-generators  Emulate generators for ES5 [default: off]',
    '               --runtime  Embed runtime [default: on]',
    '           --skip-config  Skip loading of config values [default: off]',
    '             --skip-core  Skip loading of core macros [default: off]',
    ' -o <file>, --out <file>  Destination file (use - for stdout)',
    '           -v, --verbose  Verbose reporting [default: off]',
    '               --version  Show version and exit',
    '',
    ' * Note: options can be disabled by prefixing them with "--no-"',
    ''
  ].join('\n'));

  process.exit(typeof exitcode === 'undefined' ? 0 : exitcode);
}


function shorterPath(fpath) {
  var path = require('path'),
      abs = path.resolve(fpath),
      rel = path.relative(process.cwd(), abs);
  return abs.length > rel.length ? rel : abs;
};

var sourceLines = {};
function getSourceLine(fpath, line) {
  if (!(fpath in sourceLines)) {
    try {
      sourceLines[fpath] = fs.readFileSync(fpath, 'utf-8').toString().split('\n');
    } catch (e) {
      sourceLines[fpath] = [];
      return null;
    }
  }

  var lines = sourceLines[fpath];
  if (line > lines.length) return null;

  return lines[line - 1];
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function main(argv) {

  var ctx = parseArgs(argv);

  require('colors').mode = ctx.options['color'] ? 'console' : 'none';
  var debug = function (s) { return ('[debug] '.bold + s).yellow },
      strmul = function (s, n) { return (new Array(n)).join(s); };

  if (ctx.options['verbose'] && ctx.config.__origin__) {
    stderr(debug('Config loaded from ' + ctx.config.__origin__));
    delete ctx.config.__origin__;    
  }

  if (ctx.options['debug'] && ctx.options['verbose']) {
    var pairs = [];
    Object.keys(ctx.config).forEach(function (k) {
      pairs.push(k + '=' + JSON.stringify(ctx.config[k]));
    })
    stderr(debug('Config: ' + pairs.join(' ')));
  }

  var hrstart = process.hrtime()

  var poolSize = ctx.options.parallel ? parseInt(ctx.options.parallel, 10) : 1;
  if (ctx.options.parallel && !poolSize) {
    // NOTE: Forking in node is expensive on time and memory. So let's
    //       be conservative in the number of workers we will spawn.
    poolSize = Math.min(
      Math.floor(Math.sqrt(ctx.sources.length)), 
      require('os').cpus().length
    );
  }

  var Pool = require('./pool').ForkPool;
  var pool = new Pool(__dirname + '/worker.js', poolSize);

  var waiting = ctx.sources.length;
  var errors = [];
  ctx.sources.forEach(function (source) {
    var config = clone(ctx.config);
    config.source = source;

    if (ctx.options['out'] === '-') {
      delete config.output;
    } else if (ctx.options['out']) {
      config.output = ctx.options['out'];
    } else {
      var path = require('path');
      config.output = path.dirname(source) + path.sep + path.basename(source, '.mjs') + '.js';
    }

    var action = { config: config };

    if (ctx.options['lint']) {
      action.type = 'lint';
    } else {
      action.type = 'compile';
    }

    if (source === '<stdin>') {
      var code = fs.readFileSync('/dev/stdin').toString();
      sourceLines[source] = code.split('\n');
      action.code = code;
    }

    pool.send(action, function (result) {
      if (result.errors.length) {
        printErrors(source, result.errors, ctx.options['verbose']);
        errors = errors.concat(result.errors);
      } else if (!config.output) {
        process.stdout.write(result.code);
      }

      if (--waiting === 0) {        
        pool.close();

        if (ctx.options['verbose']) {
          if (0 === errors.length) {
            var prettyHrtime = require('pretty-hrtime'),
                prettyTime = prettyHrtime(process.hrtime(hrstart));
            stderr('Successfully generated ' + ctx.sources.length + ' files in ' + prettyTime + '.');
          } else {
            stderr(errors.length + ' error(s) found on.');
          }
        }

        process.exit(Math.min(errors.length, 255));
      }
    });
  });
}

function printErrors(source, errors, verbose) {
  if (verbose) {
    errors.forEach(function (err) {
      stderr(
        (shorterPath(source) + ':' + err.line + ':' + err.column).bold + ': ' + 
        'error: '.red.bold + err.message.bold.white
      );
      var line = getSourceLine(source, err.line);
      if (line) {
        stderr(line);
        stderr(strmul(' ', err.column+1) + '^'.blue.bold);
      }

      err.nestedErrors.forEach(function (nested) {
        stderr(
          (shorterPath(source) + ':' + nested.line + ':' + nested.column).bold + ': ' + 
          'note: '.grey.bold + nested.message.bold.white
        );
        line = getSourceLine(source, nested.line);
        if (line) {
          stderr(line);
          stderr(strmul(' ', nested.column+1) + '^'.blue.bold);
        }
      });

      if (err.originalLine !== null) {
        stderr(
          (shorterPath(err.originalSource) + ':' + err.originalLine + ':' + err.originalColumn).bold + ': ' +
          'note: '.grey.bold + 'expanded from:'.bold.white
        );
        line = getSourceLine(err.originalSource, err.originalLine);
        if (line) {
          stderr(line);
          stderr(strmul(' ', err.originalColumn+1) + '^'.blue.bold);
        }
      }
    });

  } else {
    errors.forEach(function (err) {
      stderr(err.toString());
    });
  }
}


module.exports = main;
