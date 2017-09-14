#!/usr/bin/node

"use strict";

var http = require('http');
var ws_mod=require("../../lib/node/ws_server.js");

var http_server=http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("Dummy HTTP response ...");
});

var ws=new ws_mod.server(http_server);

var mod_pack={

    bintest : function(msg, reply){

	var data=msg.bin_data.objects[0].data;
	var client=this;
	
	console.log("Binary data received " + data.byteLength + " bytes ");
	
	
	reply({}, [{ name : "test", data : data}]);
	
    }

}


ws.install_mod(mod_pack);

http_server.listen(1234);

