# Simple HTTP RPC (SHRPC) Protocol #
SHRPC protocol is proposed to simplify the disadvantages of JSONRPC version 2.0.
 

## Request ##
Each valid SHRPC request consists of two parts, procedure descriptor and invocation payload.

### Procedure Descriptor ###
Procedure descriptor, which describes the procedure to be invoked, is represented by a network URI.

```http
POST /{namespace}/{cate}/{procedure}?[_id={procedure identifier}]
```

### Invocation Payload ###
Invocation payload is a json object of which the fields are the arguments to execute the procedure.

```javascript
{
	"arg1_name":"val1",
	"arg2_name":123
}
```

### Privilege Control ###
The SHRPC request is a typical http request. Hence, http headers that are used in user privilege control like Authorization and activity tracking such as Cookie header is also accepted by SHRPC.

### Request Method ###
SHRPC should accept both GET and POST methods, where POST method is defined as an invocation with arguments and GET is, in contrast, without arguments.




## Response ##
The SHRPC responds is also constructed by two parts, execution state and response payload. The execution state is represented by http status code, which represents the invocation status of the procedure request. Response payload contains the execution result or detailed error information.

### Execution State ###
The standard http status code for specific conditions are defined in following table.

| code | comment |
|:------------:|:-------|
| 200 | The procedure is invoked and terminated normally |
| 400 | There are something wrong with the request payload |
| 401 | The info is insufficient or invalid to identify the accessor |
| 403 | The authorization info is correct but without sufficient privilege |
| 404 | The procedure is not defined |
| 500 | The procedure cannot be executed or the invocation is terminated unexpectedly due to some server internal faults |

Please note that the SHRPC is a standard http request. Hence, other standard http code such as 301, 302, 307, 308, 401 and 403 must be followed as well.

### Response Payload ###
The response payload is a json object contains following fields.

| field  | occurrence | default | comment |
|:------:|:----------:|:-------------:|:--------|
| \_id   | all		  | null          | The value same as \_id provided by caller in procedure descriptor |
| ret    | success    | null          | The result of the invocation |
| error	 | error      | 0             | The detailed error code used to identify exact error conditions |
| msg	 | error	  | ""  | The human readable error message |



## Reserved and Customizable Error Code Ranges ##
The following table defines the standard error codes reserved for shrpc.

| error | description |
|:----------:|:--------|
| 400000 | Use this if you don't wanna specify the error detail.... |
| 400001 | The provided request payload is not a valid json syntax |
| 400002 | The arguments provided in the payload is insufficient or invalid to invoke the procedure |
| 401000 | The information is insufficient to identify the accessor |
| 403000 | The authorized information has insufficient privilege to invoke the procedure |
| 404000 | The requested procedure is not available |
| 500000 | Unexpected internal server error! If you catch this, that means you got problem with your code.... |

Please note that error codes locate within following interval are reserved for shrpc.
> [ HTTP_STATUS_CODE * 100, HTTP_STATUS_CODE * 100 + 100 ]

Developers can feel free to define custom error codes within following interval.
> ( HTTP_STATUS_CODE * 100, {HTTP_STATUS_CODE + 1} * 100 )
