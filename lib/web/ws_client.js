"use strict";

var ws_web={};

//var ws= typeof module!=='undefined' ? require('../common/ws').ws : ws_mod.ws;

var ws=ws_mod.ws;
var ws_worker=ws_mod.ws_worker;

(function(mod){
    /**
     * Base command pack.
     */

    var base_pack = {

	/**
	 * Handling of binary data push messages from clients.
	 */
	
	binary_transfer : function(msg){
	    
	    var cli=this;
	    var id=msg.data.bid;
	    var bt=cli.bin_transfers[id];
	    var cs=cli.srv.chunk_size;
	    
	    if(bt.object>=bt.data.length){
		console.log("Error bad object ! " + bt.object);
		return;
	    }

	    var data=new Uint8Array(bt.data[bt.object]);
	    var l=data.byteLength;
	    var dataskip=bt.chunk*cli.srv.chunk_size;
	    var send_size=(dataskip+cs>=l) ? l-dataskip : cs;
	    
	    if(send_size<=0){
		console.log("Error buffer done ! " + send_size);
		return;
	    }
	    
	    var chunkb=new ArrayBuffer(send_size+12);
	    var idview=new Uint32Array(chunkb,0,3);
	    var dataview=new Uint8Array(chunkb,12);
	    
	    //console.log("done sending chunk ! " + idview[0] + " object " +  idview[1] + " chunk  " + idview[2] );    

	    idview[0]=id;
	    idview[1]=bt.object;
	    idview[2]=bt.chunk;
	    
	    dataview.set(data.subarray(dataskip, dataskip+send_size));
	    
	    cli.obj.send(chunkb);
	    
	    if(bt.mon!==undefined)
		bt.mon("upload", bt.object, dataskip+send_size, l);
	    
	    bt.chunk++;

	    if(bt.chunk*cs>=l){
		bt.chunk=0;
		bt.object++;
	    }
	    //    console.log("Chunk done " + id + " Bytes : " + l + " next l : "+ bt.chunk*chunk_size + " object " + bt.object + " chunk " + bt.chunk + " skip " + dataskip + " data[250] " + data[250]+ " FB " + data[dataskip] + " FBC " + dataview[0]) ;
	    if(bt.object>=bt.data.length){
		delete cli.bin_transfers[id];
		console.log("Done transfer bin data !");
	    }
	}
    };
    
    class host{
	constructor(options){
	    if(options!==undefined)
		this.configure(options);
	}
	
	configure(options){
	    var cli=this;

	    for(var o in options)
		cli[o]=options[o];
	}

	set url_prefix(p){ this.url_prefix_name=p;}
	get url_prefix(){
	    return  document.location.protocol == "https:" ? "wss:":"ws:";
	}
	set host(h){ this.host_name=h;}
	get host(){
	    return this.host_name===undefined?document.location.host : this.host_name ;
	}
	set port(p){this.port_name=p; }
	get port(){
	    return  this.port_name===undefined?'': ':'+this.port_name;
	}
	set url(u){this.url_name=u;}
	get url(){
	    return this.url_name!==undefined ? this.url_name :  this.url_prefix + "//" + this.host + this.port;
	}

    };
    
    class client extends ws_worker{
	constructor(srv, options){
	    super(srv);
	    this.peer= new host(options);
	}

	connect(){
	    var cli=this;
	    
	    return new Promise(function(ok, fail){

		try{
		    cli.obj = new WebSocket(cli.peer.url);
		    cli.obj.binaryType="arraybuffer";
		}
		catch (e){
		    fail(cli.signal("error",e));
		}
		
		cli.obj.addEventListener("open", function (event) {
		    cli.signal("open","Websocket open:"+ event);
		});
		
		cli.obj.addEventListener("error", function (event) {
		    fail(cli.signal("error",event));
		});



		cli.obj.addEventListener("message", function(event) {
			
		    if(event.data instanceof ArrayBuffer){
			//console.log('Received Binary Message of ' + event.data.byteLength + ' bytes');
			cli.process_binary(event.data); 
		    }else{

			cli.process_text(event.data);
			
		    }
		});
		
		ok();
	    });

	}

	com(json_data, bin_data, monitor){
	    var cli=this;
	    
	    return new Promise(function(ok, fail){
		
		cli.send_com(json_data, bin_data, monitor).then(function(){
		    try{
			//console.log("Sending " + JSON.stringify(json_data));
			cli.obj.send( JSON.stringify(json_data) );
			ok();
		    }
		    catch(e){
			cli.signal("error", e);
			fail(e);
		    }
		    
		}).catch(fail);
		
	    });
	}
	
	process_binary(chunkb){
	    
	    var idview=new Uint32Array(chunkb,0,3);
	    var dataview=new Uint8Array(chunkb,12);
	    
	    var bid=idview[0];
	    var oid=idview[1];
	    var cid=idview[2];
	    var chunk_size=chunkb.byteLength-12;
	    
	    var msg=this.binary_transfers[bid];
	    var tr=msg.transfer;
	    var totalb=msg.bin_data.objects[oid].length, data;

	    if(tr.nbytes===0){
		data=new Uint8Array(totalb); 
		msg.bin_data.objects[oid].data=data;
	    }else
		data=msg.bin_data.objects[oid].data;
	    
	    data.set(dataview,tr.nbytes);
	    
	    if(tr.mon!==undefined){
		tr.mon("download",oid, tr.nbytes, totalb);
	    }
	    tr.nbytes+=chunk_size;
	    
	    //console.log("Process binary ID " + bid + " object " + oid + " chunk " + cid + " data size " + tr.nbytes + "/" + totalb );
	    
	    if(tr.nbytes<totalb || (oid+1)<msg.bin_data.objects.length)
		this.send("binary_transfer", {bid : bid});
	    else{
	    
		if(msg.reply!==undefined){
		    this.replies[msg.reply].cb(msg);
		    delete this.replies[msg.reply];
		}else{
		    this.process_message(msg);
		}
		delete this.binary_transfers[bid];
	    }
	}
	
    };

    
    /**
     * Websocket web client engine.
     */
    
    class server extends ws{

	/**
	 * Create a websocket web engine.
	 * @param {object} options - The options to pass to server.
	 */
	
	constructor(){
	    super();
	    this.install_mod(base_pack);
	}

	create_client(options){
	    var cli=new client(this, options);
	    this.clients[cli.id]=cli;
	    this.n_clients++;
	    return cli;
	}
	
    };

    this.client = client;
    this.server = server;
    this.host = host;
    
}).apply(ws_web);

