import {Router, IRequestStrict} from 'itty-router';
import render2 from 'render2';
import {LogToAE} from './ae';


export interface Env {
	AUTH_KEY: string;
	R2_BUCKET: R2Bucket;
	CACHE_CONTROL?: string;
	AE?: AnalyticsEngineDataset
	CUSTOM_PUBLIC_BUCKET_DOMAIN?: string
	ONLY_ALLOW_ACCESS_TO_PUBLIC_BUCKET?: boolean;
	READ_KEY?: string
}

type CF = [env: Env, ctx: ExecutionContext];
const router = Router<IRequestStrict, CF>();

// handle authentication
const authMiddleware = (request: Request, env: Env): Response | undefined => {
	const url = new URL(request.url);
	const authKey = request.headers?.get("x-auth-key") || url.searchParams.get("authkey");
	// Allow Auth_KEY for all
	if(authKey !== env.AUTH_KEY && // Allow ReadKey for listing files
		authKey === env.READ_KEY && !(request.method === 'GET' && url.pathname === '/files/list')){
		return new Response(JSON.stringify({
			success: false,
			error: 'Missing auth',
		}), {
			status: 401,
			headers: {
				"content-type": "application/json",
			},
		});
	}
};


const notFound = error => new Response(JSON.stringify({
	success: false,
	error: error ?? 'Not Found',
}), {
	status: 404,
	headers: {
		"content-type": "application/json",
	},
});

// handle upload
router.post("/upload", authMiddleware, async (request: Request, env: Env): Promise<Response> => {
	console.log(request.url);
	const url = new URL(request.url);
	let fileslug = url.searchParams.get('filename');
	if(!fileslug){
		// generate random filename UUID if not set
		fileslug = crypto.randomUUID();
	}
	const date = new Date();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const folder = `${date.getFullYear()}/${month}`;
	const filename = `${folder}/${fileslug}`;

	// ensure content-length and content-type headers are present
	const contentType = request.headers.get('content-type');
	const contentLength = request.headers.get('content-length');
	if(!contentLength || !contentType){
		return new Response(JSON.stringify({
			success: false,
			message: "content-length and content-type are required",
		}), {
			status: 400,
			headers: {
				"content-type": "application/json",
			},
		});
	}

	// write to R2
	try{
		await env.R2_BUCKET.put(filename, request.body, {
			httpMetadata: {
				contentType: contentType,
				cacheControl: 'public, max-age=604800',
			},
		});
	}catch(error){
		console.error(`Error occurred writing to R2: ${error}`);
		return new Response(JSON.stringify({
			success: false,
			message: "Error occurred writing to R2",
			error: {
				name: error.name,
				message: error.message,
			},
		}), {
			status: 500,
			headers: {
				"content-type": "application/json",
			},
		});
	}

	// return the image url to ShareX
	const returnUrl = new URL(request.url);
	returnUrl.searchParams.delete('filename');
	returnUrl.pathname = `/file/${filename}`;

	const deleteUrl = new URL(request.url);
	deleteUrl.pathname = `/delete`;
	deleteUrl.searchParams.set("authkey", env.AUTH_KEY);
	deleteUrl.searchParams.set("filename", filename);

	let bucketURL: URL;
	if(env.CUSTOM_PUBLIC_BUCKET_DOMAIN){
		bucketURL = new URL(request.url);
		bucketURL.host = env.CUSTOM_PUBLIC_BUCKET_DOMAIN;
		bucketURL.pathname = filename;
	}
	LogToAE(filename, "UPLOAD", request, env.AE);
	return new Response(JSON.stringify({
		success: true,
		image: returnUrl.href,
		deleteUrl: deleteUrl.href,
		bucketUrl: bucketURL,
	}), {
		headers: {
			"content-type": "application/json",
		},
	});
});

// handle file deletion
router.get("/delete", authMiddleware, async (request: Request, env: Env): Promise<Response> => {
	const url = new URL(request.url);
	const filename = url.searchParams.get('filename');

	if(!filename){
		return notFound('Missing filename');
	}
	LogToAE(filename, "DELETE", request, env.AE);

	// delete from R2
	try{
		try{
			const cache = caches.default;
			await cache.delete(new Request(`https://r2host/${filename}`), {ignoreMethod: true});
		}catch(error){
			console.error(`Got error when deleting cache: ${error}`);
		}

		await env.R2_BUCKET.delete(filename);
		return new Response(JSON.stringify({
			success: true,
		}), {
			headers: {
				"content-type": "application/json",
			},
		});
	}catch(error){
		console.error(`Got error when deleting from R2: ${error}`);
		return new Response(JSON.stringify({
			success: false,
			message: "Error occurred deleting from R2",
			error: {
				name: error.name,
				message: error.message,
			},
		}), {
			status: 500,
			headers: {
				"content-type": "application/json",
			},
		});
	}

});

// handle file retrieval
const getFile = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
	const url = new URL(request.url);
	const id = url.pathname.slice(6);

	if(!id){
		return notFound('Missing ID');
	}

	const imageReq = new Request(`http://r2host/${id}`, request);

	LogToAE(id, "GET", request, env.AE);
	return render2.fetch(imageReq, {
		...env,
		CACHE_CONTROL: 'public, max-age=2592000',
	}, ctx);
};

router.get("/upload/:id", getFile);
router.get("/file/*", getFile);
router.head("/file/*", getFile);

router.get('/files/list', authMiddleware, async (request: Request, env: Env): Promise<Response> => {
	const items = await env.R2_BUCKET.list({limit: 1000});
	const url = new URL(request.url);
	const public_url_items = items.objects.map((object) => { `${url.origin}/file/${object.key}`; });
	LogToAE("ALL", "LIST", request, env.AE);
	return new Response(JSON.stringify(public_url_items, null, 2), {
		headers: {
			'content-type': 'application/json',
		},
	});
});

// 404 everything else
router.all('*', (): Response => new Response(JSON.stringify({
	success: false,
	error: 'Not Found',
}), {
	status: 404,
	headers: {
		"content-type": "application/json",
	},
}));

export {router};