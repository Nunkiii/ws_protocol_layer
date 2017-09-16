var c;

var simple_test_pack = {
    
    server_test_message1 : function(msg){
	c.log("Server message 1", msg.data.text, "outside");
    },
    
    server_test_message2 : function(data){
	c.log("Server message 2", data.text, "outside");
    }
    
};

window.addEventListener("load", function(){

    var input=document.getElementById("input");
    var button_send=document.getElementById("button_send");
    var button_query=document.getElementById("button_query");
    var console_div=document.getElementById("console");
    
    c=new console_widget(console_div);
    
    c.log("Status","Creating websocket");
    
    var ws=new ws_client.client({port : 1234});

    ws.install_mod(simple_test_pack);
    
    ws.on("error",function(e){
	c.log("Error event: ", error_message(e), "error");
    });
    
    ws.on("open", function(){
	c.log("Info","connected to " +  ws.url);

	button_send.addEventListener("click", function(){
	    c.log("Info", "Sending data ["+input.value+"].");
	    ws.send("simple_test", { text :  input.value} ).catch(function(error){
		c.log("Error ws.send", error_message(error), "error");
	    }).then(function(){
		c.log('ok',"Sent message!","good");
	    });
	    
	});


    	button_query.addEventListener("click", function(){
	    c.log("Info", "Sending data ["+input.value+"].");
	    
	    ws.query("simple_test_with_reply",
		     { text :  input.value},
		     function (reply_msg){
			 c.log('Reply received',"Received reply from server : <i> "+ reply_msg.data.text + " </i>","good");
		     }
		    ).catch(function(error){
		c.log("Error ws.send", error_message(error), "error");
	    }).then(function(){
		c.log("Message sent!", "waiting for reply...","good");
	    });
	    
	});
});
    
    ws.create().catch(function(e){c.log("Error",e);});
    
});
