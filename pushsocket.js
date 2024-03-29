const PushClient = require('./pushclient.js');
const extend = require('./extend.js');


module.exports = class PushSocket {



	constructor(path, io) {


		this._apps = {
			'default': {}
		};

		this.io = io;
		this.io.on('connection', (socket) => {

			var id = typeof socket.request.headers['x-forwarded-for'] != 'undefined' ? socket.request.headers['x-forwarded-for'] : socket.conn.id

			console.log('pushsocket: ' + id);
			socket.once('authenticate', (credentials, authCallback) => {

				console.log('Server authenticating client: ' + id);

				this.authorizeSocket(socket, credentials, authCallback);
			});


		});



	}

	authorizeSocket(socket, credentials, authCallback) {

		if (!authCallback) {
			authCallback = () => {}
		}

		var user = {
			user: credentials.username || "guest",
			socket: socket.id,
			ip: socket.request.headers['x-forwarded-for']
		};


		if (this.clientCanMonitorAdmin(credentials)) {
			socket.join('admin', () => {
				this.addAdminTaskListeners(socket);
			});



			console.log('admin join: ' + JSON.stringify(user));

			extend(user, {
				appId: "admin",
				project: "console"

			});
			this.addUser(socket, user);
			authCallback(true);
			return;

		}



		if (!this.isValidApp(credentials)) {
			authCallback(false);
			return;
		}

		var client = new PushClient(this, socket, credentials, (auth) => {


			if (!auth) {



			}



			console.log('New PushClient');

			authCallback(auth);


			if (!auth) {
				return;
			}



			socket.once('subscribe', () => {

				this.io.in('admin').emit('admin/connect', client.user);

				socket.on('disconnect', () => {
					this.io.in('admin').emit('admin/disconnect', client.user);
					var filteredRooms = this.getUserRooms(socket).filter((channelPath) => {
						return channelPath.indexOf('.presence') < 0 && channelPath.indexOf(client.prefix) === 0;
					});
					filteredRooms.forEach((channelPath) => {



						var channel = channelPath.replace(this.prefix, '');
						this.io.in(channelPath).clients((err, list) => {
							this.io.in(channelPath + ".presence").emit(channel + '.presence', {
								list: list,
								channel: channel,
								removed: client.user
							});
							this.io.in('admin').emit('admin/presence', extend({
								list: list,
								channel: channel,
								removed: client.user,
								usersChannels: filteredRooms
							}, client.appInfo));
						});


					});
				});
			});



		});



	}

	getPresence(prefix, channels, callback) {


		if (typeof channels == "string") {



			this._getPresence(prefix, [channels], (list) => {

				var presence = {
					'channel': channels,
					'presence': list.pop().presence,
				};

				callback(presence);

			});


			return;

		}



		this._getPresence(prefix, channels, (list) => {

			var presence = {
				'channels': channels,
				'presence': list,
			};

			callback(presence);

		});


	}

	_getPresence(prefix, channelList, fn) {

		var listPresence = [];
		var getChannelPresence = (channels, then) => {

			var temp = channels.slice(0);
			if (!temp.length) {
				then(listPresence);
				return;
			}

			this.io.in(prefix + channels[0]).clients((err, list) => {
				var users = list.map((u) => {
					return this.getUserInfo(u);
				});

				listPresence.push({
					'channel': channels[0],
					'presence': users
				});

				getChannelPresence(channels.slice(1), then);

			});
		};

		getChannelPresence(channelList.slice(0), fn);

	}


	emit(prefix, msg, user, emitCallback) {

		if (!emitCallback) {
			emitCallback = () => {};
		}



		this.io.in(prefix + msg.channel).clients((err, list) => {
			this.io.in('admin').emit('admin/emit', extend({
				'subscribers': list
			}, msg, user));
		});

		this.io.in(prefix + msg.channel).emit(msg.channel, msg.data);
		emitCallback(true);

	}

	webhookAuth(client, channel, appData, callback) {

		console.log(appData.channelAuth)



		const https = require('https')

		const data = JSON.stringify(client.credentials);

		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': data.length
			}
		}

		const req = https.request(appData.channelAuth, options, res => {
			console.log(`statusCode: ${res.statusCode}`)

			res.on('data', d => {
				console.log("Response: "+d);
				callback(true);
			});
		})

		req.on('error', error => {
			console.error(error)
		})

		req.write(data);
		req.end();





	}

	authorizeClientChannel(client, channel, callback) {

		var appData = this.getAppData(client.credentials.appId);
		if (!client.credentials.appId) {
			throw 'Expected appId';
		}

		console.log(appData);
		if (appData.channelAuth) {
			this.webhookAuth(client, channel, appData, callback);
			return;
		}

		console.log('Authorized client subscription: ' + channel);

		callback(true);

	}

	authorizeClientPresenceChannel(client, channel, callback) {

		callback(true);

	}

	addAdminTaskListeners(socket) {

		/**
		 * add admin functions, only channel members of `admin` can access
		 */


		socket.on('client-list', (args, callback) => {
			this.io.sockets.clients((err, list) => {

				if (err) {
					callback(err);
					return;
				}

				callback(list.map((socket) => {
					return extend({
						'channels': this.getUserRooms(socket)
					}, this.getUserInfo(socket))
				}));
			})
		});

		socket.on('app-list', (args, callback) => {
			this.io.sockets.clients((err, list) => {

				if (err) {
					callback(err);
					return;
				}

				callback(list.map((socket) => {
					var info = this.getUserInfo(socket);
					return info.socket + ": " + info.appId + " " + info.project;
				}).filter((value, index, array) => {
					return array.indexOf(value) === index;
				}));
			})
		});
	};



	updateUsersRooms(socket) {


		var id = socket.id;
		if (!this._rooms) {
			this._rooms = {};


			//BUG only first socket ever does this

			socket.on('disconnect', () => {
				setTimeout(() => {
					delete this._rooms[id];
				}, 500);
			});
		}

		this._rooms[id] = Object.keys(socket.rooms);



	}


	addUser(socket, user) {


		if (!this._users) {
			this._users = {};
		}

		if (this._users[socket.id]) {
			return;
		}

		this._users[socket.id] = user;

		socket.on('disconnect', () => {
			delete this._users[socket.id];
		});

	}



	getUserRooms(socket) {

		var id = socket.id || socket;

		if (!this._rooms) {
			return [];
		}

		if (!this._rooms[id]) {
			return [];
		}
		return this._rooms[id];

	}


	getUserInfo(socket) {

		var id = socket.id || socket;

		if (!this._users) {
			return {
				id: id
			};
		}

		if (!this._users[id]) {
			return {
				id: id
			};
		}

		return this._users[id];
	}



	addAppDefinition(name, config) {
		this._apps[name] = config;
		return this;
	}


	isValidApp(credentials) {

		var fs = require('fs');

		if (!credentials.appId) {
			console.error('Expected credentials.appId');
			return false;
		}

		if (!(this._apps[credentials.appId] || fs.existsSync(__dirname + '/appdata/' + credentials.appId + '.json'))) {
			console.error('Expected app file at: ' + __dirname + '/appdata/' + credentials.appId + '.json');
			return false;
		}

		return true;
	};

	getAppInfo(credentials) {

		var fs = require('fs');
		var appDataFile = __dirname + '/appdata/' + credentials.appId + '.json';


		var appData = this.getAppData(credentials.appId);


		if (!appData) {
			return {

				"namespace": credentials.namespace || 'default',
				"appId": credentials.appId || 'default',
				"project": "invalid"

			};
		}



		return {

			"namespace": credentials.namespace || 'default',
			"appId": credentials.appId || 'default',
			"project": appData.project || (credentials.appId + ".json")

		};
	}

	getAppData(appId) {


		if (!appId) {
			return false;
		}

		if (this._apps[appId]) {
			return this._apps[appId];
		}


		var fs = require('fs');
		var appDataFile = __dirname + '/appdata/' + appId + '.json';
		if (!(appId && fs.existsSync(appDataFile))) {
			return false;
		}

		return JSON.parse(fs.readFileSync(appDataFile));



	}

	messageCredentials(msg) {
		if (msg.credentials) {
			console.log('using message credentials: ' + JSON.stringify(msg.credentials));
			return msg.credentials;
		}
		return false;
	}

	clientCanEmit(credentials) {

		var appData = this.getAppData(credentials.appId);

		if (credentials.username === appData.username && credentials.password === appData.password) {
			return true;
		}

		if (credentials.apiKey == appData.apiKey) {
			return true;
		}

		return false;

	};

	clientCanMonitorAdmin(credentials) {


		var adminData = this.getAppData('admin');

		if (credentials.username === adminData.username && credentials.password === adminData.password) {
			return true;
		}
		return false;

	};



}