import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { graphql } from "ponder";

const app = new Hono();

// Allow browser apps (the web dApp on :5173) to query the indexer.
app.use("*", cors({allowHeaders: ["Authorization", "Content-Type"]}));
 

// GraphQL at both / and /graphql; the SDK can also hit Ponder's auto SQL API.
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
