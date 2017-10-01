"use strict";

var ws_mod={};

(function(mod){

    var event;

    if(typeof module!=='undefined'){
	event = require('./event').event;
    }else{
	event=ws_event.event;
    }
    
    this.ws = class websocket extends event{

	constructor(options){
	    super();
	    this.mods={};
	    this.clients={};
	    this.n_clients=0;
	    this.chunk_size=8192;
	}
	
	install_mod(mod_pack, name ){
	    var pack_name=name===undefined? 0:name;
	    var mp=this.mods[pack_name];

	    if(mp===undefined) mp=this.mods[pack_name]={};
	    
	    for(var m in mod_pack) mp[m]=mod_pack[m];
	    
	    return mod_pack;
	}

	get_handler(cmd_name, mod_pack_name){
	    var pack=this.mods[mod_pack_name===undefined?0:mod_pack_name];
	    return pack===undefined? undefined : pack[cmd_name];
	}
    };

    this.ws_worker = class ws_worker extends event{

	constructor(srv){
	    super();
	    
	    //if(ws===undefined) this.ws=this; else this.ws=ws;
	    this.srv=srv;
	    this.bin_id=13;
	    this.binary_transfers={};
	    this.bin_transfers={};
	    this.replies={};
	    this.id=Math.random().toString(36).substring(2);
	}

	process_text(data){
	    var cli=this;
	    
	    try{
		var msg = JSON.parse(data);
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
			if(cli.replies[msg.reply]!==undefined)
			    msg.transfer.mon= cli.replies[msg.reply].mon;
		    }
		    
		    bt=cli.binary_transfers[bid]=msg;
		    cli.send("binary_transfer",{ bid : bid });
		    
		}else{
		    console.log("Bug binary object " + msg.bin_data.bid + " already processing!" );
		}
	    }else{
		
		cli.process_message(msg);
		
		
	    }
	    
	}
	
	process_message(msg){
	    
	    var cli=this;
	    var cmd_name=msg.cmd, mod_pack_name=msg.pack;
	    var hndl=cli.srv.get_handler( cmd_name, mod_pack_name);
	    
	    if(hndl!==undefined){
		if(msg.reply!==undefined){
		    //console.log("Answering a msg ["+cmd_name+"] with reply id " + msg.reply);
		    hndl.call(this, msg, function (data, bin_data){
			cli.com({ cmd: "", data : data, reply : msg.reply }, bin_data);
		    });
		}else
		    hndl.call(cli, msg);
	    }
	    else{
		if(msg.reply!==undefined){
		    //console.log("Receiving reply id " + msg.reply);
		    cli.replies[msg.reply].cb.call(this,msg);
		    delete cli.replies[msg.reply];
		}else
		    console.error("Undefined incoming command ["+JSON.stringify(msg)+"]");
	    }
	    
	    //console.error("Undefined incoming command ["+msg.cmd+"]");
	    
	    
	    //	this.srv.answer_message(this,msg.cmd, msg.pack); 
	}
	
	send_com(json_data, bin_data, monitor){

	    var cli=this;

	    return new Promise(function(ok, fail){
		
		if(bin_data!==undefined){
		    var ook=false;

		    bin_data.forEach(function(bd){
			if(bd!==undefined && bd.data!==undefined)
			    ook=true;
		    });
		    
		    if(ook){
			var bid=cli.bin_id; 
			cli.bin_id++;
			json_data.bin_data = {
			    bid : bid,
			    objects : []
			};
			
			cli.bin_transfers[bid]={
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

		ok(json_data);
		
	    });
	}
	
	send(command, data, p1, p2){
	    var worker=this;

	    var bin_data, monitor;
	    
	    if(p1!==undefined){
		if(p1.constructor===Array){
		    bin_data=p1;
		    monitor=p2;
		    
		}else{
		    monitor=p1;
		}
	    }
	    
	    
	    var json_data= { cmd: command, data : data };
	    
	    return worker.com(json_data, bin_data, monitor);
	}
	
	query(command, data, p1, p2, p3){
	    var worker=this;
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
	    worker.replies[rid]={ cb : reply, mon : monitor};
	    var json_data= { cmd: command, data : data, reply : rid };
	    
	    return worker.com(json_data, bin_data, monitor);
	}
    };
    
    if(typeof module!=='undefined'){
	module.exports.ws=this.ws;
	module.exports.ws_worker=this.ws_worker;
    }
    
}).apply(ws_mod);
