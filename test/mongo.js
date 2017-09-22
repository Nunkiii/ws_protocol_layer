#!/usr/bin/node

"use strict";

var defaults = {
    host:"localhost",
    port:27017,
    dbname:"test"
};

class mongo_system{
    constructor(config){
	if(config===undefined) config=defaults;
	this.set_config(config);
	
	this.mongo_pack = require('mongodb');
	
	this.MongoClient = this.mongo_pack.MongoClient;
	this.ObjectID =this.mongo_pack.ObjectID;
	this.Binary =this.mongo_pack.Binary;
	
	this.options={ 
	    //	raw: true, native_parser : true
	};
    }

    set_config(config){
	var sys=this;
	for(var o in defaults){
	    sys[o]=config[o]===undefined? defaults[o] : config[o];
	};
	sys.url = 'mongodb://'+this.host+':'+this.port+'/'+this.dbname;
    }
    
    startup(){
	var sys=this;
	return new Promise(function(ok, fail){
	    
	    sys.MongoClient.connect(sys.url, sys.options).catch(fail).then(function(db){
		console.log("Connected to MongoDB server!");
		sys.db=db;
		ok(db);
	    });
	});
    }
}

module.exports.mongo=mongo_system;
