/**
 * Project: shrpc
 * File: shrpc.js
 * Author: JCloudYu
 * Create Date: Apr. 18, 2018
 */
(() => {
	"use strict";
	
	const URL = require( 'url' );
	const http = require( 'http' );
	
	const REQ_CHECK = /^\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)$/;
	const HELPER = {};
	
	module.exports = (serverInst=null)=>{
		let _server = serverInst || http.createServer();
		let _handlers = {};
		let _interface = {};
		
		Object.defineProperties(_interface, {
			handle:{
				configurable:false, enumerable:true, writable:false,
				value:function(ns=null, cls=null, definitions={}) {
					let defVerified = false;
				
					if ( arguments.length === 2 && __IS_OBJ(cls) ) {
						definitions = cls;
						cls = definitions._class||'_';
						defVerified = true;
					}
				
					if ( !ns || !cls ) {
						throw new Error( "Invalid handler configuration info!" );
					}
					
					_handlers[ns] = _handlers[ns] || {};
					
					if ( defVerified || __IS_OBJ(definitions) ) {
						_handlers[ns][cls] = definitions;
					}
					else {
						delete _handlers[ns][cls];
					}
					
					return _interface;
				}
			},
			listen:{
				configurable:false, enumerable:true, writable:false,
				value:(...args)=>{
					return _server.listen(...args);
				}
			},
			http:{
				configurable:false, enumerable:true, get:()=>{
					return _server;
				}
			}
		});
		_server.on('request', (req, res)=>{
			// Parse incoming url and extract _id field from query part
			let {pathname:path='/', query={}} = URL.parse(req.url, true);
			let {_id=undefined} = query;
			
			
			
			
			Promise.resolve()
			// Parse and fetch method identifier
			.then(()=>{
				let [ , ns='', cls='', method='' ] = (path.match(REQ_CHECK) || []);
				return __FETCH_HANDLER( _handlers, ns, cls, method );
			})
			// Parse post content according to request's http method and content-type
			.then((handler)=>{
				if ( handler && req.method === 'POST' && req.headers['content-type'] === 'application/json' ) {
					return __STREAM_READ_ALL(req).then((data)=>{
						let args;
						try {
							args = JSON.parse(data.toString('utf8'));
						}
						catch(err) {
							args = false;
						}
						
						return {handler, args};
					});
				}
				else {
					return __STREAM_READ_ALL(req, 0, true).then(()=>{
						return {handler, args:{}};
					});
				}
			})
			.then((preprocess)=>{
				let {args, handler} = preprocess;
				
				// Parse and fetch method identifier
				if ( !handler ) {
					if ( res.finished ) return;
					let rBody = {
						error:404000,
						msg: "Requested procedure is not defined!"
					};
					let rHeader = { 'Content-Type': 'application/json' };
					if ( _id ) {
						rHeader[ 'X-Request-Id' ] = rBody._id = _id;
					}
					
					res.writeHead(404, rHeader);
					res.write(JSON.stringify(rBody));
					res.end();
					return;
				}
			
				// Check if the args var is an object
				if ( !__IS_OBJ(args) ) {
					if ( res.finished ) return;
					let rBody = {
						error:400001,
						msg: "The provided request payload is not a valid json object!"
					};
					let rHeader = { 'Content-Type': 'application/json' };
					if ( _id ) {
						rHeader[ 'X-Request-Id' ] = rBody._id = _id;
					}
					
					res.writeHead(400, rHeader);
					res.write(JSON.stringify(rBody));
					res.end();
					return;
				}
				
				
				
				// Invoke the procedure
				let _env_ctrl = {};
				{
					Object.defineProperties(_env_ctrl, {
						_id:{configurable:false, writable:false, enumerable:true, value:_id||null},
						request:{configurable:false, writable:false, enumerable:true, value:req},
						response:{configurable:false, writable:false, enumerable:true, value:res},
						helper:{configurable:false, writable:false, enumerable:true, value:HELPER}
					});
				}
				
				
				// Check if the developer wants to verify the input arguments
				// handler.verify must be an instance of Object
				if (handler.verify && __IS_OBJ(handler.verify) ) {
					let verify = handler.verify;
					let __errCollect = [];
					for(let argName in verify) {
						if ( !verify.hasOwnProperty(argName) ) continue;
						let passed, arg=verify[argName];
						
						
						if (Array.isArray(arg)) {
							passed = arg.indexOf(args[argName]);
							if ( passed < 0 ) {
								__errCollect.push( `Argument \`${argName}\` is invalid!` )
							}
							continue;
						}
						
						// func means that the arg require custom checking
						if (__IS_FUNC(arg)) {
							passed = arg(args[argName]);
							if ( !passed ) {
								__errCollect.push( `Argument \`${argName}\` is invalid!` );
							}
							continue;
						}
						
						// true means the arg is required but the content is not checked
						if (arg === true) {
							passed = args.hasOwnProperty(argName);
							if ( !passed ) {
								__errCollect.push( `Argument \`${argName}\` is required!` );
							}
							continue;
						}
					}
					
					if ( __errCollect.length > 0 ) {
						if ( res.finished ) return;
						let rBody = {
							error:400002,
							msg: "The provided arguments are insufficient or invalid to invoke the procedure!",
							detail: __errCollect
						};
						let rHeader = { 'Content-Type': 'application/json' };
						if ( _id ) {
							rHeader[ 'X-Request-Id' ] = rBody._id = _id;
						}
						
						res.writeHead(400, rHeader);
						res.write(JSON.stringify(rBody));
						res.end();
						return;
					}
				}
				
				
				
				return Promise.resolve().then(()=>{
					return handler(args, _env_ctrl);
				})
				.then((ret)=>{
					if ( res.finished ) return;
					
					let rBody = {ret};
					let rHeader = { 'Content-Type': 'application/json' };
					if ( _id ) {
						rHeader[ 'X-Request-Id' ] = rBody._id = _id;
					}
					
					res.writeHead(200, rHeader);
					res.write(JSON.stringify(rBody));
					res.end();
				})
				.catch((err)=>{
					if ( res.finished || !err.user_error ) {
						return Promise.reject(err);
					}
					
					
					let rBody = {error:err.error, msg:err.msg};
					let rHeader = { 'Content-Type': 'application/json' };
					if ( _id ) {
						rHeader[ 'X-Request-Id' ] = rBody._id = _id;
					}
					if ( err.detail ) rBody.detail = err.detail;
					
					let errCode = (err.status_code|0) % 1000;
					errCode = ( errCode <= 600 && errCode <= 399 ) ? 400 : errCode;
					res.writeHead( errCode, rHeader);
					res.write(JSON.stringify(rBody));
					res.end();
				});
			})
			.catch((err)=>{
				if ( !res.finished ) {
					let rBody = {
						error: 500000,
						msg: "Unhandled server error!",
					};
					if ( err instanceof Error ) {
						rBody.detail = err.toString();
					}
					
					let rHeader = { 'Content-Type': 'application/json' };
					if ( _id ) {
						rHeader[ 'X-Request-Id' ] = rBody._id = _id;
					}
					
					res.writeHead(500, rHeader);
					res.write(JSON.stringify(rBody));
					res.end();
				}
				
				throw err;
			});
		});
		
		return _interface;
	};
	
	Object.defineProperties(HELPER, {
		GenUserError: {
			configurable:false, writable:false, enumerable:true,
			value:(code, msg, detailInfo=null, status_code=400)=>{
				return {error:code, msg, detail:detailInfo, user_error:true, status_code};
			}
		}
	});
	
	
	
	
	function __STREAM_READ_ALL(stream, size_limit=0, doDrain=false) {
		return new Promise((fulfill, reject)=>{
			stream.on('error', reject );
			
			if ( doDrain ) {
				stream.on('end', fulfill );
				stream.resume();
			}
			else {
				let buff = [], length = 0;
				stream.on('end', ()=>{ fulfill(Buffer.concat(buff)); buff = null; });
				stream.on('data', (chunk)=>{
					length += chunk.length;
					if ( size_limit <= 0 || size_limit >= length) {
						buff.push(chunk);
					}
					else {
						stream.pause();
						buff.splice(0);
						stream.removeAllListeners();
						setTimeout(()=>{
							stream.on( 'end', ()=>{ reject(new RangeError( "Client has uploaded data with too large size!" )) } );
							stream.resume();
						}, 0);
					}
				});
			}
		});
	}
	function __FETCH_HANDLER( handler, ns, cls, method ) {
		if ( !ns || !cls || !method ) return undefined;
	
	
		let result = handler;
		
		result = result[ns];
		if ( !result ) return undefined;
		
		result = result[cls];
		if ( !result ) return undefined;
		
		
		result = result[method];
		return (typeof result === "function") ? result : undefined;
	}
	function __IS_OBJ( verify ) { return Object(verify) === verify; }
	function __IS_FUNC( verify ) { return (typeof verify === "function"); }
})();
