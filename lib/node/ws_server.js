"use strict";

var websocket_emod= require('websocket').server;

console.log("Include sub module WS");
var ws_mod=require('../common/ws');
console.log("Include sub module WS OK !");

var ws=ws_mod.ws;

console.log("var ws=...  OK !");

var ws_worker=ws_mod.ws_worker;

class client extends ws_worker{

    constructor(connection, request, srv){

	super(srv);
	
	var cli=this;

	this.request = request;
	this.wsc = connection;
	this.worker=this;
	
	var request_time = new Date();
	this.cnx_start=request_time;
	
	
	connection.client=this.id;

	console.log(request_time + ' : connection accepted for ' + this.request.remoteAddress + " (assigned ID = "+connection.client+")");
	
	
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
	
	//this.send("update_login_status", { logged_in : false});
	
    }

    
    com(json_data, bin_data, monitor){
	
	var cli=this;
	return new Promise(function(ok, fail){
	    cli.send_com(json_data, bin_data, monitor).then(function(){
		try{
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


var default_pack={
    binary_transfer : function(msg){
	var data=msg.data;
	this.binary_transfer(data.bid);
    }
};


class session {

    constructor(){
	this.clients={};
    }

}

class server extends ws {

    constructor(http_server){

	super();

	var srv=this;

	this.obj = new websocket_emod({
	    httpServer: http_server,
	    autoAcceptConnections: false,
	    maxReceivedFrameSize : 16*1024*1024,
	    maxReceivedMessageSize : 32*1024*1024
	});

	this.install_mod(default_pack);

	this.obj.on('close', function(request) {
	    console.log("Websocket server closed");
	});
	
	this.obj.on('request', function(request) {
	    
	    if (false
		//request.origin check///
	       ){
		request.reject();
		console.log((new Date()) + ' Connection from origin ' + this.request.remoteAddress + ' rejected.');
		return;
	    }
		
	    var connection = request.accept(null, request.origin);
	    var cli=new client(connection, request, srv);
	    srv.clients[cli.id]=cli;
	    srv.n_clients++;
	    srv.signal("client_event", { type : "join", origin : request.origin, client: cli });
	    
	    connection.on('close', function(reasonCode, description) {
		srv.n_clients--;
		delete srv.clients[this.client];
		srv.signal("client_event", { type : "leave",  code : reasonCode, desc : description, client : connection.client });
	    });
	});

	
    }

    broadcast(cmd, data, bin_data){
	for(var cid in this.clients){
	    let cli=this.clients[cid];
	    cli.send(cmd, data, bin_data);
	};
    }
};

module.exports.server=server;
module.exports.client=client;

console.log("module ws_server ready !!");
