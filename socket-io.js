

function SIOServer() {


 

    var express=require('express');

   

    var server = express();
    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));

    var WebConsole=require('./webconsole.js');
    var wconsole=new WebConsole(__dirname, server);

   
    var http = require('http').Server(server);
    var io = require('socket.io')(http);


    var PushSocket=require('./pushsocket.js');
    var pushsocket=new PushSocket(__dirname, io);


    server.post('/emit', function(req, res) {


        console.log(req.body);

        var credentials=JSON.parse(req.body.credentials||req.query.credentials||"{}");

        

        if(!pushsocket.clientCanEmit(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":1,
                "success":false,
                "echo":req.body
            }));
            return;
        }

        if(!pushsocket.isValidApp(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":2,
                "success":false,
                "echo":req.body
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

        var channel=req.body.channel||req.query.channel||"";
        try{
            channel=JSON.parse(channel)||channel;
        }catch(e){

        }
        var data=JSON.parse(req.body.data||req.query.data||"{}");

        pushsocket.emit(prefix, {
            "channel":channel,
            "data":data
        },user, function(success){
             res.send(JSON.stringify({
                 "success":success
             }));
        });
    });

    server.post('/presence', function(req, res) {


        console.log(req.body);

        var credentials=JSON.parse(req.body.credentials||req.query.credentials||"{}");

        

        if(!pushsocket.clientCanEmit(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":1,
                "success":false,
                "echo":req.body
            }));
            return;
        }

        if(!pushsocket.isValidApp(credentials)){
            res.send(JSON.stringify({
                "message":"invalid",
                "code":2,
                "success":false,
                "echo":req.body
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

        var channels=req.body.channels||req.query.channels||"";
        try{
            channels=JSON.parse(channels)||channels;
        }catch(e){

        }


        var channel=req.body.channel||req.query.channel||"";
        try{
            channel=JSON.parse(channel)||channel;
        }catch(e){

        }

        if(channels&&!channel){
        
            pushsocket.getPresence(channels, (list)=>{
                res.send(JSON.stringify({
                    'channels': channels,
                    'presence': list,
                    'success':true
                }));
            });

            return;
        }


        pushsocket.getPresence([channel], (list)=>{
            res.send(JSON.stringify({
                'channel': channel,
                'presence': list.pop().presence,
                'success':true
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