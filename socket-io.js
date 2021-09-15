

function SIOServer() {


 

    var express=require('express');
    var server = express();

    var WebConsole=require('./webconsole.js');
    var wconsole=new WebConsole(__dirname, server);

   
    var http = require('http').Server(server);
    var io = require('socket.io')(http);


    var PushSocket=require('./pushsocket.js');
    var pushsocket=new PushSocket(__dirname, io);


    server.get('/emit', function(req, res) {

        var credentials=JSON.parse(req.query.credentials||"{}");

        


        if(!pushsocket.clientCanEmit(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":1,
                "success":false,
                "echo":req.query
            }));
            return;
        }

        if(!pushsocket.isValidApp(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":2,
                "success":false,
                "echo":req.query
            }));
            return;
        }

        var namespace = credentials.namespace || 'default';
        var appId = credentials.appId || 'default';
        var prefix = appId + '/' + namespace + '/';

        var user = {
            user: credentials.username || "guest",
            socket: req.ip,
            ip: req.ips
        }

        var channel=req.query.channel||"";
        try{
            channel=JSON.parse(channel)||channel;
        }catch(e){
            
        }
        var data=JSON.parse(req.query.data||"{}");

        pushsocket.emit(prefix, {
            "channel":channel,
            "data":data
        },user, function(success){
             res.send(JSON.stringify({
                 "success":success
             }));
        });
    });


    this.listen = (port) => {
        http.listen(port, function() {
            console.log('listening on *:' + port);
        });
    };

}



(new SIOServer()).listen(8090)