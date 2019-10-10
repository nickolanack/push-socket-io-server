# push-socket-io-server
socket io server customized to provide push message functionality




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
            "username": "some-guest", //not really neccessary for read only 
        }

```