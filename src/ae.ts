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

function WriteDataPoint(req: Request, AE: AnalyticsEngineDataset, file: string, action: string, error?: unknown): void{
	AE.writeDataPoint({
		indexes: [file],
		blobs: [
			new Date().toUTCString(),
			req.url,
			req.headers.get('x-real-ip'),
			file,
			action,
			String(req.cf?.httpProtocol ?? 'invalid'),
			error ? JSON.stringify(error) : "none",
			req.headers.get('user-agent'),
			req.headers.get('referer'),
			String(req.cf?.city ?? 'missing city'),
			String(req.cf?.colo ?? 'missing colo'),
			String(req.cf?.country ?? 'missing country'),
			String(req.cf?.tlsVersion ?? 'invalid TLS'),
		],
		doubles: [
			Number(req.cf?.asn) || 0,
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

