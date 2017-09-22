#!/usr/bin/env node

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
	this.send("server_test_message1",{ text : "Test data received [" + msg.data.text+ "]"});
    },

    simple_test_with_reply : function(msg, reply){
	reply({ text : "Hello from server! Data received : ["+msg.data.text+"]"});
    }
    
};


ws.on("client_event", function(ev_data){
    console.log("Clii event " + JSON.stringify(ev_data));
    for(var wi in ws.clients){
	var c=ws.clients[wi];
	if(c.send!==undefined)
	    c.send("server_test_message2", ev_data);
    }
});


ws.install_mod(simple_test_handlers);

http_server.listen(1234);

