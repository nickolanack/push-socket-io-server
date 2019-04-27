function SIOMessageServer() {


	var app = require('express')();
	var http = require('http').Server(app);
	var io = require('socket.io')(http);

	app.get('/', function(req, res) {
		res.sendFile(__dirname + '/index.html');
	});

	io.on('connection', function(socket) {
		console.log('an user connected');
		socket.on('disconnect', function() {
			console.log('user disconnected');
		});
	});

	io.on('connection', function(socket) {
		socket.on('subscribe', function(channel) {
			socket.join(channel);
		});
	});

	io.on('connection', function(socket) {

		socket.on('subscribe', function(channel) {
			console.log('user subscribed to: `' + channel + '`');
			socket.join(channel);
		});

		console.log(JSON.stringify(socket.request.headers));

		socket.once('authenticate', function(credentials) {
			console.log("got credentials")
			socket.on('emit', function(msg) {
				console.log("got message: " + msg.channel + " => " + msg.message);
				io.in(msg.channel).emit(msg.message);
			});
		});



	});



	io.on('connection', function(socket) {
		socket.broadcast.emit('hi');
	});

	http.listen(8090, function() {
		console.log('listening on *:8090');
	});



}