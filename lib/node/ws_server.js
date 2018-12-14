"use strict";

const fs = require('fs');

var websocket_emod= require('websocket').server;
var websocket_client_emod= require('websocket').client;

var ws_mod=require('../common/ws');
var ws=ws_mod.ws;

var ws_worker=ws_mod.ws_worker;
var host=ws_mod.host;

class node_handlers extends ws_mod.handlers{
    constructor(){
	super();
    }

    load_mod_file(f) {
	var m=this;
	fs.readFile(f, 'utf8', function (err,data) {
	    if (err) {
		console.log(err);
	    }else{
		var func = new Function(data);
		var wname=f.split('.')[0].split('/')[1];
		//console.log(f.split('.')[0].split('/')[1]);
		
		///var X=func();
		m.install_mod(func(), wname);
		//console.log("X="+JSON.stringify(X));
	    }
	});
    }
    
};


class client extends ws_worker{
    constructor(srv){

	super(srv);
	this.worker=this;
	this.cnx_start=new Date();


    }

    get_info(){
	var info= {
	    id : this.id,
	    cnx_start : this.cnx_start,
	    address : this.wsc.remoteAddress
	};
	if(this.ident!==undefined) info.ident=this.ident;
	if(this.session!==undefined) info.session=this.session.id;
	return info;
    }

    handle_connection(connection){

	var cli=this;
	this.wsc = connection;
	connection.client=this.id;

	cli.srv.signal("client_event", { type : "join",  client: cli });
	
	connection.on('message', function(message) {
	    
	    if (message.type === 'utf8') {
		//console.log("Received UTF data of size " + message.utf8Data.length);
		//console.log("message ["+message.utf8Data+"]");
		cli.process_text(message.utf8Data);
		
		
		
	    }
	    else if (message.type === 'binary') {
		var b=message.binaryData;
		//console.log('Received Binary Message of ' + b.byteLength + ' bytes');
		cli.process_binary(b); 
		//connection.sendBytes(message.binaryData);
	    }


	});
	

	connection.on('error', function(error) {
	    console.log("Connection Error: " + error.toString());
	});
	connection.on('close', function(reason, desc) {
	    cli.srv.signal("client_event", { type : "leave", client : cli,  reason : reason, desc : desc });
	});
	
    }
    
    
    com(json_data, bin_data, monitor){
	
	var cli=this;
	return new Promise(function(ok, fail){
	    cli.send_com(json_data, bin_data, monitor).then(function(){
		try{
		    //console.log("COM sending " + JSON.stringify(json_data));
		    cli.wsc.sendUTF(JSON.stringify(json_data));
		    ok();
		}
		catch(e){
		    console.error("Eror sending UTF8 data to websocket: " + e);
		    fail(e);
		}
		
	    });
	});
    }
    
    close(){
	if(this.session!==undefined && this.session.web_clients[this.id]!==undefined){
	    delete this.session.web_clients[this.id];
	    this.session.n_clients--;
	    if(this.session.n_clients===0){
		var sid=this.session.id;
		//delete user_sessions[sid];
	    }
	}
	console.log( 'Web client ' + this.wsc.remoteAddress + " ID : " + this.id + ' disconnected');
    }
    
    process_binary(bdata){
	
	var bid=bdata.readInt32LE(0);
	var oid=bdata.readInt32LE(4);
	var cid=bdata.readInt32LE(8);
	var chunk_size=bdata.byteLength-12;
	
	var msg=this.binary_transfers[bid];
	var tr=msg.transfer;
	var totalb=msg.bin_data.objects[oid].length, data;
	if(tr.nbytes===0){
	    data=Buffer.allocUnsafe(totalb); 
	    msg.bin_data.objects[oid].data=data;
	    //data.fill(2);
	}else
	    data=msg.bin_data.objects[oid].data;
	
	var ncopy=bdata.copy(data, tr.nbytes, 12);
	//console.log("Process binary ID " + bid + " object " + oid + " chunk " + cid + " data size " + tr.nbytes + "/" + totalb + " NCOPYb =" + ncopy + " firstbyte " + bdata[12] + " fcp = " + data[tr.nbytes]);
	
	tr.nbytes+=chunk_size;
	
	if(tr.nbytes<totalb || (oid+1)<msg.bin_data.objects.length)
	    this.send("binary_transfer", {bid : bid});
	else{
	    if(msg.reply!==undefined && msg.cmd===undefined){
		this.replies[msg.reply].cb(msg);
		delete this.replies[msg.reply];
	    }else{
		this.process_message(msg);
	    }
	    delete this.binary_transfers[bid];
	}
    }
    
    binary_transfer(id){
	var chunk_size=this.srv.chunk_size;
	var bt=this.bin_transfers[id];
	
	if(bt.object >= bt.data.length){
	    console.log("Error bad object ! " + bt.object);
	    return;
	}
	
	var data=bt.data[bt.object];
	var l=data.byteLength;
	
	var dataskip=bt.chunk*chunk_size;
	var send_size=(dataskip+chunk_size>=l) ? l-dataskip : chunk_size;
	
	if(send_size<=0){
	    console.log("Error buffer done ! " + send_size);
	    return;
	}
	
	var chunkb=Buffer.alloc(send_size+12);
	
	//console.log("done sending chunk ! " + idview[0] + " object " +  idview[1] + " chunk  " + idview[2] );    
	
	chunkb.writeInt32LE(id,0);
	chunkb.writeInt32LE(bt.object,4);
	chunkb.writeInt32LE(bt.chunk,8);
	
	data.copy(chunkb, 12, dataskip, dataskip + send_size);
	
	//dataview.set(data.slice(dataskip, send_size));
	
	this.wsc.sendBytes(chunkb);
	
	bt.chunk++;
	if(bt.chunk*chunk_size>=l){
	    bt.chunk=0;
	    bt.object++;
	}
	//console.log("Chunk done " + id + " Bytes : " + l + " next l : "+ bt.chunk*chunk_size + " object " + bt.object + " chunk " + bt.chunk);
	
	if(bt.object>=bt.data.length){
	    delete this.bin_transfers[id];
	    //console.log("Done transfer bin data !");
	}
    }
}


//An outgoing client link

class outbound_client extends client{

    constructor( host_options, options, srv){

	super(srv);
	var cli=this;

	this.peer= new host(host_options);                                                                                                                              
        this.status="close";
	
	this.wscli = new websocket_client_emod(options);
	
	this.wscli.on('connectFailed', function(error) {
	    cli.status="error";
	    //console.log(
	    cli.signal_event('Connection to '+cli.peer.url+' failed : ' + error.toString())
	    //);
	    
	    //fail(
	    //signal("Error: " + event)
	    //);
	    
	});
	
	this.wscli.on('connect', function(connection) {
	    cli.status="open";
	    //console.log('WebSocket Client Connected');
	    cli.signal_event("Running");
	    cli.handle_connection(connection);
	});

	//console.log("Outbound constructed " + this.peer.url);
    } 
    
    signal_event(message){
	return this.srv.signal("client_event", { client : this, type : this.status, msg : message});
    }

    connect(){
	var cli=this;
	
	try{
	    //console.log("outbound_client ["+cli.id+"]: connecting to " + cli.peer.url);
	    
	    cli.wscli.connect(cli.peer.url);
	    cli.status="connecting";
	    cli.signal_event("Connecting...");
	}
	catch (e){
	    cli.status="error";
	    //fail(
	    cli.signal_event("WSC connect error : " +e)
	    console.log("Error : " + e);

	    //);
	}
	
    }

    toString(){
	return "OutClient["+this.id+"]:" + this.peer.url;
    }
}

//An incoming client link

class inbound_client extends client{

    constructor(connection, request, srv){
	super(srv);
	
	this.request = request;
	this.handle_connection(connection);
    }

    toString(){
	return "InClient["+this.id+"]:" + this.request.remoteAddress;
    }
}

//Default available commands (only one actually to handle binary packets)

var default_pack={
    binary_transfer : function(msg){
	this.binary_transfer(msg.data.bid);
    }
};


class session {

    constructor(){
	this.clients={};
    }
    
}

//Outbound clients are grouped into an outbound_server sharing command packs.

class outbound_server extends ws {
    constructor(http_server, options){
	
	super(options);
	var srv=this;
    }
    
    create_client(url_opts){
	
	var cli=this.add_client(new outbound_client( url_opts , {}, this));
	
	// connection.on('close', function(reason, description) {
	//     console.log("Connection close event: " + reason + " : " + description );
	//     srv.remove_client(this.client);
	// });
	//cli.connect();
	return cli;
    }
}



class server extends ws {

    constructor(http_server, options){
	if(options===undefined) options={};
	options.mods=new node_handlers();
	super(options);

	var srv=this;

	this.obj = new websocket_emod({
	    httpServer: http_server,
	    autoAcceptConnections: false,
	    maxReceivedFrameSize : 16*1024*1024,
	    maxReceivedMessageSize : 32*1024*1024
	});

	this.install_mod(default_pack);

	this.obj.on('accept', function(connection) {
	    //console.log("Accept event");
	});
	
	this.obj.on('close', function(connection, reason, description){
	    console.log("websocket close event: " + reason + " : " + description );
	});
	
	this.obj.on('request', function(request) {
	    // console.log((new Date()) + 'Connection from origin ' + request.remoteAddress + ' ...');
	    if (false
		//request.origin check///
	       ){
		request.reject();
		//console.log((new Date()) + ' Connection from origin ' + request.remoteAddress + ' rejected.');
		return;
	    }


	    var connection = request.accept(null, request.origin);

	    var cli=srv.add_client(new inbound_client(connection, request, srv));
	    //console.log(cli.cnx_start + ' : inbound connection accepted for ' + this.request.remoteAddress + " (assigned ID = "+connection.client+")");
	    
	    //srv.signal("client_event", { type : "join",  client: cli });
	    
	    connection.on('close', function(reason, description) {
		//console.log("Connection close event: " + reason + " : " + description );
		//srv.signal("client_event", { type : "leave",  client: this.client });
		srv.remove_client(this.client);
	    });

	});

	
    }

};

module.exports.server=server;
module.exports.outbound_server=outbound_server;
//module.exports.client= function(options){};


