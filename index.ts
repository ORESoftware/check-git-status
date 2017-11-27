#!/usr/bin/env node
'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as EE from 'events';
import * as fs from 'fs';
import * as stream from 'stream';
import * as cp from 'child_process';

//npm
import * as chalk from 'chalk';
const dashdash = require('dashdash');
const async = require('async');
const cwd = process.cwd();

//project
import {log} from './lib/logging';
import {options} from './lib/options';

//////////////////////////////////////////////////////////////////////////

process.once('exit', function (code) {
  console.log('\n');
  log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});

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

////////////////////////////////////////////////////////////////////

let opts: INPMLinkUpOpts, parser = dashdash.createParser({options});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  console.error(' => CLI parsing error: %s', e.message);
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
  throw new Error('no "--search-root" option provided.');
}

const searchRoot: string =
  String(path.isAbsolute(String(opts.search_root)) ? opts.search_root : path.resolve(cwd + '/' + opts.search_root));

try {
  fs.statSync(searchRoot);
}
catch (err) {
  throw err;
}

const repos: Array<string> = [];

const searchDir = function (dir: string, cb: Function) {

  fs.readdir(dir, function (err, items) {

    async.eachLimit(items, 5, function (item: string, cb: Function) {

      const full = path.resolve(dir, item);

      fs.stat(full, function (err, stats) {

        if (err) {
          return cb(err);
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

searchDir(searchRoot, function (err: Error) {

  if (err) {
    throw err;
  }

  if (repos.length < 1) {
    log.warning('no git repos could be found.');
    return process.exit(0);
  }

  console.log('Git repos were found at these paths:');
  repos.forEach(function (r) {
    log.info(r);
  });

  const results = {};

  const firstCmds = ['set -e; cd $search_root'];

  const commands = [
    {
      commandName: 'Git status',
      exitCode: null,
      stdout: '(no stdout)',
      stderr: '(no stderr)',
      resultValue: '(null)',
      command: firstCmds.concat(['echo "$(git status)"']),
      isNegativeResultValue: function (stdout: string): string {

        if (String(stdout).match(/Changes not staged for commit/i)) {
          return 'Changes not staged for commit';
        }

        if (String(stdout).match(/Untracked files/i)) {
          return 'Untracked files';
        }
      },

      isPostiveResultValue: function (stdout: string): boolean {

        if (String(stdout).match(/nothing to commit, working directory clean/i)) {
          return true;
        }

      },

      processPositiveResultValue: function (stdout: string): string {
        return String(stdout).trim();
      },

      processNegativeResultValue: function (stdout: string, stderr: string): string {
        return String(stdout).trim();
      }
    },

    {
      commandName: 'Git branch name',
      exitCode: null,
      stdout: '(no stdout)',
      stderr: '(no stderr)',
      resultValue: '(null)',
      command: firstCmds.concat(['echo "$(git rev-parse --abbrev-ref HEAD)"']),
      isNegativeResultValue: function () {
      },
      isPostiveResultValue: function (stdout: string): boolean {
        return true;
      },
      processPositiveResultValue: function (stdout: string): string {
        return String(stdout).trim();
      },
      processNegativeResultValue: function (stdout: string): string {
        return String(stdout).trim();
      }
    }
  ];

  async.eachLimit(repos, 3, function (r: string, cb: Function) {

      const v = results[r] = [];

      async.eachLimit(commands, 1, function (c: Object, cb: Function) {

        const k = cp.spawn('bash', [], {
          env: Object.assign({}, process.env, {
            search_root: searchRoot
          })
        });

        process.nextTick(function () {
          k.stdin.end(c.command.join(';') + '\n');
        });

        let stdout = '';
        let stderr = '';

        k.stderr.on('data', function (d) {
          stderr += String(d);
        });

        k.stdout.on('data', function (d) {
          stdout += String(d);
        });

        k.once('exit', function (code) {

          c.exitCode = code;
          c.stderr = stderr;

          if (false) {
            c.stdout = stdout;
          }



          v.push(JSON.parse(JSON.stringify(c)));

          cb(null);

        });

      }, cb);

    },

    function (err: Error) {

      if (err) {
        throw new Error(util.inspect(err));
      }

      Object.keys(results).forEach(function (k) {

        log.info('results for key: ', k);
        results[k].forEach(function (v) {
            console.log(v);
          }
        )
      });

      process.exit(0);

    });

});

