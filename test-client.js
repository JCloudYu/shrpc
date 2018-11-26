/**
 *	Author: JCloudYu
 *	Create: 2018/11/26
**/
(()=>{
	"use strict";
	
	const http = require( 'http' );
	const beson = require( 'beson' );
	const {UInt64} = beson;
	
	let postData = beson.Serialize({
		a:UInt64.from('0xFFFFFFFFFFFFFFFF'),
		b:"2",
		c:103
	});
	
	let chunks = [];
	let request = http.request(
		'http://localhost:8880/ns/class3/argChkCall',
		{
			method:'POST',
			headers:{
				'Content-Type': 'application/x-beson',
				'Content-Length': postData.byteLength
			}
		},
		(res)=>{
			res.on('data', (chunk)=>{
				chunks.push(chunk);
			});
			res.on('end', ()=>{
				let response = Buffer.concat(chunks);
				console.log(beson.Deserialize(response));
			});
		}
	);
	
	request.on( 'error', (e)=>{console.log(e)});
	request.write(Buffer.from(postData));
	request.end();
})();
