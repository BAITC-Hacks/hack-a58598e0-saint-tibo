/** Production entry emitted by `bun run build`; it only exists after a build. */
declare module "*dist/server/server.js" {
  const entry: { fetch: (request: Request) => Response | Promise<Response> };
  export default entry;
}
