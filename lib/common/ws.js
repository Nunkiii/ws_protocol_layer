"use strict";

var ws_mod={};

(function(mod){

    var event;

    if(typeof module!=='undefined'){
	event = require('./event').event;
    }else{
	event=ws_event.event;
    }


    this.host = class host{
	constructor(options){
	    if(options!==undefined)
		this.configure(options);
	}
	
	configure(options){
	    var cli=this;

	    for(var o in options)
		cli[o]=options[o];
	}

	set protocol(p){
	    if(p!="ws"&&p!="wss") throw(new Error("Bad protocol ["+p+"] must be 'ws' or 'wss' !")); else this.protocol_name=p;
	}
	get protocol(){
	    if (typeof document == "undefined") return "ws:";
	    if (document.location===undefined) return "ws:";
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

	set path(p){this.path_name=p; }
	get path(){
	    return  this.path_name===undefined?'': ('/'+this.path_name);
	}
	
	set url(u){this.url_name=u;}
	get url(){
	    //console.log("Get URL " + this.path_name);
	    return this.url_name!==undefined ? this.url_name :  this.protocol + "//" + this.host + this.port + this.path;
	}

    };
    

    var handlers = this.handlers = class handlers {
	constructor(mod_pack, name){
	    //console.log("Handlers constructor pack " + mod_pack +"/"+name);
	    this.mods={};
	    if(mod_pack!==undefined)
		this.install_mod(mod_pack,name);
	}

	install_mod(mod_pack, name ){
	    var pack_name=name===undefined? 0:name;
	    var mp=this.mods[pack_name];

	    if(mp===undefined) mp=this.mods[pack_name]={};
	    
	    for(var m in mod_pack){
		console.log("Installing mod: pack ["+pack_name+"] name [" + m+"]");
		mp[m]=mod_pack[m];
	    }
	    
	    return mod_pack;
	}

	get_handler(cmd_name, mod_pack_name){
	    //console.log("Looking for pack " + mod_pack_name + "/" + cmd_name );
	    //this.list_mods(mod_pack_name);
	    if(mod_pack_name===undefined) mod_pack_name="0";
	    var pack=this.mods[mod_pack_name];
	    
	    //console.log(pack===undefined? ("Pack ["+mod_pack_name+"] not found!") : ("Found pack " + mod_pack_name + " cmd = ? " + pack[cmd_name] ));
	    return pack===undefined? undefined : pack[cmd_name];
	}
	
	list_mods(mod_pack_name){
	    var mods=this.mods[mod_pack_name===undefined?0:mod_pack_name];
	    for(var m in mods){
		console.log("Mod " + m);
	    }
	}
	
    };
    
    
    this.ws = class websocket extends event{

	constructor(options){
	    super();
	    if(options!==undefined){
		if(options.mod_pack!==undefined){
		    if(options.mod_pack_name===undefined)options.mod_pack_name="default";
		    this.mods=new handlers(options.mod_pack, options.mod_pack_name);
		}
	    }
	    if(this.mods==undefined)
		this.mods=new handlers();
	    
	    this.clients={};
	    this.n_clients=0;
	    this.chunk_size=8192;
	}
	
	broadcast(cmd, data, bin_data){
	    for(var cid in this.clients){
		let cli=this.clients[cid];
		cli.send(cmd, data, bin_data);
	    };
	    
	}

	install_mod(mod_pack, name ){
	    return this.mods.install_mod(mod_pack, name );
	}
	
	add_client(cli){

	    var srv=this;
	    srv.clients[cli.id]=cli;
	    srv.n_clients++;
	    
	    
	    return cli;
	}

	get nclients(){ return this.n_clients; }
	
	remove_client(cli){
	    var srv=this;
	    srv.n_clients--;
	    delete srv.clients[cli];
	    
	    return srv;
	}
	

    };

    
    this.ws_worker = class ws_worker extends event{

	constructor(srv, options){
	    super();
	    if(options!==undefined){
		if(options.mod_pack!==undefined)  
		    this.mods=new handlers(options.mod_pack, options.mod_pack_name);
	    }
	    
	    this.srv=srv;
	    this.bin_id=13;
	    this.binary_transfers={};
	    this.bin_transfers={};
	    this.replies={};
	    this.id=Math.random().toString(36).substring(2);

	    this.stations={}; //List of broadcast stations this websocket is listenning to.
	    
	    //console.log(this.id + " : WS Client created");
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

	set_handlers(mods) {
	    this.mods=mods;
	}
	
	process_message(msg){

	    
	    var cli=this;
	    var cmd_name=msg.cmd, mod_pack_name=msg.pack;
	    var cmd_strings=msg.cmd.split('/');
	    if(cmd_strings.length==2){
		cmd_name=cmd_strings[1];
		mod_pack_name=cmd_strings[0];
	    }

	    //console.log(cli.id + " message received " + mod_pack_name + "/" + cmd_name);

	    var hndl;

	    if(cli.mods!==undefined){
		hndl=cli.mods.get_handler( cmd_name, mod_pack_name);
	    }
	    if(hndl===undefined)
		hndl=cli.srv.mods.get_handler( cmd_name, mod_pack_name);
	    
	    if(hndl!==undefined){
		if(msg.reply!==undefined){
		    //console.log("Answering a msg ["+cmd_name+"] with reply id " + msg.reply);
		    hndl.call(this, msg, function (data, bin_data, next){
			if (typeof bin_data === "boolean") { next=bin_data; bin_data=undefined; }
			cli.com({ cmd: "", data : data, reply : msg.reply, next : next }, bin_data);
		    });
		}else
		    hndl.call(cli, msg);
	    }
	    else{
		if(msg.reply!==undefined){
		    //console.log(cli.id + " : Receiving reply id " + msg.reply + " data " + JSON.stringify(msg.data));
		    var rep=cli.replies[msg.reply];
		    if(rep===undefined){
			console.error(cli.id+" : No reply object found ["+msg.reply+"]! received UTFText : "+JSON.stringify(msg)+"");
		    }else{
			
			if(rep.cb!==undefined)
			    cli.replies[msg.reply].cb.call(this,msg);
			else
			    console.error("No Callback found for reply! pack/name= ["+mod_pack_name + "/" +cmd_name+"] received UTFText : "+JSON.stringify(msg)+"");
			if(msg.next===undefined)
			    delete cli.replies[msg.reply];
		    }
		}else
		    console.error("Undefined incoming command ["+mod_pack_name + "/" +cmd_name+"] received UTFText : "+JSON.stringify(msg)+"");
	    }
	    cli.srv.signal("client_message", {  client: cli, cmd : cmd_name, pack: mod_pack_name, data : msg.data });
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

	    //console.log("ws_worker: send : cmd is " + command);
	    
	    var worker=this;

	    var bin_data, monitor;
	    
	    if(p1!==undefined){
		if(p1.constructor===Array){
		    //console.log("Sending binary data : " + p1[0].name);
		    bin_data=p1;
		    monitor=p2;
		    
		}else{
		    monitor=p1;
		}
	    }
	    
	    
	    var json_data= { cmd: command, data : data };

	    //console.log("ws_worker: sending JSON " + JSON.stringify(json_data));
	    
	    return worker.com(json_data, bin_data, monitor);
	}
	
	query(command, data, p1, p2, p3){
	    var worker=this;
	    var bin_data, reply, monitor, jdata={};

	    if(typeof data === "function"){
		reply=data;
		monitor=p1;
	    }else{
		jdata=data;
	    
		if(p1.constructor===Array){
		    bin_data=p1;
		    reply=p2;
		    monitor=p3;
		    
		}else{
		    reply=p1;
		    monitor=p2;
		}
	    }
	    
	    var rid=Math.random().toString(36).substring(2);
	    worker.replies[rid]={ cb : reply, mon : monitor};
	    var json_data= { cmd: command, data : jdata, reply : rid };
	    
	    return worker.com(json_data, bin_data, monitor);
	}
    };
    
    if(typeof module!=='undefined'){
	module.exports.ws=this.ws;
	module.exports.handlers=this.handlers;
	module.exports.ws_worker=this.ws_worker;
	module.exports.host=this.host;
    }
    
}).apply(ws_mod);
