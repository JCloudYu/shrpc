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
		method:(args, ctrl, _id)=>{
			return "OOPS CLASS1!";
		},
		_class: 'class1'
	})
	.handle( 'ns', 'class2', {
		method:(args, ctrl, _id)=>{
			return {
				a:1, b:2,
				comment:"The lib will return everything you feed it!"
			};
		},
		redir:(args, ctrl, _id)=>{
			let {request:req, response:res} = ctrl;
			res.writeHead( 307, { "Location":`http://${req.headers[ 'host' ]}/ns/class2/method` });
			res.end();
		},
		error1:(args, ctrl, _id)=>{
			throw ctrl.helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error1"}
			);
		},
		error2:(args, ctrl, _id)=>{
			return Promise.reject(ctrl.helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error2"}
			));
		},
		error3:(args, ctrl, _id)=>{
			JSON.parse('//');
		},
		error4:(args, ctrl, _id)=>{
			throw ctrl.helper.GenUserError(
				401000,
				"You're not authorized!",
				{"_!!":"Invalid authorization info!"},
				401
			);
		}
	})
	.handle( 'ns', 'class3', specialClass={
		argChkCall(args, ctrl, _id){
			return args;
		},
		passCall(args, ctrl, _id){
			return "YOU'RE PASSED!";
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
	}
})();
