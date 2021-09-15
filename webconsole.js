module.exports = class WebConsole {
  


  constructor(path, server) {
    
  	var express=require('express');



  	server.get('/', function(req, res) {
        res.sendFile(path + '/index.html');
    });
    server.get('/client.js', function(req, res) {
        res.sendFile(path + '/client.js');
    });
    server.use('/public', express.static(path + '/public'));
    
    server.get('/admin', function(req, res) {

        var Twig = require('twig');
        var twig = Twig.twig;

        var fs = require('fs');


        fs.readFile(path + '/admin.html', function(err, data) {

            if (err) {
                console.log('error:' + err);
                return;
            }


            var template = twig({
                data: data.toString()
            });


            fs.readFile(path + '/appdata/admin.json', function(err, data) {


                if (err) {
                    console.log('error:' + err);
                    return;
                }
                var out = template.render(JSON.parse(data.toString()));
                res.send(out);

                
            });

        });

    });


  }




};