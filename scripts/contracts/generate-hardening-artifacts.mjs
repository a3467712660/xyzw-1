import fs from "node:fs";
import path from "node:path";
import { z } from "../../backend/node_modules/zod/index.js";
import { hardeningContracts } from "../../backend/src/contracts/hardeningContracts.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const outputFiles = {
  openapi: path.resolve(repoRoot, "openapi.json"),
  contractsTs: path.resolve(repoRoot, "src/api/generated/contracts.ts"),
  clientTs: path.resolve(repoRoot, "src/api/generated/client.ts"),
  indexTs: path.resolve(repoRoot, "src/api/generated/index.ts"),
};

const pascalCase = (value) =>
  String(value || "")
    .replace(/(^\w|[-_/]\w)/g, (segment) =>
      segment.replace(/[-_/]/g, "").toUpperCase())
    .replace(/[^A-Za-z0-9]/g, "");

const jsonSchemaToTs = (schema, indentLevel = 0) => {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }
  if (schema.anyOf) {
    return schema.anyOf.map((item) => jsonSchemaToTs(item, indentLevel)).join(" | ");
  }
  if (schema.oneOf) {
    return schema.oneOf.map((item) => jsonSchemaToTs(item, indentLevel)).join(" | ");
  }
  if (schema.enum) {
    return schema.enum.map((item) => JSON.stringify(item)).join(" | ");
  }
  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }
  if (Array.isArray(schema.type)) {
    return schema.type
      .map((type) => jsonSchemaToTs({ ...schema, type }, indentLevel))
      .join(" | ");
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `Array<${jsonSchemaToTs(schema.items || {}, indentLevel)}>`;
    case "object": {
      const indent = "  ".repeat(indentLevel);
      const innerIndent = "  ".repeat(indentLevel + 1);
      const required = new Set(schema.required || []);
      const propertyEntries = Object.entries(schema.properties || {});
      const lines = propertyEntries.map(([key, value]) => {
        const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
          ? key
          : JSON.stringify(key);
        const optionalSuffix = required.has(key) ? "" : "?";
        return `${innerIndent}${safeKey}${optionalSuffix}: ${jsonSchemaToTs(value, indentLevel + 1)};`;
      });
      if (schema.additionalProperties) {
        const additionalType = schema.additionalProperties === true
          ? "unknown"
          : jsonSchemaToTs(schema.additionalProperties, indentLevel + 1);
        lines.push(`${innerIndent}[key: string]: ${additionalType};`);
      }
      if (!lines.length) {
        return "Record<string, never>";
      }
      return `{\n${lines.join("\n")}\n${indent}}`;
    }
    default:
      return "unknown";
  }
};

const createOpenApiParameterList = (schema, location) => {
  if (!schema) {
    return [];
  }
  const jsonSchema = z.toJSONSchema(schema);
  if (jsonSchema.type !== "object" || jsonSchema.additionalProperties) {
    return [];
  }
  const required = new Set(jsonSchema.required || []);
  return Object.entries(jsonSchema.properties || {}).map(([name, value]) => ({
    name,
    in: location,
    required: location === "header" ? true : required.has(name),
    schema: value,
  }));
};

const buildOpenApiDocument = () => {
  const document = {
    openapi: "3.1.0",
    info: {
      title: "XYZW Web Helper Hardening Contracts",
      version: "1.0.0",
    },
    tags: Array.from(
      new Set(hardeningContracts.map((contract) => contract.tag)),
    ).map((name) => ({ name })),
    paths: {},
  };

  for (const contract of hardeningContracts) {
    const pathItem = document.paths[contract.path] || {};
    const openapiSuccessSchema = z.toJSONSchema(contract.openapiSuccessSchema);
    const parameters = [
      ...createOpenApiParameterList(contract.requestHeaders, "header"),
    ];
    const requestBody = contract.requestBody
      ? {
          required: true,
          content: {
            "application/json": {
              schema: z.toJSONSchema(contract.requestBody),
            },
          },
        }
      : undefined;

    if (contract.operationId === "wechatHortorLogin") {
      Object.assign(requestBody, {
        content: {
          "text/plain": {
            schema: { type: "string" },
          },
        },
      });
    }

    pathItem[contract.method] = {
      operationId: contract.operationId,
      summary: contract.summary,
      tags: [contract.tag],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: {
        200: {
          description: "Success",
          content: Object.fromEntries(
            contract.openapiSuccessContentTypes.map((contentType) => [
              contentType,
              { schema: openapiSuccessSchema },
            ]),
          ),
        },
      },
    };
    document.paths[contract.path] = pathItem;
  }

  return `${JSON.stringify(document, null, 2)}\n`;
};

const buildContractsTs = () => {
  const lines = [
    "/* eslint-disable ts/consistent-type-definitions */",
    "// This file is generated by scripts/contracts/generate-hardening-artifacts.mjs",
    "",
    "export interface GeneratedApiEnvelope<TData = unknown> {",
    "  success: boolean;",
    "  message?: string;",
    "  data?: TData;",
    "  error?: {",
    "    code?: string;",
    "    message?: string;",
    "  };",
    "  [key: string]: unknown;",
    "}",
    "",
  ];

  for (const contract of hardeningContracts) {
    const baseName = pascalCase(contract.operationId);
    if (contract.frontendRequestSchema) {
      lines.push(
        `export type ${baseName}Request = ${jsonSchemaToTs(z.toJSONSchema(contract.frontendRequestSchema))};`,
      );
    }
    if (contract.frontendResponseSchema) {
      lines.push(
        `export type ${baseName}Response = ${jsonSchemaToTs(z.toJSONSchema(contract.frontendResponseSchema))};`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const buildClientTs = () => {
  const groupedRuntimeMethods = new Map();
  for (const contract of hardeningContracts) {
    const [, groupName, methodName] = contract.runtimeAccessor.split(".");
    const baseName = pascalCase(contract.operationId);
    const responseType = contract.frontendResponseSchema
      ? `${baseName}Response`
      : "unknown";
    let signature = `() => Promise<${responseType}>;`;
    if (contract.frontendRequestSchema) {
      const requestType = `${baseName}Request`;
      if (contract.operationId === "tokenImportProxyFetch") {
        signature = `(url: string) => Promise<${responseType}>;`;
      } else if (contract.operationId === "wechatQrConnect") {
        signature = `(query?: ${requestType}["query"]) => Promise<${responseType}>;`;
      } else {
        signature = `(payload: ${requestType}) => Promise<${responseType}>;`;
      }
    }
    if (!groupedRuntimeMethods.has(groupName)) {
      groupedRuntimeMethods.set(groupName, []);
    }
    groupedRuntimeMethods.get(groupName).push(`${methodName}: ${signature}`);
  }

  const lines = [
    "/* eslint-disable perfectionist/sort-named-imports */",
    "// This file is generated by scripts/contracts/generate-hardening-artifacts.mjs",
    "",
    'import rawRuntimeApi from "../index.runtime.js";',
    'import type {',
  ];

  for (const contract of hardeningContracts) {
    const baseName = pascalCase(contract.operationId);
    if (contract.frontendRequestSchema) {
      lines.push(`  ${baseName}Request,`);
    }
    if (contract.frontendResponseSchema) {
      lines.push(`  ${baseName}Response,`);
    }
  }
  lines.push('} from "./contracts";', "");
  lines.push("const runtimeApi = rawRuntimeApi as {");
  for (const [groupName, methodSignatures] of groupedRuntimeMethods.entries()) {
    lines.push(`  ${groupName}: {`);
    methodSignatures.forEach((signature) => {
      lines.push(`    ${signature}`);
    });
    lines.push("  };");
  }
  lines.push("};", "");

  for (const contract of hardeningContracts) {
    const baseName = pascalCase(contract.operationId);
    const requestType = contract.frontendRequestSchema
      ? `${baseName}Request`
      : "";
    const responseType = contract.frontendResponseSchema
      ? `${baseName}Response`
      : "unknown";
    const signature = requestType
      ? `(payload: ${requestType})`
      : "()";
    let callExpression = `${contract.runtimeAccessor}(`;

    if (!requestType) {
      callExpression += ")";
    } else if (contract.operationId === "tokenImportProxyFetch") {
      callExpression += "payload.url)";
    } else if (contract.operationId === "wechatQrConnect") {
      callExpression += "payload.query || {})";
    } else if (contract.operationId === "wechatHortorLogin") {
      callExpression += "payload)";
    } else {
      callExpression += "payload)";
    }

    lines.push(
      `export const ${contract.operationId} = ${signature}: Promise<${responseType}> => ${callExpression};`,
    );
  }

  lines.push(
    "",
    "export const hardeningApi = {",
    ...hardeningContracts.map((contract) => `  ${contract.operationId},`),
    "};",
    "",
    "export default hardeningApi;",
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
};

const buildIndexTs = () => `/* eslint-disable perfectionist/sort-exports */
// This file is generated by scripts/contracts/generate-hardening-artifacts.mjs

export * from "./contracts";
export * from "./client";
`;

const writeFile = (targetPath, content) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
};

const verifyFile = (targetPath, expectedContent) => {
  const current = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, "utf8")
    : null;
  if (current !== expectedContent) {
    throw new Error(`Generated artifact is out of date: ${path.relative(repoRoot, targetPath)}`);
  }
};

const artifacts = {
  [outputFiles.openapi]: buildOpenApiDocument(),
  [outputFiles.contractsTs]: buildContractsTs(),
  [outputFiles.clientTs]: buildClientTs(),
  [outputFiles.indexTs]: buildIndexTs(),
};

if (process.argv.includes("--check")) {
  Object.entries(artifacts).forEach(([targetPath, content]) => {
    verifyFile(targetPath, content);
  });
} else {
  Object.entries(artifacts).forEach(([targetPath, content]) => {
    writeFile(targetPath, content);
  });
}
