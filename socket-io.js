const extend = require('./extend.js');

class SIOServer {


    constructor() {

        var express = require('express');



        var server = express();
        server.use(express.json());
        server.use(express.urlencoded({
            extended: true
        }));

        var WebConsole = require('./webconsole.js');
        var wconsole = new WebConsole(__dirname, server);


        fs.readFile(__dirname + '/appdata/admin.json', function(err, data) {
            if (err) {
                console.log('error:' + err);
                return;
            }

            var config=JSON.parse(data.toString());

            if(config.enabled!==true){
                return;
            }

            wconsole.showAdmin(config);
        });


        var http = require('http').Server(server);
        this.http=http;
        var io = require('socket.io')(http);


        var PushSocket = require('./pushsocket.js');
        var pushsocket = new PushSocket(__dirname, io);
        this.pushsocket=pushsocket;


        server.post('/emit', function(req, res) {


            console.log(req.body);

            var credentials = JSON.parse(req.body.credentials || req.query.credentials || "{}");



            if (!pushsocket.clientCanEmit(credentials)) {
                res.send(JSON.stringify({
                    "message": "invalid",
                    "code": 1,
                    "success": false,
                    "echo": req.body
                }));
                return;
            }

            if (!pushsocket.isValidApp(credentials)) {
                res.send(JSON.stringify({
                    "message": "invalid",
                    "code": 2,
                    "success": false,
                    "echo": req.body
                }));
                return;
            }

            var namespace = credentials.namespace || 'default';
            var appId = credentials.appId || 'default';
            var prefix = appId + '/' + namespace + '/';

            var user = {
                user: credentials.username || "guest",
                socket: req.ip,
                ip: req.ips,
                _ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
            }

            var channel = req.body.channel || req.query.channel || "";
            try {
                channel = JSON.parse(channel) || channel;
            } catch (e) {

            }
            var data = JSON.parse(req.body.data || req.query.data || "{}");

            pushsocket.emit(prefix, {
                "channel": channel,
                "data": data
            }, user, function(success) {
                res.send(JSON.stringify({
                    "success": success
                }));
            });
        });

        server.post('/presence', function(req, res) {


            console.log(req.body);

            var credentials = JSON.parse(req.body.credentials || req.query.credentials || "{}");



            if (!pushsocket.clientCanEmit(credentials)) {
                res.send(JSON.stringify({
                    "message": "invalid",
                    "code": 1,
                    "success": false,
                    "echo": req.body
                }));
                return;
            }

            if (!pushsocket.isValidApp(credentials)) {
                res.send(JSON.stringify({
                    "message": "invalid",
                    "code": 2,
                    "success": false,
                    "echo": req.body
                }));
                return;
            }

            var namespace = credentials.namespace || 'default';
            var appId = credentials.appId || 'default';
            var prefix = appId + '/' + namespace + '/';

            var user = {
                user: credentials.username || "guest",
                socket: req.ip,
                ip: req.ips,
                _ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
            }

            var channels = req.body.channels || req.query.channels || "";
            try {
                channels = JSON.parse(channels) || channels;
            } catch (e) {

            }


            var channel = req.body.channel || req.query.channel || "";
            try {
                channel = JSON.parse(channel) || channel;
            } catch (e) {

            }


            pushsocket.getPresence(prefix, channel || channels, (presence) => {
                res.send(JSON.stringify(extend({
                    'success': true
                }, presence)));
                io.in('admin').emit('admin/request', extend({}, user, presence));
            });

        });



    }

    listen(port, then) {
        this.http.listen(port, () => {
            console.log('listening on *:' + port);
            if (then) {
                then(this);
            }
        });
    };

    addAppDefinition(name, config){
        this.pushsocket.addAppDefinition(name, config);
        return this;
    }

}



if (process.argv && process.argv[1] === __filename) {
    (new SIOServer()).listen(8090)
}


module.exports = {
    SocketIOServer: SIOServer
};