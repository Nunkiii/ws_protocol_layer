#!/usr/bin/env node

"use strict";

var http = require('http');
var ws_mod=require("../../lib/node/ws_server.js");

var http_server=http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("Dummy HTTP response ...");
});

var PORT=8880;

var simple_test_handlers={

    simple_test_with_reply : function(msg, reply){
	console.log("Got test message from client : " + msg.data.text);
	reply({ text : "Hello client, you sent me this : ["+msg.data.text+"]"});
    }
    
};


var ws=new ws_mod.server(http_server);

ws.install_mod(simple_test_handlers);

ws.on("client_event", function(ev){
    console.log("[" + ev.type + "]:\t " + ev.client );
    switch(ev.type){
    case "join":
	//Saying welcome to new client
	ev.client.send("welcome", { text : "Welcome to our server, you are " + ev.client});

	break;
    case "leave":
	console.log("\tReason: "+ev.reason+", Description: " + ev.desc );
	break;
    default:

    }
});


http_server.listen(PORT,function(){
    console.log("Server listening on " + PORT);
});

