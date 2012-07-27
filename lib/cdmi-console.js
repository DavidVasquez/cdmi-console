var readline = require('readline'),
    tty = require('tty'),
    http = require('http'),
    https = require('https'),
    util = require('util');

this.create = function(host, port, version) {
    return new CdmiConsole(host, port, version);
};

var CdmiConsole = function(host, port, version) {
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

    var validTypes = {};
    validTypes[contentTypes.domain] = [
        contentTypes.domain,
        contentTypes.container,
        contentTypes.object
    ];
    validTypes[contentTypes.container] = [
        contentTypes.container,
        contentTypes.object,
        contentTypes.queue
    ];
    validTypes[contentTypes.queue] = [];
    validTypes[contentTypes.object] = [];

    var headers = {
        'Accept': '*/*',
        'x-cdmi-specification-version': '1.0.1'
    };

    var commands = [
        'clear',
        'del[ete]',
        'q[uit]',
        'header',
        'headers',
        'help',
        'pwd',
        'sh[ow]'
    ];

    var prefix = util.format('%s:%s>', host, appState.currentDirectory),
        user = '',
        pass = '',
        auth = '';

    var currentObject = {};

    this.initialize = function() {
        readline = readline.createInterface(process.stdin, process.stdout, completer);
        readline.on('line', function(line) {
            handleRequest(line);
        }).on('close', quit);

        login(function() {
            welcome();
            prompt(prefix);
            getRoot();
        });
    };


    function login(cb) {
        readline.question('Username: ', function(username) {
            user = username;
            readline.question('Password: ', function(password) {
                pass = password;
                cb();
            });
        });

        readline.write('administrator');
    }

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

    function handleRequest(line) {
        if (line.length === 0) {
            prompt();
            return;
        }

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
            case 'create':
                createObject(request);
                break;
            case 'delete':
            case 'del':
            case 'rm':
                deleteObject(request);
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
        var uri = getPath();
        var object = showObject({method: 'GET', uri: uri, args: request.args});

        //prompt();
    }

    function printDirectory() {
        var output = getPath();
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
        util.puts('\n> Supported Commands:');
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
        get(dlRequest, function(object) {
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
            util.puts('The path or command does not exist');
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
        get(request, function(object) {
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

    function createObject(request) {
        var objectType = request.args[0] || '';
        var objectName = request.args[1] || '';
        var contentType = getContentType(objectType);

        if (isValidContext(contentType)) {
            readline.question('... ', function(body) {
                var url = getPath().concat('/').concat(objectName);
                put({
                    method: 'PUT',
                    uri: url,
                    args: [body].concat(request.args)
                }, function() {
                    util.puts('Object created!');
                    prompt();
                });
            });
        } else {
            if (!contentTypes[objectType]) {
                util.puts('Not a valid object');
                prompt();
                return;
            }

            var output = '',
                typesList = [];

            var types = getValidTypes(contentType);
            types.forEach(function(type) {
                for (typeName in contentTypes) {
                    if (contentTypes[typeName] === type) {
                        typesList.push(typeName);
                    }
                }
            });

            output += util.format('\n> You can\'t create a %s here.\n', objectType);
            output += util.format('  Stuff you can create:\n    %s\n', typesList.join(', '));

            util.puts(output);
            prompt();
        }
    }

    function deleteObject(request) {
        var objectType = request.args[0] || '',
            objectName = request.args[1] || '',
            contentType = contentTypes[objectType] || '';

        if (objectName !== '') {
            var url = getPath().concat('/').concat(objectName);
            del({
                method: 'DELETE',
                uri: url,
                args: [contentType].concat(request.args)
            }, function(result) { // callback
                util.puts('Object deleted');
                prompt();
            }, function() { // errback
            });
        }
    }

    function getContentType(objectType) {
        return contentTypes[objectType];
    }

    function getValidTypes(contentType) {
        return validTypes[contentType];
    }

    function isValidContext(contentType) {
        var types = validTypes[currentObject.objectType];

        return types.indexOf(contentType) >= 0;
    }

    function get(request, callback, errback) {
        var options = {
            host: host,
            port: port,
            path: request.uri,
            method: request.method,
            auth: getAuth(),
            headers: headers
        };

        var responseText = '';

        var req = https.request(options, function(res) {
            if (res.statusCode != 200) {
                util.puts(getErrorMessage(res.statusCode));
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
                callback(responseText);
                prompt();
            }
        });

        req.on('error', function(e) {
            util.puts('Oops! There was a problem connecting to your server.\n');
            util.puts(e);
            prompt();
        });

        req.end();
    }

    function put(request, callback, errback) {
        var body = request.args[0];
        var type = request.args[1];

        var hdrs = mixin(headers, {
            'content-length': body.length,
            'content-type': contentTypes[type]
        });

        var options = {
            host: host,
            port: port,
            path: request.uri,
            method: request.method,
            auth: getAuth(),
            headers: hdrs
        };

        var responseText = '';

        var req = https.request(options, function(res) {
            if (res.statusCode > 204) {
                util.puts(getErrorMessage(res.statusCode));
                prompt();
                return;
            }
            res.on('data', function(chunk) {
                responseText += chunk.toString();
            });
        });

        req.on('close', function() {
            if (responseText) {
                callback(responseText);
                prompt();
            }
        });

        req.on('error', function(e) {
            util.puts('Oops! There was a problem connecting to your server.\n');
            util.puts(e);
            prompt();
        });

        req.write(body);
        req.end();
    }

    function del(request, callback, errback) {
        var hdrs = mixin(headers, {
            'content-type': request.args[0]
        });
        var options = {
            host: host,
            port: port,
            path: request.uri,
            method: request.method,
            auth: getAuth(),
            headers: hdrs
        };

        var responseText = '';

        var req = https.request(options, function(res) {
            if (res.statusCode > 204) {
                util.puts(getErrorMessage(res.statusCode));
                prompt();
                return;
            }
            res.on('data', function(chunk) {
                responseText += chunk.toString();
            });
        });

        req.on('close', function() {
            callback(responseText);
        });

        req.end();
    }

    function mixin(o1, o2) {
        for (prop in o1) {
            if (o1.hasOwnProperty(prop)) {
                o2[prop] = o1[prop];
            }
        }

        return o2;
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

    function getAuth() {
        return user.concat(':').concat(pass);
    }

    function prompt() {
        var prefix = host + ':' + appState.currentDirectory + '> ';
        readline.setPrompt(prefix, prefix.length);
        readline.prompt();
    }

    function welcome() {
        util.puts('\n> CDMI Console. Version ' + version + '\n');
    }

    function getRoot() {
        updateCache({method: 'GET', uri: CDMI_BASE});
    }

    function getErrorMessage(status) {
        var message = 'There was an error processing your request...';

        switch (status) {
            case 403: message = 'Your username or password is incorrect'; break;
            case 404: message = 'The object could not be found'; break;
            case 500: message = 'There was an error on the server'; break;
            default: message = 'There was an error (Status: ' + status + ')'; break;
        }

        return message;
    }

    function updateCache(request) {
        get(request, function(object) {
            currentObject = JSON.parse(object);
        });
    }

    function quit() {
        process.exit(0);
    }
};
