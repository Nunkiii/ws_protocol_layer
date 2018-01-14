#!/usr/bin/env node

"use strict";

var ws_mod=require("../../lib/node/ws_server.js");

var test_handlers={

    welcome : function(msg){
	console.log("Received server welcome message : " + msg.data.text);
    }
    
};

var out_ws=new ws_mod.outbound_server();

out_ws.install_mod(test_handlers);

out_ws.on("client_event", function(ev){
    switch(ev.type){
    case "join": console.log("Client [" + ev.type + "] : " + ev.client);

	//Saying welcome to new client
	ev.client.send("welcome", { text : "Welcome to our server, you are " + ev.client});

	break;
    case "leave": console.log("Client [" + ev.type + "] : " + ev.client + " ("+ev.reason+", " + ev.desc + ")"); break;
    }
});

try{
    var client = out_ws.create_client({ host: "localhost", port : 8880, protocol : "ws"} );
}
catch(error){
    console.error("Error creating client : " + error);
    return;
}


client.on("event", function (data) {
    console.log("Client status changed : " + data.status + " : " + data.msg);
    if(data.status == "open"){
	client.query("simple_test_with_reply", { text : "Hello Server !"}, function(answer){
	    console.log("Got reply from server : " + answer.data.text);
	});
	
    }
});


