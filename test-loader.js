/**
 * Project: shrpc
 * File: test-loader
 * Author: JCloudYu
 * Create Date: Jun. 17, 2018 
 */
(()=>{
	"use strict";
	
	
	
	let {helper} = require( './shrpc' );
	
	module.exports=(inst)=>{
		inst.handle( 'ns', {
			method:(args, ctrl)=>{
				return "OOPS CLASS1!";
			},
			_cate: 'class1'
		})
		.handle( 'ns', 'class2', {
			method:(args, ctrl)=>{
				return {
					_sig:ctrl._sig,
					_id:ctrl._id,
					a:1, b:2,
					comment:"The lib will return everything you feed it!"
				};
			}
		})
		.expand( 'ns', {
			_cate: 'class2',
			method2:(args, ctrl)=>{
				return {
					_id:ctrl._id,
					_sig:ctrl._sig,
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
			},
			error5:(()=>{
				let _=(args, ctrl)=>{
					return {
						_id:ctrl._id,
						_sig:ctrl._sig,
						a:1, b:2,
						comment:"This function will never be invoked!"
					};
				};
				_.verify=(args)=>{
					if ( !args.id && !args.identity ) {
						return "Either argument id or argument identity must be existed!"
					}
					
					return true;
				};
				return _;
			})()
		})
	};
})();
