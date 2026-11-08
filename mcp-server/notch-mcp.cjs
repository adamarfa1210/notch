#!/usr/bin/env node
/**
 * Notch Model Context Protocol (MCP) Server
 * Exposes the Dynamic RAM Notch items to Antigravity CLI via stdio JSON-RPC 2.0.
 */

const http = require("http");
const readline = require("readline");

const NOTCH_API_PORT = 49152;
const NOTCH_API_HOST = "127.0.0.1";

function fetchNotch(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: NOTCH_API_HOST,
      port: NOTCH_API_PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : { success: true });
          } else {
            resolve({ error: `Notch API returned HTTP ${res.statusCode}: ${data}` });
          }
        } catch (e) {
          resolve({ error: `JSON parse error: ${e.message}`, raw: data });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        error: `Could not connect to Notch Daemon on port ${NOTCH_API_PORT}. Is notch running? Error: ${err.message}`,
      });
    });

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const TOOLS = [
  {
    name: "notch_list_items",
    description:
      "Get all assets (documents, images, videos, code, copied text) currently held in the user's Dynamic RAM Notch. Returns item IDs, types (fileuri, image, text), filenames/previews, physical file paths, and MIME types.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "notch_get_item",
    description:
      "Get details, raw text, or physical file path of a specific asset from the Notch by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the staged item.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "notch_clear_buffer",
    description: "Clear all staged assets from the Notch RAM buffer.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

async function handleToolCall(name, args) {
  if (name === "notch_list_items") {
    const items = await fetchNotch("/api/items");
    if (items.error) {
      return {
        content: [{ type: "text", text: `[Notch Error]: ${items.error}` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(items, null, 2),
        },
      ],
    };
  }

  if (name === "notch_get_item") {
    const items = await fetchNotch("/api/items");
    if (items.error) {
      return {
        content: [{ type: "text", text: `[Notch Error]: ${items.error}` }],
        isError: true,
      };
    }
    const found = Array.isArray(items) ? items.find((it) => it.id === args.id) : null;
    if (!found) {
      return {
        content: [{ type: "text", text: `Item with ID "${args.id}" not found in Notch.` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(found, null, 2),
        },
      ],
    };
  }

  if (name === "notch_clear_buffer") {
    const result = await fetchNotch("/api/items/clear", "POST");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function sendResponse(response) {
  const jsonStr = JSON.stringify(response);
  process.stdout.write(jsonStr + "\n");
}

function setupStdio() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    try {
      const msg = JSON.parse(line.trim());
      const { id, method, params } = msg;

      if (method === "initialize") {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "notch-mcp",
              version: "1.0.0",
            },
          },
        });
        return;
      }

      if (method === "notifications/initialized") {
        return; // No-op
      }

      if (method === "tools/list") {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: TOOLS,
          },
        });
        return;
      }

      if (method === "tools/call") {
        const { name, arguments: toolArgs } = params || {};
        try {
          const result = await handleToolCall(name, toolArgs || {});
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: result,
          });
        } catch (err) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: {
              content: [{ type: "text", text: `Error executing tool ${name}: ${err.message}` }],
              isError: true,
            },
          });
        }
        return;
      }

      // Fallback for unsupported methods
      if (id !== undefined) {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        });
      }
    } catch (parseErr) {
      // Ignore invalid JSON lines
    }
  });
}

setupStdio();
