#!/usr/bin/env node

"use strict";

var ws_mod=require("../../lib/node/ws_server.js");

//The command handler functions for this test.

var test_handlers={
    //We will listen to a single 'welcome' message from the server.
    welcome : function(msg){
	console.log("Received server welcome message : " + msg.data.text);
    }
    
};

//Creation of an outbound server. It is holding all the clients sharing the same set of handlers.
var out_ws=new ws_mod.outbound_server();

//Installing our command handlers in the server
out_ws.install_mod(test_handlers);

//Monitoring the entering/leaving of clients.
out_ws.on("client_event", function(ev){
    console.log("[" + ev.type + "] :\t " + ev.client);
    switch(ev.type){
    case "join":
	//A websocket connexion has been established on client 'ev.client'
	ev.client.query("simple_test_with_reply", { text : "Hello Server !"}, function(answer){
	    console.log("Got reply from server : " + answer.data.text);
	});

	break;
    case "leave":
	console.log("\t\tReason: "+ev.reason+", Description: " + ev.desc );
	break;
    }
});

try{
    //Creating a new websocket client. 
    var client = out_ws.create_client({ host: "localhost", port : 8880} );

    //Connecting client to peer.
    client.connect();
}
catch(error){
    console.error("Error creating client : " + error);
    return;
}




