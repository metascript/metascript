var fs = require('fs');
var util = require('util');


var Meta = require('./meta')();


var MJS_RC = '.mjsrc';
var MJS_NPM = 'mjsConfig';
var DEFAULT_CONFIG = {
  map: true,
  sourceInMap: true,
  mapEmbed: true,
  fullMacroErrors: false,
  emitIdentifierStatements: false,
  skipCore: false,
};


var stdout = function (line) { process.stdout.write(line + '\n'); };
var stderr = function (line) { process.stderr.write(line + '\n'); };


function parseArgs(argv) {
  var minimist = require('minimist');
  var minimistOpts = {
    string: ['map-file', 'map-root', 'out'],
    boolean: ['map', 'map-embed', 'map-source', 'color', 'skip-core', 'debug', 'skip-config', 'verbose', 'help', 'version'],
    default: {
      'color': process.stdout.isTTY && process.stderr.isTTY,
      'debug': false,
      'help': false,
      'skip-config': false,
      'version': false,
    },
    alias: {
      'c': 'color',
      'd': 'debug',
      'h': 'help',
      'm': 'map',
      'o': 'out',
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
  } else if (typeof opts._.length > 1) {
    showHelpAndExit('at most only one source file can be specified', 1);
  }

  // Check the source file
  var source = opts._[0];
  if (source === '-') {
    source = '<stdin>';
  } else if (!fs.existsSync(source)) {
    showHelpAndExit('Source file "' + source + '" does not exists.');
  }  

  var config = opts['skip-config'] ? DEFAULT_CONFIG : getConfig(source);
  config.source = source;

  if (opts['out']) {
    config.output = opts['out'] === '-' ? '<stdout>' : opts['out'];
  } else if (source === '<stdin>') {
    config.output = '<stdout>';
  } else {
    var path = require('path');
    config.output = path.dirname(source) + path.sep + path.basename(source, '.mjs') + '.js';
  }
  if (config.output === '<stdout>') {
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
  defs['map'] = !!config.map;
  defs['map-source'] = config.sourceInMap;
  defs['map-embed'] = config.mapEmbed;
  defs['map-file'] = '';
  defs['skip-core'] = config.skipCore;

  // Parse again with the adjusted default values
  opts = minimist(argv, minimistOpts);

  // Override config values with arguments
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

  return {config: config, options: opts};
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
    '             --skip-core  Skip loading of core macros [default: off]',
    '               -m, --map  Source map generation [default: on]',
    '             --map-embed  Embed source map in the javascript [default: on]',
    '       --map-file <file>  Destination source map file',
    '       --map-root <root>  Define a root for source map references',
    '            --map-source  Include original source code in map [default: on]',
    ' -o <file>, --out <file>  Destination file (use - for stdout)',
    '           --skip-config  Skip loading of config values [default: off]',
    '           -v, --verbose  Verbose reporting [default: off]',
    '               --version  Show version and exit',
    '',
    ' * Note: options can be disabled by prefixing them with "--no-"',
    ''
  ].join('\n'));

  process.exit(typeof exitcode === 'undefined' ? 0 : exitcode);
}

// Get configuration from NPM package or from resource files
function getConfig(fpath) {
  var path = require('path');
  var dpath = path.dirname(path.resolve(fpath));

  function parentpath(fromdir, pattern) {
    var pp = require('parentpath'),
        cwd = process.cwd();
    try {
      process.chdir(fromdir);
      return pp.sync(pattern);
    } catch (e) {
      return null;
    } finally {
      process.chdir(cwd);
    }
  }

  function fromNpm() {
    var config;
    var dir = parentpath(dpath, 'package.json');
    if (dir) {
      try {
        config = require(dir + '/package.json')[MJS_NPM];
        config.__origin__ = dir + '/package.json';
      } catch (e) {
      }
    }
    return config;
  }

  function fromResourceFile() {
    var candidates = [
      parentpath(path, MJS_RC),
      process.env.HOME, process.env.USERPROFILE, process.env.HOMEPATH, process.env.HOMEDRIVE + process.env.HOMEPATH
    ];

    var config;
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i] + '/' + MJS_RC;
      if (fs.existsSync(candidate)) {
        try {
          config = JSON.parse(fs.readFileSync(candidate));
          config.__origin__ = candidate;
          break;
        } catch (e) {
          showHelpAndExit('Unable to read config from "' + candidate + '": ' + e.message, 1);
        }
      }
    }
    return config;
  }

  var config = fromNpm() || fromResourceFile() || {};
  // Make sure we apply defaults to missing values
  for (var k in DEFAULT_CONFIG) if (DEFAULT_CONFIG.hasOwnProperty()) {
    if (typeof config[k] === 'undefined') config[k] = DEFAULT_CONFIG[k];
  }
  return config;
}

function shorterPath(fpath) {
  var path = require('path'),
      abs = path.resolve(fpath),
      rel = path.relative(process.cwd(), abs);
  return abs.length > rel.length ? rel : abs;
};


function main(argv) {
  var cfg = parseArgs(argv.slice(2))

  require('colors').mode = cfg.options['color'] ? 'console' : 'none';
  var debug = function (s) { return ('[debug] '.bold + s).yellow },
      strmul = function (s, n) { return (new Array(n)).join(s); };

  if (cfg.options['verbose'] && cfg.config.__origin__) {
    stderr(debug('Config loaded from ' + cfg.config.__origin__));
    delete cfg.config.__origin__;    
  }

  if (cfg.options['debug'] && cfg.options['verbose']) {
    var pairs = [];
    Object.keys(cfg.config).forEach(function (k) {
      pairs.push(k + '=' + JSON.stringify(cfg.config[k]));
    })
    stderr(debug('Config: ' + pairs.join(' ')));
  }

  Meta.setOptions(cfg.config);

  var compiler, sourceCode, 
      source = cfg.config.source;

  if (source === '<stdin>') {
    sourceCode = fs.readFileSync('/dev/stdin').toString();
    compiler = Meta.compilerFromString(sourceCode, source);
  } else {
    compiler = Meta.compilerFromFile(source);
  }

  var prettyHrtime = require('pretty-hrtime'),
      prettyTime,
      hrstart = process.hrtime();

  var code = compiler.compile();

  prettyTime = prettyHrtime(process.hrtime(hrstart));

  if (compiler.errors.length > 0) {
    if (cfg.options['verbose']) {
      var lines = sourceCode
                ? sourceCode.split('\n')
                : fs.existsSync(source)
                ? fs.readFileSync(compiler.parser.source, 'utf-8').toString().split('\n')
                : [];

      compiler.errors.forEach(function (err) {
        stderr(
          (shorterPath(source) + ':' + err.line + ':' + err.column).bold + ': ' + 
          'error: '.red.bold + err.message.bold.white
        );
        if (lines.length >= err.line) {
          stderr(lines[err.line - 1]);
          stderr(strmul(' ', err.column+1) + '^'.blue.bold);
        }
      });

      stderr(compiler.errors.length + ' error(s) found on.');
    } else {
      compiler.errors.forEach(function (err) {
        stderr(err.toString());
      });
    }
  } else if (!cfg.config.output) {
    process.stdout.write(code);
  } else if (cfg.options['verbose']) {
    stdout('Successfully generated ' + shorterPath(cfg.config.output) + ' in ' + prettyTime + '.');
  }

  process.exit(compiler.errors.length);
}


module.exports = main;
