#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var path = require("path");
var fs = require("fs");
var chalk_1 = require("chalk");
var dashdash = require('dashdash');
var async = require('async');
var cwd = process.cwd();
var commands = require("./lib/commands");
var logging_1 = require("./lib/logging");
var options_1 = require("./lib/options");
var run_1 = require("./lib/run");
process.once('exit', function (code) {
    console.log();
    logging_1.log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});
var ignorables = {
    'node_modules': true,
    '.idea': true,
};
var opts, parser = dashdash.createParser({ options: options_1.options });
try {
    opts = parser.parse(process.argv);
}
catch (e) {
    console.log();
    logging_1.log.error('CLI parsing error: ', e.message);
    process.exit(1);
}
if (opts.version) {
    var checkGitStatusPkg = require('./package.json');
    console.log(checkGitStatusPkg.version);
    process.exit(0);
}
if (opts.help) {
    var help = parser.help({ includeEnv: true }).trimRight();
    console.log('usage: check-git-status [OPTIONS]\n'
        + 'options:\n'
        + help);
    process.exit(0);
}
if (opts.completion) {
    var generatedBashCode = dashdash.bashCompletionFromOptions({
        name: 'check-git-status',
        options: options_1.options,
        includeHidden: true
    });
    console.log(generatedBashCode);
    process.exit(0);
}
if (!opts.search_root) {
    console.error();
    logging_1.log.error(chalk_1.default.red('You need to pass a "--search-root" option, like so: `chkgits --search-root=.`'));
    process.exit(1);
}
var searchRoot = String(path.isAbsolute(String(opts.search_root)) ? opts.search_root : path.resolve(cwd + '/' + opts.search_root));
try {
    fs.statSync(searchRoot);
}
catch (err) {
    logging_1.log.error('Stats could not be collected on supposed search root:', searchRoot);
    throw err;
}
var ignoredPathCount = 0;
var searchedPathCount = 0;
var repos = [];
var searchDir = function (dir, cb) {
    searchedPathCount++;
    fs.readdir(dir, function (err, itemz) {
        var items = itemz.filter(function (v) {
            if (ignorables[v]) {
                logging_1.log.warning('ignored path: ', path.resolve(dir + '/' + v));
                ignoredPathCount++;
                return false;
            }
            return true;
        });
        async.eachLimit(items, 3, function (item, cb) {
            var full = path.resolve(dir, item);
            fs.stat(full, function (err, stats) {
                if (err) {
                    logging_1.log.warning(err.message);
                    return cb(null);
                }
                if (!stats.isDirectory()) {
                    return cb(null);
                }
                if (path.basename(full) === '.git') {
                    repos.push(path.dirname(full));
                    cb(null);
                }
                else {
                    searchDir(full, cb);
                }
            });
        }, cb);
    });
};
console.log();
logging_1.log.info(chalk_1.default.green.bold('Searching for all git repos within this path:'), chalk_1.default.black.bold(searchRoot));
searchDir(searchRoot, function (err) {
    if (err) {
        throw err;
    }
    logging_1.log.info('This many paths were ignored:', chalk_1.default.green.bold(String(ignoredPathCount)));
    logging_1.log.info('This many directories were searched:', chalk_1.default.green.bold(String(searchedPathCount)));
    logging_1.log.info(chalk_1.default.green.bold('Searching has completed.'));
    console.log();
    if (repos.length < 1) {
        logging_1.log.warning('no git repos could be found.');
        return process.exit(0);
    }
    console.log();
    logging_1.log.info('Number of git repos found: ', chalk_1.default.green.bold(String(repos.length)));
    console.log();
    logging_1.log.info('Git repos were found at these paths:');
    repos.forEach(function (r, i) {
        logging_1.log.info(String("[" + (i + 1) + "]"), chalk_1.default.magenta(r));
    });
    console.log();
    var results = {};
    var firstCmds = ['set -e; cd "${git_root_path}"'];
    var getCommands = function () {
        return [
            commands.getGitStatus(firstCmds),
            commands.getBranchName(firstCmds),
            commands.getCommitDifference(firstCmds)
        ];
    };
    async.eachLimit(repos, 3, function (r, cb) {
        var v = results[r] = [];
        var commands = getCommands();
        async.eachLimit(commands, 1, run_1.makeRun(v, r), cb);
    }, function (e) {
        if (e) {
            throw e.stack || new Error(util.inspect(e));
        }
        var problemCount = 0;
        Object.keys(results).forEach(function (k) {
            var hasProblem = results[k].some(function (v) {
                return v.negativeResultValue || !v.positiveResultValue;
            });
            if (hasProblem) {
                problemCount++;
                console.log(' ---------------------------------------------------------------------------------------------');
                console.log();
                logging_1.log.info(chalk_1.default.magenta.italic.bold('Results for repo with path: '), chalk_1.default.black.bold(k));
                results[k].forEach(function (v) {
                    console.log();
                    logging_1.log.info('Command name:', chalk_1.default.magenta(v.commandName));
                    if (v.positiveResultValue) {
                        logging_1.log.info(chalk_1.default.cyan('Positive result:'), v.positiveResultValue);
                    }
                    else {
                        logging_1.log.info(chalk_1.default.yellow('Negative result value:'), v.negativeResultValue || 'unknown negative result [b].');
                        if (String(v.stderr).trim()) {
                            logging_1.log.warning('stderr:', v.stderr);
                        }
                    }
                });
            }
        });
        console.log();
        if (problemCount < 1) {
            logging_1.log.good('None of your git repos had an unclean state. Congratulations. Move on with your day.');
        }
        else {
            logging_1.log.warning("You have problems to address in " + problemCount + " repo(s).");
        }
        process.exit(0);
    });
});
