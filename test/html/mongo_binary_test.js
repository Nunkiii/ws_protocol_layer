"use strict";

window.onload = function() {

    function debug(e){
	console.log("In ("+e.type+") for ("+e.target+")" + e.filename + "["+e.lineno+","+e.colno+"]: "+e.message);
    }
    
    var ws=new ws_web.server(); 
    //var wk=ws.worker;


    ws.install_mod({
	allo : function(msg, reply){
	    reply({ tu : " veux quoi?"});
	}
	
    });

    var wsc=ws.create_client({
	path : "", /// need a path for accessing our websocket server
	port : 7777 /// Nginx is configured as reverse proxy so we connect on default http port
    });

    var image_id, first_image;
    
    wsc.on("error",function(e){
	console.log("E=" +e + " DBG: " + debug(e));
    });
    
    wsc.on("open", function(){
	console.log("ws opened to " +  wsc.peer.url);

	var file_input = document.getElementById('file_input');
	var file_description = document.getElementById('file_description');

	var button_submit = document.getElementById('submit_button');
	var upload = document.getElementById('upload');
	var download = document.getElementById('download');
	var image_list = document.getElementById('image_list');
	var image=document.getElementById('image');
	var image_name=document.getElementById('image_name');

	var image_description=document.getElementById('image_description');

	var btn_edit=document.getElementById('btn_edit');
	var btn_delete=document.getElementById('btn_delete');

	var commit_delete_button=document.getElementById('commit_delete_button');
	var cancel_delete_button=document.getElementById('cancel_delete_button');

	var commit_edit_button=document.getElementById('commit_edit_button');
	var cancel_edit_button=document.getElementById('cancel_edit_button');


	var edit_name=document.getElementById('edit_name');
	var edit_description=document.getElementById('edit_description');
	
	download.value=0;
	upload.value=0;

	//Display an ArrayBuffer containing image binary data into an <img> element
	
	function display_image(ab){
	    var arrayBufferView = new Uint8Array( ab );
	    var blob = new Blob( [ arrayBufferView ], { type: "image/png" } );
	    var urlCreator = window.URL || window.webkitURL;
	    var blob_url = urlCreator.createObjectURL( blob );
	    
	    image.src=blob_url;
	}

	//Get an image from mongodb
	
	function get_image(id){
	    image_id=id;
	    
	    wsc.query("get_image", { image_id : id}, function(msg){

		if(msg.data.error!==undefined){
		    console.log("Error getting image " + msg.data.error);
		    return;
		}
		
		var data=msg.bin_data.objects[0].data;
		//console.log("BinTest reply received "+msg.bin_data.objects[0].name +"bytes : " + data.byteLength);
		display_image(data);
		download.value=1;
		image_name.innerHTML="<strong>"+msg.bin_data.objects[0].name +"</strong> <small>(" + data.byteLength+" bytes)</small>";
		image_description.innerHTML="<strong>Description: </strong>" + msg.data.description;
		edit_name.value=msg.bin_data.objects[0].name;
		edit_description.value=msg.data.description;
	    }, function(type, oid, b, bt){
		if(type==="download")
		    download.value=b/bt;
		if(type==="upload")
		    upload.value=b/bt;
	    });
	}
	
	//Get and display the image list
	
	function display_image_list(){
	    return new Promise(function(ok, fail){
		image_list.innerHTML="";
		
		wsc.query("image_list", {}, function(reply){
		    //console.log("Reply " + JSON.stringify(reply.data.images, null, 4));
		    
		    reply.data.images.forEach(function(img){
			var li=document.createElement("li");
			li.className="list-group-item";
			li.style.cursor="pointer";
			li.innerHTML=img.name;
			li.setAttribute("data-id",img._id);
			li.addEventListener("click",function(){
			    get_image(this.getAttribute("data-id"));
			});
			image_list.appendChild(li);
		    });

		    if(reply.data.images[reply.data.images.length-1]!==undefined)
			first_image=reply.data.images[reply.data.images.length-1]._id;
		    console.log("First " + first_image);
		    ok();
		});
	    });
	}

	
	//Send an image when it is selected. The server replies with the same data.
	
	button_submit.addEventListener('click', function(e) {
	    
	    var file = file_input.files[0];

	    if(file===undefined) return;
	    
	    var reader = new FileReader();

	    reader.onload = function(e) {
		var ab = reader.result;
		
		//display_image(ab);
		
		console.log("Sending data length " + ab.byteLength);
		
		wsc.query("send_image", { description : file_description.value }, [{ name: file.name , data : ab }], function(msg){
		    //var data=msg.bin_data.objects[0].data;
		    //console.log("BinTest reply received "+msg.bin_data.objects[0].name +"bytes : " + data.byteLength);
		    download.value=1;
		    upload.value=1;

		    //display_image(data);
		    display_image_list();
		    get_image(msg.data.inserted_id);
		}, function(type, oid, b, bt){
		    if(type==="download")
			download.value=b/bt;
		    if(type==="upload")
			upload.value=b/bt;
		});
	    };
	    
	    reader.readAsArrayBuffer(file);
	    
	});


	function show_image_section(class_name){
	    var items=document.querySelectorAll(".image_view");
	    for(let i=0;i<items.length;i++){
		if(items[i].classList.contains(class_name))
	   	    items[i].style.display="";
		else
		    items[i].style.display="none";
	    }
	}

	function show_image(){
	    show_image_section("image_display");
	    image_list.style.display="";
	}
	
	
	commit_edit_button.onclick=function(){
	    console.log("Updating image....");
	    wsc.query("update_image", { id : image_id , name : edit_name.value, description : edit_description.value}, function(msg){
		console.log("Updated ! " + JSON.stringify(msg.data));
		show_image();
		display_image_list();
		get_image(image_id);
	    });
	};
	cancel_edit_button.onclick=function(){
	    show_image();
	};
	commit_delete_button.onclick=function(){
	    console.log("Deleting image...." + image_id);
	    wsc.query("delete_image", { id : image_id}, function(msg){
		console.log("Deleted ! " + JSON.stringify(msg.data));
		show_image();
		display_image_list();
		get_image(first_image);
	    });
	};
	cancel_delete_button.onclick=function(){
	    show_image();
	};
	
	btn_edit.addEventListener("click", function(){
	    show_image_section("image_edit");
	    image_list.style.display="none";
	});
	btn_delete.addEventListener("click", function(){
	    show_image_section("image_delete");
	    image_list.style.display="none";
	});
	
	
	display_image_list().then(function(){
	    if(first_image!==undefined)
		get_image(first_image);
	});
	
    });

    wsc.on("error", function(e){
	console.log("WSC Error " + JSON.stringify(e));
    });
    
    wsc.connect()
	.then(function(){})
	.catch(function(e){
	    debug(e);
	});

};
