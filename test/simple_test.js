#!/usr/bin/node

"use strict";

var http = require('http');
var ws_mod=require("../lib/node/ws_server.js");

var http_server=http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("Dummy HTTP response ...");
});

var ws=new ws_mod.server(http_server);

var simple_test_handlers={

    simple_test : function(msg){
	
	var data=msg.data; 
	this.send("server_test_message1",{ text : "Test data received [" + data.text+ "]"});
	
    },

    simple_test_with_reply : function(msg, reply){
	reply({}, [{ name : "test", data : data}]);
    }

};


ws.install_mod(simple_test_handlers);

http_server.listen(1234);

