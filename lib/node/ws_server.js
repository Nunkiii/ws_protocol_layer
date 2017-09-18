"use strict";

var websocket_emod= require('websocket').server;
var ws=require('../common/ws').ws;

class client{

    constructor(connection, request, srv){

	var client=this;
	this.request = request;
	this.ws = connection;
	this.srv=srv;
	
	var request_time = new Date();
	this.cnx_start=request_time;
	this.id=Math.random().toString(36).substring(2);
	this.binary_transfers={};
	this.bin_transfers={};
	this.bin_id=13;
    
	connection.client=this.id;

	
	console.log(request_time + ' : connection accepted for ' + this.request.remoteAddress + " (assigned ID = "+connection.client+")");
	
	
	connection.on('message', function(message) {
	    
	    if (message.type === 'utf8') {
		//console.log("Received UTF data of size " + message.utf8Data.length);
		
		//console.log("message ["+message.utf8Data+"]");
		var msg=JSON.parse(message.utf8Data);
		
		if(msg.bin_data!==undefined){
		    var bid=msg.bin_data.bid;
		    var bt=client.binary_transfers[bid];
		    if(bt===undefined){
			msg.transfer={ object : 0, chunk : 0, nbytes : 0};
			bt=client.binary_transfers[bid]=msg;
			client.send("binary_transfer",{ bid : bid });
		    }else{
			console.log("Bug binary object " + msg.bin_data.bid + " already processing!" );
		    }
		    
		}else{
		    client.process_message(msg);
		}
		
	    }
	    else if (message.type === 'binary') {
		var b=message.binaryData;
		
		//console.log('Received Binary Message of ' + b.byteLength + ' bytes');
		client.process_binary(b); 
		//connection.sendBytes(message.binaryData);
	    }
	});
	
	//this.send("update_login_status", { logged_in : false});
	
    }

    
    transmit(json_data, bin_data, monitor){
	
	var client=this;
	
	if(bin_data!==undefined){
	    var ok=false;
	    bin_data.forEach(function(bd){
		if(bd.data!==undefined) ok=true;
	    });
	    if(ok){
		var bid=this.bin_id; 
		this.bin_id++;
		json_data.bin_data = {
		    bid : bid,
		    objects : []
		};
		
		client.bin_transfers[bid]={
		    data : [],
		    object : 0,
		    chunk : 0,
		    mon : monitor
		};
		
		bin_data.forEach(function(bd){
		    if(bd.data!==undefined){
			var odata={length : bd.data.byteLength};
			for(var v in bd){
			    if(v!=='data')
				odata[v]=bd[v];
			}
			
			json_data.bin_data.objects.push(odata);
			client.bin_transfers[bid].data.push(bd.data);
		    }
		});
	    }
	    
	    
	}
	
	
	try{
	    this.ws.sendUTF(JSON.stringify(json_data));
	}
	catch(e){
	    console.error("Eror sending UTF8 data to websocket: " + e);
	}
    }
    
    send(command, data, bin_data){
	
	var json_data= { cmd: command, data : data };
	this.transmit(json_data, bin_data);
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
	console.log( 'Web client ' + this.ws.remoteAddress + " ID : " + this.id + ' disconnected');
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
	    return this.send("binary_transfer", {bid : bid});
	
	this.process_message(msg);
	delete this.binary_transfers[bid];
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
	
	this.ws.sendBytes(chunkb);
	
	bt.chunk++;
	if(bt.chunk*chunk_size>=l){
	    bt.chunk=0;
	    bt.object++;
	}
	//console.log("Chunk done " + id + " Bytes : " + l + " next l : "+ bt.chunk*chunk_size + " object " + bt.object + " chunk " + bt.chunk);
	
	if(bt.object>=bt.data.length){
	    delete this.bin_transfers[id];
	    console.log("Done transfer bin data !");
	}
    }
    
    
    process_message(msg){

	var cli=this;
	var cmd_name=msg.cmd, mod_pack_name=msg.pack;
	var hndl=cli.srv.get_handler( cmd_name, mod_pack_name);
	
	if(hndl!==undefined){
	    if(msg.reply!==undefined){
		hndl.call(this, msg, function (data, bin_data){
		    cli.transmit({ cmd: "", data : data, reply : msg.reply }, bin_data);
		});
	    }else
		hndl.call(cli, msg);
	}
	else
	    console.error("Undefined incoming command ["+msg.cmd+"]");
	    
	
//	this.srv.answer_message(this,msg.cmd, msg.pack); 
    }
}


var default_pack={
    binary_transfer : function(msg){
	var data=msg.data;
	this.binary_transfer(data.bid);
    }
};

class server extends ws {

    constructor(http_server){

	super();

	var srv=this;

	this.clients={};
	this.n_clients=0;
	this.chunk_size=1024;
	
	
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
	    srv.signal("client_event", { type : "join", origin : request.origin });
	    
	    connection.on('close', function(reasonCode, description) {
		srv.signal("client_event", { type : "leave",  code : reasonCode, desc : description });
		srv.clients[this.client].close();
		srv.n_clients--;
		delete srv.clients[this.client];
	    });
	});

	
    }
    
};



module.exports.server=server;
module.exports.client=client;


    
