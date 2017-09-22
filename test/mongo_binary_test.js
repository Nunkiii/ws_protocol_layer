#!/usr/bin/env node

"use strict";

var http = require('http');
var ws_mod=require("../lib/node/ws_server.js");
var mongo_mod=require("./mongo.js");

var http_server=http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("Dummy HTTP response ...");
});

var ws=new ws_mod.server(http_server);

var mongo=new mongo_mod.mongo({ dbname : "bintest"});

//Our test collection
var testc;

var mod_pack={

    image_list : function(msg, reply){
	testc.find( {}, { _id : 1, "name" : 1} ).toArray(function(err, docs) {
	    if(err)
		reply({error : err});
	    else
		reply({ images : docs});
	});
    },

    get_image : function(msg, reply){
	testc.findOne({_id : mongo.ObjectID(msg.data.image_id) }, { _id : 1, name : 1, bin : 1 }).then(function(doc){
	    reply({ id: doc._id}, [{ name : doc.name, data : doc.bin.buffer}]);
	    
	}).catch(function(e){
	    console.error("Mongo findOne Error ! " +e );
	    reply({ error : e});
	});
    },
    
    send_image : function(msg, reply){

	var data=msg.bin_data.objects[0].data;
	var name=msg.bin_data.objects[0].name;
	
	var client=this;

	console.log("Bin test received " + data.byteLength + " bytes ");

	
	// fs.writeFile('testout_0.png', data.binary[0], function(err){
	//     if (err) throw err;
	//     console.log('Sucessfully saved!');
	// });

	
	var testc = mongo.db.collection("bintest");
	
	testc.insertOne({ name : name, bin : new mongo.Binary(data,mongo.Binary.SUBTYPE_BYTE_ARRAY)}).then(function(doc){
	    console.log("Ok doc written!");
	    

	    testc.findOne({ name : name}).then(function(doc){
	    	console.log("Got document! NB= " + doc.bin.length() );

	    // 	fs.writeFile('testout.png', doc.bin.buffer, function(err){
	    // 	    if (err) throw err;
	    // 	    console.log('Sucessfully saved!');
	    // 	});
		
		//client.send("bintest_reply", {}, [doc.bin.buffer]);
		reply({}, [{ name : name, data : doc.bin.buffer}]);
		//reply({}, [{ name : "test", data : data}]);
	    }).catch(function(e){
		console.error("Mongo find Error ! " +e );
		reply({ error : e});
	    });
	}).catch(function(e){
	    console.error("Mongo insert Error ! " +e );
	    reply({ error : e});
	});
    }

}


mongo.startup().then(function(){
    testc = mongo.db.collection("bintest");
    ws.install_mod(mod_pack);
    http_server.listen(1234);

}).catch(function(e){console.log("Mongo startup error " + e);})

