import { createServer } from "node:http";
import { Command } from "commander";
import open from "open";
import pc from "picocolors";
import yoctoSpinner from "yocto-spinner";
import { OAUTH_CALLBACK_PATH } from "../lib/constants.js";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  registerClient,
  revokeToken,
} from "../lib/oauth.js";
import {
  clearTokens,
  getValidAccessToken,
  loadTokens,
  saveTokens,
} from "../lib/token-storage.js";
import { printError, printRecord, printSuccess } from "../lib/utils.js";

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>Memberstack CLI</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h1>Authenticated!</h1>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (message: string): string => `<!DOCTYPE html>
<html>
<head><title>Memberstack CLI</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h1>Authentication Failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

const waitForCallback = (
  port: number,
  expectedState: string
): Promise<{ code: string }> =>
  new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

      if (url.pathname !== OAUTH_CALLBACK_PATH) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const description = url.searchParams.get("error_description") ?? error;
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML(description));
        server.close();
        reject(new Error(`Authorization failed: ${description}`));
        return;
      }

      if (!(code && state)) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML("Missing code or state parameter"));
        server.close();
        reject(new Error("Missing code or state in callback"));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML("State mismatch — possible CSRF attack"));
        server.close();
        reject(new Error("State mismatch in OAuth callback"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(SUCCESS_HTML);
      server.close();
      resolve({ code });
    });

    server.listen(port, "127.0.0.1");
    server.on("error", reject);
  });

const findAvailablePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const { port } = addr;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to find available port")));
      }
    });
    server.on("error", reject);
  });

export const authCommand = new Command("auth")
  .usage("<command> [options]")
  .description("Manage OAuth authentication");

authCommand
  .command("login")
  .description("Authenticate with Memberstack via OAuth")
  .action(async () => {
    try {
      const port = await findAvailablePort();
      const redirectUri = `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`;

      const clientId = await registerClient(redirectUri);

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();

      const authUrl = buildAuthorizationUrl({
        clientId,
        redirectUri,
        codeChallenge,
        state,
      });

      process.stderr.write(`\n  ${pc.bold("Opening browser to log in...")}\n`);
      process.stderr.write(`  ${pc.dim(authUrl)}\n\n`);

      await open(authUrl);

      process.stderr.write(`  ${pc.dim("Waiting for authentication...")}\n`);

      const { code } = await waitForCallback(port, state);

      const tokens = await exchangeCodeForTokens({
        clientId,
        code,
        redirectUri,
        codeVerifier,
      });

      await saveTokens(tokens, clientId);

      process.stderr.write("\n");
      printSuccess("  Successfully authenticated with Memberstack!");
      process.stderr.write("\n");
    } catch (error) {
      printError(
        error instanceof Error ? error.message : "Authentication failed"
      );
      process.exitCode = 1;
    }
  });

authCommand
  .command("logout")
  .description("Remove stored authentication tokens")
  .action(async () => {
    try {
      const tokens = await loadTokens();

      if (tokens?.refresh_token) {
        try {
          await revokeToken({
            clientId: tokens.client_id,
            token: tokens.refresh_token,
          });
        } catch {
          // Best-effort revocation
        }
      }

      await clearTokens();

      process.stderr.write("\n");
      printSuccess("  Successfully logged out.");
      process.stderr.write("\n");
    } catch (error) {
      printError(error instanceof Error ? error.message : "Logout failed");
      process.exitCode = 1;
    }
  });

authCommand
  .command("status")
  .description("Show current authentication status")
  .action(async () => {
    try {
      const tokens = await loadTokens();

      process.stderr.write("\n");

      if (!tokens) {
        process.stderr.write(
          `  ${pc.bold("Status:")}  ${pc.yellow("Not logged in")}\n`
        );
        process.stderr.write(
          `\n  Run ${pc.cyan("memberstack-cli auth login")} to authenticate.\n`
        );
        process.stderr.write("\n");
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = tokens.expires_at - now;
      const isExpired = expiresIn <= 0;

      process.stderr.write(
        `  ${pc.bold("Status:")}       ${pc.green("Logged in")}\n`
      );

      if (tokens.app_id) {
        process.stderr.write(
          `  ${pc.bold("App ID:")}       ${pc.dim(tokens.app_id)}\n`
        );
      }

      if (isExpired) {
        process.stderr.write(
          `  ${pc.bold("Access Token:")} ${pc.red("Expired")}\n`
        );
      } else {
        const minutes = Math.floor(expiresIn / 60);
        const hours = Math.floor(minutes / 60);
        const timeStr =
          hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
        process.stderr.write(
          `  ${pc.bold("Expires in:")}   ${pc.dim(timeStr)}\n`
        );
      }

      process.stderr.write(
        `  ${pc.bold("Refresh:")}      ${tokens.refresh_token ? pc.green("Available") : pc.yellow("None")}\n`
      );

      const validToken = await getValidAccessToken();
      if (validToken) {
        process.stderr.write(
          `  ${pc.bold("Token:")}        ${pc.green("Valid")}\n`
        );
      } else if (isExpired) {
        process.stderr.write(
          `  ${pc.bold("Token:")}        ${pc.red("Invalid — re-login required")}\n`
        );
      }

      process.stderr.write("\n");
    } catch (error) {
      printError(
        error instanceof Error ? error.message : "Failed to check status"
      );
      process.exitCode = 1;
    }
  });

authCommand
  .command("update-profile")
  .description("Update your profile (first name, last name, email)")
  .option("--first-name <name>", "First name")
  .option("--last-name <name>", "Last name")
  .option("--email <email>", "Email address")
  .action(
    async (opts: { firstName?: string; lastName?: string; email?: string }) => {
      const input: Record<string, string> = {};
      if (opts.firstName) {
        input.firstName = opts.firstName;
      }
      if (opts.lastName) {
        input.lastName = opts.lastName;
      }
      if (opts.email) {
        input.email = opts.email;
      }

      if (Object.keys(input).length === 0) {
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const spinner = yoctoSpinner({ text: "Updating profile..." }).start();
      try {
        const result = await graphqlRequest<{
          updateUserProfile: {
            id: string;
            auth: { email: string };
            profile: { firstName: string | null; lastName: string | null };
          };
        }>({
          query: `mutation($input: UpdateUserProfileInput!) {
  updateUserProfile(input: $input) {
    id
    auth { email }
    profile { firstName lastName }
  }
}`,
          variables: { input },
        });
        spinner.stop();
        const { updateUserProfile: user } = result;
        printSuccess("Profile updated successfully.");
        printRecord({
          email: user.auth.email,
          firstName: user.profile.firstName ?? "",
          lastName: user.profile.lastName ?? "",
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        process.exitCode = 1;
      }
    }
  );
