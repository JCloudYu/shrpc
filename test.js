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
	}).listen( 8880, 'localhost' );
})();
