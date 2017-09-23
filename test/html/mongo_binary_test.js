
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

    var wsc=ws.create_client({port : 1234});
    
    wsc.on("error",function(e){
	console.log("E=" +e + " DBG: " + debug(e));
    });
    
    wsc.on("open", function(){
	console.log("ws opened to " +  ws.url);

	var fileInput = document.getElementById('fileInput');
	var upload = document.getElementById('upload');
	var download = document.getElementById('download');
	var image_list = document.getElementById('image_list');
	var image=document.getElementById('image');
	var image_name=document.getElementById('image_name');

	download.value=0;
	upload.value=0;

	//Display an ArrayBuffer containing image binary data into an <img> element
	
	function display_image(ab){
	    var arrayBufferView = new Uint8Array( ab );
	    var blob = new Blob( [ arrayBufferView ], { type: "image/png" } );
	    var urlCreator = window.URL || window.webkitURL;
	    blob_url = urlCreator.createObjectURL( blob );
	    
	    image.src=blob_url;
	}

	//Get an image from mongodb
	
	function get_image(id){
	    wsc.query("get_image", { image_id : id}, function(msg){
		var data=msg.bin_data.objects[0].data;
		//console.log("BinTest reply received "+msg.bin_data.objects[0].name +"bytes : " + data.byteLength);
		display_image(data);
		download.value=1;
		image_name.innerHTML=msg.bin_data.objects[0].name +"(" + data.byteLength+" bytes)";
	    }, function(type, oid, b, bt){
		if(type==="download")
		    download.value=b/bt;
		if(type==="upload")
		    upload.value=b/bt;
	    });
	}
	
	//Get and display the image list
	
	function display_image_list(){
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
	    });
	}

	
	//Send an image when it is selected. The server replies with the same data.
	
	fileInput.addEventListener('change', function(e) {

	    var file = fileInput.files[0];
	    var reader = new FileReader();

	    reader.onload = function(e) {
		var ab = reader.result;
		
		//display_image(ab);
		
		console.log("Sending data length " + ab.byteLength);
		
		wsc.query("send_image", { test : "any UTF json here..."}, [{ name: file.name , data : ab }], function(msg){
		    var data=msg.bin_data.objects[0].data;
		    console.log("BinTest reply received "+msg.bin_data.objects[0].name +"bytes : " + data.byteLength);
		    download.value=1;
		    upload.value=1;
		    display_image(data);
		    display_image_list();
		}, function(type, oid, b, bt){
		    if(type==="download")
			download.value=b/bt;
		    if(type==="upload")
			upload.value=b/bt;
		});
	    };
	    
	    reader.readAsArrayBuffer(file);
	    
	});

	display_image_list();
	
    });
    
    wsc.connect()
	.then(function(){})
	.catch(function(e){
	    debug(e);
	});

}
