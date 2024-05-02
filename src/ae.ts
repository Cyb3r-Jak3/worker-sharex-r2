/*
Data input format
 - Date
 - URL
 - IP
 - File
 - Action (GET/Upload/List/Delete)
 - HTTP Protocol
 - Error
 - User Agent
 - ASN
 - Colo
 - Country
 - TLS Version
*/

function WriteDataPoint(req: Request, AE: AnalyticsEngineDataset, file: string, action: string, error = ''): void{
	AE.writeDataPoint({
		indexes: [file],
		blobs: [
			new Date().toUTCString(),
			req.url,
			req.headers.get('x-real-ip'),
			file,
			action,
			req.cf?.httpProtocol || 'invalid',
			error,
			req.headers.get('user-agent'),
			req.headers.get('referer'),
			req.cf?.city || "unknown city",
			req.cf?.colo || 'missing colo',
			req.cf?.country || 'missing country',
			req.cf?.tlsVersion || 'invalid TLS',
		],
		doubles: [
			req.cf?.asn || 0,
		],
	});
}

export const LogToAE = (file: string, action: "UPLOAD"| "GET" | "LIST" | "DELETE", request: Request, AE?: AnalyticsEngineDataset) => {
	if(!AE){
		console.error("No AE dataset provided");
		return;
	}
	try{
		WriteDataPoint(request, AE, file, action);
	}catch(error){
		WriteDataPoint(request, AE, file, action, error);
	}
};

