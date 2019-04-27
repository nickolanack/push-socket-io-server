
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

        console.log(JSON.stringify(socket.request.headers));
        socket.once('authenticate', function(credentials) {

            if (!me.isValidCredentials(credentials)) {
                io.in('admin').emit('admin/error', 'Invalid credentials: [' + Object.keys(credentials).join(', ') + ']');
                return;
            }

            var user={
                user:credentials.username||"guest",
                socket:socket.id
            }

            var rooms=[];


            var namespace = credentials.namespace || 'default';
            var appId = credentials.appId || 'default';

            if (me.clientCanEmit(credentials)) {
                socket.on('emit', function(msg) {
                    io.in(appId + '/' + namespace + '/' + msg.channel).emit(msg.channel, msg.data);
                    io.in('admin').emit('admin/emit', extend(msg, user));
                });
            }

            if (me.clientCanMonitor(credentials)) {
                socket.join('admin');
            }

            socket.on('subscribe', function(channel) {

                if((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error" , "admin/presence", "admin/emit",]).indexOf(channel)>=0){
                    return;
                }


               



                socket.join(appId + '/' + namespace + '/' + channel, function(){

                    io.in('admin').emit('admin/join', extend({
                        channel: appId + '/' + namespace + '/' + channel
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
                                channel:appId + '/' + namespace + '/' + channel,
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

    me.isValidCredentials = function(credentials) {
        return (credentials.appId);
    };

    me.clientCanEmit = function(credentials) {

        if (credentials.username == "{test-server-name}" && credentials.password == "{password}" && credentials.appId == "{test-app-id}") {
            return true;
        }
        return false;

    };

    me.clientCanMonitor = function(credentials) {

        if (credentials.username == "{test-monitor-name}" && credentials.password == "{password}") {
            return true;
        }
        return false;

    };



}



(new SIOServer()).listen(8090)