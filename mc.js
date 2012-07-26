#!/usr/bin/env node

var prog = require('commander'),
    http = require('http'),
    https = require('https'),
    readline = require('readline'),
    tty = require('tty'),
    util = require('util');

prog.version('0.0.3');
prog.parse(process.argv);

var CDMI = 'cdmi';
var CDMI_BASE = '/'.concat(CDMI);

var appState = {
    pathParts: [CDMI],
    currentDirectory: CDMI,
    cache: []
};

var contentTypes = {
    container: 'application/cdmi-container',
    domain: 'application/cdmi-domain',
    object: 'application/cdmi-object',
    queue: 'application/cdmi-queue'
};

var commands = [
    'cd',
    'clear',
    'exit',
    'header',
    'headers',
    'help',
    'pwd',
    'show'
];

var host = prog.args[0] || 'localhost',
    rl = readline.createInterface(process.stdin, process.stdout, completer),
    prefix = util.format('%s:%s>', host, appState.currentDirectory),
    auth = '';

rl.question('Username: ', function(answer) {
    auth = answer;
    rl.question('Password: ', function(answer) {
        auth += ':' + answer;
        init();
    });
});

var currentObject = {};

rl.write('administrator');

rl.on('line', function(line) {
    handleRequest(line);
}).on('close', quit);

function completer(line) {
    var results = [];
    var children = currentObject.children || [];

    for (i = 0; i < children.length; i++) {
        var item = children[i];
        if (item.indexOf(line) >= 0) {
            results.push(item);
        }
    }
    
    return [results, line];
}

function quit() {
    process.exit(0);
}

function handleRequest(line) {
    var request = parseRequest(line);
    switch(request.method) {
        case 'show':
        case 'get':
        case 'sh':
            showInfo(request);
            break;
        case 'put':
            putObject(request);
            break;
        case 'cd':
            changeDirectory(request);
            break;
        case 'pwd':
            printDirectory(request);
            break;
        case 'clear':
        case 'cls':
            clearTerminal();
            break;
        case 'header':
            setHeader(request);
            break;
        case 'headers':
            showHeaders(request);
            break;
        case 'download':
        case 'dl':
            download(request);
            break;
        case '..':
            upDirectory(request);
            break;
        case 'help':
            showHelp();
            break;
        case 'exit':
        case 'quit':
        case 'q':
            quit();
            break;
        default:
            changeDirectory(request);
            break;
    }
}

function showInfo(request) {
    var uri = '/' + appState.pathParts.join('/');
    var object = showObject({method: 'GET', uri: uri, args: request.args});

    //prompt();
}

function printDirectory() {
    var output = '/' + appState.pathParts.join('/');
    util.puts(output);
    prompt();
}

function clearTerminal() {
    process.stdout.write('\u001B[2J\u001B[0;0f');
    prompt();
}

function setHeader(request) {
    var key = request.args[0];
    var value = request.args[1];

    key = (key) ? key.replace(':', '') : '';

    if (value && value.length > 0) {
        headers[key] = value;
    } else if (key && key.length > 0) {
        delete headers[key];
    } else {
        util.puts('No key specified');
    }

    prompt();
}

function showHeaders(request) {
    var output = '\n';

    for (key in headers) {
        output += '> ' + key + ': ' + headers[key] + '\n';
    }

    util.puts(output);
    prompt();
}

function showHelp() {
    util.puts('\n> Suported Commands:');
    commands.forEach(function(cmd) {
        util.puts(util.format('    %s', cmd));
    });
    util.puts('\n');
    prompt();
}

function download(request) {
    /*console.log('args', currentObject, arguments);
    var dlRequest = {
        method: 'dl',
        uri: currentObject.parentURI + currentObject.objectName,
        args: request.args
    };
    getObject(dlRequest, function(object) {
        console.log(object);
    });*/
    prompt();
}

function upDirectory(request) {
    if (appState.pathParts.length > 1) {
        appState.pathParts.pop();
        appState.currentDirectory = appState.pathParts[appState.pathParts.length - 1];
        var prefix = host + ':' + appState.currentDirectory + '> ';
        //prompt();
        uri = '/' + appState.pathParts.join('/');
        updateCache({method: 'get', uri: uri});
    } else {
        util.puts('You\'re already at the top!');
        prompt();
    }
}

function changeDirectory(request) {
    var path = request.method;
    if (isValidPath(path)) {
        var pathParts = getPathParts(path);

        if (isRootPath(path)) {
            appState.pathParts = [CDMI].concat(pathParts);
        } else {
            pathParts.forEach(function(part) {
                appState.pathParts.push(part);
            });
        }

        appState.currentDirectory = appState.pathParts.slice(-1).toString();

        var uri = getPath();

        updateCache({method: 'get', uri: uri});
    } else {
        util.puts('That path or command does not exist');
        prompt();
    }
}

function getPathParts(path) {
    // Remove cdmi from path
    path = path.replace('/cdmi/', '/');

    // Remove leading slash
    if (path.slice(0, 1) === '/') {
        path = path.substring(1, path.length);
    }

    // Remove trailing slash
    if (path.slice(-1) === '/') {
        path = path.substring(0, path.length - 1);
    }

    return (path.length > 0) ? path.split('/') : [];
}

function getPath() {
    return '/' + appState.pathParts.join('/');
}

function isRootPath(path) {
    if (path.indexOf('/') === 0) {
        return true;
    }
}

function isValidPath(path) {
    var children = currentObject.children || [];

    if (children.length <= 0) {
        return false;
    }

    if (isRootPath(path)) { // If root
        return true;
    } else if (children.indexOf(path + '/') >= 0) { // If dir exists
        return true;
    } else if (children.indexOf(path) >= 0) { // If object exists
        return true;
    } else if (path.indexOf('/') >= 0) { // If path parts given
        return true;
    } else {
        return false;
    }
}

function showObject(request) {
    getObject(request, function(object) {
        var cdmiObject = JSON.parse(object);
        var key = (request.args) ? request.args[0] : '';
        var output = '';

        currentObject = cdmiObject;

        if (key && cdmiObject[key]) {
            output = util.inspect(cdmiObject[key], true, null, true);
        } else if (!key) {
            output = util.inspect(cdmiObject, true, null, true);
        } else {
            output = 'The key does not exist for this object';
        }

        util.puts(output);
    });
}

var headers = {
    'Accept': '*/*',
    'x-cdmi-specification-version': '1.0.1'
};

function getObject(request, cb) {
    var options = {
        host: host,
        port: 443,
        path: request.uri,
        method: request.method,
        auth: auth,
        headers: headers
    };

    var responseText = '';

    var req = https.request(options, function(res) {
        if (res.statusCode != 200) {
            util.puts(showErrorMessage(res.statusCode));
            prompt();
            return;
        }
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            responseText += chunk.toString();
        });
    });

    req.on('close', function() {
        if (responseText) {
            cb(responseText);
            prompt();
        }
    });

    req.on('error', function(e) {
        util.puts('Oops! There was a problem connecting to your server.');
        util.puts('');
        util.puts(e);
        prompt();
    });

    req.end();
}

function putObject(request) {
    var options = {
        host: host,
        port: 443,
        path: '/' +appState.pathParts.join('/') + '/' + request.objectName,
        method: request.method,
        auth: auth,
        headers: {
            'x-cdmi-specification-version': '1.0.1',
            'content-type': contentTypes[request.contentType],
            accept: '*/*'
        }
    };

    var req = https.request(options, function(res) {
        if (res.statusCode !== 200) {
            util.puts('Oops...there was an error processing your request. Please try again.');
            prompt();
            return;
        }
        res.on('close', function() {
            util.puts('Request completed successfully.');
            prompt();
        });
    });

    //req.write(request.body);
    req.end();
}

function parseRequest(line) {
    var args = line.split(' ');
    var method = args[0];
    var request;

    switch (method) {
        case 'get':
            request = {
                method: method,
                uri: args[1],
                args: args.slice(1, args.length) || []
            };
            break;
        case 'put':
            request = {
                method: method,
                contentType: args[1],
                body: args[2],
                objectName: args[3],
                args: args.slice(4, args.length) || []
            };
            break;
        default:
            request = {
                method: method,
                uri: args[1],
                args: args.slice(1, args.length) || []
            };
            break;
    } 

    return request;
}

function prompt() {
    var prefix = host + ':' + appState.currentDirectory + '> ';
    rl.setPrompt(prefix, prefix.length);
    rl.prompt();
}

function init() {
    welcome();
    prompt(prefix);
    getRoot();
}

function welcome() {
    util.puts('\n> CDMI Console. Version ' + prog.version() + '\n');
}

function getRoot() {
    updateCache({method: 'GET', uri: CDMI_BASE});
}

function showErrorMessage(status) {
    var message = 'There was an error processing your request...';

    switch (status) {
        case 403: message = 'Your username or password is incorrect'; break;
        case 404: message = 'The object could not be found'; break;
        case 500: message = 'There was an error on the server'; break;
        default: message = 'There was an error'; break;
    }

    return message;
}

function updateCache(request) {
    getObject(request, function(object) {
        currentObject = JSON.parse(object);
    });
}
