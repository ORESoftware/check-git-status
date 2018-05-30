'use strict';

import chalk from 'chalk';
const name = ' [check-git-status] ';

export const log = {
  info: console.log.bind(console, chalk.gray(name)),
  good: console.log.bind(console, chalk.cyan(name)),
  veryGood: console.log.bind(console, chalk.green(name)),
  warning: console.log.bind(console, chalk.yellow.bold(name)),
  error: console.log.bind(console, chalk.red(name))
};


