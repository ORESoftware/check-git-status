#!/usr/bin/env node
'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

//npm
import chalk from 'chalk';
const dashdash = require('dashdash');
const async = require('async');
const cwd = process.cwd();
import * as commands from './commands';

//project
import {log} from './logging';
import {options} from './options';
import {makeRun} from './run';

//////////////////////////////////////////////////////////////////////////

process.once('exit', function (code: number) {
  console.log();
  log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});

interface Ignorables {
  [key: string]: boolean
}

const ignorables = <Ignorables> {
  'node_modules': true,
  '.idea': true,
};

//////////////////////////////////////////////////////////////

export interface INPMLinkUpOpts {
  search_root: Array<string>,
  clear_all_caches: boolean,
  verbosity: number,
  version: string,
  help: boolean,
  completion: boolean,
  install_all: boolean,
  self_link_all: boolean,
  treeify: boolean
}

export interface ICommand {
  exitCode?: number,
  stdout?: string,
  stderr?: string,
  positiveResultValue: any,
  negativeResultValue: any,
  commandName: string,
  command: Array<string>,
  isNegativeResultValue: (stdout: string, stderr: string) => boolean;
  isPositiveResultValue: (stdout: string, stderr: string) => boolean;
  processPositiveResultValue: (stdout: string, stderr: string) => string;
  processNegativeResultValue: (stdout: string, stderr: string) => string;
}

export interface IResultValue {
  stderr?: string;
  stdout?: string;
}

export interface IResult {
  [key: string]: IResultValue
}

////////////////////////////////////////////////////////////////////

let opts: INPMLinkUpOpts, parser = dashdash.createParser({options});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  console.log();
  log.error('CLI parsing error: ', e.message);
  process.exit(1);
}

if (opts.version) {
  let checkGitStatusPkg = require('./package.json');
  console.log(checkGitStatusPkg.version);
  process.exit(0);
}

if (opts.help) {
  let help = parser.help({includeEnv: true}).trimRight();
  console.log('usage: check-git-status [OPTIONS]\n'
    + 'options:\n'
    + help);
  process.exit(0);
}

if (opts.completion) {

  let generatedBashCode = dashdash.bashCompletionFromOptions({
    name: 'check-git-status',
    options: options,
    includeHidden: true
  });

  console.log(generatedBashCode);
  process.exit(0);
}

if (!opts.search_root) {
  console.error();
  log.error(chalk.red('You need to pass a "--search-root" option, like so: `chkgits --search-root=.`'));
  process.exit(1);
}

const searchRoot: string =
  String(path.isAbsolute(String(opts.search_root)) ? opts.search_root : path.resolve(cwd + '/' + opts.search_root));

try {
  fs.statSync(searchRoot);
}
catch (err) {
  log.error('Stats could not be collected on supposed search root:', searchRoot);
  throw err;
}

let ignoredPathCount = 0;
let searchedPathCount = 0;
const repos: Array<string> = [];

const searchDir = function (dir: string, cb: Function) {

  searchedPathCount++;

  fs.readdir(dir, function (err, itemz) {

    const items = itemz.filter(function (v) {
      if (ignorables[v]) {
        log.warning('ignored path: ', path.resolve(dir + '/' + v));
        ignoredPathCount++;
        return false;
      }
      return true;
    });

    async.eachLimit(items, 3, function (item: string, cb: Function) {

      const full = path.resolve(dir, item);

      fs.stat(full, function (err, stats) {

        if (err) {
          log.warning(err.message);
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

log.info(
  chalk.green.bold('Searching for all git repos within this path:'),
  chalk.black.bold(searchRoot)
);

searchDir(searchRoot, function (err: Error) {

  if (err) {
    throw err;
  }

  log.info('This many paths were ignored:', chalk.green.bold(String(ignoredPathCount)));
  log.info('This many directories were searched:', chalk.green.bold(String(searchedPathCount)));

  log.info(chalk.green.bold('Searching has completed.'));
  console.log();

  if (repos.length < 1) {
    log.warning('no git repos could be found.');
    return process.exit(0);
  }

  console.log();
  log.info('Number of git repos found: ', chalk.green.bold(String(repos.length)));
  console.log();
  log.info('Git repos were found at these paths:');

  repos.forEach(function (r, i) {
    log.info(String(`[${i + 1}]`), chalk.magenta(r));
  });

  console.log();
  const results = {} as any;
  const firstCmds = ['set -e; cd "${git_root_path}"'];

  const getCommands = function (): Array<ICommand> {
    return [
      commands.getGitStatus(firstCmds),
      commands.getBranchName(firstCmds),
      commands.getCommitDifference(firstCmds),
      commands.getCommitDifferenceGithub(firstCmds)
    ];
  };

  async.eachLimit(repos, 3, function (r: string, cb: Function) {

      const v = results[r] = [] as any;
      const commands = getCommands();
      async.eachLimit(commands, 1, makeRun(v, r), cb);
    },

    function (e: Error) {

      if (e) {
        throw e.stack || new Error(util.inspect(e));
      }

      let problemCount = 0;

      Object.keys(results).forEach(function (k) {

        const hasProblem = results[k].some(function (v: any) {
          return v.negativeResultValue || !v.positiveResultValue;
        });

        if (hasProblem) {

          problemCount++;

          console.log(' ---------------------------------------------------------------------------------------------');
          console.log();

          log.info(chalk.magenta.italic.bold('Results for repo with path: '), chalk.black.bold(k));

          results[k].forEach(function (v: any) {

            console.log();
            log.info('Command name:', chalk.magenta(v.commandName));

            if (v.positiveResultValue) {
              log.info(chalk.cyan('Positive result:'),
                v.positiveResultValue);
            }
            else {
              log.info(chalk.yellow('Negative result value:'), v.negativeResultValue || 'unknown negative result [b].');

              if (String(v.stderr).trim()) {
                log.warning('stderr:', v.stderr);
              }

            }

          });

        }

      });

      console.log();

      if (problemCount < 1) {
        log.good('None of your git repos had an unclean state. Congratulations. Move on with your day.')
      }
      else {
        log.warning(`You have problems to address in ${problemCount} repo(s).`)
      }

      process.exit(0);

    });

});

