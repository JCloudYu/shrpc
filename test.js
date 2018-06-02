/**
 * Project: shrpc
 * File: test.js
 * Author: JCloudYu
 * Create Date: Apr. 18, 2018
 */
(() => {
	"use strict";
	
	let shrpc = require( './shrpc' );
	let serverInst = shrpc( require( 'http' ).createServer() );
	let specialClass;
	
	serverInst
	.handle( 'ns', {
		method:(args, ctrl)=>{
			return "OOPS CLASS1!";
		},
		_class: 'class1'
	})
	.handle( 'ns', 'class2', {
		method:(args, ctrl)=>{
			return {
				_id:ctrl._id,
				a:1, b:2,
				comment:"The lib will return everything you feed it!"
			};
		},
		redir:(args, ctrl)=>{
			let {request:req, response:res} = ctrl;
			res.writeHead( 307, { "Location":`http://${req.headers[ 'host' ]}/ns/class2/method` });
			res.end();
		},
		error1:(args, ctrl)=>{
			throw ctrl.helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error1"}
			);
		},
		error2:(args, ctrl)=>{
			return Promise.reject(ctrl.helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error2"}
			));
		},
		error3:(args, ctrl)=>{
			JSON.parse('//');
		},
		error4:(args, ctrl)=>{
			throw ctrl.helper.GenUserError(
				401000,
				"You're not authorized!",
				{"_!!":"Invalid authorization info!"},
				401
			);
		}
	})
	.handle( 'ns', 'class3', specialClass={
		argChkCall(args, ctrl){
			return args;
		},
		passCall(args, ctrl){
			return "YOU'RE PASSED!";
		},
		authCheck(args, ctrl) {
			return args;
		}
	})
	.listen( 8880, 'localhost' );
	
	specialClass.argChkCall.verify = {
		"a": true,
		"b": [ "1", "2", "3" ],
		"c": (num)=>{
			if ( (typeof num !== 'number') || num < 0 ) {
				return false;
			}
			
			let end = Math.sqrt(num)|0;
			for( let candidate=2; candidate<=end; candidate++ ) {
				if (num % candidate === 0) {
					return false;
				}
			}
			
			return true;
		}
	};
	specialClass.authCheck.auth = (args, ctrl)=>{
		let {request:req} = ctrl;
		let [type, token] = ('' + req.headers[ 'authorization' ]).split( ' ' );
		if ( type !== "bearer" ) {
			return 401;
		}
		
		if ( token === "9876543210" ) {
			return 403;
		}
		
		
		if ( token === "3.14159265358979323846" ) {
			return true;
		}
		
		return {
			authorized:false,
			content: "Your authorization header must be bearer 3.14159265358979323846"
		};
	};
})();
