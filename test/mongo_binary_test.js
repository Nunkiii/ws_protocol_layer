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
	console.log("image_list called with this message:"+msg)
	testc.find( {}, { _id : 1, "name" : 1} ).toArray(function(err, docs) {
	    if(err)
		reply({error : err});
	    else
		reply({ images : docs});
	});
    },

    delete_image : function(msg, reply){
	console.log("delete_image called with this message:"+msg)
	testc.remove( { _id : mongo.ObjectID(msg.data.id) } , true)
	    .then(function(){
		reply({ message : "Successfully deleted image !"});
	    }).catch(function(e){
		reply({ error  : "Error deleting image : " + e});
	    });
    },

    update_image : function(msg, reply){
	console.log("update_image called with this message:"+msg)
	console.log("Update " + JSON.stringify(msg.data));
	testc.update( { _id : mongo.ObjectID(msg.data.id) }, { $set : { name : msg.data.name, description : msg.data.description } } , true)
	    .then(function(){
		reply({ message : "Successfully updated image !"});
	    }).catch(function(e){
		reply({ error  : "Error image update : " + e});
	    });
    },
    
    get_image : function(msg, reply){
	console.log("get_image called with this message:"+msg)
	var client=this;
	var img_id=mongo.ObjectID(msg.data.image_id);
	console.log("Looking for image  " + img_id);
	testc.findOne({_id : img_id }, { _id : 1, name : 1, description : 1, bin : 1 }).then(function(doc){

	    console.log("Got image  " + doc);
	    if(doc){
		reply({ id: doc._id, description : doc.description}, [{ name : doc.name,  data : doc.bin.buffer}]);
		
		client.query("allo", { what : "you want?"}, function(mrep){
		    console.log("Thanks browser, you just replied " + JSON.stringify(mrep.data));
		});
	    }else{
		console.log("Document not found " + img_id);
		reply({ error : "Document not found " + img_id});
	    }

	}).catch(function(e){
	    console.error("Mongo findOne Error ! " +e );
	    reply({ error : e});
	});
    },
    
    send_image : function(msg, reply){
	console.log("send_image called with this message:"+msg)
	
	var data=msg.bin_data.objects[0].data;
	var name=msg.bin_data.objects[0].name;
	var description=msg.data.description;
	
	var client=this;

	console.log("Bin test received " + data.byteLength + " bytes ");

	
	// fs.writeFile('testout_0.png', data.binary[0], function(err){
	//     if (err) throw err;
	//     console.log('Sucessfully saved!');
	// });

	
	var testc = mongo.db.collection("bintest");
	
	testc.insertOne({ name : name, description : description, bin : new mongo.Binary(data,mongo.Binary.SUBTYPE_BYTE_ARRAY)}).then(function(doc){
	    console.log("Ok doc written!");
	    

	    testc.findOne({ name : name}).then(function(doc){
	    	console.log("Got document! NB= " + doc.bin.length() );

	    // 	fs.writeFile('testout.png', doc.bin.buffer, function(err){
	    // 	    if (err) throw err;
	    // 	    console.log('Sucessfully saved!');
	    // 	});
		

		//reply({}, [{ name : name, data : doc.bin.buffer}]);

		reply({ inserted_id : doc._id});

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
    http_server.listen(7777);

}).catch(function(e){console.log("Mongo startup error " + e);})

