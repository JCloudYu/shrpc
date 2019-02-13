/**
 * Project: shrpc
 * File: shrpc.js
 * Author: JCloudYu
 * Create Date: Apr. 18, 2018
 */
(() => {
	"use strict";
	
	const URL	= require( 'url' );
	const http	= require( 'http' );
	
	const ROOT_REQUIRE = (...args)=>{
		return require.main.require(...args);
	};
	const REQ_CHECK = /^\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)\/([a-zA-Z_][a-zA-Z0-9_]+)$/;
	
	
	const DEFAULT_ERROR = {
		UNACCEPTABLE_MIME: 'UNACCEPTABLE_MIME',
		UNSUPPORTED_PROCEDURE:'UNSUPPORTED_PROCEDURE',
		INVALID_ARGUMENT:'INVALID_ARGUMENT',
		UNACCEPTABLE_ARGUMENT:'UNACCEPTABLE_ARGUMENT',
		INTERNAL_VERIFICATION_LOGIC_ERROR:'INTERNAL_VERIFICATION_LOGIC_ERROR',
		UNEXPECTED_INTERNAL_ERROR: 'UNEXPECTED_INTERNAL_ERROR'
	};
	const DEFAULT_ERROR_BODY = {
		UNACCEPTABLE_MIME: {
			code: 415000,
			message: "Request mime type is not accepted!"
		},
		UNSUPPORTED_PROCEDURE: {
			code: 404000,
			message: "Requested procedure is not supported!"
		},
		INVALID_ARGUMENT: {
			code: 400001,
			message: "The provided request payload is not a valid json object!"
		},
		UNACCEPTABLE_ARGUMENT: {
			code: 400002,
			message: "The provided arguments are insufficient or invalid to invoke the procedure!"
		},
		INTERNAL_VERIFICATION_LOGIC_ERROR: {
			code: 500001,
			message: "The verification context of this procedure is invalid!"
		},
		UNEXPECTED_INTERNAL_ERROR: {
			code: 500000,
			message: "Unhandled server error!"
		}
	};
	
	
	const SHRPC_HELPER = {
		GenUserError:(code, msg, detailInfo=null, status_code=null)=>{
			if ( status_code === null ) {
				status_code = (((code/100)%1000)|0);
				if ( status_code <= 0 ) {
					status_code = 400;
				}
			}
			return {error:code, msg, detail:detailInfo, user_error:true, status_code};
		},
		InitializeSHRPC:(inst, initializers=[], loader=ROOT_REQUIRE, promisefy=false)=>{
			let inits = [];
			initializers.forEach((modulePath)=>{
				inits.push(loader(modulePath));
			});
			return inst.initWith(inits, promisefy);
		}
	};
	
	const SHRPC_FACTORY = (serverInst=null, options={accept:[]})=>{
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
		// NOTE: Resolve accept request types and request processors
		const ACCEPTED_REQ_TYPES = {};
		{
			const {accept=[]} = options;
			if ( !Array.isArray(accept) ) {
				throw new Error( "`accept` option must be an array!" );
			}
			
			if ( accept.length === 0 ) {
				accept.push({
					mime:"application/json",
					serializer:__SERIALIZE_JSON,
					deserializer:__DESERIALIZE_JSON
				});
			}
			
			for(let i=0; i<accept.length; i++) {
				const {
					mime="application/json",
					serializer=__SERIALIZE_JSON,
					deserializer=__DESERIALIZE_JSON
				} = accept[i];
				
				ACCEPTED_REQ_TYPES[mime] = {mime, serializer, deserializer};
			}
		}
		
		
		
		_server.on('request', async(req, res)=>{
			// Parse incoming url and extract _id field from query part
			const {pathname:path='/', query={}} = URL.parse(req.url, true);
			const {REQ_ID = null} = query;
			
			
			
			const MIME_PROCESSOR = ACCEPTED_REQ_TYPES[req.headers['content-type']];
			if ( !MIME_PROCESSOR ) {
				return __BUILD_DEFAULT_ERROR_RESPONSE(
					res, __SERIALIZE_JSON,
					DEFAULT_ERROR.UNACCEPTABLE_MIME,
					'application/json',
					{ requested_mime: req.headers['content-type'] }
				);
			}
			
			
			
			const {
				mime:ACCEPTED_MIME,
				serializer:SERIALIZER,
				deserializer:DESERIALIZER
			} = MIME_PROCESSOR || {};
			const [ , ns='', cate='', method='' ] = (path.match(REQ_CHECK) || []);
			const RPC_HANDLER = __FETCH_HANDLER( _handlers, ns, cate, method );
			const REQUESTED_ARGS = {};
			
			
			
			try {
				// region [ Obtain and parse incoming request body ]
				{
					let parse_content = true && RPC_HANDLER;
					parse_content = parse_content || (MIME_PROCESSOR);
					parse_content = parse_content || (req.method === 'POST');
					
					if ( parse_content ) {
						const rawData = await __STREAM_READ_ALL(req);
						try {
							Object.assign(REQUESTED_ARGS, DESERIALIZER(rawData));
						} catch(e) {}
					}
					else {
						await __STREAM_READ_ALL(req, 0, true);
					}
				}
				// endregion
				
				// region [ Traps for non-support handler and invalid arg type ]
				// NOTE: Trap if no handler is available
				if ( !RPC_HANDLER ) {
					return __BUILD_DEFAULT_ERROR_RESPONSE(
						res, SERIALIZER,
						DEFAULT_ERROR.UNSUPPORTED_PROCEDURE,
						ACCEPTED_MIME,
						null,
						REQ_ID
					);
				}
			
				// NOTE: Trap if input arg is not an object
				if ( Object(REQUESTED_ARGS) !== REQUESTED_ARGS ) {
					return __BUILD_DEFAULT_ERROR_RESPONSE(
						res, SERIALIZER,
						DEFAULT_ERROR.INVALID_ARGUMENT,
						ACCEPTED_MIME,
						null,
						REQ_ID
					);
				}
				// endregion
				
				// region [ Prepare session control parameter ]
				const SESSION_CTRL = {};
				Object.defineProperties(SESSION_CTRL, {
					_sig:{configurable:false, writable:false, enumerable:true, value:`${RPC_HANDLER.signature}`},
					_id:{configurable:false, writable:false, enumerable:true, value:REQ_ID},
					request:{configurable:false, writable:false, enumerable:true, value:req},
					response:{configurable:false, writable:false, enumerable:true, value:res}
				});
				// endregion
				
				// region [ Do customized checks ]
				// NOTE: Do auth check
				if ( typeof RPC_HANDLER.auth === "function" ) {
					let rStatus = false, result = await RPC_HANDLER.auth(REQUESTED_ARGS, SESSION_CTRL);
					if ( !result || (typeof result === 'number') ) {
						rStatus = (result === 403) ? 403 : 401;
						result = {};
					}
					else
					if ( Object(result) === result ) {
						if ( result.http_status !== undefined ) {
							rStatus = ( result.http_status === 403 ) ? 403 : 401;
						}
						else {
							rStatus = ( !result.authorized ) ? 401 : 403;
						}
						
						delete result.authorized;
					}
					
					
					if ( rStatus !== false ) {
						let code, msg;
						if ( rStatus === 401 ) {
							code = (result.error|0)%1000 + 401000;
							msg	 = result.msg || "Authorization is required to access this api!";
						}
						else {
							code = (result.error|0)%1000 + 403000;
							msg = result.msg || "You're not authorized to access this api!";
						}
					
						return __BUILD_ERROR_RESPONSE(res, SERIALIZER, ACCEPTED_MIME, code, msg, result.detail, REQ_ID );
					}
				}
				
				// NOTE: Do argument verification
				const verify = RPC_HANDLER.verify;
				let verified, detail;
				if ( verify === undefined ) {
					verified = true; detail=null;
				}
				else
				if ( typeof verify === "function" ) {
					verified = verify.call(RPC_HANDLER, REQUESTED_ARGS);
					detail = null;
				}
				else
				if ( Object(verify) === verify ) {
					let errors = [];
					for ( let argName in verify ) {
						if ( !verify.hasOwnProperty(argName) ) continue;
						let passed, arg=verify[argName];
						
						
						if (Array.isArray(arg)) {
							passed = arg.indexOf(REQUESTED_ARGS[argName]);
							if ( passed < 0 ) {
								errors.push( `Argument \`${argName}\` is invalid!` )
							}
							continue;
						}
						
						// func means that the arg require custom checking
						if (typeof arg === "function") {
							passed = arg(REQUESTED_ARGS[argName]);
							if ( !passed ) {
								errors.push( `Argument \`${argName}\` is invalid!` );
							}
							continue;
						}
						
						// true means the arg is required but the content is not checked
						if (arg === true) {
							passed = REQUESTED_ARGS.hasOwnProperty(argName);
							if ( !passed ) {
								errors.push( `Argument \`${argName}\` is required!` );
							}
						}
					}
					if ( errors.length > 0 ) {
						verified = false;
						detail = errors;
					}
					else{
						verified = true;
					}
				}
				else {
					return __BUILD_DEFAULT_ERROR_RESPONSE(
						res,
						SERIALIZER,
						DEFAULT_ERROR.INTERNAL_VERIFICATION_LOGIC_ERROR,
						ACCEPTED_MIME,
						null,
						REQ_ID
					);
				}
				
				
				
				if ( !verified ) {
					return __BUILD_DEFAULT_ERROR_RESPONSE(
						res,
						SERIALIZER,
						DEFAULT_ERROR.UNACCEPTABLE_ARGUMENT,
						ACCEPTED_MIME,
						detail,
						REQ_ID
					);
				}
				// endregion
				
				// region [ Execute requested rpc ]
				try {
					const execution_result = await RPC_HANDLER(REQUESTED_ARGS, SESSION_CTRL);
					return __BUILD_RESPONSE(res, SERIALIZER, 200, ACCEPTED_MIME, {ret:execution_result}, REQ_ID);
				}
				catch(err) {
					if ( Object(err) !== err || !err.user_error ) {
						throw err;
					}
					
					let status_code = (err.status_code|0) % 1000;
					status_code = ( status_code <= 600 && status_code <= 399 ) ? 400 : status_code;
					
					let body = { error:err.error, msg:err.msg };
					if ( err.detail ) {
						body.detail = err.detail;
					}
					
					return __BUILD_RESPONSE(res, SERIALIZER, status_code, ACCEPTED_MIME, body, REQ_ID);
				}
				// endregion
			}
			catch( err ) {
				try {
					return __BUILD_DEFAULT_ERROR_RESPONSE(res, SERIALIZER, DEFAULT_ERROR.UNEXPECTED_INTERNAL_ERROR, ACCEPTED_MIME, [err], REQ_ID );
				}
				catch(further_err) {
					res.writeHead(500, {'Content-Type': 'text/plain'});
					res.end();
					
					throw further_err;
				}
			}
		});
		
		return _interface;
	};
	module.exports = {
		shrpc: SHRPC_FACTORY,
		helper: SHRPC_HELPER
	};
	
	
	
	
	
	
	function __SERIALIZE_JSON(data) { return JSON.stringify(data); }
	function __DESERIALIZE_JSON(data) { return JSON.parse(data.toString('utf8')) }
	function __BUILD_DEFAULT_ERROR_RESPONSE(stream, serializer, error_code, mime, error_detail=null, req_id=null) {
		const error_body = DEFAULT_ERROR_BODY[error_code];
		if ( !error_body ) {
			throw new Error( `Undefined error code ${error_code}!` );
		}
		const {code, message} = error_body;
		
		return __BUILD_ERROR_RESPONSE(stream, serializer, mime, code, message, error_detail, req_id);
	}
	function __BUILD_ERROR_RESPONSE(stream, serializer, mime, code, message, error_detail=null, req_id=null) {
		const body = { code, message };
		if( error_detail ) {
			body.detail = error_detail;
		}
		
		return __BUILD_RESPONSE(stream, serializer, (code/1000)|0, mime, body, req_id);
	}
	function __BUILD_RESPONSE(stream, serializer, status_code, mime, body, req_id) {
		if ( stream.finished ) return;
		
		
		let rBody = {}; Object.assign(rBody, body);
		let _rHeader = { 'Content-Type': mime };
		if ( req_id !== undefined && req_id !== null ) {
			_rHeader[ 'X-Request-Id' ] = rBody._id = req_id;
		}
		
		stream.writeHead(status_code, _rHeader);
		stream.write(serializer(rBody));
		stream.end();
	}
	
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
