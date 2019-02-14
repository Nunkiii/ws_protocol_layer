"use strict";

var ws_web={};

//var ws= typeof module!=='undefined' ? require('../common/ws').ws : ws_mod.ws;

var ws=ws_mod.ws;
var host=ws_mod.host;
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
    
    class client extends ws_worker{
	constructor(srv, options){
	    super(srv, options);
	    this.peer= new host(options);
	    this.error=undefined;
	}

	disconnect(){
	    console.log("WS disconnecting from " + this.peer.url);
	    var cli=this;
	    if(cli.obj!==undefined){
		cli.obj.close();
		delete cli.obj;
		cli.obj=undefined;
	    }
	    
	}

	get status(){
	    if(this.obj===undefined)
		return "closed";
	    var v=["connecting","opened","closing","closed"];
	    return v[this.obj.readyState];
	}
	
	get connected() { return this.status=="opened";}
	
	connect(){
	    var cli=this;
	    
	    return new Promise(function(ok, fail){

		function signal(message){
		    return cli.signal("event", { status : cli.status, msg : message});
		}
		

		try{
		    cli.error=undefined;
		    console.log("websocket: connect to " + cli.peer.url);
		    cli.obj = new WebSocket(cli.peer.url);
		    signal("Connecting...");
		    cli.obj.binaryType="arraybuffer";
		}
		catch (e){
		    cli.error="error";
		    fail(signal("WSC constructor error : " +e));
		}

		cli.obj.addEventListener("open", function (event) {
		    signal("Running");
		    ok();
		});

		cli.obj.addEventListener("close", function (event) {
		    signal("Closed:"+ JSON.stringify(event));
		});
		
		cli.obj.addEventListener("error", function (event) {
		    cli.error="Cannot connect to websocket server " + cli.peer.url;
		    fail(signal("Error: " + JSON.stringify(event) + " Ready state = " + cli.ready_state));
		});



		cli.obj.addEventListener("message", function(event) {
			
		    if(event.data instanceof ArrayBuffer){
			//console.log('Received Binary Message of ' + event.data.byteLength + ' bytes');
			cli.process_binary(event.data); 
		    }else{

			cli.process_text(event.data);
			
		    }
		});
		
		
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
			cli.signal("WSC send com error: ", e);
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
		//data=new Uint8Array(totalb);
		data=new ArrayBuffer(totalb); 
		msg.bin_data.objects[oid].data=data;
	    }else
		data=msg.bin_data.objects[oid].data;

	    var uint8_data=new Uint8Array(data);

	    uint8_data.set(dataview,tr.nbytes);
	    
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

