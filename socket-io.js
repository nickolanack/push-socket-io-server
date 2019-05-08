
var extend = function(a, b) {

    b = b || {};
    Object.keys(b).forEach(function(k) {
        a[k] = b[k];
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
        res.sendFile(__dirname + '/admin.html');
    });

    
    io.on('connection', function(socket) {

        console.log('socket: '+socket.request.headers['x-forwarded-for']);
        socket.once('authenticate', function(credentials, authCallback) {


            if(!authCallback){
                authCallback=function(){}
            }

             var user={
                user:credentials.username||"guest",
                socket:socket.id,
                ip:socket.request.headers['x-forwarded-for']
            }

            var rooms=[];


            if (me.clientCanMonitorAdmin(credentials)) {
                socket.join('admin');
                console.log('admin join: '+JSON.stringify(user));
                if (!me.isValidApp(credentials)) {
                    authCallback(true);
                    return;
                }
                socket.on('disconnect', function() {
                    console.log('admin disconnect '+JSON.stringify(user));
                });
            }


            if (!me.isValidApp(credentials)) {
                console.log('Invalid');
                if(credentials.password){
                    credentials.password=credentials.password[0]+"xxxxx...";
                }
                io.in('admin').emit('admin/error', 'Invalid app: [' + JSON.stringify(credentials) + ']');
                authCallback(false);
                return;
            }

           authCallback(true);


            var namespace = credentials.namespace || 'default';
            var appId = credentials.appId || 'default';

            if (me.clientCanEmit(credentials)) {
                socket.on('emit', function(msg, emitCallback) {

                    if(!emitCallback){
                        emitCallback=function(){}
                    }

                    io.in(appId + '/' + namespace + '/' + msg.channel).clients(function(err, list){
                        io.in('admin').emit('admin/emit', extend(extend(msg, user), {
                            'appId': appId,
                            'namespace':namespace,
                            'subscribers':list
                        }));


                    });

                    io.in(appId + '/' + namespace + '/' + msg.channel).emit(msg.channel, msg.data);
                    emitCallback(true);
                    
                });
            }

            

            socket.on('subscribe', function(channel) {

                if((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error" , "admin/presence", "admin/emit",]).indexOf(channel)>=0){
                    return;
                }


               


                console.log('channel join: '+appId + '/' + namespace + '/' + channel+': '+JSON.stringify(user));
                socket.join(appId + '/' + namespace + '/' + channel, function(){

                    io.in('admin').emit('admin/join', extend({
                        'appId': appId,
                        'namespace':namespace,
                        channel: channel
                    }, user));

                    rooms=Object.keys(socket.rooms);
                    console.log('join: '+appId + '/' + namespace + '/' + channel);
                    console.log(JSON.stringify(socket.rooms));

                    if(channel.indexOf('.presence')<0){
                        io.in(appId + '/' + namespace + '/' + channel).clients(function(err, list){
                            io.in(appId + '/' + namespace + '/' + channel+".presence").emit(channel+'.presence', {
                                list:list,
                                channel:appId + '/' + namespace + '/' + channel,
                                added:user
                            });
                            io.in('admin').emit('admin/presence', extend({
                                list:list,
                                'appId': appId,
                               'namespace':namespace,
                                channel:channel,
                                added:user
                            }));
                        });
                       
                    }

                });
                


            });

            socket.on('unsubscribe', function(channel) {

                if((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error", "admin/presence", , "admin/presence", "admin/emit",]).indexOf(channel)>=0){
                    return;
                }


               



                socket.leave(appId + '/' + namespace + '/' + channel, function(){

                    io.in('admin').emit('admin/leave', extend({
                        channel: appId + '/' + namespace + '/' + channel
                    }, user));

                    rooms=Object.keys(socket.rooms);
                    console.log('left: '+appId + '/' + namespace + '/' + channel);
                    console.log(JSON.stringify(socket.rooms));

                    if(channel.indexOf('.presence')<0){
                        io.in(appId + '/' + namespace + '/' + channel).clients(function(err, list){
                            io.in(appId + '/' + namespace + '/' + channel+".presence").emit(channel+'.presence', {
                                list:list,
                                channel:appId + '/' + namespace + '/' + channel,
                                removed:user
                            });
                            io.in('admin').emit('admin/presence', extend({
                                list:list,
                                channel:appId + '/' + namespace + '/' + channel,
                                removed:user
                            }));
                        });
                       
                    }

                });
                


            });




           //administrators:



            socket.once('subscribe', function(){

                io.in('admin').emit('admin/connect', user);

                socket.on('disconnect', function() {
                    io.in('admin').emit('admin/disconnect', user);
                    var filteredRooms=rooms.filter(function(channelPath){

                        return channelPath.indexOf('.presence')<0&&channelPath.indexOf(appId + '/' + namespace)===0;

                    });
                    filteredRooms.forEach(function(channelPath){


                        
                            var channel=channelPath.replace(appId + '/' + namespace+'/','');
                            io.in(channelPath).clients(function(err, list){
                                io.in(channelPath+".presence").emit(channel+'.presence', {
                                    list:list,
                                    channel:channelPath,
                                    removed:user
                                });
                                io.in('admin').emit('admin/presence', extend({
                                    list:list,
                                    channel:channelPath,
                                    removed:user,
                                    usersChannels:filteredRooms
                                }));
                            });
                           
                        
                    });
                });
            });

            

        });



    });



    me.listen = function(port) {
        http.listen(port, function() {
            console.log('listening on *:' + port);
        });
    }

    me.isValidApp = function(credentials) {
        return (credentials.appId);
    };

    me.clientCanEmit = function(credentials) {

        var fs = require('fs');
        var appDataFile=__dirname+'/appdata/'+credentials.appId+'.json';
        if(!(credentials.appId&&fs.existsSync(appDataFile))){
            return false;
        }

        var appData=JSON.parse(fs.readFileSync(appDataFile));

        if (credentials.username === appData.username && credentials.password === appData.password) {
            return true;
        }

        if (credentials.apiKey ==appData.apiKey) {
            return true;
        }

        return false;

    };

    me.clientCanMonitorAdmin = function(credentials) {

        var fs = require('fs');
        var adminDataFile=__dirname+'/appdata/admin.json';
        if(!fs.existsSync(adminDataFile)){
            return false;
        }

        var adminData=JSON.parse(fs.readFileSync(adminDataFile));

        if (credentials.username === adminData.username && credentials.password === adminData.password) {
            return true;
        }
        return false;

    };



}



(new SIOServer()).listen(8090)