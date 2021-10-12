const extend = require('./extend.js');

module.exports = class PushClient {


	constructor(pushsocket, socket, credentials, authCallback) {


		this.io = pushsocket.io;
		this.socket = socket;
		this.pushsocket = pushsocket;

		this.credentials = credentials;



		if (!authCallback) {
			authCallback = () => {}
		}

		var user = {
			user: credentials.username || "guest",
			socket: socket.id,
			ip: socket.request.headers['x-forwarded-for']
		}

		this.user = user;


		if (!this.pushsocket.isValidApp(credentials)) {

			if (credentials.password) {
				credentials.password = credentials.password[0] + "xxxxx...";
			}

			console.log('Invalid: ' + JSON.stringify(credentials));

			this.io.in('admin').emit('admin/error', 'Invalid app: [' + JSON.stringify(credentials) + ']');
			authCallback(false);
			return;
		}

		authCallback(true);


		var namespace = credentials.namespace || 'default';
		var appId = credentials.appId || 'default';


		this.prefix = appId + '/' + namespace + '/'


		var appInfo = this.pushsocket.getAppInfo(credentials);
		this.appInfo = appInfo;

		extend(user, appInfo);
		this.pushsocket.addUser(socket, user);

		socket.on('whomai', (msg, callback) => {
			callback(socket.id)
		});

		socket.on('emit', (msg, emitCallback) => {
			this.attemptEmit(msg, emitCallback);
		});


		if (this.pushsocket.clientCanEmit(credentials)) {
			this.socket.on('presence', (msg, emitCallback) => {
				this.subscribeToPresence(msg, emitCallback);
			});
		}

		socket.on('subscribe', (channel, emitCallback) => {
			this.subscribe(channel, emitCallback);
		});

		socket.on('unsubscribe', (channel, emitCallback) => {
			this.unsubscribe(channel, emitCallback);
		});



	}

	subscribe(channel, emitCallback) {

		if (typeof channel.channel == "string") {
			channel = channel.channel;
		}

		if (!emitCallback) {
			emitCallback = () => {}
		}

		if ((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error", "admin/presence", "admin/emit", "admin/request"]).indexOf(channel) >= 0) {
			emitCallback(false);
			return;
		}



		console.log('channel join: ' + this.prefix + channel + ': ' + JSON.stringify(this.user));
		this.socket.join(this.prefix + channel, () => {

			this.io.in('admin').emit('admin/join', extend({
				channel: channel
			}, this.user));


			this.pushsocket.updateUsersRooms(this.socket);
			console.log('join: ' + this.prefix + channel);
			console.log(JSON.stringify(this.socket.rooms));

			if (channel.indexOf('.presence') < 0) {
				this.io.in(this.prefix + channel).clients((err, list) => {
					this.io.in(this.prefix + channel + ".presence").emit(channel + '.presence', {
						list: list,
						channel: channel,
						added: this.user
					});
					this.io.in('admin').emit('admin/presence', extend({
						list: list,
						channel: channel,
						added: this.user
					}, this.appInfo));
				});

			}

			emitCallback(true);

		});



	}

	unsubscribe(channel, emitCallback) {
		if (!emitCallback) {
			emitCallback = () => {}
		}

		if ((["admin/connect", "admin/disconnect", "admin/join", "admin/leave", "admin/error", "admin/presence", , "admin/presence", "admin/emit", "admin/request"]).indexOf(channel) >= 0) {
			emitCallback(false);
			return;
		}


		this.socket.leave(this.prefix + channel, () => {

			this.io.in('admin').emit('admin/leave', extend({
				channel: this.prefix + channel
			}, this.user));


			this.pushsocket.updateUsersRooms(this.socket);
			console.log('left: ' + this.prefix + channel);
			console.log(JSON.stringify(this.socket.rooms));

			if (channel.indexOf('.presence') < 0) {
				this.io.in(this.prefix + channel).clients((err, list) => {
					this.io.in(this.prefix + channel + ".presence").emit(channel + '.presence', {
						list: list,
						channel: channel,
						removed: this.user
					});
					this.io.in('admin').emit('admin/presence', extend({
						list: list,
						channel: channel,
						removed: this.user
					}, this.appInfo));
				});

			}

			emitCallback(true);

		});
	}



	attemptEmit(msg, emitCallback) {

		if (!emitCallback) {
			emitCallback = () => {}
		}

		var messageCredentials = this.pushsocket.messageCredentials(msg);

		if (!(this.pushsocket.clientCanEmit(messageCredentials || this.credentials))) {

			console.log('emit attempt failed ' + this.socket.request.headers['x-forwarded-for']);
			emitCallback(false);

			return;
			
		} 
		this.emit(msg, emitCallback);

	}

	emit(msg, emitCallback) {

		if (!emitCallback) {
			emitCallback = () => {};
		}

		console.log('emit ' + this.socket.request.headers['x-forwarded-for']);

		this.pushsocket.emit(this.prefix, msg, this.user, emitCallback);

	}


	subscribeToPresence(msg, emitCallback) {

		if (!emitCallback) {
			emitCallback = () => {}
		}

		this.pushsocket.getPresence(this.prefix, msg.channel||message.channels, (presence)=>{

			emitCallback(presence);
	        
	        this.socket.emit('presence', presence); //only sent to requestor
	        
	        this.io.in('admin').emit('admin/request', extend({}, msg, this.user, presence));

		});

		
	}



}