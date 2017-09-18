var ws_client={};

var ws= typeof module!=='undefined' ? require('../common/ws').ws : ws_mod.ws;

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

	    console.log("Bin transfer id " + id );
	    
	    if(bt.object>=bt.data.length){
		console.log("Error bad object ! " + bt.object);
		return;
	    }
	    var data=new Uint8Array(bt.data[bt.object]);
	    var l=data.byteLength;
	    
	    
	    var dataskip=bt.chunk*cli.chunk_size;
	    var send_size=(dataskip+cli.chunk_size>=l) ? l-dataskip : cli.chunk_size;
	    
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
	    if(bt.chunk*cli.chunk_size>=l){
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
    
    /**
     * Websocket web client engine.
     */
    
    this.client = class client extends ws{

	/**
	 * Create a websocket web engine.
	 * @param {object} options - The options to pass to server.
	 */
	
	constructor(options){
	    super();
	    
	    this.replies={};
	    this.bin_id=13;
	    this.binary_transfers={};
	    this.bin_transfers={};
	    
	    if(options!==undefined)
		this.configure(options);	    

	    this.install_mod(base_pack);
	    this.chunk_size=1024;
	    //console.log("ws constructor done");
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
	
	
	
	configure(options){
	    var cli=this;

	    for(var o in options)
		cli[o]=options[o];
	}
	
	create (){
	    var cli=this;
	    
	    return new Promise(function(ok, fail){

		try{
		    cli.obj = new WebSocket(cli.url);
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
			console.log('Received Binary Message of ' + event.data.byteLength + ' bytes');
			cli.process_binary(event.data); 
		    }else{
			try{
			    var msg = JSON.parse(event.data);
			}
			catch(e){
			    console.log("JSON parsing error: " + e);
			}
			
			//console.log("Incoming UTF message [" + msg.cmd + "] bin_data? " + msg.bin_data);
			if(msg.bin_data!==undefined){
			    var bid=msg.bin_data.bid;
			    var bt=cli.binary_transfers[bid];
			    if(bt===undefined){
				msg.transfer={ object : 0, chunk : 0, nbytes : 0};
				if(msg.reply!==undefined){
				    msg.transfer.mon=cli.replies[msg.reply].mon;
				}
				bt=cli.binary_transfers[bid]=msg;
				cli.send("binary_transfer",{ bid : bid });
			    }else{
				console.log("Bug binary object " + msg.bin_data.bid + " already processing!" );
			    }
			}else{
			    
			    if(msg.reply!==undefined){
				
				cli.replies[msg.reply].cb.call(this,msg);
				delete cli.replies[msg.reply];
			    }else{
				cli.process_message(msg);
			    }
			}
		    }
		});
					
		
		
		
		
		ok();
	    });
	    
	}

	process_message(msg){
	    var hndl=this.get_handler(msg.cmd, msg.pack);
	    if(hndl!==undefined){
		hndl.call(this, msg);
	    }
	    else
		console.error("Unhandled command " + msg.cmd);
	    
	}
	
	com(json_data, bin_data, monitor){
	    var cli=this;
	    
	    return new Promise(function(ok, fail){
		
		if(bin_data!==undefined){
		    var ok=false;
		    bin_data.forEach(function(bd){
			
			if(bd!==undefined && bd.data!==undefined) ok=true;
		    });
		    if(ok){
			var bid=this.bin_id; 
			this.bin_id++;
			json_data.bin_data = {
			    bid : bid,
			    objects : []
			};
			
			this.bin_transfers[bid]={
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
				cli.bin_transfers[bid].data.push(bd.data);
			    }
			});
		    }
		    
		}
		
		try{
		    cli.obj.send( JSON.stringify(json_data) );
		    ok();
		}
		catch(e){
		    cli.signal("error", e);
		    fail(e);
		}
	    });
	}
	
	send(command, data, p1, p2){
	    var cli=this;
	    return new Promise(function(ok, fail){
		var bin_data, monitor;
		
		if(p1!==undefined){
		    if(p1.constructor===Array){
			bin_data=p1;
			monitor=p2;
			
		    }else{
			monitor=p1;
		    }
		}
		//console.log("sending command " + command);
		
		var json_data= { cmd: command, data : data };

		cli.com(json_data, bin_data, monitor).catch(fail).then(ok);
		
	    });
	}
	
	
	
	query(command, data, p1, p2, p3){
	    var cli=this;
	    return new Promise(function(ok, fail){
		var bin_data, reply, monitor;
		
		if(p1.constructor===Array){
		    bin_data=p1;
		    reply=p2;
		    monitor=p3;
		    
		}else{
		    reply=p1;
		    monitor=p2;
		}
		
		var rid=Math.random().toString(36).substring(2);
		cli.replies[rid]={ cb : reply, mon : monitor};
		var json_data= { cmd: command, data : data, reply : rid };
		
		cli.com(json_data, bin_data, monitor).catch(fail).then(ok);
	    });
	}
	
	

  // var arrayBufferView = new Uint8Array( this.response );
  //   blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
  //   var urlCreator = window.URL || window.webkitURL;
  //   blob_url = urlCreator.createObjectURL( blob );
	
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
		return this.send("binary_transfer", {bid : bid});
	    
	    if(msg.reply!==undefined){
		this.replies[msg.reply].cb(msg);
		delete this.replies[msg.reply];
	    }else{
		process_message(msg);
	    }
	    
	    
	    delete this.binary_transfers[bid];
	    
	}
	
    };
}).apply(ws_client);

