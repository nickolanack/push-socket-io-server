




var exec = require('child_process').exec;
var trim = require('trim');
var fs = require('fs');




var cmds=null;
var running=null;

var filename='.keepalive.json';
var matches=['socket-io.js'];



process.chdir(__dirname);

var printUsage=function(){
	console.log(fs.readFileSync('./CRONJS.md').toString());
}

exec('echo $PATH', function(err, stdout, stderr){
	console.log(stdout);
});

var clog=function(m){
	if(!cmds){
		console.log(m);
	}
};

if(fs.existsSync('./'+filename)){
	cmds=require('./'+filename);
}else{
	printUsage();
}



var psCmd='ps -Af | grep node | grep \''+matches.join('\\|')+'\'';
clog(psCmd);

exec(psCmd, function(err, stdout, stderr){

	clog(stdout);
	var lines=trim(stdout).split("\n").filter(function(l){return l.indexOf("grep")===-1});
	if(lines.length){
		console.log('Running ('+lines.length+')');


		var nodecmds=[];
		lines.forEach(function(line){
			running='node'+line.split('node').pop();
			console.log(running);
			nodecmds.push(running);

		});

		if(!(cmds&&cmds.length)){

			clog('Wrote to keepalive file');
			fs.writeFile('./'+filename, JSON.stringify(nodecmds));

		}else{
			clog('Already have command list. if you want to make changes you can execute: rm ./'+filename);
		}

	}else{
		clog('Failed to find any processes like:  \'node ~['+matches.join('|')+'~]\'');
	}







	if(cmds){

		cmds.forEach(function(cmd){

			var isRunning=false;
			lines.forEach(function(line){

				if(line.indexOf(cmd)>=0){
					isRunning=true;
				}

			});

			if(!isRunning){

				console.log('Restarting: '+cmd);

				exec(cmd+' >.log 2>&1 &', function(err, stdout, stderr){
					console.log('ok');

				});
			}


		});


	}



});

