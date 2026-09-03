# Rules and API verification

Checked September 3, 2026 between 12:10 AM and 12:20 AM Eastern, before any application code was written. Official sources govern over the build brief and over any plugin output.

## Challenge rules — `https://webmcp.devpost.com/rules` (fetched)

- **Deadline:** September 3, 2026 at 1:00 PM PDT (4:00 PM Eastern).
- **Working application:** "Provide a working live URL that judges can access using ChatGPT's in-app browser or Google Chrome with WebMCP enabled." Hosting on ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, "or similar provider" is acceptable. GitHub Pages is a similar static provider and serves over HTTPS with no login.
- **Code repository:** public GitHub, GitLab, or Bitbucket; "must be open source by including an open source license file"; the license must be "detectable and visible at the top of the repository page"; include all source code, assets, and functional instructions.
- **Text description:** must explain why WebMCP fits the use case, how it improves the user experience, what humans and agents can accomplish together that was not previously possible, and the implementation approach.
- **Video:** "must be less than three (3) minutes", with audio, uploaded and publicly visible on YouTube, no unauthorised third-party trademarks or copyrighted material.
- **New work:** "Projects must be either newly created during the Hackathon Submission Period or, if the Project existed prior to the Submission Period, must have been meaningfully extended using WebMCP after the Submission Period start date." This repository is newly created; the commit history is dated.
- **Availability:** the project must remain available free of charge for testing by the sponsor, administrator, and judges until the judging period ends, September 21, 2026 at 5:00 PM PDT.
- **Judging criteria, equally weighted:** WebMCP Leverage, Execution, Potential Impact, Creativity and Ambition.

## Challenge page — `https://webmcp.devpost.com/` (fetched)

- Tools are registered "using JavaScript at the page level" with `document.modelContext.registerTool({ name, description, inputSchema, execute })`.
- Testing environments named: ChatGPT's in-app browser, and Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
- Prizes: ten winners; presentation quality matters because judges may decide from the description, images, and video.

## ChatGPT site tools — `https://learn.chatgpt.com/docs/webmcp` (fetched)

- Registration sample matches the imperative API: feature-detect `typeof document.modelContext?.registerTool === "function"`, then `await document.modelContext.registerTool({...})` with `annotations: { readOnlyHint: true }` for reads.
- `execute` "receives arguments from the input schema and must return data sufficient to verify the operation's outcome". This project returns a structured result envelope with a state version and verification block.
- **Top-level pages only.** Tools registered inside iframes (same-origin or cross-origin) are not exposed. Declarative HTML form attributes are not supported as site tools.
- Models: GPT-5.6 Sol and GPT-5.6 Terra support site tools; GPT-5.6 Luna currently has them disabled. Requires the latest ChatGPT desktop app.
- UI: users open **Site tools** from the address bar to see **Available site tools**; **Recently used** shows tool calls with a **Sources** option.

## Chrome documentation — `https://developer.chrome.com/docs/ai/webmcp` and `/imperative-api` (fetched)

- Available from Chrome 149 behind `chrome://flags/#enable-webmcp-testing` (origin trial also available).
- `registerTool(descriptor, { signal })` — unregistration is done by aborting the `AbortSignal` passed at registration time.
- `execute(args, { signal })` must return a string or an object.
- Annotations documented: `readOnlyHint`, `untrustedContentHint`. No `destructiveHint` is documented, so none is used here.
- `getTools()` returns the registered tools; `executeTool(tool, input)` executes one; a `toolchange` event fires on `document.modelContext` when the registry changes.
- WebMCP is gated by the `tools` Permissions Policy; same-origin contexts are allowed by default.

## Type definitions — `webmcp-types@0.1.5` (installed, `node_modules/webmcp-types/index.d.ts`)

- `ModelContextTool { name; title?; description; inputSchema?; execute; annotations? }`
- `ToolExecuteCallback(inputObject, { signal }) => MaybePromise<unknown>`
- `ToolAnnotations { readOnlyHint?; untrustedContentHint? }`
- `ModelContext.registerTool(tool, { signal?, exposedTo? }): Promise<void>`; `getTools()`; `toolchange` event.
- Tool names: 1–128 characters, ASCII alphanumeric, `_`, `-`, or `.`.

## Sources that could not be fetched

- `https://openai.com/webmcp-challenge/` returned HTTP 403 to the fetcher. The Devpost pages above carry the same requirements and are the binding rules.
- `https://github.com/webmachinelearning/webmcp/blob/main/docs/explainer.md` returned 404; the repository README was fetched instead and agrees with the Chrome documentation.

## Consequences for this build

1. Register all tools from `src/main.tsx` in the top-level document, once, guarded against duplicate registration.
2. Return plain objects from `execute` (the result envelope), never DOM nodes or class instances.
3. Use only `readOnlyHint` in annotations.
4. Keep the app static, HTTPS, login-free, and available unchanged through September 21, 2026.
5. Keep the video under three minutes and free of third-party marks.
