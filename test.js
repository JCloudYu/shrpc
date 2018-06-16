/**
 * Project: shrpc
 * File: test.js
 * Author: JCloudYu
 * Create Date: Apr. 18, 2018
 */
(async()=>{
	"use strict";
	
	let {shrpc, helper} = require( './shrpc' );
	let serverInst = shrpc(require( 'http' ).createServer());
	let specialClass;
	
	console.log( "Initializing class3 category" );
	serverInst.handle( 'ns', 'class3', specialClass={
		argChkCall(args, ctrl){
			return args;
		},
		passCall(args, ctrl){
			return "YOU'RE PASSED!";
		},
		authCheck(args, ctrl) {
			return args;
		},
		authCheckDelay(args, ctrl) {
			return args;
		}
	});
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
	specialClass.authCheck.auth = SyncedAuthCheck;
	specialClass.authCheckDelay.auth = DelayedAuthCheck;
	
	
	
	
	console.log( "Start using helper to initialize the instance..." );
	(await helper.InitializeSHRPC(serverInst, [
		'./test-loader',
		'./test-loader-delayed',
	], require, true)).listen( 8880, 'localhost' );
	console.log( "All done!!!" );
	
	
	
	
	function SyncedAuthCheck(args, ctrl){
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
	}
	function DelayedAuthCheck(args, ctrl){
		return new Promise((fulfill, reject)=>{
			setTimeout(()=>{
				fulfill(SyncedAuthCheck(args, ctrl));
			}, 3000);
		});
	}
})();
