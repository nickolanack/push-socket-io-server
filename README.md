# push-socket-io-server
socket io server customized to provide push message functionality

Tecnically this is meant to replace my use of Pusher.com message server and provides similar functionality using socketio 
This provides: event channels, subscriptions, presence channels, as well as supoorts seperate applications and namespaced applications (same app/authentication but seperate event channels) 




#Install

```bash

	get clone https://github.com/nickolanack/push-socket-io-server.git
	cd push-socket-io-server
	npm Install

	echo echo '{"username" : "{someusername}", "password" : "{somepassword}"}' > appdata/{app-id}.json

	node socker-io.js


```

#Cron

There is a cron.js file that you can run as a cronjob to ensure that the socket-io is running

```bash
* * * * * node /path/to/socket-io/cron.js > /path/to/socket-io/.cronlog 2>&1
```

#Client usage 


```html
	<script type="text/javascript" src="https://your-socket-io-server/client.js"></script>
```


```js

	 (function() {

        var credentials={
            "appId": "{app-id}",
            "username": "some-guest", //not really neccessary for public read only event streams but useful for server logging
        }


        var client=(new SocketIOClient("https://your-socket-io-server"))
	    	.connect(credentials);
	    	
		   	var unsubscribeFn=client.subscribe("{channel}", "{event}", function(data){

	    		// similar to socket.io.on(event, callback), however a channel/event subscription request is sent to server before the 
	    		// client receive this event data - essentiall a request to join a socketio 'room'
	    		
	    	})
	    	
	    	var unsubscribeFn=client.presence("{channel}", "{event}", function(data){

	    		// every channel/event also has a presence channel
	    		// data contains a channel user list and is sent when a user joins or leaves
	    		// the client also recieve the user list once after subscribing to the presence channel
	    		 
	    		
	    		
	    	})


```
