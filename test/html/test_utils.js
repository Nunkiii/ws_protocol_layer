"use strict";

function error_message(e){
    return ("In ("+e.type+") for ("+e.target+")" + e.filename + "["+e.lineno+","+e.colno+"]: "+e.message);
}

class console_widget{
    constructor(div){
	this.div=div;
    }

    log(title, message, classes){
	var d=document.createElement("div");
	d.className="console_line "+classes;
	d.innerHTML="<strong>"+title+" </strong> <span>"+ message+ "</span>";
	
	this.div.appendChild(d);
	this.div.scrollTop = this.div.scrollHeight;
    }
};
