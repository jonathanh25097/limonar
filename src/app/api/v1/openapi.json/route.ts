import { openApiDocument } from "@/contracts/openapi";

/** The API description other clients generate their code from. */
export const GET = () => Response.json(openApiDocument());
