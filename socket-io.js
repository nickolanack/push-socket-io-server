var extend = function(a, b) {


    Array.prototype.slice.call(arguments, 1).forEach(function(b) {
        b = b || {};
        Object.keys(b).forEach(function(k) {
            a[k] = b[k];
        });
    });
    return a;
}



function SIOServer() {


    var me = this;

    var app = require('express')();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);

    app.get('/', function(req, res) {
        res.sendFile(__dirname + '/index.html');
    });
    app.get('/client.js', function(req, res) {
        res.sendFile(__dirname + '/client.js');
    });
    app.get('/admin', function(req, res) {

        var Twig = require('twig');
        var twig = Twig.twig;

        var fs = require('fs');


        fs.readFile(__dirname + '/admin.html', function(err, data) {

            if (err) {
                console.log('error:' + err);
                return;
            }


            var template = twig({
                data: data.toString()
            });


            fs.readFile(__dirname + '/appdata/admin.json', function(err, data) {
                if (err) {
                    console.log('error:' + err);
                    return;
                }
                var out = template.render(JSON.parse(data.toString()));
                res.send(out);
            });



        })


    });


    io.on('connection', function(socket) {

        console.log('socket: ' + socket.request.headers['x-forwarded-for']);
        socket.once('authenticate', function(credentials, authCallback) {


            if (!authCallback) {
                authCallback = function() {}
            }

            var user = {
                user: credentials.username || "guest",
                socket: socket.id,
                ip: socket.request.headers['x-forwarded-for']
            }


            if (me.clientCanMonitorAdmin(credentials)) {
                socket.join('admin', function() {
                    me._addAdminListeners(socket, user);
                });
                console.log('admin join: ' + JSON.stringify(user));
                if (!me.isValidApp(credentials)) {
                    authCallback(true);
                    return;
                }
                socket.on('disconnect', function() {
                    console.log('admin disconnect ' + JSON.stringify(user));
                });
            }


            if (!me.isValidApp(credentials)) {
                
                if (credentials.password) {
                    credentials.password = credentials.password[0] + "xxxxx...";
                }

                console.log('Invalid: '+JSON.stringify(credentials));

                io.in('admin').emit('admin/error', 'Invalid app: [' + JSON.stringify(credentials) + ']');
                authCallback(false);
                return;
            }

            authCallback(true);


            var namespace = credentials.namespace || 'default';
            var appId = credentials.appId || 'default';

            var appInfo = me.getAppInfo(credentials);

            extend(user, appInfo);
            me.addUser(socket, user);

            socket.on('whomai', function(msg, callback) {
                callback(socket.id)
            });

            socket.on('emit', function(msg, emitCallback) {
                if (!emitCallback) {
                        emitCallback = function() {}
                    }

                var messageCredentials = me.messageCredentials(msg);

                if (me.clientCanEmit(messageCredentials || credentials)) {

                    

                    io.in(appId + '/' + namespace + '/' + msg.channel).clients(function(err, list) {
                        io.in('admin').emit('admin/emit', extend({
                            'subscribers': list
                        }, msg, user));
                    });

                    io.in(appId + '/' + namespace + '/' + msg.channel).emit(msg.channel, msg.data);
                    emitCallback(true);


                } else {
                    emitCallback(false);
                }

            });



            if (me.clientCanEmit(credentials)) {

                socket.on('presence', function(msg, emitCallback) {
                    if (!emitCallback) {
                        emitCallback = function() {}
                    }


                    if ((!msg.channel) && msg.channels) {


                        var listPresence = [];
                        var getChannelPresence = function(channels, then) {

                            var temp = channels.slice(0);
                            if (!temp.length) {
                                then(listPresence);
                                return;
                            }

                            io.in(appId + '/' + namespace + '/' + channels[0]).clients(function(err, list) {
                                var users = list.map(function(u) {
                                    return me.getUserInfo(u);
                                });

                                listPresence.push({
                                    'channel': channels[0],
                                    'presence': users
                                });

                                getChannelPresence(channels.slice(1), then);

                            });
                        };

                        getChannelPresence(msg.channels.slice(0), function(list) {


                            io.in('admin').emit('admin/emit', extend({
                                'channels': msg.channels,
                                'presence': list
                            }, msg, user));

                            socket.emit('presence', {
                                'channels': msg.channels,
                                'presence': list
                            });

                            emitCallback({
                                'channels': msg.channels,
                                'presence': list
                            });


                        });


                        return;

                    }


                    io.in(appId + '/' + namespace + '/' + msg.channel).clients(function(err, list) {

                        var users = list.map(function(u) {
                            return me.getUserInfo(u);
                        });

                        io.in('admin').emit('admin/emit', extend({
                            'channel': appId + '/' + namespace + '/' + msg.channel,
                            'presence': users
                        }, msg, user));

                        socket.emit('presence', {
                            channel: appId + '/' + namespace + '/' + msg.channel,
                            presence: users
                        });

                        emitCallback({
                            channel: appId + '/' + namespace + '/' + msg.channel,
                            presence: users
                        });

                    });



                })



            }



            socket.on('subscribe', function(channel, emitCallback) {

                if ((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error", "admin/presence", "admin/emit", ]).indexOf(channel) >= 0) {
                    emitCallback(false);
                    return;
                }



                console.log('channel join: ' + appId + '/' + namespace + '/' + channel + ': ' + JSON.stringify(user));
                socket.join(appId + '/' + namespace + '/' + channel, function() {

                    io.in('admin').emit('admin/join', extend({
                        channel: channel
                    }, user));


                    me._updateUsersRooms(socket);
                    console.log('join: ' + appId + '/' + namespace + '/' + channel);
                    console.log(JSON.stringify(socket.rooms));

                    if (channel.indexOf('.presence') < 0) {
                        io.in(appId + '/' + namespace + '/' + channel).clients(function(err, list) {
                            io.in(appId + '/' + namespace + '/' + channel + ".presence").emit(channel + '.presence', {
                                list: list,
                                channel: channel,
                                added: user
                            });
                            io.in('admin').emit('admin/presence', extend({
                                list: list,
                                channel: channel,
                                added: user
                            }, appInfo));
                        });

                    }

                    emitCallback(true);

                });



            });

            socket.on('unsubscribe', function(channel, emitCallback) {

                if ((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error", "admin/presence", , "admin/presence", "admin/emit", ]).indexOf(channel) >= 0) {
                    
                    emitCallback(false);
                    return;
                }



                socket.leave(appId + '/' + namespace + '/' + channel, function() {

                    io.in('admin').emit('admin/leave', extend({
                        channel: appId + '/' + namespace + '/' + channel
                    }, user));


                    me._updateUsersRooms(socket);
                    console.log('left: ' + appId + '/' + namespace + '/' + channel);
                    console.log(JSON.stringify(socket.rooms));

                    if (channel.indexOf('.presence') < 0) {
                        io.in(appId + '/' + namespace + '/' + channel).clients(function(err, list) {
                            io.in(appId + '/' + namespace + '/' + channel + ".presence").emit(channel + '.presence', {
                                list: list,
                                channel: channel,
                                removed: user
                            });
                            io.in('admin').emit('admin/presence', extend({
                                list: list,
                                channel: channel,
                                removed: user
                            }, appInfo));
                        });

                    }

                    emitCallback(true);

                });



            });



            //administrators:



            socket.once('subscribe', function() {

                io.in('admin').emit('admin/connect', user);

                socket.on('disconnect', function() {
                    io.in('admin').emit('admin/disconnect', user);
                    var filteredRooms = me.getUserRooms(socket).filter(function(channelPath) {
                        return channelPath.indexOf('.presence') < 0 && channelPath.indexOf(appId + '/' + namespace) === 0;
                    });
                    filteredRooms.forEach(function(channelPath) {



                        var channel = channelPath.replace(appId + '/' + namespace + '/', '');
                        io.in(channelPath).clients(function(err, list) {
                            io.in(channelPath + ".presence").emit(channel + '.presence', {
                                list: list,
                                channel: channel,
                                removed: user
                            });
                            io.in('admin').emit('admin/presence', extend({
                                list: list,
                                channel: channel,
                                removed: user,
                                usersChannels: filteredRooms
                            }, appInfo));
                        });


                    });
                });
            });



        });

    });


    me.addUser = function(socket, user) {


        if (!me._users) {
            me._users = {};
        }

        if (me._users[socket.id]) {
            return;
        }

        me._users[socket.id] = user;

        socket.on('disconnect', function() {
            delete me._users[socket.id];
        });

    }


    me._updateUsersRooms = function(socket) {


        var id = socket.id;
        if (!me._rooms) {
            me._rooms = {};

            socket.on('disconnect', function() {
                setTimeout(function() {
                    delete me._rooms[id];
                }, 500);
            });
        }

        me._rooms[id] = Object.keys(socket.rooms);



    }

    me.getUserRooms = function(socket) {

        var id = socket.id || socket;

        if (!me._rooms) {
            return [];
        }

        if (!me._rooms[id]) {
            return [];
        }
        return me._rooms[id];

    }


    me.getUserInfo = function(socket) {

        var id = socket.id || socket;

        if (!me._users) {
            return {};
        }

        if (!me._users[id]) {
            return {};
        }

        return me._users[id];
    }


    me.getAppInfo = function(credentials) {

        var fs = require('fs');
        var appDataFile = __dirname + '/appdata/' + credentials.appId + '.json';
        if (!(credentials.appId && fs.existsSync(appDataFile))) {
            return {

                "namespace": credentials.namespace || 'default',
                "appId": credentials.appId || 'default',
                "project": "invalid"

            };
        }

        var appData = JSON.parse(fs.readFileSync(appDataFile));

        return {

            "namespace": credentials.namespace || 'default',
            "appId": credentials.appId || 'default',
            "project": appData.project || (credentials.appId + ".json")

        };
    }

    me._addAdminListeners = function(socket) {

        /**
         * add admin functions, only channel members of `admin` can access
         */

        socket.on('client-list', function(args, callback) {
            io.sockets.clients(function(err, list) {

                if (err) {
                    callback(err);
                    return;
                }

                callback(list.map(function(socket) {
                    return extend({
                        'channels': me.getUserRooms(socket)
                    }, me.getUserInfo(socket))
                }));
            })
        });

        socket.on('app-list', function(args, callback) {
            io.sockets.clients(function(err, list) {

                if (err) {
                    callback(err);
                    return;
                }

                callback(list.map(function(socket) {
                    var info = me.getUserInfo(socket);
                    return info.appId + " " + info.project;
                }).filter(function(value, index, array) {
                    return array.indexOf(value) === index;
                }));
            })
        });
    };


    me.listen = function(port) {
        http.listen(port, function() {
            console.log('listening on *:' + port);
        });
    };

    me.isValidApp = function(credentials) {
        return (credentials.appId);
    };

    me.messageCredentials = function(msg) {
        if (msg.credentials) {
            console.log('using message credentials: '+JSON.stringify(msg.credentials));
            return msg.credentials;
        }
        return false;
    }

    me.clientCanEmit = function(credentials) {

        var fs = require('fs');
        var appDataFile = __dirname + '/appdata/' + credentials.appId + '.json';
        if (!(credentials.appId && fs.existsSync(appDataFile))) {
            return false;
        }

        var appData = JSON.parse(fs.readFileSync(appDataFile));

        if (credentials.username === appData.username && credentials.password === appData.password) {
            return true;
        }

        if (credentials.apiKey == appData.apiKey) {
            return true;
        }

        return false;

    };

    me.clientCanMonitorAdmin = function(credentials) {

        var fs = require('fs');
        var adminDataFile = __dirname + '/appdata/admin.json';
        if (!fs.existsSync(adminDataFile)) {
            return false;
        }

        var adminData = JSON.parse(fs.readFileSync(adminDataFile));

        if (credentials.username === adminData.username && credentials.password === adminData.password) {
            return true;
        }
        return false;

    };



}



(new SIOServer()).listen(8090)