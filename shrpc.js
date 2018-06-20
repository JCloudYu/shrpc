/**
 * Project: shrpc
 * File: shrpc.js
 * Author: JCloudYu
 * Create Date: Apr. 18, 2018
 */
(() => {
	"use strict";
	
	const URL  = require( 'url' );
	const http = require( 'http' );
	
	
	const ROOT_REQUIRE = (...args)=>{
		return require.main.require(...args);
	};
	const REQ_CHECK = /^\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)$/;
	const SHRPC_HELPER = {};
	Object.defineProperties(SHRPC_HELPER, {
		GenUserError: {
			configurable:false, writable:false, enumerable:true,
			value:(code, msg, detailInfo=null, status_code=400)=>{
				return {error:code, msg, detail:detailInfo, user_error:true, status_code};
			}
		},
		InitializeSHRPC:{
			configurable:false, writable:false, enumerable:true,
			value:(inst, initializers=[], loader=ROOT_REQUIRE, promisefy=false)=>{
				let inits = [];
				initializers.forEach((modulePath)=>{
					inits.push(loader(modulePath));
				});
				return inst.initWith(inits, promisefy);
			}
		}
	});
	
	const SHRPC_FACTORY = (serverInst=null)=>{
		let _server = serverInst || http.createServer();
		let _handlers = {};
		let _interface = {};
		
		Object.defineProperties(_interface, {
			initWith:{
				configurable:false, enumerable:true, writable:false,
				value:(initializers=[], promisefy=false)=>{
					if ( promisefy ) {
						let _promiseChain = Promise.resolve();
						initializers.forEach((initializer)=>{
							_promiseChain = _promiseChain.then(()=>{
								return initializer(_interface);
							});
						});
						return _promiseChain.then(()=>{return _interface;});
					}
					else {
						initializers.forEach((initializer)=>{
							initializer(_interface);
						});
						return _interface;
					}
				}
			},
			handle:{
				configurable:false, enumerable:true, writable:false,
				value:function(ns=null, cate=null, definitions={}) {
					let defVerified = false;
				
					if ( arguments.length === 2 && __IS_OBJ(cate) ) {
						definitions = cate;
						cate = definitions._cate||definitions._class||'_';
						defVerified = true;
					}
				
					if ( !ns || !cate ) {
						throw new Error( "Invalid handler configuration info!" );
					}
					
					_handlers[ns] = _handlers[ns] || {};
					
					if ( defVerified || __IS_OBJ(definitions) ) {
						let _cate = _handlers[ns][cate] = {};
						
						for( let idx in definitions ) {
							if ( !definitions.hasOwnProperty(idx) ) continue;
							
							let handler = definitions[idx];
							if ( !__IS_FUNC(handler) ) continue;
							
							Object.defineProperty(handler, 'signature', {
								configurable:false, writable:false, enumerable:true, value:`${ns}::${cate}::${idx}`
							});
							_cate[idx] = handler;
						}
					}
					else {
						delete _handlers[ns][cate];
					}
					
					return _interface;
				}
			},
			expand:{
				configurable:false, enumerable:true, writable:false,
				value:function(ns=null, cate=null, definitions={}) {
					let defVerified = false;
				
					if ( arguments.length === 2 && __IS_OBJ(cate) ) {
						definitions = cate;
						cate = definitions._cate||definitions._class||'_';
						defVerified = true;
					}
				
					if ( !ns || !cate ) {
						throw new Error( "Invalid handler configuration info!" );
					}
					
					_handlers[ns] = _handlers[ns] || {};
					
					if ( !defVerified && !__IS_OBJ(definitions) ) {
						return _interface;
					}
					
					let _cate = _handlers[ns][cate] = _handlers[ns][cate] || {};
					for( let idx in definitions ) {
						if ( !definitions.hasOwnProperty(idx) ) continue;
						
						let handler = definitions[idx];
						if ( __IS_FUNC(handler) ) {
							Object.defineProperty(handler, 'signature', {
								configurable:false, writable:false, enumerable:true, value:`${ns}::${cate}::${idx}`
							});
							_cate[idx] = handler
						}
						else
						if ( [undefined, null, false].indexOf(handler) >= 0 ) {
							delete _cate[idx];
						}
					}
					
					return _interface;
				}
			},
			listen:{
				configurable:false, enumerable:true, writable:false,
				value:(...args)=>{
					_server.listen(...args);
					return _interface;
				}
			},
			close:{
				configurable:false, enumerable:true, writable:false,
				value:(...args)=>{
					_server.close(...args);
					return _interface;
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
				let [ , ns='', cate='', method='' ] = (path.match(REQ_CHECK) || []);
				return __FETCH_HANDLER( _handlers, ns, cate, method );
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
			// Check whether the input args and target handler are valid
			.then((stageArgs)=>{
				let {args, handler} = stageArgs;
				
				// region [ Trap if no handler is available ]
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
					return Promise.reject({trapped:true});
				}
				// endregion
			
				// region [ Trap if input arg is not an object ]
				// Check if the args var is an object
				// Note that this check will be trapped only if the mime is application/json
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
					
					return Promise.reject({trapped:true});
				}
				// endregion
				
				return stageArgs;
			})
			// Perform handle.verify and handle.auth
			.then((stageArgs)=>{
				let {args, handler} = stageArgs;
				
				
				
				// Invoke the procedure
				let _promiseChain = Promise.resolve();
				let _env_ctrl = {};
				{
					Object.defineProperties(_env_ctrl, {
						_sig:{configurable:false, writable:false, enumerable:true, value:`${handler.signature}`},
						_id:{configurable:false, writable:false, enumerable:true, value:_id||null},
						request:{configurable:false, writable:false, enumerable:true, value:req},
						response:{configurable:false, writable:false, enumerable:true, value:res},
						
						// DEPRECATED ctrl.helper
						helper:{get:()=>{console.warn("ctrl.helper is deprecated. Please use following statement instead!\nlet {helper} = require('shrpc');"); return SHRPC_HELPER;}, configurable:false, enumerable:true}
					});
				}
				
				
				// region [ process handler.auth ]
				// Check if the api needs to perform auth checking
				// handler.auth must be a function
				if ( __IS_FUNC(handler.auth) ) {
					_promiseChain = _promiseChain
					.then(()=>{
						return handler.auth(args, _env_ctrl);
					})
					.then((_result)=>{
						let _rStatus = false;
						if ( !_result || (typeof _result === 'number') ) {
							_rStatus = (_result === 403) ? 403 : 401;
							_result = {};
						}
						else
						if ( __IS_OBJ(_result) ) {
							_rStatus = ( !_result.authorized ) ? 401 : 403;
							delete _result.authorized;
						}
						
						
						
						if ( _rStatus !== false ) {
							if ( res.finished ) return;
							
							let _rBody = {};
							if ( _rStatus === 401 ) {
								_rBody.error = (_result.error|0)%1000 + 401000;
								_rBody.msg = _result.msg || "Authorization is required to access this api!";
							}
							else {
								_rBody.error = (_result.error|0)%1000 + 403000;
								_rBody.msg = _result.msg || "You're not authorized to access this api!";
							}
							
							if ( _result.detail ) {
								_rBody.detail = _result.detail;
							}
							
							
							let _rHeader = { 'Content-Type': 'application/json' };
							if ( _id ) {
								_rHeader[ 'X-Request-Id' ] = _rBody._id = _id;
							}
							
							res.writeHead(_rStatus, _rHeader);
							res.write(JSON.stringify(_rBody));
							res.end();
							return Promise.reject({trapped:true});
						}
					});
				}
				// endregion
				
				// region [ process handler.verify ]
				// Check if the developer wants to verify the input arguments
				// handler.verify must be an instance of Object
				if ( handler.verify ) {
					let verify = handler.verify;
					
					if ( __IS_FUNC(verify) ) {
						_promiseChain = _promiseChain.then(()=>{
							let result = verify(args);
							if ( result === true ) { return; }
							
							
							if ( res.finished ) return;
							let rBody = {
								error:400002,
								msg: "The provided arguments are insufficient or invalid to invoke the procedure!"
							};
							let rHeader = { 'Content-Type': 'application/json' };
							if ( _id ) {
								rHeader[ 'X-Request-Id' ] = rBody._id = _id;
							}
							
							
							
							if ( result ) { rBody.detail = result; }
							res.writeHead(400, rHeader);
							res.write(JSON.stringify(rBody));
							res.end();
							return Promise.reject({trapped:true});
						});
					}
					else
					if ( __IS_OBJ(verify) ) {
						_promiseChain = _promiseChain.then(()=>{
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
								return Promise.reject({trapped:true});
							}
						});
					}
					else {
						if ( res.finished ) return;
						let rBody = {
							error:500001,
							msg: "The verification context of this procedure is invalid!",
						};
						let rHeader = { 'Content-Type': 'application/json' };
						if ( _id ) {
							rHeader[ 'X-Request-Id' ] = rBody._id = _id;
						}
						
						res.writeHead(500, rHeader);
						res.write(JSON.stringify(rBody));
						res.end();
						return Promise.reject({trapped:true});
					}
				}
				// endregion
				
				// The following then will be invoked if and only if no error occurs
				return _promiseChain.then(()=>{
					stageArgs.ctrl = _env_ctrl;
					return stageArgs;
				});
			})
			// Execute the targeted api
			.then((stageArgs)=>{
				let {args, handler, ctrl:_env_ctrl} = stageArgs;
			
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
				if ( err.trapped ) {
					return;	// Do nothing if incoming request is successfully trapped!
				}
			
			
			
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
	const moduleInst = module.exports = (...args)=>{
		// DEPRECATED
		console.warn("Directly invocation of shrpc module is deprecated! Please use following statements instead!\nlet {shrpc, helper} = require('shrpc');\nlet inst = shrpc();");
		return SHRPC_FACTORY(...args);
	};
	Object.defineProperties(moduleInst, {
		shrpc: {value:SHRPC_FACTORY, configurable:false, writable:false, enumerable:true},
		helper: {value:SHRPC_HELPER, configurable:false, writable:false, enumerable:true}
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
	function __FETCH_HANDLER( handler, ns, cate, method ) {
		if ( !ns || !cate || !method ) return undefined;
	
	
		let result = handler;
		
		result = result[ns];
		if ( !result ) return undefined;
		
		result = result[cate];
		if ( !result ) return undefined;
		
		
		result = result[method];
		return (typeof result === "function") ? result : undefined;
	}
	function __IS_OBJ( verify ) { return Object(verify) === verify; }
	function __IS_FUNC( verify ) { return (typeof verify === "function"); }
})();
