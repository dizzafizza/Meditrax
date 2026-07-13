// jsdom's test environment does not provide TextEncoder/TextDecoder, but
// src/lib/ai.js relies on them to decode SSE streams — polyfill from Node's
// built-in `util` so streaming code is testable.
import { TextEncoder, TextDecoder } from "util";
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
