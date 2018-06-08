'use strict';

var childProcess = require('child_process');
var spawnSync = childProcess.spawnSync;
var execSync = childProcess.execSync;

module.exports = function (pid, signal, callback) {
    var tree = {};
    var pidsToProcess = {};
    tree[pid] = [];
    pidsToProcess[pid] = 1;
    
    if (typeof signal === 'function' && callback === undefined) {
      callback = signal;
      signal = undefined;
    }

    switch (process.platform) {
    case 'win32':
        execSync('taskkill /pid ' + pid + ' /T /F', callback);
        break;
    case 'darwin':
        buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
          return spawnSync('pgrep', ['-P', parentPid]);
        });
        killAll(tree, signal, callback);
        break;
    // case 'sunos':
    //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
    //         killAll(tree, signal, callback);
    //     });
    //     break;
    default: // Linux
        buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
          return spawnSync('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
        });
        killAll(tree, signal, callback);
        break;
    }
};

function killAll (tree, signal, callback) {
    var killed = {};
    try {
        Object.keys(tree).forEach(function (pid) {
            tree[pid].forEach(function (pidpid) {
                if (!killed[pidpid]) {
                    killPid(pidpid, signal);
                    killed[pidpid] = 1;
                }
            });
            if (!killed[pid]) {
                killPid(pid, signal);
                killed[pid] = 1;
            }
        });
    } catch (err) {
        if (callback) {
            return callback(err);
        } else {
            throw err;
        }
    }
    if (callback) {
        return callback();
    }
}

function killPid(pid, signal) {
    try {
        process.kill(parseInt(pid, 10), signal);
    }
    catch (err) {
        if (err.code !== 'ESRCH') throw err;
    }
}

function buildProcessTree (parentPid, tree, pidsToProcess, spawnChildProcessesListSync, cb) {
    var ps = spawnChildProcessesListSync(parentPid);
    var allData = ps.stdout.toString('ascii');

    delete pidsToProcess[parentPid];

    if (ps.status != 0) {
        // no more parent processes
        if (Object.keys(pidsToProcess).length == 0) {
            //cb();
        }
        return;
    }

    allData.match(/\d+/g).forEach(function (pid) {
        pid = parseInt(pid, 10);
        tree[parentPid].push(pid);
        tree[pid] = [];
        pidsToProcess[pid] = 1;
        buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesListSync, cb);
    });
}
