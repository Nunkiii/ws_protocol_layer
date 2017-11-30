"use strict";

var ws_event={};

(function(mod){
    
    this.event = class event {

	constructor(){
	    this.cb={};
	}

	on (evt, cb){
	    if(this.cb[evt]===undefined)this.cb[evt]=[];
	    this.cb[evt].push(cb);
	}
	
	signal (evt, data){
	    var ctrl=this;
	    if(this.cb[evt]===undefined)
		return undefined;
	    this.cb[evt].forEach(function(cb){ cb.call(ctrl, data); });
	    return data;
	}
    };
    
}).apply(ws_event);


if(typeof module!=='undefined' && module.exports) module.exports=ws_event;
