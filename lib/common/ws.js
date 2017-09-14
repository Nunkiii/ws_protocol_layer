"use strict";

var ws_mod={};


(function(mod){
    var event;
    if(typeof module!=='undefined'){
	event = require('../html/ws_event').event;
    }else{
	event=ws_event.event;
    }
    
    this.ws = class websocket extends event{

	constructor(options){
	    super();
	    this.mods={};

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

    if(typeof module!=='undefined')
	module.exports.ws=this.ws;
    
}).apply(ws_mod);
