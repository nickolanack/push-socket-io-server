module.exports = class WebConsole {
  


    constructor(path, server) {


        this._path=path;
        this._sever=server;
        
      	var express=require('express');



      	server.get('/', function(req, res) {
            res.sendFile(path + '/index.html');
        });
        server.get('/client.js', function(req, res) {
            res.sendFile(path + '/client.js');
        });
        server.use('/public', express.static(path + '/public'));
        

    }

    showAdmin(config){

        var path=this._path;
        var sever=this._server;

        server.get(config.location||'/admin', function(req, res) {

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



              
                var out = template.render(config);
                res.send(out);

                    
               
            });

        });


  }




};