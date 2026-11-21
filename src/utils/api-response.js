const MAX_ERROR_BODY_LENGTH = 512;

export class ApiHttpError extends Error {
  constructor(status, message, response) {
    super(message || `请求失败 (${status || "未知状态"})`);
    this.name = "ApiHttpError";
    this.status = status;
    this.response = response;
  }
}

const trimErrorMessage = (value) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, MAX_ERROR_BODY_LENGTH) : "";
};

async function readErrorMessage(response) {
  const contentType = response.headers?.get("content-type")?.toLowerCase() || "";
  let body = response;
  try {
    body = typeof response.clone === "function" ? response.clone() : response;
  } catch (_) {
    // Some test adapters and custom fetch implementations do not support clone.
  }

  if (contentType.includes("json")) {
    try {
      const json = await body.json();
      const message = json?.message ?? json?.error ?? json?.detail;
      if (message) return trimErrorMessage(message);
    } catch (_) {
      // Fall through to a generic status message when the body is malformed.
    }
  } else {
    try {
      const text = trimErrorMessage(await body.text());
      if (text) return text;
    } catch (_) {
      // Fall through to a generic status message when the body is unreadable.
    }
  }

  return "";
}

/**
 * Convert a fetch Response into the data shape expected by the Alova callers.
 * Fetch resolves non-2xx responses, so status validation must happen before
 * content-type parsing; otherwise a 404 text response is mistaken for a
 * successful Blob.
 */
export async function parseApiResponse(response) {
  if (!response) throw new Error("请求未返回响应");

  const status = Number(response.status);
  const hasHttpErrorStatus = Number.isFinite(status) && status >= 400;
  if (response.ok === false || hasHttpErrorStatus) {
    const errorStatus = status || 0;
    const bodyMessage = await readErrorMessage(response);
    throw new ApiHttpError(errorStatus, bodyMessage, response);
  }

  const isJson = response.headers?.get("content-type")?.toLowerCase().includes("json");
  if (isJson) {
    const json = await response.json();
    if (json?.code !== undefined && json.code !== 200) {
      const businessStatus = Number(json.code) || status || 0;
      throw new ApiHttpError(businessStatus, json.message || "业务请求失败", response);
    }
    return json?.data !== undefined ? json.data : json;
  }

  return response.blob();
}
