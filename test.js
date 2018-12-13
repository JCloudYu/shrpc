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
	
	console.log( "Initializing categories" );
	
	serverInst
	.expand( 'ns', 'class2', {
		method2:(args, ctrl)=>{
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
		}
	})
	.handle( 'ns', {
		_class: 'class1',
		who:(args, ctrl)=>{
			throw helper.GenUserError( 403000, "WHO ARE YOU!?", {
				_sig:ctrl._sig,
				_id:ctrl._id,
			});
		}
	});
	
	
	serverInst
	.handle('ns', 'class1', specialClass={
		who:(args, ctrl)=>{
			return {
				_sig:ctrl._sig,
				_id:ctrl._id,
				a:1, b:2,
				comment:"The lib will return everything you feed it!"
			};
		},
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
	})
	.expand( 'ns', {
		_cate: 'class2',
		error1:(args, ctrl)=>{
			throw helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error1"}
			);
		},
		error2:(args, ctrl)=>{
			return Promise.reject(helper.GenUserError(
				400012,
				"This is meant to be failed!",
				{_:"error2"}
			));
		},
		error3:(args, ctrl)=>{
			JSON.parse('//');
		},
		error4:(args, ctrl)=>{
			throw helper.GenUserError(
				401001,
				"You're not authorized!",
				{"_!!":"Invalid authorization info!"},
				401
			);
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
			http_status:401,
			error: 401001,
			msg: "You got a massive problem in your code!",
			detail: {
				content: "Your authorization header must be bearer 3.14159265358979323846"
			}
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
